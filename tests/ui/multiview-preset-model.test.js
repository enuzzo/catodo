import test from 'node:test';
import assert from 'node:assert/strict';

import {
  defaultMultiviewPresetState,
  deleteMultiviewPreset,
  findMultiviewPreset,
  renameMultiviewPreset,
} from '../../src/ui/multiview-preset-model.js';

const presets = [
  { id: 'morning', name: 'Morning', layout: 2, channelIds: ['a', 'b'] },
  { id: 'sports', name: 'Sports', layout: 4, channelIds: ['c', 'd', 'e', 'f'] },
];

test('finds, renames and trims a selected Multiview preset without changing its feeds', () => {
  assert.equal(findMultiviewPreset(presets, 'sports')?.name, 'Sports');
  const renamed = renameMultiviewPreset(presets, 'sports', `  ${'Live '.repeat(12)}  `);
  assert.equal(renamed[1].name.length, 40);
  assert.deepEqual(renamed[1].channelIds, presets[1].channelIds);
  assert.equal(presets[1].name, 'Sports');
});

test('deletes only the selected Multiview preset', () => {
  assert.deepEqual(deleteMultiviewPreset(presets, 'morning').map((preset) => preset.id), ['sports']);
  assert.deepEqual(deleteMultiviewPreset(presets, 'missing'), presets);
});

test('normal Multiview entry loads the first saved preset', () => {
  const entry = defaultMultiviewPresetState(presets);
  assert.equal(entry.preset.id, 'morning');
  assert.deepEqual(entry.channelIds, ['a', 'b']);
  assert.equal(entry.customized, false);
});

test('a channel added from fullscreen replaces the first preset slot without duplicates', () => {
  const replaced = defaultMultiviewPresetState(presets, 'live-news');
  assert.deepEqual(replaced.channelIds, ['live-news', 'b']);
  assert.equal(replaced.customized, true);

  const alreadyPresent = defaultMultiviewPresetState(presets, 'b');
  assert.deepEqual(alreadyPresent.channelIds, ['a', 'b']);
  assert.equal(alreadyPresent.customized, false);
});

test('Multiview keeps its existing fallback when there are no presets', () => {
  assert.equal(defaultMultiviewPresetState([], 'live-news'), null);
});
