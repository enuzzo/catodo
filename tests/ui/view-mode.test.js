import test from 'node:test';
import assert from 'node:assert/strict';

import { shouldActivateShellView } from '../../src/ui/view-mode.js';

test('catalog rerenders cannot dismiss the player overlay', () => {
  assert.equal(shouldActivateShellView('player', true), false);
  assert.equal(shouldActivateShellView('player'), false);
});

test('catalog rerenders cannot dismiss the multiview overlay', () => {
  assert.equal(shouldActivateShellView('multiview', true), false);
  assert.equal(shouldActivateShellView('multiview'), false);
});

test('shell views still activate during ordinary navigation', () => {
  assert.equal(shouldActivateShellView('shell', true), true);
  assert.equal(shouldActivateShellView('shell', false), false);
});
