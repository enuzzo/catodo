import test from 'node:test';
import assert from 'node:assert/strict';

import { filterChannelPicker } from '../../src/ui/channel-picker-filter.js';

const channels = [
  { channelId: 'one', name: 'World News', countryNames: ['France'], languages: ['fra'], categories: ['news'] },
  { channelId: 'two', name: 'Cinema Uno', countryNames: ['Italy'], languages: ['ita'], categories: ['movies'] },
  { channelId: 'three', name: 'Italia Live', countryNames: ['Italy'], languages: ['ita'], categories: ['general'] },
];

test('picker searches names, countries, languages, and categories', () => {
  assert.deepEqual(filterChannelPicker(channels, { query: 'italy' }).map((item) => item.channelId), ['two', 'three']);
  assert.deepEqual(filterChannelPicker(channels, { query: 'movies' }).map((item) => item.channelId), ['two']);
  assert.deepEqual(filterChannelPicker(channels, { query: 'fra' }).map((item) => item.channelId), ['one']);
});

test('picker excludes channels already assigned to Multiview', () => {
  assert.deepEqual(
    filterChannelPicker(channels, { excludedIds: new Set(['one', 'three']) }).map((item) => item.channelId),
    ['two'],
  );
});
