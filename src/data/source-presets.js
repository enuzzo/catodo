const IPTV_ORG_BASE = "https://iptv-org.github.io/iptv";

const preset = (id, name, description, path, dimension, icon) => Object.freeze({
  id,
  name,
  description,
  url: `${IPTV_ORG_BASE}/${path}`,
  provider: "iptv-org",
  host: "iptv-org.github.io",
  source: "Official public playlist directory",
  sourceUrl: "https://github.com/iptv-org/iptv/blob/master/PLAYLISTS.md",
  dimension,
  icon,
});

export const SOURCE_PRESETS = Object.freeze([
  preset("world-all", "Worldwide — all channels", "The complete public directory, grouped by country.", "index.m3u", "global", "globe-hemisphere-west"),
  preset("world-country", "Worldwide by country", "The complete directory with country groupings.", "index.country.m3u", "global", "map-trifold"),
  preset("world-language", "Worldwide by language", "The complete directory arranged by broadcast language.", "index.language.m3u", "global", "translate"),
  preset("world-category", "Worldwide by category", "The complete directory arranged by genre and category.", "index.category.m3u", "global", "squares-four"),
  preset("region-europe", "Europe", "A broad regional playlist for European television.", "regions/eur.m3u", "region", "broadcast"),
  preset("region-americas", "Americas", "North, Central and South American public channels.", "regions/amer.m3u", "region", "broadcast"),
  preset("region-asia", "Asia", "Public television sources from across Asia.", "regions/asia.m3u", "region", "broadcast"),
  preset("region-africa", "Africa", "Public television sources from across Africa.", "regions/afr.m3u", "region", "broadcast"),
  preset("category-news", "World News", "News channels from the worldwide directory.", "categories/news.m3u", "category", "newspaper"),
  preset("category-sports", "World Sports", "Sports channels from the worldwide directory.", "categories/sports.m3u", "category", "soccer-ball"),
  preset("category-movies", "World Movies", "Movie channels from the worldwide directory.", "categories/movies.m3u", "category", "film-strip"),
  preset("category-music", "World Music", "Music television from the worldwide directory.", "categories/music.m3u", "category", "music-notes"),
]);

export function sourcePreset(id) {
  return SOURCE_PRESETS.find((item) => item.id === String(id || "")) || null;
}
