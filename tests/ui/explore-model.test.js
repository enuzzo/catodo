import test from "node:test";
import assert from "node:assert/strict";
import { buildExploreCollections, matchesExploreCategory, pickExploreFeatured } from "../../src/ui/explore-model.js";

const channels = [
  { channelId: "news-it", countryCode: "IT", categories: ["news"] },
  { channelId: "news-us", countryCode: "US", categoryNames: ["Business News"] },
  { channelId: "sport-it", countryCode: "IT", categories: ["sports"] },
  { channelId: "culture-fr", countryCode: "FR", categoryDescriptions: [{ name: "Documentary" }] },
];

test("Explore category matching uses normalized official metadata", () => {
  assert.equal(matchesExploreCategory(channels[1], "news"), true);
  assert.equal(matchesExploreCategory(channels[2], "news"), false);
  assert.equal(matchesExploreCategory(channels[3], "culture"), true);
});

test("Explore builds real non-empty collections and preserves a selected hero", () => {
  const collections = buildExploreCollections(channels, { activeCategory: "all" });
  assert.deepEqual(collections.map((item) => item.id), ["news", "sports", "culture"]);
  assert.equal(pickExploreFeatured(collections, "sport-it").channelId, "sport-it");
});

test("Explore falls back to a country-diverse world rail when a category is empty", () => {
  const [collection] = buildExploreCollections(channels, { activeCategory: "kids", limit: 3 });
  assert.equal(collection.id, "world");
  assert.deepEqual(collection.channels.map((channel) => channel.channelId), ["news-it", "news-us", "culture-fr"]);
});
