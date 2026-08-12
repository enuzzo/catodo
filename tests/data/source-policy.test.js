import test from "node:test";
import assert from "node:assert/strict";
import { inspectSourceUrl, assertImportAllowed, parseDeepLink, countryPlaylistUrl } from "../../src/data/source-policy.js";
import { SOURCE_PRESETS } from "../../src/data/source-presets.js";
test("only exact iptv-org playlist paths are trusted", () => {
  assert.equal(inspectSourceUrl("https://iptv-org.github.io/iptv/countries/it.m3u").allowed, true);
  assert.equal(inspectSourceUrl("https://iptv-org.github.io/iptv/countries/it.m3u?redirect=evil").allowed, false);
  assert.equal(inspectSourceUrl("https://iptv-org.github.io.evil.test/iptv/countries/it.m3u").allowed, false);
  assert.equal(inspectSourceUrl("http://iptv-org.github.io/iptv/countries/it.m3u").allowed, false);
  assert.equal(inspectSourceUrl("https://iptv-org.github.io/iptv/index.country.m3u").allowed, true);
  assert.equal(inspectSourceUrl("https://iptv-org.github.io/iptv/index.language.m3u").allowed, true);
  assert.equal(inspectSourceUrl("https://iptv-org.github.io/iptv/index.category.m3u").allowed, true);
  assert.equal(inspectSourceUrl("https://iptv-org.github.io/iptv/index.country.m3u.evil").allowed, false);
});

test("trusted sources still require explicit consent", () => {
  assert.throws(
    () => assertImportAllowed("https://iptv-org.github.io/iptv/index.m3u"),
    (error) => error.code === "CONSENT_REQUIRED",
  );
  assert.equal(assertImportAllowed("https://iptv-org.github.io/iptv/index.m3u", { confirmed: true }).trusted, true);
});

test("untrusted source needs explicit consent", () => {
  assert.throws(() => assertImportAllowed("https://example.test/list.m3u"), (error) => error.code === "CONSENT_REQUIRED");
  assert.equal(assertImportAllowed("https://example.test/list.m3u", { confirmed: true }).valid, true);
});

test("deep links produce inert intents", () => {
  const intent = parseDeepLink("https://catodo.test/?country=ch");
  assert.deepEqual(intent, { type: "country", valid: true, confirmed: false, code: "CH", url: countryPlaylistUrl("CH") });
  const source = parseDeepLink("https://catodo.test/?source=https%3A%2F%2Fexample.test%2Flist.m3u");
  assert.equal(source.confirmed, false);
  assert.equal(source.consentRequired, true);
});

test("recommended source presets are unique official trusted URLs", () => {
  assert.equal(new Set(SOURCE_PRESETS.map((preset) => preset.id)).size, SOURCE_PRESETS.length);
  assert.equal(new Set(SOURCE_PRESETS.map((preset) => preset.url)).size, SOURCE_PRESETS.length);
  SOURCE_PRESETS.forEach((preset) => assert.equal(inspectSourceUrl(preset.url).trusted, true, preset.id));
});
