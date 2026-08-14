export const MULTIVIEW_PRESETS_SETTING = 'multiview:presets';
export const MULTIVIEW_LAYOUT_SETTING = 'multiview:layout';
export const MAX_MULTIVIEW_PRESETS = 8;

function cleanText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

export function normalizeMultiviewPresets(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const presets = [];
  for (const candidate of value.slice(-MAX_MULTIVIEW_PRESETS)) {
    const id = cleanText(candidate?.id, 128);
    const name = cleanText(candidate?.name, 40);
    const layout = Math.max(2, Math.min(4, Math.trunc(Number(candidate?.layout) || 4)));
    const channelIds = [...new Set((Array.isArray(candidate?.channelIds) ? candidate.channelIds : [])
      .map((channelId) => cleanText(channelId, 256))
      .filter(Boolean))].slice(0, 4);
    if (!id || !name || !channelIds.length || seen.has(id)) continue;
    seen.add(id);
    presets.push({ id, name, layout, channelIds });
  }
  return presets;
}

export function isValidMultiviewPresets(value) {
  if (!Array.isArray(value)) return false;
  return JSON.stringify(normalizeMultiviewPresets(value)) === JSON.stringify(value);
}

export function normalizeMultiviewLayout(value, fallback = 4) {
  const layout = Number(value);
  return Number.isInteger(layout) && layout >= 2 && layout <= 4 ? layout : fallback;
}

export function isValidMultiviewLayout(value) {
  return Number.isInteger(value) && value >= 2 && value <= 4;
}

export function resolveMultiviewPresetSync(sharedValue, legacyValue) {
  const hasSharedValue = sharedValue !== null && sharedValue !== undefined;
  const presets = normalizeMultiviewPresets(hasSharedValue ? sharedValue : legacyValue);
  return {
    presets,
    migrateLegacy: !hasSharedValue && presets.length > 0,
  };
}

export function resolveMultiviewLayoutSync(sharedValue, legacyValue) {
  const hasSharedValue = sharedValue !== null && sharedValue !== undefined;
  const hasLegacyValue = legacyValue !== null && legacyValue !== undefined;
  return {
    layout: normalizeMultiviewLayout(hasSharedValue ? sharedValue : legacyValue),
    migrateLegacy: !hasSharedValue && hasLegacyValue,
  };
}
