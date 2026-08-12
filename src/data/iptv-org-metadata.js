import { get, put, transactionDone } from "./db.js";
import { normalizeTvgId, normalizeUrl } from "./identity.js";

/**
 * Official API contract: https://github.com/iptv-org/api#readme
 *
 * streams.json:  { channel, feed, url }
 * channels.json: { id, country }
 * feeds.json:    { channel, id, is_main, languages[] }
 * languages.json:{ code, name }
 *
 * The persisted cache deliberately contains only the URL/ID lookup keys and the
 * country/language values needed by Catodo, never the full upstream responses.
 */
export const IPTV_ORG_API_URLS = Object.freeze({
  streams: "https://iptv-org.github.io/api/streams.json",
  channels: "https://iptv-org.github.io/api/channels.json",
  feeds: "https://iptv-org.github.io/api/feeds.json",
  languages: "https://iptv-org.github.io/api/languages.json",
});

export const IPTV_ORG_METADATA_CACHE_KEY = "directory:iptv-org-metadata:v1";
export const IPTV_ORG_METADATA_CACHE_VERSION = 1;
export const DEFAULT_IPTV_ORG_METADATA_TTL = 7 * 24 * 60 * 60 * 1000;
export const DEFAULT_IPTV_ORG_METADATA_TIMEOUT = 15_000;

const unique = (values) => [...new Set(values.filter(Boolean))];
const text = (value) => String(value ?? "").normalize("NFKC").trim();
const languageCode = (value) => text(value).toLocaleLowerCase("en-US");

function channelAndFeed(channel, feed) {
  const rawChannel = text(channel);
  const separator = rawChannel.indexOf("@");
  return {
    channel: separator < 0 ? rawChannel : rawChannel.slice(0, separator),
    feed: text(feed) || (separator < 0 ? "" : rawChannel.slice(separator + 1)),
  };
}

function mergeMetadata(previous, next) {
  if (!previous) return next;
  return {
    countries: previous.countries.length ? previous.countries : next.countries,
    languages: previous.languages.length ? previous.languages : next.languages,
  };
}

function compactMetadata(country, languages) {
  const normalizedCountry = text(country).toUpperCase();
  return {
    countries: normalizedCountry ? [normalizedCountry] : [],
    languages: unique(languages.map(text)),
  };
}

function addLanguage(target, key, languages) {
  if (!key) return;
  if (!target.has(key)) target.set(key, []);
  target.set(key, unique([...target.get(key), ...languages]));
}

/** Reduce the four official API resources to the two lookup tables Catodo uses. */
export function reduceIptvOrgMetadata({ streams = [], channels = [], feeds = [], languages = [] } = {}) {
  const languageNames = new Map(languages.map((item) => [languageCode(item?.code), text(item?.name)]).filter(([code, name]) => code && name));
  const translated = (values) => unique((Array.isArray(values) ? values : []).map((value) => languageNames.get(languageCode(value)) || text(value)));
  const countriesByChannel = new Map();
  for (const item of Array.isArray(channels) ? channels : []) {
    const id = normalizeTvgId(item?.id);
    if (id) countriesByChannel.set(id, text(item?.country).toUpperCase());
  }

  const exactFeedLanguages = new Map();
  const mainLanguages = new Map();
  const allLanguages = new Map();
  for (const item of Array.isArray(feeds) ? feeds : []) {
    const channel = normalizeTvgId(item?.channel);
    const feed = normalizeTvgId(item?.id);
    const values = translated(item?.languages);
    if (!channel || !values.length) continue;
    if (feed) addLanguage(exactFeedLanguages, `${channel}\0${feed}`, values);
    if (item?.is_main) addLanguage(mainLanguages, channel, values);
    addLanguage(allLanguages, channel, values);
  }

  const languagesFor = (channel, feed = "") => {
    const exact = feed && exactFeedLanguages.get(`${channel}\0${normalizeTvgId(feed)}`);
    return exact?.length ? exact : (mainLanguages.get(channel) || allLanguages.get(channel) || []);
  };
  const byId = new Map();
  for (const [channel, country] of countriesByChannel) byId.set(channel, compactMetadata(country, languagesFor(channel)));
  for (const [key, values] of exactFeedLanguages) {
    const [channel, feed] = key.split("\0");
    const metadata = compactMetadata(countriesByChannel.get(channel), values);
    byId.set(`${channel}@${feed}`, metadata);
  }

  const byUrl = new Map();
  for (const item of Array.isArray(streams) ? streams : []) {
    const url = normalizeUrl(item?.url);
    const reference = channelAndFeed(item?.channel, item?.feed);
    const channel = normalizeTvgId(reference.channel);
    if (!url || !channel) continue;
    const metadata = compactMetadata(countriesByChannel.get(channel), languagesFor(channel, reference.feed));
    if (!metadata.countries.length && !metadata.languages.length) continue;
    byUrl.set(url, mergeMetadata(byUrl.get(url), metadata));
  }

  return {
    version: IPTV_ORG_METADATA_CACHE_VERSION,
    byUrl: [...byUrl].map(([key, value]) => [key, value.countries, value.languages]),
    byId: [...byId].filter(([, value]) => value.countries.length || value.languages.length).map(([key, value]) => [key, value.countries, value.languages]),
  };
}

