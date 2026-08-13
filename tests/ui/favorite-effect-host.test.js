import test from 'node:test';
import assert from 'node:assert/strict';

import { favoriteEffectPosition, resolveFavoriteEffectHost } from '../../src/ui/favorite-effect-host.js';

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

test('player Favorite feedback stays below the clipped top-edge burst area', () => {
  assert.deepEqual(favoriteEffectPosition({ left: 118, top: 0, width: 126, height: 52 }, {
    playerToolbar: true,
  }), { left: 181, top: 64 });
  assert.deepEqual(favoriteEffectPosition({ left: 20, top: 80, width: 32, height: 32 }), {
    left: 36,
    top: 96,
  });
});
