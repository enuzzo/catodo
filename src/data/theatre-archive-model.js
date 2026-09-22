/** Discovery metadata is never a playback allowlist. Ratings belong to IA items. */
export const ARCHIVE_PAGE_SIZE = 24;
export const ARCHIVE_PROVIDERS = { archive: 'Internet Archive', pdm: 'Public Domain Movies', openculture: 'Open Culture' };
export const ARCHIVE_GENRES = {
  horror: 'Horror', 'science-fiction': 'Science fiction', noir: 'Film noir', comedy: 'Comedy',
  drama: 'Drama', documentary: 'Documentary', animation: 'Animation', western: 'Westerns',
  thriller: 'Thriller', action: 'Action', adventure: 'Adventure', fantasy: 'Fantasy',
  romance: 'Romance', musical: 'Musicals', war: 'War & propaganda', silent: 'Silent cinema',
  'comedy-drama': 'Comedy & drama collections', 'noir-horror-thriller': 'Noir, horror & thriller collections',
  'martial-arts': 'Martial arts', unclassified: 'Not categorized',
};
const plain = (value, limit = 240) => String(value ?? '').replace(/[\u0000-\u001f\u202a-\u202e\u2066-\u2069]/g, ' ').slice(0, limit);
const imageHosts = new Set(['publicdomainmovies.info', 'www.publicdomainmovies.info', 'i0.wp.com', 'i1.wp.com', 'i2.wp.com', 'i.ytimg.com']);

export function safeArchiveLink(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    if (!['archive.org', 'www.archive.org', 'publicdomainmovies.info', 'www.openculture.com', 'openculture.com', 'creativecommons.org', 'www.creativecommons.org'].includes(url.hostname)) return null;
    return url.href;
  } catch { return null; }
}

export function archiveThumbnail(record) {
  if (record.reviewed?.artwork?.src) return { ...record.reviewed.artwork, remote: false };
  if (record.archiveId) return { src: `https://archive.org/services/img/${record.archiveId}`, credit: 'Internet Archive', sourceUrl: `https://archive.org/details/${record.archiveId}`, remote: true };
  try {
    const url = new URL(record.image?.url);
    const sourceUrl = safeArchiveLink(record.image?.sourceUrl);
    if (url.protocol === 'https:' && !url.username && !url.password && !url.port && imageHosts.has(url.hostname) && sourceUrl) {
      if (url.hostname === 'i.ytimg.com' && !/^\/vi\/[A-Za-z0-9_-]{11}\/hqdefault\.jpg$/.test(url.pathname)) return null;
      return { src: url.href, credit: url.hostname === 'i.ytimg.com' ? 'YouTube / Open Culture' : 'Public Domain Movies', sourceUrl, remote: true };
    }
  } catch { /* A typographic card is the honest fallback. */ }
  return null;
}

