const GLOBETV_ITALY_URLS = Object.freeze(Array.from({ length: 5 }, (_, index) =>
  `https://raw.githubusercontent.com/globetvapp/epg/main/Italy/italy${index + 1}.xml`,
));

export const EPG_PRESETS = Object.freeze([
  Object.freeze({
    id: "globetv-italy",
    name: "GlobeTV · Italy",
    provider: "GlobeTV",
    description: "Five plain XMLTV country feeds, published daily.",
    cadence: "Daily at 03:00 UTC",
    license: "GPL-3.0",
    sourceUrl: "https://github.com/globetvapp/epg",
    urls: GLOBETV_ITALY_URLS,
  }),
]);

export function epgPreset(id) {
  return EPG_PRESETS.find((preset) => preset.id === String(id || "")) || null;
}
