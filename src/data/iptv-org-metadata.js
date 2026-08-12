import { get, getAll, put, transactionDone } from "./db.js";
import { normalizeTvgId, normalizeUrl } from "./identity.js";

/** Official API contract: https://github.com/iptv-org/api#readme */
export const IPTV_ORG_API_URLS = Object.freeze({
  channels: "https://iptv-org.github.io/api/channels.json",
  feeds: "https://iptv-org.github.io/api/feeds.json",
  streams: "https://iptv-org.github.io/api/streams.json",
  logos: "https://iptv-org.github.io/api/logos.json",
  categories: "https://iptv-org.github.io/api/categories.json",
  languages: "https://iptv-org.github.io/api/languages.json",
  guides: "https://iptv-org.github.io/api/guides.json",
  blocklist: "https://iptv-org.github.io/api/blocklist.json",
});

export const IPTV_ORG_METADATA_CACHE_KEY = "directory:iptv-org-metadata:v2";
export const IPTV_ORG_METADATA_CACHE_VERSION = 2;
export const IPTV_ORG_METADATA_REVISION = 2;
export const IPTV_ORG_SAFETY_CACHE_KEY = "directory:iptv-org-safety:v1";
export const IPTV_ORG_SAFETY_CACHE_VERSION = 1;
export const DEFAULT_IPTV_ORG_METADATA_TTL = 7 * 24 * 60 * 60 * 1000;
export const DEFAULT_IPTV_ORG_METADATA_TIMEOUT = 60_000;

const text = (value) => String(value ?? "").normalize("NFKC").trim();
const unique = (values) => [...new Set((Array.isArray(values) ? values : []).map(text).filter(Boolean))];
const normalizedList = (value) => unique(Array.isArray(value) ? value : []);
const languageCode = (value) => text(value).toLocaleLowerCase("en-US");
const channelKey = (value) => normalizeTvgId(value);
const channelFeedKey = (channel, feed) => `${channelKey(channel)}\0${normalizeTvgId(feed)}`;

function channelAndFeed(channel, feed) {
  const rawChannel = text(channel);
  const separator = rawChannel.indexOf("@");
  return {
    channel: separator < 0 ? rawChannel : rawChannel.slice(0, separator),
    feed: text(feed) || (separator < 0 ? "" : rawChannel.slice(separator + 1)),
  };
}

function groupBy(rows, keyFor) {
  const grouped = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const key = keyFor(row);
    if (!key) continue;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }
  return grouped;
}

function preferredLogo(logos) {
  return [...logos].sort((a, b) => {
    const score = (item) => (item.inUse ? 1_000_000_000 : 0) + Number(item.width || 0) * Number(item.height || 0);
    return score(b) - score(a);
  })[0]?.url || "";
}

function logoDescriptor(item) {
  return {
    url: text(item?.url),
    inUse: Boolean(item?.in_use),
    tags: normalizedList(item?.tags),
    width: Number(item?.width) || 0,
    height: Number(item?.height) || 0,
    format: text(item?.format),
  };
}

function guideDescriptor(item) {
  return {
    site: text(item?.site),
    siteId: text(item?.site_id),
    siteName: text(item?.site_name),
    lang: languageCode(item?.lang),
    sources: (Array.isArray(item?.sources) ? item.sources : []).map((source) => ({
      host: text(source?.host),
      url: text(source?.url),
      format: text(source?.format),
    })).filter((source) => source.host || source.url),
  };
}

function feedDescriptor(item, languageNames) {
  const languageCodes = unique((Array.isArray(item?.languages) ? item.languages : []).map(languageCode));
  return {
    feedId: text(item?.id),
    feedName: text(item?.name),
    feedAliases: normalizedList(item?.alt_names),
    isMain: Boolean(item?.is_main),
    broadcastArea: normalizedList(item?.broadcast_area),
    timezones: normalizedList(item?.timezones),
    languageCodes,
    languageNames: languageCodes.map((code) => languageNames.get(code) || code),
    feedFormat: text(item?.format),
  };
}

