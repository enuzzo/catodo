import test from "node:test";
import assert from "node:assert/strict";
import { collectLegacyState, resolveLegacyReferences, upgradeLegacyChannel } from "../../src/data/migration.js";
function storageFrom(entries) {
  const keys = Object.keys(entries);
  return { length: keys.length, key: (index) => keys[index], getItem: (key) => entries[key] ?? null };
}

test("legacy collection reads only catodo keys without mutating storage", () => {
  const storage = storageFrom({ "catodo:favs": '["https://one"]', unrelated: "keep" });
  assert.deepEqual(collectLegacyState(storage), { favs: ["https://one"] });
  assert.equal(storage.getItem("catodo:favs"), '["https://one"]');
});

test("legacy URLs resolve to channel ids while orphans are retained", () => {
  const refs = resolveLegacyReferences(["https://known", "https://gone"], new Map([["https://known", "tvg:known"]]));
  assert.equal(refs[0].channelId, "tvg:known");
  assert.equal(refs[1].orphan, true);
  assert.equal(refs[1].migratedFrom, "https://gone");
});

test("legacy channel upgrade preserves its endpoint", () => {
  const channel = upgradeLegacyChannel({ name: "Legacy", url: "https://test/live.m3u8", group: "News", geo: true }, "old-source");
  assert.equal(channel.source, "old-source");
  assert.equal(channel.endpoint.kind, "hls");
  assert.equal(channel.geoRestricted, true);
});
