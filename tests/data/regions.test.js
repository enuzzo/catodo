import test from "node:test";
import assert from "node:assert/strict";
import { filterCountriesByRegion, regionForCountry } from "../../src/data/regions.js";

test("regionForCountry maps representative ISO codes and normalizes input", () => {
  assert.equal(regionForCountry("it"), "europe");
  assert.equal(regionForCountry("BR"), "americas");
  assert.equal(regionForCountry("JP"), "asia");
  assert.equal(regionForCountry("NG"), "africa");
  assert.equal(regionForCountry("NZ"), "oceania");
  assert.equal(regionForCountry(" XK "), "europe");
});

test("regionForCountry documents pragmatic territory and transcontinental choices", () => {
  assert.equal(regionForCountry("RU"), "europe");
  assert.equal(regionForCountry("TR"), "asia");
  assert.equal(regionForCountry("GF"), "americas");
  assert.equal(regionForCountry("AQ"), "oceania");
  assert.equal(regionForCountry("ZZ"), null);
  assert.equal(regionForCountry(null), null);
});

test("filterCountriesByRegion preserves country records and supports all", () => {
  const countries = [
    { code: "IT", name: "Italy" },
    { code: "BR", name: "Brazil" },
    { code: "JP", name: "Japan" },
    { code: "ZZ", name: "Unknown" },
  ];

  assert.deepEqual(filterCountriesByRegion(countries, "americas"), [{ code: "BR", name: "Brazil" }]);
  assert.deepEqual(filterCountriesByRegion([...countries, { code: "US", name: "United States" }], "north-america"), [{ code: "US", name: "United States" }]);
  assert.deepEqual(filterCountriesByRegion(countries, "south-america"), [{ code: "BR", name: "Brazil" }]);
  assert.strictEqual(filterCountriesByRegion(countries, "all"), countries);
  assert.deepEqual(filterCountriesByRegion(countries, "invalid"), []);
  assert.deepEqual(filterCountriesByRegion(null, "europe"), []);
});
