import worldMap from '../../assets/vendor/map/world-map.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const instances = new WeakMap();

function svgElement(name, attributes = {}) {
  const node = document.createElementNS(SVG_NS, name);
  Object.entries(attributes).forEach(([key, value]) => {
    if (value !== undefined && value !== null) node.setAttribute(key, String(value));
  });
  return node;
}

function translate(t, key, fallback, vars = {}) {
  let value;
  try {
    value = typeof t === 'function' ? t(key, fallback, vars) : fallback;
  } catch {
    value = fallback;
  }

  if (value === undefined || value === null || value === '' || value === key) value = fallback;
  return String(value).replace(/\{([\w.-]+)\}/g, (match, variable) => {
    return Object.prototype.hasOwnProperty.call(vars, variable) ? String(vars[variable]) : match;
  });
}

function normaliseIso2(value) {
  return String(value || '').trim().slice(0, 2).toUpperCase();
}

function normaliseIsoSet(values) {
  if (!values) return new Set();
  const list = values instanceof Set ? [...values] : Array.isArray(values) ? values : [values];
  return new Set(list.map(normaliseIso2).filter(Boolean));
}

function markerPoint(marker) {
  if (Number.isFinite(marker?.x) && Number.isFinite(marker?.y)) {
    return { x: Number(marker.x), y: Number(marker.y) };
  }

  if (Number.isFinite(marker?.longitude) && Number.isFinite(marker?.latitude)) {
    const longitude = Math.max(-180, Math.min(180, Number(marker.longitude)));
    const latitude = Math.max(-90, Math.min(90, Number(marker.latitude)));
    return {
      x: 505 + longitude * 2.55,
      y: 344 - latitude * 2.85,
    };
  }

  return null;
}

function buildMap(container, t) {
  const baseViewBox = String(worldMap.viewBox)
    .trim()
    .split(/[ ,]+/)
    .map(Number);
  const svg = svgElement('svg', {
    class: 'world-map',
    viewBox: worldMap.viewBox,
    role: 'img',
    'aria-label': translate(t, 'map.world.ariaLabel', 'Interactive world map'),
    preserveAspectRatio: 'xMidYMid meet',
  });
  const countries = svgElement('g', { class: 'world-map__countries' });
  const markers = svgElement('g', { class: 'world-map__markers' });
  const pathsByIso2 = new Map();

  worldMap.locations.forEach((location) => {
    const iso2 = normaliseIso2(location.id);
    const path = svgElement('path', {
      class: 'world-map__country',
      d: location.path,
      tabindex: '0',
      role: 'button',
      'data-action': 'select-country',
      'data-iso2': iso2,
      'aria-label': translate(t, 'map.country.selectAriaLabel', 'Select {country}', {
        country: location.name,
      }),
    });
    const title = svgElement('title');
    title.textContent = location.name;
    path.append(title);
    countries.append(path);
    pathsByIso2.set(iso2, path);
  });

  svg.append(countries, markers);
  container.replaceChildren(svg);

  const instance = {
    svg,
    countries,
    markers,
    pathsByIso2,
    baseViewBox,
    zoom: 1,
  };
  instances.set(container, instance);
  return instance;
}

function markerPointForInstance(instance, marker) {
  const direct = markerPoint(marker);
  if (direct) return direct;
  const path = instance.pathsByIso2.get(normaliseIso2(marker?.iso2));
  if (!path?.getBBox) return null;
  try {
    const bounds = path.getBBox();
    if (!bounds.width && !bounds.height) return null;
    return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  } catch {
    return null;
  }
}

function renderMarkers(instance, values, t) {
  instance.markers.replaceChildren();
  const markers = Array.isArray(values) ? values : [];

  markers.forEach((marker, index) => {
    const point = markerPointForInstance(instance, marker);
    if (!point) return;

    const iso2 = normaliseIso2(marker.iso2);
    const count = Number.isFinite(Number(marker.count)) ? Number(marker.count) : null;
    const label = marker.label || (count !== null ? String(count) : String(index + 1));
    const group = svgElement('g', {
      class: 'world-map__marker',
      transform: `translate(${point.x} ${point.y})`,
      role: iso2 ? 'button' : undefined,
      tabindex: iso2 ? '0' : undefined,
      'data-action': iso2 ? 'select-country' : undefined,
      'data-iso2': iso2 || undefined,
      'aria-label': iso2
        ? translate(t, 'map.marker.selectAriaLabel', 'Select signal cluster {label}', { label })
        : undefined,
    });
    if (marker.tone) group.dataset.tone = String(marker.tone);

    const circle = svgElement('circle', { r: marker.radius || 16 });
    const text = svgElement('text', {
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
    });
    text.textContent = label;
    group.append(circle, text);
    instance.markers.append(group);
  });
}

