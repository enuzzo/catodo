export const HOME_FAVORITES_LIMIT = 18;
export const HOME_SUGGESTIONS_LIMIT = 6;

export function selectInitialHomeChannel({ favorites = [], pickRandom, fallback = null, rng = Math.random } = {}) {
  const values = Array.isArray(favorites) ? favorites.filter(Boolean) : [];
  if (values.length) {
    const index = Math.min(values.length - 1, Math.floor(rng() * values.length));
    return values[index];
  }
  return (typeof pickRandom === 'function' ? pickRandom() : null) || fallback || null;
}
