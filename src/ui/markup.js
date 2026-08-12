import { renderCountryShape, renderWorldMap } from './world-map.js';
import { isPrimaryNavActive, shouldActivateShellView } from './view-mode.js';

const FLAG_URLS = import.meta.glob('../../assets/vendor/flags/4x3/*.svg', {
  eager: true,
  query: '?url&no-inline',
  import: 'default',
});

const TONES = ['white', 'red', 'green', 'yellow', 'cyan', 'magenta', 'blue'];
const VIEW_NAMES = ['home', 'countries', 'guide', 'library', 'sources'];
const MULTIVIEW_SIZE = 4;
const mountedApps = new WeakMap();

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

function scheduleFrame(callback) {
  if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(callback);
  return setTimeout(callback, 0);
}

function element(tagName, className, attributes = {}) {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  Object.entries(attributes).forEach(([name, value]) => {
    if (value === undefined || value === null || value === false) return;
    if (name === 'dataset' && typeof value === 'object') {
      Object.entries(value).forEach(([dataName, dataValue]) => {
        if (dataValue !== undefined && dataValue !== null) node.dataset[dataName] = String(dataValue);
      });
      return;
    }
    if (name === 'hidden') {
      node.hidden = Boolean(value);
      return;
    }
    if (name in node && !['role', 'aria-label', 'aria-current', 'aria-live', 'aria-modal'].includes(name)) {
      try {
        node[name] = value;
        return;
      } catch {
        // Fall through to a regular attribute.
      }
    }
    node.setAttribute(name, value === true ? '' : String(value));
  });
  return node;
}

function icon(name, className = '') {
  return element('i', `ph ph-${name}${className ? ` ${className}` : ''}`, { 'aria-hidden': 'true' });
}

function textNode(tagName, className, t, key, fallback, vars) {
  const node = element(tagName, className);
  node.textContent = translate(t, key, fallback, vars);
  return node;
}

function setTranslatedText(node, t, key, fallback, vars) {
  node.textContent = translate(t, key, fallback, vars);
}

function actionButton({ t, action, iconName, key, fallback, className = '', dataset = {}, type = 'button' }) {
  const button = element('button', `button ${className}`.trim(), {
    type,
    dataset: { action, ...dataset },
  });
  if (iconName) button.append(icon(iconName));
  button.append(textNode('span', 'button__label', t, key, fallback));
  return button;
}

function iconButton({ t, action, iconName, key, fallback, className = '', dataset = {} }) {
  const button = element('button', `icon-button ${className}`.trim(), {
    type: 'button',
    'aria-label': translate(t, key, fallback),
    title: translate(t, key, fallback),
    dataset: { action, ...dataset },
  });
  button.append(icon(iconName));
  return button;
}

function normaliseArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeText(value, fallback = '') {
  return value === undefined || value === null ? fallback : String(value);
}

function safeId(value) {
  return safeText(value).slice(0, 160);
}

function safeIso2(value) {
  return safeText(value).trim().slice(0, 2).toUpperCase();
}

function countryFlag(iso2Value, nameValue, className = '') {
  const iso2 = safeIso2(iso2Value);
  const name = safeText(nameValue, iso2 || 'Unknown country');
  const fallback = element('span', `country-flag__fallback${className ? ` ${className}` : ''}`);
  fallback.textContent = iso2 || '—';
  if (!iso2) return fallback;
  const imageSource = FLAG_URLS[`../../assets/vendor/flags/4x3/${iso2.toLowerCase()}.svg`];
  if (!imageSource) return fallback;
  const image = element('img', `country-flag${className ? ` ${className}` : ''}`, {
    src: imageSource,
    alt: `${name} flag`,
    loading: 'lazy',
    decoding: 'async',
  });
  image.addEventListener('error', () => image.replaceWith(fallback), { once: true });
  return image;
}

function safeTone(value, fallbackIndex = 0) {
  const requested = safeText(value).toLowerCase();
  if (TONES.includes(requested)) return requested;
  const number = Number(value);
  if (Number.isFinite(number)) return TONES[Math.abs(Math.floor(number)) % TONES.length];
  return TONES[Math.abs(fallbackIndex) % TONES.length];
}

function safeMediaUrl(value, { image = false } = {}) {
  const candidate = safeText(value).trim();
  if (!candidate) return '';
  if (/^(javascript|vbscript|file):/i.test(candidate)) return '';
  if (/^data:/i.test(candidate)) return image && /^data:image\/(?:png|gif|jpe?g|webp|avif|svg\+xml);/i.test(candidate)
    ? candidate
    : '';
  try {
    const url = new URL(candidate, document.baseURI);
    return ['http:', 'https:', 'blob:'].includes(url.protocol) || url.origin === window.location.origin
      ? url.href
      : '';
  } catch {
    return '';
  }
}

function setMedia(video, data = {}) {
  const endpoint = Array.isArray(data.endpoints) ? data.endpoints[0] : data.endpoint;
  const src = safeMediaUrl(data.src || data.url || data.streamUrl || endpoint?.url);
  const poster = safeMediaUrl(data.poster || data.image || data.thumbnail, { image: true });
  if (poster) video.poster = poster;
  else video.removeAttribute('poster');

  if (src && video.dataset.uiSrc !== src) {
    video.src = src;
    video.dataset.uiSrc = src;
  } else if (!src && video.dataset.uiSrc && data.clearSource === true) {
    video.removeAttribute('src');
    delete video.dataset.uiSrc;
  }

  video.muted = data.muted !== false;
  video.playsInline = true;
  if (data.autoplay !== undefined) video.autoplay = Boolean(data.autoplay);
}

function initials(value) {
  const words = safeText(value).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'TV';
  return words.slice(0, 2).map((word) => word.charAt(0)).join('').toUpperCase();
}

function renderLogo(container, channel, t) {
  container.replaceChildren();
  const source = safeMediaUrl(channel?.logo || channel?.logoUrl, { image: true });
  const fallback = element('span', 'channel-logo__fallback');
  fallback.textContent = initials(channel?.name);

  if (!source) {
    container.append(fallback);
    return;
  }

  const image = element('img', 'channel-logo__image', {
    src: source,
    alt: translate(t, 'channel.logo.alt', '{name} logo', { name: safeText(channel?.name) }),
    loading: 'lazy',
    decoding: 'async',
    referrerPolicy: 'no-referrer',
  });
  image.addEventListener('error', () => image.replaceWith(fallback), { once: true });
  container.append(image);
}

function channelCountry(channel) {
  return safeText(channel?.countryName || channel?.country || channel?.countries?.[0] || channel?.countryCode || channel?.iso2);
}

function channelLanguage(channel) {
  return safeText(channel?.languageName || channel?.language || channel?.languages?.[0] || channel?.languageCode);
}

function channelQuality(channel) {
  return safeText(channel?.quality || channel?.streamQuality || channel?.resolution || channel?.feedFormat);
}

function metadataDivider() {
  const node = element('span', 'meta-divider', { 'aria-hidden': 'true' });
  node.textContent = '|';
  return node;
}

function channelMeta(channel, className = 'channel-meta') {
  const row = element('div', className);
  const values = [channelCountry(channel), channelLanguage(channel), channelQuality(channel)].filter(Boolean);
  values.forEach((value, index) => {
    if (index) row.append(metadataDivider());
    const item = element('span');
    item.textContent = value;
    row.append(item);
  });
  return row;
}

function channelNumber(channel, index) {
  const supplied = channel?.number ?? channel?.position;
  const numeric = Number(supplied ?? index + 1);
  return Number.isFinite(numeric) ? String(Math.max(0, Math.floor(numeric))).padStart(3, '0') : safeText(supplied);
}

function formatProgrammeTime(value) {
  const date = new Date(Number(value));
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(date)
    : '--:--';
}

function channelSchedule(channel) {
  return normaliseArray(channel?.schedule || channel?.programmes);
}

function renderChannelTiles(container, channels, t, options = {}) {
  const fragment = document.createDocumentFragment();
  normaliseArray(channels).forEach((channel, index) => {
    const id = safeId(channel?.channelId || channel?.id || channel?.tvgId || channel?.url || index);
    const tile = element('article', `channel-tile${channel?.active ? ' is-active' : ''}`, {
      dataset: { tone: safeTone(channel?.tone ?? channel?.color, index) },
    });
    const main = element('button', 'channel-tile__main', {
      type: 'button',
      dataset: { action: options.action || 'open-channel', channelId: id },
      'aria-label': translate(t, 'channel.openAriaLabel', 'Open {name}', { name: safeText(channel?.name) }),
    });
    main.append(textNode('span', 'channel-tile__number', t, 'channel.number', '{number}', {
      number: channelNumber(channel, index),
    }));
    const logo = element('span', 'channel-logo channel-tile__logo');
    renderLogo(logo, channel, t);
    main.append(logo);
    const name = element('strong', 'channel-tile__name');
    name.textContent = safeText(channel?.name, translate(t, 'channel.unknown', 'Unknown channel'));
    main.append(name, channelMeta(channel));
    if (options.schedule === true) {
      const schedule = channelSchedule(channel);
      const now = schedule.find((programme) => Number(programme.start) <= Date.now() && Number(programme.stop) > Date.now());
      const next = schedule.find((programme) => Number(programme.start) > Date.now());
      const strip = element('div', 'channel-tile__schedule');
      const nowRow = element('div');
      nowRow.append(
        textNode('span', 'channel-tile__schedule-label', t, 'guide.now', 'Now'),
        textNode('strong', null, t, now ? 'guide.programmeValue' : 'guide.noDataShort', now ? '{time} · {title}' : 'Guide unavailable', {
          time: now ? formatProgrammeTime(now.start) : '', title: now?.title || '',
        }),
      );
      strip.append(nowRow);
      if (next) {
        const nextRow = element('div');
        nextRow.append(
          textNode('span', 'channel-tile__schedule-label', t, 'guide.next', 'Next'),
          textNode('strong', null, t, 'guide.programmeValue', '{time} · {title}', { time: formatProgrammeTime(next.start), title: next.title }),
        );
        strip.append(nextRow);
      }
      main.append(strip);
    }
    tile.append(main);

    if (options.favorites !== false) {
      const favorite = iconButton({
        t,
        action: channel?.favorite || channel?.isFavorite ? 'remove-favorite' : 'add-favorite',
        iconName: 'heart',
        key: channel?.favorite || channel?.isFavorite ? 'favorite.remove' : 'favorite.add',
        fallback: channel?.favorite || channel?.isFavorite ? 'Remove from favorites' : 'Add to favorites',
        className: `channel-tile__favorite${channel?.favorite || channel?.isFavorite ? ' is-active' : ''}`,
        dataset: { channelId: id },
      });
      tile.append(favorite);
    }
    fragment.append(tile);
  });

  container.replaceChildren(fragment);
  container.classList.toggle('is-empty', !container.childElementCount);
}

function renderEmpty(container, t, keyPrefix, fallbackTitle, fallbackBody, action) {
  const empty = element('div', 'empty-state');
  empty.append(icon('broadcast', 'empty-state__icon'));
  empty.append(
    textNode('h3', null, t, `${keyPrefix}.title`, fallbackTitle),
    textNode('p', null, t, `${keyPrefix}.body`, fallbackBody),
  );
  if (action) empty.append(action);
  container.replaceChildren(empty);
}

function setViewVisible(node, visible) {
  node.hidden = !visible;
  node.classList.toggle('is-active', visible);
}

function createSectionTitle(t, key, fallback, action) {
  const row = element('div', 'section-heading');
  row.append(textNode('h2', null, t, key, fallback));
  if (action) row.append(action);
  return row;
}

function createHeader(t) {
  const header = element('header', 'app-header');
  const brand = element('button', 'brand', {
    type: 'button',
    dataset: { action: 'navigate', view: 'home' },
    'aria-label': translate(t, 'nav.homeAriaLabel', 'Go to live home'),
  });
  brand.append(textNode('span', 'brand__name', t, 'brand.name', 'CATODO'));

  const nav = element('nav', 'primary-nav', {
    'aria-label': translate(t, 'nav.primaryAriaLabel', 'Primary navigation'),
  });
  const navDefinitions = [
    ['home', 'nav.live', 'Live'],
    ['explore', 'nav.explore', 'Explore'],
    ['countries', 'nav.countries', 'Countries'],
    ['multiview', 'nav.multiview', 'Multiview'],
    ['guide', 'nav.guide', 'TV Guide'],
    ['library', 'nav.library', 'Library'],
  ];
  const navButtons = {};
  navDefinitions.forEach(([view, key, fallback]) => {
    const action = view === 'multiview' ? 'open-multiview' : 'navigate';
    const targetView = view === 'explore' ? 'home' : view;
    const button = element('button', 'primary-nav__item', {
      type: 'button',
      dataset: { action, view: targetView, mode: view },
    });
    button.append(textNode('span', null, t, key, fallback));
    nav.append(button);
    navButtons[view] = button;
  });

  const searchForm = element('form', 'global-search', { dataset: { action: 'search' }, role: 'search' });
  searchForm.append(icon('magnifying-glass'));
  const searchInput = element('input', 'global-search__input', {
    type: 'search',
    name: 'query',
    autocomplete: 'off',
    spellcheck: false,
    placeholder: translate(t, 'search.placeholder', 'Search channels, countries, languages…'),
    'aria-label': translate(t, 'search.ariaLabel', 'Search channels, countries, and languages'),
    dataset: { action: 'search-query' },
  });
  searchForm.append(searchInput);

  const settings = iconButton({
    t,
    action: 'navigate',
    iconName: 'gear-six',
    key: 'nav.settings',
    fallback: 'Settings',
    className: 'app-switcher app-switcher--settings',
    dataset: { view: 'sources' },
  });
  header.append(brand, nav, searchForm, settings);
  return { header, brand, nav, navButtons, searchForm, searchInput, settings };
}

