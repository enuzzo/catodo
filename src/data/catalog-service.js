import { openCatalogDb, get, getAll, put, recordsByIndex, transactionDone, replaceSourceSnapshot, hydrateCatalog, applyInstallationState } from "./db.js";
import { parseM3U, mergeChannelRecords } from "./m3u.js";
import { sourceIdFor } from "./identity.js";
import { fetchPlaylist } from "./fetcher.js";
import { countryPlaylistUrl, assertImportAllowed } from "./source-policy.js";
import { migrateLegacyStorage } from "./migration.js";
import { loadCountries } from "./countries.js";
import { randomPlayable, randomWorld, countryStats } from "./randomizer.js";
import { CatalogSearch, searchChannels } from "./search.js";
import {
  enrichPersistedChannelMetadata,
  enrichPersistedChannelSafety,
  IPTV_ORG_METADATA_REVISION,
} from "./iptv-org-metadata.js";
import { InstallationSync, SYNC_SETTINGS, installationPayload } from "./installation-sync.js";

const isBlocked = (channel) => Boolean(channel?.blocked || (Array.isArray(channel?.blocklist) && channel.blocklist.length));
const isNsfw = (channel) => Boolean(channel?.isNsfw || channel?.is_nsfw);

function readonlyState(state) {
  return { ...state, sources: [...state.sources], channels: [...state.channels], favorites: new Set(state.favorites), history: [...state.history], countries: [...state.countries] };
}

