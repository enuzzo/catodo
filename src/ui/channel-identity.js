function safeString(value, fallback = '') {
  return value === undefined || value === null ? fallback : String(value);
}

function escapePattern(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function featuredChannelIdentity(channel, qualityValue, fallback = '') {
  const value = channel && typeof channel === 'object' ? channel : {};
  const rawName = safeString(value.name, fallback).trim();
  const quality = safeString(qualityValue).trim();
  const availabilityPattern = /\s*[\[(]\s*NOT\s+24\s*[\/x]\s*7\s*[\])]\s*$/i;
  const notAlwaysOn = Boolean(value.notAlwaysOn || value.not24x7 || availabilityPattern.test(rawName));
  let displayName = rawName.replace(availabilityPattern, '').trim();

  if (quality) {
    const qualityPattern = new RegExp(`\\s*[\\[(]\\s*${escapePattern(quality)}\\s*[\\])]\\s*$`, 'i');
    displayName = displayName.replace(qualityPattern, '').trim();
  }

  return { rawName, displayName: displayName || rawName, notAlwaysOn };
}
