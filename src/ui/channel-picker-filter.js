function pickerText(channel) {
  return [
    channel?.name,
    channel?.tvgName,
    channel?.officialName,
    ...(channel?.aliases || []),
    ...(channel?.countryNames || []),
    ...(channel?.countries || []),
    ...(channel?.languageNames || []),
    ...(channel?.languages || []),
    ...(channel?.categories || []),
  ].filter(Boolean).join(' ').toLocaleLowerCase('en-US');
}

export function filterChannelPicker(channels, options = {}) {
  const query = String(options.query || '').trim().toLocaleLowerCase('en-US');
  const excludedIds = options.excludedIds || new Set();
  const getId = options.getId || ((channel) => String(channel?.channelId || channel?.id || ''));
  const limit = Math.max(1, Number(options.limit) || 60);
  return (channels || [])
    .filter((channel) => !excludedIds.has(getId(channel)))
    .filter((channel) => !query || pickerText(channel).includes(query))
    .slice(0, limit);
}