function createHomeView(t) {
  const view = element('section', 'page page--home', { dataset: { page: 'home' } });
  const headline = element('h1', 'home-headline');
  const liveCount = textNode('span', 'home-headline__accent', t, 'home.liveCount', '{count} LIVE', { count: 0 });
  const slash = element('span', 'home-headline__slash', { 'aria-hidden': 'true' });
  slash.textContent = '/';
  const countryCount = textNode('span', null, t, 'home.countryCount', '{count} COUNTRIES', { count: 0 });
  headline.append(liveCount, slash, countryCount);

  const top = element('div', 'home-top');
  const directory = element('div', 'home-directory');
  const liveCard = element('article', 'live-anchor', { dataset: { tone: 'blue' } });
  const liveStage = element('div', 'live-anchor__stage');
  const video = element('video', 'live-anchor__video', {
    muted: true,
    autoplay: true,
    playsInline: true,
    preload: 'metadata',
    dataset: { mediaRole: 'home-live' },
  });
  const liveBadge = element('span', 'live-badge');
  liveBadge.append(element('i', 'live-dot', { 'aria-hidden': 'true' }));
  const liveBadgeText = textNode('span', null, t, 'status.liveMuted', 'LIVE · MUTED');
  liveBadge.append(liveBadgeText);
  const mute = iconButton({
    t,
    action: 'toggle-home-audio',
    iconName: 'speaker-slash',
    key: 'player.unmute',
    fallback: 'Unmute',
    className: 'live-anchor__mute media-control',
  });
  const nowBar = element('div', 'live-anchor__now');
  nowBar.append(
    textNode('span', 'status-chip', t, 'status.live', 'LIVE'),
    textNode('time', 'live-clock', t, 'time.placeholder', '--:-- CET'),
  );
  liveStage.append(video, liveBadge, mute, nowBar);

  const liveInfo = element('div', 'live-anchor__info');
  const channelName = textNode('h2', 'live-anchor__name', t, 'channel.unknown', 'Unknown channel');
  const description = textNode('p', 'live-anchor__description', t, 'home.liveDescriptionFallback', 'Live television from around the world');
  const facts = element('dl', 'live-anchor__facts');
  const factNodes = {};
  [
    ['country', 'channel.country', 'Country'],
    ['language', 'channel.language', 'Language'],
    ['quality', 'channel.quality', 'Quality'],
  ].forEach(([name, key, fallback]) => {
    const group = element('div');
    group.append(textNode('dt', null, t, key, fallback));
    const value = element('dd');
    value.textContent = '—';
    group.append(value);
    facts.append(group);
    factNodes[name] = value;
  });
  liveInfo.append(channelName, description, facts);

  const liveActions = element('div', 'live-anchor__actions');
  const openPlayer = actionButton({
    t,
    action: 'open-player',
    iconName: 'play',
    key: 'player.open',
    fallback: 'Open player',
    className: 'button--inverted',
  });
  const random = actionButton({
    t,
    action: 'random-channel',
    iconName: 'shuffle',
    key: 'home.random',
    fallback: 'Random',
    className: 'button--inverted',
  });
  liveActions.append(openPlayer, random);
  liveCard.append(liveStage, liveInfo, liveActions);

  const nearbyGrid = element('div', 'channel-grid channel-grid--nearby');
  directory.append(liveCard, nearbyGrid);

  const atlas = element('article', 'atlas-card');
  const atlasHeader = element('div', 'atlas-card__header');
  atlasHeader.append(
    textNode('h2', null, t, 'map.signalAtlas', 'Signal Atlas'),
    actionButton({
      t,
      action: 'shuffle-world',
      iconName: 'shuffle',
      key: 'map.shuffleWorld',
      fallback: 'Shuffle world',
      className: 'button--text',
    }),
  );
  const map = element('div', 'world-map-shell world-map-shell--home');
  const mapControls = element('div', 'map-controls');
  mapControls.append(
    iconButton({ t, action: 'map-zoom-in', iconName: 'plus', key: 'map.zoomIn', fallback: 'Zoom in' }),
    iconButton({ t, action: 'map-zoom-out', iconName: 'minus', key: 'map.zoomOut', fallback: 'Zoom out' }),
    iconButton({ t, action: 'map-center', iconName: 'crosshair', key: 'map.center', fallback: 'Center map' }),
  );
  const centerMap = actionButton({
    t,
    action: 'map-center',
    iconName: 'crosshair',
    key: 'map.center',
    fallback: 'Center map',
    className: 'button--small button--ghost atlas-card__center',
  });
  atlas.append(atlasHeader, map, mapControls, centerMap);
  top.append(directory, atlas);

  const bottom = element('div', 'home-bottom');
  const multiPromo = element('article', 'multiview-promo');
  const multiCopy = element('div', 'multiview-promo__copy');
  multiCopy.append(
    textNode('h2', null, t, 'multiview.titlePlus', 'Multiview +'),
    icon('grid-four'),
    textNode('strong', null, t, 'multiview.titlePlus', 'Multiview +'),
    textNode('p', null, t, 'multiview.promoBody', 'Open 4 channels at the same time'),
  );
  const multiSlots = element('button', 'multiview-promo__slots', {
    type: 'button',
    dataset: { action: 'open-multiview' },
    'aria-label': translate(t, 'multiview.openAriaLabel', 'Open Multiview'),
  });
  for (let index = 1; index <= 4; index += 1) {
    const slot = element('span');
    const number = element('b');
    number.textContent = String(index);
    slot.append(number, icon('squares-four'));
    multiSlots.append(slot);
  }
  multiPromo.append(multiCopy, multiSlots);

  const favorites = element('section', 'favorites-shelf');
  const favoriteMore = actionButton({
    t,
    action: 'navigate',
    iconName: 'caret-right',
    key: 'common.viewAll',
    fallback: 'View all',
    className: 'button--text',
    dataset: { view: 'library' },
  });
  const favoriteGrid = element('div', 'channel-grid channel-grid--favorites');
  favorites.append(createSectionTitle(t, 'favorites.title', 'Favorites', favoriteMore), favoriteGrid);
  bottom.append(multiPromo, favorites);
  view.append(headline, top, bottom);

  return {
    view,
    headline,
    liveCount,
    countryCount,
    liveCard,
    liveStage,
    video,
    liveBadgeText,
    liveClock: nowBar.querySelector('.live-clock'),
    mute,
    channelName,
    description,
    facts: factNodes,
    openPlayer,
    random,
    nearbyGrid,
    atlas,
    map,
    favoriteGrid,
  };
}

function createCountriesView(t) {
  const view = element('section', 'page page--countries', { dataset: { page: 'countries' }, hidden: true });
  const layout = element('div', 'countries-layout');
  const atlas = element('article', 'countries-atlas panel');
  atlas.append(textNode('h1', 'panel-title', t, 'map.signalAtlas', 'Signal Atlas'));
  const map = element('div', 'world-map-shell world-map-shell--countries');
  const controls = element('div', 'map-controls');
  controls.append(
    iconButton({ t, action: 'map-zoom-in', iconName: 'plus', key: 'map.zoomIn', fallback: 'Zoom in' }),
    iconButton({ t, action: 'map-zoom-out', iconName: 'minus', key: 'map.zoomOut', fallback: 'Zoom out' }),
    iconButton({ t, action: 'map-center', iconName: 'crosshair', key: 'map.center', fallback: 'Center map' }),
  );
  const mapMode = element('div', 'map-mode segmented-control');
  const mapButton = actionButton({
    t,
    action: 'set-country-mode',
    iconName: 'globe',
    key: 'countries.mapMode',
    fallback: 'Map',
    className: 'is-active',
    dataset: { mode: 'map' },
  });
  const listButton = actionButton({
    t,
    action: 'set-country-mode',
    iconName: 'list',
    key: 'countries.listMode',
    fallback: 'A–Z',
    dataset: { mode: 'list' },
  });
  mapMode.append(mapButton, listButton);
  atlas.append(map, controls, mapMode);

  const directory = element('div', 'country-directory');
  const detail = element('article', 'country-detail panel');
  const detailBack = iconButton({
    t,
    action: 'clear-country-selection',
    iconName: 'arrow-left',
    key: 'common.back',
    fallback: 'Back',
    className: 'country-detail__back',
  });
  const detailGrid = element('div', 'country-detail__grid');
  const detailCopy = element('div', 'country-detail__copy');
  const detailHeading = element('div', 'country-detail__heading');
  const detailFlag = element('span', 'country-detail__flag');
  const countryName = textNode('h2', null, t, 'countries.selectPrompt', 'Select a country');
  detailHeading.append(detailFlag, countryName);
  const localName = element('p', 'country-detail__local-name');
  const facts = element('dl', 'country-detail__facts');
  const factNodes = {};
  [
    ['language', 'channel.language', 'Language'],
    ['region', 'countries.region', 'Region'],
    ['channels', 'countries.channels', 'Channels'],
    ['categories', 'countries.categories', 'Categories'],
    ['updated', 'countries.lastUpdate', 'Last catalog update'],
  ].forEach(([name, key, fallback]) => {
    facts.append(textNode('dt', null, t, key, fallback));
    const value = element('dd');
    value.textContent = '—';
    facts.append(value);
    factNodes[name] = value;
  });
  detailCopy.append(detailHeading, localName, facts);
  const shape = element('div', 'country-detail__shape');
  const detailActions = element('div', 'country-detail__actions');
  const importButton = actionButton({
    t,
    action: 'open-import-dialog',
    iconName: 'download-simple',
    key: 'countries.addChannels',
    fallback: 'Add country channels',
    className: 'button--primary',
  });
  const viewChannels = actionButton({
    t,
    action: 'view-country-channels',
    iconName: 'eye',
    key: 'countries.viewChannels',
    fallback: 'View channels',
    className: 'button--ghost',
  });
  detailActions.append(importButton, viewChannels);
  detailGrid.append(detailCopy, shape, detailActions);
  detail.append(detailBack, detailGrid);

  const browser = element('article', 'country-browser panel');
  const regionTabs = element('div', 'country-regions tab-list', {
    role: 'tablist',
    'aria-label': translate(t, 'countries.regionFilterAriaLabel', 'Filter by region'),
  });
  const regionDefinitions = [
    ['all', 'countries.regions.all', 'All'],
    ['europe', 'countries.regions.europe', 'Europe'],
    ['asia', 'countries.regions.asia', 'Asia'],
    ['north-america', 'countries.regions.northAmerica', 'North America'],
    ['south-america', 'countries.regions.southAmerica', 'South America'],
    ['africa', 'countries.regions.africa', 'Africa'],
    ['oceania', 'countries.regions.oceania', 'Oceania'],
  ];
  const regionButtons = {};
  regionDefinitions.forEach(([region, key, fallback], index) => {
    const button = actionButton({
      t,
      action: 'filter-countries-region',
      key,
      fallback,
      className: `button--tab${index === 0 ? ' is-active' : ''}`,
      dataset: { region },
    });
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
    regionTabs.append(button);
    regionButtons[region] = button;
  });

  const filters = element('form', 'country-filters', { dataset: { action: 'filter-countries' } });
  const searchWrap = element('label', 'field field--icon');
  searchWrap.append(icon('magnifying-glass'));
  const search = element('input', null, {
    type: 'search',
    name: 'countryQuery',
    placeholder: translate(t, 'countries.searchPlaceholder', 'Search countries…'),
    'aria-label': translate(t, 'countries.searchAriaLabel', 'Search countries'),
    dataset: { action: 'filter-countries-query' },
  });
  searchWrap.append(search);
  const sort = element('select', 'select', {
    name: 'countrySort',
    'aria-label': translate(t, 'countries.sortAriaLabel', 'Sort countries'),
    dataset: { action: 'sort-countries' },
  });
  const az = element('option', null, { value: 'az' });
  az.textContent = translate(t, 'countries.sort.az', 'A–Z');
  const channels = element('option', null, { value: 'channels' });
  channels.textContent = translate(t, 'countries.sort.channels', 'Most channels');
  sort.append(az, channels);
  filters.append(searchWrap, sort);

  const tableWrap = element('div', 'country-table-wrap');
  const table = element('table', 'country-table');
  const caption = textNode('caption', 'sr-only', t, 'countries.tableCaption', 'Countries and source status');
  const head = element('thead');
  const headRow = element('tr');
  ['country', 'channels', 'sourceState'].forEach((name) => {
    const labels = {
      country: ['countries.country', 'Country'],
      channels: ['countries.channels', 'Channels'],
      sourceState: ['countries.sourceState', 'Source state'],
    };
    headRow.append(textNode('th', null, t, labels[name][0], labels[name][1]));
  });
  headRow.append(element('th', 'country-table__arrow'));
  head.append(headRow);
  const body = element('tbody');
  table.append(caption, head, body);
  tableWrap.append(table);
  const viewAll = actionButton({
    t,
    action: 'view-all-countries',
    iconName: 'caret-right',
    key: 'countries.viewAll',
    fallback: 'View all countries',
    className: 'button--text country-browser__view-all',
  });
  browser.append(regionTabs, filters, tableWrap, viewAll);
  directory.append(detail, browser);
  layout.append(atlas, directory);
  view.append(layout);

  return {
    view,
    map,
    mapMode,
    mapButton,
    listButton,
    detail,
    countryName,
    detailFlag,
    localName,
    facts: factNodes,
    shape,
    importButton,
    viewChannels,
    regionButtons,
    search,
    sort,
    tableBody: body,
  };
}

