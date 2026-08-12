const encoder = new TextEncoder();
function clean(value) {
  return String(value ?? "").normalize("NFKC").trim().replace(/\s+/g, " ");
}

export function normalizeUrl(value) {
  const raw = clean(value);
  try {
    const url = new URL(raw);
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    if ((url.protocol === "http:" && url.port === "80") || (url.protocol === "https:" && url.port === "443")) url.port = "";
    return url.href;
  } catch {
    return raw;
  }
}

// FNV-1a 64-bit is deterministic in browsers and Node, unlike object hashes.
export function stableHash(value) {
  let hash = 0xcbf29ce484222325n;
  for (const byte of encoder.encode(String(value))) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(36).padStart(13, "0");
}

export function normalizeTvgId(value) {
  return clean(value).toLocaleLowerCase("en-US");
}

export function channelFingerprint(channel = {}) {
  const name = clean(channel.name || channel.tvgName).toLocaleLowerCase("en-US");
  const country = clean(channel.country || channel.countries?.[0]).toUpperCase();
  const language = clean(channel.language || channel.languages?.[0]).toLowerCase();
  // An endpoint is deliberately only the last fallback: mirrors remain one channel.
  const discriminator = [name, country, language].filter(Boolean).join("|") || normalizeUrl(channel.url || channel.endpoints?.[0]?.url);
  return stableHash(discriminator);
}

export function channelIdFor(channel = {}) {
  const tvgId = normalizeTvgId(channel.tvgId || channel["tvg-id"]);
  return tvgId ? `tvg:${tvgId}` : `fp:${channelFingerprint(channel)}`;
}

export function endpointIdFor(endpoint = {}) {
  const headers = Object.entries(endpoint.headers || {}).sort(([a], [b]) => a.localeCompare(b));
  return `ep:${stableHash(JSON.stringify([normalizeUrl(endpoint.url), headers]))}`;
}

export function sourceIdFor(source = {}) {
  return `src:${stableHash(source.url || `${source.kind || "source"}:${source.name || "unnamed"}`)}`;
}
