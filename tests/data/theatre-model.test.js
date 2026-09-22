import test from 'node:test';
import assert from 'node:assert/strict';
import { filterTheatre, randomTheatreTitle, readTheatreFavorites, saveTheatreFavorites } from '../../src/data/theatre-model.js';
import { THEATRE_TITLES } from '../../src/data/theatre-catalog.js';
import { THEATRE_COLLECTIONS } from '../../src/data/theatre-collections.js';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const films = [
  { id: 'one', title: 'First Light', creator: 'Ada', synopsis: 'A telescope story.', genres: ['documentary'], languages: ['en'], decision: 'usable' },
  { id: 'two', title: 'Night', creator: 'Pat', synopsis: 'A journey.', genres: ['drama'], languages: ['it'], decision: 'usable' },
  { id: 'uncleared', title: 'First Draft', creator: 'Ada', synopsis: '', genres: ['documentary'], languages: ['en'], decision: 'conditional' },
];
test('Theatre combines favorites, language and search, and never promotes conditional works', () => {
  assert.deepEqual(filterTheatre(films).map((film) => film.id), ['one', 'two']);
  assert.deepEqual(filterTheatre(films, { filter: 'favorited', favorites: ['one', 'uncleared'], language: 'en', query: 'TELESCOPE' }).map((film) => film.id), ['one']);
  assert.deepEqual(filterTheatre(films, { filter: 'drama', language: 'en' }), []);
  assert.deepEqual(filterTheatre(films, { collection: ['two', 'uncleared'] }).map((film) => film.id), ['two']);
});
test('Editorial collections reference active, unique titles and combine with favorites', () => {
  const known = new Set(THEATRE_TITLES.map((title) => title.id));
  for (const collection of THEATRE_COLLECTIONS) {
    assert.equal(new Set(collection.ids).size, collection.ids.length);
    assert.ok(collection.ids.every((id) => known.has(id)), collection.id);
    assert.deepEqual(filterTheatre(THEATRE_TITLES, { collection: collection.ids, filter: 'favorited', favorites: [collection.ids[0]] }).map((title) => title.id), [collection.ids[0]]);
  }
});
test('Theatre favorites discard malformed, unknown and duplicate IDs without touching shared state', () => {
  assert.deepEqual(readTheatreFavorites({ getItem: () => '["one","one","missing",null]' }, films), ['one']);
  assert.deepEqual(readTheatreFavorites({ getItem: () => '{broken' }, films), []);
  assert.equal(saveTheatreFavorites({ setItem() { throw Error('quota'); } }, ['one']), false);
});
test('Randomize stays inside the visible collection, avoids repeats and never selects unreviewed films', () => {
  assert.equal(randomTheatreTitle(films, 'one', () => 0).id, 'two');
  assert.equal(randomTheatreTitle(films, 'two', () => .999).id, 'one');
  assert.equal(randomTheatreTitle(filterTheatre(films, { filter: 'drama' }), 'two'), null);
  assert.equal(randomTheatreTitle([], 'one'), null);
});
test('Every active Theatre edition has provenance, original metadata and a local QR asset', () => {
  const ids = new Set();
  for (const title of THEATRE_TITLES) {
    assert.equal(ids.has(title.id), false); ids.add(title.id);
    for (const key of ['title', 'creator', 'synopsis', 'sourceUrl', 'licenseUrl', 'license', 'rights', 'attribution', 'editionNote', 'subtitles']) assert.ok(title[key], `${title.id}: ${key}`);
    assert.equal(title.decision, 'usable'); assert.ok(title.duration > 0);
    assert.ok(title.editions.length > 0); assert.ok(title.genres.length > 0); assert.ok(title.languages.length > 0);
    for (const edition of title.editions) assert.equal(new URL(edition.url).protocol, 'https:');
    assert.ok(existsSync(new URL(`../../public${title.qr}`, import.meta.url)));
    const images = [title.artwork, ...(title.artworks || [])];
    assert.equal(new Set(images.map((image) => image.src)).size, images.length);
    for (const image of images) {
      assert.match(image.src, /^\/theatre\/artwork\/[a-z0-9-]+\.jpg$/);
      const bytes = readFileSync(new URL(`../../public${image.src}`, import.meta.url));
      assert.equal(createHash('sha256').update(bytes).digest('hex'), image.sha256, `${title.id}: artwork provenance hash`);
      for (const key of ['sourceUrl', 'licenseUrl', 'license', 'credit', 'kind', 'note']) assert.ok(image[key], `${title.id}: artwork ${key}`);
      assert.ok(image.width > 0 && image.height > 0);
      if (image.motionAllowed) assert.doesNotMatch(image.license, /ND|NoDerivatives/i, `${title.id}: ND excerpts must remain static`);
    }
  }
});
