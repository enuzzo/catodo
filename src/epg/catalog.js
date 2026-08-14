const ROOT_URL = "https://api.github.com/repos/globetvapp/epg/contents";
const CACHE_TTL = 24 * 60 * 60 * 1000;
const OPEN_EPG_CATALOG_URL = "./epg-cache.php?catalog=open-epg";
const OPEN_EPG_CACHE_TTL = 6 * 60 * 60 * 1000;
const OPEN_EPG_MAX_AGE = 2 * 24 * 60 * 60 * 1000;

const COUNTRY_ALIASES_BY_ISO = Object.freeze({
  AE: ["united arab emirates", "uae"],
  BA: ["bosnia and herzegovina", "bosnia"],
  CI: ["cote d ivoire", "ivory coast"],
  CZ: ["czech republic", "czechia", "czech"],
  GB: ["united kingdom", "great britain", "uk"],
  HK: ["hong kong", "hongkong"],
  KR: ["south korea", "korea"],
  MO: ["macau", "macao"],
  NZ: ["new zealand", "newzealand"],
  US: ["united states", "united states of america", "usa"],
});

const EPG_SHARE_COUNTRY_CODES = new Set([
  "AE", "AL", "AR", "AT", "AU", "BA", "BE", "BG", "BR", "CA", "CH", "CL", "CO", "CR", "CY", "CZ",
  "DE", "DK", "DO", "EC", "ES", "FI", "FR", "GB", "GR", "HK", "HR", "HU", "ID", "IE", "IL", "IN",
  "IT", "JM", "JP", "KE", "KR", "LT", "LV", "MT", "MX", "MY", "NG", "NL", "NO", "NZ", "PA", "PE",
  "PH", "PK", "PL", "PT", "RO", "RS", "SA", "SE", "SG", "SK", "SV", "TR", "US", "UY", "VN", "ZA",
]);

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

function providerCountryName(value) {
  return String(value || "")
    .replace(/^premium\s+/i, "")
    .replace(/\s+\d+$/i, "")
    .trim();
}

function countryNames(country) {
  const iso2 = String(country?.code || country?.iso2 || "").trim().toUpperCase();
  return new Set([
    country?.name,
    country?.localName,
    country?.nativeName,
    ...(COUNTRY_ALIASES_BY_ISO[iso2] || []),
  ].map(normalizedCountryName).filter(Boolean));
}

function openEpgDate(value) {
  const match = String(value || "").match(/^(\d{2})-(\d{2})-(\d{2,4})$/);
  if (!match) return 0;
  const year = match[3].length === 4 && match[3].startsWith("00") ? `20${match[3].slice(2)}` : match[3];
  const timestamp = Date.UTC(Number(year), Number(match[2]) - 1, Number(match[1]));
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function openEpgFile(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "www.open-epg.com" || !/^\/files\/[a-z0-9_-]+\.xml$/i.test(url.pathname)) return null;
    return { url: url.href, name: url.pathname.split("/").pop() || "guide.xml" };
  } catch {
    return null;
  }
}

function epgShareSourceForCountry(country) {
  const code = String(country?.code || country?.iso2 || "").trim().toUpperCase();
  if (!EPG_SHARE_COUNTRY_CODES.has(code)) return null;
  const tag = code === "GB" ? "UK1" : `${code}1`;
  return {
    name: `epg_ripper_${tag}.xml.gz`,
    url: `https://epgshare01.online/epgshare01/epg_ripper_${tag}.xml.gz`,
    size: 0,
    provider: "EPGShare01",
    countryCode: code,
  };
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
    const match = url.hostname === "www.open-epg.com" ? url.pathname.match(/^\/files\/([a-z][a-z0-9_-]*?)(\d+)?\.xml$/i) : null;
    if (!match) return null;
    const slug = match[1].toLocaleLowerCase("en-US");
    const special = {
      southafrica: ["ZA", "South Africa"], southkorea: ["KR", "South Korea"],
      unitedarabemirates: ["AE", "United Arab Emirates"], unitedkingdom: ["GB", "United Kingdom"],
      unitedstates: ["US", "United States"], usa: ["US", "United States"], newzealand: ["NZ", "New Zealand"],
      hongkong: ["HK", "Hong Kong"], costarica: ["CR", "Costa Rica"],
    }[slug];
    const countryCode = special?.[0] || "";
    const name = special?.[1] || `${slug[0]?.toUpperCase() || ""}${slug.slice(1)}`;
    return { id: `open-epg:${countryCode || slug}`, name: `${name} · Open EPG`, file: url.pathname.split("/").pop(), countryCode, provider: "Open EPG" };
  } catch {
    return null;
  }
}

