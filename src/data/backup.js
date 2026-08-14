import { normalizeMultiviewLayout, normalizeMultiviewPresets } from './multiview-presets.js';

export function createConfigurationBackup({
  sources = [],
  favorites = [],
  proxy = '',
  guideSources = [],
  guideRefreshMinutes = 360,
  multiviewLayout = 4,
  multiviewPresets = [],
  exportedAt = new Date().toISOString(),
} = {}) {
  return {
    schema: 'catodo-backup',
    version: 1,
    exportedAt,
    sources: (Array.isArray(sources) ? sources : []).map(({ name, url, trusted }) => ({ name, url, trusted })),
    favorites: [...(favorites || [])],
    settings: {
      proxy: String(proxy || ''),
      guideSources: [...(Array.isArray(guideSources) ? guideSources : [])],
      guideRefreshMinutes,
      multiviewLayout: normalizeMultiviewLayout(multiviewLayout),
    },
    multiviewPresets: normalizeMultiviewPresets(multiviewPresets),
  };
}
