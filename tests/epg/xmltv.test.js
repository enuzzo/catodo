import test from "node:test";
import assert from "node:assert/strict";
import { guideChannelIdsFor, parseXmltv, parseXmltvDate, parseXmltvDocument, programmesForChannel } from "../../src/epg/xmltv.js";
import { EpgService, guideUrlsForChannels } from "../../src/epg/service.js";
import { epgPresetsForCountry, migrateKnownEpgSources, OPEN_EPG_ITALY_URLS } from "../../src/epg/presets.js";
import { CountryGuideResolver, GlobeTvCatalog, OpenEpgCatalog, globeTvCatalogCountryFor, globeTvCountryFromUrl, groupGuideSources } from "../../src/epg/catalog.js";

function openEpgAge(date = new Date()) {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = String(date.getUTCFullYear()).slice(-2);
  return `${day}-${month}-00${year}`;
}

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

test("on-demand player guide loads only the mapped source and deduplicates concurrent requests", async () => {
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
      await new Promise((resolve) => setTimeout(resolve, 5));
      return new Response("<tv></tv>");
    },
  }).init();
  await service.setSources(["https://guide.test/generic.xml"]);
  const mapped = {
    channelId: "mapped",
    guides: [{ sources: [{ url: "https://guide.test/country.xml", format: "XML" }] }],
  };

  await Promise.all([
    service.schedule(mapped, { preferMapped: true }),
    service.schedule(mapped, { preferMapped: true }),
  ]);
  assert.deepEqual(requests, ["https://guide.test/country.xml"]);

  await service.schedule({ channelId: "manual-only" }, { preferMapped: true });
  assert.deepEqual(requests, [
    "https://guide.test/country.xml",
    "https://guide.test/generic.xml",
  ]);
});