function epgShareCountryFromUrl(value) {
  try {
    const url = new URL(value);
    const match = url.hostname === "epgshare01.online"
      ? url.pathname.match(/^\/epgshare01\/epg_ripper_([A-Z]{2})1\.xml\.gz$/)
      : null;
    if (!match) return null;
    const countryCode = match[1] === "UK" ? "GB" : match[1];
    let countryName = countryCode;
    try { countryName = new Intl.DisplayNames(["en"], { type: "region" }).of(countryCode) || countryCode; } catch { /* keep the ISO code */ }
    return { id: `epgshare:${countryCode}`, name: `${countryName} · EPGShare01`, file: url.pathname.split("/").pop(), countryCode, provider: "EPGShare01" };
  } catch {
    return null;
  }
}

export function groupGuideSources(sources, statuses = []) {
  const statusByUrl = new Map((Array.isArray(statuses) ? statuses : []).map((item) => [item.url, item]));
  const groups = new Map();
  for (const url of Array.isArray(sources) ? sources : []) {
    const country = globeTvCountryFromUrl(url) || openEpgCountryFromUrl(url) || epgShareCountryFromUrl(url) || { id: "custom", name: "Custom sources", file: (() => { try { return new URL(url).pathname.split("/").pop() || url; } catch { return url; } })() };
    if (!groups.has(country.id)) groups.set(country.id, { id: country.id, name: country.name, countryCode: country.countryCode || "", provider: country.provider || "GlobeTV", sources: [] });
    groups.get(country.id).sources.push({ url, file: country.file, ...(statusByUrl.get(url) || {}) });
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export class OpenEpgCatalog {
  #catalog;
  #fetch;

  constructor({ catalog, fetchImpl = globalThis.fetch } = {}) {
    this.#catalog = catalog;
    this.#fetch = typeof fetchImpl === "function" ? fetchImpl.bind(globalThis) : fetchImpl;
  }

  async entries({ force = false } = {}) {
    const key = "epg:open-epg:catalog:v1";
    const cached = await this.#catalog?.getSetting?.(key, null);
    if (!force && cached?.fetchedAt && Date.now() - cached.fetchedAt < OPEN_EPG_CACHE_TTL) return cached.items || [];
    try {
      const response = await this.#fetch(OPEN_EPG_CATALOG_URL, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`Open EPG catalog request failed (${response.status})`);
      const rows = await response.json();
      const items = (Array.isArray(rows) ? rows : []).flatMap((row) => {
        const file = openEpgFile(row?.url);
        const updatedAt = openEpgDate(row?.age);
        if (!file || !updatedAt) return [];
        return [{
          ...file,
          country: providerCountryName(row?.cou),
          updatedAt,
          channelCount: Number(row?.cnt) || 0,
          provider: "Open EPG",
        }];
      });
      await this.#catalog?.setSetting?.(key, { fetchedAt: Date.now(), items });
      return items;
    } catch (error) {
      if (cached?.items) return cached.items;
      throw error;
    }
  }

  async countryFor(country, options = {}) {
    const names = countryNames(country);
    const iso2 = String(country?.code || country?.iso2 || "").trim().toUpperCase();
    const now = Date.now();
    return (await this.entries(options))
      .filter((item) => names.has(normalizedCountryName(item.country)))
      .filter((item) => item.updatedAt <= now + 24 * 60 * 60 * 1000 && now - item.updatedAt <= OPEN_EPG_MAX_AGE)
      .map((item) => ({ ...item, countryCode: iso2 }));
  }
}

export class CountryGuideResolver {
  #openEpg;
  #globeTv;

  constructor({ catalog, fetchImpl = globalThis.fetch } = {}) {
    this.#openEpg = new OpenEpgCatalog({ catalog, fetchImpl });
    this.#globeTv = new GlobeTvCatalog({ catalog, fetchImpl });
  }

  async countryFor(country, options = {}) {
    let openEpg = [];
    try { openEpg = await this.#openEpg.countryFor(country, options); } catch { /* use an allowlisted fallback */ }
    const epgShare = epgShareSourceForCountry(country);
    if (openEpg.length) return [...openEpg, ...(epgShare ? [epgShare] : [])];
    if (epgShare) return [epgShare];
    return this.#globeTv.countryFor(country, options);
  }
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
