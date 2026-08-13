import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';

import { CatalogService } from '../../src/data/catalog-service.js';
import { COUNTRIES_API_URL } from '../../src/data/countries.js';
import { openCatalogDb, put, replaceSourceSnapshot } from '../../src/data/db.js';
import { installationPayload } from '../../src/data/installation-sync.js';

const clone = (value) => structuredClone(value);

function state(value = {}) {
  return {
    ...installationPayload({
      ...value,
      migration: value.migration || { legacyInstallation: 'pending', completedAt: 0 },
    }),
    updatedAt: value.updatedAt ?? 1,
  };
}

class FakeInstallationSync {
  constructor(initial, options = {}) {
    this.state = state(initial);
    this.supported = true;
    this.loaded = false;
    this.saves = [];
    this.loadError = options.loadError || null;
    this.saveImpl = options.saveImpl || null;
  }

  async load() {
    if (this.loadError) throw this.loadError;
    this.loaded = true;
    return clone(this.state);
  }

  async save(payload) {
    this.saves.push(clone(installationPayload(payload)));
    if (this.saveImpl) return this.saveImpl(payload, this);
    this.state = state({
      ...payload,
      migration: { legacyInstallation: 'complete', completedAt: Date.now() },
      updatedAt: Date.now(),
    });
    return clone(this.state);
  }
}

function directoryFetch(playlistUrl = '', playlist = '') {
  return async (url) => {
    if (url === COUNTRIES_API_URL) return new Response('[]', { status: 200 });
    if (url === playlistUrl) return new Response(playlist, { status: 200 });
    return new Response('', { status: 404 });
  };
}

