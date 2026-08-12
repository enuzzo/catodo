import { openCatalogDb, get, getAll, put, transactionDone, replaceSourceSnapshot, hydrateCatalog } from "./db.js";
import { parseM3U, mergeChannelRecords } from "./m3u.js";
import { sourceIdFor } from "./identity.js";
import { fetchPlaylist } from "./fetcher.js";
import { countryPlaylistUrl, assertImportAllowed } from "./source-policy.js";
import { migrateLegacyStorage } from "./migration.js";
import { loadCountries } from "./countries.js";
import { randomPlayable, randomWorld, countryStats } from "./randomizer.js";
import { CatalogSearch, searchChannels } from "./search.js";
import { enrichPersistedChannelMetadata } from "./iptv-org-metadata.js";

function readonlyState(state) {
  return { ...state, sources: [...state.sources], channels: [...state.channels], favorites: new Set(state.favorites), history: [...state.history], countries: [...state.countries] };
}

export class CatalogService {
  #db = null;
  #listeners = new Set();
  #search;
  #options;
  #metadataEnrichment = null;
  #state = { ready: false, loading: false, error: null, sources: [], channels: [], favorites: new Set(), history: [], countries: [] };

  constructor(options = {}) {
    this.#options = options;
    this.#search = new CatalogSearch(options.search || {});
  }