function createLibraryView(t) {
  const view = element('section', 'page page--library', { dataset: { page: 'library' }, hidden: true });
  const header = element('div', 'page-heading');
  const copy = element('div');
  copy.append(
    textNode('p', 'eyebrow', t, 'library.eyebrow', 'Your signal collection'),
    textNode('h1', null, t, 'library.title', 'Library'),
    textNode('p', 'page-heading__description', t, 'library.description', 'Favorites and imported channels, ready whenever you tune in.'),
  );
  const actions = element('div', 'page-heading__actions');
  actions.append(
    actionButton({
      t,
      action: 'navigate',
      iconName: 'stack-plus',
      key: 'library.manageSources',
      fallback: 'Manage sources',
      className: 'button--ghost',
      dataset: { view: 'sources' },
    }),
    actionButton({
      t,
      action: 'open-import-dialog',
      iconName: 'plus',
      key: 'library.addPlaylist',
      fallback: 'Add playlist',
      className: 'button--primary',
    }),
  );
  header.append(copy, actions);

  const stats = element('dl', 'library-stats');
  const statNodes = {};
  [
    ['favorites', 'favorites.title', 'Favorites'],
    ['channels', 'library.importedChannels', 'Imported channels'],
    ['sources', 'library.activeSources', 'Active sources'],
  ].forEach(([name, key, fallback]) => {
    const item = element('div', 'stat-card');
    const value = element('dd', 'stat-card__value');
    value.textContent = '0';
    item.append(textNode('dt', null, t, key, fallback), value);
    stats.append(item);
    statNodes[name] = value;
  });

  const toolbar = element('div', 'library-toolbar');
  const title = textNode('h2', null, t, 'library.channels', 'Saved channels');
  const filters = element('div', 'library-toolbar__filters');
  const searchWrap = element('label', 'field field--icon');
  searchWrap.append(icon('magnifying-glass'));
  const search = element('input', null, {
    type: 'search',
    placeholder: translate(t, 'library.searchPlaceholder', 'Search your library…'),
    'aria-label': translate(t, 'library.searchAriaLabel', 'Search your library'),
    dataset: { action: 'filter-library' },
  });
  searchWrap.append(search);
  const category = element('select', 'select library-filter-select', {
    'aria-label': translate(t, 'library.categoryFilterAriaLabel', 'Filter library by category'),
    dataset: { action: 'filter-library-category' },
  });
  const language = element('select', 'select library-filter-select', {
    'aria-label': translate(t, 'library.languageFilterAriaLabel', 'Filter library by language'),
    dataset: { action: 'filter-library-language' },
  });
  const favorites = actionButton({
    t,
    action: 'filter-library-favorites',
    iconName: 'heart',
    key: 'library.favoritesOnly',
    fallback: 'Favorites only',
    className: 'button--ghost library-favorites-filter',
  });
  favorites.setAttribute('aria-pressed', 'false');
  filters.append(searchWrap, category, language, favorites);
  toolbar.append(title, filters);
  const grid = element('div', 'channel-grid channel-grid--library');
  const loadMore = actionButton({
    t,
    action: 'load-more-library',
    iconName: 'plus',
    key: 'library.loadMore',
    fallback: 'Load more channels',
    className: 'button--ghost library-load-more',
  });
  loadMore.hidden = true;
  view.append(header, stats, toolbar, grid, loadMore);
  return { view, stats: statNodes, search, category, language, favorites, grid, loadMore };
}

function createGuideView(t) {
  const view = element('section', 'page page--guide', { dataset: { page: 'guide' }, hidden: true });
  const header = element('div', 'page-heading guide-heading');
  const copy = element('div');
  copy.append(
    textNode('p', 'eyebrow', t, 'guide.eyebrow', 'Live schedules'),
    textNode('h1', null, t, 'guide.title', 'TV Guide'),
    textNode('p', 'page-heading__description', t, 'guide.description', 'Now and next across your imported channels. Times are shown in your local timezone.'),
  );
  const refresh = actionButton({
    t, action: 'refresh-guide', iconName: 'arrows-clockwise', key: 'guide.refresh', fallback: 'Refresh guide', className: 'button--ghost',
  });
  header.append(copy, refresh);

  const setup = element('section', 'guide-setup panel');
  const setupCopy = element('div');
  setupCopy.append(
    icon('calendar-dots'),
    textNode('h2', null, t, 'guide.setupTitle', 'Connect an XMLTV guide'),
    textNode('p', null, t, 'guide.setupBody', 'Paste one or more XMLTV URLs. Catodo only contacts them after you save, then caches schedules locally for six hours.'),
  );
  const form = element('form', 'guide-setup__form', { dataset: { action: 'save-guide-sources' } });
  const input = element('textarea', null, {
    name: 'guideSources', rows: 3, spellcheck: false,
    placeholder: translate(t, 'guide.sourcePlaceholder', 'https://example.org/guide.xml'),
    'aria-label': translate(t, 'guide.sourceAriaLabel', 'XMLTV guide URLs'),
  });
  const consent = element('label', 'check-row');
  const checkbox = element('input', null, { type: 'checkbox', name: 'guideConsent', required: true });
  consent.append(checkbox, textNode('span', null, t, 'guide.consent', 'I understand these schedules come from third-party providers and Catodo will contact the URLs above.'));
  const save = actionButton({
    t, action: 'save-guide-sources', iconName: 'floppy-disk', key: 'common.save', fallback: 'Save', className: 'button--primary', type: 'submit',
  });
  form.append(input, consent, save);
  setup.append(setupCopy, form);

  const status = element('div', 'guide-status', { 'aria-live': 'polite' });
  const grid = element('div', 'guide-grid');
  view.append(header, setup, status, grid);
  return { view, setup, form, input, checkbox, status, grid, refresh };
}

function renderGuideCards(container, channels, t) {
  const fragment = document.createDocumentFragment();
  normaliseArray(channels).forEach((channel) => {
    const schedule = channelSchedule(channel);
    const now = Date.now();
    const card = element('article', 'guide-channel');
    const identity = element('button', 'guide-channel__identity', {
      type: 'button', dataset: { action: 'open-channel', channelId: safeId(channel?.channelId || channel?.id) },
    });
    const logo = element('span', 'channel-logo guide-channel__logo');
    renderLogo(logo, channel, t);
    const copy = element('span');
    const name = element('strong');
    name.textContent = safeText(channel?.name, translate(t, 'channel.unknown', 'Unknown channel'));
    copy.append(name, channelMeta(channel, 'guide-channel__meta'));
    identity.append(logo, copy, icon('play'));
    const timeline = element('div', 'guide-channel__timeline');
    if (!schedule.length) {
      timeline.append(textNode('p', 'guide-channel__empty', t, 'guide.noData', 'No current programme data for this channel.'));
    } else {
      schedule.slice(0, 6).forEach((programme) => {
        const isNow = Number(programme.start) <= now && Number(programme.stop) > now;
        const item = element('article', `programme-card${isNow ? ' is-now' : ''}`);
        const times = element('time', 'programme-card__time mono');
        times.textContent = `${formatProgrammeTime(programme.start)}–${formatProgrammeTime(programme.stop)}`;
        const title = element('strong');
        title.textContent = safeText(programme.title);
        item.append(times, title);
        if (isNow) item.append(textNode('span', 'programme-card__badge', t, 'guide.nowPlaying', 'Now playing'));
        if (programme.description) {
          const description = element('p');
          description.textContent = programme.description;
          item.append(description);
        }
        timeline.append(item);
      });
    }
    card.append(identity, timeline);
    fragment.append(card);
  });
  container.replaceChildren(fragment);
}

function createSourcesView(t) {
  const view = element('section', 'page page--sources', { dataset: { page: 'sources' }, hidden: true });
  const heading = element('div', 'page-heading');
  const copy = element('div');
  copy.append(
    textNode('p', 'eyebrow', t, 'settings.eyebrow', 'Setup & preferences'),
    textNode('h1', null, t, 'settings.title', 'Settings'),
    textNode('p', 'page-heading__description', t, 'settings.description', 'Manage channel sources, playback routing, and device preferences.'),
  );
  const back = actionButton({
    t,
    action: 'navigate',
    iconName: 'arrow-left',
    key: 'common.backToLibrary',
    fallback: 'Back to library',
    className: 'button--ghost',
    dataset: { view: 'library' },
  });
  heading.append(copy, back);

  const worldCatalog = element('article', 'world-catalog-callout');
  const worldIcon = element('div', 'world-catalog-callout__icon');
  worldIcon.append(icon('globe-hemisphere-west'));
  const worldCopy = element('div', 'world-catalog-callout__copy');
  worldCopy.append(
    textNode('p', 'eyebrow', t, 'settings.worldEyebrow', 'Ready-to-import default'),
    textNode('h2', null, t, 'settings.worldTitle', 'World catalog · all countries'),
    textNode('p', null, t, 'settings.worldBody', 'Import the complete public directory in one step. Add other playlists later: matching channels and identical stream endpoints are merged automatically.'),
  );
  const worldFacts = element('div', 'world-catalog-callout__facts');
  [
    ['broadcast', 'settings.worldChannels', '12,000+ public channels'],
    ['arrows-merge', 'settings.worldDedup', 'Automatic deduplication'],
    ['shield-check', 'settings.worldConsent', 'Consent always required'],
  ].forEach(([iconName, key, fallback]) => {
    const fact = element('span');
    fact.append(icon(iconName), textNode('span', null, t, key, fallback));
    worldFacts.append(fact);
  });
  worldCopy.append(worldFacts);
  const worldAction = actionButton({
    t,
    action: 'open-import-dialog',
    iconName: 'download-simple',
    key: 'settings.worldAction',
    fallback: 'Review world import',
    className: 'button--primary',
    dataset: { presetId: 'world-all' },
  });
  worldCatalog.append(worldIcon, worldCopy, worldAction);

  const layout = element('div', 'sources-layout');
  const sourcePanel = element('section', 'panel sources-panel');
  const sourceHeader = createSectionTitle(
    t,
    'sources.connected',
    'Connected playlists',
    actionButton({
      t,
      action: 'open-import-dialog',
      iconName: 'plus',
      key: 'library.addPlaylist',
      fallback: 'Add playlist',
      className: 'button--primary button--small',
    }),
  );
  const list = element('div', 'source-list');
  sourcePanel.append(sourceHeader, list);

  const guide = element('aside', 'panel source-guide');
  guide.append(
    textNode('h2', null, t, 'sources.howItWorks', 'How sources work'),
    textNode('p', null, t, 'sources.howBody', 'Add an M3U playlist URL or choose a country catalog. Streams stay with their original provider.'),
  );
  const guideList = element('ol', 'source-guide__steps');
  [
    ['link-simple', 'sources.stepOne', 'Connect an authorized playlist'],
    ['shield-check', 'sources.stepTwo', 'Confirm your access rights'],
    ['broadcast', 'sources.stepThree', 'Tune in from your library'],
  ].forEach(([iconName, key, fallback]) => {
    const item = element('li');
    item.append(icon(iconName), textNode('span', null, t, key, fallback));
    guideList.append(item);
  });
  const proxyForm = element('form', 'proxy-setting', { dataset: { action: 'set-proxy' } });
  const proxyLabel = element('label', 'field-stack');
  proxyLabel.append(
    textNode('span', null, t, 'sources.proxyLabel', 'Optional CORS proxy'),
  );
  const proxyInput = element('input', null, {
    type: 'url',
    name: 'proxy',
    inputMode: 'url',
    autocomplete: 'url',
    placeholder: translate(t, 'sources.proxyPlaceholder', 'https://proxy.example/?url='),
    'aria-describedby': 'proxy-setting-help',
  });
  proxyLabel.append(proxyInput);
  const proxyFooter = element('div', 'proxy-setting__footer');
  const proxyHelp = textNode('p', null, t, 'sources.proxyHelp', 'Used only when a provider blocks direct playlist or stream requests.');
  proxyHelp.id = 'proxy-setting-help';
  const proxySave = actionButton({
    t,
    action: 'set-proxy',
    iconName: 'floppy-disk',
    key: 'common.save',
    fallback: 'Save',
    className: 'button--ghost button--small',
    type: 'submit',
  });
  proxyFooter.append(proxyHelp, proxySave);
  proxyForm.append(proxyLabel, proxyFooter);
  guide.append(guideList, proxyForm);
  layout.append(sourcePanel, guide);
  view.append(heading, worldCatalog, layout);
  return { view, list, proxyForm, proxyInput };
}

function createSignalLab(t) {
  const panel = element('aside', 'signal-lab', {
    hidden: true,
    'aria-label': translate(t, 'signalLab.title', 'Signal Lab'),
  });
  const header = element('div', 'signal-lab__header');
  header.append(
    textNode('h2', null, t, 'signalLab.title', 'Signal Lab'),
    iconButton({ t, action: 'close-signal-lab', iconName: 'x', key: 'common.close', fallback: 'Close' }),
  );
  const profile = element('section', 'channel-profile');
  const chart = element('section', 'signal-chart');
  chart.append(textNode('h3', null, t, 'signalLab.throughputLastMinute', 'Throughput (last 60 seconds)'));
  const canvas = element('canvas', 'signal-chart__canvas', {
    width: 720,
    height: 160,
    role: 'img',
    'aria-label': translate(t, 'signalLab.chartAriaLabel', 'Throughput history chart'),
  });
  const chartScale = element('div', 'signal-chart__scale mono');
  const max = textNode('span', null, t, 'signalLab.mbpsValue', '{value} Mbps', { value: 20 });
  const mid = textNode('span', null, t, 'signalLab.mbpsValue', '{value} Mbps', { value: 10 });
  const min = textNode('span', null, t, 'signalLab.mbpsValue', '{value} Mbps', { value: 0 });
  chartScale.append(max, mid, min);
  const chartRange = element('div', 'signal-chart__range mono');
  chartRange.append(
    textNode('span', null, t, 'signalLab.secondsAgo', '{seconds}s ago', { seconds: 60 }),
    textNode('span', null, t, 'signalLab.now', 'Now'),
  );
  chart.append(canvas, chartScale, chartRange);

  const metrics = element('dl', 'signal-metrics');
  const metricNodes = {};
  const definitions = [
    ['received', 'signalLab.received', 'Received'],
    ['throughput', 'signalLab.throughput', 'Throughput'],
    ['abrEstimate', 'signalLab.abrEstimate', 'ABR estimate'],
    ['buffer', 'signalLab.buffer', 'Buffer'],
    ['latency', 'signalLab.liveLatency', 'Live latency'],
    ['resolution', 'signalLab.resolution', 'Resolution'],
    ['video', 'signalLab.videoCodec', 'Video'],
    ['audio', 'signalLab.audioCodec', 'Audio'],
    ['fps', 'signalLab.presentedFps', 'Presented'],
    ['dropped', 'signalLab.droppedFrames', 'Dropped'],
    ['level', 'signalLab.level', 'Level'],
    ['route', 'signalLab.route', 'Route'],
  ];
  definitions.forEach(([name, key, fallback]) => {
    const item = element('div', 'signal-metric');
    const label = textNode('dt', null, t, key, fallback);
    const value = element('dd', 'signal-metric__value mono');
    value.textContent = '—';
    const state = textNode('span', 'signal-metric__state', t, 'signalLab.measured', 'Measured');
    item.append(label, value, state);
    metrics.append(item);
    metricNodes[name] = { value, state };
  });

  const footer = element('div', 'signal-lab__footer');
  const upload = element('div');
  upload.append(
    textNode('span', 'signal-lab__footer-label', t, 'signalLab.upload', 'Upload'),
    textNode('strong', 'mono', t, 'signalLab.receiveOnly', 'N/A · receive-only'),
  );
  const copy = actionButton({
    t,
    action: 'copy-diagnostics',
    iconName: 'copy',
    key: 'signalLab.copyDiagnostics',
    fallback: 'Copy diagnostics',
    className: 'button--ghost',
  });
  footer.append(upload, copy);
  panel.append(header, profile, chart, metrics, footer);
  return { panel, profile, chart, canvas, scale: { max, mid, min }, metrics: metricNodes };
}