test("country-scoped guide loads do not refetch or overwrite diagnostics for other countries", async () => {
  const settings = new Map();
  const requests = [];
  const italyUrl = "https://guide.test/italy.xml";
  const franceUrl = "https://guide.test/france.xml";
  const catalog = {
    getSetting: async (key, fallback) => settings.has(key) ? settings.get(key) : fallback,
    setSetting: async (key, value) => { settings.set(key, value); return value; },
  };
  const service = await new EpgService({
    catalog,
    fetchImpl: async (url) => {
      requests.push(url);
      const channel = url === italyUrl ? "Rai1.it" : "TF1.fr";
      return new Response(`<tv><channel id="${channel}"><display-name>${channel}</display-name></channel><programme start="20260812140000 +0200" stop="20260812150000 +0200" channel="${channel}"><title>Live</title></programme></tv>`);
    },
  }).init();
  await service.setSources([italyUrl, franceUrl]);
  const window = { from: Date.UTC(2026, 7, 12, 12, 30), to: Date.UTC(2026, 7, 12, 13, 30) };

  await service.schedule({ channelId: "rai-1", tvgId: "Rai1.it" }, { ...window, sourceUrls: [italyUrl] });
  await service.schedule({ channelId: "tf1", tvgId: "TF1.fr" }, { ...window, force: true, sourceUrls: [franceUrl] });

  assert.deepEqual(requests, [italyUrl, franceUrl]);
  assert.equal(service.getSourceStatuses().find((source) => source.url === italyUrl)?.matchedChannels, 1);
  assert.equal(service.getSourceStatuses().find((source) => source.url === franceUrl)?.matchedChannels, 1);
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

test("uses official channel aliases to match provider display names", () => {
  const registry = [{ id: "Canal 24 horas.es", names: ["Canal 24 horas.es"] }];
  assert.deepEqual(guideChannelIdsFor({
    channelId: "24Horas.es",
    tvgId: "24Horas.es",
    name: "24 Horas",
    aliases: ["Canal 24 Horas", "24h"],
  }, registry), ["24Horas.es", "Canal 24 horas.es"]);
});

test("selects one coherent schedule when multiple guide feeds match the same channel", async () => {
  const settings = new Map([["epg:sources", ["https://example.org/sparse.xml", "https://example.org/complete.xml"]]]);
  const catalog = {
    getSetting: async (key, fallback) => settings.has(key) ? settings.get(key) : fallback,
    setSetting: async (key, value) => { settings.set(key, value); return value; },
  };
  const sparse = `<tv>
    <channel id="20.it"><display-name>20 Mediaset</display-name></channel>
    <programme start="20260812120000 +0200" stop="20260812235900 +0200" channel="20.it"><title>All-day placeholder</title></programme>
  </tv>`;
  const complete = `<tv>
    <channel id="20.it"><display-name>20 Mediaset</display-name></channel>
    <programme start="20260812140000 +0200" stop="20260812143000 +0200" channel="20.it"><title>News</title></programme>
    <programme start="20260812143000 +0200" stop="20260812150000 +0200" channel="20.it"><title>Weather</title></programme>
    <programme start="20260812150000 +0200" stop="20260812160000 +0200" channel="20.it"><title>Film</title></programme>
  </tv>`;
  const service = await new EpgService({
    catalog,
    fetchImpl: async (url) => new Response(url.endsWith("complete.xml") ? complete : sparse),
  }).init();
  const schedule = await service.schedule({ channelId: "20", tvgId: "20.it", name: "20 Mediaset" }, {
    from: Date.UTC(2026, 7, 12, 12),
    to: Date.UTC(2026, 7, 12, 14),
  });

  assert.deepEqual(schedule.programmes.map((programme) => programme.title), ["News", "Weather", "Film"]);
  assert.equal(schedule.matched, true);
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

test("routes Open EPG feeds through the authenticated same-origin cache", async () => {
  const settings = new Map([["epg:sources", [OPEN_EPG_ITALY_URLS[0]]]]);
  const catalog = {
    getSetting: async (key, fallback) => settings.has(key) ? settings.get(key) : fallback,
    setSetting: async (key, value) => { settings.set(key, value); return value; },
  };
  const requests = [];
  const service = await new EpgService({ catalog, fetchImpl: async (url) => {
    requests.push(url);
    return new Response(`<tv><channel id="Rai1.it"><display-name>Rai 1</display-name></channel><programme start="20260813140000 +0200" stop="20260813150000 +0200" channel="Rai1.it"><title>Live news</title></programme></tv>`);
  } }).init();
  const schedule = await service.schedule({ channelId: "rai-1", name: "Rai 1" }, {
    from: Date.UTC(2026, 7, 13, 12, 30),
    to: Date.UTC(2026, 7, 13, 13, 30),
  });
  assert.equal(requests[0], `./epg-cache.php?url=${encodeURIComponent(OPEN_EPG_ITALY_URLS[0])}`);
  assert.equal(schedule.programmes[0].title, "Live news");
});

test("routes EPGShare01 country archives through the bounded same-origin cache", async () => {
  const source = "https://epgshare01.online/epgshare01/epg_ripper_ES1.xml.gz";
  const settings = new Map([["epg:sources", [source]]]);
  const catalog = {
    getSetting: async (key, fallback) => settings.has(key) ? settings.get(key) : fallback,
    setSetting: async (key, value) => { settings.set(key, value); return value; },
  };
  const requests = [];
  const service = await new EpgService({ catalog, fetchImpl: async (url) => {
    requests.push(url);
    return new Response(`<tv><channel id="24Horas.es"><display-name>24 Horas</display-name></channel><programme start="20260813140000 +0200" stop="20260813150000 +0200" channel="24Horas.es"><title>Noticias</title></programme></tv>`);
  } }).init();
  const schedule = await service.schedule({ channelId: "24Horas.es", name: "24 Horas" }, {
    from: Date.UTC(2026, 7, 13, 12, 30),
    to: Date.UTC(2026, 7, 13, 13, 30),
  });
  assert.equal(requests[0], `./epg-cache.php?url=${encodeURIComponent(source)}`);
  assert.equal(schedule.programmes[0].title, "Noticias");
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

test("GlobeTV catalog resolves country models to their published feeds", async () => {
  const settings = new Map();
  const catalog = {
    getSetting: async (key, fallback) => settings.has(key) ? settings.get(key) : fallback,
    setSetting: async (key, value) => { settings.set(key, value); return value; },
  };
  const directory = [
    { type: "dir", name: "France", url: "https://api.test/France", html_url: "https://github.test/France" },
    { type: "dir", name: "Germany", url: "https://api.test/Germany", html_url: "https://github.test/Germany" },
    { type: "dir", name: "Korea", url: "https://api.test/Korea", html_url: "https://github.test/Korea" },
  ];
  const service = new GlobeTvCatalog({ catalog, fetchImpl: async (url) => new Response(JSON.stringify(
    url.endsWith("/France")
      ? [{ type: "file", name: "france1.xml", size: 10, download_url: "https://raw.test/france1.xml" }]
      : url.endsWith("/Germany")
        ? [{ type: "file", name: "germany1.xml", size: 20, download_url: "https://raw.test/germany1.xml" }]
        : directory,
  )) });

  assert.deepEqual(await service.countryFor({ code: "FR", name: "France" }), [
    { name: "france1.xml", url: "https://raw.test/france1.xml", size: 10 },
  ]);
  assert.deepEqual(await service.countryFor({ code: "DE", name: "Germany" }), [
    { name: "germany1.xml", url: "https://raw.test/germany1.xml", size: 20 },
  ]);
  assert.equal(globeTvCatalogCountryFor({ code: "KR", name: "South Korea" }, await service.countries()).id, "Korea");
});

test("Open EPG catalog resolves only fresh allowlisted feeds for the selected country", async () => {
  const settings = new Map();
  const requests = [];
  const catalog = {
    getSetting: async (key, fallback) => settings.has(key) ? settings.get(key) : fallback,
    setSetting: async (key, value) => { settings.set(key, value); return value; },
  };
  const service = new OpenEpgCatalog({ catalog, fetchImpl: async (url) => {
    requests.push(url);
    return new Response(JSON.stringify([
      { cou: "Spain 1", url: "https://www.open-epg.com/files/spain1.xml", age: openEpgAge(), cnt: "179" },
      { cou: "Spain 2", url: "https://www.open-epg.com/files/spain2.xml", age: "01-01-0020", cnt: "149" },
      { cou: "France", url: "https://www.open-epg.com/files/france.xml", age: openEpgAge(), cnt: "200" },
      { cou: "Spain bad", url: "https://evil.test/spain.xml", age: openEpgAge(), cnt: "999" },
    ]));
  } });
  assert.deepEqual(await service.countryFor({ code: "ES", name: "Spain" }), [{
    url: "https://www.open-epg.com/files/spain1.xml",
    name: "spain1.xml",
    country: "Spain",
    updatedAt: Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()),
    channelCount: 179,
    provider: "Open EPG",
    countryCode: "ES",
  }]);
  assert.equal(requests[0], "./epg-cache.php?catalog=open-epg");
});

test("country guide resolver combines fresh Open EPG files with the EPGShare01 country fallback", async () => {
  const settings = new Map();
  const catalog = {
    getSetting: async (key, fallback) => settings.has(key) ? settings.get(key) : fallback,
    setSetting: async (key, value) => { settings.set(key, value); return value; },
  };
  const resolver = new CountryGuideResolver({ catalog, fetchImpl: async () => new Response(JSON.stringify([
    { cou: "Spain 1", url: "https://www.open-epg.com/files/spain1.xml", age: openEpgAge(), cnt: "179" },
    { cou: "Spain 2", url: "https://www.open-epg.com/files/spain2.xml", age: openEpgAge(), cnt: "149" },
  ])) });
  assert.deepEqual((await resolver.countryFor({ code: "ES", name: "Spain" })).map((item) => item.url), [
    "https://www.open-epg.com/files/spain1.xml",
    "https://www.open-epg.com/files/spain2.xml",
    "https://epgshare01.online/epgshare01/epg_ripper_ES1.xml.gz",
  ]);
});

test("guide source grouping keeps Open EPG and EPGShare01 country providers identifiable", () => {
  const groups = groupGuideSources([
    "https://www.open-epg.com/files/spain1.xml",
    "https://epgshare01.online/epgshare01/epg_ripper_ES1.xml.gz",
  ]);
  assert.deepEqual(groups.map((group) => [group.id, group.countryCode, group.provider]), [
    ["epgshare:ES", "ES", "EPGShare01"],
    ["open-epg:spain", "", "Open EPG"],
  ]);
});
