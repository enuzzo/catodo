import test from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";
import { CatalogService } from "../../src/data/catalog-service.js";
import { searchChannels } from "../../src/data/search.js";
import {
  IPTV_ORG_API_URLS,
  IPTV_ORG_METADATA_REVISION,
  IPTV_ORG_SAFETY_CACHE_KEY,
  enrichPersistedChannelMetadata,
  enrichPersistedChannelSafety,
  fetchIptvOrgMetadata,
  loadIptvOrgMetadata,
  loadIptvOrgSafety,
  metadataForChannel,
  reduceIptvOrgMetadata,
} from "../../src/data/iptv-org-metadata.js";
import { COUNTRIES_API_URL } from "../../src/data/countries.js";
import { openCatalogDb, remove } from "../../src/data/db.js";

const resources = {
  channels: [
    {
      id: "UrlChannel.it", name: "URL Channel Official", alt_names: ["URL Uno"], network: "WorldNet",
      owners: ["Example Media"], country: "IT", categories: ["news"], is_nsfw: false,
      launched: "2016-07-28", closed: null, replaced_by: null, website: "https://channel.test/",
      rawInternalNoise: "do not retain this",
    },
    { id: "OtherChannel.ch", name: "Other Official", alt_names: [], network: null, owners: [], country: "CH", categories: ["general"], is_nsfw: false, launched: null, closed: null, replaced_by: null, website: null },
    { id: "Blocked.tv", name: "Blocked", alt_names: [], network: null, owners: [], country: "US", categories: [], is_nsfw: false, launched: null, closed: null, replaced_by: null, website: null },
    { id: "Adult.tv", name: "Adult", alt_names: [], network: null, owners: [], country: "US", categories: [], is_nsfw: true, launched: null, closed: null, replaced_by: null, website: null },
  ],
  feeds: [
    { channel: "UrlChannel.it", id: "Italian", name: "Italian HD", alt_names: ["Italia"], is_main: true, broadcast_area: ["c/IT"], timezones: ["Europe/Rome"], languages: ["ita"], format: "1080p" },
    { channel: "OtherChannel.ch", id: "German", name: "German", alt_names: [], is_main: true, broadcast_area: ["c/CH"], timezones: ["Europe/Zurich"], languages: ["deu"], format: "720p" },
  ],
  streams: [
    { channel: "UrlChannel.it", feed: "Italian", title: "URL Live", url: "HTTPS://VIDEO.TEST:443/live.m3u8#fragment", referrer: "https://ref.test/", user_agent: "Catodo Test", quality: "1080p", label: "Geo-blocked" },
    { channel: "OtherChannel.ch", feed: null, title: "Other Live", url: "https://video.test/other.m3u8", referrer: null, user_agent: null, quality: "720p", label: null },
  ],
  logos: [
    { channel: "UrlChannel.it", feed: "Italian", in_use: true, tags: ["horizontal"], width: 1000, height: 400, format: "SVG", url: "https://img.test/url.svg" },
    { channel: "UrlChannel.it", feed: "Italian", in_use: false, tags: [], width: 2000, height: 800, format: "PNG", url: "https://img.test/old.png" },
  ],
  categories: [
    { id: "news", name: "News", description: "Current affairs and reporting" },
    { id: "general", name: "General", description: "General programming" },
  ],
  languages: [{ code: "ita", name: "Italian" }, { code: "deu", name: "German" }],
  guides: [{ channel: "UrlChannel.it", feed: "Italian", site: "guide.test", site_id: "url", site_name: "URL Channel", lang: "it", sources: [{ host: "cdn.guide.test", url: "https://cdn.guide.test/guide.xml", format: "XML" }] }],
  blocklist: [
    { channel: "Blocked.tv", reason: "dmca", ref: "https://example.test/takedown" },
    { channel: "Adult.tv", reason: "nsfw", ref: "https://example.test/nsfw" },
  ],
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

test("loads all eight documented iptv-org resources into one compact v2 cache", async () => {
  const fetchImpl = fetchMock();
  const compact = await fetchIptvOrgMetadata({ fetchImpl, timeout: 1000 });
  assert.deepEqual(new Set(fetchImpl.calls.map((call) => call.url)), new Set(Object.values(IPTV_ORG_API_URLS)));
  assert.ok(fetchImpl.calls.every((call) => call.options.cache === "no-cache" && call.options.signal instanceof AbortSignal));
  assert.equal(compact.version, 2);
  assert.deepEqual(Object.keys(compact).sort(), ["byFeed", "byId", "byUrl", "version"]);
  assert.ok(!JSON.stringify(compact).includes("rawInternalNoise"), "unrecognized upstream fields are not retained");
});

test("matches endpoint URL before tvgId and exposes rich feed, logo, guide and channel metadata", async () => {
  const loaded = await loadIptvOrgMetadata({ fetchImpl: fetchMock(), getCache: async () => null, setCache: async () => {} });
  const match = metadataForChannel({
    tvgId: "OtherChannel.ch",
    endpoints: [{ url: "https://video.test/live.m3u8" }],
  }, loaded.index);
  assert.equal(match.matchedBy, "endpoint");
  assert.equal(match.officialName, "URL Channel Official");
  assert.equal(match.network, "WorldNet");
  assert.deepEqual(match.categoryNames, ["News"]);
  assert.deepEqual(match.languages, ["Italian"]);
  assert.equal(match.endpoint.feedName, "Italian HD");
  assert.equal(match.endpoint.preferredLogo, "https://img.test/url.svg");
  assert.equal(match.endpoint.hasGuide, true);
  assert.equal(match.endpoint.streamTitle, "URL Live");
  assert.equal(match.endpoint.userAgent, "Catodo Test");

  const fallback = metadataForChannel({ tvgId: "OtherChannel.ch", endpoints: [{ url: "https://unknown.test/live.m3u8" }] }, loaded.index);
  assert.equal(fallback.matchedBy, "tvgId");
  assert.equal(fallback.officialName, "Other Official");
  assert.deepEqual(fallback.languages, ["German"]);
});

test("uses fresh TTL caches, stale whole-cache fallback, and never marks a partial fetch fresh", async () => {
  const compact = reduceIptvOrgMetadata(resources);
  const fresh = await loadIptvOrgMetadata({
    getCache: async () => ({ value: compact, updatedAt: Date.now() }),
    fetchImpl: async () => { throw new Error("must not fetch"); },
  });
  assert.equal(fresh.source, "cache");
  assert.equal(fresh.stale, false);

  let writes = 0;
  const stale = await loadIptvOrgMetadata({
    getCache: async () => ({ value: compact, updatedAt: 1 }), maxAge: 10,
    setCache: async () => { writes += 1; },
    fetchImpl: async (url) => {
      if (url === IPTV_ORG_API_URLS.guides) throw new Error("guides offline");
      const name = Object.entries(IPTV_ORG_API_URLS).find(([, value]) => value === url)?.[0];
      return { ok: true, json: async () => resources[name] };
    },
  });
  assert.equal(stale.source, "cache");
  assert.equal(stale.stale, true);
  assert.match(stale.error.message, /guides offline/);
  assert.equal(writes, 0);
});

test("persists rich channel and endpoint metadata without changing identity or playlist display fields", async () => {
  const compact = reduceIptvOrgMetadata(resources);
  const active = [{
    channelId: "fp:legacy-stable-id", tvgId: "OtherChannel.ch", name: "Playlist Name",
    countries: ["DE"], languages: [], metadataRevision: 1,
    endpoints: [
      { endpointId: "ep:canonical", url: "https://video.test/live.m3u8" },
      { endpointId: "ep:fallback", url: "https://unknown.test/fallback.m3u8" },
    ],
  }];
  const persisted = [{
    channelId: "fp:legacy-stable-id", tvgId: "OtherChannel.ch", name: "Playlist Name", aliases: ["Playlist Alias"],
    countries: ["DE"], languages: [], categories: ["Local"], country: "DE", language: "", customLegacyField: "preserve-me",
    metadata: { customProvider: { keep: true } },
  }];
  const persistedEndpoints = [{
    endpointId: "ep:canonical|src:test", canonicalEndpointId: "ep:canonical", channelId: "fp:legacy-stable-id",
    sourceId: "src:test", snapshotId: "snap:test", url: "https://video.test/live.m3u8", headers: {}, referrer: "",
  }, {
    endpointId: "ep:fallback|src:test", canonicalEndpointId: "ep:fallback", channelId: "fp:legacy-stable-id",
    sourceId: "src:test", snapshotId: "snap:test", url: "https://unknown.test/fallback.m3u8", headers: {}, referrer: "",
  }];
  let writes;
  const result = await enrichPersistedChannelMetadata(null, active, {
    getCache: async () => ({ value: compact, updatedAt: Date.now() }),
    readRows: async () => persisted,
    readEndpointRows: async () => persistedEndpoints,
    persistUpdates: async (updates) => { writes = updates; },
  });
  assert.deepEqual(result.matchedBy, { endpoint: 1, tvgId: 0 });
  assert.equal(result.updated, 1);
  assert.equal(result.endpointsUpdated, 2);
  assert.equal(writes.channels[0].channelId, "fp:legacy-stable-id");
  assert.equal(writes.channels[0].name, "Playlist Name");
  assert.equal(writes.channels[0].customLegacyField, "preserve-me");
  assert.deepEqual(writes.channels[0].metadata.customProvider, { keep: true });
  assert.equal(writes.channels[0].metadata.iptvOrg.revision, 2);
  assert.deepEqual(writes.channels[0].countries, ["DE"]);
  assert.deepEqual(writes.channels[0].languages, ["Italian"]);
  assert.equal(writes.channels[0].metadataRevision, IPTV_ORG_METADATA_REVISION);
  assert.equal(writes.endpoints[0].endpointId, "ep:canonical|src:test");
  assert.equal(writes.endpoints[0].sourceId, "src:test");
  assert.equal(writes.endpoints[0].streamTitle, "URL Live");
  assert.equal(writes.endpoints[0].feedFormat, "1080p");
  assert.equal(writes.endpoints[0].headers.Referer, "https://ref.test/");
  assert.equal(writes.endpoints[0].headers["User-Agent"], "Catodo Test");
  assert.equal(writes.endpoints[1].feedName, "German");
  assert.equal(writes.endpoints[1].streamTitle, "", "an unmatched endpoint receives the tvgId feed, not a sibling URL's stream title");
});

test("small safety cache marks blocklist records before rich enrichment", async () => {
  let cached;
  const loaded = await loadIptvOrgSafety({ fetchImpl: fetchMock(), getCache: async () => null, setCache: async (record) => { cached = record; } });
  assert.equal(loaded.index.get("blocked.tv")[0].reason, "dmca");
  assert.equal(cached.value.version, 1);

  let writes;
  const result = await enrichPersistedChannelSafety(null, [
    { channelId: "tvg:blocked.tv", tvgId: "Blocked.tv" },
    { channelId: "tvg:adult.tv", tvgId: "Adult.tv" },
  ], {
    getCache: async () => cached,
    readRows: async () => [
      { channelId: "tvg:blocked.tv", tvgId: "Blocked.tv", name: "Keep" },
      { channelId: "tvg:adult.tv", tvgId: "Adult.tv", name: "Keep too" },
    ],
    persistRows: async (rows) => { writes = rows; },
  });
  assert.equal(result.blocked, 2);
  assert.equal(writes[0].blocked, true);
  assert.equal(writes[1].isNsfw, true);
});

test("a freshly imported blocklisted channel never enters list, search, or random", async () => {
  const playlistUrl = "https://example.test/list.m3u";
  const playlist = '#EXTM3U\n#EXTINF:-1 tvg-id="Blocked.tv" tvg-country="US",Blocked from playlist\nhttps://video.test/blocked.m3u8\n';
  const fetchImpl = async (url) => {
    if (url === COUNTRIES_API_URL) return { ok: true, status: 200, json: async () => [{ code: "US", name: "United States", languages: ["eng"], flag: "" }] };
    if (url === playlistUrl) return {
      ok: true, status: 200, body: null,
      headers: { get: () => null },
      text: async () => playlist,
    };
    const name = Object.entries(IPTV_ORG_API_URLS).find(([, value]) => value === url)?.[0];
    if (name) return { ok: true, status: 200, json: async () => resources[name] };
    throw new Error(`Unexpected URL: ${url}`);
  };
  const service = new CatalogService({ indexedDB: new IDBFactory(), fetchImpl });
  await service.init();
  await service.importUrl(playlistUrl, { confirmed: true });
  assert.equal(service.getState().channels.length, 1, "record remains persisted for audit/history integrity");
  assert.equal(service.list().length, 0);
  assert.equal((await service.search("Blocked")).length, 0);
  assert.equal(service.randomPlayable(), null);
  await service.enrichMetadata();
  service.destroy();
});

test("safety fetch failure rejects import and rolls back the staged active snapshot across restart", async () => {
  const playlistUrl = "https://example.test/unsafe-unknown.m3u";
  const playlist = '#EXTM3U\n#EXTINF:-1 tvg-id="Unknown.tv",Unknown\nhttps://video.test/unknown.m3u8\n';
  const indexedDB = new IDBFactory();
  let blocklistOffline = true;
  const fetchImpl = async (url) => {
    if (url === COUNTRIES_API_URL) return { ok: true, status: 200, json: async () => [{ code: "US", name: "United States", languages: ["eng"], flag: "" }] };
    if (url === playlistUrl) return { ok: true, status: 200, body: null, headers: { get: () => null }, text: async () => playlist };
    if (url === IPTV_ORG_API_URLS.blocklist && blocklistOffline) throw new Error("safety directory offline");
    const name = Object.entries(IPTV_ORG_API_URLS).find(([, value]) => value === url)?.[0];
    if (name) return { ok: true, status: 200, json: async () => resources[name] };
    throw new Error(`Unexpected URL: ${url}`);
  };
  const first = new CatalogService({ indexedDB, fetchImpl });
  await first.init();
  await assert.rejects(first.importUrl(playlistUrl, { confirmed: true }), (error) => error.code === "SAFETY_METADATA_UNAVAILABLE");
  assert.equal(first.getState().channels.length, 0);
  first.destroy();

  blocklistOffline = false;
  const restarted = new CatalogService({ indexedDB, fetchImpl });
  await restarted.init();
  assert.equal(restarted.getState().channels.length, 0, "rolled-back staged snapshot is not active after restart");
  restarted.destroy();
});

test("a failed safety refresh restores prior source endpoints and relations, not only its source pointer", async () => {
  const playlistUrl = "https://example.test/refresh.m3u";
  const firstPlaylist = '#EXTM3U\n#EXTINF:-1 tvg-id="OtherChannel.ch",Before refresh\nhttps://video.test/other.m3u8\n';
  const secondPlaylist = '#EXTM3U\n#EXTINF:-1 tvg-id="UrlChannel.it",After refresh\nhttps://video.test/live.m3u8\n';
  const indexedDB = new IDBFactory();
  let playlistCalls = 0;
  let blocklistOffline = false;
  const fetchImpl = async (url) => {
    if (url === COUNTRIES_API_URL) return { ok: true, status: 200, json: async () => [{ code: "CH", name: "Switzerland", languages: ["deu"], flag: "" }] };
    if (url === playlistUrl) {
      playlistCalls += 1;
      return { ok: true, status: 200, body: null, headers: { get: () => null }, text: async () => playlistCalls === 1 ? firstPlaylist : secondPlaylist };
    }
    if (url === IPTV_ORG_API_URLS.blocklist && blocklistOffline) throw new Error("safety directory offline");
    const name = Object.entries(IPTV_ORG_API_URLS).find(([, value]) => value === url)?.[0];
    if (name) return { ok: true, status: 200, json: async () => resources[name] };
    throw new Error(`Unexpected URL: ${url}`);
  };
  const service = new CatalogService({ indexedDB, fetchImpl });
  await service.init();
  const source = await service.importUrl(playlistUrl, { confirmed: true });
  await service.enrichMetadata();
  assert.equal(service.list()[0].name, "Before refresh");

  const db = await openCatalogDb(indexedDB);
  await remove(db, "settings", IPTV_ORG_SAFETY_CACHE_KEY);
  db.close();
  blocklistOffline = true;
  await assert.rejects(service.refreshSource(source.sourceId), (error) => error.code === "SAFETY_METADATA_UNAVAILABLE");
  assert.equal(service.list()[0].name, "Before refresh");
  service.destroy();

  blocklistOffline = false;
  const restarted = new CatalogService({ indexedDB, fetchImpl });
  await restarted.init();
  assert.equal(restarted.list()[0].name, "Before refresh");
  assert.equal(restarted.list()[0].endpoints[0].url, "https://video.test/other.m3u8");
  restarted.destroy();
});

test("search covers official names, aliases, owners, category descriptions and endpoint feed data", () => {
  const channel = {
    channelId: "x", name: "Playlist", officialName: "Official", aliases: ["Alt"], network: "Network",
    owners: ["Owner Corp"], categoryNames: ["News"], categoryDescriptions: [{ id: "news", name: "News", description: "Current affairs" }],
    endpoints: [{ feedName: "Rome Feed", streamTitle: "Evening Live", feedFormat: "1080p" }],
  };
  for (const query of ["Official", "Owner", "current affairs", "Rome Feed", "Evening Live", "1080p"]) assert.deepEqual(searchChannels([channel], query), [channel]);
});

test("best-effort rich enrichment reports network failure instead of rejecting", async () => {
  const result = await enrichPersistedChannelMetadata(null, [{ channelId: "legacy", countries: [], languages: [] }], {
    getCache: async () => null,
    fetchImpl: async () => { throw new Error("network unavailable"); },
  });
  assert.equal(result.updated, 0);
  assert.match(result.error, /network unavailable/);
  assert.equal(typeof CatalogService.prototype.enrichMetadata, "function");
});
