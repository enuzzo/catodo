import test from 'node:test';
import assert from 'node:assert/strict';

import {
  InstallationSync,
  installationPayload,
  mergeInstallationPayloads,
} from '../../src/data/installation-sync.js';

function serverState({ revision = 'r1', updatedAt = 0, ...overrides } = {}) {
  return {
    version: 2,
    sources: [],
    favorites: [],
    settings: {},
    migration: { legacyInstallation: 'complete', completedAt: Math.max(1, updatedAt) },
    revision,
    updatedAt,
    ...overrides,
  };
}

test('installation payload keeps only shared settings and canonical source/favorite fields', () => {
  assert.deepEqual(installationPayload({
    sources: [{ sourceId: 'one', url: 'https://example.test/list.m3u', name: 'One', trusted: true, createdAt: 12, activeSnapshotId: 'local-only' }],
    favorites: [{ channelId: 'channel:1', createdAt: 12 }],
    settings: { proxy: 'https://proxy.test', 'epg:sources': ['https://guide.test/a.xml'], secret: 'nope' },
  }), {
    version: 2,
    sources: [{ sourceId: 'one', kind: 'url', name: 'One', url: 'https://example.test/list.m3u', trusted: true, createdAt: 12 }],
    favorites: [{ id: 'channel:1', channelId: 'channel:1', createdAt: 12 }],
    settings: { proxy: 'https://proxy.test', 'epg:sources': ['https://guide.test/a.xml'] },
  });
});

test('installation sync loads and saves with same-origin credentials and revision guards', async () => {
  const calls = [];
  const fetchImpl = async (_url, options = {}) => {
    calls.push(options);
    if (!options.method) return new Response(JSON.stringify(serverState({ revision: 'r1', updatedAt: 1 })));
    return new Response(JSON.stringify(serverState({ revision: 'r2', updatedAt: 2 })));
  };
  const sync = new InstallationSync({ endpoint: '/installation-api.php', fetchImpl });
  const loaded = await sync.load();
  assert.equal(loaded.updatedAt, 1);
  await sync.save({ favorites: ['channel:1'] });
  assert.equal(calls[0].credentials, 'same-origin');
  assert.equal(calls[1].method, 'PUT');
  assert.equal(calls[1].headers['If-Match'], 'r1');
  assert.equal(JSON.parse(calls[1].body).favorites[0].channelId, 'channel:1');
});

test('installation sync gracefully disables itself on static hosts', async () => {
  const sync = new InstallationSync({ fetchImpl: async () => new Response('', { status: 404 }) });
  assert.equal(await sync.load(), null);
  assert.equal(sync.supported, false);
  assert.equal(sync.loaded, false);
  assert.equal(await sync.save({}), null);
});

test('installation sync surfaces load failures instead of treating them as an empty installation', async () => {
  const sync = new InstallationSync({ fetchImpl: async () => new Response('', { status: 500 }) });
  await assert.rejects(sync.load(), (error) => error.code === 'LOAD_FAILED' && error.status === 500);
  assert.equal(sync.supported, true);
  assert.equal(sync.loaded, false);
  await assert.rejects(sync.save({ favorites: ['must-not-write'] }), (error) => error.code === 'NOT_LOADED');
});

test('installation sync requires a revision before every save', async () => {
  const calls = [];
  const sync = new InstallationSync({ fetchImpl: async (_url, options = {}) => {
    calls.push(options);
    return new Response(JSON.stringify(serverState({ revision: '', updatedAt: 0, migration: { legacyInstallation: 'pending', completedAt: 0 } })));
  } });
  await assert.rejects(sync.load(), (error) => error.code === 'INVALID_RESPONSE');
  await assert.rejects(sync.save({}), (error) => error.code === 'NOT_LOADED');
  assert.equal(calls.length, 1);
});

test('installation sync reports revision conflicts without replaying a stale snapshot', async () => {
  let writes = 0;
  const sync = new InstallationSync({ fetchImpl: async (_url, options = {}) => {
    if (!options.method) return new Response(JSON.stringify(serverState({ revision: 'fresh', updatedAt: 3 })));
    writes += 1;
    return new Response('', { status: 409 });
  } });
  await sync.load();
  await assert.rejects(sync.save({ favorites: ['channel:2'] }), (error) => error.code === 'REVISION_CONFLICT');
  assert.equal(writes, 1);
});

test('installation sync rejects a syntactically valid but incomplete server state', async () => {
  const sync = new InstallationSync({ fetchImpl: async () => new Response(JSON.stringify({
    version: 2,
    updatedAt: 1,
    revision: 'malformed',
  })) });
  await assert.rejects(sync.load(), (error) => error.code === 'INVALID_RESPONSE');
  assert.equal(sync.loaded, false);
});

test('installation merge preserves both browser and server sources and favorites', () => {
  const merged = mergeInstallationPayloads({
    sources: [{ sourceId: 'server', url: 'https://server.test/list.m3u' }],
    favorites: ['server:fav'],
    settings: { proxy: 'https://server-proxy.test/?url=' },
  }, {
    sources: [{ sourceId: 'browser', url: 'https://browser.test/list.m3u' }],
    favorites: ['browser:fav'],
    settings: { proxy: 'https://browser-proxy.test/?url=', 'epg:refreshMinutes': 30 },
  });
  assert.deepEqual(merged.sources.map((source) => source.sourceId).sort(), ['browser', 'server']);
  assert.deepEqual(merged.favorites.map((favorite) => favorite.channelId).sort(), ['browser:fav', 'server:fav']);
  assert.equal(merged.settings.proxy, 'https://server-proxy.test/?url=');
  assert.equal(merged.settings['epg:refreshMinutes'], 30);
});