function validCompactCache(value) {
  return value?.version === IPTV_ORG_METADATA_CACHE_VERSION && Array.isArray(value.byUrl) && Array.isArray(value.byId);
}

function indexFromCompact(value) {
  const makeMap = (rows) => new Map(rows.filter((row) => Array.isArray(row) && typeof row[0] === "string").map(([key, countries = [], languages = []]) => [key, {
    countries: unique((Array.isArray(countries) ? countries : []).map((item) => text(item).toUpperCase())),
    languages: unique((Array.isArray(languages) ? languages : []).map(text)),
  }]));
  return { byUrl: makeMap(value.byUrl), byId: makeMap(value.byId) };
}

async function fetchJson(fetchImpl, name, signal) {
  const response = await fetchImpl(IPTV_ORG_API_URLS[name], { cache: "no-cache", signal });
  if (!response?.ok) throw new Error(`iptv-org ${name}: HTTP ${response?.status ?? "unknown"}`);
  const value = await response.json();
  if (!Array.isArray(value)) throw new TypeError(`iptv-org ${name}: expected a JSON array`);
  return value;
}

export async function fetchIptvOrgMetadata(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== "function") throw new Error("Fetch is not available");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout ?? DEFAULT_IPTV_ORG_METADATA_TIMEOUT);
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) controller.abort();
  try {
    const [streams, channels, feeds, languages] = await Promise.all([
      fetchJson(fetchImpl, "streams", controller.signal),
      fetchJson(fetchImpl, "channels", controller.signal),
      fetchJson(fetchImpl, "feeds", controller.signal),
      fetchJson(fetchImpl, "languages", controller.signal),
    ]);
    return reduceIptvOrgMetadata({ streams, channels, feeds, languages });
  } catch (error) {
    controller.abort();
    throw error;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abort);
  }
}

/** Load a fresh compact index, falling back to a stale valid cache on failure. */
export async function loadIptvOrgMetadata(options = {}) {
  const getCache = options.getCache || (async () => null);
  const setCache = options.setCache || (async () => {});
  const cached = await getCache();
  const usableCache = validCompactCache(cached?.value);
  const maxAge = options.maxAge ?? DEFAULT_IPTV_ORG_METADATA_TTL;
  const fresh = usableCache && Date.now() - Number(cached.updatedAt || 0) < maxAge;
  if (fresh && !options.force) return { index: indexFromCompact(cached.value), source: "cache", stale: false };
  try {
    const compact = await fetchIptvOrgMetadata(options);
    try {
      await setCache({ key: IPTV_ORG_METADATA_CACHE_KEY, value: compact, updatedAt: Date.now() });
      return { index: indexFromCompact(compact), source: "network", stale: false };
    } catch (error) {
      // A quota/cache write failure must not discard valid metadata already fetched.
      return { index: indexFromCompact(compact), source: "network", stale: false, error };
    }
  } catch (error) {
    if (usableCache) return { index: indexFromCompact(cached.value), source: "cache", stale: true, error };
    throw error;
  }
}

