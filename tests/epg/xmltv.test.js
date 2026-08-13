import test from "node:test";
import assert from "node:assert/strict";
import { guideChannelIdsFor, parseXmltv, parseXmltvDate, parseXmltvDocument, programmesForChannel } from "../../src/epg/xmltv.js";
import { EpgService, guideUrlsForChannels } from "../../src/epg/service.js";
import { epgPresetsForCountry, migrateKnownEpgSources, OPEN_EPG_ITALY_URLS } from "../../src/epg/presets.js";
import { GlobeTvCatalog, globeTvCountryFromUrl, groupGuideSources } from "../../src/epg/catalog.js";

test("collects unique catalog-listed XMLTV URLs from country channel mappings", () => {
  const channels = [
    { guides: [{ sources: [{ url: "https://guide.test/italy.xml", format: "XML" }] }] },
    { endpoints: [{ guides: [{ sources: [
      { url: "https://guide.test/italy.xml", format: "XML" },
      { url: "https://guide.test/italy.json", format: "JSON" },
      { url: "https://guide.test/italy-2.xml" },
    ] }] }] },
  ];
  assert.deepEqual(guideUrlsForChannels(channels), [
    "https://guide.test/italy.xml",
    "https://guide.test/italy-2.xml",
  ]);
});

test("resolves only explicitly configured country presets", () => {
  assert.equal(epgPresetsForCountry("it")[0]?.id, "open-epg-italy");
  assert.deepEqual(epgPresetsForCountry("FR"), []);
});

test("migrates the obsolete GlobeTV Italy mirror without removing custom sources", () => {
  assert.deepEqual(migrateKnownEpgSources([
    "https://example.org/custom.xml",
    "https://raw.githubusercontent.com/globetvapp/epg/main/Italy/italy1.xml",
  ]), ["https://example.org/custom.xml", ...OPEN_EPG_ITALY_URLS]);
});

test("parses XMLTV dates with offsets", () => {
  assert.equal(parseXmltvDate("20260812143000 +0200"), Date.UTC(2026, 7, 12, 12, 30));
});

test("loads a consented XMLTV source, caches it and resolves the channel schedule", async () => {
  const settings = new Map();
  const catalog = {
    getSetting: async (key, fallback) => settings.has(key) ? settings.get(key) : fallback,
    setSetting: async (key, value) => { settings.set(key, value); return value; },
  };
  let fetches = 0;
  const fetchImpl = async () => {
    fetches += 1;
    return new Response(`<tv><programme start="20260812140000 +0200" stop="20260812150000 +0200" channel="Rai1.it"><title>Live news</title></programme></tv>`);
  };
  const service = await new EpgService({ catalog, fetchImpl }).init();
  await service.setSources(["https://example.org/guide.xml"]);
  const channel = { channelId: "stable-id", tvgId: "Rai1.it" };
  const options = { from: Date.UTC(2026, 7, 12, 12, 30), to: Date.UTC(2026, 7, 12, 13, 30) };
  assert.equal((await service.schedule(channel, options)).programmes[0].title, "Live news");
  assert.equal((await service.schedule(channel, options)).programmes.length, 1);
  assert.equal(fetches, 1);
});

test("TV Guide invokes browser fetch with the global receiver", async () => {
  const settings = new Map();
  const catalog = {
    getSetting: async (key, fallback) => settings.has(key) ? settings.get(key) : fallback,
    setSetting: async (key, value) => { settings.set(key, value); return value; },
  };
  const fetchImpl = async function () {
    assert.equal(this, globalThis);
    return new Response(`<tv><programme start="20260812140000 +0200" stop="20260812150000 +0200" channel="Rai1.it"><title>Bound fetch</title></programme></tv>`);
  };
  const service = await new EpgService({ catalog, fetchImpl }).init();
  await service.setSources(["https://example.org/guide.xml"]);
  const schedule = await service.schedule({ channelId: "stable-id", tvgId: "Rai1.it" }, {
    from: Date.UTC(2026, 7, 12, 12, 30),
    to: Date.UTC(2026, 7, 12, 13, 30),
  });
  assert.equal(schedule.programmes[0].title, "Bound fetch");
});

