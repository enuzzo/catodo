// Curated works are separate from user-imported live channels and shared state.
export const THEATRE_FAVORITES_KEY = 'catodo:theatre:favorites:v1';

export function filterTheatre(titles, { filter = 'all', collection = [], language = '', query = '', favorites = [] } = {}) {
  const saved = new Set(favorites);
  const needle = String(query).trim().toLocaleLowerCase('en');
  return titles.filter((title) => {
    if (title.decision !== 'usable') return false;
    if (collection.length && !collection.includes(title.id)) return false;
    if (filter === 'favorited' && !saved.has(title.id)) return false;
    if (!['all', 'favorited'].includes(filter) && !title.genres.includes(filter)) return false;
    if (language && !title.languages.includes(language)) return false;
    return !needle || [title.title, title.creator, title.synopsis, ...title.genres]
      .join(' ').toLocaleLowerCase('en').includes(needle);
  });
}

/** Pick within the visible collection, avoiding the current film whenever possible. */
export function randomTheatreTitle(titles, currentId, random = Math.random) {
  const candidates = titles.filter((title) => title.decision === 'usable' && title.id !== currentId);
  if (!candidates.length) return null;
  return candidates[Math.floor(random() * candidates.length)];
}

export function readTheatreFavorites(storage, titles) {
  try {
    const saved = JSON.parse(storage?.getItem(THEATRE_FAVORITES_KEY) || '[]');
    const known = new Set(titles.map((title) => title.id));
    return Array.isArray(saved) ? [...new Set(saved.filter((id) => known.has(id)))] : [];
  } catch { return []; }
}

export function saveTheatreFavorites(storage, favorites) {
  try {
    if (!storage) return false;
    storage.setItem(THEATRE_FAVORITES_KEY, JSON.stringify([...new Set(favorites)]));
    return true;
  } catch { return false; }
}

export function theatreTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const value = Math.floor(seconds);
  return value >= 3600
    ? `${Math.floor(value / 3600)}:${String(Math.floor(value / 60) % 60).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
    : `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}
