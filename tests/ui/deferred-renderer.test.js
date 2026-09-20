import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeferredRenderer } from '../../src/ui/deferred-renderer.js';

test('lazy views do not load at startup and share one import across containers', async () => {
  let loads = 0;
  const calls = [];
  const renderer = createDeferredRenderer(async () => {
    loads += 1;
    return { draw: (target, value) => calls.push(value) };
  });
  assert.equal(loads, 0);
  await Promise.all([renderer.render({}, 'draw', ['atlas']), renderer.render({}, 'draw', ['country'])]);
  assert.equal(loads, 1);
  assert.deepEqual(calls, ['atlas', 'country']);
  await renderer.render({}, 'draw', ['again']);
  assert.equal(loads, 1);
});

test('latest selection wins when the map import resolves after rapid navigation', async () => {
  let resolve;
  const loaded = new Promise((done) => { resolve = done; });
  const calls = [];
  const renderer = createDeferredRenderer(() => loaded);
  const target = {};
  const first = renderer.render(target, 'draw', ['IT']);
  const last = renderer.render(target, 'draw', ['FR']);
  resolve({ draw: (container, country) => calls.push(country) });
  await Promise.all([first, last]);
  assert.deepEqual(calls, ['FR']);
});

test('cancelled outlines stay empty after the import finishes', async () => {
  let calls = 0;
  const renderer = createDeferredRenderer(async () => ({ draw: () => { calls += 1; } }));
  const target = {};
  const pending = renderer.render(target, 'draw', []);
  renderer.cancel(target);
  await pending;
  assert.equal(calls, 0);
});

test('a failed map load exposes recovery and allows the next request to retry', async () => {
  let attempts = 0;
  const renderer = createDeferredRenderer(async () => {
    if (++attempts === 1) throw new Error('offline');
    return { draw: () => 'ready' };
  });
  const errors = [];
  const target = {};
  await renderer.render(target, 'draw', [], (error) => errors.push(error.message));
  assert.deepEqual(errors, ['offline']);
  assert.equal(await renderer.render(target, 'draw', []), 'ready');
  assert.equal(attempts, 2);
});