function endpointDescriptor({ stream = null, feed = null, logos = [], guides = [], languageNames }) {
  const feedData = feed ? feedDescriptor(feed, languageNames) : {
    feedId: text(stream?.feed), feedName: "", feedAliases: [], isMain: false,
    broadcastArea: [], timezones: [], languageCodes: [], languageNames: [], feedFormat: "",
  };
  const logoRows = logos.map(logoDescriptor).filter((item) => item.url);
  const guideRows = guides.map(guideDescriptor).filter((item) => item.site || item.siteId);
  return {
    ...feedData,
    streamTitle: text(stream?.title),
    quality: text(stream?.quality),
    label: text(stream?.label),
    referrer: text(stream?.referrer),
    userAgent: text(stream?.user_agent),
    logos: logoRows,
    preferredLogo: preferredLogo(logoRows),
    guides: guideRows,
    guide: guideRows[0] || null,
    hasGuide: guideRows.length > 0,
  };
}

function streamDescriptor(stream) {
  return {
    streamTitle: text(stream?.title),
    quality: text(stream?.quality),
    label: text(stream?.label),
    referrer: text(stream?.referrer),
    userAgent: text(stream?.user_agent),
  };
}

function selectFeed(feeds, requestedFeed = "") {
  const requested = normalizeTvgId(requestedFeed);
  if (requested) {
    const exact = feeds.find((item) => normalizeTvgId(item?.id) === requested);
    if (exact) return exact;
  }
  return feeds.find((item) => item?.is_main) || feeds[0] || null;
}

function relevantRows(grouped, channel, feed = "") {
  const all = grouped.get(channel) || [];
  const normalizedFeed = normalizeTvgId(feed);
  const general = all.filter((item) => !text(item?.feed));
  if (!normalizedFeed) return general.length ? general : all;
  const exact = all.filter((item) => normalizeTvgId(item?.feed) === normalizedFeed);
  return [...general, ...exact];
}

/**
 * Reduce all official resources to an atomic, structured-clone-safe lookup.
 * The cache retains useful descriptors, not the much larger raw API payloads.
 */
export function reduceIptvOrgMetadata(resources = {}) {
  const channels = Array.isArray(resources.channels) ? resources.channels : [];
  const feeds = Array.isArray(resources.feeds) ? resources.feeds : [];
  const streams = Array.isArray(resources.streams) ? resources.streams : [];
  const logos = Array.isArray(resources.logos) ? resources.logos : [];
  const guides = Array.isArray(resources.guides) ? resources.guides : [];
  const languageNames = new Map((Array.isArray(resources.languages) ? resources.languages : [])
    .map((item) => [languageCode(item?.code), text(item?.name)])
    .filter(([code, name]) => code && name));
  const categoryDirectory = new Map((Array.isArray(resources.categories) ? resources.categories : [])
    .map((item) => [text(item?.id), { id: text(item?.id), name: text(item?.name), description: text(item?.description) }])
    .filter(([id]) => id));
  const feedsByChannel = groupBy(feeds, (item) => channelKey(item?.channel));
  const logosByChannel = groupBy(logos, (item) => channelKey(item?.channel));
  const guidesByChannel = groupBy(guides, (item) => channelKey(item?.channel));
  const blocksByChannel = groupBy(resources.blocklist, (item) => channelKey(item?.channel));

  // Feed assets are normalized once and referenced by URL rows. This avoids
  // duplicating logo/guide descriptors for every mirror in the compact cache.
  const byFeed = new Map();
  for (const [key, channelFeeds] of feedsByChannel) {
    for (const feed of channelFeeds) {
      const id = text(feed?.id);
      byFeed.set(channelFeedKey(key, id), endpointDescriptor({
        feed,
        logos: relevantRows(logosByChannel, key, id),
        guides: relevantRows(guidesByChannel, key, id),
        languageNames,
      }));
    }
  }

  const byId = new Map();
  for (const item of channels) {
    const key = channelKey(item?.id);
    if (!key) continue;
    const channelFeeds = feedsByChannel.get(key) || [];
    const defaultFeed = selectFeed(channelFeeds);
    const defaultFeedId = text(defaultFeed?.id);
    const defaultFeedKey = channelFeedKey(key, defaultFeedId);
    if (!byFeed.has(defaultFeedKey)) byFeed.set(defaultFeedKey, endpointDescriptor({
      feed: defaultFeed,
      logos: relevantRows(logosByChannel, key, defaultFeedId),
      guides: relevantRows(guidesByChannel, key, defaultFeedId),
      languageNames,
    }));
    const defaultEndpoint = byFeed.get(defaultFeedKey);
    const categoryIds = normalizedList(item?.categories);
    const categoryDetails = categoryIds.map((id) => categoryDirectory.get(id) || { id, name: id, description: "" });
    const blocklist = (blocksByChannel.get(key) || []).map((block) => ({ reason: text(block?.reason), ref: text(block?.ref) }));
    byId.set(key, {
      officialChannelId: text(item?.id),
      officialName: text(item?.name),
      aliases: normalizedList(item?.alt_names),
      network: text(item?.network),
      owners: normalizedList(item?.owners),
      countries: text(item?.country) ? [text(item.country).toUpperCase()] : [],
      languages: defaultEndpoint.languageNames,
      languageCodes: defaultEndpoint.languageCodes,
      categories: categoryIds,
      categoryNames: categoryDetails.map((category) => category.name).filter(Boolean),
      categoryDescriptions: categoryDetails,
      isNsfw: Boolean(item?.is_nsfw) || blocklist.some((block) => block.reason.toLowerCase() === "nsfw"),
      launched: text(item?.launched),
      closed: text(item?.closed),
      replacedBy: text(item?.replaced_by),
      website: text(item?.website),
      blocked: blocklist.length > 0,
      blocklist,
      defaultFeedKey,
    });
  }

  const byUrl = new Map();
  for (const stream of streams) {
    const url = normalizeUrl(stream?.url);
    const reference = channelAndFeed(stream?.channel, stream?.feed);
    const key = channelKey(reference.channel);
    if (!url || !key || !byId.has(key)) continue;
    const channelFeeds = feedsByChannel.get(key) || [];
    const feed = selectFeed(channelFeeds, reference.feed);
    const feedId = text(feed?.id || reference.feed);
    const compactFeedKey = channelFeedKey(key, feedId);
    if (!byFeed.has(compactFeedKey)) byFeed.set(compactFeedKey, endpointDescriptor({
      feed,
      logos: relevantRows(logosByChannel, key, feedId),
      guides: relevantRows(guidesByChannel, key, feedId),
      languageNames,
    }));
    byUrl.set(url, [key, compactFeedKey, streamDescriptor(stream)]);
  }

  return {
    version: IPTV_ORG_METADATA_CACHE_VERSION,
    byId: [...byId],
    byFeed: [...byFeed],
    byUrl: [...byUrl].map(([url, [key, compactFeedKey, stream]]) => [url, key, compactFeedKey, stream]),
  };
}

