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
  sports: ["Sports & events", "Live matches, analysis and specialist channels."],
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
    || channels[0]
    || null;
}
