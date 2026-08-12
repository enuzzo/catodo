import test from "node:test";
import assert from "node:assert/strict";
import { inspectSourceUrl, assertImportAllowed, parseDeepLink, countryPlaylistUrl } from "../../src/data/source-policy.js";
test("only exact iptv-org playlist paths are trusted", () => {
  assert.equal(inspectSourceUrl("https://iptv-org.github.io/iptv/countries/it.m3u").allowed, true);
  assert.equal(inspectSourceUrl("https://iptv-org.github.io/iptv/countries/it.m3u?redirect=evil").allowed, false);
  assert.equal(inspectSourceUrl("https://iptv-org.github.io.evil.test/iptv/countries/it.m3u").allowed, false);
  assert.equal(inspectSourceUrl("http://iptv-org.github.io/iptv/countries/it.m3u").allowed, false);
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
