import test from "node:test";
import assert from "node:assert/strict";
import { parseXmltv, parseXmltvDate, programmesForChannel } from "../../src/epg/xmltv.js";
import { EpgService } from "../../src/epg/service.js";

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
