import test from 'node:test';
import assert from 'node:assert/strict';
import { filterTheatre, readTheatreFavorites, saveTheatreFavorites } from '../../src/data/theatre-model.js';
import { THEATRE_TITLES } from '../../src/data/theatre-catalog.js';
import { existsSync } from 'node:fs';

const films = [
  { id: 'one', title: 'First Light', creator: 'Ada', synopsis: 'A telescope story.', genres: ['documentary'], languages: ['en'], decision: 'usable' },
  { id: 'two', title: 'Night', creator: 'Pat', synopsis: 'A journey.', genres: ['drama'], languages: ['it'], decision: 'usable' },
  { id: 'uncleared', title: 'First Draft', creator: 'Ada', synopsis: '', genres: ['documentary'], languages: ['en'], decision: 'conditional' },
];
test('Theatre combines favorites, language and search, and never promotes conditional works', () => {
  assert.deepEqual(filterTheatre(films).map((film) => film.id), ['one', 'two']);
  assert.deepEqual(filterTheatre(films, { filter: 'favorited', favorites: ['one', 'uncleared'], language: 'en', query: 'TELESCOPE' }).map((film) => film.id), ['one']);
  assert.deepEqual(filterTheatre(films, { filter: 'drama', language: 'en' }), []);
});
test('Theatre favorites discard malformed, unknown and duplicate IDs without touching shared state', () => {
  assert.deepEqual(readTheatreFavorites({ getItem: () => '["one","one","missing",null]' }, films), ['one']);
  assert.deepEqual(readTheatreFavorites({ getItem: () => '{broken' }, films), []);
  assert.equal(saveTheatreFavorites({ setItem() { throw Error('quota'); } }, ['one']), false);
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
    assert.match(title.artwork.src, /^\/theatre\/artwork\/[a-z0-9-]+\.jpg$/);
    assert.ok(existsSync(new URL(`../../public${title.artwork.src}`, import.meta.url)));
    for (const key of ['sourceUrl', 'licenseUrl', 'license', 'credit', 'kind', 'note', 'sha256']) assert.ok(title.artwork[key], `${title.id}: artwork ${key}`);
  }
});
