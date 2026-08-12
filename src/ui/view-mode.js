const OVERLAY_MODES = new Set(['player', 'multiview']);

/**
 * Data refreshes may rerender shell views, but they must never dismiss an
 * active media overlay. Overlay navigation is explicit through showView().
 */
export function shouldActivateShellView(mode, requested = true) {
  return requested !== false && !OVERLAY_MODES.has(String(mode || ''));
}

export function isPrimaryNavActive(key, viewName) {
  if (viewName === 'home') return key === 'home';
  return key === viewName;
}
