import test from 'node:test';
import assert from 'node:assert/strict';
import { channelMetadataBadges } from '../../src/ui/channel-meta-model.js';

test('channel metadata exposes country, language, quality and the first named genre', () => {
  assert.deepEqual(channelMetadataBadges({
    countryNames: ['Italy'],
    languageNames: ['Italian'],
    categoryNames: ['News', 'General'],
    endpoints: [{ quality: '1080p' }],
  }), [
    { type: 'country', icon: 'map-pin', value: 'Italy' },
    { type: 'language', icon: 'translate', value: 'Italian' },
    { type: 'quality', icon: 'monitor-play', value: '1080p' },
    { type: 'genre', icon: 'tag', value: 'News' },
  ]);
});

test('channel metadata falls back to category descriptions and omits absent badges', () => {
  assert.deepEqual(channelMetadataBadges({
    country: 'DE',
    categoryDescriptions: [{ id: 'documentary', name: 'Documentary' }],
  }), [
    { type: 'country', icon: 'map-pin', value: 'DE' },
    { type: 'genre', icon: 'tag', value: 'Documentary' },
  ]);
});

test('channel metadata never renders boolean, empty or placeholder category values', () => {
  assert.deepEqual(channelMetadataBadges({ category: true, categories: [] }), []);
  assert.deepEqual(channelMetadataBadges({ categories: ['Undefined', 'News'] }), [
    { type: 'genre', icon: 'tag', value: 'News' },
  ]);
});
