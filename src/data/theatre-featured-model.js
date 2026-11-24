import { FILM_EDITORIAL } from './theatre-editorial.js';
import { loadTheatreJson } from './theatre-json.js';

/** Source declarations and technical playback availability are separate facts. */
export function featuredLink(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; }
  catch { return null; }
}

export function featuredMedia(value) {
  const safe = featuredLink(value);
  if (!safe) return null;
  const url = new URL(safe);
  return ((url.hostname === 'archive.org' && url.pathname.startsWith('/download/'))
    || (url.hostname === 'upload.wikimedia.org' && url.pathname.startsWith('/wikipedia/commons/')))
    && /\.(mp4|webm|mov)$/i.test(url.pathname) ? safe : null;
}

function sourceImage(image) {
  const url = featuredLink(image?.url);
  const sourceUrl = featuredLink(image?.sourceUrl);
  if (!url || !sourceUrl || !image.credit) return null;
  const host = new URL(url).host;
  if (!['archive.org', 'upload.wikimedia.org', 'thumb.wikimedia.org', 'film-makerscoop.com', 'd32gva8s8jjsl4.cloudfront.net'].includes(host)) return null;
  return { url, sourceUrl, credit: image.credit, kind: image.kind, width: image.width, height: image.height };
}

export function featuredPlaybackTitle(record) {
  if (!record?.editions?.length) return null;
  return { id: `featured:${record.id}`, title: record.title, decision: 'usable', editions: record.editions };
}

export function featuredReportUrl(record) {
  const url = new URL('https://github.com/enuzzo/catodo/issues/new');
  url.searchParams.set('title', `Content report: ${record.title}`);
  url.searchParams.set('body', `Film: ${record.title}\nCATODO ID: ${record.id}\nSource: ${record.sourceUrl || ''}\n\nPlease describe the playback, attribution or rights issue and supporting public evidence. Do not include private personal information or credentials.\n`);
  return url.href;
}

export async function loadFeaturedCatalog(options = {}) {
  const [catalog, artwork] = await Promise.all([
    loadTheatreJson('featured-research.json', { ...options, limit: 2_000_000 }),
    loadTheatreJson('featured-artwork.json', { ...options, limit: 500_000 }).catch(() => null),
  ]);
  return prepareFeatured(catalog, artwork);
}

export function prepareFeatured(payload, artwork) {
  if (payload?.schemaVersion !== 2 || payload.kind !== 'editorial-playback' || !Array.isArray(payload.records)
    || payload.records.length > 1000 || !Array.isArray(payload.collections)) throw new Error('Invalid Featured catalog');
  const seen = new Set();
  const records = payload.records.map((record) => {
    if (typeof record.id !== 'string' || seen.has(record.id) || typeof record.title !== 'string'
      || !['creators', 'genres', 'languages', 'collections', 'editions'].every((key) => Array.isArray(record[key]))) throw new Error('Invalid Featured record');
    seen.add(record.id);
    const editions = record.editions.map((edition) => {
      const url = featuredMedia(edition.url), sourceUrl = featuredLink(edition.sourceUrl);
      if (!url || !sourceUrl || typeof edition.label !== 'string') throw new Error('Invalid Featured edition');
      return { url, sourceUrl, label: edition.label, duration: edition.duration, audio: edition.audio };
    });
    if (!editions.length || editions.length > 8) throw new Error('Missing Featured edition');
    const entry = artwork?.schemaVersion === 1 && artwork.works?.[record.id];
    const matchingArt = entry?.edition === editions[0].url ? entry : null;
    return { id: record.id, rank: record.rank, title: record.title, year: record.year,
      editions, attribution: record.attribution, license: record.license, licenseUrl: featuredLink(record.licenseUrl),
      creators: record.creators, genres: record.genres, languages: record.languages, collections: record.collections,
      synopsis: record.synopsis, hook: FILM_EDITORIAL.get(record.id)?.note ?? record.hook, contentNote: record.contentNote,
      sourceUrl: featuredLink(record.sourceUrl), editionNote: record.editionNote,
      rightsStatus: record.rightsStatus, rightsNote: record.rightsNote,
      rightsSources: (record.rightsSources || []).map(featuredLink).filter(Boolean),
      image: sourceImage(matchingArt?.image) || sourceImage(record.image), frame: sourceImage(matchingArt?.frame) };
  });
  return { records, collections: payload.collections };
}

export function selectFeatured(records, { query = '', collection = '', genre = '', language = '', sort = 'editorial', page = 1 } = {}) {
  const needle = String(query).trim().toLocaleLowerCase('en');
  const matches = records.filter((r) => (!collection || r.collections.includes(collection))
    && (!genre || r.genres.includes(genre)) && (!language || r.languages.includes(language))
    && (!needle || [r.title, ...r.creators, r.synopsis].join(' ').toLocaleLowerCase('en').includes(needle)));
  matches.sort((a, b) => {
    if (sort === 'title') return a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }) || a.rank - b.rank;
    if (['oldest', 'newest'].includes(sort)) {
      const validA = Number.isFinite(a.year) && a.year > 0, validB = Number.isFinite(b.year) && b.year > 0;
      if (validA !== validB) return validA ? -1 : 1;
      if (validA && a.year !== b.year) return (sort === 'oldest' ? 1 : -1) * (a.year - b.year);
    }
    if (sort === 'editorial') {
      const difference = (FILM_EDITORIAL.get(a.id)?.rank ?? Infinity) - (FILM_EDITORIAL.get(b.id)?.rank ?? Infinity);
      if (difference) return difference;
    }
    return a.rank - b.rank;
  });
  const pages = Math.max(1, Math.ceil(matches.length / 24));
  const current = Math.max(1, Math.min(pages, Math.floor(Number(page) || 1)));
  return { records: matches.slice((current - 1) * 24, current * 24), total: matches.length, pages, page: current };
}
