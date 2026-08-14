import {
  openCatalogDb,
  get,
  getAll,
  put,
  requestResult,
  recordsByIndex,
  transactionDone,
  replaceSourceSnapshot,
  hydrateCatalog,
  applyInstallationProjection,
} from "./db.js";
import { parseM3U, mergeChannelRecords } from "./m3u.js";
import { sourceIdFor } from "./identity.js";
import { fetchPlaylist } from "./fetcher.js";
import { countryPlaylistUrl, assertImportAllowed } from "./source-policy.js";
import { legacyInstallationPayload, migrateLegacyStorage } from "./migration.js";
import { loadCountries } from "./countries.js";
import { randomPlayable, randomWorld, countryStats } from "./randomizer.js";
import { CatalogSearch, searchChannels } from "./search.js";
import {
  enrichPersistedChannelMetadata,
  enrichPersistedChannelSafety,
  IPTV_ORG_METADATA_REVISION,
} from "./iptv-org-metadata.js";
import {
  InstallationSync,
  SYNC_SETTINGS,
  assertSharedSetting,
  installationPayload,
  mergeInstallationPayloads,
} from "./installation-sync.js";

const isBlocked = (channel) => Boolean(channel?.blocked || (Array.isArray(channel?.blocklist) && channel.blocklist.length));
const isNsfw = (channel) => Boolean(channel?.isNsfw || channel?.is_nsfw);
const OUTBOX_SETTING = 'installation:outbox';
const RECOVERY_SETTING = 'installation:legacy-recovery';
const LINKED_SETTING = 'installation:linked';
const LEASE_SETTING = 'installation:outbox-lease';
const LEASE_MS = 60_000;

function intentId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

function readonlyState(state) {
  return {
    ...state,
    sources: [...state.sources],
    channels: [...state.channels],
    favorites: new Set(state.favorites),
    history: [...state.history],
    countries: [...state.countries],
    installationSync: { ...state.installationSync },
  };
}

