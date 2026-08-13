import test from 'node:test';
import assert from 'node:assert/strict';

import {
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
