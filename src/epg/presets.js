export const LEGACY_GLOBETV_ITALY_URLS = Object.freeze(Array.from({ length: 5 }, (_, index) =>
  `https://raw.githubusercontent.com/globetvapp/epg/main/Italy/italy${index + 1}.xml`,
));

export const OPEN_EPG_ITALY_URLS = Object.freeze(Array.from({ length: 8 }, (_, index) =>
  `https://www.open-epg.com/files/italy${index + 1}.xml`,
));

export const EPG_PRESETS = Object.freeze([
  Object.freeze({
    id: "open-epg-italy",
    name: "Open EPG · Italy",
    provider: "Open EPG",
    description: "Eight current plain XMLTV feeds for Italian television.",
    cadence: "Updated daily",
    license: "Provider terms",
    sourceUrl: "https://www.open-epg.com/app/epgguide.php",
    countryCodes: Object.freeze(["IT"]),
    urls: OPEN_EPG_ITALY_URLS,
  }),
]);

export function migrateKnownEpgSources(sources) {
  const values = Array.isArray(sources) ? sources : [];
  const legacy = new Set(LEGACY_GLOBETV_ITALY_URLS);
  if (!values.some((url) => legacy.has(String(url)))) return [...values];
  return [...new Set([
    ...values.filter((url) => !legacy.has(String(url))),
    ...OPEN_EPG_ITALY_URLS,
  ])];
}

export function epgPreset(id) {
  return EPG_PRESETS.find((preset) => preset.id === String(id || "")) || null;
}

export function epgPresetsForCountry(iso2) {
  const code = String(iso2 || "").trim().toUpperCase();
  return EPG_PRESETS.filter((preset) => preset.countryCodes?.includes(code));
}
