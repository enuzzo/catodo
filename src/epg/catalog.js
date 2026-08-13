const ROOT_URL = "https://api.github.com/repos/globetvapp/epg/contents";
const CACHE_TTL = 24 * 60 * 60 * 1000;

function countryLabel(value) {
  const known = {
    Bosnia: "Bosnia and Herzegovina",
    Costarica: "Costa Rica",
    Czech: "Czech Republic",
    Dominican: "Dominican Republic",
    Elsalvador: "El Salvador",
    Hongkong: "Hong Kong",
    Ivorycoast: "Côte d’Ivoire",
    Korea: "South Korea",
    Newcaledonia: "New Caledonia",
    Newzealand: "New Zealand",
    Puertorico: "Puerto Rico",
    Saudiarabia: "Saudi Arabia",
    Southafrica: "South Africa",
    Southkorea: "South Korea",
    Uae: "United Arab Emirates",
    Unitedarabemirates: "United Arab Emirates",
    Unitedkingdom: "United Kingdom",
    Usa: "United States",
  };
  return known[value] || String(value || "").replace(/([a-z])([A-Z])/g, "$1 $2");
}

const COUNTRY_IDS_BY_ISO = {
  AE: "Uae",
  BA: "Bosnia",
  CI: "Ivorycoast",
  CR: "Costarica",
  CZ: "Czech",
  DO: "Dominican",
  GB: "Unitedkingdom",
  HK: "Hongkong",
  KR: "Korea",
  MO: "Macau",
  NC: "Newcaledonia",
  NZ: "Newzealand",
  PR: "Puertorico",
  SA: "Saudiarabia",
  SV: "Elsalvador",
  US: "Usa",
  ZA: "Southafrica",
};

function normalizedCountryName(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "")
    .toLocaleLowerCase("en-US");
}

export function globeTvCatalogCountryFor(country, countries = []) {
  const iso2 = String(country?.code || country?.iso2 || "").trim().toUpperCase();
  const preferredId = COUNTRY_IDS_BY_ISO[iso2];
  if (preferredId) {
    const preferred = countries.find((item) => String(item?.id || "").toLocaleLowerCase("en-US") === preferredId.toLocaleLowerCase("en-US"));
    if (preferred) return preferred;
  }
  const names = new Set([country?.name, country?.localName, country?.nativeName].map(normalizedCountryName).filter(Boolean));
  return countries.find((item) => names.has(normalizedCountryName(item?.name)) || names.has(normalizedCountryName(countryLabel(item?.id)))) || null;
}

export function globeTvCountryFromUrl(value) {
  try {
    const url = new URL(value);
    if (url.hostname !== "raw.githubusercontent.com" || !url.pathname.includes("/globetvapp/epg/")) return null;
    const match = decodeURIComponent(url.pathname).match(/\/main\/([^/]+)\/([^/]+\.xml)$/i);
    return match ? { id: match[1], name: countryLabel(match[1]), file: match[2] } : null;
  } catch {
    return null;
  }
}

function openEpgCountryFromUrl(value) {
  try {
    const url = new URL(value);
    const match = url.hostname === "www.open-epg.com" ? url.pathname.match(/^\/files\/(italy[1-8]\.xml)$/i) : null;
    return match ? { id: "Italy", name: "Italy", file: match[1] } : null;
  } catch {
    return null;
  }
}

export function groupGuideSources(sources, statuses = []) {
  const statusByUrl = new Map((Array.isArray(statuses) ? statuses : []).map((item) => [item.url, item]));
  const groups = new Map();
  for (const url of Array.isArray(sources) ? sources : []) {
    const country = globeTvCountryFromUrl(url) || openEpgCountryFromUrl(url) || { id: "custom", name: "Custom sources", file: (() => { try { return new URL(url).pathname.split("/").pop() || url; } catch { return url; } })() };
    if (!groups.has(country.id)) groups.set(country.id, { id: country.id, name: country.name, sources: [] });
    groups.get(country.id).sources.push({ url, file: country.file, ...(statusByUrl.get(url) || {}) });
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export class GlobeTvCatalog {
  #catalog;
  #fetch;

  constructor({ catalog, fetchImpl = globalThis.fetch } = {}) {
    this.#catalog = catalog;
    this.#fetch = typeof fetchImpl === "function" ? fetchImpl.bind(globalThis) : fetchImpl;
  }

  async #read(key, url, mapper, force = false) {
    const cached = await this.#catalog?.getSetting?.(key, null);
    if (!force && cached?.fetchedAt && Date.now() - cached.fetchedAt < CACHE_TTL) return cached.items || [];
    try {
      const response = await this.#fetch(url, { headers: { Accept: "application/vnd.github+json" } });
      if (!response.ok) throw new Error(`Guide catalog request failed (${response.status})`);
      const items = mapper(await response.json());
      await this.#catalog?.setSetting?.(key, { fetchedAt: Date.now(), items });
      return items;
    } catch (error) {
      if (cached?.items) return cached.items;
      throw error;
    }
  }

  countries(options = {}) {
    return this.#read("epg:globetv:countries:v1", ROOT_URL, (items) => (Array.isArray(items) ? items : [])
      .filter((item) => item?.type === "dir" && item.name !== "Sports")
      .map((item) => ({ id: item.name, name: countryLabel(item.name), apiUrl: item.url, htmlUrl: item.html_url }))
      .sort((a, b) => a.name.localeCompare(b.name)), options.force === true);
  }

  country(country, options = {}) {
    const id = String(country?.id || country || "").trim();
    if (!id || !/^[a-z0-9_-]+$/i.test(id)) throw new TypeError("Invalid guide country");
    return this.#read(`epg:globetv:country:v1:${id}`, `${ROOT_URL}/${encodeURIComponent(id)}`, (items) => (Array.isArray(items) ? items : [])
      .filter((item) => item?.type === "file" && /\.xml$/i.test(item.name) && item.download_url)
      .map((item) => ({ name: item.name, url: item.download_url, size: Number(item.size) || 0 })), options.force === true);
  }

  async countryFor(country, options = {}) {
    const match = globeTvCatalogCountryFor(country, await this.countries(options));
    return match ? this.country(match, options) : [];
  }
}
