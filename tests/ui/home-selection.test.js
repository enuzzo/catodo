import test from 'node:test';
import assert from 'node:assert/strict';

import { needsFirstPlaylist, selectInitialHomeChannel } from '../../src/ui/home-selection.js';

test('Live and Discover offer a first playlist only after a genuinely empty catalog is ready', () => {
  const empty = { ready: true, sources: [], channels: [], installationSync: { status: 'synced' } };
  for (const status of ['synced', 'local-only', 'pending']) {
    assert.ok(needsFirstPlaylist({ ...empty, installationSync: { status } }));
  }
  for (const snapshot of [null, { ...empty, ready: false }, { ...empty, sources: [{}] }, { ...empty, channels: [{}] }]) {
    assert.equal(needsFirstPlaylist(snapshot), false);
  }
  for (const sync of [{ status: 'error' }, { status: 'loading' }, { hydrating: 1 }, { hydrationFailed: 1 }, { recoveryAvailable: true }]) {
    assert.equal(needsFirstPlaylist({ ...empty, installationSync: { ...empty.installationSync, ...sync } }), false);
  }
});

test('the first Home selection is randomly chosen from playable favorites', () => {
  let randomFallbackCalled = false;
  const favorites = [{ channelId: 'favorite-a' }, { channelId: 'favorite-b' }];

  const selected = selectInitialHomeChannel({
    favorites,
    rng: () => 0.75,
    pickRandom: () => {
      randomFallbackCalled = true;
      return { channelId: 'catalog-random' };
    },
  });

  assert.equal(selected.channelId, 'favorite-b');
  assert.equal(randomFallbackCalled, false);
});

test('the first Home selection keeps the catalog randomizer fallback without favorites', () => {
  const selected = selectInitialHomeChannel({
    favorites: [],
    pickRandom: () => ({ channelId: 'catalog-random' }),
    fallback: { channelId: 'first-channel' },
  });

  assert.equal(selected.channelId, 'catalog-random');
});
