const DEFAULT_ENDPOINT = './installation-api.php';
const SYNC_SETTINGS = new Set(['proxy', 'epg:sources', 'epg:refreshMinutes']);
const MAX_EPG_SOURCES = 32;
const EPG_REFRESH_INTERVALS = new Set([0, 30, 60, 360, 1440]);

export class InstallationSyncError extends Error {
  constructor(message, { code = 'INSTALLATION_SYNC_FAILED', status = 0 } = {}) {
    super(message);
    this.name = 'InstallationSyncError';
    this.code = code;
    this.status = status;
  }
}

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

function cleanMigration(value) {
  const status = value?.legacyInstallation === 'complete' ? 'complete' : 'pending';
  return {
    legacyInstallation: status,
    completedAt: status === 'complete' ? Math.max(0, Number(value?.completedAt) || 0) : 0,
  };
}

export function installationPayload({ sources = [], favorites = [], settings = {}, migration } = {}) {
  const sourceValues = Array.isArray(sources) ? sources : [];
  const favoriteValues = Array.isArray(favorites) ? favorites : [];
  const settingValues = settings && typeof settings === 'object' && !Array.isArray(settings) ? settings : {};
  return {
    version: 2,
    sources: sourceValues.map(cleanSource).filter(Boolean),
    favorites: favoriteValues.map(cleanFavorite).filter(Boolean),
    settings: Object.fromEntries([...SYNC_SETTINGS].filter((key) => Object.prototype.hasOwnProperty.call(settingValues, key)).map((key) => [key, settingValues[key]])),
    ...(migration ? { migration: cleanMigration(migration) } : {}),
  };
}

export function mergeInstallationPayloads(remote = {}, local = {}) {
  const server = installationPayload(remote);
  const browser = installationPayload(local);
  const sources = new Map(server.sources.map((source) => [source.sourceId, source]));
  const favorites = new Map(server.favorites.map((favorite) => [favorite.channelId, favorite]));
  browser.sources.forEach((source) => sources.set(source.sourceId, source));
  browser.favorites.forEach((favorite) => favorites.set(favorite.channelId, favorite));
  return installationPayload({
    sources: [...sources.values()],
    favorites: [...favorites.values()],
    // Existing installation settings remain canonical when both sides have a
    // value. Missing server keys are recovered from the browser during the
    // one-time link operation.
    settings: { ...browser.settings, ...server.settings },
    migration: server.migration,
  });
}

function syncError(message, options) {
  return new InstallationSyncError(message, options);
}

function isHttpUrl(value) {
  if (typeof value !== 'string' || value.length > 4096) return false;
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export function assertSharedSetting(key, value) {
  if (key === 'proxy') {
    if (typeof value !== 'string' || value.length > 4096 || (value !== '' && !isHttpUrl(value))) {
      throw syncError('Proxy must be an HTTP or HTTPS URL no longer than 4096 characters', { code: 'INVALID_SETTING' });
    }
  } else if (key === 'epg:sources') {
    if (!Array.isArray(value) || value.length > MAX_EPG_SOURCES || value.some((url) => !isHttpUrl(url))) {
      throw syncError(`TV Guide accepts at most ${MAX_EPG_SOURCES} HTTP or HTTPS sources`, { code: 'INVALID_SETTING' });
    }
  } else if (key === 'epg:refreshMinutes') {
    if (!Number.isInteger(value) || !EPG_REFRESH_INTERVALS.has(value)) {
      throw syncError('Unsupported TV Guide refresh interval', { code: 'INVALID_SETTING' });
    }
  }
  return value;
}

function validResponseState(payload) {
  if (payload?.version !== 2) return false;
  if (!Array.isArray(payload.sources) || !Array.isArray(payload.favorites)) return false;
  if (payload.sources.length > 256 || payload.favorites.length > 10_000) return false;
  if (!payload.settings || typeof payload.settings !== 'object') return false;
  if (Array.isArray(payload.settings) && payload.settings.length !== 0) return false;
  if (!Number.isInteger(payload.updatedAt) || payload.updatedAt < 0) return false;

  const migration = payload.migration;
  if (!migration || !['pending', 'complete'].includes(migration.legacyInstallation)) return false;
  if (!Number.isInteger(migration.completedAt) || migration.completedAt < 0) return false;
  if (migration.legacyInstallation === 'pending' && migration.completedAt !== 0) return false;

  const sourceIds = new Set();
  for (const source of payload.sources) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) return false;
    if (typeof source.sourceId !== 'string' || !source.sourceId || source.sourceId.length > 256) return false;
    if (sourceIds.has(source.sourceId) || !isHttpUrl(source.url)) return false;
    sourceIds.add(source.sourceId);
  }

  const favoriteIds = new Set();
  for (const favorite of payload.favorites) {
    if (!favorite || typeof favorite !== 'object' || Array.isArray(favorite)) return false;
    const id = favorite.channelId || favorite.id;
    if (typeof id !== 'string' || !id || id.length > 256 || favoriteIds.has(id)) return false;
    favoriteIds.add(id);
  }

  const settings = payload.settings;
  const allowedSettings = new Set(SYNC_SETTINGS);
  if (Object.keys(settings).some((key) => !allowedSettings.has(key))) return false;
  if (Object.prototype.hasOwnProperty.call(settings, 'proxy') && settings.proxy !== '' && !isHttpUrl(settings.proxy)) return false;
  if (Object.prototype.hasOwnProperty.call(settings, 'epg:sources')) {
    if (!Array.isArray(settings['epg:sources']) || settings['epg:sources'].length > MAX_EPG_SOURCES) return false;
    if (settings['epg:sources'].some((url) => !isHttpUrl(url))) return false;
  }
  if (Object.prototype.hasOwnProperty.call(settings, 'epg:refreshMinutes')
    && ![0, 30, 60, 360, 1440].includes(settings['epg:refreshMinutes'])) return false;
  return true;
}

