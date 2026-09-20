import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { channelCategories, categoryOptions } from '../../src/data/channel-categories.js';
import { parseM3U } from '../../src/data/m3u.js';
import { CatalogService } from '../../src/data/catalog-service.js';
import { openCatalogDb, replaceSourceSnapshot } from '../../src/data/db.js';

test('group titles become usable categories without splitting a descriptive comma', () => {
  const [channel] = parseM3U('#EXTM3U\n#EXTINF:-1 group-title="News; Business|News, analysis",Review\nhttps://example.test/live.m3u8');
  assert.deepEqual(channel.categories, ['News', 'Business', 'News, analysis']);
  assert.equal(channel.groupTitle, 'News; Business|News, analysis');
});

test('legacy and enriched categories produce unique filters without mutating stored data', () => {
  const channels = [
    { categories: ['News;Business', 'Music'], categoryNames: ['news'] },
    { categories: ['business', ' Culture ; Documentary '] },
  ];
  const before = structuredClone(channels);
  assert.deepEqual(categoryOptions(channels), ['Business', 'Culture', 'Documentary', 'Music', 'News']);
  assert.deepEqual(channelCategories(), []);
  assert.deepEqual(channels, before);
});

test('catalog filtering finds a category inside a persisted combined group', async () => {
  const indexedDB = new IDBFactory();
  const db = await openCatalogDb(indexedDB);
  await replaceSourceSnapshot(db, { sourceId: 'review', url: 'https://example.test/review.m3u' }, [
    { channelId: 'legacy-review', name: 'Legacy review', countries: ['IT'], categories: ['Culture;News'], aliases: [], endpoints: [] },
    { channelId: 'music-review', name: 'Music review', countries: ['IT'], categories: ['Music'], aliases: [], endpoints: [] },
  ], { snapshotId: 'review-snapshot' });
  db.close();
  const catalog = new CatalogService({ indexedDB, installationSync: false, autoEnrichMetadata: false, localStorage: null, fetchImpl: async () => new Response('[]') });
  try {
    await catalog.init();
    assert.deepEqual(catalog.list({ category: 'news' }).map((channel) => channel.channelId), ['legacy-review']);
    assert.equal(catalog.list({ category: 'News', country: 'FR' }).length, 0);
    assert.equal(catalog.list({ category: 'Unknown' }).length, 0);
  } finally { catalog.destroy(); }
});
