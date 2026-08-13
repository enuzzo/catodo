function values(presets) {
  return Array.isArray(presets) ? presets.filter(Boolean) : [];
}

export function findMultiviewPreset(presets, id) {
  const target = String(id || '');
  return values(presets).find((preset) => String(preset?.id || '') === target) || null;
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
