const playable = (channel) => Array.isArray(channel?.endpoints) && channel.endpoints.some((endpoint) => endpoint?.url && !["rtmp", "rtsp", "unknown"].includes(endpoint.kind));
const safeForRandom = (channel) => !channel?.blocked
  && !(Array.isArray(channel?.blocklist) && channel.blocklist.length)
  && !channel?.isNsfw
  && !channel?.is_nsfw
  && !channel?.closed;
function choose(values, rng) {
  return values.length ? values[Math.min(values.length - 1, Math.floor(rng() * values.length))] : null;
}

function withoutCurrent(channels, currentChannelId) {
  const candidates = channels.filter((channel) => safeForRandom(channel) && playable(channel));
  const alternatives = candidates.filter((channel) => channel.channelId !== currentChannelId);
  return alternatives.length ? alternatives : candidates;
}

export function randomPlayable(channels, options = {}) {
  const rng = options.rng || Math.random;
  const candidates = withoutCurrent(channels, options.currentChannelId);
  if (!candidates.length) return null;
  const dimensions = options.dimensions || ["countries", "categories", "sources"];
  const dimension = choose(dimensions, rng);
  const groups = new Map();
  for (const channel of candidates) {
    const values = channel[dimension]?.length ? channel[dimension] : ["__unknown"];
    for (const value of values) {
      if (!groups.has(value)) groups.set(value, []);
      groups.get(value).push(channel);
    }
  }
  return choose(choose([...groups.values()], rng) || candidates, rng);
}

export function randomWorld(channels, options = {}) {
  return randomPlayable(channels, { ...options, dimensions: ["countries"] });
}

export function countryStats(channels) {
  const stats = new Map();
  for (const channel of channels) {
    for (const country of channel.countries?.length ? channel.countries : ["UN"]) {
      const item = stats.get(country) || { country, channels: 0, playable: 0, endpoints: 0, languages: new Set(), categories: new Set() };
      item.channels += 1;
      item.playable += playable(channel) ? 1 : 0;
      item.endpoints += channel.endpoints?.length || 0;
      channel.languages?.forEach((language) => item.languages.add(language));
      channel.categories?.forEach((category) => item.categories.add(category));
      stats.set(country, item);
    }
  }
  return [...stats.values()].map((item) => ({ ...item, languages: [...item.languages], categories: [...item.categories] })).sort((a, b) => b.channels - a.channels || a.country.localeCompare(b.country));
}
