import test from 'node:test';
import assert from 'node:assert/strict';
import { connectedWorldSource } from '../../src/ui/source-settings-model.js';

test('world settings recognize a renamed connected playlist by URL', () => {
  const source = { name: 'My renamed world', url: 'https://iptv-org.github.io/iptv/index.m3u', count: 11008 };
  assert.equal(connectedWorldSource([source]), source);
});

test('country and lookalike sources do not suppress the world import offer', () => {
  assert.equal(connectedWorldSource([
    { url: 'https://iptv-org.github.io/iptv/countries/it.m3u' },
    { url: 'https://example.test/iptv/index.m3u' },
    { url: 'broken' },
  ]), null);
  assert.equal(connectedWorldSource(), null);
});
