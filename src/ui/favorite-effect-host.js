export function resolveFavoriteEffectHost(root, anchor, documentRef = anchor?.ownerDocument) {
  const fullscreen = documentRef?.fullscreenElement || documentRef?.webkitFullscreenElement;
  if (fullscreen?.contains?.(anchor)) return fullscreen;
  return root;
}
