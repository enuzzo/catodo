export function resolveFavoriteEffectHost(root, anchor, documentRef = anchor?.ownerDocument) {
  const fullscreen = documentRef?.fullscreenElement || documentRef?.webkitFullscreenElement;
  if (fullscreen?.contains?.(anchor)) return fullscreen;
  return root;
}

export function favoriteEffectPosition(rect, { playerToolbar = false } = {}) {
  const left = Number(rect?.left || 0) + Number(rect?.width || 0) / 2;
  const centerTop = Number(rect?.top || 0) + Number(rect?.height || 0) / 2;
  return { left, top: Math.max(centerTop, playerToolbar ? 64 : 0) };
}
