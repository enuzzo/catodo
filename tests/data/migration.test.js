import test from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";
import { collectLegacyState, legacyInstallationPayload, migrateLegacyStorage, resolveLegacyReferences, upgradeLegacyChannel } from "../../src/data/migration.js";
import { applyInstallationState, getAll, openCatalogDb } from "../../src/data/db.js";
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

test("retained legacy data is exposed for one explicit installation recovery without replaying migration", async () => {
  const db = await openCatalogDb(new IDBFactory());
  const storage = storageFrom({
    "catodo:sources": JSON.stringify([{ id: "legacy-source", url: "https://legacy.test/list.m3u", name: "Legacy" }]),
    "catodo:ch:legacy-source": JSON.stringify({ ch: [{ tvgId: "Legacy.test", name: "Legacy channel", url: "https://legacy.test/live.m3u8" }] }),
    "catodo:favs": JSON.stringify(["https://legacy.test/live.m3u8"]),
  });

  await migrateLegacyStorage(db, storage);
  await applyInstallationState(db, { sources: [], favorites: [], settings: {} });
  assert.equal((await getAll(db, "sources")).length, 0);
  assert.equal((await getAll(db, "favorites")).length, 0);

  const recovery = legacyInstallationPayload(storage);
  assert.deepEqual(recovery.sources.map((source) => source.sourceId), ["legacy-source"]);
  assert.deepEqual(recovery.favorites.map((favorite) => favorite.channelId), ["tvg:legacy.test"]);
  await migrateLegacyStorage(db, storage);
  assert.equal((await getAll(db, "sources")).length, 0);
  assert.equal((await getAll(db, "favorites")).length, 0);
  db.close();
});

test("retained legacy recovery payload includes sources, favorites and shared proxy", async () => {
  const db = await openCatalogDb(new IDBFactory());
  const storage = storageFrom({
    "catodo:sources": JSON.stringify([{ id: "legacy-source", url: "https://legacy.test/list.m3u", name: "Legacy" }]),
    "catodo:ch:legacy-source": JSON.stringify({ ch: [{ tvgId: "Legacy.test", name: "Legacy channel", url: "https://legacy.test/live.m3u8" }] }),
    "catodo:favs": JSON.stringify(["https://legacy.test/live.m3u8"]),
    "catodo:proxy": JSON.stringify("https://proxy.test/?url="),
  });
  const recovery = legacyInstallationPayload(storage);
  assert.deepEqual(recovery.sources.map((source) => source.sourceId), ["legacy-source"]);
  assert.deepEqual(recovery.favorites.map((favorite) => favorite.channelId), ["tvg:legacy.test"]);
  assert.equal(recovery.settings.proxy, "https://proxy.test/?url=");
  db.close();
});
