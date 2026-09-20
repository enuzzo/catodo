import test from 'node:test';
import assert from 'node:assert/strict';
import worldMap from '../../assets/vendor/map/world-map.js';
import { COUNTRY_NAMES } from '../../src/data/country-names.js';
import { FALLBACK_COUNTRIES } from '../../src/data/countries.js';

test('compact offline directory preserves every vendored country', () => {
  const expected = worldMap.locations.map(({ id, name }) => [id.toUpperCase(), name]).filter(([code, name]) => /^[A-Z]{2}$/.test(code) && name);
  assert.deepEqual(COUNTRY_NAMES, expected);
  assert.equal(new Set(COUNTRY_NAMES.map(([code]) => code)).size, COUNTRY_NAMES.length);
  assert.equal(FALLBACK_COUNTRIES.find((country) => country.code === 'IT').name, 'Italy');
  assert.deepEqual(FALLBACK_COUNTRIES.find((country) => country.code === 'IT').languages, ['ita']);
});
