const DEFAULT_ENDPOINT = './installation-api.php';
const SYNC_SETTINGS = new Set(['proxy', 'epg:sources', 'epg:refreshMinutes']);

function cleanSource(source) {
  if (!source?.sourceId || !source?.url) return null;
  return {
    sourceId: String(source.sourceId),
    kind: 'url',
    name: String(source.name || 'Playlist'),
    url: String(source.url),
    trusted: Boolean(source.trusted),
    createdAt: Number(source.createdAt) || Date.now(),
  };
}

function cleanFavorite(value) {
  const channelId = String(value?.channelId || value?.id || value || '').trim();
  return channelId ? { id: channelId, channelId, createdAt: Number(value?.createdAt) || Date.now() } : null;
}

export function installationPayload({ sources = [], favorites = [], settings = {} } = {}) {
  return {
    version: 1,
    sources: sources.map(cleanSource).filter(Boolean),
    favorites: favorites.map(cleanFavorite).filter(Boolean),
    settings: Object.fromEntries([...SYNC_SETTINGS].filter((key) => Object.prototype.hasOwnProperty.call(settings, key)).map((key) => [key, settings[key]])),
  };
}

export class InstallationSync {
  #endpoint;
  #fetch;
  #revision = '';
  #supported = true;

  constructor({ endpoint = DEFAULT_ENDPOINT, fetchImpl = globalThis.fetch } = {}) {
    this.#endpoint = endpoint;
    this.#fetch = fetchImpl;
  }

  get supported() { return this.#supported; }
  get revision() { return this.#revision; }

  async load() {
    if (!this.#supported || typeof this.#fetch !== 'function') return null;
    try {
      const response = await this.#fetch(this.#endpoint, { credentials: 'same-origin', cache: 'no-store' });
      if (response.status === 404 || response.status === 405) {
        this.#supported = false;
        return null;
      }
      if (!response.ok) throw new Error(`Installation sync failed (${response.status})`);
      const payload = await response.json();
      this.#revision = String(payload.revision || '');
      return { ...installationPayload(payload), updatedAt: Number(payload.updatedAt) || 0 };
    } catch (error) {
      if (error instanceof SyntaxError) this.#supported = false;
      return null;
    }
  }

  async save(payload, { retryConflict = true } = {}) {
    if (!this.#supported || typeof this.#fetch !== 'function') return null;
    const body = installationPayload(payload);
    const response = await this.#fetch(this.#endpoint, {
      method: 'PUT',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        ...(this.#revision ? { 'If-Match': this.#revision } : {}),
      },
      body: JSON.stringify(body),
    });
    if (response.status === 404 || response.status === 405) {
      this.#supported = false;
      return null;
    }
    if (response.status === 409) {
      if (!retryConflict) throw new Error('Installation sync conflict persisted after reload');
      this.#revision = '';
      await this.load();
      return this.save(body, { retryConflict: false });
    }
    if (!response.ok) throw new Error(`Installation sync failed (${response.status})`);
    const saved = await response.json();
    this.#revision = String(saved.revision || '');
    return installationPayload(saved);
  }
}

export { SYNC_SETTINGS };
