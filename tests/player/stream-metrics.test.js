import test from "node:test";
import assert from "node:assert/strict";
import { StreamMetrics } from "../../src/player/stream-metrics.js";
import { FakeHls, FakeVideo } from "./fakes.js";

test("StreamMetrics does not double count fragments or repeated waiting events", () => {
  const video = new FakeVideo();
  const hls = new FakeHls({});
  const metrics = new StreamMetrics({ video: video, sampleIntervalMs: 60_000 });
  metrics.start();
  metrics.bindHls(hls, FakeHls);
  metrics.setRoute("proxy", true);

  const fragment = {
    frag: {
      level: 0,
      cc: 1,
      sn: 42,
      urlId: 0,
      stats: { loaded: 1_000_000, loading: { start: 100, end: 1100 } },
    },
    payload: new Uint8Array(1_000_000),
  };
  hls.emit(FakeHls.Events.FRAG_LOADED, fragment);
  hls.emit(FakeHls.Events.FRAG_LOADED, fragment);
  video.dispatchEvent(new Event("playing"));
  video.dispatchEvent(new Event("waiting"));
  video.dispatchEvent(new Event("waiting"));
  video.webkitAudioDecodedByteCount = 4096;
  metrics.sample();

  const snapshot = metrics.snapshot();
  assert.equal(snapshot.loadedBytes, 1_000_000);
  assert.equal(snapshot.downloadThroughput, 8_000_000);
  assert.equal(snapshot.bandwidthEstimate, 6_000_000);
  assert.deepEqual(snapshot.resolution, { width: 1920, height: 1080 });
  assert.equal(snapshot.rebuffers, 1);
  assert.equal(snapshot.bufferSeconds, 10);
  assert.equal(snapshot.route, "proxy");
  assert.equal(snapshot.proxy, true);
  assert.equal(snapshot.uploadDisplay, "N/A");
  assert.equal(snapshot.labels.downloadThroughput, "measured");
  assert.equal(snapshot.labels.bandwidthEstimate, "estimated");
  assert.equal(snapshot.labels.bitrate, "manifest");
  assert.deepEqual(snapshot.audio, {
    codec: "mp4a.40.2",
    decodedBytes: 4096,
    decoded: true,
    muted: false,
    volume: 1,
    paused: true,
    readyState: 4,
  });
  assert.equal(snapshot.labels.audioDecodedBytes, "measured");

  video.dispatchEvent(new Event("playing"));
  video.dispatchEvent(new Event("waiting"));
  assert.equal(metrics.snapshot().rebuffers, 2);
  metrics.destroy();
});