test("channel-mapped guide sources take priority over generic Settings sources", async () => {
  const settings = new Map();
  const requests = [];
  const catalog = {
    getSetting: async (key, fallback) => settings.has(key) ? settings.get(key) : fallback,
    setSetting: async (key, value) => { settings.set(key, value); return value; },
  };
  const service = await new EpgService({
    catalog,
    fetchImpl: async (url) => {
      requests.push(url);
      return new Response("<tv></tv>");
    },
  }).init();
  await service.setSources(["https://guide.test/generic.xml"]);
  await service.schedule({
    channelId: "mapped",
    guides: [{ sources: [{ url: "https://guide.test/country.xml", format: "XML" }] }],
  });
  assert.deepEqual(requests, [
    "https://guide.test/country.xml",
    "https://guide.test/generic.xml",
  ]);
});

test("forced refresh revalidates once, preserves a 304 cache and persists cadence", async () => {
  const settings = new Map();
  const catalog = {
    getSetting: async (key, fallback) => settings.has(key) ? settings.get(key) : fallback,
    setSetting: async (key, value) => { settings.set(key, value); return value; },
  };
  const requests = [];
  const xml = `<tv><programme start="20260812140000 +0200" stop="20260812150000 +0200" channel="Rai1.it"><title>Cached news</title></programme></tv>`;
  const fetchImpl = async (_url, options) => {
    requests.push(options);
    if (requests.length === 1) return new Response(xml, { headers: { etag: '"guide-v1"' } });
    return new Response(null, { status: 304 });
  };
  const service = await new EpgService({ catalog, fetchImpl }).init();
  await service.setSources(["https://example.org/guide.xml"]);
  await service.setRefreshMinutes(30);
  const channel = { channelId: "stable-id", tvgId: "Rai1.it" };
  const options = { from: Date.UTC(2026, 7, 12, 12, 30), to: Date.UTC(2026, 7, 12, 13, 30) };
  await service.schedule(channel, options);
  const refreshed = await service.schedule(channel, { ...options, force: true });
  assert.equal(refreshed.programmes[0].title, "Cached news");
  assert.equal(requests.length, 2);
  assert.equal(requests[1].cache, "no-cache");
  assert.equal(service.getRefreshMinutes(), 30);
  assert.equal(settings.get("epg:refreshMinutes"), 30);
});

test("rejects more than 32 guide sources before changing persisted or in-memory settings", async () => {
  const writes = [];
  const catalog = {
    getSetting: async (_key, fallback) => fallback,
    setSetting: async (key, value) => { writes.push([key, value]); },
  };
  const service = await new EpgService({ catalog }).init();
  const sources = Array.from({ length: 33 }, (_, index) => `https://example.org/${index}.xml`);
  await assert.rejects(service.setSources(sources), /at most 32 sources/);
  assert.deepEqual(service.getSources(), []);
  assert.deepEqual(writes, []);
});

test("parses, decodes and filters current XMLTV programmes", () => {
  const xml = `<?xml version="1.0"?><tv>
    <programme start="20260812140000 +0200" stop="20260812150000 +0200" channel="Rai1.it"><title>News &amp; Weather</title><desc><![CDATA[Live <b>edition</b>]]></desc></programme>
    <programme start="20260812150000 +0200" stop="20260812160000 +0200" channel="Rai1.it"><title>Next show</title></programme>
  </tv>`;
  const programmes = parseXmltv(xml);
  assert.equal(programmes.length, 2);
  assert.equal(programmes[0].title, "News & Weather");
  assert.equal(programmes[0].description, "Live edition");
  assert.equal(programmesForChannel(programmes, "rai1.it", {
    from: Date.UTC(2026, 7, 12, 12, 30),
    to: Date.UTC(2026, 7, 12, 14, 30),
  }).length, 2);
});

test("uses XMLTV channel display names to match provider-specific IDs", async () => {
  const xml = `<tv>
    <channel id="Canale 5 HD.it"><display-name>Canale 5 HD.it</display-name></channel>
    <programme start="20260812140000 +0200" stop="20260812150000 +0200" channel="Canale 5 HD.it"><title>Telegiornale</title></programme>
  </tv>`;
  const document = parseXmltvDocument(xml);
  assert.deepEqual(guideChannelIdsFor({ channelId: "stable", name: "Canale 5" }, document.channels), ["stable", "Canale 5 HD.it"]);
  const settings = new Map([["epg:sources", ["https://example.org/italy.xml"]]]);
  const catalog = {
    getSetting: async (key, fallback) => settings.has(key) ? settings.get(key) : fallback,
    setSetting: async (key, value) => { settings.set(key, value); return value; },
  };
  const service = await new EpgService({ catalog, fetchImpl: async () => new Response(xml) }).init();
  const schedule = await service.schedule({ channelId: "stable", name: "Canale 5" }, {
    from: Date.UTC(2026, 7, 12, 12, 30), to: Date.UTC(2026, 7, 12, 13, 30),
  });
  assert.equal(schedule.matched, true);
  assert.equal(schedule.programmes[0].title, "Telegiornale");
  assert.equal(service.getSourceStatuses()[0].matchedChannels, 1);
});