async function waitFor(predicate, timeoutMs = 1_000) {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error('Timed out waiting for installation hydration');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function storageFrom(entries) {
  const keys = Object.keys(entries);
  return { length: keys.length, key: (index) => keys[index], getItem: (key) => entries[key] ?? null };
}

test('first link merges an existing browser library into a valid empty installation', async () => {
  const indexedDB = new IDBFactory();
  const db = await openCatalogDb(indexedDB);
  const source = {
    sourceId: 'browser-source',
    kind: 'url',
    name: 'Browser source',
    url: 'https://browser.test/list.m3u',
    createdAt: 1,
  };
  await replaceSourceSnapshot(db, source, [{
    channelId: 'browser-favorite',
    name: 'Browser favorite',
    countries: [],
    languages: [],
    categories: [],
    aliases: [],
    endpoints: [{ endpointId: 'browser-endpoint', url: 'https://video.test/browser.m3u8', kind: 'hls' }],
  }], { snapshotId: 'browser-snapshot' });
  await put(db, 'favorites', { id: 'browser-favorite', channelId: 'browser-favorite', createdAt: 1 });
  db.close();

  const remote = new FakeInstallationSync({ updatedAt: 2 });
  const service = new CatalogService({
    indexedDB,
    installationSync: remote,
    autoEnrichMetadata: false,
    fetchImpl: directoryFetch(),
    localStorage: null,
  });
  const catalog = await service.init();

  assert.deepEqual(catalog.sources.map((source) => source.sourceId), ['browser-source']);
  assert.equal(catalog.favorites.has('browser-favorite'), true);
  assert.equal(remote.saves.length, 1);
  assert.deepEqual(remote.saves[0].sources.map((source) => source.sourceId), ['browser-source']);
  assert.deepEqual(remote.saves[0].favorites.map((favorite) => favorite.channelId), ['browser-favorite']);
  assert.equal(await service.getSetting('installation:linked'), true);
  service.destroy();
});

test('a fresh browser receives shared descriptors and hydrates their channels', async () => {
  const indexedDB = new IDBFactory();
  const playlistUrl = 'https://shared.test/list.m3u';
  const remote = new FakeInstallationSync({
    updatedAt: 3,
    sources: [{ sourceId: 'shared-source', name: 'Shared', url: playlistUrl, createdAt: 1 }],
    favorites: ['tvg:sharedchannel.test'],
  });
  const service = new CatalogService({
    indexedDB,
    installationSync: remote,
    autoEnrichMetadata: false,
    fetchImpl: directoryFetch(playlistUrl, '#EXTM3U\n#EXTINF:-1 tvg-id="SharedChannel.test",Shared channel\nhttps://video.test/live.m3u8'),
    localStorage: null,
  });
  const initial = await service.init();
  assert.equal(initial.sources.length, 1);
  assert.equal(initial.favorites.has('tvg:sharedchannel.test'), true);

  await waitFor(() => service.getState().channels.length === 1);
  assert.equal(service.list({ favorite: true }).length, 1);
  assert.equal(service.getState().installationSync.status, 'synced');
  service.destroy();
});

test('queued browser mutations cannot be erased by an older in-flight save response', async () => {
  const indexedDB = new IDBFactory();
  const db = await openCatalogDb(indexedDB);
  await put(db, 'settings', { key: 'installation:linked', value: true, updatedAt: 1 });
  db.close();

  let releaseFirst;
  let firstStarted;
  const firstStartedPromise = new Promise((resolve) => { firstStarted = resolve; });
  const firstPending = new Promise((resolve) => { releaseFirst = resolve; });
  const remote = new FakeInstallationSync({ updatedAt: 4 }, {
    saveImpl: async (payload, sync) => {
      if (sync.saves.length === 1) {
        firstStarted();
        await firstPending;
      }
      sync.state = state({ ...payload, updatedAt: Date.now() });
      return clone(sync.state);
    },
  });
  const service = new CatalogService({
    indexedDB,
    installationSync: remote,
    autoEnrichMetadata: false,
    fetchImpl: directoryFetch(),
    localStorage: null,
  });
  await service.init();

  const first = service.toggleFavorite('favorite:first');
  await firstStartedPromise;
  const second = service.toggleFavorite('favorite:second');
  releaseFirst();
  await Promise.all([first, second]);

  assert.equal(remote.saves.length, 2);
  assert.deepEqual(remote.saves[1].favorites.map((favorite) => favorite.channelId).sort(), [
    'favorite:first',
    'favorite:second',
  ]);
  assert.deepEqual([...service.getState().favorites].sort(), ['favorite:first', 'favorite:second']);
  service.destroy();
});

test('a revision conflict rebases the requested mutation onto the latest server state', async () => {
  const indexedDB = new IDBFactory();
  const db = await openCatalogDb(indexedDB);
  await put(db, 'settings', { key: 'installation:linked', value: true, updatedAt: 1 });
  db.close();

  let loadCount = 0;
  let saveCount = 0;
  const conflict = Object.assign(new Error('conflict'), { code: 'REVISION_CONFLICT' });
  const remote = new FakeInstallationSync({ updatedAt: 5 });
  remote.load = async () => {
    loadCount += 1;
    remote.loaded = true;
    if (loadCount > 1) remote.state = state({ updatedAt: 6, favorites: ['favorite:other-browser'] });
    return clone(remote.state);
  };
  remote.saveImpl = async (payload, sync) => {
    saveCount += 1;
    if (saveCount === 1) throw conflict;
    sync.state = state({ ...payload, updatedAt: 7 });
    return clone(sync.state);
  };
  const service = new CatalogService({
    indexedDB,
    installationSync: remote,
    autoEnrichMetadata: false,
    fetchImpl: directoryFetch(),
    localStorage: null,
  });
  await service.init();
  await service.toggleFavorite('favorite:this-browser');

  assert.equal(loadCount, 2);
  assert.equal(saveCount, 2);
  assert.deepEqual(remote.saves[1].favorites.map((favorite) => favorite.channelId).sort(), [
    'favorite:other-browser',
    'favorite:this-browser',
  ]);
  assert.deepEqual([...service.getState().favorites].sort(), [
    'favorite:other-browser',
    'favorite:this-browser',
  ]);
  service.destroy();
});

test('a failed installation load preserves local data and exposes a sync error', async () => {
  const indexedDB = new IDBFactory();
  const db = await openCatalogDb(indexedDB);
  await put(db, 'favorites', { id: 'local:fav', channelId: 'local:fav', createdAt: 1 });
  db.close();
  const failure = Object.assign(new Error('server offline'), { code: 'LOAD_FAILED' });
  const remote = new FakeInstallationSync({}, { loadError: failure });
  const errors = [];
  const service = new CatalogService({
    indexedDB,
    installationSync: remote,
    autoEnrichMetadata: false,
    fetchImpl: directoryFetch(),
    localStorage: null,
    onSyncError: (error) => errors.push(error),
  });
  const catalog = await service.init();

  assert.equal(catalog.favorites.has('local:fav'), true);
  assert.equal(catalog.installationSync.status, 'error');
  assert.equal(errors[0], failure);
  assert.equal(remote.saves.length, 0);
  service.destroy();
});

test('a static host keeps browser-only mutations successful without reporting a sync failure', async () => {
  const indexedDB = new IDBFactory();
  const localOnly = {
    supported: false,
    loaded: false,
    async load() { return null; },
    async save() { throw new Error('save must not run on a static host'); },
  };
  const errors = [];
  const service = new CatalogService({
    indexedDB,
    installationSync: localOnly,
    autoEnrichMetadata: false,
    fetchImpl: directoryFetch(),
    localStorage: null,
    onSyncError: (error) => errors.push(error),
  });
  await service.init();
  await service.toggleFavorite('local-only:fav');

  assert.equal(service.getState().favorites.has('local-only:fav'), true);
  assert.equal(service.getState().installationSync.status, 'local-only');
  assert.equal(errors.length, 0);
  service.destroy();
});

test('a failed save remains in the persistent outbox and survives a browser restart', async () => {
  const indexedDB = new IDBFactory();
  let fail = true;
  const networkError = Object.assign(new Error('offline'), { code: 'NETWORK_ERROR' });
  const remote = new FakeInstallationSync({
    updatedAt: 10,
    migration: { legacyInstallation: 'complete', completedAt: 9 },
  }, {
    saveImpl: async (payload, sync) => {
      if (fail) throw networkError;
      sync.state = state({
        ...payload,
        migration: { legacyInstallation: 'complete', completedAt: 9 },
        updatedAt: 11,
      });
      return clone(sync.state);
    },
  });
  const first = new CatalogService({
    indexedDB,
    installationSync: remote,
    autoEnrichMetadata: false,
    fetchImpl: directoryFetch(),
    localStorage: null,
  });
  await first.init();
  await first.toggleFavorite('favorite:offline');
  assert.equal(first.getState().favorites.has('favorite:offline'), true);
  assert.equal(first.getState().installationSync.status, 'error');
  assert.equal(first.getState().installationSync.pending, 1);
  first.destroy();

  fail = false;
  const restarted = new CatalogService({
    indexedDB,
    installationSync: remote,
    autoEnrichMetadata: false,
    fetchImpl: directoryFetch(),
    localStorage: null,
  });
  await restarted.init();
  assert.equal(restarted.getState().favorites.has('favorite:offline'), true);
  assert.equal(restarted.getState().installationSync.status, 'synced');
  assert.equal(restarted.getState().installationSync.pending, 0);
  assert.deepEqual(remote.state.favorites.map((favorite) => favorite.channelId), ['favorite:offline']);
  restarted.destroy();
});

test('a failed queue head blocks later intents until Retry replays both in order', async () => {
  const indexedDB = new IDBFactory();
  const started = deferred();
  const release = deferred();
  const remote = new FakeInstallationSync({
    updatedAt: 20,
    migration: { legacyInstallation: 'complete', completedAt: 19 },
  }, {
    saveImpl: async () => {
      started.resolve();
      await release.promise;
      throw Object.assign(new Error('offline'), { code: 'NETWORK_ERROR' });
    },
  });
  const service = new CatalogService({
    indexedDB,
    installationSync: remote,
    autoEnrichMetadata: false,
    fetchImpl: directoryFetch(),
    localStorage: null,
  });
  await service.init();

  const first = service.toggleFavorite('favorite:first');
  await started.promise;
  const second = service.toggleFavorite('favorite:second');
  release.resolve();
  await Promise.all([first, second]);
  assert.equal(service.getState().installationSync.status, 'error');
  assert.equal(service.getState().installationSync.pending, 2);
  assert.equal(remote.state.favorites.length, 0);

  remote.saveImpl = null;
  assert.equal(await service.retryInstallationSync(), true);
  assert.deepEqual(remote.state.favorites.map((favorite) => favorite.channelId).sort(), [
    'favorite:first',
    'favorite:second',
  ]);
  assert.equal(service.getState().installationSync.pending, 0);
  service.destroy();
});

test('correcting a shared setting supersedes a poisoned queued value', async () => {
  const indexedDB = new IDBFactory();
  const invalidSources = Array.from({ length: 33 }, (_, index) => `https://guide.test/${index}.xml`);
  const db = await openCatalogDb(indexedDB);
  await put(db, 'settings', { key: 'epg:sources', value: invalidSources, updatedAt: 1 });
  await put(db, 'settings', {
    key: 'installation:outbox',
    value: [{
      id: 'poisoned-guide-setting',
      type: 'set-setting',
      key: 'epg:sources',
      value: invalidSources,
      createdAt: 1,
    }],
    updatedAt: 1,
  });
  db.close();

  const tooLarge = Object.assign(new Error('too many guide sources'), { code: 'PAYLOAD_TOO_LARGE' });
  const remote = new FakeInstallationSync({
    updatedAt: 25,
    migration: { legacyInstallation: 'complete', completedAt: 24 },
  }, {
    saveImpl: async (payload, sync) => {
      if ((payload.settings['epg:sources'] || []).length > 32) throw tooLarge;
      sync.state = state({ ...payload, updatedAt: 26 });
      return clone(sync.state);
    },
  });
  const service = new CatalogService({
    indexedDB,
    installationSync: remote,
    autoEnrichMetadata: false,
    fetchImpl: directoryFetch(),
    localStorage: null,
  });
  await service.init();
  assert.equal(service.getState().installationSync.status, 'error');
  assert.equal(service.getState().installationSync.pending, 1);

  const corrected = ['https://guide.test/corrected.xml'];
  await service.setSetting('epg:sources', corrected);
  assert.equal(service.getState().installationSync.status, 'synced');
  assert.equal(service.getState().installationSync.pending, 0);
  assert.deepEqual(remote.state.settings['epg:sources'], corrected);
  service.destroy();
});

test('a foreign outbox lease reports pending and drains after the lease expires', async () => {
  const indexedDB = new IDBFactory();
  const db = await openCatalogDb(indexedDB);
  await put(db, 'settings', {
    key: 'installation:outbox-lease',
    value: { owner: 'other-tab', expiresAt: Date.now() + 60_000 },
    updatedAt: Date.now(),
  });
  db.close();
  const remote = new FakeInstallationSync({
    updatedAt: 27,
    migration: { legacyInstallation: 'complete', completedAt: 26 },
  });
  const service = new CatalogService({
    indexedDB,
    installationSync: remote,
    autoEnrichMetadata: false,
    fetchImpl: directoryFetch(),
    localStorage: null,
  });
  await service.init();
  await service.toggleFavorite('favorite:leased');
  assert.equal(service.getState().favorites.has('favorite:leased'), true);
  assert.equal(service.getState().installationSync.status, 'pending');
  assert.equal(service.getState().installationSync.pending, 1);
  assert.equal(remote.saves.length, 0);

  const expiredDb = await openCatalogDb(indexedDB);
  await put(expiredDb, 'settings', {
    key: 'installation:outbox-lease',
    value: { owner: 'other-tab', expiresAt: Date.now() - 1 },
    updatedAt: Date.now(),
  });
  expiredDb.close();
  assert.equal(await service.retryInstallationSync(), true);
  assert.equal(service.getState().installationSync.status, 'synced');
  assert.equal(service.getState().installationSync.pending, 0);
  assert.deepEqual(remote.state.favorites.map((favorite) => favorite.channelId), ['favorite:leased']);
  service.destroy();
});

test('removing a source while fresh-browser hydration is in flight cannot resurrect it', async () => {
  const indexedDB = new IDBFactory();
  const playlistUrl = 'https://shared.test/deferred.m3u';
  const fetchStarted = deferred();
  const remote = new FakeInstallationSync({
    updatedAt: 30,
    migration: { legacyInstallation: 'complete', completedAt: 29 },
    sources: [{ sourceId: 'shared-source', name: 'Shared', url: playlistUrl, createdAt: 1 }],
  });
  const fetchImpl = async (url, options = {}) => {
    if (url === COUNTRIES_API_URL) return new Response('[]', { status: 200 });
    if (url !== playlistUrl) return new Response('', { status: 404 });
    fetchStarted.resolve();
    return new Promise((resolve, reject) => {
      const abort = () => reject(new DOMException('Aborted', 'AbortError'));
      options.signal?.addEventListener('abort', abort, { once: true });
      if (options.signal?.aborted) abort();
    });
  };
  const service = new CatalogService({
    indexedDB,
    installationSync: remote,
    autoEnrichMetadata: false,
    fetchImpl,
    localStorage: null,
  });
  await service.init();
  await fetchStarted.promise;
  await service.removeSource('shared-source');
  await waitFor(() => service.getState().installationSync.hydrating === 0);

  assert.equal(service.getState().sources.length, 0);
  assert.equal(service.getState().channels.length, 0);
  assert.equal(remote.state.sources.length, 0);
  service.destroy();
});

test('a failed fresh-browser hydration remains distinct from sync and clears after Retry succeeds', async () => {
  const indexedDB = new IDBFactory();
  const playlistUrl = 'https://shared.test/retry.m3u';
  let playlistAvailable = false;
  const remote = new FakeInstallationSync({
    updatedAt: 35,
    migration: { legacyInstallation: 'complete', completedAt: 34 },
    sources: [{ sourceId: 'retry-source', name: 'Retry', url: playlistUrl, createdAt: 1 }],
  });
  const fetchImpl = async (url) => {
    if (url === COUNTRIES_API_URL) return new Response('[]', { status: 200 });
    if (url === playlistUrl && playlistAvailable) {
      return new Response('#EXTM3U\n#EXTINF:-1 tvg-id="Retry.test",Retry\nhttps://video.test/retry.m3u8', { status: 200 });
    }
    if (url === playlistUrl) throw new Error('playlist temporarily offline');
    return new Response('', { status: 404 });
  };
  const service = new CatalogService({
    indexedDB,
    installationSync: remote,
    autoEnrichMetadata: false,
    fetchImpl,
    localStorage: null,
  });
  await service.init();
  await waitFor(() => service.getState().installationSync.hydrating === 0);
  assert.equal(service.getState().installationSync.status, 'synced');
  assert.equal(service.getState().installationSync.hydrationFailed, 1);
  assert.equal(service.getState().channels.length, 0);

  playlistAvailable = true;
  assert.equal(await service.retryInstallationSync(), true);
  await waitFor(() => service.getState().channels.length === 1);
  assert.equal(service.getState().installationSync.hydrationFailed, 0);
  service.destroy();
});

test('a completed server migration never silently resurrects retained legacy data', async () => {
  const indexedDB = new IDBFactory();
  const playlistUrl = 'https://legacy.test/list.m3u';
  const storage = storageFrom({
    'catodo:sources': JSON.stringify([{ id: 'legacy-source', url: playlistUrl, name: 'Legacy' }]),
    'catodo:ch:legacy-source': JSON.stringify({ ch: [{ tvgId: 'Legacy.test', name: 'Legacy', url: 'https://legacy.test/live.m3u8' }] }),
    'catodo:favs': JSON.stringify(['https://legacy.test/live.m3u8']),
    'catodo:proxy': JSON.stringify('https://legacy-proxy.test/?url='),
  });
  const remote = new FakeInstallationSync({
    updatedAt: 40,
    migration: { legacyInstallation: 'complete', completedAt: 39 },
  });
  const service = new CatalogService({
    indexedDB,
    installationSync: remote,
    autoEnrichMetadata: false,
    fetchImpl: directoryFetch(playlistUrl, '#EXTM3U\n#EXTINF:-1 tvg-id="Legacy.test",Legacy\nhttps://legacy.test/live.m3u8'),
    localStorage: storage,
  });
  await service.init();

  assert.equal(remote.saves.length, 0);
  assert.equal(service.getState().favorites.has('tvg:legacy.test'), false);
  assert.equal(await service.getSetting('proxy'), null);
  assert.equal(service.getState().installationSync.recoveryAvailable, true);

  assert.equal(await service.recoverInstallationData(), true);
  assert.equal(service.getState().favorites.has('tvg:legacy.test'), true);
  assert.deepEqual(remote.state.favorites.map((favorite) => favorite.channelId), ['tvg:legacy.test']);
  assert.equal(remote.state.settings.proxy, 'https://legacy-proxy.test/?url=');
  assert.equal(await service.getSetting('proxy'), 'https://legacy-proxy.test/?url=');
  assert.equal(service.getState().installationSync.recoveryAvailable, false);
  service.destroy();
});

test('a lost first-link response cannot replay stale recovery after the server migration completed', async () => {
  const indexedDB = new IDBFactory();
  const db = await openCatalogDb(indexedDB);
  await put(db, 'favorites', { id: 'favorite:legacy', channelId: 'favorite:legacy', createdAt: 1 });
  db.close();
  let loseResponse = true;
  const remote = new FakeInstallationSync({ updatedAt: 60 }, {
    saveImpl: async (payload, sync) => {
      sync.state = state({
        ...payload,
        migration: { legacyInstallation: 'complete', completedAt: 61 },
        updatedAt: 61,
      });
      if (loseResponse) throw Object.assign(new Error('response lost'), { code: 'NETWORK_ERROR' });
      return clone(sync.state);
    },
  });
  const first = new CatalogService({
    indexedDB,
    installationSync: remote,
    autoEnrichMetadata: false,
    fetchImpl: directoryFetch(),
    localStorage: null,
  });
  await first.init();
  assert.equal(first.getState().installationSync.status, 'error');
  first.destroy();

  // Another browser intentionally removes the recovered favorite after the
  // first conditional write committed but before this browser saw its reply.
  remote.state = state({
    updatedAt: 62,
    migration: { legacyInstallation: 'complete', completedAt: 61 },
  });
  loseResponse = false;
  const restarted = new CatalogService({
    indexedDB,
    installationSync: remote,
    autoEnrichMetadata: false,
    fetchImpl: directoryFetch(),
    localStorage: null,
  });
  await restarted.init();

  assert.equal(remote.saves.length, 1);
  assert.equal(restarted.getState().favorites.has('favorite:legacy'), false);
  assert.equal(restarted.getState().installationSync.recoveryAvailable, true);
  restarted.destroy();
});

test('two simultaneous favorite toggles serialize as inverse operations', async () => {
  const indexedDB = new IDBFactory();
  const remote = new FakeInstallationSync({
    updatedAt: 50,
    migration: { legacyInstallation: 'complete', completedAt: 49 },
  });
  const service = new CatalogService({
    indexedDB,
    installationSync: remote,
    autoEnrichMetadata: false,
    fetchImpl: directoryFetch(),
    localStorage: null,
  });
  await service.init();
  assert.deepEqual(await Promise.all([
    service.toggleFavorite('favorite:double'),
    service.toggleFavorite('favorite:double'),
  ]), [true, false]);
  assert.equal(service.getState().favorites.has('favorite:double'), false);
  assert.equal(remote.state.favorites.length, 0);
  service.destroy();
});
