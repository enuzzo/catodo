function values(presets) {
  return Array.isArray(presets) ? presets.filter(Boolean) : [];
}

export function findMultiviewPreset(presets, id) {
  const target = String(id || '');
  return values(presets).find((preset) => String(preset?.id || '') === target) || null;
}

export function defaultMultiviewPresetState(presets, incomingId = '') {
  const preset = values(presets)[0] || null;
  if (!preset) return null;
  const channelIds = [...new Set((Array.isArray(preset.channelIds) ? preset.channelIds : [])
    .map((id) => String(id || ''))
    .filter(Boolean))];
  const incoming = String(incomingId || '');
  if (!incoming || channelIds.includes(incoming)) return { preset, channelIds, customized: false };
  return {
    preset,
    channelIds: channelIds.length ? [incoming, ...channelIds.slice(1)] : [incoming],
    customized: true,
  };
}

export function renameMultiviewPreset(presets, id, name) {
  const target = String(id || '');
  const nextName = String(name || '').trim().slice(0, 40);
  if (!target || !nextName) return [...values(presets)];
  return values(presets).map((preset) => String(preset?.id || '') === target
    ? { ...preset, name: nextName }
    : preset);
}

export function deleteMultiviewPreset(presets, id) {
  const target = String(id || '');
  return values(presets).filter((preset) => String(preset?.id || '') !== target);
}