test("marks matched channels and sources as stale when programme data ended before the requested window", async () => {
  const xml = `<tv>
    <channel id="Canale 5.it"><display-name>Canale 5</display-name></channel>
    <programme start="20251231140000 +0100" stop="20251231150000 +0100" channel="Canale 5.it"><title>Old news</title></programme>
  </tv>`;
  const settings = new Map([["epg:sources", ["https://example.org/italy.xml"]]]);
  const catalog = {
    getSetting: async (key, fallback) => settings.has(key) ? settings.get(key) : fallback,
    setSetting: async (key, value) => { settings.set(key, value); return value; },
  };
  const service = await new EpgService({ catalog, fetchImpl: async () => new Response(xml) }).init();
  const schedule = await service.schedule({ channelId: "canale-5", name: "Canale 5" }, {
    from: Date.UTC(2026, 7, 13, 12),
    to: Date.UTC(2026, 7, 13, 20),
  });
  assert.equal(schedule.matched, true);
  assert.equal(schedule.status, "stale");
  assert.deepEqual(schedule.programmes, []);
  assert.equal(service.getSourceStatuses()[0].dataState, "stale");
});

test("falls back to the authenticated same-origin cache for Open EPG feeds", async () => {
  const settings = new Map([["epg:sources", [OPEN_EPG_ITALY_URLS[0]]]]);
  const catalog = {
    getSetting: async (key, fallback) => settings.has(key) ? settings.get(key) : fallback,
    setSetting: async (key, value) => { settings.set(key, value); return value; },
  };
  const requests = [];
  const service = await new EpgService({ catalog, fetchImpl: async (url) => {
    requests.push(url);
    if (url === OPEN_EPG_ITALY_URLS[0]) throw new TypeError("CORS blocked");
    return new Response(`<tv><channel id="Rai1.it"><display-name>Rai 1</display-name></channel><programme start="20260813140000 +0200" stop="20260813150000 +0200" channel="Rai1.it"><title>Live news</title></programme></tv>`);
  } }).init();
  const schedule = await service.schedule({ channelId: "rai-1", name: "Rai 1" }, {
    from: Date.UTC(2026, 7, 13, 12, 30),
    to: Date.UTC(2026, 7, 13, 13, 30),
  });
  assert.equal(requests[1], `./epg-cache.php?url=${encodeURIComponent(OPEN_EPG_ITALY_URLS[0])}`);
  assert.equal(schedule.programmes[0].title, "Live news");
});

test("groups GlobeTV guide sources by country with persistent diagnostics", () => {
  const url = "https://raw.githubusercontent.com/globetvapp/epg/main/Italy/italy1.xml";
  assert.deepEqual(globeTvCountryFromUrl(url), { id: "Italy", name: "Italy", file: "italy1.xml" });
  assert.equal(groupGuideSources([url], [{ url, state: "ready", matchedChannels: 12 }])[0].sources[0].matchedChannels, 12);
});

test("GlobeTV catalog loads countries once and lazily requests plain XML files", async () => {
  const settings = new Map();
  const requests = [];
  const catalog = {
    getSetting: async (key, fallback) => settings.has(key) ? settings.get(key) : fallback,
    setSetting: async (key, value) => { settings.set(key, value); return value; },
  };
  const service = new GlobeTvCatalog({ catalog, fetchImpl: async (url) => {
    requests.push(url);
    return new Response(JSON.stringify(url.endsWith('/Italy')
      ? [{ type: 'file', name: 'italy1.xml', size: 10, download_url: 'https://raw.test/italy1.xml' }, { type: 'file', name: 'italy1.xml.gz', download_url: 'https://raw.test/italy1.xml.gz' }]
      : [{ type: 'dir', name: 'Italy', url: 'https://api.test/Italy', html_url: 'https://github.test/Italy' }, { type: 'file', name: 'README.md' }]));
  } });
  assert.equal((await service.countries())[0].name, 'Italy');
  assert.equal((await service.countries())[0].name, 'Italy');
  assert.deepEqual(await service.country('Italy'), [{ name: 'italy1.xml', url: 'https://raw.test/italy1.xml', size: 10 }]);
  assert.equal(requests.length, 2);
});
