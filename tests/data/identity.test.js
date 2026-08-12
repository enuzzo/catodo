import test from "node:test";
import assert from "node:assert/strict";
import { channelIdFor, channelFingerprint, endpointIdFor } from "../../src/data/identity.js";
test("tvg-id is the preferred stable identity", () => {
  assert.equal(channelIdFor({ tvgId: "  BBC.One " }), "tvg:bbc.one");
  assert.equal(channelIdFor({ tvgId: "BBC.ONE", name: "renamed" }), "tvg:bbc.one");
});

test("fallback fingerprint ignores endpoint mirror changes", () => {
  const a = { name: "Rai Uno", country: "IT", language: "it", url: "https://a.test" };
  const b = { ...a, url: "https://b.test" };
  assert.equal(channelFingerprint(a), channelFingerprint(b));
  assert.match(channelIdFor(a), /^fp:/);
});

test("endpoint identity includes relevant request headers", () => {
  const a = endpointIdFor({ url: "https://test/live", headers: { Referer: "a" } });
  const b = endpointIdFor({ url: "https://test/live", headers: { Referer: "b" } });
  assert.notEqual(a, b);
});
