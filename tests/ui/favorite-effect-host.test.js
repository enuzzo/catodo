import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveFavoriteEffectHost } from '../../src/ui/favorite-effect-host.js';

test('favorite feedback is mounted inside the active fullscreen element', () => {
  const anchor = {};
  const root = { name: 'root' };
  const fullscreen = { contains: (value) => value === anchor };
  assert.equal(resolveFavoriteEffectHost(root, anchor, { fullscreenElement: fullscreen }), fullscreen);
});

test('favorite feedback falls back to the app root outside fullscreen', () => {
  const root = { name: 'root' };
  const fullscreen = { contains: () => false };
  assert.equal(resolveFavoriteEffectHost(root, {}, { fullscreenElement: fullscreen }), root);
  assert.equal(resolveFavoriteEffectHost(root, {}, {}), root);
});
