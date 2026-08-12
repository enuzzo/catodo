import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateZoomedViewBox } from '../../src/ui/world-map.js';

test('cursor-focused map zoom preserves the focused point position', () => {
  const base = [0, 0, 1000, 500];
  const current = [0, 0, 1000, 500];
  const result = calculateZoomedViewBox(base, current, 2, { x: 750, y: 125 });
  assert.equal(result.zoom, 2);
  assert.deepEqual(result.viewBox, [375, 62.5, 500, 250]);
  assert.equal((750 - result.viewBox[0]) / result.viewBox[2], 0.75);
  assert.equal((125 - result.viewBox[1]) / result.viewBox[3], 0.25);
});

test('map zoom clamps its viewBox to world bounds', () => {
  const result = calculateZoomedViewBox([0, 0, 1000, 500], [0, 0, 1000, 500], 2.45, { x: 0, y: 0 }, { x: 1, y: 1 });
  assert.deepEqual(result.viewBox.slice(0, 2), [0, 0]);
  assert.equal(result.zoom, 2.45);
});

test('map zoom returns to the exact base viewBox', () => {
  const result = calculateZoomedViewBox([10, 20, 1000, 500], [400, 180, 500, 250], 1, { x: 800, y: 250 });
  assert.deepEqual(result.viewBox, [10, 20, 1000, 500]);
});
