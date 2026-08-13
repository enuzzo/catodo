export const EXPLORE_CATEGORIES = Object.freeze([
  Object.freeze({ id: "all", label: "All", icon: "squares-four", terms: [] }),
  Object.freeze({ id: "news", label: "News", icon: "newspaper", terms: ["news", "business", "weather"] }),
  Object.freeze({ id: "sports", label: "Sports", icon: "soccer-ball", terms: ["sports"] }),
  Object.freeze({ id: "movies", label: "Movies", icon: "film-strip", terms: ["movies", "series", "entertainment"] }),
  Object.freeze({ id: "music", label: "Music", icon: "music-notes", terms: ["music"] }),
  Object.freeze({ id: "kids", label: "Kids", icon: "smiley", terms: ["kids", "animation"] }),
  Object.freeze({ id: "culture", label: "Culture", icon: "books", terms: ["culture", "documentary", "education", "history", "science"] }),
  Object.freeze({ id: "local", label: "Local", icon: "map-pin", terms: ["local", "regional", "general"] }),
]);

const COLLECTION_COPY = Object.freeze({
  news: ["News around the clock", "Live reporting and perspectives across borders."],
  sports: ["Sports & events", "Live matches, events, analysis and specialist channels."],
  movies: ["Cinema & series", "Movie, series and entertainment channels on air now."],
  music: ["Music television", "Performances, videos and music culture from around the world."],
  kids: ["Kids & animation", "Family-friendly channels from the imported catalog."],
  culture: ["Culture & discovery", "Documentaries, education, history and science."],
  local: ["Local voices", "Regional television and everyday life from many countries."],
});

function valuesFor(channel) {
  return [
    ...(Array.isArray(channel?.categories) ? channel.categories : []),
    ...(Array.isArray(channel?.categoryNames) ? channel.categoryNames : []),
    ...(Array.isArray(channel?.categoryDescriptions)
      ? channel.categoryDescriptions.flatMap((value) => [value?.id, value?.name, value?.description])
      : []),
  ].map((value) => String(value || "").trim().toLocaleLowerCase("en-US")).filter(Boolean);
}

export function matchesExploreCategory(channel, categoryId) {
  if (categoryId === "all") return true;
  const definition = EXPLORE_CATEGORIES.find((item) => item.id === categoryId);
  if (!definition) return false;
  const values = valuesFor(channel);
  return definition.terms.some((term) => values.some((value) => value === term || value.includes(term)));
}

function diverse(values, limit) {
  const output = [];
  const deferred = [];
  const countries = new Set();
  for (const channel of values) {
    const country = String(channel?.countryCode || channel?.country || channel?.countries?.[0] || "");
    if (country && !countries.has(country)) {
      countries.add(country);
      output.push(channel);
    } else deferred.push(channel);
    if (output.length >= limit) return output;
  }
  return [...output, ...deferred].slice(0, limit);
}

function channelId(channel) {
  return String(channel?.channelId || channel?.id || channel?.tvgId || channel?.url || '');
}

function channelName(channel) {
  return String(channel?.name || channel?.tvgName || '').trim();
}

function isDefaultExploreChannel(channel) {
  return [channel?.name, channel?.tvgName, channel?.channelId, channel?.id, channel?.tvgId]
    .map((value) => String(value || '').toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/g, ''))
    .some((value) => value.startsWith('euronewsitalian') || value.startsWith('euronewsitalia'));
}

function channelCountry(channel) {
  return String(channel?.country || channel?.countryName || channel?.countryCode || channel?.countries?.[0] || '').trim();
}

function channelCountryCode(channel) {
  return String(channel?.countryCode || channel?.tvgCountry || channel?.countries?.[0] || channel?.country || '')
    .trim()
    .toLocaleUpperCase('en-US');
}

export function filterExploreChannelsByCountry(channels, countryCode = '') {
  const values = Array.isArray(channels) ? channels.filter(Boolean) : [];
  const selected = String(countryCode || '').trim().toLocaleUpperCase('en-US');
  if (!selected) return [...values];
  return values.filter((channel) => channelCountryCode(channel) === selected);
}

export function buildExploreCountryOptions(channels) {
  const countries = new Map();
  (Array.isArray(channels) ? channels : []).filter(Boolean).forEach((channel) => {
    const code = channelCountryCode(channel);
    if (!code) return;
    const label = channelCountry(channel) || code;
    const existing = countries.get(code);
    countries.set(code, {
      code,
      label: existing?.label || label,
      count: (existing?.count || 0) + 1,
    });
  });
  return [...countries.values()].sort((left, right) =>
    left.label.localeCompare(right.label, 'en', { sensitivity: 'base' })
      || left.code.localeCompare(right.code, 'en', { sensitivity: 'base' }));
}

