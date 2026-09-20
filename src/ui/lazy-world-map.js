import { createDeferredRenderer } from './deferred-renderer.js';

const renderer = createDeferredRenderer(() => import('./world-map.js'));

function mapStatus(container, options, failed = false) {
  const status = document.createElement('div');
  status.className = 'map-load-status';
  status.setAttribute('role', 'status');
  const message = document.createElement('p');
  const key = failed ? 'map.loadError' : 'map.loading';
  const fallback = failed ? 'Map unavailable. You can still choose a country from the list.' : 'Loading the signal atlas…';
  message.textContent = options.t?.(key, fallback) || fallback;
  status.append(message);
  if (failed) {
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'button button--ghost';
    retry.dataset.action = 'retry-world-map';
    retry.textContent = options.t?.('map.retry', 'Retry map') || 'Retry map';
    status.append(retry);
  }
  container.replaceChildren(status);
}

export function renderWorldMap(container, options = {}) {
  if (!renderer.peek()) mapStatus(container, options);
  return renderer.render(container, 'renderWorldMap', [options], () => mapStatus(container, options, true));
}

export function renderCountryShape(container, iso2, options = {}) {
  if (!iso2) {
    renderer.cancel(container);
    container.replaceChildren();
    return;
  }
  return renderer.render(container, 'renderCountryShape', [iso2, options], () => container.replaceChildren());
}

export const zoomWorldMap = (container, direction) => renderer.peek()?.zoomWorldMap(container, direction);
export const resetWorldMapView = (container) => renderer.peek()?.resetWorldMapView(container);