export class CatalogService {
  #db = null;
  #listeners = new Set();
  #search;
  #options;
  #metadataEnrichment = null;
  #installationSync = null;
  #installationDrainPromise = null;
  #installationRetryTimer = 0;
  #installationRemote = null;
  #legacyInstallationPayload = null;
  #installationOwner = intentId();
  #sourceEpochs = new Map();
  #sourceControllers = new Map();
  #hydratingSources = new Set();
  #failedHydrationSources = new Set();
  #state = {
    ready: false,
    loading: false,
    error: null,
    sources: [],
    channels: [],
    favorites: new Set(),
    history: [],
    countries: [],
    installationSync: {
      status: 'loading',
      error: null,
      hydrating: 0,
      hydrationFailed: 0,
      pending: 0,
      recoveryAvailable: false,
    },
  };

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
      this.#legacyInstallationPayload = legacyInstallationPayload(legacyStorage);
      this.#installationSync = this.#options.installationSync === false
        ? null
        : this.#options.installationSync || new InstallationSync({ fetchImpl: this.#options.fetchImpl || globalThis.fetch });
      let remoteInstallation = null;
      if (this.#installationSync) {
        try {
          remoteInstallation = await this.#installationSync.load();
          this.#installationRemote = remoteInstallation;
          if (remoteInstallation) {
            const localBeforeRemote = await hydrateCatalog(this.#db);
            const localSettings = await this.#sharedSettings();
            const localPayload = installationPayload({ ...localBeforeRemote, settings: localSettings });
            const recoveryPayload = this.#recoveryPayload(localPayload);
            let outbox = await this.#installationOutbox();
            const migrationPending = remoteInstallation.migration?.legacyInstallation !== 'complete';
            if (!migrationPending) {
              for (const intent of outbox.filter((entry) => entry.type === 'link-merge')) {
                await this.#deferLinkRecovery(intent);
              }
              outbox = await this.#installationOutbox();
            }
            if (migrationPending && this.#hasInstallationData(recoveryPayload) && !outbox.some((intent) => intent.type === 'link-merge')) {
              await this.#appendInstallationIntent({
                type: 'link-merge',
                payload: recoveryPayload,
                markLinked: true,
              });
              outbox = await this.#installationOutbox();
            } else if (!migrationPending && this.#addsInstallationData(
              this.#foldInstallationOutbox(remoteInstallation, outbox),
              recoveryPayload,
            )) {
              await this.#storeRecovery(recoveryPayload);
            }
            const applied = await this.#applyInstallationProjection(remoteInstallation, { reload: false });
            this.#setInstallationSync({
              status: outbox.length ? 'pending' : 'synced',
              error: null,
              pending: applied.outbox.length,
              recoveryAvailable: Boolean(await this.#recoveryRecord()),
            });
          }
          if (!this.#installationSync.supported) this.#setInstallationSync({ status: 'local-only', error: null });
        } catch (error) {
          this.#setInstallationSync({ status: 'error', error });
          this.#options.onSyncError?.(error);
        }
      } else {
        this.#setInstallationSync({ status: 'local-only', error: null });
      }
      const syncedProxy = (await this.#sharedSettings()).proxy;
      if (typeof syncedProxy === 'string' && syncedProxy) this.#options.proxy = syncedProxy;
      let [catalog, countries] = await Promise.all([hydrateCatalog(this.#db), loadCountries(this.#db, { fetchImpl: this.#options.fetchImpl })]);
      if (this.#options.autoEnrichMetadata !== false && catalog.channels.length) {
        const safety = await this.#enrichSafety(catalog.channels, { strict: true });
        if (safety.updated) catalog = await hydrateCatalog(this.#db);
      }
      this.#state = { ...this.#state, countries };
      this.#applyCatalog(catalog, { emit: false });
      this.#set({ ready: true, loading: false });
      if (this.#installationSync?.supported && this.#installationSync.loaded) {
        await this.#drainInstallationMutations();
        const current = await hydrateCatalog(this.#db);
        const missingSources = current.sources.filter((source) => !source.activeSnapshotId);
        if (missingSources.length) void this.#hydrateInstallationSources(missingSources);
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

  async retryInstallationSync() {
    this.#requireDb();
    if (!this.#installationSync?.supported) return false;
    try {
      if (this.#installationDrainPromise) await this.#installationDrainPromise;
      const remote = await this.#installationSync.load();
      if (!remote) return false;
      this.#installationRemote = remote;
      await this.#applyInstallationProjection(remote);
      return this.#drainInstallationMutations();
    } catch (error) {
      const pending = (await this.#installationOutbox()).length;
      this.#setInstallationSync({ status: 'error', error, pending });
      this.#options.onSyncError?.(error);
      return false;
    }
  }

  async recoverInstallationData() {
    this.#requireDb();
    const recovery = await this.#recoveryRecord();
    if (!recovery?.value || !this.#hasInstallationData(recovery.value)) return false;
    const intent = await this.#appendInstallationIntent({
      type: 'recovery-merge',
      payload: recovery.value,
      clearRecovery: true,
    });
    if (this.#installationRemote) await this.#applyInstallationProjection(this.#installationRemote);
    return this.#syncPersistedIntent(intent.id);
  }

  async getSetting(key, fallback = null) {
    this.#requireDb();
    const record = await get(this.#db, "settings", key);
    return record ? record.value : fallback;
  }

  async setSetting(key, value) {
    this.#requireDb();
    if (!SYNC_SETTINGS.has(key) || !this.#usesInstallationOutbox()) {
      await put(this.#db, "settings", { key, value, updatedAt: Date.now() });
      return value;
    }
    const sharedValue = assertSharedSetting(key, value);
    const intent = this.#newInstallationIntent({ type: 'set-setting', key, value: sharedValue });
    const transaction = this.#db.transaction('settings', 'readwrite');
    const done = transactionDone(transaction);
    const store = transaction.objectStore('settings');
    const outboxRecord = await requestResult(store.get(OUTBOX_SETTING));
    store.put({ key, value: sharedValue, updatedAt: Date.now() });
    const retained = this.#outboxValues(outboxRecord)
      .filter((entry) => !(entry.type === 'set-setting' && entry.key === key));
    this.#writeOutbox(store, [...retained, intent]);
    await done;
    await this.#syncPersistedIntent(intent.id);
    return sharedValue;
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
    const epoch = (this.#sourceEpochs.get(sourceId) || 0) + 1;
    this.#sourceEpochs.set(sourceId, epoch);
    this.#sourceControllers.get(sourceId)?.abort();
    const controller = new AbortController();
    this.#sourceControllers.set(sourceId, controller);
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
        signal: controller.signal,
      });
      await this.#assertSourceCurrent(sourceId, epoch);
      if (result.notModified) {
        await this.#updateSourceIfCurrent(sourceId, epoch, {
          checkedAt: Date.now(),
          error: null,
        });
      } else {
        const parsed = parseM3U(result.text, { sourceId, limits: options.parseLimits || this.#options.parseLimits });
        if (!parsed.length) throw new Error("Playlist contains no channels");
        const channels = mergeChannelRecords(parsed);
        const snapshotId = await replaceSourceSnapshot(
          this.#db,
          { ...source, etag: result.etag, lastModified: result.lastModified, checkedAt: Date.now() },
          channels,
          { etag: result.etag, lastModified: result.lastModified, requireExisting: true },
        );
        if (!snapshotId) throw this.#sourceSupersededError(sourceId);
      }
      let stagedCatalog = await hydrateCatalog(this.#db);
      if (this.#options.autoEnrichMetadata !== false) {
        const safety = await this.#enrichSafety(stagedCatalog.channels, { ...options, strict: true, signal: controller.signal });
        if (safety.updated) stagedCatalog = await hydrateCatalog(this.#db);
      }
      await this.#assertSourceCurrent(sourceId, epoch);
      this.#applyCatalog(stagedCatalog, { emit: false });
      const recoveredHydration = this.#failedHydrationSources.delete(sourceId);
      this.#set({
        loading: false,
        ...(recoveredHydration ? {
          installationSync: {
            ...this.#state.installationSync,
            hydrationFailed: this.#failedHydrationSources.size,
          },
        } : {}),
      });
      if (!options.skipInstallationSync) {
        const currentSource = await get(this.#db, 'sources', sourceId);
        if (currentSource) await this.#pushInstallationState({ type: 'upsert-source', source: currentSource });
      }
      if (this.#options.autoEnrichMetadata !== false) this.#scheduleMetadataEnrichment(options);
      return (await get(this.#db, "sources", sourceId));
    } catch (error) {
      if (error?.code === 'SOURCE_SUPERSEDED' || error?.name === 'AbortError') {
        await this.#reload();
        this.#set({ loading: false });
        return null;
      }
      // replaceSourceSnapshot activates atomically; a failed safety gate must
      // restore the prior active snapshot before any restart can hydrate it.
      await this.#restoreSourceSnapshot(source, previousEndpoints, previousRelations, previousChannelRows, error);
      // Keep the last in-memory good/safety-checked catalog visible. A newly
      // replaced snapshot is not exposed until its safety pass succeeds.
      this.#set({ loading: false, error });
      throw error;
    } finally {
      if (this.#sourceEpochs.get(sourceId) === epoch) this.#sourceControllers.delete(sourceId);
    }
  }

  async removeSource(sourceId) {
    this.#requireDb();
    this.#sourceEpochs.set(sourceId, (this.#sourceEpochs.get(sourceId) || 0) + 1);
    this.#sourceControllers.get(sourceId)?.abort();
    this.#sourceControllers.delete(sourceId);
    this.#failedHydrationSources.delete(sourceId);
    this.#setInstallationSync({ hydrationFailed: this.#failedHydrationSources.size });
    const stores = ["sources", "snapshots", "endpoints", "channelSources"];
    if (this.#usesInstallationOutbox()) stores.push('settings');
    const tx = this.#db.transaction(stores, "readwrite");
    const done = transactionDone(tx);
    const intent = this.#usesInstallationOutbox()
      ? this.#newInstallationIntent({ type: 'remove-source', sourceId })
      : null;
    const outboxRequest = intent ? requestResult(tx.objectStore('settings').get(OUTBOX_SETTING)) : Promise.resolve(null);
    tx.objectStore("sources").delete(sourceId);
    const removeIndexed = (store, index) => new Promise((resolve, reject) => {
      const request = tx.objectStore(store).index(index).openCursor(sourceId);
      request.onsuccess = () => { const cursor = request.result; if (!cursor) return resolve(); cursor.delete(); cursor.continue(); };
      request.onerror = () => reject(request.error);
    });
    await Promise.all([removeIndexed("snapshots", "sourceId"), removeIndexed("endpoints", "sourceId"), removeIndexed("channelSources", "sourceId")]);
    if (intent) {
      const outboxRecord = await outboxRequest;
      const retained = this.#outboxValues(outboxRecord).filter((entry) => !(entry.type === 'upsert-source' && entry.source?.sourceId === sourceId));
      this.#writeOutbox(tx.objectStore('settings'), [...retained, intent]);
    }
    await done;
    await this.#reload();
    if (intent) await this.#syncPersistedIntent(intent.id);
  }

  async toggleFavorite(channelId) {
    this.#requireDb();
    const stores = this.#usesInstallationOutbox() ? ['favorites', 'settings'] : ['favorites'];
    const transaction = this.#db.transaction(stores, "readwrite");
    const done = transactionDone(transaction);
    const favoriteStore = transaction.objectStore('favorites');
    const existingRequest = requestResult(favoriteStore.get(channelId));
    const existing = await existingRequest;
    const outboxRecord = this.#usesInstallationOutbox()
      ? await requestResult(transaction.objectStore('settings').get(OUTBOX_SETTING))
      : null;
    const favorite = { id: channelId, channelId, createdAt: Date.now() };
    existing ? favoriteStore.delete(channelId) : favoriteStore.put(favorite);
    const intent = this.#usesInstallationOutbox()
      ? this.#newInstallationIntent({ type: 'set-favorite', channelId, enabled: !existing, favorite: existing ? null : favorite })
      : null;
    if (intent) this.#writeOutbox(transaction.objectStore('settings'), [...this.#outboxValues(outboxRecord), intent]);
    await done;
    await this.#reload();
    if (intent) await this.#syncPersistedIntent(intent.id);
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
    globalThis.clearTimeout(this.#installationRetryTimer);
    this.#installationRetryTimer = 0;
    this.#sourceControllers.forEach((controller) => controller.abort());
    this.#sourceControllers.clear();
    this.#search.destroy();
    this.#db?.close();
    this.#db = null;
    this.#listeners.clear();
  }

  async #reload() { this.#applyCatalog(await hydrateCatalog(this.#db)); }

  async #pushInstallationState(intent = { type: 'merge' }) {
    if (!this.#usesInstallationOutbox()) {
      this.#setInstallationSync({ status: 'local-only', error: null });
      return true;
    }
    const persisted = await this.#appendInstallationIntent(intent);
    return this.#syncPersistedIntent(persisted.id);
  }

  async #drainInstallationMutations() {
    if (this.#installationDrainPromise) return this.#installationDrainPromise;
    if (!this.#installationSync?.supported || !this.#installationSync.loaded) return false;
    this.#installationDrainPromise = (async () => {
      if (!await this.#acquireInstallationLease()) return false;
      try {
        while (this.#db) {
          const outbox = await this.#installationOutbox();
          const head = outbox[0];
          if (!head) break;
          if (!await this.#acquireInstallationLease()) return false;
          let saved;
          try {
            saved = await this.#installationSync.save(this.#applyInstallationIntent(this.#installationRemote, head));
          } catch (error) {
            if (error?.code !== 'REVISION_CONFLICT') throw error;
            const latest = await this.#installationSync.load();
            if (!latest) throw error;
            this.#installationRemote = latest;
            if (head.type === 'link-merge' && latest.migration?.legacyInstallation === 'complete') {
              await this.#deferLinkRecovery(head);
              await this.#applyInstallationProjection(latest);
              continue;
            }
            saved = await this.#installationSync.save(this.#applyInstallationIntent(latest, head));
          }
          if (!saved) {
            if (!this.#installationSync.supported) {
              this.#setInstallationSync({ status: 'local-only', error: null, pending: outbox.length });
              return false;
            }
            throw new Error('Shared installation storage is unavailable.');
          }
          this.#installationRemote = saved;
          await this.#ackInstallationIntent(head);
          await this.#applyInstallationProjection(saved);
        }
        const pending = (await this.#installationOutbox()).length;
        this.#setInstallationSync({
          status: pending ? 'pending' : 'synced',
          error: null,
          pending,
          recoveryAvailable: Boolean(await this.#recoveryRecord()),
        });
        return pending === 0;
      } catch (error) {
        const pending = (await this.#installationOutbox()).length;
        this.#setInstallationSync({ status: 'error', error, pending });
        this.#options.onSyncError?.(error);
        return false;
      } finally {
        await this.#releaseInstallationLease();
      }
    })().finally(() => { this.#installationDrainPromise = null; });
    return this.#installationDrainPromise;
  }

  #applyInstallationIntent(remote, intent = {}) {
    const canonical = installationPayload(remote || {});
    if (intent.type === 'merge' || intent.type === 'link-merge' || intent.type === 'recovery-merge') {
      return mergeInstallationPayloads(canonical, intent.payload || {});
    }

    const sources = new Map(canonical.sources.map((source) => [source.sourceId, source]));
    const favorites = new Map(canonical.favorites.map((favorite) => [favorite.channelId, favorite]));
    const settings = { ...canonical.settings };
    if (intent.type === 'upsert-source') {
      const source = intent.source;
      if (source) sources.set(source.sourceId, source);
    } else if (intent.type === 'remove-source') {
      sources.delete(intent.sourceId);
    } else if (intent.type === 'set-favorite') {
      if (intent.enabled) {
        const favorite = intent.favorite;
        if (favorite) favorites.set(favorite.channelId, favorite);
      } else favorites.delete(intent.channelId);
    } else if (intent.type === 'set-setting' && SYNC_SETTINGS.has(intent.key)) {
      settings[intent.key] = intent.value;
    }
    return installationPayload({
      sources: [...sources.values()],
      favorites: [...favorites.values()],
      settings,
      migration: canonical.migration,
    });
  }

  async #hydrateInstallationSources(sources) {
    const pending = sources.filter((source) => !this.#hydratingSources.has(source.sourceId));
    pending.forEach((source) => this.#hydratingSources.add(source.sourceId));
    if (pending.length) this.#setInstallationSync({ hydrating: this.#hydratingSources.size });
    for (const source of pending) {
      try {
        await this.refreshSource(source.sourceId, { confirmed: true, skipInstallationSync: true });
        this.#failedHydrationSources.delete(source.sourceId);
      }
      catch (error) {
        this.#failedHydrationSources.add(source.sourceId);
        this.#options.onHydrationError?.(error, source);
      } finally {
        this.#hydratingSources.delete(source.sourceId);
        this.#setInstallationSync({
          hydrating: this.#hydratingSources.size,
          hydrationFailed: this.#failedHydrationSources.size,
        });
      }
    }
  }

  async #sharedSettings() {
    const values = {};
    for (const key of SYNC_SETTINGS) {
      const record = await get(this.#db, 'settings', key);
      if (record) values[key] = record.value;
    }
    return values;
  }

  #usesInstallationOutbox() {
    return Boolean(this.#installationSync?.supported);
  }

  #newInstallationIntent(intent) {
    return { id: intent.id || intentId(), createdAt: intent.createdAt || Date.now(), ...intent };
  }

  #outboxValues(record) {
    return Array.isArray(record?.value) ? record.value.filter((intent) => intent?.id && intent?.type) : [];
  }

  #writeOutbox(store, values) {
    store.put({ key: OUTBOX_SETTING, value: values, updatedAt: Date.now() });
  }

  async #installationOutbox() {
    return this.#outboxValues(await get(this.#db, 'settings', OUTBOX_SETTING));
  }

  async #appendInstallationIntent(intent) {
    const entry = this.#newInstallationIntent(intent);
    const transaction = this.#db.transaction('settings', 'readwrite');
    const done = transactionDone(transaction);
    const store = transaction.objectStore('settings');
    const record = await requestResult(store.get(OUTBOX_SETTING));
    this.#writeOutbox(store, [...this.#outboxValues(record), entry]);
    await done;
    this.#setInstallationSync({ status: 'pending', error: null, pending: this.#state.installationSync.pending + 1 });
    return entry;
  }

  async #ackInstallationIntent(intent) {
    const transaction = this.#db.transaction('settings', 'readwrite');
    const done = transactionDone(transaction);
    const store = transaction.objectStore('settings');
    const record = await requestResult(store.get(OUTBOX_SETTING));
    const outbox = this.#outboxValues(record).filter((entry) => entry.id !== intent.id);
    this.#writeOutbox(store, outbox);
    if (intent.markLinked) store.put({ key: LINKED_SETTING, value: true, updatedAt: Date.now() });
    if (intent.clearRecovery) store.delete(RECOVERY_SETTING);
    await done;
    return outbox;
  }

  async #syncPersistedIntent(intentIdValue) {
    if (!this.#installationSync?.supported) return true;
    if (!this.#installationSync.loaded) {
      const error = new Error('Shared installation storage is unavailable; the change is queued safely in this browser.');
      error.code = 'INSTALLATION_SYNC_UNAVAILABLE';
      const pending = (await this.#installationOutbox()).length;
      this.#setInstallationSync({ status: 'error', error, pending });
      this.#options.onSyncError?.(error);
      return false;
    }
    await this.#drainInstallationMutations();
    return !(await this.#installationOutbox()).some((intent) => intent.id === intentIdValue);
  }

  #foldInstallationOutbox(remote, outbox) {
    return outbox.reduce((projection, intent) => this.#applyInstallationIntent(projection, intent), installationPayload(remote || {}));
  }

  async #applyInstallationProjection(remote, { reload = true } = {}) {
    const result = await applyInstallationProjection(this.#db, remote, {
      outboxKey: OUTBOX_SETTING,
      fold: (canonical, outbox) => this.#foldInstallationOutbox(canonical, outbox),
      settingKeys: [...SYNC_SETTINGS],
    });
    if (reload) {
      await this.#reload();
      const missingSources = this.#state.sources.filter((source) => !source.activeSnapshotId);
      if (missingSources.length) void this.#hydrateInstallationSources(missingSources);
    }
    return result;
  }

  async #acquireInstallationLease() {
    const transaction = this.#db.transaction('settings', 'readwrite');
    const done = transactionDone(transaction);
    const store = transaction.objectStore('settings');
    const current = await requestResult(store.get(LEASE_SETTING));
    const now = Date.now();
    const acquired = !current?.value?.owner
      || current.value.owner === this.#installationOwner
      || Number(current.value.expiresAt) <= now;
    if (acquired) store.put({
      key: LEASE_SETTING,
      value: { owner: this.#installationOwner, expiresAt: now + LEASE_MS },
      updatedAt: now,
    });
    await done;
    if (acquired) {
      globalThis.clearTimeout(this.#installationRetryTimer);
      this.#installationRetryTimer = 0;
      return true;
    }
    const pending = (await this.#installationOutbox()).length;
    this.#setInstallationSync({
      status: pending ? 'pending' : 'synced',
      error: null,
      pending,
    });
    // A live tab may currently be draining the same durable outbox. Keep the
    // UI truthful and retry automatically just after its lease expires; a dead
    // tab therefore cannot leave changes waiting until the next reload.
    const delay = Math.max(25, Number(current?.value?.expiresAt || now) - Date.now() + 25);
    globalThis.clearTimeout(this.#installationRetryTimer);
    this.#installationRetryTimer = globalThis.setTimeout(() => {
      this.#installationRetryTimer = 0;
      if (this.#db && this.#installationSync?.supported && this.#installationSync.loaded) {
        void this.#drainInstallationMutations();
      }
    }, delay);
    return false;
  }

  async #releaseInstallationLease() {
    if (!this.#db) return;
    const transaction = this.#db.transaction('settings', 'readwrite');
    const done = transactionDone(transaction);
    const store = transaction.objectStore('settings');
    const current = await requestResult(store.get(LEASE_SETTING));
    if (current?.value?.owner === this.#installationOwner) store.delete(LEASE_SETTING);
    await done;
  }

  #recoveryPayload(localPayload) {
    return mergeInstallationPayloads(this.#legacyInstallationPayload || {}, localPayload || {});
  }

  #addsInstallationData(remote, recovery) {
    const merged = mergeInstallationPayloads(remote, recovery);
    return JSON.stringify(installationPayload(merged)) !== JSON.stringify(installationPayload(remote));
  }

  async #storeRecovery(payload) {
    if (!this.#hasInstallationData(payload) || await this.#recoveryRecord()) return;
    await put(this.#db, 'settings', { key: RECOVERY_SETTING, value: payload, updatedAt: Date.now() });
  }

  async #recoveryRecord() {
    return get(this.#db, 'settings', RECOVERY_SETTING);
  }

  async #deferLinkRecovery(intent) {
    if (this.#hasInstallationData(intent.payload || {})) await this.#storeRecovery(intent.payload);
    await this.#ackInstallationIntent(intent);
  }

  async #assertSourceCurrent(sourceId, epoch) {
    if (this.#sourceEpochs.get(sourceId) !== epoch || !await get(this.#db, 'sources', sourceId)) {
      throw this.#sourceSupersededError(sourceId);
    }
  }

  async #updateSourceIfCurrent(sourceId, epoch, update) {
    const transaction = this.#db.transaction('sources', 'readwrite');
    const done = transactionDone(transaction);
    const store = transaction.objectStore('sources');
    const current = await requestResult(store.get(sourceId));
    if (!current || this.#sourceEpochs.get(sourceId) !== epoch) {
      await done;
      throw this.#sourceSupersededError(sourceId);
    }
    store.put({ ...current, ...update });
    await done;
  }

  #sourceSupersededError(sourceId) {
    const error = new Error(`Source refresh superseded: ${sourceId}`);
    error.code = 'SOURCE_SUPERSEDED';
    return error;
  }

  #hasInstallationData(payload, settings = payload?.settings) {
    return (payload?.sources || []).length > 0
      || (payload?.favorites || []).length > 0
      || Object.keys(settings || {}).length > 0;
  }

  #setInstallationSync(update) {
    this.#set({ installationSync: { ...this.#state.installationSync, ...update } });
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
    const currentSource = await requestResult(tx.objectStore('sources').get(source.sourceId));
    if (!currentSource) {
      await done;
      return;
    }
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
