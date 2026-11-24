import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { prepareArchiveIndex, prepareArchiveRecordings, selectArchivePage, archiveThumbnail, safeArchiveLink } from '../../src/data/theatre-archive-model.js';
import { prepareFeatured } from '../../src/data/theatre-featured-model.js';
import { shuffleTvPrograms, theatreTvPrograms } from '../../src/data/theatre-tv-model.js';
import { THEATRE_TITLES } from '../../src/data/theatre-catalog.js';

const entry = (id, extras = {}) => ({ id, title: 'Café mystery', year: 1940, genres: ['horror'], sources: [{ provider: 'archive', url: `https://archive.org/details/${id}` }], ...extras });
const fixture = (records) => ({ manifest: { schema: 1, records: records.length, generatedAt: '2026-09-22T12:00:00Z', sourceCounts: { archive: records.length }, sources: [{ id: 'archive', url: 'https://archive.org/details/feature_films' }] }, records });

test('archive card links select the matching edition and leave shared items at their source', () => {
  const media = (item, file) => ({ url: `https://archive.org/download/${item}/${file}.mp4` });
  const film = { id: 'a', decision: 'usable', editions: [media('first', 'a'), media('second', 'a'), media('anthology', 'a')] };
  const other = { id: 'b', decision: 'usable', editions: [media('anthology', 'b')] };
  const { records } = prepareArchiveIndex(fixture(['second', 'anthology'].map((id) => entry(id, { archiveId: id }))), [film, other]);
  assert.equal(records[0].reviewed.id, film.id);
  assert.equal(records[0].editionIndex, 1);
  assert.equal(records[1].reviewed, undefined);
});