function validCompactCache(value) {
  return value?.version === IPTV_ORG_METADATA_CACHE_VERSION && Array.isArray(value.byUrl) && Array.isArray(value.byId) && Array.isArray(value.byFeed);
}

function indexFromCompact(value) {
  const byFeed = new Map(value.byFeed.filter((row) => Array.isArray(row) && typeof row[0] === "string"));
  const byId = new Map(value.byId
    .filter((row) => Array.isArray(row) && typeof row[0] === "string")
    .map(([key, metadata]) => [key, { ...metadata, defaultEndpoint: byFeed.get(metadata?.defaultFeedKey) || null }]));
  const byUrl = new Map(value.byUrl
    .filter((row) => Array.isArray(row) && typeof row[0] === "string" && typeof row[1] === "string")
    .map(([url, key, compactFeedKey, stream]) => [url, {
      channel: byId.get(key) || null,
      endpoint: { ...(byFeed.get(compactFeedKey) || {}), ...(stream || {}) },
    }]));
  return { byId, byFeed, byUrl };
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
    const entries = await Promise.all(Object.keys(IPTV_ORG_API_URLS).map(async (name) => [name, await fetchJson(fetchImpl, name, controller.signal)]));
    return reduceIptvOrgMetadata(Object.fromEntries(entries));
  } catch (error) {
    controller.abort();
    throw error;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abort);
  }
}

/** Load a fresh complete index, falling back to one stale complete cache on failure. */
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
      return { index: indexFromCompact(compact), source: "network", stale: false, error };
    }
  } catch (error) {
    if (usableCache) return { index: indexFromCompact(cached.value), source: "cache", stale: true, error };
    throw error;
  }
}

function compactSafety(blocklist) {
  const grouped = groupBy(blocklist, (item) => channelKey(item?.channel));
  return {
    version: IPTV_ORG_SAFETY_CACHE_VERSION,
    byId: [...grouped].map(([key, rows]) => [key, rows.map((row) => ({ reason: text(row?.reason), ref: text(row?.ref) }))]),
  };
}

