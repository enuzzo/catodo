const GUIDE_SCAN_LIMIT = 320;

export function hasMappedGuide(channel) {
  return Boolean(channel?.hasGuide || channel?.guides?.length || channel?.endpoints?.some((endpoint) => endpoint?.guides?.length));
}

export function guideScanCandidates(channels, { customSource = false } = {}) {
  const mapped = channels.filter(hasMappedGuide).slice(0, GUIDE_SCAN_LIMIT);
  if (!customSource || mapped.length === GUIDE_SCAN_LIMIT) return mapped;
  const unmapped = channels.filter((channel) => !hasMappedGuide(channel));
  return mapped.concat(unmapped.slice(0, GUIDE_SCAN_LIMIT - mapped.length));
}

function countryGuideControlState({
  sourceCount = 0,
  configuredCount = 0,
  loading = false,
  checking = false,
  error = false,
  unavailable = false,
} = {}) {
  const sources = Math.max(0, Number(sourceCount) || 0);
  const configured = Math.max(0, Number(configuredCount) || 0);
  const connected = sources > 0 && configured >= sources;

  if (loading) return { connected, disabled: true, label: 'Loading guide…', status: 'loading' };
  if (checking) return { connected, disabled: true, label: 'Checking guide…', status: 'checking' };
  if (connected) return { connected, disabled: true, label: 'Guide loaded', status: 'connected' };
  if (sources) return { connected, disabled: false, label: 'Load guide', status: 'available' };
  if (error) return { connected, disabled: false, label: 'Retry guide check', status: 'error' };
  if (unavailable) return { connected, disabled: false, label: 'Check again', status: 'unavailable' };
  return { connected, disabled: false, label: 'Find & load guide', status: 'idle' };
}

function guideProgrammeFallback(status) {
  switch (String(status || 'unconfigured')) {
    case 'stale':
      return { key: 'guide.dataOutdatedShort', fallback: 'Guide outdated' };
    case 'unmatched':
      return { key: 'guide.noMatchShort', fallback: 'No guide match' };
    case 'ready':
      return { key: 'guide.noCurrentProgrammeShort', fallback: 'No current programme' };
    case 'error':
      return { key: 'guide.noDataShort', fallback: 'Guide unavailable' };
    default:
      return { key: 'guide.notConnectedShort', fallback: 'Guide not connected' };
  }
}

function channelGuideSetupAction({ status = 'unconfigured', countryCode = '' } = {}) {
  if (String(status || 'unconfigured') !== 'unconfigured') return { action: '', iso2: '' };
  const iso2 = String(countryCode || '').trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(iso2)) return { action: 'open-favorite-guide-setup', iso2 };
  return { action: 'open-guide-settings', iso2: '' };
}

export { channelGuideSetupAction, countryGuideControlState, guideProgrammeFallback };
