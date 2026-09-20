// Older playlists stored a whole group-title as one category. Normalize at the
// read boundary too, so existing libraries do not need a destructive migration.
export function channelCategories(channel = {}) {
  const values = [channel.categories, channel.categoryNames].flatMap((value) => Array.isArray(value) ? value : []);
  const categories = new Map();
  for (const value of values) {
    for (const label of String(value || '').split(/[;|]/).map((item) => item.trim()).filter(Boolean)) {
      const key = label.toLocaleLowerCase('en-US');
      if (!categories.has(key)) categories.set(key, label);
    }
  }
  return [...categories.values()];
}

export function categoryOptions(channels = []) {
  const options = new Map();
  for (const channel of channels) {
    for (const label of channelCategories(channel)) {
      const key = label.toLocaleLowerCase('en-US');
      if (!options.has(key)) options.set(key, label);
    }
  }
  return [...options.values()].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
}