function validSafetyCache(value) {
  return value?.version === IPTV_ORG_SAFETY_CACHE_VERSION && Array.isArray(value.byId);
}

function safetyIndex(value) {
  return new Map(value.byId.filter((row) => Array.isArray(row) && typeof row[0] === "string"));
}

/** Small safety-only fetch used before a newly imported snapshot becomes visible. */
export async function loadIptvOrgSafety(options = {}) {
  const getCache = options.getCache || (async () => null);
  const setCache = options.setCache || (async () => {});
  const cached = await getCache();
  const usableCache = validSafetyCache(cached?.value);
  const maxAge = options.maxAge ?? DEFAULT_IPTV_ORG_METADATA_TTL;
  const fresh = usableCache && Date.now() - Number(cached.updatedAt || 0) < maxAge;
  if (fresh && !options.force) return { index: safetyIndex(cached.value), source: "cache", stale: false };
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    if (usableCache) return { index: safetyIndex(cached.value), source: "cache", stale: true, error: new Error("Fetch is not available") };
    throw new Error("Fetch is not available");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout ?? DEFAULT_IPTV_ORG_METADATA_TIMEOUT);
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) controller.abort();
  try {
    const blocklist = await fetchJson(fetchImpl, "blocklist", controller.signal);
    const compact = compactSafety(blocklist);
    try { await setCache({ key: IPTV_ORG_SAFETY_CACHE_KEY, value: compact, updatedAt: Date.now() }); }
    catch (error) { return { index: safetyIndex(compact), source: "network", stale: false, error }; }
    return { index: safetyIndex(compact), source: "network", stale: false };
  } catch (error) {
    if (usableCache) return { index: safetyIndex(cached.value), source: "cache", stale: true, error };
    throw error;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abort);
  }
}

function officialIdForChannel(channel) {
  const embedded = String(channel?.channelId || "").startsWith("tvg:") ? String(channel.channelId).slice(4) : "";
  return normalizeTvgId(channel?.tvgId || channel?.["tvg-id"] || channel?.officialChannelId || embedded);
}

/** Persist blocklist decisions without waiting for the much larger rich directory. */
export async function enrichPersistedChannelSafety(db, activeChannels, options = {}) {
  const targets = Array.isArray(activeChannels) ? activeChannels : [];
  const summary = { attempted: targets.length, blocked: 0, updated: 0, source: "none", stale: false };
  if (!targets.length) return summary;
  try {
    const loaded = await loadIptvOrgSafety({
      ...options,
      getCache: options.getCache || (() => get(db, "settings", IPTV_ORG_SAFETY_CACHE_KEY)),
      setCache: options.setCache || ((record) => put(db, "settings", record)),
    });
    summary.source = loaded.source;
    summary.stale = loaded.stale;
    if (loaded.error) summary.warning = loaded.error.message;
    const rows = options.readRows ? await options.readRows() : await getAll(db, "channels");
    const rowsById = new Map(rows.map((row) => [row.channelId, row]));
    const updates = [];
    for (const channel of targets) {
      const row = rowsById.get(channel.channelId);
      if (!row) continue;
      const blocklist = loaded.index.get(officialIdForChannel(channel)) || [];
      if (blocklist.length) summary.blocked += 1;
      updates.push({
        ...row,
        blocked: blocklist.length > 0,
        blocklist: blocklist.map((item) => ({ ...item })),
        isNsfw: Boolean(row.isNsfw || row.is_nsfw || blocklist.some((item) => String(item.reason).toLowerCase() === "nsfw")),
        safetyMetadataRevision: IPTV_ORG_SAFETY_CACHE_VERSION,
        updatedAt: Date.now(),
      });
    }
    if (options.persistRows) await options.persistRows(updates);
    else {
      const transaction = db.transaction("channels", "readwrite");
      updates.forEach((row) => transaction.objectStore("channels").put(row));
      await transactionDone(transaction);
    }
    summary.updated = updates.length;
    return summary;
  } catch (error) {
    return { ...summary, error: error?.message || String(error) };
  }
}