export class CatalogService {
  #db = null;
  #listeners = new Set();
  #search;
  #options;
  #metadataEnrichment = null;
  #installationSync = null;
  #syncingInstallation = false;
  #installationSyncPending = false;
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
      this.#installationSync = this.#options.installationSync === false
        ? null
        : this.#options.installationSync || new InstallationSync({ fetchImpl: this.#options.fetchImpl || globalThis.fetch });
      let remoteInstallation = null;
      if (this.#installationSync) {
        remoteInstallation = await this.#installationSync.load();
        if (remoteInstallation?.updatedAt) await applyInstallationState(this.#db, remoteInstallation);
      }
      const syncedProxy = remoteInstallation?.settings?.proxy;
      if (typeof syncedProxy === 'string' && syncedProxy) this.#options.proxy = syncedProxy;
      let [catalog, countries] = await Promise.all([hydrateCatalog(this.#db), loadCountries(this.#db, { fetchImpl: this.#options.fetchImpl })]);
      if (this.#options.autoEnrichMetadata !== false && catalog.channels.length) {
        const safety = await this.#enrichSafety(catalog.channels, { strict: true });
        if (safety.updated) catalog = await hydrateCatalog(this.#db);
      }
      this.#state = { ...this.#state, countries };
      this.#applyCatalog(catalog, { emit: false });
      this.#set({ ready: true, loading: false });
      if (this.#installationSync?.supported) {
        if (!remoteInstallation?.updatedAt) void this.#pushInstallationState();
        else {
          const missingSources = catalog.sources.filter((source) => !source.activeSnapshotId);
          if (missingSources.length) globalThis.setTimeout(() => void this.#hydrateInstallationSources(missingSources), 0);
        }
      }
      const state = this.getState();
      if (this.#options.autoEnrichMetadata !== false && state.channels.some((channel) => channel.metadataRevision !== IPTV_ORG_METADATA_REVISION || channel.endpoints?.some((endpoint) => endpoint.metadataRevision !== IPTV_ORG_METADATA_REVISION))) this.#scheduleMetadataEnrichment();
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
    if (SYNC_SETTINGS.has(key)) await this.#pushInstallationState();
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
    const [previousEndpoints, previousRelations] = await Promise.all([
      recordsByIndex(this.#db, "endpoints", "sourceId", sourceId),
      recordsByIndex(this.#db, "channelSources", "sourceId", sourceId),
    ]);
    const previousChannelIds = new Set(previousRelations.map((row) => row.channelId));
    const previousChannelRows = previousChannelIds.size
      ? (await getAll(this.#db, "channels")).filter((row) => previousChannelIds.has(row.channelId))
      : [];
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
      let stagedCatalog = await hydrateCatalog(this.#db);
      if (this.#options.autoEnrichMetadata !== false) {
        const safety = await this.#enrichSafety(stagedCatalog.channels, { ...options, strict: true });
        if (safety.updated) stagedCatalog = await hydrateCatalog(this.#db);
      }
      this.#applyCatalog(stagedCatalog, { emit: false });
      this.#set({ loading: false });
      await this.#pushInstallationState();
      if (this.#options.autoEnrichMetadata !== false) this.#scheduleMetadataEnrichment(options);
      return (await get(this.#db, "sources", sourceId));
    } catch (error) {
      // replaceSourceSnapshot activates atomically; a failed safety gate must
      // restore the prior active snapshot before any restart can hydrate it.
      await this.#restoreSourceSnapshot(source, previousEndpoints, previousRelations, previousChannelRows, error);
      // Keep the last in-memory good/safety-checked catalog visible. A newly
      // replaced snapshot is not exposed until its safety pass succeeds.
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
    await this.#pushInstallationState();
  }

  async toggleFavorite(channelId) {
    this.#requireDb();
    const existing = await get(this.#db, "favorites", channelId);
    const transaction = this.#db.transaction("favorites", "readwrite");
    existing ? transaction.objectStore("favorites").delete(channelId) : transaction.objectStore("favorites").put({ id: channelId, channelId, createdAt: Date.now() });
    await transactionDone(transaction);
    await this.#reload();
    await this.#pushInstallationState();
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
      if ((result.updated || result.endpointsUpdated) && this.#db === db) {
        try { await this.#reload(); }
        catch (error) { result.warning ||= error?.message || String(error); }
      }
      return result;
    }).catch((error) => ({ attempted: 0, matched: 0, updated: 0, matchedBy: { endpoint: 0, tvgId: 0 }, source: "none", stale: false, error: error?.message || String(error) }))
      .finally(() => { this.#metadataEnrichment = null; });
    return this.#metadataEnrichment;
  }

  list(filters = {}) {
    let channels = this.#state.channels.filter((channel) => !isBlocked(channel) && (filters.includeNsfw === true || !isNsfw(channel)));
    const contains = (values, expected) => !expected || values?.some((value) => value.toLocaleLowerCase("en-US") === String(expected).toLocaleLowerCase("en-US"));
    if (filters.country) channels = channels.filter((channel) => contains(channel.countries, filters.country));
    if (filters.language) channels = channels.filter((channel) => contains(channel.languages, filters.language));
    if (filters.category) channels = channels.filter((channel) => contains(channel.categories, filters.category) || contains(channel.categoryNames, filters.category));
    if (filters.source) {
      const source = String(filters.source).toLocaleLowerCase("en-US");
      channels = channels.filter((channel) => channel.sources?.includes(filters.source) || channel.sourceNames?.some((name) => name.toLocaleLowerCase("en-US") === source));
    }
    if (filters.favorite) channels = channels.filter((channel) => this.#state.favorites.has(channel.channelId));
    if (filters.query) channels = searchChannels(channels, filters.query);
    return channels;
  }

  filter(filters = {}) { return this.list(filters); }
  search(query, options = {}) {
    if (options.includeNsfw === true) return Promise.resolve(searchChannels(this.list({ includeNsfw: true }), query));
    return this.#search.search(query);
  }
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

  async #pushInstallationState() {
    if (!this.#installationSync?.supported) return;
    if (this.#syncingInstallation) {
      this.#installationSyncPending = true;
      return;
    }
    this.#syncingInstallation = true;
    try {
      const settings = {};
      for (const key of SYNC_SETTINGS) settings[key] = await this.getSetting(key, key === 'epg:sources' ? [] : key === 'epg:refreshMinutes' ? 360 : '');
      const catalog = await hydrateCatalog(this.#db);
      const saved = await this.#installationSync.save(installationPayload({ ...catalog, settings }));
      if (saved && this.#installationSync.supported) {
        await applyInstallationState(this.#db, saved);
        await this.#reload();
      }
    } catch (error) {
      this.#options.onSyncError?.(error);
    } finally {
      this.#syncingInstallation = false;
      if (this.#installationSyncPending) {
        this.#installationSyncPending = false;
        queueMicrotask(() => void this.#pushInstallationState());
      }
    }
  }

  async #hydrateInstallationSources(sources) {
    for (const source of sources) {
      try { await this.refreshSource(source.sourceId, { confirmed: true }); }
      catch (error) { this.#options.onSyncError?.(error); }
    }
  }

  #applyCatalog(catalog, { emit = true } = {}) {
    const countryNames = new Map(this.#state.countries.map((country) => [country.code, country.name]));
    catalog.channels = catalog.channels.map((channel) => ({ ...channel, countryNames: channel.countries.map((code) => countryNames.get(code)).filter(Boolean) }));
    const favorites = new Set(catalog.favorites.filter((item) => item.channelId).map((item) => item.channelId));
    const history = [...catalog.history].sort((a, b) => b.rememberedAt - a.rememberedAt);
    this.#state = { ...this.#state, ...catalog, favorites, history };
    this.#search.index(this.list());
    if (emit) this.#emit();
  }

  async #enrichSafety(channels, options = {}) {
    const result = await enrichPersistedChannelSafety(this.#db, channels, {
      fetchImpl: options.fetchImpl || this.#options.fetchImpl,
      maxAge: options.maxAge ?? this.#options.metadataMaxAge,
      timeout: options.timeout ?? this.#options.metadataTimeout,
      force: options.force,
      signal: options.signal,
    });
    if (options.strict && result.error) {
      const error = new Error(`Safety metadata unavailable: ${result.error}`);
      error.code = "SAFETY_METADATA_UNAVAILABLE";
      throw error;
    }
    return result;
  }

  #scheduleMetadataEnrichment(options = {}) {
    const start = () => { if (this.#db) void this.enrichMetadata(options); };
    const defer = (callback) => {
      if (typeof globalThis.requestIdleCallback === "function") {
        globalThis.requestIdleCallback(callback, { timeout: 5_000 });
      } else globalThis.setTimeout(callback, 1_500);
    };
    if (this.#metadataEnrichment) void this.#metadataEnrichment.finally(() => defer(start));
    else defer(start);
  }

  async #restoreSourceSnapshot(source, endpointRows, relationRows, channelRows, error) {
    const tx = this.#db.transaction(["sources", "endpoints", "channelSources", "channels"], "readwrite");
    const done = transactionDone(tx);
    const removeIndexed = (store, index) => new Promise((resolve, reject) => {
      const request = tx.objectStore(store).index(index).openCursor(source.sourceId);
      request.onsuccess = () => { const cursor = request.result; if (!cursor) return resolve(); cursor.delete(); cursor.continue(); };
      request.onerror = () => reject(request.error);
    });
    await Promise.all([
      removeIndexed("endpoints", "sourceId"),
      removeIndexed("channelSources", "sourceId"),
    ]);
    endpointRows.forEach((row) => tx.objectStore("endpoints").put(row));
    relationRows.forEach((row) => tx.objectStore("channelSources").put(row));
    channelRows.filter(Boolean).forEach((row) => tx.objectStore("channels").put(row));
    tx.objectStore("sources").put({ ...source, checkedAt: Date.now(), error: error?.message || String(error) });
    await done;
  }

  #set(update) { this.#state = { ...this.#state, ...update }; this.#emit(); }
  #emit() { const state = this.getState(); this.#listeners.forEach((listener) => listener(state)); }
  #requireDb() { if (!this.#db) throw new Error("CatalogService.init() must be called first"); }
  #nameFromUrl(value) { const url = new URL(value); return decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() || url.hostname).replace(/\.m3u8?$/i, ""); }
}

export default CatalogService;
