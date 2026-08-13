import assert from 'node:assert/strict';
import test from 'node:test';

import { countryGuideControlState, guideProgrammeFallback } from '../../src/ui/country-guide-model.js';

test('country guide discovery remains actionable before a provider lookup', () => {
  assert.deepEqual(countryGuideControlState(), {
    connected: false,
    disabled: false,
    label: 'Find & load guide',
    status: 'idle',
  });
  assert.equal(countryGuideControlState({ unavailable: true }).disabled, false);
  assert.equal(countryGuideControlState({ unavailable: true }).label, 'Check again');
});

test('country guide controls distinguish available, loading and connected states', () => {
  assert.equal(countryGuideControlState({ sourceCount: 2 }).status, 'available');
  assert.equal(countryGuideControlState({ checking: true }).disabled, true);
  assert.deepEqual(countryGuideControlState({ sourceCount: 2, configuredCount: 2 }), {
    connected: true,
    disabled: true,
    label: 'Guide loaded',
    status: 'connected',
  });
});

test('channel guide copy distinguishes stale, unmatched and unconfigured data', () => {
  assert.equal(guideProgrammeFallback('stale').fallback, 'Guide outdated');
  assert.equal(guideProgrammeFallback('unmatched').fallback, 'No guide match');
  assert.equal(guideProgrammeFallback('ready').fallback, 'No current programme');
  assert.equal(guideProgrammeFallback('error').fallback, 'Guide unavailable');
  assert.equal(guideProgrammeFallback('unconfigured').fallback, 'Guide not connected');
});