/** Endpoint identity wins; tvgId is a fallback only when no URL matches. */
export function metadataForChannel(channel, index) {
  let exact = null;
  let exactEndpoint = null;
  for (const endpoint of channel?.endpoints || (channel?.endpoint ? [channel.endpoint] : [])) {
    const match = index?.byUrl?.get(normalizeUrl(endpoint?.url));
    if (match?.channel) { exact = match.channel; exactEndpoint = match.endpoint; break; }
  }
  const embeddedTvgId = String(channel?.channelId || "").startsWith("tvg:") ? String(channel.channelId).slice(4) : "";
  const fallback = index?.byId?.get(normalizeTvgId(channel?.tvgId || channel?.["tvg-id"] || embeddedTvgId));
  const channelMetadata = exact || fallback;
  if (!channelMetadata) return null;
  const endpointMetadata = exactEndpoint || channelMetadata.defaultEndpoint || null;
  return {
    ...channelMetadata,
    countries: channelMetadata.countries || [],
    languages: endpointMetadata?.languageNames?.length ? endpointMetadata.languageNames : (channelMetadata.languages || []),
    languageCodes: endpointMetadata?.languageCodes?.length ? endpointMetadata.languageCodes : (channelMetadata.languageCodes || []),
    endpoint: endpointMetadata,
    matchedBy: exact ? "endpoint" : "tvgId",
  };
}

export function metadataForEndpoint(endpoint, channel, index) {
  const exact = index?.byUrl?.get(normalizeUrl(endpoint?.url));
  if (exact?.channel) return { ...exact.endpoint, matchedBy: "endpoint", officialChannelId: exact.channel.officialChannelId };
  const fallback = index?.byId?.get(officialIdForChannel(channel));
  return fallback?.defaultEndpoint
    ? { ...fallback.defaultEndpoint, matchedBy: "tvgId", officialChannelId: fallback.officialChannelId }
    : null;
}

function mergeUnique(previous, incoming) {
  return unique([...(Array.isArray(previous) ? previous : []), ...(Array.isArray(incoming) ? incoming : [])]);
}

export function enrichChannelRow(row, metadata) {
  if (!row || !metadata) return row;
  const countries = row.countries?.length ? row.countries : metadata.countries;
  const languages = row.languages?.length ? row.languages : metadata.languages;
  const endpoint = metadata.endpoint || {};
  return {
    ...row,
    // Playlist display name and custom fields deliberately remain authoritative.
    aliases: mergeUnique(row.aliases, [metadata.officialName, ...metadata.aliases]),
    countries: [...(countries || [])],
    languages: [...(languages || [])],
    categories: mergeUnique(row.categories, metadata.categories),
    country: row.country || countries?.[0] || "",
    language: row.language || languages?.[0] || "",
    logo: row.logo || metadata.preferredLogo || endpoint.preferredLogo || "",
    officialLogo: endpoint.preferredLogo || "",
    officialChannelId: metadata.officialChannelId,
    officialName: metadata.officialName,
    network: metadata.network,
    owners: [...metadata.owners],
    categoryNames: [...metadata.categoryNames],
    categoryDescriptions: metadata.categoryDescriptions.map((item) => ({ ...item })),
    isNsfw: Boolean(metadata.isNsfw),
    launched: metadata.launched,
    closed: metadata.closed,
    replacedBy: metadata.replacedBy,
    website: metadata.website,
    blocked: Boolean(metadata.blocked),
    blocklist: metadata.blocklist.map((item) => ({ ...item })),
    feedName: endpoint.feedName || "",
    feedFormat: endpoint.feedFormat || "",
    broadcastArea: [...(endpoint.broadcastArea || [])],
    timezones: [...(endpoint.timezones || [])],
    languageNames: [...(endpoint.languageNames || [])],
    quality: endpoint.quality || "",
    streamLabel: endpoint.label || "",
    guides: (endpoint.guides || []).map((item) => ({ ...item })),
    hasGuide: Boolean(endpoint.hasGuide),
    metadataRevision: IPTV_ORG_METADATA_REVISION,
    metadata: {
      ...(row.metadata && typeof row.metadata === "object" ? row.metadata : {}),
      iptvOrg: { provider: "iptv-org", revision: IPTV_ORG_METADATA_REVISION, matchedBy: metadata.matchedBy, channelId: metadata.officialChannelId },
    },
    updatedAt: Date.now(),
  };
}