function createMultiviewSignalLab(t) {
  const backdrop = element('div', 'modal-backdrop multiview-lab-backdrop', {
    hidden: true,
    dataset: { overlay: 'multiview-signal-lab' },
  });
  const dialog = element('section', 'modal multiview-lab', {
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': 'multiview-lab-title',
  });
  const header = element('div', 'modal__header');
  const heading = element('div');
  const title = textNode('h2', null, t, 'signalLab.multiviewTitle', 'Multiview telemetry');
  title.id = 'multiview-lab-title';
  heading.append(title, textNode('p', null, t, 'signalLab.multiviewHint', 'Live browser measurements for every active feed.'));
  header.append(heading, iconButton({
    t,
    action: 'close-multiview-signal-lab',
    iconName: 'x',
    key: 'common.close',
    fallback: 'Close',
  }));
  const totals = element('dl', 'multiview-lab__totals');
  const totalNodes = {};
  [
    ['download', 'arrow-down', 'signalLab.aggregateDownload', 'Download'],
    ['received', 'download-simple', 'signalLab.aggregateReceived', 'Received'],
    ['buffer', 'timer', 'signalLab.aggregateBuffer', 'Total buffer'],
    ['upload', 'arrow-up', 'signalLab.upload', 'Upload'],
  ].forEach(([key, iconName, labelKey, fallback]) => {
    const item = element('div');
    item.append(icon(iconName), textNode('dt', null, t, labelKey, fallback));
    const value = element('dd', 'mono');
    value.textContent = key === 'upload' ? 'N/A' : '—';
    item.append(value);
    totals.append(item);
    totalNodes[key] = value;
  });
  const feeds = element('div', 'multiview-lab__feeds');
  const footer = element('div', 'multiview-lab__footer');
  footer.append(
    icon('info'),
    textNode('span', null, t, 'signalLab.uploadExplanation', 'Upload is unavailable: HLS playback is receive-only.'),
  );
  dialog.append(header, totals, feeds, footer);
  backdrop.append(dialog);
  return { backdrop, dialog, totals: totalNodes, feeds };
}

function renderMultiviewLabFeeds(container, feeds, t) {
  const fragment = document.createDocumentFragment();
  normaliseArray(feeds).forEach((feed, index) => {
    const row = element('article', 'multiview-lab__feed');
    const identity = element('div', 'multiview-lab__identity');
    const slot = element('strong', 'mono');
    slot.textContent = String(index + 1).padStart(2, '0');
    const copy = element('div');
    const name = element('strong');
    name.textContent = safeText(feed?.channel?.name, translate(t, 'channel.unknown', 'Unknown channel'));
    const route = element('span', 'mono');
    route.textContent = safeText(feed?.route, 'DIRECT').toUpperCase();
    copy.append(name, route);
    identity.append(slot, copy);
    const measurements = element('dl', 'multiview-lab__measurements');
    [
      ['↓', feed?.download || '0.00 Mbps'],
      ['BUFFER', feed?.buffer || '0.0 s'],
      ['VIDEO', feed?.resolution || 'N/A'],
      ['FPS', feed?.fps || '0.0'],
      ['DROP', safeText(feed?.dropped, '0')],
    ].forEach(([label, value]) => {
      const item = element('div');
      const dt = element('dt');
      dt.textContent = label;
      const dd = element('dd', 'mono');
      dd.textContent = value;
      item.append(dt, dd);
      measurements.append(item);
    });
    row.append(identity, measurements);
    fragment.append(row);
  });
  container.replaceChildren(fragment);
}

function createPlayer(t) {
  const overlay = element('section', 'player-view', {
    hidden: true,
    dataset: { overlay: 'player' },
    'aria-label': translate(t, 'player.title', 'Player'),
  });
  const toolbar = element('header', 'player-toolbar');
  const left = element('div', 'player-toolbar__group');
  left.append(
    actionButton({ t, action: 'close-player', iconName: 'caret-left', key: 'common.back', fallback: 'Back', className: 'button--ghost' }),
    actionButton({ t, action: 'toggle-favorite', iconName: 'heart', key: 'favorite.add', fallback: 'Favorite', className: 'button--ghost' }),
    actionButton({ t, action: 'add-to-multiview', iconName: 'grid-four', key: 'multiview.add', fallback: 'Add to Multiview', className: 'button--ghost' }),
  );
  const right = element('div', 'player-toolbar__group');
  right.append(
    actionButton({ t, action: 'toggle-player-fit', iconName: 'arrows-out', key: 'player.fit', fallback: 'Fit', className: 'button--ghost' }),
    actionButton({ t, action: 'toggle-fullscreen', iconName: 'corners-out', key: 'player.fullscreen', fallback: 'Full screen', className: 'button--ghost' }),
  );
  toolbar.append(left, right);

  const body = element('div', 'player-body');
  const stage = element('div', 'player-stage', { dataset: { action: 'toggle-player-chrome' } });
  const video = element('video', 'player-video', {
    playsInline: true,
    preload: 'metadata',
    dataset: { mediaRole: 'player' },
  });
  const status = element('div', 'player-status', { hidden: true, 'aria-live': 'polite' });
  status.append(icon('spinner-gap', 'is-spinning'));
  const statusText = textNode('span', null, t, 'player.loading', 'Tuning signal…');
  status.append(statusText);
  stage.append(video, status);
  const signalLab = createSignalLab(t);
  body.append(stage, signalLab.panel);

  const transport = element('footer', 'player-transport');
  const identity = element('div', 'player-identity');
  const previous = iconButton({ t, action: 'previous-channel', iconName: 'skip-back', key: 'player.previous', fallback: 'Previous channel' });
  const number = textNode('span', 'player-identity__number', t, 'channel.number', '{number}', { number: '000' });
  const copy = element('div', 'player-identity__copy');
  const name = textNode('strong', null, t, 'channel.unknown', 'Unknown channel');
  const meta = element('div', 'player-identity__meta');
  copy.append(name, meta);
  identity.append(previous, number, copy);

  const controls = element('div', 'player-controls');
  const labButton = iconButton({ t, action: 'open-signal-lab', iconName: 'cell-signal-high', key: 'signalLab.open', fallback: 'Open Signal Lab' });
  const rewind = iconButton({ t, action: 'rewind', iconName: 'caret-left', key: 'player.rewind', fallback: 'Rewind' });
  const playPause = iconButton({ t, action: 'toggle-playback', iconName: 'pause', key: 'player.pause', fallback: 'Pause', className: 'player-controls__primary' });
  const forward = iconButton({ t, action: 'forward', iconName: 'caret-right', key: 'player.forward', fallback: 'Forward' });
  const volume = element('label', 'volume-control');
  volume.append(icon('speaker-high'));
  const volumeValue = textNode('span', null, t, 'player.volumeValue', '{value}', { value: 100 });
  const range = element('input', null, {
    type: 'range',
    min: '0',
    max: '100',
    value: '100',
    'aria-label': translate(t, 'player.volume', 'Volume'),
    dataset: { action: 'set-volume' },
  });
  volume.append(volumeValue, range);
  controls.append(labButton, rewind, playPause, forward, volume);
  const programmeStrip = element('section', 'player-programmes');
  const localTime = element('div', 'player-programmes__clock');
  localTime.append(textNode('span', null, t, 'guide.localTime', 'Local time'), element('strong', 'mono'));
  const programmeList = element('div', 'player-programmes__list');
  programmeStrip.append(localTime, programmeList);
  transport.append(identity, programmeStrip, controls);
  overlay.append(toolbar, body, transport);
  return {
    overlay,
    toolbar,
    body,
    stage,
    video,
    status,
    statusText,
    signalLab,
    number,
    name,
    meta,
    favoriteButton: toolbar.querySelector('[data-action="toggle-favorite"]'),
    addToMultiviewButton: toolbar.querySelector('[data-action="add-to-multiview"]'),
    labButton,
    playPause,
    volume: range,
    volumeValue,
    programmeList,
    localTime: localTime.querySelector('strong'),
  };
}

function createMultiview(t) {
  const overlay = element('section', 'multiview-view', {
    hidden: true,
    dataset: { overlay: 'multiview' },
    'aria-label': translate(t, 'multiview.title', 'Multiview'),
  });
  const toolbar = element('header', 'multiview-toolbar');
  const titleGroup = element('div', 'multiview-toolbar__title');
  const back = actionButton({ t, action: 'close-multiview', iconName: 'caret-left', key: 'common.back', fallback: 'Back', className: 'button--ghost' });
  const title = element('div');
  title.append(
    textNode('h1', null, t, 'multiview.title', 'Multiview'),
    textNode('p', null, t, 'multiview.audioHint', 'Choose one feed for audio'),
  );
  titleGroup.append(back, title);

  const layout = element('div', 'multiview-layout-switcher segmented-control');
  [
    ['2', 'columns', 'multiview.twoFeeds', '2 feeds'],
    ['3', 'grid-nine', 'multiview.threeFeeds', '3 feeds'],
    ['4', 'grid-four', 'multiview.fourFeeds', '4 feeds'],
  ].forEach(([count, iconName, key, fallback]) => {
    const button = actionButton({
      t,
      action: 'set-multiview-layout',
      iconName,
      key,
      fallback,
      className: count === '4' ? 'is-active' : '',
      dataset: { count },
    });
    layout.append(button);
  });

  const toolbarActions = element('div', 'multiview-toolbar__actions');
  toolbarActions.append(
    actionButton({ t, action: 'add-multiview-channel', iconName: 'plus', key: 'multiview.addChannel', fallback: 'Add channel', className: 'button--ghost' }),
    actionButton({ t, action: 'toggle-fullscreen', iconName: 'corners-out', key: 'player.fullscreen', fallback: 'Full screen', className: 'button--ghost' }),
    actionButton({ t, action: 'close-multiview', iconName: 'sign-out', key: 'common.exit', fallback: 'Exit', className: 'button--ghost' }),
  );
  toolbar.append(titleGroup, layout, toolbarActions);

  const grid = element('div', 'multiview-grid', { dataset: { count: '4' } });
  const slots = [];
  for (let index = 0; index < MULTIVIEW_SIZE; index += 1) {
    const slotNumber = index + 1;
    const slot = element('article', 'multiview-slot', {
      dataset: { slot: String(slotNumber) },
    });
    const video = element('video', 'multiview-slot__video', {
      muted: true,
      playsInline: true,
      preload: 'metadata',
      dataset: { mediaRole: 'multiview', slot: String(slotNumber) },
    });
    const empty = element('div', 'multiview-slot__empty');
    empty.append(
      icon('plus'),
      textNode('span', null, t, 'channel.emptySlot', 'Empty feed'),
    );
    const top = element('div', 'multiview-slot__top');
    const id = element('div', 'multiview-slot__id');
    const number = element('strong');
    number.textContent = String(slotNumber).padStart(2, '0');
    id.append(number, textNode('span', 'status-chip', t, 'status.live', 'LIVE'));
    const slotActions = element('div', 'multiview-slot__actions');
    slotActions.append(
      actionButton({
        t,
        action: 'replace-multiview-channel',
        iconName: 'shuffle',
        key: 'multiview.random',
        fallback: 'Random',
        className: 'button--media',
        dataset: { slot: String(slotNumber) },
      }),
      actionButton({
        t,
        action: 'open-multiview-picker',
        iconName: 'magnifying-glass',
        key: 'multiview.chooseChannel',
        fallback: 'Choose channel',
        className: 'button--media multiview-slot__choose',
        dataset: { slot: String(slotNumber) },
      }),
      iconButton({
        t,
        action: 'remove-multiview-channel',
        iconName: 'x',
        key: 'multiview.removeFeed',
        fallback: 'Remove feed',
        className: 'button--media',
        dataset: { slot: String(slotNumber) },
      }),
    );
    top.append(id, slotActions);

  const audio = iconButton({
      t,
      action: 'select-multiview-audio',
      iconName: 'speaker-slash',
      key: 'multiview.listenToFeed',
      fallback: 'Listen to this feed',
      className: 'multiview-slot__audio button--media',
      dataset: { slot: String(slotNumber) },
    });
    const listening = textNode('span', 'multiview-slot__listening', t, 'multiview.listeningTo', 'You’re listening · {slot}', { slot: slotNumber });
    listening.hidden = true;
    const info = element('div', 'multiview-slot__info');
    const channelName = textNode('strong', null, t, 'channel.emptySlot', 'Empty feed');
    const meta = element('div');
    info.append(channelName, meta);
    slot.append(video, empty, top, audio, listening, info);
    grid.append(slot);
    slots.push({ slot, video, empty, number, channelName, meta, audio, listening });
  }

  const footer = element('footer', 'multiview-status');
  const statusNodes = {};
  const statusDefinitions = [
    ['feeds', 'broadcast', 'multiview.liveFeeds', '{count} live feeds', 'multiview.active', 'Active'],
    ['throughput', 'trend-up', 'multiview.totalThroughput', 'Total {value}', 'multiview.aggregateThroughput', 'Aggregate throughput'],
    ['audio', 'speaker-high', 'multiview.audioFeed', 'Audio {slot}', 'multiview.youAreListening', 'You’re listening'],
    ['signal', 'download-simple', 'signalLab.received', '0 B received', 'signalLab.measured', 'Measured'],
  ];
  statusDefinitions.forEach(([name, iconName, key, fallback, subKey, subFallback]) => {
    const item = element('div', 'multiview-status__item');
    item.append(icon(iconName));
    const copy = element('div');
    const value = textNode('strong', null, t, key, fallback, {
      count: 0,
      value: '0 Mbps',
      slot: '—',
    });
    const sub = textNode('span', null, t, subKey, subFallback);
    copy.append(value, sub);
    item.append(copy);
    footer.append(item);
    statusNodes[name] = { value, sub };
  });
  footer.append(actionButton({
    t,
    action: 'open-signal-lab',
    iconName: 'waveform',
    key: 'signalLab.title',
    fallback: 'Signal Lab',
    className: 'button--primary multiview-status__lab',
  }));
  overlay.append(toolbar, grid, footer);
  return { overlay, toolbar, layout, grid, slots, status: statusNodes };
}