  async init() {
    if (this.#db) return this.getState();
    this.#set({ loading: true, error: null });
    try {
      this.#db = await openCatalogDb(this.#options.indexedDB);
      let legacyStorage = this.#options.localStorage;
      if (legacyStorage === undefined) {
        try { legacyStorage = globalThis.localStorage; }
        catch { legacyStorage = undefined; }
      }
      await migrateLegacyStorage(this.#db, legacyStorage);
      const [catalog, countries] = await Promise.all([hydrateCatalog(this.#db), loadCountries(this.#db, { fetchImpl: this.#options.fetchImpl })]);
      this.#state = { ...this.#state, countries };
      this.#applyCatalog(catalog);
      this.#set({ ready: true, loading: false });
      const state = this.getState();
      if (this.#options.autoEnrichMetadata !== false && state.channels.some((channel) => !channel.countries?.length || !channel.languages?.length)) {
        // Legacy enrichment is intentionally detached: readiness never waits on
        // the large, optional iptv-org directory requests.
        void this.enrichMetadata();
      }
      return state;
    } catch (error) {
      this.#set({ ready: false, loading: false, error });
      throw error;
    }
  }

  subscribe(listener) {
    this.#listeners.add(listener);
    listener(this.getState());
    return () => this.#listeners.delete(listener);
  }

  getState() { return readonlyState(this.#state); }

  async getSetting(key, fallback = null) {
    this.#requireDb();
    const record = await get(this.#db, "settings", key);
    return record ? record.value : fallback;
  }

  async setSetting(key, value) {
    this.#requireDb();
    await put(this.#db, "settings", { key, value, updatedAt: Date.now() });
    return value;
  }

  async importCountry(code, { confirmed = false, ...options } = {}) {
    if (!confirmed) {
      const error = new Error("Importing a country playlist requires confirmation");
      error.code = "CONSENT_REQUIRED";
      error.intent = { type: "country", code: String(code).toUpperCase(), url: countryPlaylistUrl(code) };
      throw error;
    }
    return this.importUrl(countryPlaylistUrl(code), { ...options, confirmed: true, name: options.name || String(code).toUpperCase() });
  }

  async importUrl(url, options = {}) {
    this.#requireDb();
    const policy = assertImportAllowed(url, options);
    const existing = this.#state.sources.find((source) => source.url === policy.url);
    if (existing) return this.refreshSource(existing.sourceId, options);
    const source = {
      sourceId: sourceIdFor({ url: policy.url }),
      kind: "url",
      name: options.name || this.#nameFromUrl(policy.url),
      url: policy.url,
      trusted: policy.trusted,
      createdAt: Date.now(),
      etag: null,
      lastModified: null,
    };
    await put(this.#db, "sources", source);
    return this.refreshSource(source.sourceId, options);
  }

  async refreshSource(sourceId, options = {}) {
    this.#requireDb();
    const source = await get(this.#db, "sources", sourceId);
    if (!source) throw new Error(`Unknown source: ${sourceId}`);
    this.#set({ loading: true, error: null });
    try {
      const result = await fetchPlaylist(source.url, {
        fetchImpl: options.fetchImpl || this.#options.fetchImpl,
        proxy: options.proxy ?? this.#options.proxy,
        etag: source.etag,
        lastModified: source.lastModified,
        limits: options.fetchLimits || this.#options.fetchLimits,
      });
      if (result.notModified) {
        await put(this.#db, "sources", { ...source, checkedAt: Date.now(), error: null });
      } else {
        const parsed = parseM3U(result.text, { sourceId, limits: options.parseLimits || this.#options.parseLimits });
        if (!parsed.length) throw new Error("Playlist contains no channels");
        const channels = mergeChannelRecords(parsed);
        await replaceSourceSnapshot(this.#db, { ...source, etag: result.etag, lastModified: result.lastModified, checkedAt: Date.now() }, channels, { etag: result.etag, lastModified: result.lastModified });
      }
      await this.#reload();
      this.#set({ loading: false });
      return (await get(this.#db, "sources", sourceId));
    } catch (error) {
      // Do not touch activeSnapshotId: the previous good snapshot remains active.
      await put(this.#db, "sources", { ...source, checkedAt: Date.now(), error: error.message });
      await this.#reload();
      this.#set({ loading: false, error });
      throw error;
    }
  }

  async removeSource(sourceId) {
    this.#requireDb();
    const tx = this.#db.transaction(["sources", "snapshots", "endpoints", "channelSources"], "readwrite");
    const done = transactionDone(tx);
    tx.objectStore("sources").delete(sourceId);
    const removeIndexed = (store, index) => new Promise((resolve, reject) => {
      const request = tx.objectStore(store).index(index).openCursor(sourceId);
      request.onsuccess = () => { const cursor = request.result; if (!cursor) return resolve(); cursor.delete(); cursor.continue(); };
      request.onerror = () => reject(request.error);
    });
    await Promise.all([removeIndexed("snapshots", "sourceId"), removeIndexed("endpoints", "sourceId"), removeIndexed("channelSources", "sourceId")]);
    await done;
    await this.#reload();
  }

  async toggleFavorite(channelId) {
    this.#requireDb();
    const existing = await get(this.#db, "favorites", channelId);
    const transaction = this.#db.transaction("favorites", "readwrite");
    existing ? transaction.objectStore("favorites").delete(channelId) : transaction.objectStore("favorites").put({ id: channelId, channelId, createdAt: Date.now() });
    await transactionDone(transaction);
    await this.#reload();
    return !existing;
  }

  async remember(channelId, metadata = {}) {
    this.#requireDb();
    const id = `${Date.now()}:${channelId}`;
    await put(this.#db, "history", { id, channelId, rememberedAt: Date.now(), ...metadata });
    const history = (await getAll(this.#db, "history")).sort((a, b) => b.rememberedAt - a.rememberedAt);
    if (history.length > (this.#options.historyLimit || 100)) {
      const tx = this.#db.transaction("history", "readwrite");
      history.slice(this.#options.historyLimit || 100).forEach((item) => tx.objectStore("history").delete(item.id));
      await transactionDone(tx);
    }
    await this.#reload();
  }

  /** Best-effort enrichment for persisted legacy rows with missing metadata. */
  async enrichMetadata(options = {}) {
    this.#requireDb();
    if (this.#metadataEnrichment) return this.#metadataEnrichment;
    const db = this.#db;
    this.#metadataEnrichment = enrichPersistedChannelMetadata(db, this.#state.channels, {
      fetchImpl: options.fetchImpl || this.#options.fetchImpl,
      maxAge: options.maxAge ?? this.#options.metadataMaxAge,
      timeout: options.timeout ?? this.#options.metadataTimeout,
      force: options.force,
      signal: options.signal,
    }).then(async (result) => {
      if (result.updated && this.#db === db) {
        try { await this.#reload(); }
        catch (error) { result.warning ||= error?.message || String(error); }
      }
      return result;
    }).catch((error) => ({ attempted: 0, matched: 0, updated: 0, matchedBy: { endpoint: 0, tvgId: 0 }, source: "none", stale: false, error: error?.message || String(error) }))
      .finally(() => { this.#metadataEnrichment = null; });
    return this.#metadataEnrichment;
  }

  list(filters = {}) {
    let channels = [...this.#state.channels];
    const contains = (values, expected) => !expected || values?.some((value) => value.toLocaleLowerCase("en-US") === String(expected).toLocaleLowerCase("en-US"));
    if (filters.country) channels = channels.filter((channel) => contains(channel.countries, filters.country));
    if (filters.language) channels = channels.filter((channel) => contains(channel.languages, filters.language));
    if (filters.category) channels = channels.filter((channel) => contains(channel.categories, filters.category));
    if (filters.source) {
      const source = String(filters.source).toLocaleLowerCase("en-US");
      channels = channels.filter((channel) => channel.sources?.includes(filters.source) || channel.sourceNames?.some((name) => name.toLocaleLowerCase("en-US") === source));
    }
    if (filters.favorite) channels = channels.filter((channel) => this.#state.favorites.has(channel.channelId));
    if (filters.query) channels = searchChannels(channels, filters.query);
    return channels;
  }

  filter(filters = {}) { return this.list(filters); }
  search(query) { return this.#search.search(query); }
  randomPlayable(options = {}) { return randomPlayable(this.list(options.filters), options); }
  randomWorld(options = {}) { return randomWorld(this.list(options.filters), options); }
  getCountryStats(filters = {}) { return countryStats(this.list(filters)); }
  countryStats(filters = {}) { return this.getCountryStats(filters); }

  destroy() {
    this.#search.destroy();
    this.#db?.close();
    this.#db = null;
    this.#listeners.clear();
  }

  async #reload() { this.#applyCatalog(await hydrateCatalog(this.#db)); }

  #applyCatalog(catalog) {
    const countryNames = new Map(this.#state.countries.map((country) => [country.code, country.name]));
    catalog.channels = catalog.channels.map((channel) => ({ ...channel, countryNames: channel.countries.map((code) => countryNames.get(code)).filter(Boolean) }));
    const favorites = new Set(catalog.favorites.filter((item) => item.channelId).map((item) => item.channelId));
    const history = [...catalog.history].sort((a, b) => b.rememberedAt - a.rememberedAt);
    this.#state = { ...this.#state, ...catalog, favorites, history };
    this.#search.index(catalog.channels);
    this.#emit();
  }

  #set(update) { this.#state = { ...this.#state, ...update }; this.#emit(); }
  #emit() { const state = this.getState(); this.#listeners.forEach((listener) => listener(state)); }
  #requireDb() { if (!this.#db) throw new Error("CatalogService.init() must be called first"); }
  #nameFromUrl(value) { const url = new URL(value); return decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() || url.hostname).replace(/\.m3u8?$/i, ""); }
}

export default CatalogService;
