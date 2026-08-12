import { get, put } from "./db.js";
import worldMap from "../../assets/vendor/map/world-map.js";

export const COUNTRIES_API_URL = "https://iptv-org.github.io/api/countries.json";
const FALLBACK_LANGUAGES = Object.freeze({
  IT: ["ita"], CH: ["deu", "fra", "ita"], DE: ["deu"], FR: ["fra"],
  GB: ["eng"], US: ["eng"], ES: ["spa"], PT: ["por"], BR: ["por"],
  CA: ["eng", "fra"], MX: ["spa"], AR: ["spa"], AU: ["eng"], JP: ["jpn"],
});
export const FALLBACK_COUNTRIES = Object.freeze(
  worldMap.locations
    .map((item) => ({
      code: String(item.id || "").toUpperCase(),
      name: item.name,
      languages: FALLBACK_LANGUAGES[String(item.id || "").toUpperCase()] || [],
    }))
    .filter((item) => /^[A-Z]{2}$/.test(item.code) && item.name)
    .sort((left, right) => left.name.localeCompare(right.name)),
);

const CACHE_KEY = "directory:countries";
const DEFAULT_TIMEOUT_MS = 8_000;

export async function loadCountries(db, options = {}) {
  const maxAge = options.maxAge ?? 7 * 24 * 60 * 60 * 1000;
  const cached = await get(db, "settings", CACHE_KEY);
  if (cached?.value?.length && Date.now() - cached.updatedAt < maxAge && !options.force) return cached.value;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const response = await (options.fetchImpl || globalThis.fetch)(COUNTRIES_API_URL, { cache: "no-cache", signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const raw = await response.json();
    const countries = raw.map((item) => ({ code: String(item.code || "").toUpperCase(), name: item.name, flag: item.flag || "", languages: item.languages || [] })).filter((item) => /^[A-Z]{2}$/.test(item.code) && item.name);
    await put(db, "settings", { key: CACHE_KEY, value: countries, updatedAt: Date.now() });
    return countries;
  } catch {
    return cached?.value?.length ? cached.value : [...FALLBACK_COUNTRIES];
  } finally {
    clearTimeout(timer);
  }
}
