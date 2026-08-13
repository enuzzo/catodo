import test from "node:test";
import assert from "node:assert/strict";
import { PlayerManager } from "../../src/player/player-manager.js";
import { releasePlayerForTransition } from "../../src/player/player-transition.js";
import { FakeSlot, FakeVideo } from "./fakes.js";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test("player transition silences media before fullscreen exit and then releases it", async () => {
  const video = new FakeVideo();
  await video.play();
  video.muted = false;
  const slot = new FakeSlot({ id: "main", video });
  const manager = new PlayerManager({ slot });
  const fullscreenRoot = { contains: (element) => element === video };
  const exit = deferred();
  const documentRef = {
    fullscreenElement: video,
    exitFullscreen: () => exit.promise.then(() => { documentRef.fullscreenElement = null; }),
  };

  const pending = releasePlayerForTransition({ manager, video, fullscreenRoot, documentRef });

  assert.equal(video.muted, true);
  assert.equal(video.paused, true);
  assert.equal(slot.destroyed, false);

  exit.resolve();
  assert.deepEqual(await pending, { released: true, error: null });
  assert.equal(slot.destroyed, true);
});

test("failed fullscreen exit restores the existing player and aborts the transition", async () => {
  const video = new FakeVideo();
  await video.play();
  video.muted = false;
  const slot = new FakeSlot({ id: "main", video });
  const manager = new PlayerManager({ slot });
  const fullscreenRoot = { contains: (element) => element === video };
  const documentRef = {
    fullscreenElement: video,
    exitFullscreen: () => Promise.reject(new Error("denied")),
  };

  const result = await releasePlayerForTransition({ manager, video, fullscreenRoot, documentRef });

  assert.equal(result.released, false);
  assert.match(result.error.message, /denied/);
  assert.equal(slot.destroyed, false);
  assert.equal(video.muted, false);
  assert.equal(video.paused, false);
});

test("player transition without Fullscreen API releases immediately", async () => {
  const video = new FakeVideo();
  await video.play();
  const slot = new FakeSlot({ id: "main", video });
  const manager = new PlayerManager({ slot });

  const result = await releasePlayerForTransition({
    manager,
    video,
    fullscreenRoot: {},
    documentRef: { fullscreenElement: null },
  });

  assert.equal(result.released, true);
  assert.equal(video.muted, true);
  assert.equal(video.paused, true);
  assert.equal(slot.destroyed, true);
});
