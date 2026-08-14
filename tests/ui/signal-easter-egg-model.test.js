import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SIGNAL_EASTER_EGGS,
  createSignalEasterEggDeck,
  drawSignalEasterEgg,
  shuffleSignalEasterEggs,
} from '../../src/ui/signal-easter-egg-model.js';

test('signal easter eggs are shuffled without duplicates', () => {
  const effects = shuffleSignalEasterEggs(() => 0.42);
  assert.equal(effects.length, SIGNAL_EASTER_EGGS.length);
  assert.deepEqual(new Set(effects), new Set(SIGNAL_EASTER_EGGS));
});

test('the six anomalies play once before the secret finale', () => {
  let deck = createSignalEasterEggDeck(() => 0);
  const played = [];

  for (let index = 0; index < SIGNAL_EASTER_EGGS.length; index += 1) {
    const draw = drawSignalEasterEgg(deck, () => 0);
    played.push(draw.effect);
    deck = draw.deck;
  }

  assert.deepEqual(new Set(played), new Set(SIGNAL_EASTER_EGGS));
  assert.equal(new Set(played).size, SIGNAL_EASTER_EGGS.length);

  const finale = drawSignalEasterEgg(deck, () => 0);
  assert.equal(finale.effect, 'finale');
  assert.equal(finale.deck.cycle, 1);
  assert.equal(finale.deck.remaining.length, SIGNAL_EASTER_EGGS.length);
});

test('a fresh deck is ready immediately after the finale', () => {
  const exhausted = { remaining: [], discovered: [...SIGNAL_EASTER_EGGS], cycle: 4 };
  const finale = drawSignalEasterEgg(exhausted, () => 0.25);
  const next = drawSignalEasterEgg(finale.deck, () => 0.25);

  assert.equal(finale.effect, 'finale');
  assert.ok(SIGNAL_EASTER_EGGS.includes(next.effect));
  assert.equal(next.deck.cycle, 5);
  assert.equal(next.deck.discovered.length, 1);
});