export function prepareArchiveIndex(data, reviewedTitles = []) {
  if (data?.manifest?.schema !== 1 || !Array.isArray(data.records) || data.records.length > 100_000 || data.manifest.records !== data.records.length) {
    throw new Error('Invalid archive index');
  }
  if (!/^\d{4}-\d{2}-\d{2}T/.test(data.manifest.generatedAt) || !Array.isArray(data.manifest.sources)
    || data.manifest.sources.some((source) => !Object.hasOwn(ARCHIVE_PROVIDERS, source.id) || !safeArchiveLink(source.url) || !Number.isSafeInteger(data.manifest.sourceCounts?.[source.id]))) throw new Error('Invalid archive manifest');
  const reviewed = new Map();
  for (const title of reviewedTitles.filter((item) => item.decision === 'usable')) {
    for (const edition of title.editions) {
      const url = new URL(edition.url);
      if (url.hostname === 'archive.org' && url.pathname.startsWith('/download/')) reviewed.set(decodeURIComponent(url.pathname.split('/')[2]), title);
    }
  }
  const ids = new Set();
  const records = data.records.map((raw) => {
    if (!raw || typeof raw.id !== 'string' || ids.has(raw.id) || !Array.isArray(raw.sources)) throw new Error('Invalid archive record');
    ids.add(raw.id);
    const record = { id: plain(raw.id), title: plain(raw.title), year: Number.isInteger(raw.year) && raw.year >= 1880 && raw.year <= 2099 ? raw.year : null,
      genres: [...new Set((raw.genres || []).filter((genre) => Object.hasOwn(ARCHIVE_GENRES, genre)))],
      kind: ['film', 'episode', 'trailer', 'collection'].includes(raw.kind) ? raw.kind : 'film',
      creators: (raw.creators || []).slice(0, 3).map((creator) => plain(creator, 120)),
      languages: (raw.languages || []).slice(0, 3).map((language) => plain(language, 35)),
      sources: raw.sources.flatMap((source) => Object.hasOwn(ARCHIVE_PROVIDERS, source.provider) && safeArchiveLink(source.url) ? [{ provider: source.provider, url: safeArchiveLink(source.url) }] : []),
      rights: { status: ['cc', 'public-domain', 'public-domain-us'].includes(raw.rights?.status) ? raw.rights.status : 'unknown', label: plain(raw.rights?.label, 120), url: safeArchiveLink(raw.rights?.url) },
      downloads: Math.max(0, Math.min(Number(raw.downloads) || 0, 1e12)), image: raw.image,
    };
    if (!record.title || !record.sources.length) throw new Error('Archive entry lacks a title or source');
    if (!record.genres.length) record.genres = ['unclassified'];
    if (typeof raw.archiveId === 'string' && /^[A-Za-z0-9_.-]{1,200}$/.test(raw.archiveId)) record.archiveId = raw.archiveId;
    if (Number.isFinite(raw.rating?.value) && raw.rating.value > 0 && raw.rating.value <= 5 && Number.isSafeInteger(raw.rating.count) && raw.rating.count > 0) record.rating = raw.rating;
    record.reviewed = reviewed.get(record.archiveId);
    record.search = [record.title, record.year, ...record.creators, ...record.genres.map((genre) => ARCHIVE_GENRES[genre]), record.archiveId].join(' ').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
    return record;
  });
  return { manifest: data.manifest, records };
}

export function archiveRatingScore(record) {
  // Ten prior reviews at 3.5 dampen tiny samples. IA's review count can include
  // text-only reviews, so this is a ranking heuristic, not a count of star votes.
  return record.rating ? (record.rating.value * record.rating.count + 35) / (record.rating.count + 10) : -1;
}

export function selectArchivePage(records, state = {}) {
  const words = String(state.query || '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().trim().split(/\s+/).filter(Boolean);
  const found = records.filter((record) => {
    if (state.genre && !record.genres.includes(state.genre)) return false;
    if (state.source && !record.sources.some((source) => source.provider === state.source)) return false;
    if (state.rights === 'reviewed' ? !record.reviewed : state.rights && record.rights.status !== state.rights) return false;
    if (state.kind && record.kind !== state.kind) return false;
    if (state.decade && (state.decade === 'unknown' ? record.year !== null : Math.floor(record.year / 10) * 10 !== Number(state.decade))) return false;
    if (Number(state.minVotes) && (record.rating?.count || 0) < Number(state.minVotes)) return false;
    if (Number(state.minRating) && (record.rating?.value || 0) < Number(state.minRating)) return false;
    return words.every((word) => record.search.includes(word));
  });
  found.sort((a, b) => {
    let order = 0;
    if (state.sort === 'title') order = a.title.localeCompare(b.title, 'en');
    else if (state.sort === 'oldest') order = (a.year || 9999) - (b.year || 9999);
    else if (state.sort === 'newest') order = (b.year || 0) - (a.year || 0);
    else if (state.sort === 'popular') order = b.downloads - a.downloads;
    else order = archiveRatingScore(b) - archiveRatingScore(a);
    return order || (b.rating?.count || 0) - (a.rating?.count || 0) || a.id.localeCompare(b.id, 'en');
  });
  const pages = Math.max(1, Math.ceil(found.length / ARCHIVE_PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Math.floor(Number(state.page) || 1)));
  return { total: found.length, pages, page, records: found.slice((page - 1) * ARCHIVE_PAGE_SIZE, page * ARCHIVE_PAGE_SIZE) };
}
