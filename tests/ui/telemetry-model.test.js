import test from 'node:test';
import assert from 'node:assert/strict';

import { multiviewTelemetry, singleTelemetry } from '../../src/ui/telemetry-model.js';

test('single telemetry reports measured playback values and honest upload availability', () => {
  assert.deepEqual(singleTelemetry({
    downloadThroughput: 2_500_000,
    bufferSeconds: 8.25,
    resolution: { width: 1920, height: 1080 },
    frames: { dropped: 3 },
    waiting: false,
  }), {
    download: '2.50 Mbps', upload: 'N/A', buffer: '8.3 s', detail: '1920×1080 · 3 drop', issue: false,
  });
});

test('multiview telemetry aggregates totals and preserves per-slot measurements', () => {
  const value = multiviewTelemetry({
    downloadThroughput: 3_000_000,
    loadedBytes: 1_572_864,
    slots: [
      { metrics: { downloadThroughput: 1_000_000, bufferSeconds: 2, resolution: { width: 1280, height: 720 }, frames: { fps: 25, dropped: 1 }, route: 'direct' } },
      { metrics: { downloadThroughput: 2_000_000, bufferSeconds: 3, frames: { fps: 30, dropped: 0 }, proxy: true } },
    ],
  }, [{ name: 'One' }, { name: 'Two' }]);
  assert.equal(value.download, '3.00 Mbps');
  assert.equal(value.received, '1.5 MB');
  assert.equal(value.buffer, '5.0 s');
  assert.equal(value.upload, 'N/A');
  assert.deepEqual(value.feeds.map((feed) => [feed.channel.name, feed.download, feed.route]), [
    ['One', '1.00 Mbps', 'direct'], ['Two', '2.00 Mbps', 'proxy'],
  ]);
});
