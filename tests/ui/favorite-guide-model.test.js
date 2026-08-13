import test from 'node:test';
import assert from 'node:assert/strict';
import { favoriteGuidePlan } from '../../src/ui/favorite-guide-model.js';

test('a ready Favorite guide needs no follow-up action', () => {
  assert.deepEqual(favoriteGuidePlan({
    schedule: { status: 'ready' },
    mappedSources: ['https://guide.test/channel.xml'],
    countryCode: 'IT',
  }), { status: 'ready', action: '' });
});

test('a Favorite with a country but no accepted source offers country guide setup', () => {
  assert.deepEqual(favoriteGuidePlan({ countryCode: 'FR' }), {
    status: 'needs-country-guide',
    action: 'open-favorite-guide-setup',
  });
});

test('an unmatched configured Favorite reports the real provider outcome', () => {
  assert.deepEqual(favoriteGuidePlan({
    schedule: { status: 'unmatched' },
    configuredSources: 2,
    countryCode: 'DE',
  }), { status: 'unmatched', action: 'open-guide-settings' });
});

test('an unmatched result from unrelated installed countries still offers the correct country setup', () => {
  assert.deepEqual(favoriteGuidePlan({
    schedule: { status: 'unmatched' },
    countryCode: 'ZA',
  }), { status: 'needs-country-guide', action: 'open-favorite-guide-setup' });
});

test('a Favorite without country metadata falls back to manual guide settings', () => {
  assert.deepEqual(favoriteGuidePlan(), {
    status: 'needs-manual-guide',
    action: 'open-guide-settings',
  });
});