/**
 * Mounts the vendored @svg-maps/world dataset once, then updates selection,
 * imported state and signal markers without rebuilding its paths.
 */
export function renderWorldMap(container, options = {}) {
  if (!(container instanceof Element)) {
    throw new TypeError('renderWorldMap requires a DOM Element container');
  }

  const t = options.t;
  const instance = instances.get(container) || buildMap(container, t);
  const selectedIso2 = normaliseIso2(options.selectedIso2);
  const imported = normaliseIsoSet(options.importedIso2);
  const available = options.availableIso2 ? normaliseIsoSet(options.availableIso2) : null;
  const counts = options.counts && typeof options.counts === 'object' ? options.counts : {};

  instance.svg.setAttribute('aria-label', translate(t, 'map.world.ariaLabel', 'Interactive world map'));
  instance.pathsByIso2.forEach((path, iso2) => {
    const count = Number(counts[iso2] ?? counts[iso2.toLowerCase()]);
    path.classList.toggle('is-selected', Boolean(selectedIso2 && selectedIso2 === iso2));
    path.classList.toggle('is-imported', imported.has(iso2));
    path.classList.toggle('is-unavailable', Boolean(available && !available.has(iso2)));
    path.toggleAttribute('aria-current', Boolean(selectedIso2 && selectedIso2 === iso2));
    if (Number.isFinite(count)) path.dataset.count = String(count);
    else delete path.dataset.count;
  });

  renderMarkers(instance, options.markers, t);
  return instance;
}

export function getWorldMapInstance(container) {
  return instances.get(container) || null;
}

export function zoomWorldMap(container, direction = 'in') {
  const instance = instances.get(container);
  if (!instance || instance.baseViewBox.length !== 4) return null;
  const [baseX, baseY, baseWidth, baseHeight] = instance.baseViewBox;
  const nextZoom = direction === 'out'
    ? Math.max(1, instance.zoom / 1.25)
    : Math.min(2.45, instance.zoom * 1.25);
  instance.zoom = nextZoom;
  const width = baseWidth / nextZoom;
  const height = baseHeight / nextZoom;
  const x = baseX + (baseWidth - width) / 2;
  const y = baseY + (baseHeight - height) / 2;
  instance.svg.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
  return instance;
}

export function resetWorldMapView(container) {
  const instance = instances.get(container);
  if (!instance) return null;
  instance.zoom = 1;
  instance.svg.setAttribute('viewBox', worldMap.viewBox);
  return instance;
}

export function renderCountryShape(container, iso2Value, options = {}) {
  if (!(container instanceof Element)) return null;
  const iso2 = normaliseIso2(iso2Value);
  const location = worldMap.locations.find((entry) => normaliseIso2(entry.id) === iso2);
  if (!location) {
    container.replaceChildren();
    return null;
  }

  const svg = svgElement('svg', {
    class: 'country-shape',
    role: 'img',
    viewBox: worldMap.viewBox,
    preserveAspectRatio: 'xMidYMid meet',
    'aria-label': translate(options.t, 'map.country.shapeAriaLabel', 'Map outline of {country}', {
      country: location.name,
    }),
  });
  const path = svgElement('path', { d: location.path });
  const title = svgElement('title');
  title.textContent = location.name;
  path.append(title);
  svg.append(path);
  container.replaceChildren(svg);

  const fitShape = () => {
    try {
      const bounds = path.getBBox();
      const pad = Math.max(bounds.width, bounds.height) * 0.08;
      if (bounds.width && bounds.height) {
        svg.setAttribute(
          'viewBox',
          `${bounds.x - pad} ${bounds.y - pad} ${bounds.width + pad * 2} ${bounds.height + pad * 2}`,
        );
      }
    } catch {
      // getBBox is unavailable in lightweight DOM test environments.
    }
  };

  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(fitShape);
  else fitShape();
  return { svg, path, location };
}
