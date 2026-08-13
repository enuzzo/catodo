import test from 'node:test';
import assert from 'node:assert/strict';

import { selectInitialHomeChannel } from '../../src/ui/home-selection.js';

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
