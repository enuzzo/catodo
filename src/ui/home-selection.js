export const HOME_FAVORITES_LIMIT = 18;
export const HOME_SUGGESTIONS_LIMIT = 9;

export function needsFirstPlaylist(snapshot) {
  const sync = snapshot?.installationSync;
  return Boolean(snapshot?.ready && !snapshot.sources.length && !snapshot.channels.length
    && ['synced', 'local-only', 'pending'].includes(sync?.status)
    && !sync.hydrating && !sync.hydrationFailed && !sync.recoveryAvailable);
}

export function selectInitialHomeChannel({ favorites = [], pickRandom, fallback = null, rng = Math.random } = {}) {
  const values = Array.isArray(favorites) ? favorites.filter(Boolean) : [];
  if (values.length) {
    const index = Math.min(values.length - 1, Math.floor(rng() * values.length));
    return values[index];
  }
  return (typeof pickRandom === 'function' ? pickRandom() : null) || fallback || null;
}
