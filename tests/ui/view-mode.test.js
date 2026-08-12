import test from 'node:test';
import assert from 'node:assert/strict';

import { isPrimaryNavActive, shouldActivateShellView } from '../../src/ui/view-mode.js';

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

test('Explore and Live are mutually exclusive home navigation modes', () => {
  assert.equal(isPrimaryNavActive('home', 'home', 'live'), true);
  assert.equal(isPrimaryNavActive('explore', 'home', 'live'), false);
  assert.equal(isPrimaryNavActive('home', 'home', 'explore'), false);
  assert.equal(isPrimaryNavActive('explore', 'home', 'explore'), true);
  assert.equal(isPrimaryNavActive('countries', 'countries', 'explore'), true);
});
