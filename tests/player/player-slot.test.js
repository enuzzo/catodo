import test from "node:test";
import assert from "node:assert/strict";
import { PlayerSlot } from "../../src/player/player-slot.js";
import { FakeHls, FakeVideo } from "./fakes.js";

test("PlayerSlot attaches, tunes muted through Hls, and destroys cleanly", async () => {
  FakeHls.instances.length = 0;
  const video = new FakeVideo();
  const slot = new PlayerSlot({ id: "left", video: video, HlsClass: FakeHls });

  await slot.tune("https://example.test/live.m3u8");
  const hls = FakeHls.instances[0];

  assert.equal(video.autoplay, true);
  assert.equal(video.muted, true);
  assert.equal(video.playsInline, true);
  assert.equal(hls.url, "https://example.test/live.m3u8");
  assert.equal(hls.video, video);
  assert.equal(hls.config.capLevelToPlayerSize, true);
  assert.equal(video.playCalls, 1);

  slot.destroy();
  slot.destroy();
  assert.equal(hls.destroyCalls, 1);
  assert.equal(video.pauseCalls, 1);
  assert.deepEqual(video.removedAttributes, ["src"]);
});

test("PlayerSlot recovers media errors, retries network errors, then falls back", async () => {
  FakeHls.instances.length = 0;
  const slot = new PlayerSlot({
    video: new FakeVideo(),
    HlsClass: FakeHls,
    maxRetries: 0,
    maxMediaRecoveries: 1,
    retryDelayMs: 0
  });
  await slot.tune({
    url: "https://one.test/live.m3u8",
    fallbackUrl: "https://two.test/live.m3u8"
  });

  const first = FakeHls.instances[0];
  first.emit(FakeHls.Events.ERROR, { fatal: true, type: FakeHls.ErrorTypes.MEDIA_ERROR });
  assert.equal(first.recoverCalls, 1);

  first.emit(FakeHls.Events.ERROR, { fatal: true, type: FakeHls.ErrorTypes.MEDIA_ERROR });
  await Promise.resolve();
  const second = FakeHls.instances[1];
  assert.equal(first.destroyCalls, 1);
  assert.equal(second.url, "https://two.test/live.m3u8");
  slot.destroy();
});

test("PlayerSlot reports provider connection phases with endpoint context", async () => {
  FakeHls.instances.length = 0;
  const phases = [];
  const slot = new PlayerSlot({
    video: new FakeVideo(),
    HlsClass: FakeHls,
    onEvent: (type, detail) => {
      if (type === "progress") phases.push(detail);
    },
  });
  await slot.tune({
    url: "https://one.test/live.m3u8",
    fallbackUrl: "https://two.test/live.m3u8",
  });
  const hls = FakeHls.instances[0];
  hls.emit(FakeHls.Events.MANIFEST_LOADING);
  hls.emit(FakeHls.Events.MANIFEST_PARSED);
  hls.emit(FakeHls.Events.FRAG_LOADING);
  hls.emit(FakeHls.Events.FRAG_BUFFERED);
  assert.deepEqual(phases.map((entry) => entry.phase), [
    "manifest-loading",
    "manifest-parsed",
    "fragment-loading",
    "buffering",
  ]);
  assert.ok(phases.every((entry) => entry.endpointCount === 2 && entry.endpointIndex === 0));
  slot.destroy();
});
