import test from "node:test";
import assert from "node:assert/strict";
import { CatalogService } from "../../src/data/catalog-service.js";
import {
  IPTV_ORG_API_URLS,
  enrichPersistedChannelMetadata,
  fetchIptvOrgMetadata,
  loadIptvOrgMetadata,
  metadataForChannel,
  reduceIptvOrgMetadata,
} from "../../src/data/iptv-org-metadata.js";

const resources = {
  streams: [
    { channel: "UrlChannel.it", feed: "Italian", url: "HTTPS://VIDEO.TEST:443/live.m3u8#fragment" },
    { channel: "OtherChannel.ch", feed: null, url: "https://video.test/other.m3u8" },
  ],
  channels: [
    { id: "UrlChannel.it", country: "IT", name: "fields outside the cache are ignored" },
    { id: "OtherChannel.ch", country: "CH" },
  ],
  feeds: [
    { channel: "UrlChannel.it", id: "Italian", is_main: true, languages: ["ita"] },
    { channel: "OtherChannel.ch", id: "German", is_main: true, languages: ["deu"] },
  ],
  languages: [{ code: "ita", name: "Italian" }, { code: "deu", name: "German" }],
};

function fetchMock(overrides = {}) {
  const calls = [];
  const values = { ...resources, ...overrides };
  const implementation = async (url, options) => {
    calls.push({ url, options });
    const name = Object.entries(IPTV_ORG_API_URLS).find(([, value]) => value === url)?.[0];
    return { ok: true, status: 200, json: async () => values[name] };
  };
  implementation.calls = calls;
  return implementation;
}

test("uses the documented iptv-org streams/channels/feeds/languages JSON contract", async () => {
  const fetchImpl = fetchMock();
  const compact = await fetchIptvOrgMetadata({ fetchImpl, timeout: 1000 });
  assert.deepEqual(new Set(fetchImpl.calls.map((call) => call.url)), new Set(Object.values(IPTV_ORG_API_URLS)));
  assert.ok(fetchImpl.calls.every((call) => call.options.cache === "no-cache" && call.options.signal instanceof AbortSignal));
  assert.equal(compact.version, 1);
  assert.deepEqual(Object.keys(compact).sort(), ["byId", "byUrl", "version"]);
  assert.ok(!JSON.stringify(compact).includes("fields outside the cache"), "the cache must not retain full upstream rows");
});

test("matches normalized endpoint URL before tvgId and resolves feed language names", async () => {
  let cached;
  const loaded = await loadIptvOrgMetadata({
    fetchImpl: fetchMock(),
    getCache: async () => null,
    setCache: async (record) => { cached = record; },
  });
  const match = metadataForChannel({
    tvgId: "OtherChannel.ch",
    endpoints: [{ url: "https://video.test/live.m3u8" }],
  }, loaded.index);
  assert.deepEqual(match, { countries: ["IT"], languages: ["Italian"], matchedBy: "endpoint" });
  const fallback = metadataForChannel({
    tvgId: "OtherChannel.ch",
    endpoints: [{ url: "https://unknown.test/live.m3u8" }],
  }, loaded.index);
  assert.deepEqual(fallback, { countries: ["CH"], languages: ["German"], matchedBy: "tvgId" });
  assert.equal(cached.value.byUrl.length, 2);
});

test("uses a fresh TTL cache without fetching and a stale cache when the API fails", async () => {
  const compact = reduceIptvOrgMetadata(resources);
  const recent = { value: compact, updatedAt: Date.now() };
  const fresh = await loadIptvOrgMetadata({
    getCache: async () => recent,
    fetchImpl: async () => { throw new Error("must not fetch"); },
  });
  assert.equal(fresh.source, "cache");
  assert.equal(fresh.stale, false);

  const stale = await loadIptvOrgMetadata({
    getCache: async () => ({ value: compact, updatedAt: 1 }),
    maxAge: 10,
    fetchImpl: async () => { throw new Error("offline"); },
  });
  assert.equal(stale.source, "cache");
  assert.equal(stale.stale, true);
  assert.match(stale.error.message, /offline/);
});

test("enriches only missing fields and persists rows without changing identity", async () => {
  const compact = reduceIptvOrgMetadata(resources);
  const active = [{
    channelId: "fp:legacy-stable-id",
    tvgId: "OtherChannel.ch",
    countries: ["DE"],
    languages: [],
    endpoints: [{ url: "https://video.test/live.m3u8" }],
  }];
  const persisted = [{
    channelId: "fp:legacy-stable-id",
    tvgId: "OtherChannel.ch",
    name: "Legacy favorite",
    countries: ["DE"],
    languages: [],
    country: "DE",
    language: "",
    customLegacyField: "preserve-me",
  }];
  let writes = null;
  let readCalls = 0;
  const result = await enrichPersistedChannelMetadata(null, active, {
    getCache: async () => ({ value: compact, updatedAt: Date.now() }),
    readRows: async () => { readCalls += 1; return persisted; },
    persistRows: async (rows) => { writes = rows; },
  });
  assert.deepEqual(result.matchedBy, { endpoint: 1, tvgId: 0 });
  assert.equal(result.updated, 1);
  assert.equal(writes[0].channelId, "fp:legacy-stable-id");
  assert.equal(writes[0].tvgId, "OtherChannel.ch");
  assert.equal(writes[0].customLegacyField, "preserve-me");
  assert.deepEqual(writes[0].countries, ["DE"], "existing metadata is never overwritten");
  assert.deepEqual(writes[0].languages, ["Italian"]);
  assert.equal(readCalls, 1);
});

test("best-effort enrichment reports network failure instead of rejecting", async () => {
  const result = await enrichPersistedChannelMetadata(null, [{ channelId: "legacy", countries: [], languages: [] }], {
    getCache: async () => null,
    fetchImpl: async () => { throw new Error("network unavailable"); },
  });
  assert.equal(result.updated, 0);
  assert.match(result.error, /network unavailable/);
  assert.equal(typeof CatalogService.prototype.enrichMetadata, "function");
});