export function exploreQualityScore(channel) {
  const value = String(channel?.quality || channel?.streamQuality || channel?.resolution || channel?.feedFormat || '')
    .trim()
    .toLocaleLowerCase('en-US');
  if (!value) return 0;
  if (/\b8k\b/.test(value)) return 4320;
  if (/\b(?:4k|uhd)\b/.test(value)) return 2160;
  if (/\b(?:fhd|full\s*hd)\b/.test(value)) return 1080;
  const numeric = value.match(/\b(\d{3,4})\s*p?\b/);
  if (numeric) return Number(numeric[1]) || 0;
  if (/\bhd\b/.test(value)) return 720;
  if (/\bsd\b/.test(value)) return 480;
  return 0;
}

export function sortExploreChannels(channels, sort = 'relevance') {
  const values = Array.isArray(channels) ? channels.filter(Boolean) : [];
  if (sort === 'relevance') return [...values];
  return values
    .map((channel, index) => ({ channel, index }))
    .sort((left, right) => {
      if (sort === 'name') {
        return channelName(left.channel).localeCompare(channelName(right.channel), 'en', { sensitivity: 'base' })
          || left.index - right.index;
      }
      if (sort === 'quality') {
        return exploreQualityScore(right.channel) - exploreQualityScore(left.channel)
          || channelName(left.channel).localeCompare(channelName(right.channel), 'en', { sensitivity: 'base' })
          || left.index - right.index;
      }
      if (sort === 'country') {
        return channelCountry(left.channel).localeCompare(channelCountry(right.channel), 'en', { sensitivity: 'base' })
          || channelName(left.channel).localeCompare(channelName(right.channel), 'en', { sensitivity: 'base' })
          || left.index - right.index;
      }
      return left.index - right.index;
    })
    .map(({ channel }) => channel);
}

function shuffled(values, rng) {
  const output = [...values];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.max(0, Math.min(0.999999, Number(rng()) || 0)) * (index + 1));
    [output[index], output[target]] = [output[target], output[index]];
  }
  return output;
}

export function randomizeExploreChannels(channels, { limit = 8, previousIds = [], rng = Math.random } = {}) {
  const values = Array.isArray(channels) ? channels.filter(Boolean) : [];
  const previous = new Set(Array.isArray(previousIds) ? previousIds.map(String) : []);
  const fresh = shuffled(values.filter((channel) => !previous.has(channelId(channel))), rng);
  const repeated = shuffled(values.filter((channel) => previous.has(channelId(channel))), rng);
  return diverse([...fresh, ...repeated], Math.max(0, Number(limit) || 0));
}

export function buildExploreCollections(channels, { activeCategory = "all", limit = 12 } = {}) {
  const values = Array.isArray(channels) ? channels.filter(Boolean) : [];
  const categories = activeCategory === "all"
    ? EXPLORE_CATEGORIES.filter((item) => item.id !== "all")
    : EXPLORE_CATEGORIES.filter((item) => item.id === activeCategory);
  const collections = categories.map((definition) => {
    const [title, description] = COLLECTION_COPY[definition.id] || [definition.label, "Live channels from your catalog."];
    return {
      ...definition,
      title,
      description,
      channels: diverse(values.filter((channel) => matchesExploreCategory(channel, definition.id)), limit),
    };
  }).filter((collection) => collection.channels.length);

  if (collections.length) return collections;
  if (activeCategory !== 'all') {
    const definition = EXPLORE_CATEGORIES.find((item) => item.id === activeCategory);
    if (definition) {
      const [title, description] = COLLECTION_COPY[definition.id] || [definition.label, 'Live channels from your catalog.'];
      return [{ ...definition, title, description, channels: [] }];
    }
  }
  return [{
    id: "world",
    label: "World",
    icon: "globe-hemisphere-west",
    title: "Across the world",
    description: "A country-diverse selection from your imported channels.",
    channels: diverse(values, limit),
  }];
}

export function pickExploreFeatured(collections, currentId = "") {
  const values = Array.isArray(collections) ? collections : [];
  const channels = values.flatMap((collection) => collection.channels || []);
  return channels.find((channel) => String(channel?.channelId || channel?.id || "") === String(currentId))
    || channels.find(isDefaultExploreChannel)
    || channels[0]
    || null;
}
