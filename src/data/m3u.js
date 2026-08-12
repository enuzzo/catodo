import { channelIdFor, endpointIdFor, normalizeUrl } from "./identity.js";

export const DEFAULT_PARSE_LIMITS = Object.freeze({
  maxRecords: 50_000,
  maxFieldLength: 4_096,
  maxUrlLength: 8_192,
});

const splitList = (value) => String(value || "").split(/[;,|]/).map((item) => item.trim()).filter(Boolean);
const unique = (values) => [...new Set(values)];
const truthy = (value) => /^(1|true|yes)$/i.test(String(value || ""));

function clamp(value, max) {
  return String(value ?? "").normalize("NFKC").trim().slice(0, max);
}

export function inferEndpointKind(url) {
  if (/youtube\.com|youtu\.be/i.test(url)) return "youtube";
  if (/twitch\.tv/i.test(url)) return "twitch";
  if (/dailymotion\.com/i.test(url)) return "dailymotion";
  if (/^rtmps?:/i.test(url)) return "rtmp";
  if (/^rtsp:/i.test(url)) return "rtsp";
  if (/\.mpd(?:$|[?#])/i.test(url)) return "dash";
  if (/\.m3u8?(?:$|[?#])/i.test(url)) return "hls";
  if (/^https?:/i.test(url)) return "http";
  return "unknown";
}

export function parseAttributeList(line, maxFieldLength = DEFAULT_PARSE_LIMITS.maxFieldLength) {
  const attributes = {};
  const head = line.replace(/^#EXTINF\s*:\s*[^ ]*\s*/i, "");
  const pattern = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s,]+))/g;
  let match;
  while ((match = pattern.exec(head))) attributes[match[1].toLowerCase()] = clamp(match[2] ?? match[3] ?? match[4], maxFieldLength);
  return attributes;
}

function displayName(line, attributes, maxFieldLength) {
  let quoted = false;
  let comma = -1;
  for (let index = line.indexOf(":") + 1; index < line.length; index += 1) {
    if (line[index] === '"') quoted = !quoted;
    else if (line[index] === "," && !quoted) comma = index;
  }
  return clamp(comma >= 0 ? line.slice(comma + 1) : attributes["tvg-name"], maxFieldLength) || "Unnamed channel";
}

function parseDirective(line, pending) {
  const separator = line.indexOf(":");
  const key = line.slice(1, separator >= 0 ? separator : undefined).trim().toLowerCase();
  const value = separator >= 0 ? line.slice(separator + 1).trim() : "";
  if (key === "extvlcopt") {
    const equals = value.indexOf("=");
    if (equals > 0) {
      const header = value.slice(0, equals).trim();
      const headerValue = value.slice(equals + 1).trim();
      pending.headers[header] = headerValue;
      if (/^http-referr?er$/i.test(header)) pending.referrer = headerValue;
    }
  }
  if (key === "exthttp") {
    try { Object.assign(pending.headers, JSON.parse(value)); } catch { /* malformed optional metadata */ }
  }
  if (key === "http-referrer" || key === "http-referer") pending.referrer = value;
  if (key === "http-user-agent") pending.headers["User-Agent"] = value;
  if (key === "extgrp") pending.groupTitle = value;
}

export function parseM3U(text, options = {}) {
  const limits = { ...DEFAULT_PARSE_LIMITS, ...(options.limits || {}) };
  const source = options.source || options.sourceId || null;
  const lines = String(text ?? "").replace(/^\uFEFF/, "").split(/\r?\n/);
  const records = [];
  let pending = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (/^#EXTINF\s*:/i.test(line)) {
      const attributes = parseAttributeList(line, limits.maxFieldLength);
      pending = { line, attributes, headers: {}, referrer: "" };
      continue;
    }
    if (!pending) continue;
    if (line.startsWith("#")) {
      parseDirective(line, pending);
      continue;
    }
    if (!line) continue;
    if (records.length >= limits.maxRecords) throw new RangeError(`Playlist exceeds ${limits.maxRecords} records`);

    const url = clamp(line, limits.maxUrlLength);
    const a = pending.attributes;
    const name = displayName(pending.line, a, limits.maxFieldLength);
    const countries = unique(splitList(a["tvg-country"] || a.country).map((value) => value.toUpperCase()));
    const languages = unique(splitList(a["tvg-language"] || a.language));
    const categories = unique(splitList(a["tvg-category"] || a.category));
    const groupTitle = clamp(a["group-title"] || pending.groupTitle, limits.maxFieldLength);
    if (groupTitle && !categories.length) categories.push(groupTitle);
    const headers = Object.fromEntries(Object.entries(pending.headers).map(([key, value]) => [clamp(key, 128), clamp(value, limits.maxFieldLength)]));
    const referrer = clamp(a["http-referrer"] || a["http-referer"] || pending.referrer || headers.Referer || headers.Referrer, limits.maxFieldLength);
    if (referrer && !headers.Referer) headers.Referer = referrer;
    const endpoint = { url: normalizeUrl(url), kind: inferEndpointKind(url), headers, referrer };
    endpoint.endpointId = endpointIdFor(endpoint);
    const geoRestricted = truthy(a["tvg-geo-blocked"] || a.geo) || /[Ⓖ]/u.test(name);
    const notAlwaysOn = truthy(a["tvg-not-24-7"] || a["not-24-7"]) || /[ⓢ]/u.test(name);
    const record = {
      channelId: "",
      tvgId: clamp(a["tvg-id"], limits.maxFieldLength),
      tvgName: clamp(a["tvg-name"], limits.maxFieldLength),
      name,
      aliases: unique([a["tvg-name"], name].filter(Boolean)),
      logo: clamp(a["tvg-logo"], limits.maxUrlLength),
      countries,
      languages,
      categories,
      country: countries[0] || "",
      language: languages[0] || "",
      groupTitle,
      geoRestricted,
      geo: geoRestricted,
      notAlwaysOn,
      not24x7: notAlwaysOn,
      kind: endpoint.kind,
      source,
      endpoint,
      endpoints: [endpoint],
    };
    record.channelId = channelIdFor(record);
    records.push(record);
    pending = null;
  }
  return records;
}

export function mergeChannelRecords(records) {
  const merged = new Map();
  for (const record of records) {
    const existing = merged.get(record.channelId);
    if (!existing) {
      merged.set(record.channelId, { ...record, aliases: [...record.aliases], endpoints: [...record.endpoints], sources: record.source ? [record.source] : [] });
      continue;
    }
    existing.aliases = unique([...existing.aliases, ...record.aliases]);
    existing.countries = unique([...existing.countries, ...record.countries]);
    existing.languages = unique([...existing.languages, ...record.languages]);
    existing.categories = unique([...existing.categories, ...record.categories]);
    existing.sources = unique([...existing.sources, ...(record.source ? [record.source] : [])]);
    const endpointIds = new Set(existing.endpoints.map((endpoint) => endpoint.endpointId));
    existing.endpoints.push(...record.endpoints.filter((endpoint) => !endpointIds.has(endpoint.endpointId)));
    if (!existing.logo && record.logo) existing.logo = record.logo;
  }
  return [...merged.values()];
}