function createChannelPicker(t) {
  const backdrop = element('div', 'modal-backdrop channel-picker-backdrop', {
    hidden: true,
    dataset: { overlay: 'channel-picker' },
  });
  const dialog = element('section', 'modal channel-picker', {
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': 'channel-picker-title',
  });
  const header = element('div', 'modal__header');
  const title = textNode('h2', null, t, 'multiview.pickerTitle', 'Choose channel · Slot {slot}', { slot: '01' });
  title.id = 'channel-picker-title';
  header.append(title, iconButton({
    t,
    action: 'close-multiview-picker',
    iconName: 'x',
    key: 'common.close',
    fallback: 'Close',
  }));

  const search = element('label', 'channel-picker__search');
  search.append(icon('magnifying-glass'));
  const input = element('input', null, {
    type: 'search',
    autocomplete: 'off',
    spellcheck: false,
    placeholder: translate(t, 'multiview.pickerSearch', 'Search channels, countries, languages…'),
    'aria-label': translate(t, 'multiview.pickerSearch', 'Search channels, countries, languages…'),
    dataset: { action: 'filter-multiview-picker' },
  });
  search.append(input);
  const count = element('p', 'channel-picker__count', { 'aria-live': 'polite' });
  const results = element('div', 'channel-picker__results', { role: 'listbox' });
  dialog.append(header, search, count, results);
  backdrop.append(dialog);
  return { backdrop, dialog, title, input, count, results };
}

function renderChannelPickerResults(container, channels, t) {
  const values = normaliseArray(channels);
  const fragment = document.createDocumentFragment();
  values.forEach((channel) => {
    const id = safeId(channel?.channelId || channel?.id || channel?.tvgId || channel?.url);
    const button = element('button', 'channel-picker__result', {
      type: 'button',
      role: 'option',
      dataset: { action: 'select-multiview-channel', channelId: id },
      'aria-label': translate(t, 'multiview.chooseNamedChannel', 'Choose {name}', { name: safeText(channel?.name) }),
    });
    const logo = element('span', 'channel-logo channel-picker__logo');
    renderLogo(logo, channel, t);
    const copy = element('span', 'channel-picker__copy');
    const name = element('strong');
    name.textContent = safeText(channel?.name, translate(t, 'channel.unknown', 'Unknown channel'));
    copy.append(name, channelMeta(channel, 'channel-picker__meta'));
    button.append(logo, copy, icon('caret-right'));
    fragment.append(button);
  });
  container.replaceChildren(fragment);
  if (!values.length) {
    renderEmpty(
      container,
      t,
      'multiview.pickerEmpty',
      'No matching channels',
      'Try a channel, country, or language.',
    );
  }
}

function createImportDialog(t) {
  const backdrop = element('div', 'modal-backdrop', { hidden: true, dataset: { overlay: 'import-dialog' } });
  const dialog = element('section', 'modal import-dialog', {
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': 'import-dialog-title',
  });
  const header = element('div', 'modal__header');
  const title = textNode('h2', null, t, 'import.title', 'Add external playlist');
  title.id = 'import-dialog-title';
  header.append(title, iconButton({ t, action: 'close-import-dialog', iconName: 'x', key: 'common.close', fallback: 'Close' }));

  const form = element('form', 'import-form', { dataset: { action: 'confirm-import' } });
  const presets = element('section', 'import-presets');
  const presetsHeader = element('div', 'import-presets__header');
  presetsHeader.append(
    textNode('h3', null, t, 'import.presetsTitle', 'Recommended playlists'),
    textNode('p', null, t, 'import.presetsHint', 'Official iptv-org directories — choose one to review before importing.'),
  );
  const presetGrid = element('div', 'import-presets__grid');
  presets.append(presetsHeader, presetGrid);
  const sourceFacts = element('dl', 'import-source-facts');
  const factNodes = {};
  [
    ['provider', 'globe', 'import.provider', 'Provider'],
    ['host', 'stack', 'import.host', 'Host'],
    ['source', 'file-arrow-down', 'import.source', 'Source'],
  ].forEach(([name, iconName, key, fallback]) => {
    const label = element('dt');
    label.append(icon(iconName), textNode('span', null, t, key, fallback));
    const value = element('dd');
    value.textContent = '—';
    sourceFacts.append(label, value);
    factNodes[name] = value;
  });

  const urlField = element('label', 'field-stack');
  urlField.append(textNode('span', null, t, 'import.urlLabel', 'Playlist URL'));
  const urlInput = element('input', null, {
    type: 'url',
    name: 'url',
    inputMode: 'url',
    autocomplete: 'url',
    placeholder: translate(t, 'import.urlPlaceholder', 'https://provider.example/playlist.m3u'),
  });
  urlField.append(urlInput);

  const note = element('div', 'import-note');
  note.append(icon('info'), textNode('p', null, t, 'import.fetchNotice', 'This playlist will be fetched only after you confirm.'));
  const legal = textNode('p', 'import-legal', t, 'import.legal', 'Catodo does not host or control third-party playlists, streams, availability or territorial rights. Confirm that you may access this source in your jurisdiction.');
  const consent = element('label', 'check-field');
  const checkbox = element('input', null, { type: 'checkbox', name: 'consent', required: true });
  consent.append(checkbox, textNode('span', null, t, 'import.consent', 'I acknowledge and confirm that I may access this source in my jurisdiction.'));

  const actions = element('div', 'modal__actions');
  const confirm = actionButton({
    t,
    action: 'confirm-import',
    iconName: 'download-simple',
    key: 'import.addPlaylist',
    fallback: 'Add playlist',
    className: 'button--primary',
    type: 'submit',
  });
  const cancel = actionButton({ t, action: 'close-import-dialog', key: 'common.cancel', fallback: 'Cancel', className: 'button--ghost' });
  actions.append(confirm, cancel);
  const sourceLink = actionButton({ t, action: 'view-import-source', key: 'import.viewSource', fallback: 'View source', className: 'button--text' });
  form.append(presets, sourceFacts, urlField, note, legal, consent, actions, sourceLink);
  dialog.append(header, form);
  backdrop.append(dialog);
  return { backdrop, dialog, title, form, facts: factNodes, presets, presetGrid, urlInput, consent: checkbox, confirm, sourceLink };
}

function renderSourcePresets(container, presets, t, selectedId = '') {
  const fragment = document.createDocumentFragment();
  normaliseArray(presets).forEach((preset) => {
    const button = actionButton({
      t,
      action: 'select-source-preset',
      iconName: safeText(preset.icon, 'broadcast'),
      fallback: safeText(preset.name, 'Playlist'),
      className: `source-preset${preset.featured ? ' source-preset--featured' : ''}${preset.id === selectedId ? ' is-active' : ''}`,
      dataset: { presetId: safeId(preset.id) },
    });
    const label = button.querySelector('.button__label');
    if (label) {
      const name = element('strong');
      name.textContent = safeText(preset.name);
      const description = element('span');
      description.textContent = safeText(preset.description);
      label.replaceChildren(name, description);
      if (preset.meta || preset.recommended) {
        const meta = element('small', 'source-preset__meta');
        if (preset.recommended) {
          const badge = textNode('b', null, t, 'import.recommended', 'Recommended');
          meta.append(badge);
        }
        if (preset.meta) {
          const details = element('span');
          details.textContent = safeText(preset.meta);
          meta.append(details);
        }
        label.append(meta);
      }
    }
    fragment.append(button);
  });
  container.replaceChildren(fragment);
}

function createSignalBar(t) {
  const bar = element('footer', 'signal-bar');
  const region = element('div', 'signal-bar__region');
  region.append(
    textNode('span', null, t, 'footer.global', 'Global'),
    icon('globe-hemisphere-west'),
  );
  const clock = textNode('time', 'signal-bar__clock', t, 'time.placeholder', '--:-- CET');
  const bars = element('div', 'ebu-bars', { 'aria-hidden': 'true' });
  for (let index = 0; index < 8; index += 1) bars.append(element('i'));
  const network = element('div', 'signal-bar__network');
  const downLabel = textNode('span', 'signal-bar__telemetry-label', t, 'footer.download', 'Down');
  const downValue = element('strong', 'mono');
  downValue.textContent = '0.00 Mbps';
  const upLabel = textNode('span', 'signal-bar__telemetry-label', t, 'footer.upload', 'Up');
  const upValue = element('strong', 'mono');
  upValue.textContent = 'N/A';
  network.append(icon('arrow-down'), downLabel, downValue, icon('arrow-up'), upLabel, upValue);
  const status = element('div', 'signal-bar__status');
  const statusLabel = textNode('span', 'signal-bar__telemetry-label', t, 'footer.buffer', 'Buffer');
  const statusText = element('strong', 'mono');
  statusText.textContent = '—';
  const statusMeta = element('span', 'signal-bar__status-meta mono');
  statusMeta.textContent = 'Waiting';
  status.append(icon('waveform'), statusLabel, statusText, statusMeta);
  bar.append(region, clock, bars, network, status);
  return { bar, clock, status, statusText, statusMeta, network, downValue, upValue };
}

function renderCountryRows(container, countries, t, selectedIso2) {
  const fragment = document.createDocumentFragment();
  normaliseArray(countries).forEach((country) => {
    const iso2 = safeIso2(country?.iso2 || country?.code);
    const name = safeText(country?.name || country?.countryName, iso2 || translate(t, 'countries.unknown', 'Unknown country'));
    const imported = Boolean(country?.imported || country?.sourceState === 'imported');
    const row = element('tr', iso2 === selectedIso2 ? 'is-selected' : '', {
      dataset: { action: 'select-country', iso2 },
      tabindex: '0',
      'aria-current': iso2 === selectedIso2 ? 'true' : undefined,
    });
    const countryCell = element('td');
    const code = element('span', 'country-code');
    code.textContent = iso2;
    const countryName = element('span', 'country-row__name');
    countryName.textContent = name;
    countryCell.append(countryFlag(iso2, name, 'country-row__flag'), code, countryName);

    const countCell = element('td');
    countCell.textContent = safeText(country?.channelCount ?? country?.channels ?? 0);
    const stateCell = element('td');
    stateCell.append(icon(imported ? 'check-circle' : 'circle'));
    stateCell.append(textNode(
      'span',
      null,
      t,
      imported ? 'countries.imported' : 'countries.notImported',
      imported ? 'Imported' : 'Not imported',
    ));
    const arrow = element('td', 'country-table__arrow');
    arrow.append(icon('caret-right'));
    row.append(countryCell, countCell, stateCell, arrow);
    fragment.append(row);
  });
  container.replaceChildren(fragment);
}

function renderSources(container, sources, t) {
  const values = normaliseArray(sources);
  if (!values.length) {
    renderEmpty(
      container,
      t,
      'sources.empty',
      'No playlists connected',
      'Add an authorized M3U playlist to start building your library.',
      actionButton({
        t,
        action: 'open-import-dialog',
        iconName: 'plus',
        key: 'library.addPlaylist',
        fallback: 'Add playlist',
        className: 'button--primary',
      }),
    );
    return;
  }

  const fragment = document.createDocumentFragment();
  values.forEach((source, index) => {
    const id = safeId(source?.sourceId || source?.id || source?.url || index);
    const row = element('article', 'source-row', { dataset: { tone: safeTone(source?.tone, index) } });
    const stateIcon = element('div', 'source-row__icon');
    stateIcon.append(icon(source?.error ? 'warning-circle' : 'broadcast'));
    const info = element('div', 'source-row__info');
    const name = element('h3');
    name.textContent = safeText(source?.name, translate(t, 'sources.untitled', 'Untitled playlist'));
    const host = element('p');
    host.textContent = safeText(source?.host || source?.url);
    const meta = element('div', 'source-row__meta');
    meta.append(textNode('span', null, t, 'sources.channelCount', '{count} channels', {
      count: safeText(source?.channelCount ?? source?.channels ?? 0),
    }));
    meta.append(textNode(
      'span',
      source?.error ? 'is-error' : 'is-ok',
      t,
      source?.error ? 'sources.needsAttention' : 'sources.connectedState',
      source?.error ? 'Needs attention' : 'Connected',
    ));
    info.append(name, host, meta);
    const actions = element('div', 'source-row__actions');
    actions.append(
      iconButton({ t, action: 'refresh-source', iconName: 'arrows-clockwise', key: 'sources.refresh', fallback: 'Refresh source', dataset: { sourceId: id } }),
      iconButton({ t, action: 'edit-source', iconName: 'pencil-simple', key: 'sources.edit', fallback: 'Edit source', dataset: { sourceId: id } }),
      iconButton({ t, action: 'remove-source', iconName: 'trash', key: 'sources.remove', fallback: 'Remove source', className: 'is-danger', dataset: { sourceId: id } }),
    );
    row.append(stateIcon, info, actions);
    fragment.append(row);
  });
  container.replaceChildren(fragment);
}

