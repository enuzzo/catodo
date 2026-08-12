const REGION_CODES = Object.freeze({
  europe: "AD AL AT AX BA BE BG BY CH CY CZ DE DK EE ES FI FO FR GB GG GI GR HR HU IE IM IS IT JE LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SJ SK SM UA VA XK",
  americas: "AG AI AR AW BB BL BM BO BQ BR BS BZ CA CL CO CR CU CW DM DO EC FK GD GF GL GP GS GT GY HN HT JM KN KY LC MF MQ MS MX NI PA PE PM PR PY SR SV SX TC TT US UY VC VE VG VI",
  asia: "AE AF AM AZ BD BH BN BT CN GE HK ID IL IN IO IQ IR JO JP KG KH KP KR KW KZ LA LB LK MM MN MO MV MY NP OM PH PK PS QA SA SG SY TH TJ TM TR TW UZ VN YE",
  africa: "AO BF BI BJ BW CD CF CG CI CM CV DJ DZ EG EH ER ET GA GH GM GN GQ GW KE KM LR LS LY MA MG ML MR MU MW MZ NA NE NG RE RW SC SD SH SL SN SO SS ST SZ TD TG TN TZ UG YT ZA ZM ZW",
  // Antarctica and remote islands are grouped with their nearest practical UI region.
  oceania: "AQ AU BV CC CK CX FJ FM GU HM KI MH MP NC NF NR NU NZ PF PG PN PW SB TF TK TO TV UM VU WF WS",
});

const COUNTRY_REGIONS = new Map(
  Object.entries(REGION_CODES).flatMap(([region, codes]) => codes.split(" ").map((code) => [code, region])),
);

const NORTH_AMERICA = new Set("AG AI AW BB BL BM BQ BS BZ CA CR CU CW DM DO GD GL GP GT HN HT JM KN KY LC MF MQ MS MX NI PA PM PR SV SX TC TT US VC VG VI".split(" "));
const SOUTH_AMERICA = new Set("AR BO BR CL CO EC FK GF GS GY PE PY SR UY VE".split(" "));

function normalizeCode(code) {
  return typeof code === "string" ? code.trim().toUpperCase() : "";
}

/**
 * Return the UI macro-region for an ISO 3166-1 alpha-2 code, or null if unknown.
 * Transcontinental countries follow the pragmatic convention used by the browse UI:
 * Russia is Europe; Turkey, Cyprus, the Caucasus, and Kazakhstan are Asia. Overseas
 * territories are placed with their physical region (with remote polar islands in Oceania).
 */
export function regionForCountry(code) {
  return COUNTRY_REGIONS.get(normalizeCode(code)) || null;
}

/**
 * Keep country records in a macro-region. `all` returns the original collection unchanged.
 */
export function filterCountriesByRegion(countries, region) {
  if (!Array.isArray(countries)) return [];
  if (region === "all") return countries;
  if (region === "north-america") return countries.filter((country) => NORTH_AMERICA.has(normalizeCode(typeof country === "string" ? country : country?.code)));
  if (region === "south-america") return countries.filter((country) => SOUTH_AMERICA.has(normalizeCode(typeof country === "string" ? country : country?.code)));
  return countries.filter((country) => regionForCountry(typeof country === "string" ? country : country?.code) === region);
}
