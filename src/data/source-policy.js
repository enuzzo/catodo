const IPTV_ORG_ORIGIN = "https://iptv-org.github.io";
const COUNTRY_RE = /^\/iptv\/countries\/([a-z]{2})\.m3u$/;
const ALLOWED_PATHS = [
  /^\/iptv\/index\.m3u$/,
  COUNTRY_RE,
  /^\/iptv\/(?:categories|languages|regions)\/[a-z0-9_-]+\.m3u$/,
];
export function countryPlaylistUrl(code) {
  const normalized = String(code || "").trim().toLowerCase();
  if (!/^[a-z]{2}$/.test(normalized)) throw new TypeError("Country code must be ISO 3166-1 alpha-2");
  return `${IPTV_ORG_ORIGIN}/iptv/countries/${normalized}.m3u`;
}

export function inspectSourceUrl(value) {
  try {
    const url = new URL(value);
    const iptvOrg = url.origin === IPTV_ORG_ORIGIN && !url.username && !url.password && !url.search && !url.hash;
    const allowed = iptvOrg && ALLOWED_PATHS.some((pattern) => pattern.test(url.pathname));
    const country = allowed ? url.pathname.match(COUNTRY_RE)?.[1]?.toUpperCase() || null : null;
    return { valid: /^https?:$/.test(url.protocol), allowed, trusted: allowed, country, url: url.href, reason: allowed ? null : "Source requires explicit user consent" };
  } catch {
    return { valid: false, allowed: false, trusted: false, country: null, url: String(value || ""), reason: "Invalid URL" };
  }
}

export function assertImportAllowed(value, { confirmed = false } = {}) {
  const result = inspectSourceUrl(value);
  if (!result.valid) throw new TypeError(result.reason);
  if (!result.allowed && !confirmed) {
    const error = new Error(result.reason);
    error.code = "CONSENT_REQUIRED";
    error.source = result;
    throw error;
  }
  return result;
}

// Parsing is pure and never downloads. Callers must surface the returned intent for consent.
export function parseDeepLink(value, base = "https://catodo.invalid/") {
  let url;
  try { url = new URL(value, base); } catch { return { type: "none", valid: false, confirmed: false }; }
  const country = url.searchParams.get("country") || (url.hash.match(/(?:^|[&#])country=([a-z]{2})(?:&|$)/i)?.[1]);
  const source = url.searchParams.get("source") || url.searchParams.get("url");
  if (country && /^[a-z]{2}$/i.test(country)) {
    const code = country.toUpperCase();
    return { type: "country", valid: true, confirmed: false, code, url: countryPlaylistUrl(code) };
  }
  if (source) {
    const inspected = inspectSourceUrl(source);
    return { type: "source", valid: inspected.valid, confirmed: false, url: inspected.url, trusted: inspected.trusted, consentRequired: !inspected.trusted };
  }
  return { type: "none", valid: true, confirmed: false };
}