test('directory extraction handles nested markup, categories and rights safely', () => {
  const result = spawnSync('python3', ['-B', 'tests/data/theatre-index-parser.py'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
});

test('only an exact approved edition links discovery to playback', () => {
  const titles = [{ id: 'reviewed', decision: 'usable', editions: [{ url: 'https://archive.org/download/approved/movie.mp4' }] }];
  const { records } = prepareArchiveIndex(fixture([entry('a', { archiveId: 'approved' }), entry('b', { archiveId: 'another-upload', rights: { status: 'cc' } })]), titles);
  assert.equal(records[0].reviewed.id, 'reviewed');
  assert.equal(records[1].reviewed, undefined);
  assert.equal(selectArchivePage(records, { rights: 'reviewed' }).total, 1);
  assert.equal(selectArchivePage(records, { playableOnly: true }).total, 1);
  assert.equal(selectArchivePage(records, { playableOnly: true, rights: 'cc' }).total, 0);
});

test('untrusted links and image hosts cannot escape the source allowlist', () => {
  for (const link of ['javascript:alert(1)', 'https://archive.org.evil.test/', 'https://user:pass@archive.org/a', 'http://archive.org/a', 'https://archive.org:123/a']) assert.equal(safeArchiveLink(link), null);
  const record = entry('a', { image: { url: 'https://evil.test/image.jpg', sourceUrl: 'https://publicdomainmovies.info/a' } });
  assert.equal(archiveThumbnail(record), null);
  record.image.url = 'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg';
  assert.equal(archiveThumbnail(record).remote, true);
  record.image.url = 'https://i.ytimg.com/arbitrary-path';
  assert.equal(archiveThumbnail(record), null);
});

test('malformed snapshots fail closed', () => {
  assert.throws(() => prepareArchiveIndex(fixture([entry('duplicate'), entry('duplicate')])));
  assert.throws(() => prepareArchiveIndex(fixture([entry('a', { sources: [{ provider: 'archive', url: 'https://evil.test/' }] })])));
  const invalid = fixture([entry('a')]); invalid.manifest.records = 10;
  assert.throws(() => prepareArchiveIndex(invalid));
});

test('weighted rating dampens tiny samples and filters preserve missing ratings', () => {
  const { records } = prepareArchiveIndex(fixture([entry('single', { rating: { value: 5, count: 1 } }), entry('many', { rating: { value: 4.8, count: 20 } }), entry('unrated')]));
  assert.deepEqual(selectArchivePage(records).records.map(({ id }) => id), ['many', 'single', 'unrated']);
  assert.equal(selectArchivePage(records, { minVotes: 10, minRating: 4.5 }).total, 1);
  assert.equal(selectArchivePage(records, { query: 'cafe mystery', genre: 'horror', source: 'archive', decade: '1940' }).total, 3);
  assert.equal(selectArchivePage(records, { source: 'pdm' }).total, 0);
});

test('pagination is bounded and filters are applied before page slicing', () => {
  const { records } = prepareArchiveIndex(fixture(Array.from({ length: 50 }, (_, i) => entry(`item-${i}`, { year: i < 5 ? null : 1940 }))));
  assert.equal(selectArchivePage(records).records.length, 24);
  const last = selectArchivePage(records, { page: 999 });
  assert.equal(last.page, 3); assert.equal(last.records.length, 2);
  assert.equal(selectArchivePage(records, { decade: 'unknown' }).total, 5);
  const empty = selectArchivePage(records, { query: 'no matches', page: 3 });
  assert.equal(empty.page, 1); assert.equal(empty.records.length, 0);
});

test('published snapshot reconciles source coverage and keeps reviews separate', () => {
  const raw = JSON.parse(readFileSync(new URL('../../public/theatre/archive-index.json', import.meta.url)));
  const { records, manifest } = prepareArchiveIndex(raw, THEATRE_TITLES);
  assert.equal(manifest.archiveCursorExhausted, true);
  assert.equal(records.filter((r) => r.sources.some((s) => s.provider === 'archive')).length, manifest.sourceCounts.archive);
  assert.equal(records.filter((r) => r.sources.some((s) => s.provider === 'pdm')).length, manifest.sourceCounts.pdm);
  assert.equal(Object.values(manifest.sourceCounts).reduce((a, b) => a + b, 0) - manifest.mergedExactArchiveReferences, records.length);
  for (const record of records) {
    assert.ok(record.sources.length > 0);
    if (record.reviewed) assert.equal(record.reviewed.decision, 'usable');
    if (record.archiveId || record.image) assert.ok(archiveThumbnail(record));
    assert.equal(Object.hasOwn(record, 'editions'), false);
  }
});

test('the recording supplement adds canonical Archive links and merges exact identities', () => {
  const raw = JSON.parse(readFileSync(new URL('../../public/theatre/archive-index.json', import.meta.url)));
  const supplemental = prepareArchiveRecordings(JSON.parse(readFileSync(new URL('../../public/theatre/archive-recordings.json', import.meta.url))));
  const ids = new Set(supplemental.records.map(({ archiveId }) => archiveId));
  const { records } = prepareArchiveIndex(raw, [], supplemental.records);
  const references = records.filter(({ archiveId }) => ids.has(archiveId));
  assert.equal(references.length, ids.size);
  for (const record of references) {
    assert.ok(record.sources.some(({ provider, url }) => provider === 'archive' && url === `https://archive.org/details/${record.archiveId}`));
    assert.equal(record.reviewed, undefined);
  }
  const cyber = selectArchivePage(records, { query: 'Cyber Privacy', genre: 'retro-technology' }).records;
  assert.ok(cyber.some(({ archiveId, title }) => archiveId === 'CyberPri98' && title === 'Cyber Privacy'));
});

test('invalid or repeated Archive identities reject the recording supplement', () => {
  const item = entry('ia:sample', { archiveId: 'sample' });
  const supplemental = { schema: 1, generatedAt: '2026-11-23T05:58:37Z', records: [item] };
  assert.equal(prepareArchiveRecordings(supplemental).records.length, 1);
  assert.throws(() => prepareArchiveRecordings({ ...supplemental, records: [item, item] }), /Invalid Archive recording/);
  assert.throws(() => prepareArchiveRecordings({ ...supplemental, records: [{ ...item, id: 'ia:..', archiveId: '..' }] }), /Invalid Archive recording/);
});

test('CATODO TV shuffles only already enabled Archive editions found in the recordings index', () => {
  const read = (name) => JSON.parse(readFileSync(new URL(`../../public/theatre/${name}`, import.meta.url)));
  const { records } = prepareArchiveRecordings(read('archive-recordings.json'));
  const featured = prepareFeatured(read('featured-research.json'));
  const programs = theatreTvPrograms(featured.records, records);
  assert.ok(programs.length > 1 && programs.length < featured.records.length);
  const shuffled = shuffleTvPrograms(programs, () => 0);
  assert.deepEqual(new Set(shuffled), new Set(programs));
  assert.notDeepEqual(shuffled, programs);
  const [program] = programs;
  const editionUrl = new URL(program.record.editions[program.editionIndex].url);
  assert.equal(editionUrl.hostname, 'archive.org');
  assert.deepEqual(theatreTvPrograms([program.record], [{ archiveId: 'different-edition' }]), []);
});
