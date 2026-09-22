function number(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function formatBytes(value) {
  const bytes = number(value);
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / (1024 ** index)).toFixed(index > 1 ? 1 : 0)} ${units[index]}`;
}

function formatRate(value) {
  const rate = number(value);
  return rate > 0 ? `${(rate / 1_000_000).toFixed(2)} Mbps` : 'Measuring…';
}

function formatBuffer(value) {
  return `${number(value).toFixed(1)} s`;
}

function resolution(metrics) {
  const value = metrics?.resolution;
  return value?.width && value?.height ? `${value.width}×${value.height}` : 'N/A';
}

export function singleTelemetry(metrics = {}) {
  const detail = [resolution(metrics), `${number(metrics.frames?.dropped)} drop`].join(' · ');
  return {
    download: formatRate(metrics.downloadThroughput || metrics.bandwidthEstimate || metrics.bitrate),
    received: formatBytes(metrics.loadedBytes),
    buffer: formatBuffer(metrics.bufferSeconds),
    detail,
    issue: Boolean(metrics.waiting),
  };
}

/** Progressive media exposes buffer/frame data, but no reliable transfer counter. */
export function nativeMediaTelemetry(video) {
  let bufferSeconds = 0;
  for (let index = 0; index < (video?.buffered?.length || 0); index += 1) {
    if (video.buffered.start(index) <= video.currentTime && video.buffered.end(index) >= video.currentTime) {
      bufferSeconds = video.buffered.end(index) - video.currentTime;
      break;
    }
  }
  const value = singleTelemetry({
    bufferSeconds,
    resolution: { width: video?.videoWidth, height: video?.videoHeight },
    frames: { dropped: video?.getVideoPlaybackQuality?.().droppedVideoFrames },
    waiting: Boolean(video?.getAttribute('src') && !video.paused && video.readyState < 3),
  });
  return { ...value, download: '—', received: '—' };
}

export function multiviewTelemetry(aggregate = {}, channels = []) {
  const slots = aggregate.slots || [];
  const feeds = slots.map((entry, index) => {
    const metrics = entry.metrics || {};
    return {
      channel: channels[index] || null,
      download: formatRate(metrics.downloadThroughput),
      buffer: formatBuffer(metrics.bufferSeconds),
      resolution: resolution(metrics),
      fps: number(metrics.frames?.fps || metrics.frameRate).toFixed(1),
      dropped: number(metrics.frames?.dropped),
      route: metrics.proxy ? 'proxy' : (metrics.route || 'direct'),
    };
  });
  return {
    download: formatRate(aggregate.downloadThroughput),
    received: formatBytes(aggregate.loadedBytes),
    buffer: formatBuffer(slots.reduce((sum, entry) => sum + number(entry.metrics?.bufferSeconds), 0)),
    feeds,
  };
}
