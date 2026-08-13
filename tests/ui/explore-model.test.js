import test from "node:test";
import assert from "node:assert/strict";
import {
  buildExploreCountryOptions,
  buildExploreCollections,
  exploreQualityScore,
  filterExploreChannelsByCountry,
  matchesExploreCategory,
  pickExploreFeatured,
  randomizeExploreChannels,
  sortExploreChannels,
} from "../../src/ui/explore-model.js";

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

test("Explore defaults to Euronews Italian while preserving later user choices", () => {
  const collections = [{
    id: 'news',
    channels: [
      { channelId: 'news-first', name: 'First News' },
      { channelId: 'euronews-it', name: 'Euronews Italian (1080p)' },
      { channelId: 'news-selected', name: 'Selected News' },
    ],
  }];
  assert.equal(pickExploreFeatured(collections).channelId, 'euronews-it');
  assert.equal(pickExploreFeatured(collections, 'news-selected').channelId, 'news-selected');
});

test("Explore keeps a selected empty category honest", () => {
  const [collection] = buildExploreCollections(channels, { activeCategory: "kids", limit: 3 });
  assert.equal(collection.id, "kids");
  assert.deepEqual(collection.channels, []);
});

test("Explore falls back to a country-diverse world collection only when the whole catalog is empty", () => {
  const [collection] = buildExploreCollections([], { activeCategory: "all", limit: 3 });
  assert.equal(collection.id, "world");
  assert.deepEqual(collection.channels, []);
});

test("Explore randomization prefers unseen channels and keeps the requested preview size", () => {
  const values = Array.from({ length: 12 }, (_, index) => ({
    channelId: `channel-${index}`,
    countryCode: `C${index}`,
  }));
  const first = randomizeExploreChannels(values, { limit: 8, rng: () => 0.5 });
  const second = randomizeExploreChannels(values, {
    limit: 8,
    previousIds: first.map((channel) => channel.channelId),
    rng: () => 0.5,
  });
  assert.equal(first.length, 8);
  assert.equal(second.length, 8);
  const unseen = values.filter((channel) => !first.some((item) => item.channelId === channel.channelId));
  assert.deepEqual(
    second.slice(0, unseen.length).map((channel) => channel.channelId).sort(),
    unseen.map((channel) => channel.channelId).sort(),
  );
});

test("Explore sorts complete collections by name, country and descending quality", () => {
  const values = [
    { channelId: 'b', name: 'Beta', country: 'Italy', quality: '720p' },
    { channelId: 'a', name: 'Alpha', country: 'United States', quality: '4K' },
    { channelId: 'c', name: 'Cinema', country: 'France', quality: '1080p' },
  ];
  assert.deepEqual(sortExploreChannels(values, 'name').map((channel) => channel.channelId), ['a', 'b', 'c']);
  assert.deepEqual(sortExploreChannels(values, 'country').map((channel) => channel.channelId), ['c', 'b', 'a']);
  assert.deepEqual(sortExploreChannels(values, 'quality').map((channel) => channel.channelId), ['a', 'c', 'b']);
  assert.equal(exploreQualityScore({ quality: 'Full HD' }), 1080);
});

test("Explore builds category country options and filters without losing the full set", () => {
  const values = [
    { channelId: 'news-it-1', countryCode: 'IT', country: 'Italy' },
    { channelId: 'news-it-2', countryCode: 'it', country: 'Italy' },
    { channelId: 'news-fr', countryCode: 'FR', country: 'France' },
    { channelId: 'news-unknown' },
  ];
  assert.deepEqual(buildExploreCountryOptions(values), [
    { code: 'FR', label: 'France', count: 1 },
    { code: 'IT', label: 'Italy', count: 2 },
  ]);
  assert.deepEqual(
    filterExploreChannelsByCountry(values, 'it').map((channel) => channel.channelId),
    ['news-it-1', 'news-it-2'],
  );
  assert.equal(filterExploreChannelsByCountry(values).length, values.length);
});
