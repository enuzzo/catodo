import test from 'node:test';
import assert from 'node:assert/strict';
import { createConfigurationBackup } from '../../src/data/backup.js';

test('configuration backup includes every installation-wide setting', () => {
  const backup = createConfigurationBackup({
    sources: [{ name: 'World', url: 'https://example.test/world.m3u', trusted: true, localOnly: 'omit' }],
    favorites: new Set(['channel:news']),
    proxy: 'https://proxy.test',
    guideSources: ['https://guide.test/world.xml'],
    guideRefreshMinutes: 60,
    multiviewLayout: 3,
    multiviewPresets: [{ id: 'news', name: 'News', layout: 3, channelIds: ['one', 'two', 'three'] }],
    exportedAt: '2026-08-14T12:00:00.000Z',
  });

  assert.deepEqual(backup, {
    schema: 'catodo-backup',
    version: 1,
    exportedAt: '2026-08-14T12:00:00.000Z',
    sources: [{ name: 'World', url: 'https://example.test/world.m3u', trusted: true }],
    favorites: ['channel:news'],
    settings: {
      proxy: 'https://proxy.test',
      guideSources: ['https://guide.test/world.xml'],
      guideRefreshMinutes: 60,
      multiviewLayout: 3,
    },
    multiviewPresets: [{ id: 'news', name: 'News', layout: 3, channelIds: ['one', 'two', 'three'] }],
  });
});
