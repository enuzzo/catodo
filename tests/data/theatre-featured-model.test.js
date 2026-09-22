import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepareFeatured, selectFeatured, featuredLink } from '../../src/data/theatre-featured-model.js';
const raw = JSON.parse(readFileSync(new URL('../../public/theatre/featured-research.json', import.meta.url)));
const data = prepareFeatured(raw);

test('all 305 editorial records remain available without a playback grant or direct media URLs', () => {
  assert.equal(data.records.length, 305); assert.equal(data.collections.length, 12);
  assert.equal(new Set(data.records.map((r) => r.id)).size, 305);
  assert.ok(raw.records.every((r) => r.playbackApproved === false));
  assert.equal(JSON.stringify(raw).includes('archive.org/download/'), false);
  const injected = structuredClone(raw); injected.records[0].mediaUrl = 'https://example.com/film.mp4';
  assert.equal(prepareFeatured(injected).records[0].mediaUrl, undefined);
  injected.records[0].playbackApproved = true; assert.throws(() => prepareFeatured(injected));
});
test('pagination reaches every work once, composes filters, and clamps invalid pages', () => {
  const ids = Array.from({ length: 13 }, (_, i) => selectFeatured(data.records, { page: i + 1 }).records).flat().map((r) => r.id);
  assert.equal(ids.length, 305); assert.equal(new Set(ids).size, 305);
  const selected = selectFeatured(data.records, { collection: 'atomic-age', query: 'duck' });
  assert.equal(selected.total, 1); assert.equal(selected.records[0].id, 'duck-and-cover');
  assert.equal(selectFeatured(data.records, { page: -1 }).page, 1);
  assert.equal(selectFeatured(data.records, { page: 900 }).page, 13);
  assert.equal(selectFeatured(data.records, { query: 'absent-film-000' }).total, 0);
  assert.ok(selectFeatured(data.records, { genre: 'music' }).records.every((r) => r.genres.includes('music')));
});
test('sorting keeps unknown years last and never mutates editorial ordering', () => {
  const records = [{ id: 'a', rank: 1, year: null, title: 'A' }, { id: 'b', rank: 2, year: 1950, title: 'B' }, { id: 'c', rank: 3, year: 1920, title: 'C' }];
  assert.deepEqual(selectFeatured(records, { sort: 'newest' }).records.map((r) => r.id), ['b', 'c', 'a']);
  assert.deepEqual(selectFeatured(records, { sort: 'oldest' }).records.map((r) => r.id), ['c', 'b', 'a']);
  assert.deepEqual(records.map((r) => r.id), ['a', 'b', 'c']);
});
test('incorrect source identities and collection memberships are corrected in published research', () => {
  const record = (id) => raw.records.find((r) => r.id === id);
  assert.equal(record('the-kid').sourceUrl, 'https://www.charliechaplin.com/en/films/1');
  assert.equal(record('the-city-1939').sourceUrl, 'https://archive.org/details/TheCity_201505');
  assert.equal(record('the-city-1939').catalogIds.length, 0);
  assert.ok(!record('hemp-for-victory').collections.includes('moral-panics'));
  assert.ok(!record('terror-of-tiny-town').collections.includes('midnight-monsters'));
  for (const id of ['finding-his-voice', 'steamboat-willie', 'the-big-trail']) assert.ok(!record(id).collections.includes('silent-inventions'));
});
test('source links reject executable schemes and credential-bearing URLs', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,hello', 'http://example.org', 'https://user:pass@example.org', null]) assert.equal(featuredLink(url), null);
  assert.equal(featuredLink('https://archive.org/details/test'), 'https://archive.org/details/test');
});