export function enrichEndpointRow(row, metadata) {
  if (!row || !metadata) return row;
  const headers = { ...(row.headers || {}) };
  if (metadata.referrer && !headers.Referer && !headers.Referrer) headers.Referer = metadata.referrer;
  if (metadata.userAgent && !headers["User-Agent"]) headers["User-Agent"] = metadata.userAgent;
  return {
    ...row,
    headers,
    referrer: row.referrer || metadata.referrer || "",
    officialReferrer: metadata.referrer || "",
    userAgent: metadata.userAgent || "",
    streamTitle: metadata.streamTitle || "",
    feedId: metadata.feedId || "",
    feedName: metadata.feedName || "",
    feedAliases: [...(metadata.feedAliases || [])],
    isMain: Boolean(metadata.isMain),
    broadcastArea: [...(metadata.broadcastArea || [])],
    timezones: [...(metadata.timezones || [])],
    languageCodes: [...(metadata.languageCodes || [])],
    languageNames: [...(metadata.languageNames || [])],
    feedFormat: metadata.feedFormat || "",
    quality: metadata.quality || "",
    label: metadata.label || "",
    logos: (metadata.logos || []).map((item) => ({ ...item })),
    preferredLogo: metadata.preferredLogo || "",
    guides: (metadata.guides || []).map((item) => ({ ...item })),
    guide: metadata.guide ? { ...metadata.guide } : null,
    hasGuide: Boolean(metadata.hasGuide),
    metadataRevision: IPTV_ORG_METADATA_REVISION,
    metadata: {
      ...(row.metadata && typeof row.metadata === "object" ? row.metadata : {}),
      iptvOrg: { provider: "iptv-org", revision: IPTV_ORG_METADATA_REVISION, matchedBy: metadata.matchedBy, channelId: metadata.officialChannelId },
    },
    updatedAt: Date.now(),
  };
}

async function writeMetadataRows(db, channelRows, endpointRows) {
  if (!channelRows.length && !endpointRows.length) return;
  const transaction = db.transaction(["channels", "endpoints"], "readwrite");
  channelRows.forEach((row) => transaction.objectStore("channels").put(row));
  endpointRows.forEach((row) => transaction.objectStore("endpoints").put(row));
  await transactionDone(transaction);
}

/** Best-effort v2 backfill; channel and endpoint writes are atomic by default. */
export async function enrichPersistedChannelMetadata(db, activeChannels, options = {}) {
  const targets = (Array.isArray(activeChannels) ? activeChannels : [])
    .filter((channel) => options.force || channel.metadataRevision !== IPTV_ORG_METADATA_REVISION || channel.endpoints?.some((endpoint) => endpoint.metadataRevision !== IPTV_ORG_METADATA_REVISION));
  const summary = { attempted: targets.length, matched: 0, updated: 0, endpointsUpdated: 0, matchedBy: { endpoint: 0, tvgId: 0 }, source: "none", stale: false };
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

    const channelRows = options.readRows ? await options.readRows() : await getAll(db, "channels");
    const endpointRows = options.readEndpointRows ? await options.readEndpointRows() : await getAll(db, "endpoints");
    const channelsById = new Map(channelRows.map((row) => [row.channelId, row]));
    const targetIds = new Set(targets.map((channel) => channel.channelId));
    const endpointsByChannel = groupBy(endpointRows.filter((row) => targetIds.has(row.channelId)), (row) => row.channelId);
    const channelUpdates = [];
    const endpointUpdates = [];

    for (const channel of targets) {
      const metadata = metadataForChannel(channel, loaded.index);
      if (!metadata) continue;
      summary.matched += 1;
      summary.matchedBy[metadata.matchedBy] += 1;
      const row = channelsById.get(channel.channelId);
      if (row) channelUpdates.push(enrichChannelRow(row, metadata));
      for (const endpointRow of endpointsByChannel.get(channel.channelId) || []) {
        const endpointMetadata = metadataForEndpoint(endpointRow, channel, loaded.index);
        if (endpointMetadata) endpointUpdates.push(enrichEndpointRow(endpointRow, endpointMetadata));
      }
    }

    if (options.persistUpdates) await options.persistUpdates({ channels: channelUpdates, endpoints: endpointUpdates });
    else if (options.persistRows || options.persistEndpointRows) {
      await (options.persistRows || (async () => {}))(channelUpdates);
      await (options.persistEndpointRows || (async () => {}))(endpointUpdates);
    } else await writeMetadataRows(db, channelUpdates, endpointUpdates);
    summary.updated = channelUpdates.length;
    summary.endpointsUpdated = endpointUpdates.length;
    return summary;
  } catch (error) {
    return { ...summary, error: error?.message || String(error) };
  }
}
