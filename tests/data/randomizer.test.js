import test from "node:test";
import assert from "node:assert/strict";
import { randomPlayable, randomWorld, countryStats } from "../../src/data/randomizer.js";
const channels = [
  { channelId: "it-1", countries: ["IT"], categories: ["News"], sources: ["a"], endpoints: [{ url: "a", kind: "hls" }] },
  { channelId: "it-2", countries: ["IT"], categories: ["Music"], sources: ["a"], endpoints: [{ url: "b", kind: "hls" }] },
  { channelId: "ch-1", countries: ["CH"], categories: ["News"], sources: ["b"], endpoints: [{ url: "c", kind: "hls" }] },
  { channelId: "dead", countries: ["US"], categories: ["News"], sources: ["c"], endpoints: [{ url: "rtmp://x", kind: "rtmp" }] },
];

test("random playable skips current and unsupported endpoints", () => {
  const selected = randomPlayable(channels, { currentChannelId: "it-1", rng: () => 0 });
  assert.equal(selected.channelId, "it-2");
});

test("world randomization samples a country stratum before a channel", () => {
  assert.equal(randomWorld(channels, { rng: () => 0.99 }).channelId, "ch-1");
});

test("country stats report playable channels and endpoints", () => {
  const stats = countryStats(channels);
  assert.deepEqual(stats.find((item) => item.country === "IT"), { country: "IT", channels: 2, playable: 2, endpoints: 2, languages: [], categories: ["News", "Music"] });
});
