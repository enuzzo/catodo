import test from 'node:test';
import assert from 'node:assert/strict';

import { programmeCardNeedsExpansion } from '../../src/ui/guide-programme-card.js';

function card({ titleWidth = 100, titleClientWidth = 100, scrollHeight = 66, clientHeight = 66 } = {}) {
  return {
    scrollHeight,
    clientHeight,
    querySelector: () => ({ scrollWidth: titleWidth, clientWidth: titleClientWidth }),
  };
}

test('short Guide cards expand when their title is clipped', () => {
  assert.equal(programmeCardNeedsExpansion(card({ titleWidth: 180, titleClientWidth: 28 })), true);
  assert.equal(programmeCardNeedsExpansion(card({ scrollHeight: 81, clientHeight: 66 })), true);
});

test('Guide cards with fully visible content open the full guide directly', () => {
  assert.equal(programmeCardNeedsExpansion(card()), false);
});
