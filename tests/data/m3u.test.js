import test from "node:test";
import assert from "node:assert/strict";
import { parseM3U, mergeChannelRecords } from "../../src/data/m3u.js";
test("M3U parser preserves IPTV metadata and endpoint directives", () => {
  const playlist = `\uFEFF#EXTM3U
#EXTINF:-1 tvg-id="News.One" tvg-name="News One" tvg-logo="https://img.test/one.png" tvg-country="IT;CH" tvg-language="Italian;German" tvg-category="News;Business" group-title="World News" tvg-geo-blocked="true" tvg-not-24-7="1",News One HD
#EXTVLCOPT:http-user-agent=Catodo Test
#EXTVLCOPT:http-referrer=https://origin.test/
https://stream.test/live.m3u8
`;
  const [channel] = parseM3U(playlist, { sourceId: "source-a" });
  assert.equal(channel.channelId, "tvg:news.one");
  assert.equal(channel.name, "News One HD");
  assert.equal(channel.logo, "https://img.test/one.png");
  assert.deepEqual(channel.countries, ["IT", "CH"]);
  assert.deepEqual(channel.languages, ["Italian", "German"]);
  assert.deepEqual(channel.categories, ["News", "Business"]);
  assert.equal(channel.groupTitle, "World News");
  assert.equal(channel.geoRestricted, true);
  assert.equal(channel.notAlwaysOn, true);
  assert.equal(channel.source, "source-a");
  assert.equal(channel.endpoint.kind, "hls");
  assert.equal(channel.endpoint.headers["http-user-agent"], "Catodo Test");
  assert.equal(channel.endpoint.referrer, "https://origin.test/");
});

test("M3U parser handles unquoted attributes, CRLF and record limits", () => {
  const text = "#EXTM3U\r\n#EXTINF:-1 tvg-country=US group-title='News',Channel\r\nhttps://test/channel\r\n";
  assert.equal(parseM3U(text)[0].country, "US");
  assert.throws(() => parseM3U(`${text}${text}`, { limits: { maxRecords: 1 } }), RangeError);
});

test("multiple sources merge endpoints without duplication", () => {
  const base = "#EXTINF:-1 tvg-id=station,Station\n";
  const records = [
    ...parseM3U(`${base}https://one.test/live.m3u8`, { sourceId: "a" }),
    ...parseM3U(`${base}https://two.test/live.m3u8`, { sourceId: "b" }),
    ...parseM3U(`${base}https://one.test/live.m3u8`, { sourceId: "a" }),
  ];
  const [merged] = mergeChannelRecords(records);
  assert.deepEqual(merged.sources, ["a", "b"]);
  assert.equal(merged.endpoints.length, 2);
});