function setLibrarySelectOptions(select, values, allLabel, selected) {
  const optionValues = [...new Set(normaliseArray(values)
    .map((value) => safeText(value).trim())
    .filter(Boolean))];
  const options = [element('option')];
  options[0].value = '';
  options[0].textContent = allLabel;
  optionValues.forEach((value) => {
    const option = element('option');
    option.value = value;
    option.textContent = value;
    options.push(option);
  });
  select.replaceChildren(...options);
  select.value = safeText(selected);
}

function setFeatured(refs, channel, t) {
  const value = channel && typeof channel === 'object' ? channel : {};
  const id = safeId(value.channelId || value.id || value.tvgId || value.url);
  refs.liveCard.dataset.channelId = id;
  refs.openPlayer.dataset.channelId = id;
  refs.random.dataset.currentChannelId = id;
  refs.channelName.textContent = safeText(value.name, translate(t, 'channel.unknown', 'Unknown channel'));
  refs.description.textContent = safeText(
    value.description || value.tagline,
    translate(t, 'home.liveDescriptionFallback', 'Live television from around the world'),
  );
  refs.facts.country.textContent = channelCountry(value) || '—';
  refs.facts.language.textContent = channelLanguage(value) || '—';
  refs.facts.quality.textContent = channelQuality(value) || '—';
  refs.liveCard.dataset.tone = safeTone(value.tone ?? value.color, 6);
  setMedia(refs.video, { ...value, muted: value.muted !== false, autoplay: value.autoplay !== false });
  const muted = refs.video.muted;
  setTranslatedText(refs.liveBadgeText, t, muted ? 'status.liveMuted' : 'status.live', muted ? 'LIVE · MUTED' : 'LIVE');
  refs.mute.replaceChildren(icon(muted ? 'speaker-slash' : 'speaker-high'));
  refs.mute.setAttribute('aria-label', translate(t, muted ? 'player.unmute' : 'player.mute', muted ? 'Unmute' : 'Mute'));
  refs.mute.title = refs.mute.getAttribute('aria-label');
}

function setCountryDetail(refs, country, t) {
  const value = country && typeof country === 'object' ? country : {};
  const iso2 = safeIso2(value.iso2 || value.code);
  refs.detail.dataset.iso2 = iso2;
  refs.importButton.dataset.iso2 = iso2;
  refs.viewChannels.dataset.iso2 = iso2;
  refs.countryName.textContent = safeText(value.name, translate(t, 'countries.selectPrompt', 'Select a country'));
  refs.detailFlag.replaceChildren(countryFlag(iso2, value.name, 'country-detail__flag-image'));
  refs.detailFlag.hidden = !iso2;
  refs.localName.textContent = safeText(value.localName || value.nativeName);
  refs.localName.hidden = !refs.localName.textContent;
  refs.facts.language.textContent = safeText(value.language || value.languageName, '—');
  refs.facts.region.textContent = safeText(value.region, '—');
  refs.facts.channels.textContent = safeText(value.channelCount ?? value.channels, '—');
  const categories = Array.isArray(value.categories) ? value.categories.join(', ') : safeText(value.categories);
  refs.facts.categories.textContent = categories || '—';
  refs.facts.updated.textContent = safeText(value.updatedAt || value.lastUpdated, '—');
  refs.importButton.hidden = !iso2 || Boolean(value.imported);
  refs.viewChannels.hidden = !iso2;
  renderCountryShape(refs.shape, iso2, { t });
}

function updateChannelMeta(container, channel) {
  container.replaceChildren();
  const values = [channelCountry(channel), channelLanguage(channel), channelQuality(channel)].filter(Boolean);
  values.forEach((value, index) => {
    if (index) container.append(metadataDivider());
    const item = element('span');
    item.textContent = value;
    container.append(item);
  });
}

function drawSignalChart(canvas, values, maximum) {
  const context = canvas.getContext?.('2d');
  if (!context) return;
  const points = normaliseArray(values).map(Number).filter(Number.isFinite);
  const width = canvas.width;
  const height = canvas.height;
  const max = Number.isFinite(Number(maximum)) && Number(maximum) > 0
    ? Number(maximum)
    : Math.max(20, ...points, 1);
  context.clearRect(0, 0, width, height);
  context.strokeStyle = '#d8d8d5';
  context.lineWidth = 1;
  context.setLineDash([5, 6]);
  [0.15, 0.5, 0.85].forEach((ratio) => {
    context.beginPath();
    context.moveTo(0, height * ratio);
    context.lineTo(width, height * ratio);
    context.stroke();
  });
  context.setLineDash([]);
  if (!points.length) return;
  context.strokeStyle = '#065dff';
  context.lineWidth = 3;
  context.lineJoin = 'round';
  context.lineCap = 'round';
  context.beginPath();
  points.forEach((point, index) => {
    const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
    const y = height - Math.max(0, Math.min(max, point)) / max * (height - 12) - 6;
    if (!index) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.stroke();
}

function formatMetricValue(value) {
  if (value === undefined || value === null || value === '') return '—';
  return safeText(value);
}

function metadataFlag(value) {
  if (value === true) return true;
  if (value === false || value === undefined || value === null) return false;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalised = value.trim().toLowerCase();
    return Boolean(normalised) && !['false', '0', 'no', 'off', 'null', 'undefined'].includes(normalised);
  }
  if (Array.isArray(value)) return value.some(metadataFlag);
  if (typeof value === 'object') {
    if ('value' in value) return metadataFlag(value.value);
    if ('enabled' in value) return metadataFlag(value.enabled);
    return Object.keys(value).length > 0;
  }
  return false;
}

function metadataValue(value, separator) {
  if (value === true || value === false || value === undefined || value === null) return '';
  if (typeof value === 'string' && /^(?:true|false)$/i.test(value.trim())) return '';
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => metadataValue(item, separator)).filter(Boolean))].join(separator);
  }
  if (typeof value === 'object') {
    return metadataValue(value.name ?? value.label ?? value.code ?? value.id, separator);
  }
  return safeText(value);
}

function metadataDate(value, separator) {
  if (typeof value === 'boolean' || (typeof value === 'string' && /^(?:true|false)$/i.test(value.trim()))) return '';
  return metadataValue(value, separator);
}

function renderChannelProfile(container, channel, t) {
  const value = channel && typeof channel === 'object' ? channel : {};
  const endpoint = normaliseArray(value.endpoints).find((item) => item && typeof item === 'object')
    || (value.endpoint && typeof value.endpoint === 'object' ? value.endpoint : {});
  const feed = endpoint.feed && typeof endpoint.feed === 'object' ? endpoint.feed : {};
  const profileText = (group, key, vars) => translate(t, `signalLab.profile.${group}.${key}`, '', vars);
  const separator = profileText('values', 'listSeparator');
  const field = (...values) => values.map((item) => metadataValue(item, separator)).find(Boolean) || '';
  const categories = field(value.categoryNames, value.category_names) || value.categories;
  const guides = [
    ...normaliseArray(endpoint.guides),
    ...(endpoint.guide && typeof endpoint.guide === 'object' ? [endpoint.guide] : []),
    ...normaliseArray(feed.guides),
    ...normaliseArray(value.guides),
    ...(value.guide && typeof value.guide === 'object' ? [value.guide] : []),
  ].filter((item) => item && typeof item === 'object' && (!('available' in item) || metadataFlag(item.available)));
  const guideProviders = guides.flatMap((guide) => [
    guide.providerName,
    guide.provider,
    guide.site,
    ...normaliseArray(guide.providers),
    ...normaliseArray(guide.sources).map((source) => source?.providerName || source?.provider || source?.host),
  ]);
  const guideMappings = guides.map((guide) => [
    guide.siteName ?? guide.site_name,
    guide.site,
    guide.siteId ?? guide.site_id,
  ].map((item) => metadataValue(item, separator)).filter(Boolean));
  const guideLanguages = guides.flatMap((guide) => [
    guide.languageName,
    guide.language_name,
    guide.lang,
    ...normaliseArray(guide.languageNames || guide.language_names),
  ]);
  const hasGuide = guides.length > 0
    || metadataFlag(endpoint.hasGuide)
    || metadataFlag(feed.hasGuide)
    || metadataFlag(value.hasGuide);
  const closed = metadataFlag(value.closed);
  const closedDate = closed ? metadataDate(value.closed, separator) : '';
  const isMain = metadataFlag(endpoint.isMain)
    || metadataFlag(endpoint.is_main)
    || metadataFlag(feed.isMain)
    || metadataFlag(feed.is_main);
  const rows = [
    ['officialName', value.officialName ?? value.official_name],
    ['network', value.network],
    ['owners', value.owners, true],
    ['categories', categories, true],
    ['feedName', endpoint.feedName ?? endpoint.feed_name ?? feed.name ?? value.feedName],
    ['feedId', endpoint.feedId ?? endpoint.feed_id ?? feed.id ?? value.feedId],
    ['coverage', endpoint.broadcastArea ?? endpoint.broadcast_area ?? feed.broadcastArea ?? feed.broadcast_area ?? value.broadcastArea, true],
    ['languages', endpoint.languageNames ?? endpoint.language_names ?? feed.languageNames ?? feed.language_names ?? endpoint.languages ?? feed.languages ?? value.languageNames ?? value.languages, true],
    ['timezones', endpoint.timezones ?? feed.timezones ?? value.timezones, true],
    ['feedFormat', endpoint.feedFormat ?? endpoint.feed_format ?? feed.format ?? value.feedFormat],
    ['streamTitle', endpoint.streamTitle ?? endpoint.stream_title ?? endpoint.title ?? value.streamTitle],
    ['streamQuality', endpoint.quality ?? value.quality],
    ['streamLabel', endpoint.label ?? value.streamLabel],
    ['guideAvailability', hasGuide ? profileText('values', 'available') : ''],
    ['guideProviders', guideProviders, true],
    ['guideMappings', guideMappings, true],
    ['guideLanguages', guideLanguages, true],
    ['launched', metadataDate(value.launched, separator)],
    ['closedDate', closedDate],
    ['replacedBy', value.replacedBy ?? value.replaced_by],
  ].map(([key, raw, wide = false]) => ({
    label: profileText('labels', key),
    text: metadataValue(raw, separator),
    wide,
  })).filter((item) => item.text);

  const badges = [];
  if (metadataFlag(value.isNsfw) || metadataFlag(value.is_nsfw)) badges.push(['nsfw', 'danger']);
  if (metadataFlag(value.blocked) || metadataFlag(value.blocklist)) badges.push(['blocked', 'danger']);
  if (closed) badges.push(['closed', 'warning']);
  if (isMain) badges.push(['mainFeed', 'info']);

  container.replaceChildren();
  const header = element('div', 'channel-profile__header');
  header.append(textNode('h3', null, t, 'signalLab.channelProfile', ''));
  const chips = element('div', 'channel-profile__badges');
  badges.forEach(([key, tone]) => {
    const badge = element('span', `channel-profile__badge channel-profile__badge--${tone}`);
    badge.textContent = profileText('badges', key);
    chips.append(badge);
  });
  header.append(chips);
  container.append(header);

  const website = safeMediaUrl(metadataValue(value.website, separator));
  if (!rows.length && !website) {
    container.append(textNode('p', 'channel-profile__empty', t, 'signalLab.profileUnavailable', ''));
    return;
  }

  const facts = element('dl', 'channel-profile__facts');
  rows.forEach(({ label, text, wide }) => {
    const item = element('div', `channel-profile__fact${wide ? ' channel-profile__fact--wide' : ''}`);
    const term = element('dt');
    term.textContent = label;
    const description = element('dd');
    description.textContent = text;
    item.append(term, description);
    facts.append(item);
  });
  container.append(facts);

  if (website) {
    const link = element('a', 'channel-profile__website button button--ghost', {
      href: website,
      target: '_blank',
      rel: 'noopener noreferrer',
    });
    link.append(icon('arrow-square-out'), textNode('span', 'button__label', t, 'signalLab.officialWebsite', ''));
    container.append(link);
  }
}

function makeActionDispatcher(root, onAction) {
  const dispatch = (action, event, actionElement) => {
    if (!action) return;
    const source = actionElement || event.target?.closest?.('[data-action]');
    const form = source?.tagName === 'FORM' ? source : source?.closest?.('form');
    const detail = {
      action,
      event,
      element: source || null,
      target: event.target || null,
      dataset: source ? { ...source.dataset } : {},
      value: 'value' in (event.target || {}) ? event.target.value : undefined,
      checked: 'checked' in (event.target || {}) ? event.target.checked : undefined,
      formData: form ? new FormData(form) : null,
    };
    root.dispatchEvent(new CustomEvent('catodo:action', { bubbles: true, detail }));
    if (typeof onAction === 'function') onAction(action, detail);
  };

  const click = (event) => {
    const source = event.target.closest?.('[data-action]');
    if (!source || !root.contains(source)) return;
    if (source.tagName === 'FORM') return;
    if (source.tagName === 'BUTTON' && source.type === 'submit' && source.form?.dataset.action) return;
    dispatch(source.dataset.action, event, source);
  };
  const submit = (event) => {
    const form = event.target.closest?.('form[data-action]');
    if (!form || !root.contains(form)) return;
    event.preventDefault();
    dispatch(form.dataset.action, event, form);
  };
  const input = (event) => {
    const source = event.target.closest?.('input[data-action], select[data-action], textarea[data-action]');
    if (!source || !root.contains(source)) return;
    dispatch(source.dataset.action, event, source);
  };
  const keydown = (event) => {
    if (!['Enter', ' '].includes(event.key)) return;
    const source = event.target.closest?.('[data-action][role="button"], tr[data-action]');
    if (!source || !root.contains(source)) return;
    event.preventDefault();
    dispatch(source.dataset.action, event, source);
  };
  root.addEventListener('click', click);
  root.addEventListener('submit', submit);
  root.addEventListener('input', input);
  root.addEventListener('change', input);
  root.addEventListener('keydown', keydown);
  return { dispatch, destroy: () => {
    root.removeEventListener('click', click);
    root.removeEventListener('submit', submit);
    root.removeEventListener('input', input);
    root.removeEventListener('change', input);
    root.removeEventListener('keydown', keydown);
  } };
}

