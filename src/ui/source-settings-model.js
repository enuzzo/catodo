import { sourcePreset } from '../data/source-presets.js';

export function connectedWorldSource(sources = []) {
  const presetUrl = sourcePreset('world-all').url;
  return sources.find((source) => {
    try {
      const url = new URL(source.url);
      url.hash = '';
      return url.href === presetUrl;
    } catch { return false; }
  }) || null;
}
