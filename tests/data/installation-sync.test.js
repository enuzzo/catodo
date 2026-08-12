import test from 'node:test';
import assert from 'node:assert/strict';

import { InstallationSync, installationPayload } from '../../src/data/installation-sync.js';

test('installation payload keeps only shared settings and canonical source/favorite fields', () => {
  assert.deepEqual(installationPayload({
    sources: [{ sourceId: 'one', url: 'https://example.test/list.m3u', name: 'One', trusted: true, createdAt: 12, activeSnapshotId: 'local-only' }],
    favorites: [{ channelId: 'channel:1', createdAt: 12 }],
    settings: { proxy: 'https://proxy.test', 'epg:sources': ['https://guide.test/a.xml'], secret: 'nope' },
  }), {
    version: 1,
    sources: [{ sourceId: 'one', kind: 'url', name: 'One', url: 'https://example.test/list.m3u', trusted: true, createdAt: 12 }],
    favorites: [{ id: 'channel:1', channelId: 'channel:1', createdAt: 12 }],
    settings: { proxy: 'https://proxy.test', 'epg:sources': ['https://guide.test/a.xml'] },
  });
});

test('installation sync loads and saves with same-origin credentials and revision guards', async () => {
  const calls = [];
  const fetchImpl = async (_url, options = {}) => {
    calls.push(options);
    if (!options.method) return new Response(JSON.stringify({ version: 1, sources: [], favorites: [], settings: {}, revision: 'r1', updatedAt: 1 }));
    return new Response(JSON.stringify({ version: 1, sources: [], favorites: [], settings: {}, revision: 'r2', updatedAt: 2 }));
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
  assert.equal(await sync.save({}), null);
});

test('installation sync retries the local mutation once after a revision conflict', async () => {
  let writes = 0;
  const sync = new InstallationSync({ fetchImpl: async (_url, options = {}) => {
    if (!options.method) return new Response(JSON.stringify({ version: 1, sources: [], favorites: [], settings: {}, revision: 'fresh', updatedAt: 3 }));
    writes += 1;
    if (writes === 1) return new Response('', { status: 409 });
    return new Response(JSON.stringify({ ...JSON.parse(options.body), revision: 'saved', updatedAt: 4 }));
  } });
  await sync.load();
  const saved = await sync.save({ favorites: ['channel:2'] });
  assert.equal(writes, 2);
  assert.equal(saved.favorites[0].channelId, 'channel:2');
});