/**
 * Mounts Catodo's persistent application UI once.
 *
 * All remote catalog values are inserted through DOM properties/textContent.
 * Consumer actions are delivered as onAction(action, detail), where detail
 * contains dataset, value, checked, formData, event and the delegated element.
 */
export function mountAppUI(root, options = {}) {
  if (!(root instanceof Element)) throw new TypeError('mountAppUI requires a DOM Element root');
  const existing = mountedApps.get(root);
  if (existing) return existing;
  const t = options.t;
  const header = createHeader(t);
  const home = createHomeView(t);
  const countries = createCountriesView(t);
  const guide = createGuideView(t);
  const library = createLibraryView(t);
  const sources = createSourcesView(t);
  const player = createPlayer(t);
  const multiview = createMultiview(t);
  const multiviewSignalLab = createMultiviewSignalLab(t);
  const channelPicker = createChannelPicker(t);
  const importDialog = createImportDialog(t);
  const signalBar = createSignalBar(t);

  const shell = element('div', 'catodo-shell');
  const main = element('main', 'app-content');
  main.append(home.view, countries.view, guide.view, library.view, sources.view);
  shell.append(header.header, main, signalBar.bar);
  root.classList.add('catodo-app');
  root.replaceChildren(shell, player.overlay, multiview.overlay, multiviewSignalLab.backdrop, channelPicker.backdrop, importDialog.backdrop);

  const toastRegion = element('div', 'toast-region', {
    'aria-live': 'polite',
    'aria-atomic': 'true',
  });
  root.append(toastRegion);
  const dispatcher = makeActionDispatcher(root, options.onAction);
  const views = {
    home: home.view,
    countries: countries.view,
    guide: guide.view,
    library: library.view,
    sources: sources.view,
  };
  let toastTimer = 0;
  let activeShellView = 'home';

  const activateShellView = (name) => {
    const viewName = VIEW_NAMES.includes(name) ? name : 'home';
    activeShellView = viewName;
    Object.entries(views).forEach(([key, node]) => setViewVisible(node, key === viewName));
    setViewVisible(player.overlay, false);
    setViewVisible(multiview.overlay, false);
    shell.hidden = false;
    root.dataset.mode = 'shell';
    root.dataset.view = viewName;
    Object.entries(header.navButtons).forEach(([key, button]) => {
      const active = isPrimaryNavActive(key, viewName, root.dataset.homeMode);
      button.classList.toggle('is-active', active);
      button.toggleAttribute('aria-current', active);
    });
    header.settings.classList.toggle('is-active', viewName === 'sources');
    header.settings.setAttribute('aria-current', viewName === 'sources' ? 'page' : 'false');
    return viewName;
  };

  const api = {
    refs: {
      root,
      shell,
      header: header.header,
      nav: header.nav,
      navButtons: header.navButtons,
      searchForm: header.searchForm,
      searchInput: header.searchInput,
      main,
      views,
      home: home.view,
      homeLiveCard: home.liveCard,
      homeVideo: home.video,
      homeMap: home.map,
      homeChannelGrid: home.nearbyGrid,
      homeAtlas: home.atlas,
      favoriteGrid: home.favoriteGrid,
      countries: countries.view,
      countryMap: countries.map,
      countryShape: countries.shape,
      countryTableBody: countries.tableBody,
      guide: guide.view,
      guideInput: guide.input,
      guideGrid: guide.grid,
      library: library.view,
      libraryGrid: library.grid,
      libraryLoadMore: library.loadMore,
      sources: sources.view,
      sourceList: sources.list,
      proxyInput: sources.proxyInput,
      player: player.overlay,
      playerStage: player.stage,
      playerVideo: player.video,
      signalLab: player.signalLab.panel,
      signalChart: player.signalLab.canvas,
      multiview: multiview.overlay,
      multiviewGrid: multiview.grid,
      multiviewSlots: multiview.slots,
      multiviewVideos: multiview.slots.map((slot) => slot.video),
      multiviewSignalLab: multiviewSignalLab.backdrop,
      channelPicker: channelPicker.backdrop,
      channelPickerInput: channelPicker.input,
      channelPickerResults: channelPicker.results,
      importDialog: importDialog.backdrop,
      importForm: importDialog.form,
      importPresetGrid: importDialog.presetGrid,
      signalBar: signalBar.bar,
      toastRegion,
    },

    updateHeader(state = {}) {
      if (state.query !== undefined) header.searchInput.value = safeText(state.query);
      if (state.searchPlaceholder) header.searchInput.placeholder = safeText(state.searchPlaceholder);
      if (state.homeMode) root.dataset.homeMode = safeText(state.homeMode);
      if (state.view && VIEW_NAMES.includes(state.view) && shouldActivateShellView(root.dataset.mode)) {
        activateShellView(state.view);
      }
      if (state.activeNav) {
        Object.entries(header.navButtons).forEach(([key, button]) => {
          const active = key === state.activeNav;
          button.classList.toggle('is-active', active);
          button.toggleAttribute('aria-current', active);
        });
      }
      if (state.time !== undefined) {
        home.liveClock.textContent = safeText(state.time);
        signalBar.clock.textContent = safeText(state.time);
      }
      if (state.network !== undefined) signalBar.network.dataset.state = safeText(state.network).toLowerCase();
      if (state.telemetry) {
        signalBar.downValue.textContent = safeText(state.telemetry.download, '0.00 Mbps');
        signalBar.upValue.textContent = safeText(state.telemetry.upload, 'N/A');
        signalBar.statusText.textContent = safeText(state.telemetry.buffer, '—');
        signalBar.statusMeta.textContent = safeText(state.telemetry.detail, 'Waiting');
        signalBar.status.classList.toggle('is-error', Boolean(state.telemetry.issue));
      }
      if (state.signalOk !== undefined) {
        signalBar.status.classList.toggle('is-error', !state.signalOk);
      }
      return api;
    },

    focusExplore() {
      home.atlas.tabIndex = -1;
      scheduleFrame(() => {
        home.atlas.focus({ preventScroll: true });
        home.atlas.scrollIntoView({
          behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          block: 'nearest',
          inline: 'nearest',
        });
      });
      return api;
    },

    showMultiviewSignalLab(state = {}) {
      if (state === false || state?.open === false) {
        multiviewSignalLab.backdrop.hidden = true;
        return api;
      }
      multiviewSignalLab.totals.download.textContent = safeText(state.download, '0.00 Mbps');
      multiviewSignalLab.totals.received.textContent = safeText(state.received, '0 B');
      multiviewSignalLab.totals.buffer.textContent = safeText(state.buffer, '0.0 s');
      multiviewSignalLab.totals.upload.textContent = safeText(state.upload, 'N/A');
      renderMultiviewLabFeeds(multiviewSignalLab.feeds, state.feeds, t);
      multiviewSignalLab.backdrop.hidden = false;
      return api;
    },

    getImportCountryCode() {
      return safeIso2(countries.importButton.dataset.iso2 || countries.detail.dataset.iso2);
    },

    setCountryImportHandler(handler) {
      countries.importButton.onclick = typeof handler === 'function'
        ? (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            handler(safeIso2(countries.importButton.dataset.iso2 || countries.detail.dataset.iso2));
          }
        : null;
      return api;
    },

    renderHome(state = {}) {
      if (shouldActivateShellView(root.dataset.mode, state.activate)) activateShellView('home');
      const channels = normaliseArray(state.channels || state.nearbyChannels || state.liveChannels);
      const favorites = normaliseArray(state.favorites);
      const featured = state.featured || state.currentChannel || channels[0] || {};
      setFeatured(home, featured, t);
      setTranslatedText(home.liveCount, t, 'home.liveCount', '{count} LIVE', {
        count: safeText(state.liveCount ?? state.totalLive ?? channels.length),
      });
      setTranslatedText(home.countryCount, t, 'home.countryCount', '{count} COUNTRIES', {
        count: safeText(state.countryCount ?? state.totalCountries ?? 0),
      });
      renderChannelTiles(home.nearbyGrid, channels.filter((channel) => channel !== featured).slice(0, 9), t, { schedule: true });
      if (favorites.length) renderChannelTiles(home.favoriteGrid, favorites, t);
      else renderEmpty(
        home.favoriteGrid,
        t,
        'favorites.empty',
        'No favorites yet',
        'Save channels here for one-tap tuning.',
      );
      renderWorldMap(home.map, {
        t,
        selectedIso2: state.selectedIso2 || featured.iso2 || featured.countryCode,
        importedIso2: state.importedIso2,
        availableIso2: state.availableIso2,
        markers: state.markers,
        counts: state.countryCounts,
      });
      if (state.time !== undefined) api.updateHeader({ time: state.time });
      return api;
    },

    renderGuide(state = {}) {
      if (shouldActivateShellView(root.dataset.mode, state.activate)) activateShellView('guide');
      const channels = normaliseArray(state.channels);
      guide.setup.hidden = Boolean(state.configured);
      guide.refresh.hidden = !state.configured;
      if (state.sources) guide.input.value = normaliseArray(state.sources).join('\n');
      if (state.loading) setTranslatedText(guide.status, t, 'guide.loading', 'Loading live schedules…');
      else if (state.error) guide.status.textContent = safeText(state.error);
      else if (state.configured && !channels.some((channel) => channelSchedule(channel).length)) {
        setTranslatedText(guide.status, t, 'guide.empty', 'No matching programme data was returned. Check the guide URL and channel tvg-id values.');
      } else if (state.configured) {
        setTranslatedText(guide.status, t, 'guide.updated', 'Schedules cached locally · times shown in your timezone');
      } else guide.status.textContent = '';
      renderGuideCards(guide.grid, channels, t);
      return api;
    },

    renderCountries(state = {}) {
      if (shouldActivateShellView(root.dataset.mode, state.activate)) activateShellView('countries');
      const values = normaliseArray(state.countries);
      const selectedIso2 = safeIso2(state.selectedIso2 || state.selectedCountry?.iso2 || state.selectedCountry?.code);
      const selected = state.selectedCountry || values.find((country) => safeIso2(country?.iso2 || country?.code) === selectedIso2) || {};
      renderWorldMap(countries.map, {
        t,
        selectedIso2,
        importedIso2: state.importedIso2 || values.filter((country) => country?.imported).map((country) => country.iso2 || country.code),
        availableIso2: state.availableIso2 || values.map((country) => country.iso2 || country.code),
        markers: state.markers,
        counts: state.countryCounts,
      });
      setCountryDetail(countries, selected, t);
      renderCountryRows(countries.tableBody, values, t, selectedIso2);
      if (state.query !== undefined) countries.search.value = safeText(state.query);
      if (state.sort !== undefined) countries.sort.value = safeText(state.sort);
      if (state.region) {
        Object.entries(countries.regionButtons).forEach(([region, button]) => {
          const active = region === state.region;
          button.classList.toggle('is-active', active);
          button.setAttribute('aria-selected', active ? 'true' : 'false');
        });
      }
      if (state.mode) {
        const mapActive = state.mode !== 'list';
        countries.mapButton.classList.toggle('is-active', mapActive);
        countries.listButton.classList.toggle('is-active', !mapActive);
        countries.view.dataset.mode = mapActive ? 'map' : 'list';
      }
      return api;
    },

    renderLibrary(state = {}) {
      if (shouldActivateShellView(root.dataset.mode, state.activate)) activateShellView('library');
      const channels = normaliseArray(state.channels || state.favorites);
      library.stats.favorites.textContent = safeText(state.favoriteCount ?? state.favorites?.length ?? 0);
      library.stats.channels.textContent = safeText(state.channelCount ?? channels.length);
      library.stats.sources.textContent = safeText(state.sourceCount ?? 0);
      setLibrarySelectOptions(library.category, state.categories, translate(t, 'library.allCategories', 'All categories'), state.category);
      setLibrarySelectOptions(library.language, state.languages, translate(t, 'library.allLanguages', 'All languages'), state.language);
      const favoritesOnly = Boolean(state.favoritesOnly);
      library.favorites.classList.toggle('is-active', favoritesOnly);
      library.favorites.setAttribute('aria-pressed', favoritesOnly ? 'true' : 'false');
      if (channels.length) renderChannelTiles(library.grid, channels, t);
      else renderEmpty(
        library.grid,
        t,
        'library.empty',
        'Your library is waiting',
        'Add a playlist or favorite a live channel to keep it close.',
        actionButton({
          t,
          action: 'open-import-dialog',
          iconName: 'plus',
          key: 'library.addPlaylist',
          fallback: 'Add playlist',
          className: 'button--primary',
        }),
      );
      const visibleCount = Number(state.visibleCount ?? channels.length) || 0;
      const filteredCount = Number(state.filteredCount ?? visibleCount) || 0;
      library.loadMore.hidden = visibleCount >= filteredCount;
      const loadMoreLabel = library.loadMore.querySelector('.button__label');
      if (loadMoreLabel) loadMoreLabel.textContent = translate(
        t,
        'library.loadMoreCount',
        'Load more channels · {count} remaining',
        { count: Math.max(0, filteredCount - visibleCount) },
      );
      return api;
    },

    renderSources(state = {}) {
      if (shouldActivateShellView(root.dataset.mode, state.activate)) activateShellView('sources');
      renderSources(sources.list, state.sources || state.playlists, t);
      if (Object.prototype.hasOwnProperty.call(state, 'proxy')) {
        sources.proxyInput.value = safeText(state.proxy);
      }
      return api;
    },

    showPlayer(state = {}) {
      shell.hidden = true;
      setViewVisible(multiview.overlay, false);
      setViewVisible(player.overlay, true);
      root.dataset.mode = 'player';
      player.overlay.classList.toggle('is-chrome-visible', Boolean(state.chromeVisible));
      api.updatePlayer(state);
      return api;
    },

    updatePlayer(state = {}) {
      const channel = state.channel || state.currentChannel || state;
      if (channel && typeof channel === 'object') {
        const id = safeId(channel.channelId || channel.id || channel.tvgId || channel.url);
        player.overlay.dataset.channelId = id;
        player.favoriteButton.dataset.channelId = id;
        player.addToMultiviewButton.dataset.channelId = id;
        setMedia(player.video, { ...channel, muted: state.muted ?? channel.muted, autoplay: state.autoplay ?? channel.autoplay });
        player.number.textContent = channelNumber(channel, Number(channel.position || 0));
        player.name.textContent = safeText(channel.name, translate(t, 'channel.unknown', 'Unknown channel'));
        updateChannelMeta(player.meta, channel);
        player.favoriteButton.classList.toggle('is-active', Boolean(channel.favorite || channel.isFavorite));
        setTranslatedText(
          player.favoriteButton.querySelector('.button__label'),
          t,
          channel.favorite || channel.isFavorite ? 'favorite.remove' : 'favorite.add',
          channel.favorite || channel.isFavorite ? 'Remove favorite' : 'Favorite',
        );
        player.programmeList.replaceChildren();
        const programmes = channelSchedule(channel).slice(0, 4);
        if (!programmes.length) {
          player.programmeList.append(textNode('p', 'player-programmes__empty', t, 'guide.noData', 'No current programme data for this channel.'));
        } else {
          programmes.forEach((programme) => {
            const isNow = Number(programme.start) <= Date.now() && Number(programme.stop) > Date.now();
            const item = element('article', `player-programme${isNow ? ' is-now' : ''}`);
            const time = element('time', 'mono');
            time.textContent = formatProgrammeTime(programme.start);
            const title = element('strong');
            title.textContent = safeText(programme.title);
            item.append(time, title);
            if (isNow) item.append(textNode('span', null, t, 'guide.now', 'Now'));
            player.programmeList.append(item);
          });
        }
      }
      if (state.chromeVisible !== undefined) player.overlay.classList.toggle('is-chrome-visible', Boolean(state.chromeVisible));
      player.localTime.textContent = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date());
      if (state.loading !== undefined) {
        player.status.hidden = !state.loading && !state.error;
        setTranslatedText(player.statusText, t, state.error ? 'player.error' : 'player.loading', state.error ? 'Signal unavailable' : 'Tuning signal…');
        player.status.classList.toggle('is-error', Boolean(state.error));
      }
      if (state.playing !== undefined) {
        player.playPause.replaceChildren(icon(state.playing ? 'pause' : 'play'));
        player.playPause.setAttribute('aria-label', translate(t, state.playing ? 'player.pause' : 'player.play', state.playing ? 'Pause' : 'Play'));
        player.playPause.title = player.playPause.getAttribute('aria-label');
      }
      if (state.volume !== undefined) {
        const volume = Math.max(0, Math.min(100, Number(state.volume) || 0));
        player.volume.value = String(volume);
        setTranslatedText(player.volumeValue, t, 'player.volumeValue', '{value}', { value: Math.round(volume) });
      }
      if (state.signalLab !== undefined) api.showSignalLab(state.signalLab);
      return api;
    },

    showMultiview(state = {}) {
      shell.hidden = true;
      setViewVisible(player.overlay, false);
      setViewVisible(multiview.overlay, true);
      root.dataset.mode = 'multiview';
      api.updateMultiview(state);
      return api;
    },

    updateMultiview(state = {}) {
      const feeds = normaliseArray(state.feeds || state.channels).slice(0, MULTIVIEW_SIZE);
      const layoutCount = Math.max(2, Math.min(4, Number(state.layout || state.count || Math.max(feeds.length, 4)) || 4));
      multiview.grid.dataset.count = String(layoutCount);
      [...multiview.layout.children].forEach((button) => {
        button.classList.toggle('is-active', button.dataset.count === String(layoutCount));
      });
      const hasAudioIndex = Object.prototype.hasOwnProperty.call(state, 'audioIndex');
      const hasAudioSlot = Object.prototype.hasOwnProperty.call(state, 'audioSlot');
      const muteAll = state.mutedAll === true
        || (hasAudioIndex && state.audioIndex === null)
        || (hasAudioSlot && state.audioSlot === null);
      let audioIndex = null;
      if (!muteAll && hasAudioIndex && Number.isFinite(Number(state.audioIndex))) {
        audioIndex = Math.max(0, Math.min(3, Number(state.audioIndex)));
      } else if (!muteAll && hasAudioSlot && Number.isFinite(Number(state.audioSlot))) {
        audioIndex = Math.max(0, Math.min(3, Number(state.audioSlot) - 1));
      }
      multiview.slots.forEach((refs, index) => {
        const feed = feeds[index];
        refs.slot.hidden = index >= layoutCount;
        refs.slot.classList.toggle('is-empty', !feed);
        const isListening = Boolean(feed) && audioIndex !== null && index === audioIndex;
        refs.slot.classList.toggle('is-listening', isListening);
        refs.video.muted = !isListening;
        refs.listening.hidden = !isListening;
        refs.audio.replaceChildren(icon(isListening ? 'speaker-high' : 'speaker-slash'));
        if (feed) {
          setMedia(refs.video, { ...feed, muted: !isListening, autoplay: state.autoplay !== false });
          refs.number.textContent = String(index + 1).padStart(2, '0');
          refs.channelName.textContent = safeText(feed.name, translate(t, 'channel.unknown', 'Unknown channel'));
          updateChannelMeta(refs.meta, feed);
          refs.slot.dataset.channelId = safeId(feed.channelId || feed.id || feed.tvgId || feed.url);
        } else {
          refs.channelName.textContent = translate(t, 'channel.emptySlot', 'Empty feed');
          refs.meta.replaceChildren();
          delete refs.slot.dataset.channelId;
        }
      });
      setTranslatedText(multiview.status.feeds.value, t, 'multiview.liveFeeds', '{count} live feeds', { count: feeds.length });
      setTranslatedText(multiview.status.throughput.value, t, 'multiview.totalThroughput', 'Total {value}', {
        value: safeText(state.throughput, '0 Mbps'),
      });
      setTranslatedText(multiview.status.audio.value, t, 'multiview.audioFeed', 'Audio {slot}', {
        slot: audioIndex !== null && feeds[audioIndex] ? String(audioIndex + 1).padStart(2, '0') : '—',
      });
      multiview.status.signal.value.textContent = safeText(state.received, '0 B received');
      return api;
    },

    showChannelPicker(state = {}) {
      if (state === false || state?.open === false) {
        channelPicker.backdrop.hidden = true;
        channelPicker.input.value = '';
        delete channelPicker.backdrop.dataset.slot;
        return api;
      }
      const slot = Math.max(1, Math.min(MULTIVIEW_SIZE, Number(state.slot) || 1));
      channelPicker.backdrop.dataset.slot = String(slot);
      channelPicker.title.textContent = translate(t, 'multiview.pickerTitle', 'Choose channel · Slot {slot}', {
        slot: String(slot).padStart(2, '0'),
      });
      channelPicker.input.value = safeText(state.query);
      renderChannelPickerResults(channelPicker.results, state.channels, t);
      setTranslatedText(channelPicker.count, t, 'multiview.pickerCount', '{count} channels', {
        count: normaliseArray(state.channels).length,
      });
      channelPicker.backdrop.hidden = false;
      scheduleFrame(() => channelPicker.input.focus());
      return api;
    },

    showImportDialog(state = {}) {
      if (state === false || state?.open === false) {
        importDialog.backdrop.hidden = true;
        importDialog.form.reset();
        delete importDialog.form.dataset.iso2;
        delete importDialog.form.dataset.sourceId;
        delete importDialog.form.dataset.presetId;
        importDialog.urlInput.readOnly = false;
        return api;
      }
      const source = state?.source && typeof state.source === 'object'
        ? state.source
        : state?.country && typeof state.country === 'object'
          ? state.country
          : state;
      const presets = normaliseArray(state?.presets);
      importDialog.presets.hidden = !presets.length;
      renderSourcePresets(importDialog.presetGrid, presets, t, safeId(source.presetId || source.id));
      importDialog.form.dataset.presetId = safeId(source.presetId);
      importDialog.backdrop.hidden = false;
      const iso2 = safeIso2(source.iso2 || source.code);
      importDialog.backdrop.dataset.iso2 = iso2;
      importDialog.form.dataset.iso2 = iso2;
      importDialog.form.dataset.sourceId = safeId(source.sourceId || source.id || source.url);
      importDialog.title.textContent = translate(
        t,
        source.iso2 ? 'import.countryTitle' : source.presetId ? 'import.presetTitle' : 'import.title',
        source.iso2 ? 'Add {country} playlist' : source.presetId ? 'Add {playlist}' : 'Add external playlist',
        { country: safeText(source.name), playlist: safeText(source.name) },
      );
      importDialog.facts.provider.textContent = safeText(source.provider, '—');
      importDialog.facts.host.textContent = safeText(source.host, '—');
      importDialog.facts.source.textContent = safeText(source.source || source.description || source.name, '—');
      importDialog.urlInput.value = safeText(source.url);
      importDialog.urlInput.readOnly = Boolean(source.presetId);
      importDialog.urlInput.closest('.field-stack').hidden = Boolean(source.hideUrl || (source.iso2 && !source.url));
      importDialog.consent.checked = Boolean(source.consent);
      importDialog.confirm.dataset.iso2 = iso2;
      importDialog.confirm.dataset.sourceId = safeId(source.sourceId || source.id || source.url);
      importDialog.sourceLink.dataset.url = safeMediaUrl(source.sourceUrl || source.url);
      scheduleFrame(() => importDialog.dialog.querySelector('button, input')?.focus());
      return api;
    },

    setImportBusy(busy) {
      const active = Boolean(busy);
      importDialog.form.setAttribute('aria-busy', active ? 'true' : 'false');
      importDialog.confirm.disabled = active;
      importDialog.consent.disabled = active;
      importDialog.urlInput.disabled = active;
      const label = importDialog.confirm.querySelector('.button__label');
      if (label) label.textContent = active
        ? translate(t, 'import.importing', 'Importing catalog…')
        : translate(t, 'import.addPlaylist', 'Add playlist');
      importDialog.confirm.replaceChildren(
        icon(active ? 'spinner-gap' : 'download-simple'),
        label || textNode('span', 'button__label', t, active ? 'import.importing' : 'import.addPlaylist', active ? 'Importing catalog…' : 'Add playlist'),
      );
      importDialog.confirm.classList.toggle('is-loading', active);
      return api;
    },

    showSignalLab(state = true) {
      const open = state !== false && state?.open !== false;
      player.signalLab.panel.hidden = !open;
      player.body.classList.toggle('has-signal-lab', open);
      player.labButton.classList.toggle('is-active', open);
      if (!open || state === true) return api;
      renderChannelProfile(player.signalLab.profile, state.channel, t);
      const metrics = state.metrics || state;
      Object.entries(player.signalLab.metrics).forEach(([key, refs]) => {
        const metric = metrics[key];
        const value = metric && typeof metric === 'object' ? metric.value : metric;
        const label = metric && typeof metric === 'object' ? metric.state : undefined;
        refs.value.textContent = formatMetricValue(value);
        if (label !== undefined) refs.state.textContent = safeText(label);
      });
      const max = Number(state.maximum || state.maxMbps || 20) || 20;
      setTranslatedText(player.signalLab.scale.max, t, 'signalLab.mbpsValue', '{value} Mbps', { value: max });
      setTranslatedText(player.signalLab.scale.mid, t, 'signalLab.mbpsValue', '{value} Mbps', { value: Math.round(max / 2) });
      drawSignalChart(player.signalLab.canvas, state.throughputHistory || state.samples, max);
      return api;
    },

    toast(message, options = {}) {
      window.clearTimeout(toastTimer);
      const node = element('div', `toast toast--${safeText(options.tone, 'info')}`, { role: 'status' });
      node.append(icon(options.icon || (options.tone === 'error' ? 'warning-circle' : 'check-circle')));
      const copy = element('span');
      copy.textContent = safeText(message, translate(t, 'toast.done', 'Done'));
      node.append(copy);
      toastRegion.replaceChildren(node);
      scheduleFrame(() => node.classList.add('is-visible'));
      toastTimer = window.setTimeout(() => {
        node.classList.remove('is-visible');
        window.setTimeout(() => node.remove(), 220);
      }, Math.max(1200, Number(options.duration) || 3200));
      return api;
    },

    showView(name) {
      activateShellView(name);
      return api;
    },

    destroy() {
      window.clearTimeout(toastTimer);
      dispatcher.destroy();
      root.replaceChildren();
      root.classList.remove('catodo-app');
      delete root.dataset.mode;
      delete root.dataset.view;
      mountedApps.delete(root);
    },
  };

  renderWorldMap(home.map, { t });
  renderWorldMap(countries.map, { t });
  renderEmpty(home.favoriteGrid, t, 'favorites.empty', 'No favorites yet', 'Save channels here for one-tap tuning.');
  renderEmpty(library.grid, t, 'library.empty', 'Your library is waiting', 'Add a playlist or favorite a live channel to keep it close.');
  renderSources(sources.list, [], t);
  activateShellView('home');
  mountedApps.set(root, api);
  return api;
}

export { renderChannelTiles };