function parseResponsePayload(payload, response, { requireRevision = true } = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || !validResponseState(payload)) {
    throw syncError('Installation sync returned an invalid response', {
      code: 'INVALID_RESPONSE', status: response.status,
    });
  }
  const revision = typeof payload.revision === 'string' ? payload.revision : '';
  if (requireRevision && !revision) {
    throw syncError('Installation sync response is missing its revision', {
      code: 'INVALID_RESPONSE', status: response.status,
    });
  }
  return {
    payload: { ...installationPayload(payload), migration: cleanMigration(payload.migration), updatedAt: Number(payload.updatedAt) || 0 },
    revision,
  };
}

async function responseJson(response) {
  try {
    return await response.json();
  } catch {
    throw syncError('Installation sync returned unreadable data', {
      code: 'INVALID_RESPONSE', status: response.status,
    });
  }
}

export class InstallationSync {
  #endpoint;
  #fetch;
  #revision = '';
  #supported = true;
  #loaded = false;

  constructor({ endpoint = DEFAULT_ENDPOINT, fetchImpl = globalThis.fetch } = {}) {
    this.#endpoint = endpoint;
    this.#fetch = fetchImpl;
  }

  get supported() { return this.#supported; }
  get revision() { return this.#revision; }
  get loaded() { return this.#loaded; }

  async load() {
    if (!this.#supported || typeof this.#fetch !== 'function') return null;
    let response;
    try {
      response = await this.#fetch(this.#endpoint, { credentials: 'same-origin', cache: 'no-store' });
    } catch (error) {
      this.#loaded = false;
      throw syncError(`Installation sync could not be reached: ${error?.message || error}`, {
        code: 'NETWORK_ERROR',
      });
    }
    if (response.status === 404 || response.status === 405) {
      this.#supported = false;
      this.#loaded = false;
      this.#revision = '';
      return null;
    }
    if (!response.ok) {
      this.#loaded = false;
      throw syncError(`Installation sync failed (${response.status})`, {
        code: response.status === 401 ? 'AUTH_REQUIRED' : 'LOAD_FAILED',
        status: response.status,
      });
    }
    const parsed = parseResponsePayload(await responseJson(response), response);
    this.#revision = parsed.revision;
    this.#loaded = true;
    return parsed.payload;
  }

  async save(payload) {
    if (!this.#supported || typeof this.#fetch !== 'function') return null;
    if (!this.#loaded || !this.#revision) {
      throw syncError('Installation state must be loaded before it can be saved', {
        code: 'NOT_LOADED',
      });
    }
    const body = installationPayload(payload);
    if (body.sources.length > 256 || body.favorites.length > 10_000 || (body.settings['epg:sources'] || []).length > 32) {
      throw syncError('Installation state exceeds the supported limits', { code: 'PAYLOAD_TOO_LARGE' });
    }
    let response;
    try {
      response = await this.#fetch(this.#endpoint, {
        method: 'PUT',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'If-Match': this.#revision,
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      throw syncError(`Installation state could not be saved: ${error?.message || error}`, {
        code: 'NETWORK_ERROR',
      });
    }
    if (response.status === 404 || response.status === 405) {
      this.#supported = false;
      this.#loaded = false;
      this.#revision = '';
      return null;
    }
    if (response.status === 409) {
      throw syncError('Installation state changed in another browser; reload before saving again', {
        code: 'REVISION_CONFLICT', status: response.status,
      });
    }
    if (!response.ok) {
      throw syncError(`Installation sync failed (${response.status})`, {
        code: response.status === 401 ? 'AUTH_REQUIRED' : 'SAVE_FAILED',
        status: response.status,
      });
    }
    const parsed = parseResponsePayload(await responseJson(response), response);
    this.#revision = parsed.revision;
    this.#loaded = true;
    return parsed.payload;
  }
}

export { MAX_EPG_SOURCES, SYNC_SETTINGS };
