import test from 'node:test';
import assert from 'node:assert/strict';

import { isPrimaryNavActive, resolvePlayerReturnView, shouldActivateShellView } from '../../src/ui/view-mode.js';

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

test('Explore and Live are independent shell destinations', () => {
  assert.equal(isPrimaryNavActive('home', 'home'), true);
  assert.equal(isPrimaryNavActive('explore', 'home'), false);
  assert.equal(isPrimaryNavActive('home', 'explore'), false);
  assert.equal(isPrimaryNavActive('explore', 'explore'), true);
  assert.equal(isPrimaryNavActive('countries', 'countries'), true);
});

test('player return preserves every shell destination', () => {
  for (const view of ['home', 'explore', 'countries', 'guide', 'library', 'sources']) {
    assert.equal(resolvePlayerReturnView(view), view);
  }
});

test('player return rejects overlay and unknown destinations', () => {
  assert.equal(resolvePlayerReturnView('player', 'countries'), 'countries');
  assert.equal(resolvePlayerReturnView('multiview'), 'home');
  assert.equal(resolvePlayerReturnView('unknown', 'unknown'), 'home');
});
