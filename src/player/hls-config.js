export const PRIMARY_HLS_CONFIG = Object.freeze({
  capLevelToPlayerSize: true,
  enableWorker: true,
  lowLatencyMode: true,
  maxBufferLength: 30,
  maxMaxBufferLength: 60,
  backBufferLength: 30,
  maxBufferSize: 60 * 1000 * 1000,
  startLevel: -1
});
export const SECONDARY_HLS_CONFIG = Object.freeze({
  capLevelToPlayerSize: true,
  enableWorker: true,
  lowLatencyMode: true,
  maxBufferLength: 12,
  maxMaxBufferLength: 20,
  backBufferLength: 6,
  maxBufferSize: 20 * 1000 * 1000,
  startLevel: 0
});

export function createHlsConfig(options) {
  const settings = options || {};
  const base = settings.secondary ? SECONDARY_HLS_CONFIG : PRIMARY_HLS_CONFIG;
  return Object.assign({}, base, settings.overrides || {});
}
