function ownsFullscreenElement(root, element) {
  if (!root || !element) return false;
  return root === element || Boolean(root.contains?.(element));
}

async function restorePlayback(manager, video, { muted, paused }) {
  manager.setMuted(muted);
  if (paused || typeof video.play !== "function") return;
  await video.play().catch(() => {});
}

/**
 * Quiesce and release the single-player pipeline before another surface owns
 * playback. Muting and pausing happen synchronously, before fullscreen exit can
 * yield, so an outgoing player can never overlap the destination audio.
 */
export async function releasePlayerForTransition({
  manager,
  video,
  fullscreenRoot,
  documentRef = globalThis.document,
} = {}) {
  if (!manager || !video) throw new TypeError("A player manager and video element are required");

  const previous = { muted: Boolean(video.muted), paused: Boolean(video.paused) };
  manager.setMuted(true);
  video.pause?.();

  const fullscreenElement = documentRef?.fullscreenElement;
  if (ownsFullscreenElement(fullscreenRoot, fullscreenElement)) {
    let exitError = null;
    try {
      if (typeof documentRef?.exitFullscreen !== "function") throw new Error("Fullscreen exit is unavailable");
      await documentRef.exitFullscreen();
    } catch (error) {
      exitError = error;
    }

    if (ownsFullscreenElement(fullscreenRoot, documentRef?.fullscreenElement)) {
      await restorePlayback(manager, video, previous);
      return {
        released: false,
        error: exitError || new Error("The player is still full screen"),
      };
    }
  }

  manager.destroy();
  return { released: true, error: null };
}
