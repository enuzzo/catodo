/** Editorial research is discovery metadata, never an admission to the player. */
export function featuredLink(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; }
  catch { return null; }
}

export function prepareFeatured(payload) {
  if (payload?.schemaVersion !== 1 || payload.kind !== 'editorial-discovery' || !Array.isArray(payload.records)
    || payload.records.length > 1000 || !Array.isArray(payload.collections)) throw new Error('Invalid Featured catalog');
  const seen = new Set();
  const records = payload.records.map((record) => {
    if (typeof record.id !== 'string' || seen.has(record.id) || typeof record.title !== 'string'
      || record.playbackApproved !== false || !['creators', 'genres', 'languages', 'collections'].every((key) => Array.isArray(record[key]))) throw new Error('Invalid Featured record');
    seen.add(record.id);
    // Explicit projection prevents future feed additions from becoming playback URLs.
    return { id: record.id, rank: record.rank, title: record.title, year: record.year,
      creators: record.creators, genres: record.genres, languages: record.languages, collections: record.collections,
      synopsis: record.synopsis, hook: record.hook, contentNote: record.contentNote,
      sourceUrl: featuredLink(record.sourceUrl), editionNote: record.editionNote,
      rightsStatus: record.rightsStatus, rightsNote: record.rightsNote,
      rightsSources: (record.rightsSources || []).map(featuredLink).filter(Boolean),
      image: record.image && featuredLink(record.image.url) && featuredLink(record.image.sourceUrl)
        ? { url: featuredLink(record.image.url), sourceUrl: featuredLink(record.image.sourceUrl), credit: record.image.credit } : null };
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
    return a.rank - b.rank;
  });
  const pages = Math.max(1, Math.ceil(matches.length / 24));
  const current = Math.max(1, Math.min(pages, Math.floor(Number(page) || 1)));
  return { records: matches.slice((current - 1) * 24, current * 24), total: matches.length, pages, page: current };
}
