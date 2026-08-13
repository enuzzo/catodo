import { endpointIdFor, channelIdFor, sourceIdFor, stableHash } from "./identity.js";
import { inferEndpointKind } from "./m3u.js";
import { get, put, replaceSourceSnapshot } from "./db.js";
import { installationPayload } from "./installation-sync.js";

export const LEGACY_MIGRATION_ID = "localStorage-catodo-v1";

function parseJson(value, fallback = null) {
  try { return value == null ? fallback : JSON.parse(value); } catch { return fallback; }
}

export function collectLegacyState(storage) {
  const values = {};
  if (!storage) return values;
  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith("catodo:")) values[key.slice(7)] = parseJson(storage.getItem(key), storage.getItem(key));
    }
  } catch { /* blocked storage behaves like an empty migration */ }
  return values;
}

function referenceUrl(reference) {
  if (typeof reference === "string") return reference;
  return reference?.url || reference?.endpoint?.url || reference?.stream || "";
}

export function resolveLegacyReferences(references, urlToChannelId, type = "favorite", now = Date.now()) {
  return (Array.isArray(references) ? references : []).map((reference, index) => {
    const url = referenceUrl(reference);
    const channelId = urlToChannelId.get(url) || (reference?.channelId && reference.channelId);
    const rememberedAt = reference?.ts || now - index;
    if (channelId) return {
      id: type === "history" ? `legacy:${rememberedAt}:${index}:${channelId}` : channelId,
      channelId,
      migratedFrom: url || null,
      ...(type === "history" ? { rememberedAt } : {}),
    };
    const token = url || JSON.stringify(reference);
    return {
      id: type === "history" ? `orphan:${rememberedAt}:${index}:${stableHash(token)}` : `orphan:${stableHash(token)}`,
      channelId: null,
      orphan: true,
      legacy: reference,
      migratedFrom: url || null,
      ...(type === "history" ? { rememberedAt } : {}),
    };
  });
}

export function upgradeLegacyChannel(channel, sourceId) {
  const url = referenceUrl(channel);
  const endpoint = { url, kind: channel.kind || inferEndpointKind(url), headers: channel.headers || {}, referrer: channel.referrer || "" };
  endpoint.endpointId = endpointIdFor(endpoint);
  const countries = [channel.country || channel.tvgCountry].filter(Boolean);
  const languages = [channel.language || channel.tvgLanguage].filter(Boolean);
  const categories = [channel.group || channel.groupTitle || "Undefined"].filter(Boolean);
  const record = {
    tvgId: channel.tvgId || channel["tvg-id"] || "",
    tvgName: channel.tvgName || channel["tvg-name"] || "",
    name: channel.name || channel.tvgName || "Unnamed channel",
    aliases: [channel.name, channel.tvgName].filter(Boolean),
    logo: channel.logo || "",
    countries,
    languages,
    categories,
    country: countries[0] || "",
    language: languages[0] || "",
    groupTitle: channel.group || channel.groupTitle || "",
    geoRestricted: Boolean(channel.geo),
    geo: Boolean(channel.geo),
    notAlwaysOn: Boolean(channel.sd || channel.notAlwaysOn || channel.not24x7),
    not24x7: Boolean(channel.sd || channel.notAlwaysOn || channel.not24x7),
    kind: endpoint.kind,
    source: sourceId,
    endpoint,
    endpoints: [endpoint],
  };
  record.channelId = channelIdFor(record);
  return record;
}

export function legacyInstallationPayload(storage) {
  const legacy = collectLegacyState(storage);
  const sources = [];
  const urlToChannelId = new Map();
  for (const legacySource of Array.isArray(legacy.sources) ? legacy.sources : []) {
    const sourceId = legacySource?.sourceId || legacySource?.id || sourceIdFor(legacySource || {});
    const url = String(legacySource?.url || '').trim();
    if (!sourceId || !url) continue;
    sources.push({
      sourceId,
      kind: 'url',
      name: legacySource.name || url,
      url,
      trusted: Boolean(legacySource.trusted),
      createdAt: Number(legacySource.ts) || Date.now(),
    });
    const cache = legacy[`ch:${legacySource.id}`] || legacy[`ch:${sourceId}`];
    for (const channel of cache?.ch || []) {
      const upgraded = upgradeLegacyChannel(channel, sourceId);
      upgraded.endpoints.forEach((endpoint) => urlToChannelId.set(endpoint.url, upgraded.channelId));
    }
  }
  const favorites = resolveLegacyReferences(legacy.favs || legacy.favorites, urlToChannelId, 'favorite')
    .filter((favorite) => favorite.channelId);
  const settings = {};
  if (typeof legacy.proxy === 'string') settings.proxy = legacy.proxy;
  return installationPayload({ sources, favorites, settings });
}

export async function migrateLegacyStorage(db, storage = null) {
  const completed = await get(db, "migrationJournal", LEGACY_MIGRATION_ID);
  if (completed?.status === "complete") return completed;
  const legacy = collectLegacyState(storage);
  const sources = Array.isArray(legacy.sources) ? legacy.sources : [];
  const urlToChannelId = new Map();
  let importedChannels = 0;

  for (const legacySource of sources) {
    const sourceId = legacySource.sourceId || legacySource.id || sourceIdFor(legacySource);
    const cache = legacy[`ch:${legacySource.id}`] || legacy[`ch:${sourceId}`];
    const channels = (cache?.ch || []).map((channel) => upgradeLegacyChannel(channel, sourceId));
    channels.forEach((channel) => channel.endpoints.forEach((endpoint) => urlToChannelId.set(endpoint.url, channel.channelId)));
    const source = {
      sourceId,
      kind: legacySource.kind || "url",
      name: legacySource.name || legacySource.url || "Migrated source",
      url: legacySource.url || "",
      createdAt: legacySource.ts || Date.now(),
      migrated: true,
    };
    if (channels.length) {
      await replaceSourceSnapshot(db, source, channels, { createdAt: cache?.ts || Date.now(), migration: LEGACY_MIGRATION_ID });
      importedChannels += channels.length;
    } else {
      await put(db, "sources", source);
    }
  }

  const favorites = resolveLegacyReferences(legacy.favs || legacy.favorites, urlToChannelId, "favorite");
  const history = resolveLegacyReferences(legacy.recent || legacy.history, urlToChannelId, "history");
  await Promise.all(favorites.map((item) => put(db, "favorites", item)));
  await Promise.all(history.map((item) => put(db, "history", item)));

  const settings = ["fx", "cap", "hide", "skip", "proxy", "site", "cat"];
  await Promise.all(settings.filter((key) => key in legacy).map((key) => put(db, "settings", { key, value: legacy[key], migrated: true })));
  const journal = { id: LEGACY_MIGRATION_ID, status: "complete", completedAt: Date.now(), sources: sources.length, channels: importedChannels, favorites: favorites.length, history: history.length };
  await put(db, "migrationJournal", journal);
  return journal;
}
