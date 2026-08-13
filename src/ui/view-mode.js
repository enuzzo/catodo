const OVERLAY_MODES = new Set(['player', 'multiview']);
const SHELL_VIEWS = new Set(['home', 'explore', 'countries', 'guide', 'library', 'sources']);

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

export function resolvePlayerReturnView(viewName, fallback = 'home') {
  const candidate = String(viewName || '');
  if (SHELL_VIEWS.has(candidate)) return candidate;
  const safeFallback = String(fallback || '');
  return SHELL_VIEWS.has(safeFallback) ? safeFallback : 'home';
}