/** Endpoint identity wins; tvgId fills only metadata absent from the URL match. */
export function metadataForChannel(channel, index) {
  let endpointMetadata = null;
  for (const endpoint of channel?.endpoints || (channel?.endpoint ? [channel.endpoint] : [])) {
    const match = index.byUrl.get(normalizeUrl(endpoint?.url));
    if (match) { endpointMetadata = mergeMetadata(endpointMetadata, match); break; }
  }
  const embeddedTvgId = String(channel?.channelId || "").startsWith("tvg:") ? String(channel.channelId).slice(4) : "";
  const idMetadata = index.byId.get(normalizeTvgId(channel?.tvgId || channel?.["tvg-id"] || embeddedTvgId));
  if (!endpointMetadata && !idMetadata) return null;
  return {
    countries: endpointMetadata?.countries.length ? endpointMetadata.countries : (idMetadata?.countries || []),
    languages: endpointMetadata?.languages.length ? endpointMetadata.languages : (idMetadata?.languages || []),
    matchedBy: endpointMetadata ? "endpoint" : "tvgId",
  };
}

export function enrichChannelRow(row, metadata) {
  if (!row || !metadata) return row;
  const existingCountries = Array.isArray(row.countries) ? row.countries : [];
  const existingLanguages = Array.isArray(row.languages) ? row.languages : [];
  const addCountries = !existingCountries.length && metadata.countries.length;
  const addLanguages = !existingLanguages.length && metadata.languages.length;
  if (!addCountries && !addLanguages) return row;
  const countries = addCountries ? [...metadata.countries] : existingCountries;
  const languages = addLanguages ? [...metadata.languages] : existingLanguages;
  return {
    ...row,
    countries,
    languages,
    country: row.country || countries[0] || "",
    language: row.language || languages[0] || "",
    updatedAt: Date.now(),
  };
}

async function writeChannelRows(db, rows) {
  if (!rows.length) return;
  const transaction = db.transaction("channels", "readwrite");
  rows.forEach((row) => transaction.objectStore("channels").put(row));
  await transactionDone(transaction);
}

/**
 * Best-effort persistence contract used by CatalogService.enrichMetadata().
 * Failures are reported in the result and never reject the caller.
 */
export async function enrichPersistedChannelMetadata(db, activeChannels, options = {}) {
  const targets = (Array.isArray(activeChannels) ? activeChannels : []).filter((channel) => !channel.countries?.length || !channel.languages?.length);
  const summary = { attempted: targets.length, matched: 0, updated: 0, matchedBy: { endpoint: 0, tvgId: 0 }, source: "none", stale: false };
  if (!targets.length) return summary;
  try {
    const loaded = await loadIptvOrgMetadata({
      ...options,
      getCache: options.getCache || (() => get(db, "settings", IPTV_ORG_METADATA_CACHE_KEY)),
      setCache: options.setCache || ((record) => put(db, "settings", record)),
    });
    summary.source = loaded.source;
    summary.stale = loaded.stale;
    if (loaded.error) summary.warning = loaded.error.message;
    const updates = [];
    const testRows = options.readRows ? await options.readRows() : null;
    const testRowsById = testRows ? new Map(testRows.map((row) => [row.channelId, row])) : null;
    for (const channel of targets) {
      const metadata = metadataForChannel(channel, loaded.index);
      if (!metadata) continue;
      summary.matched += 1;
      summary.matchedBy[metadata.matchedBy] += 1;
      const row = testRowsById
        ? testRowsById.get(channel.channelId)
        : await get(db, "channels", channel.channelId);
      const enriched = enrichChannelRow(row, metadata);
      if (enriched && enriched !== row) updates.push(enriched);
    }
    const persistRows = options.persistRows || ((rows) => writeChannelRows(db, rows));
    await persistRows(updates);
    summary.updated = updates.length;
    return summary;
  } catch (error) {
    return { ...summary, error: error?.message || String(error) };
  }
}
