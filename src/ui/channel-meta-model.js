function metadataText(value) {
  if (value === undefined || value === null || typeof value === 'boolean') return '';
  if (Array.isArray(value)) return value.map(metadataText).find(Boolean) || '';
  if (typeof value === 'object') return metadataText(value.name ?? value.label ?? value.code ?? value.id);
  const text = String(value).trim();
  return /^(?:undefined|null|n\/?a|none)$/i.test(text) ? '' : text;
}

function firstValue(...values) {
  return values.map(metadataText).find(Boolean) || '';
}

export function channelMetadataBadges(channel) {
  const value = channel && typeof channel === 'object' ? channel : {};
  const endpoint = (Array.isArray(value.endpoints) ? value.endpoints : []).find((item) => item && typeof item === 'object')
    || (value.endpoint && typeof value.endpoint === 'object' ? value.endpoint : {});
  const genre = firstValue(
    value.categoryNames,
    value.category_names,
    (Array.isArray(value.categoryDescriptions) ? value.categoryDescriptions : []).map((item) => item?.name ?? item?.label),
    value.categories,
    value.category,
    value.groupTitle,
  );
  const badges = [
    {
      type: 'country',
      icon: 'map-pin',
      value: firstValue(value.countryName, value.countryNames, value.country, value.countries, value.countryCode, value.iso2),
    },
    {
      type: 'language',
      icon: 'translate',
      value: firstValue(value.languageName, value.languageNames, value.language, value.languages, value.languageCode),
    },
    {
      type: 'quality',
      icon: 'monitor-play',
      value: firstValue(value.quality, value.streamQuality, value.resolution, endpoint.quality, value.feedFormat, endpoint.feedFormat),
    },
    { type: 'genre', icon: 'tag', value: genre },
  ];
  return badges.filter((badge) => badge.value);
}
