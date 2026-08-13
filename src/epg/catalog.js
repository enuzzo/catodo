const ROOT_URL = "https://api.github.com/repos/globetvapp/epg/contents";
const CACHE_TTL = 24 * 60 * 60 * 1000;

function countryLabel(value) {
  const known = {
    Costarica: "Costa Rica",
    Newzealand: "New Zealand",
    Saudiarabia: "Saudi Arabia",
    Southafrica: "South Africa",
    Southkorea: "South Korea",
    Unitedarabemirates: "United Arab Emirates",
    Unitedkingdom: "United Kingdom",
    Usa: "United States",
  };
  return known[value] || String(value || "").replace(/([a-z])([A-Z])/g, "$1 $2");
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

export function groupGuideSources(sources, statuses = []) {
  const statusByUrl = new Map((Array.isArray(statuses) ? statuses : []).map((item) => [item.url, item]));
  const groups = new Map();
  for (const url of Array.isArray(sources) ? sources : []) {
    const country = globeTvCountryFromUrl(url) || { id: "custom", name: "Custom sources", file: (() => { try { return new URL(url).pathname.split("/").pop() || url; } catch { return url; } })() };
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
}
