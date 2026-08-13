import { renderCountryShape, renderWorldMap } from './world-map.js';
import { isPrimaryNavActive, shouldActivateShellView } from './view-mode.js';
import { EXPLORE_CATEGORIES } from './explore-model.js';
import { featuredChannelIdentity } from './channel-identity.js';
import { APP_VERSION } from '../version.js';
import { channelLocalTime, formatGuideDateTime, formatGuideTime } from './time-format.js';
import { enableGuideTimelineDrag } from './guide-timeline-drag.js';
import { favoriteEffectPosition, resolveFavoriteEffectHost } from './favorite-effect-host.js';
import { programmeCardNeedsExpansion } from './guide-programme-card.js';
import { countryGuideControlState, guideProgrammeFallback } from './country-guide-model.js';
import { channelMetadataBadges } from './channel-meta-model.js';

const FLAG_URLS = import.meta.glob('../../assets/vendor/flags/4x3/*.svg', {
  eager: true,
  query: '?url&no-inline',
  import: 'default',
});

const TONES = ['white', 'red', 'green', 'yellow', 'cyan', 'magenta', 'blue'];
const VIEW_NAMES = ['home', 'explore', 'countries', 'guide', 'library', 'sources'];
const MULTIVIEW_SIZE = 4;
const CATODO_LOGO_URL = './icons/catodo-netmilk-tv-transparent-512.png';
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
  const label = translate(t, key, fallback);
  const button = element('button', `button ${className}`.trim(), {
    type,
    'aria-label': label,
    dataset: { action, ...dataset },
  });
  if (iconName) button.append(icon(iconName));
  const visibleLabel = element('span', 'button__label');
  visibleLabel.textContent = label;
  button.append(visibleLabel);
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

function filledFavoriteIcon(className = 'favorite-glyph') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', `${className} favorite-glyph--filled`);
  svg.setAttribute('viewBox', '0 0 1024 1024');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M960 408c0 280-415.16 506.64-432.84 516-4.385 2.405-9.607 3.819-15.16 3.819s-10.775-1.414-15.327-3.903l.167.084C479.16 914.64 64 688 64 408c.159-136.903 111.097-247.841 247.985-248H312c82.6 0 154.92 35.52 200 95.56C557.08 195.52 629.4 160 712 160c136.903.159 247.841 111.097 248 247.985V408z');
  svg.append(path);
  return svg;
}

function setFavoriteGlyph(button, isFavorite) {
  const glyph = button?.querySelector('.favorite-glyph, i');
  if (!glyph) return;
  if (isFavorite) glyph.replaceWith(filledFavoriteIcon());
  else glyph.replaceWith(icon('heart', 'favorite-glyph'));
}

function playFavoriteEffect(root, anchor, mode) {
  if (!(anchor instanceof Element) || !root) return Promise.resolve();
  const rect = anchor.getBoundingClientRect();
  const host = resolveFavoriteEffectHost(root, anchor);
  const isPlayerToolbar = Boolean(anchor.closest('.player-toolbar'));
  const position = favoriteEffectPosition(rect, { playerToolbar: isPlayerToolbar });
  const effect = element('span', `favorite-effect favorite-effect--${mode}${isPlayerToolbar ? ' favorite-effect--player' : ''}`, { 'aria-hidden': 'true' });
  effect.style.left = `${position.left}px`;
  effect.style.top = `${position.top}px`;
  if (mode === 'add') {
    effect.append(filledFavoriteIcon('favorite-effect__heart'));
    [
      [-25, -25, 0], [0, -34, 35], [27, -22, 70], [34, 4, 20],
      [22, 27, 60], [-8, 34, 10], [-31, 19, 45], [-35, -6, 80],
    ].forEach(([x, y, delay], index) => {
      const star = element('span', 'favorite-effect__star');
      star.style.setProperty('--burst-x', `${x}px`);
      star.style.setProperty('--burst-y', `${y}px`);
      star.style.setProperty('--burst-delay', `${delay}ms`);
      star.style.setProperty('--burst-scale', index % 3 === 0 ? '0.72' : '1');
      effect.append(star);
    });
  } else {
    effect.append(element('span', 'favorite-effect__bolt'), element('span', 'favorite-effect__flash'));
  }
  host.append(effect);
  const duration = mode === 'remove' ? 560 : 940;
  window.setTimeout(() => effect.remove(), duration + 80);
  return new Promise((resolve) => window.setTimeout(resolve, mode === 'remove' ? 390 : 0));
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

  // Partial UI refreshes (programme data, chrome visibility, favorites, metrics)
  // must never reset the media element's audio state. Only an explicit audio
  // update is allowed to change `muted`.
  if (Object.prototype.hasOwnProperty.call(data, 'muted') && data.muted !== undefined) {
    video.muted = Boolean(data.muted);
  }
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
  image.addEventListener('error', () => {
    const original = safeMediaUrl(channel?.originalLogo, { image: true });
    if (original && image.src !== original && image.dataset.originalTried !== 'true') {
      image.dataset.originalTried = 'true';
      image.src = original;
      return;
    }
    image.replaceWith(fallback);
  });
  container.append(image);
}

function metadataDivider() {
  const node = element('span', 'meta-divider', { 'aria-hidden': 'true' });
  node.textContent = '–';
  return node;
}

function channelMetaValue(channel, type) {
  return safeText(channelMetadataBadges(channel).find((badge) => badge.type === type)?.value);
}

function channelCountry(channel) {
  return channelMetaValue(channel, 'country');
}

function channelLanguage(channel) {
  return channelMetaValue(channel, 'language');
}

function channelQuality(channel) {
  return channelMetaValue(channel, 'quality');
}

const CHANNEL_META_LABELS = {
  country: ['channelMeta.country', 'Country'],
  language: ['channelMeta.language', 'Language'],
  quality: ['channelMeta.quality', 'Resolution'],
  genre: ['channelMeta.genre', 'Genre'],
};

function appendChannelMeta(container, channel, t) {
  channelMetadataBadges(channel).forEach((badge) => {
    const [key, fallback] = CHANNEL_META_LABELS[badge.type];
    const label = translate(t, key, fallback);
    const item = element('span', `channel-meta__item channel-meta__item--${badge.type}`, {
      title: `${label}: ${badge.value}`,
      'aria-label': `${label}: ${badge.value}`,
    });
    const value = element('span', 'channel-meta__value');
    value.textContent = safeText(badge.value);
    item.append(icon(badge.icon), value);
    container.append(item);
  });
}

function channelMeta(channel, className = 'channel-meta', t) {
  const classes = className === 'channel-meta' ? className : `channel-meta ${className}`;
  const row = element('div', classes);
  appendChannelMeta(row, channel, t);
  return row;
}

function channelNumber(channel, index) {
  const supplied = channel?.number ?? channel?.position;
  const numeric = Number(supplied ?? index + 1);
  return Number.isFinite(numeric) ? String(Math.max(0, Math.floor(numeric))).padStart(3, '0') : safeText(supplied);
}

const formatProgrammeTime = formatGuideTime;

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
      'aria-label': translate(
        t,
        options.ariaLabelKey || 'channel.openAriaLabel',
        options.ariaLabelFallback || 'Open {name}',
        { name: safeText(channel?.name) },
      ),
    });
    const masthead = element('span', 'channel-tile__masthead');
    masthead.append(textNode('span', 'channel-tile__number', t, 'channel.number', '{number}', {
      number: channelNumber(channel, index),
    }));
    const logo = element('span', 'channel-logo channel-tile__logo');
    renderLogo(logo, channel, t);
    masthead.append(logo);
    main.append(masthead);
    const name = element('strong', 'channel-tile__name');
    name.textContent = safeText(channel?.name, translate(t, 'channel.unknown', 'Unknown channel'));
    main.append(name, channelMeta(channel, 'channel-meta', t));
    if (options.schedule === true) {
      const schedule = channelSchedule(channel);
      const now = schedule.find((programme) => Number(programme.start) <= Date.now() && Number(programme.stop) > Date.now());
      const next = schedule.find((programme) => Number(programme.start) > Date.now());
      const fallback = guideProgrammeFallback(channel?.guideStatus);
      const strip = element('div', 'channel-tile__schedule');
      const nowRow = element('div');
      nowRow.append(
        textNode('span', 'channel-tile__schedule-label', t, 'guide.now', 'Now'),
        textNode('strong', null, t, now ? 'guide.programmeValue' : fallback.key, now ? '{time} · {title}' : fallback.fallback, {
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
      const isFavorite = Boolean(channel?.favorite || channel?.isFavorite);
      const favorite = iconButton({
        t,
        action: isFavorite ? 'remove-favorite' : 'add-favorite',
        iconName: 'heart',
        key: isFavorite ? 'favorite.remove' : 'favorite.add',
        fallback: isFavorite ? 'Remove from favorites' : 'Add to favorites',
        className: `channel-tile__favorite${isFavorite ? ' is-active' : ''}`,
        dataset: { channelId: id },
      });
      favorite.setAttribute('aria-pressed', isFavorite ? 'true' : 'false');
      setFavoriteGlyph(favorite, isFavorite);
      tile.append(favorite);
    }
    if (channel?.guideAvailable) {
      tile.append(iconButton({
        t,
        action: 'open-channel-guide',
        iconName: 'calendar-dots',
        key: 'guide.openChannelGuide',
        fallback: `Open ${safeText(channel?.name)} guide`,
        className: 'channel-tile__guide',
        dataset: { channelId: id },
      }));
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
  const brandLogo = element('img', 'brand__logo', {
    src: CATODO_LOGO_URL,
    alt: '',
    'aria-hidden': 'true',
    draggable: false,
  });
  const brandCopy = element('span', 'brand__copy');
  const brandVersion = element('span', 'brand__version');
  brandVersion.textContent = `v${APP_VERSION}`;
  brandCopy.append(textNode('span', 'brand__name', t, 'brand.name', 'Catodo'), brandVersion);
  brand.append(brandLogo, brandCopy);

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
    const button = element('button', 'primary-nav__item', {
      type: 'button',
      dataset: { action, view, mode: view },
    });
    button.append(textNode('span', null, t, key, fallback));
    nav.append(button);
    navButtons[view] = button;
  });
  const more = element('div', 'primary-nav__more');
  const moreSummary = element('button', 'primary-nav__item', { type: 'button', dataset: { action: 'toggle-more-menu' }, 'aria-expanded': 'false' });
  moreSummary.append(textNode('span', null, t, 'nav.more', 'More'), icon('caret-down'));
  const moreMenu = element('div', 'primary-nav__more-menu', { hidden: true });
  [['guide', 'calendar-blank', 'nav.guide', 'TV Guide'], ['library', 'books', 'nav.library', 'Library'], ['sources', 'gear-six', 'nav.settings', 'Settings']].forEach(([view, iconName, key, fallback]) => {
    const button = actionButton({ t, action: 'navigate', iconName, key, fallback, className: 'button--ghost', dataset: { view } });
    moreMenu.append(button);
  });
  more.append(moreSummary, moreMenu);
  nav.append(more);

  const searchForm = element('form', 'global-search', {
    id: 'global-search-panel',
    dataset: { action: 'search' },
    role: 'search',
  });
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
  const searchClose = iconButton({
    t,
    action: 'close-mobile-search',
    iconName: 'x',
    key: 'search.close',
    fallback: 'Close search',
    className: 'global-search__close',
  });
  searchForm.append(searchClose);

  const searchToggle = iconButton({
    t,
    action: 'toggle-mobile-search',
    iconName: 'magnifying-glass',
    key: 'search.open',
    fallback: 'Open search',
    className: 'global-search-toggle',
  });
  searchToggle.setAttribute('aria-controls', 'global-search-panel');
  searchToggle.setAttribute('aria-expanded', 'false');

  searchInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !searchForm.classList.contains('is-open')) return;
    searchForm.classList.remove('is-open');
    searchToggle.setAttribute('aria-expanded', 'false');
    searchToggle.focus();
  });

  const settings = iconButton({
    t,
    action: 'navigate',
    iconName: 'gear-six',
    key: 'nav.settings',
    fallback: 'Settings',
    className: 'app-switcher app-switcher--settings',
    dataset: { view: 'sources' },
  });
  header.append(brand, nav, searchForm, searchToggle, settings);
  return {
    header,
    brand,
    nav,
    navButtons,
    searchForm,
    searchInput,
    searchToggle,
    searchClose,
    settings,
    more,
    moreSummary,
    moreMenu,
  };
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
  const liveCard = element('article', 'live-anchor');
  const liveStage = element('div', 'live-anchor__stage');
  const video = element('video', 'live-anchor__video', {
    muted: true,
    autoplay: true,
    playsInline: true,
    preload: 'metadata',
    dataset: { mediaRole: 'home-live' },
  });
  const openPlayer = element('button', 'live-anchor__open', {
    type: 'button',
    'aria-label': translate(t, 'player.open', 'Open player'),
    title: translate(t, 'player.open', 'Open player'),
    dataset: { action: 'open-player' },
  });
  openPlayer.append(icon('play'));
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
  const statusControls = element('div', 'live-anchor__status-controls');
  statusControls.append(liveBadge, mute);
  const nowBar = element('div', 'live-anchor__now');
  nowBar.append(
    textNode('span', 'status-chip', t, 'status.live', 'LIVE'),
    textNode('time', 'live-clock', t, 'time.placeholder', '--:-- CET'),
  );
  liveStage.append(video, openPlayer, statusControls, nowBar);

  const liveInfo = element('div', 'live-anchor__info');
  const channelHeading = element('div', 'live-anchor__heading');
  const channelIdentity = element('div', 'live-anchor__identity');
  const channelName = textNode('h2', 'live-anchor__name', t, 'channel.unknown', 'Unknown channel');
  const availability = textNode('span', 'live-anchor__availability', t, 'catalog.notAlwaysOn', 'Not always on');
  availability.hidden = true;
  const favorite = iconButton({
    t,
    action: 'add-favorite',
    iconName: 'heart',
    key: 'favorite.add',
    fallback: 'Add to favorites',
    className: 'live-anchor__favorite',
  });
  favorite.setAttribute('aria-pressed', 'false');
  const fullscreen = iconButton({
    t,
    action: 'open-player',
    iconName: 'corners-out',
    key: 'player.open',
    fallback: 'Open full player',
    className: 'live-anchor__fullscreen',
  });
  const random = iconButton({
    t,
    action: 'random-channel',
    iconName: 'shuffle',
    key: 'home.random',
    fallback: 'Random',
    className: 'live-anchor__random',
  });
  const channelTools = element('div', 'live-anchor__tools');
  channelTools.append(favorite, fullscreen, random);
  channelIdentity.append(channelName, availability);
  channelHeading.append(channelIdentity, channelTools);
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
  liveInfo.append(channelHeading, description, facts);

  liveCard.append(liveStage, liveInfo);

  const suggestions = element('section', 'home-suggestions');
  const suggestionsHeader = element('header', 'home-suggestions__header');
  suggestionsHeader.append(
    textNode('h2', null, t, 'home.randomChannels', 'Random channels'),
    actionButton({
      t,
      action: 'refresh-home-suggestions',
      iconName: 'shuffle',
      key: 'home.randomizeSuggestions',
      fallback: 'Randomize',
      className: 'button--ghost button--small home-suggestions__refresh',
    }),
  );
  const nearbyGrid = element('div', 'channel-grid channel-grid--nearby');
  suggestions.append(suggestionsHeader, nearbyGrid);
  directory.append(liveCard, suggestions);
  top.append(directory);

  const bottom = element('div', 'home-bottom');
  const favorites = element('section', 'favorites-shelf');
  const favoriteMore = actionButton({
    t,
    action: 'navigate',
    iconName: 'caret-right',
    key: 'common.viewAll',
    fallback: 'View all',
    className: 'button--text',
    dataset: { view: 'library', libraryFilter: 'favorites' },
  });
  const favoriteGrid = element('div', 'channel-grid channel-grid--favorites');
  favorites.append(createSectionTitle(t, 'favorites.title', 'Favorites', favoriteMore), favoriteGrid);
  bottom.append(favorites);
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
    availability,
    favorite,
    fullscreen,
    description,
    facts: factNodes,
    openPlayer,
    random,
    suggestions,
    suggestionsRefresh: suggestionsHeader.querySelector('[data-action="refresh-home-suggestions"]'),
    nearbyGrid,
    favoriteGrid,
  };
}

function createExploreView(t) {
  const view = element('section', 'page page--explore', { dataset: { page: 'explore' }, hidden: true });
  const intro = element('header', 'explore-intro');
  const copy = element('div');
  copy.append(
    textNode('h1', null, t, 'explore.title', 'Explore the signal'),
    textNode('p', null, t, 'explore.description', 'Curated live television collections built from your imported catalog.'),
  );
  const surprise = actionButton({
    t, action: 'explore-surprise', iconName: 'dice-five', key: 'explore.surprise', fallback: 'Surprise me', className: 'button--primary',
  });
  intro.append(copy, surprise);

  const hero = element('article', 'explore-hero');
  const heroStage = element('div', 'explore-hero__stage');
  const video = element('video', 'explore-hero__video', {
    muted: true, autoplay: true, playsInline: true, preload: 'metadata', dataset: { mediaRole: 'explore-live' },
  });
  const heroLive = element('span', 'explore-hero__live');
  const heroLiveText = textNode('span', null, t, 'status.liveMuted', 'LIVE · MUTED');
  heroLive.append(element('i', 'live-dot', { 'aria-hidden': 'true' }), heroLiveText);
  const mute = iconButton({
    t, action: 'toggle-explore-audio', iconName: 'speaker-slash', key: 'player.unmute', fallback: 'Unmute', className: 'explore-hero__mute media-control',
  });
  const fullscreen = iconButton({
    t, action: 'open-player', iconName: 'corners-out', key: 'player.open', fallback: 'Open full player', className: 'explore-hero__fullscreen media-control',
  });
  heroStage.append(video, heroLive, mute, fullscreen);
  const heroCopy = element('div', 'explore-hero__copy');
  const heroCollection = textNode('span', 'explore-hero__collection', t, 'explore.featuredCollection', 'Featured collection');
  const heroName = textNode('h2', null, t, 'channel.unknown', 'Unknown channel');
  const heroMeta = element('div', 'explore-hero__meta');
  const heroSchedule = element('div', 'explore-hero__schedule');
  const heroActions = element('div', 'explore-hero__actions');
  const watch = actionButton({
    t, action: 'open-player', iconName: 'play', key: 'explore.watchLive', fallback: 'Watch live', className: 'button--primary',
  });
  const random = actionButton({
    t, action: 'explore-random', iconName: 'shuffle', key: 'home.random', fallback: 'Random', className: 'button--ghost',
  });
  heroActions.append(watch, random);
  heroCopy.append(heroCollection, heroName, heroMeta, heroSchedule, heroActions);
  hero.append(heroStage, heroCopy);

  const filters = element('div', 'explore-filters', { role: 'tablist', 'aria-label': translate(t, 'explore.filterAriaLabel', 'Explore categories') });
  const filterButtons = {};
  EXPLORE_CATEGORIES.forEach((category, index) => {
    const button = actionButton({
      t, action: 'filter-explore', iconName: category.icon, key: `explore.categories.${category.id}`, fallback: category.label,
      className: index === 0 ? 'is-active' : '', dataset: { category: category.id },
    });
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
    filters.append(button);
    filterButtons[category.id] = button;
  });

  const collections = element('div', 'explore-collections');
  view.append(intro, hero, filters, collections);
  return { view, video, hero, heroCollection, heroName, heroMeta, heroSchedule, heroLiveText, mute, fullscreen, watch, random, surprise, filters, filterButtons, collections };
}

function setExploreHero(refs, channel, collection, t) {
  const value = channel && typeof channel === 'object' ? channel : {};
  const id = safeId(value.channelId || value.id || value.tvgId || value.url);
  refs.hero.dataset.channelId = id;
  refs.watch.dataset.channelId = id;
  refs.fullscreen.dataset.channelId = id;
  refs.random.dataset.currentChannelId = id;
  refs.heroCollection.textContent = safeText(collection?.title, translate(t, 'explore.featuredCollection', 'Featured collection'));
  refs.heroName.textContent = safeText(value.name, translate(t, 'channel.unknown', 'Unknown channel'));
  refs.heroMeta.replaceChildren(channelMeta(value, 'channel-meta', t));
  const schedule = channelSchedule(value);
  const now = schedule.find((programme) => Number(programme.start) <= Date.now() && Number(programme.stop) > Date.now());
  const next = schedule.find((programme) => Number(programme.start) > Date.now());
  refs.heroSchedule.replaceChildren();
  [[now, 'guide.now', 'Now'], [next, 'guide.next', 'Next']].forEach(([programme, key, fallback]) => {
    const row = element('div');
    row.append(
      textNode('span', null, t, key, fallback),
      textNode('strong', null, t, programme ? 'guide.programmeValue' : 'guide.noDataShort', programme ? '{time} · {title}' : 'Guide unavailable', {
        time: programme ? formatProgrammeTime(programme.start) : '', title: programme?.title || '',
      }),
    );
    refs.heroSchedule.append(row);
  });
  setMedia(refs.video, { ...value, muted: value.muted !== false, autoplay: value.autoplay !== false });
  const muted = refs.video.muted;
  setTranslatedText(refs.heroLiveText, t, muted ? 'status.liveMuted' : 'status.live', muted ? 'LIVE · MUTED' : 'LIVE');
  refs.mute.replaceChildren(icon(muted ? 'speaker-slash' : 'speaker-high'));
  refs.mute.setAttribute('aria-label', translate(t, muted ? 'player.unmute' : 'player.mute', muted ? 'Unmute' : 'Mute'));
  refs.mute.title = refs.mute.getAttribute('aria-label');
}

function renderExploreCollections(container, collections, t) {
  const fragment = document.createDocumentFragment();
  normaliseArray(collections).forEach((collection) => {
    const mode = collection?.mode === 'catalog' ? 'catalog' : 'overview';
    const section = element('section', `explore-collection explore-collection--${mode}`, {
      dataset: { collection: safeId(collection?.id) },
    });
    const header = element('div', 'explore-collection__header');
    const copy = element('div');
    const title = element('h2');
    title.append(icon(collection?.icon || 'broadcast'), document.createTextNode(safeText(collection?.title)));
    const description = element('p');
    description.textContent = safeText(collection?.description);
    copy.append(title, description);
    const controls = element('div', 'explore-collection__controls');
    const count = element('span', 'explore-collection__count mono');
    const channelCount = Number(collection?.totalCount ?? normaliseArray(collection?.channels).length) || 0;
    count.textContent = translate(t, channelCount === 1 ? 'explore.channelCountOne' : 'explore.channelCount', channelCount === 1 ? '{count} channel' : '{count} channels', {
      count: safeText(channelCount),
    });
    if (mode === 'overview') {
      controls.append(count, actionButton({
        t,
        action: 'randomize-explore-collection',
        iconName: 'shuffle',
        key: 'explore.randomizeCollection',
        fallback: 'Randomize',
        className: 'button--ghost explore-collection__randomize',
        dataset: { collection: safeId(collection?.id) },
      }));
    } else {
      const countryWrap = element('label', 'explore-collection__country');
      countryWrap.append(textNode('span', null, t, 'explore.countryLabel', 'Country'));
      const countrySelect = element('select', 'field', {
        'aria-label': translate(t, 'explore.countryAriaLabel', 'Filter this collection by country'),
        dataset: { action: 'filter-explore-country' },
      });
      const allCountries = element('option', null, { value: '' });
      allCountries.textContent = translate(t, 'explore.allCountries', 'All countries');
      allCountries.selected = !safeText(collection?.country);
      countrySelect.append(allCountries);
      normaliseArray(collection?.countryOptions).forEach((country) => {
        const option = element('option', null, { value: safeText(country?.code) });
        option.textContent = `${safeText(country?.label, country?.code)} · ${safeText(country?.count, 0)}`;
        option.selected = safeText(country?.code) === safeText(collection?.country);
        countrySelect.append(option);
      });
      countryWrap.append(countrySelect);

      const sortGroup = element('div', 'explore-collection__sort', {
        role: 'radiogroup',
        'aria-label': translate(t, 'explore.sortAriaLabel', 'Sort this collection'),
      });
      sortGroup.append(textNode('span', 'explore-collection__sort-label', t, 'explore.sortLabel', 'Sort by'));
      [
        ['relevance', 'explore.sort.relevance', 'Relevance'],
        ['name', 'explore.sort.name', 'Name'],
        ['quality', 'explore.sort.quality', 'Quality'],
        ['country', 'explore.sort.country', 'Country'],
      ].forEach(([value, key, fallback]) => {
        const option = element('button', 'explore-sort-option', {
          type: 'button',
          role: 'radio',
          'aria-checked': value === safeText(collection?.sort, 'relevance') ? 'true' : 'false',
          dataset: { action: 'sort-explore', sort: value },
        });
        option.append(textNode('span', null, t, key, fallback));
        sortGroup.append(option);
      });
      const separator = element('span', 'explore-collection__separator', { 'aria-hidden': 'true' });
      controls.append(countryWrap, sortGroup, separator, count);
    }
    header.append(copy, controls);
    const rail = element('div', `channel-grid explore-collection__rail explore-collection__rail--${mode}`);
    const channels = normaliseArray(collection?.channels);
    if (channels.length) renderChannelTiles(rail, channels, t, {
      schedule: true,
      action: 'tune-explore-channel',
      ariaLabelKey: 'channel.tuneExploreAriaLabel',
      ariaLabelFallback: 'Tune {name} in Explore preview',
    });
    else renderEmpty(
      rail,
      t,
      'explore.emptyCategory',
      `No ${safeText(collection?.label, 'matching')} channels yet`,
      'Import another playlist to expand this collection.',
    );
    section.append(header, rail);
    if (mode === 'catalog' && collection?.hasMore) {
      section.append(actionButton({
        t,
        action: 'load-more-explore',
        iconName: 'arrow-down',
        key: 'explore.loadMore',
        fallback: 'Load more channels',
        className: 'button--ghost explore-collection__load-more',
      }));
    }
    fragment.append(section);
  });
  container.replaceChildren(fragment);
}

function createCountriesView(t) {
  const view = element('section', 'page page--countries', { dataset: { page: 'countries' }, hidden: true });
  const layout = element('div', 'countries-layout');
  const atlas = element('article', 'countries-atlas panel');
  const atlasMap = element('div', 'countries-atlas__map');
  atlasMap.append(textNode('h1', 'panel-title', t, 'map.signalAtlas', 'Signal Atlas'));
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
  atlasMap.append(map, controls, mapMode);

  const channelPanel = element('section', 'country-channels', { hidden: true });
  const channelHeader = element('header', 'country-channels__header');
  const channelBack = actionButton({
    t,
    action: 'back-to-world-map',
    iconName: 'arrow-left',
    key: 'countries.backToWorld',
    fallback: 'Back to world map',
    className: 'button--ghost country-channels__back',
  });
  const channelIdentity = element('div', 'country-channels__identity');
  const channelFlag = element('span', 'country-channels__flag');
  const channelCopy = element('div');
  const channelEyebrow = textNode('p', 'eyebrow', t, 'countries.countryChannelsEyebrow', 'Country channels');
  const channelTitle = textNode('h1', null, t, 'countries.selectPrompt', 'Select a country');
  const channelCount = element('p', 'country-channels__count');
  channelCopy.append(channelEyebrow, channelTitle, channelCount);
  channelIdentity.append(channelFlag, channelCopy);
  channelHeader.append(channelBack, channelIdentity);

  const channelToolbar = element('div', 'country-channels__toolbar');
  const channelSearchWrap = element('label', 'field field--icon');
  channelSearchWrap.append(icon('magnifying-glass'));
  const channelSearch = element('input', null, {
    type: 'search',
    placeholder: translate(t, 'countries.searchChannelsPlaceholder', 'Search this country…'),
    'aria-label': translate(t, 'countries.searchChannelsAriaLabel', 'Search channels in this country'),
    dataset: { action: 'filter-country-channels' },
  });
  channelSearchWrap.append(channelSearch);
  const channelCategory = element('select', 'select', {
    'aria-label': translate(t, 'countries.categoryFilterAriaLabel', 'Filter country channels by category'),
    dataset: { action: 'filter-country-channel-category' },
  });
  const channelLanguage = element('select', 'select', {
    'aria-label': translate(t, 'countries.languageFilterAriaLabel', 'Filter country channels by language'),
    dataset: { action: 'filter-country-channel-language' },
  });
  channelToolbar.append(channelSearchWrap, channelCategory, channelLanguage);
  const channelGrid = element('div', 'channel-grid country-channels__grid');
  const channelLoadMore = actionButton({
    t,
    action: 'load-more-country-channels',
    iconName: 'plus',
    key: 'library.loadMore',
    fallback: 'Load more channels',
    className: 'button--ghost country-channels__load-more',
  });
  const channelLoadAll = actionButton({
    t,
    action: 'load-all-country-channels',
    iconName: 'stack-simple',
    key: 'countries.loadAllChannels',
    fallback: 'Load all channels',
    className: 'button--ghost country-channels__load-all',
  });
  const channelLoadActions = element('div', 'country-channels__load-actions');
  channelLoadActions.append(channelLoadMore, channelLoadAll);
  channelLoadMore.hidden = true;
  channelLoadAll.hidden = true;
  channelLoadActions.hidden = true;
  channelPanel.append(channelHeader, channelToolbar, channelGrid, channelLoadActions);
  atlas.append(atlasMap, channelPanel);

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
    ['updated', 'countries.lastUpdate', 'Last catalog update'],
  ].forEach(([name, key, fallback]) => {
    facts.append(textNode('dt', null, t, key, fallback));
    const value = element('dd');
    value.textContent = '—';
    facts.append(value);
    factNodes[name] = value;
  });
  const categories = element('details', 'country-detail__categories');
  const categoriesSummary = element('summary');
  const categoriesLabel = textNode('span', null, t, 'countries.categories', 'Categories');
  const categoriesCount = element('strong', 'mono');
  categoriesCount.textContent = '0';
  categoriesSummary.append(categoriesLabel, categoriesCount, icon('caret-down'));
  const categoriesList = element('div', 'country-detail__category-list');
  categories.append(categoriesSummary, categoriesList);
  detailCopy.append(detailHeading, localName, facts, categories);
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
  const guideButton = actionButton({
    t,
    action: 'load-country-guide',
    iconName: 'calendar-plus',
    key: 'countries.loadGuide',
    fallback: 'Load guide',
    className: 'button--ghost country-detail__guide-button',
  });
  const guideConsent = element('label', 'check-field country-detail__guide-consent');
  const guideConsentInput = element('input', null, {
    type: 'checkbox',
    dataset: { countryGuideConsent: 'true' },
  });
  guideConsent.append(
    guideConsentInput,
    textNode('span', null, t, 'countries.guideConsent', 'I accept checking the public GlobeTV GitHub catalog and contacting the selected third-party XMLTV providers.'),
  );
  const guideStatus = element('p', 'country-detail__guide-status');
  detailActions.append(importButton, guideConsent, guideButton, guideStatus);
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
    atlasMap,
    channelPanel,
    channelHeader,
    channelFlag,
    channelTitle,
    channelCount,
    channelSearch,
    channelCategory,
    channelLanguage,
    channelGrid,
    channelLoadActions,
    channelLoadMore,
    channelLoadAll,
    map,
    mapMode,
    mapButton,
    listButton,
    detail,
    detailBack,
    countryName,
    detailFlag,
    localName,
    facts: factNodes,
    categories,
    categoriesCount,
    categoriesList,
    shape,
    importButton,
    guideConsent,
    guideConsentInput,
    guideButton,
    guideStatus,
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
  const summary = element('dl', 'library-summary', {
    'aria-label': translate(t, 'library.summaryAriaLabel', 'Library summary'),
  });
  const statNodes = {};
  [
    ['favorites', 'favorites.title', 'Favorites'],
    ['channels', 'library.importedChannels', 'Imported channels'],
    ['sources', 'library.activeSources', 'Active sources'],
  ].forEach(([name, key, fallback]) => {
    const item = element('div', 'library-summary__item');
    const value = element('dd', 'library-summary__value mono');
    value.textContent = '0';
    item.append(value, textNode('dt', null, t, key, fallback));
    summary.append(item);
    statNodes[name] = value;
  });
  copy.append(
    textNode('p', 'eyebrow', t, 'library.eyebrow', 'Your signal collection'),
    textNode('h1', null, t, 'library.title', 'Library'),
    textNode('p', 'page-heading__description', t, 'library.description', 'Favorites and imported channels, ready whenever you tune in.'),
    summary,
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
  const recent = element('section', 'library-recent');
  recent.append(createSectionTitle(t, 'library.recent', 'Recently watched'));
  const recentGrid = element('div', 'channel-grid library-recent__grid');
  recent.append(recentGrid);
  recent.hidden = true;
  view.append(header, recent, toolbar, grid, loadMore);
  return { view, stats: statNodes, search, category, language, favorites, recent, recentGrid, grid, loadMore };
}

function createGuideView(t) {
  const view = element('section', 'page page--guide', { dataset: { page: 'guide' }, hidden: true });
  const header = element('div', 'page-heading guide-heading');
  const copy = element('div');
  copy.append(
    textNode('p', 'eyebrow', t, 'guide.eyebrow', 'Live schedules'),
    textNode('h1', null, t, 'guide.title', 'TV Guide'),
    textNode('p', 'page-heading__description', t, 'guide.description', 'Now and next across your imported channels. Times use your local timezone in 24-hour format.'),
  );
  const refresh = actionButton({
    t, action: 'refresh-guide', iconName: 'arrows-clockwise', key: 'guide.refresh', fallback: 'Refresh guide', className: 'button--ghost',
  });
  const configure = actionButton({
    t, action: 'navigate', iconName: 'gear', key: 'guide.configure', fallback: 'Guide settings', className: 'button--ghost',
    dataset: { view: 'sources' },
  });
  const actions = element('div', 'page-heading__actions');
  actions.append(configure, refresh);
  header.append(copy, actions);

  const status = element('div', 'guide-status', { 'aria-live': 'polite' });
  const filters = element('div', 'guide-filters');
  const searchWrap = element('label', 'field field--icon');
  searchWrap.append(icon('magnifying-glass'));
  const search = element('input', null, {
    type: 'search', placeholder: translate(t, 'guide.searchPlaceholder', 'Search channels or countries…'),
    'aria-label': translate(t, 'guide.searchAriaLabel', 'Search the TV Guide'), dataset: { action: 'filter-guide' },
  });
  searchWrap.append(search);
  const favorites = actionButton({ t, action: 'filter-guide-favorites', iconName: 'heart', key: 'guide.favoritesOnly', fallback: 'Favorites only', className: 'button--ghost' });
  const now = actionButton({ t, action: 'guide-now', iconName: 'crosshair', key: 'guide.jumpNow', fallback: 'Now', className: 'button--ghost' });
  filters.append(searchWrap, favorites, now);
  const grid = element('div', 'guide-grid');
  view.append(header, status, filters, grid);
  return { view, status, grid, refresh, search, favorites, now };
}

function renderGuideCards(container, channels, t) {
  const values = normaliseArray(channels);
  if (!values.length) {
    renderEmpty(container, t, 'guide.filteredEmpty', 'No covered channels found', 'Only channels matched to an installed TV Guide source appear here. Try another search or review Guide settings.');
    return;
  }
  const now = Date.now();
  const halfHour = 30 * 60 * 1000;
  const windowStart = Math.floor((now - 15 * 60 * 1000) / halfHour) * halfHour;
  const windowMs = 6 * 60 * 60 * 1000;
  const timelineWidth = 1440;
  const viewport = element('div', 'guide-timeline');
  const canvas = element('div', 'guide-timeline__canvas');
  canvas.style.setProperty('--guide-track-width', `${timelineWidth}px`);
  const axis = element('div', 'guide-timeline__axis');
  const corner = element('div', 'guide-timeline__corner');
  corner.append(textNode('span', null, t, 'guide.channels', 'Channels'));
  const ticks = element('div', 'guide-timeline__ticks');
  for (let cursor = windowStart; cursor <= windowStart + windowMs; cursor += halfHour) {
    const tick = element('time');
    tick.textContent = formatProgrammeTime(cursor);
    tick.style.left = `${((cursor - windowStart) / windowMs) * 100}%`;
    ticks.append(tick);
  }
  axis.append(corner, ticks);
  canvas.append(axis);
  values.forEach((channel) => {
    const schedule = channelSchedule(channel);
    const card = element('article', 'guide-channel', { dataset: { channelId: safeId(channel?.channelId || channel?.id) } });
    const identity = element('button', 'guide-channel__identity', {
      type: 'button', dataset: { action: 'open-channel', channelId: safeId(channel?.channelId || channel?.id) },
    });
    const logo = element('span', 'channel-logo guide-channel__logo');
    renderLogo(logo, channel, t);
    const copy = element('span');
    const name = element('strong');
    name.textContent = safeText(channel?.name, translate(t, 'channel.unknown', 'Unknown channel'));
    copy.append(name, channelMeta(channel, 'guide-channel__meta', t));
    identity.append(logo, copy, icon('play'));
    const timeline = element('div', 'guide-channel__timeline');
    const nowLine = element('span', 'guide-channel__now', { 'aria-hidden': 'true' });
    nowLine.style.left = `${Math.max(0, Math.min(100, ((now - windowStart) / windowMs) * 100))}%`;
    timeline.append(nowLine);
    if (!schedule.length) {
      const empty = element('div', 'guide-channel__empty');
      empty.append(textNode('p', null, t, 'guide.noWindowData', 'Guide matched · no programmes in this time window'));
      timeline.append(empty);
    } else {
      schedule.filter((programme) => Number(programme.stop) > windowStart && Number(programme.start) < windowStart + windowMs).forEach((programme) => {
        const isNow = Number(programme.start) <= now && Number(programme.stop) > now;
        const start = Math.max(windowStart, Number(programme.start));
        const stop = Math.min(windowStart + windowMs, Number(programme.stop));
        const item = element('button', `programme-card${isNow ? ' is-now' : ''}`, {
          type: 'button', dataset: { action: 'open-channel-guide', channelId: safeId(channel?.channelId || channel?.id) },
          'aria-expanded': 'false',
        });
        item.style.left = `${((start - windowStart) / windowMs) * 100}%`;
        item.style.width = `${Math.max(2.2, ((stop - start) / windowMs) * 100)}%`;
        const times = element('time', 'programme-card__time mono');
        times.textContent = `${formatProgrammeTime(programme.start)}–${formatProgrammeTime(programme.stop)}`;
        const title = element('strong');
        title.textContent = safeText(programme.title);
        title.title = title.textContent;
        item.setAttribute('aria-label', translate(t, 'guide.programmeDetails', '{time} · {title}. Programme details', {
          time: times.textContent,
          title: title.textContent,
        }));
        item.append(times, title);
        if (isNow) item.append(textNode('span', 'programme-card__badge', t, 'guide.nowPlaying', 'Now playing'));
        timeline.append(item);
      });
    }
    card.append(identity, timeline);
    canvas.append(card);
  });
  viewport.append(canvas);
  enableGuideTimelineDrag(viewport);
  container.replaceChildren(viewport);
}

function renderGuideSourceManager(refs, state, t) {
  const groups = normaliseArray(state.guideSourceGroups);
  const countries = normaliseArray(state.guideCatalogCountries).slice(0, 10);
  refs.catalogSearch.value = safeText(state.guideCatalogQuery);
  refs.catalogResults.replaceChildren();
  if (state.guideCatalogLoading) {
    refs.catalogResults.append(textNode('p', 'guide-catalog__message', t, 'guide.catalogLoading', 'Loading the country catalog from GitHub…'));
  } else if (state.guideCatalogError) {
    const error = element('p', 'guide-catalog__message is-error');
    error.textContent = safeText(state.guideCatalogError);
    refs.catalogResults.append(error);
  } else if (state.guideCatalogQuery && !countries.length) {
    refs.catalogResults.append(textNode('p', 'guide-catalog__message', t, 'guide.catalogEmpty', 'No guide country matches this search.'));
  } else {
    countries.forEach((country) => {
      const row = element('button', 'guide-catalog__country', {
        type: 'button', dataset: { action: 'add-guide-country', countryId: safeId(country.id) },
      });
      const copy = element('span');
      const name = element('strong');
      name.textContent = safeText(country.name);
      copy.append(name, textNode('small', null, t, 'guide.catalogCountryHint', 'Add the available XMLTV feeds'));
      row.append(icon('plus-circle'), copy, icon('caret-right'));
      refs.catalogResults.append(row);
    });
  }

  refs.installed.replaceChildren();
  if (!groups.length) {
    refs.installed.append(textNode('p', 'guide-sources-empty', t, 'guide.noInstalledSources', 'No TV Guide country installed yet. Search on the left or add a manual XMLTV URL.'));
    return;
  }
  groups.forEach((group) => {
    const matches = group.sources.reduce((sum, source) => sum + (Number(source.matchedChannels) || 0), 0);
    const card = element('article', 'guide-country-source');
    const header = element('header', 'guide-country-source__header');
    const title = element('div');
    const name = element('h3');
    name.textContent = safeText(group.name);
    const summary = element('p');
    summary.textContent = `${group.sources.length} feed${group.sources.length === 1 ? '' : 's'} · ${matches} channel matches`;
    title.append(name, summary);
    header.append(title, iconButton({
      t, action: 'remove-guide-country', iconName: 'trash', key: 'guide.removeCountry', fallback: `Remove ${group.name}`,
      className: 'guide-country-source__remove', dataset: { countryId: safeId(group.id) },
    }));
    const list = element('div', 'guide-country-source__list');
    group.sources.forEach((source) => {
      const zeroMatches = Boolean(source.fetchedAt) && (Number(source.matchedChannels) || 0) === 0;
      const stale = source.dataState === 'stale';
      const rowState = source.state === 'error' ? 'error' : stale ? 'stale' : zeroMatches ? 'unmatched' : source.state || 'idle';
      const row = element('div', 'guide-source-file', { dataset: { state: rowState } });
      const stateIcon = icon(source.state === 'error' || stale || zeroMatches ? 'warning-circle' : source.state === 'cached' ? 'cloud-slash' : 'check-circle');
      const copy = element('div');
      const file = element('strong');
      file.textContent = safeText(source.file || source.url);
      const meta = element('span');
      if (source.fetchedAt) {
        const checked = formatGuideDateTime(source.fetchedAt);
        const dataThrough = source.latestProgrammeAt
          ? ` · data through ${formatGuideDateTime(source.latestProgrammeAt)}`
          : '';
        meta.textContent = source.state === 'error'
          ? `Refresh failed · cached copy from ${checked}`
          : stale
            ? `Outdated · data ended ${formatGuideDateTime(source.latestProgrammeAt)} · downloaded ${checked}`
            : `Downloaded ${checked} · ${Number(source.matchedChannels) || 0} matches · ${Number(source.programmeCount) || 0} programmes${dataThrough}`;
      } else meta.textContent = 'Never downloaded';
      copy.append(file, meta);
      row.append(stateIcon, copy, iconButton({
        t, action: 'remove-guide-source', iconName: 'x', key: 'guide.removeSource', fallback: `Remove ${source.file || 'source'}`,
        className: 'guide-source-file__remove', dataset: { url: safeText(source.url) },
      }));
      list.append(row);
    });
    card.append(header, list);
    refs.installed.append(card);
  });
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

  const syncStatus = element('section', 'installation-sync-status', {
    role: 'status',
    'aria-live': 'polite',
    dataset: { status: 'loading' },
  });
  const syncIcon = element('div', 'installation-sync-status__icon');
  syncIcon.append(icon('arrows-clockwise'));
  const syncCopy = element('div', 'installation-sync-status__copy');
  const syncTitle = element('strong');
  const syncDetail = element('span');
  syncCopy.append(syncTitle, syncDetail);
  const syncActions = element('div', 'installation-sync-status__actions');
  const syncRetry = actionButton({
    t,
    action: 'retry-installation-sync',
    iconName: 'arrow-clockwise',
    key: 'settings.syncRetry',
    fallback: 'Retry shared storage',
    className: 'button--ghost button--small',
  });
  const syncRecover = actionButton({
    t,
    action: 'recover-installation-data',
    iconName: 'lifebuoy',
    key: 'settings.syncRecover',
    fallback: 'Recover retained data',
    className: 'button--ghost button--small',
  });
  syncActions.append(syncRetry, syncRecover);
  syncStatus.append(syncIcon, syncCopy, syncActions);

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

  const guideSettings = element('section', 'panel guide-settings');
  const guideHeader = element('div', 'guide-settings__header');
  const guideTitle = element('div');
  guideTitle.append(
    textNode('p', 'eyebrow', t, 'guide.settingsEyebrow', 'Programme data'),
    textNode('h2', null, t, 'guide.settingsTitle', 'TV Guide sources'),
    textNode('p', null, t, 'guide.settingsBody', 'Connect plain XMLTV feeds, choose a refresh cadence, and keep programme data on this device.'),
  );
  const guideStatus = element('span', 'guide-settings__status mono', { 'aria-live': 'polite' });
  guideHeader.append(guideTitle, guideStatus);

  const provider = element('article', 'guide-provider');
  const providerIcon = element('div', 'guide-provider__icon');
  providerIcon.append(icon('calendar-check'));
  const providerCopy = element('div', 'guide-provider__copy');
  providerCopy.append(
    textNode('span', 'guide-provider__badge', t, 'guide.recommended', 'Recommended free source'),
    textNode('h3', null, t, 'guide.providerTitle', 'XMLTV country guides'),
    textNode('p', null, t, 'guide.providerBody', 'The Italy preset includes eight current Open EPG feeds; other countries remain available in the provider catalog.'),
  );
  const providerActions = element('div', 'guide-provider__actions');
  providerActions.append(
    actionButton({
      t, action: 'use-guide-preset', iconName: 'plus', key: 'guide.useItalyPreset', fallback: 'Use Italy preset', className: 'button--primary button--small',
      dataset: { presetId: 'open-epg-italy' },
    }),
    actionButton({
      t, action: 'view-guide-provider', iconName: 'arrow-square-out', key: 'guide.browseCountries', fallback: 'Browse countries', className: 'button--ghost button--small',
      dataset: { url: 'https://github.com/globetvapp/epg' },
    }),
  );
  provider.append(providerIcon, providerCopy, providerActions);

  const sourceManager = element('div', 'guide-source-manager');
  const catalogPane = element('section', 'guide-catalog');
  catalogPane.append(textNode('h3', null, t, 'guide.findCountry', 'Add another country'));
  const catalogSearchWrap = element('label', 'field field--icon guide-catalog__search');
  catalogSearchWrap.append(icon('magnifying-glass'));
  const catalogSearch = element('input', null, {
    type: 'search', placeholder: translate(t, 'guide.countrySearchPlaceholder', 'Search the GitHub country catalog…'),
    'aria-label': translate(t, 'guide.countrySearchAria', 'Search TV Guide countries'), dataset: { action: 'filter-guide-catalog' },
  });
  catalogSearchWrap.append(catalogSearch);
  const catalogResults = element('div', 'guide-catalog__results');
  catalogPane.append(catalogSearchWrap, catalogResults);
  const installedPane = element('section', 'guide-installed');
  installedPane.append(textNode('h3', null, t, 'guide.installedGuides', 'Installed guides'));
  const installed = element('div', 'guide-installed__list');
  installedPane.append(installed);
  sourceManager.append(catalogPane, installedPane);

  const guideForm = element('form', 'guide-settings__form', { dataset: { action: 'save-guide-sources' } });
  const sourceLabel = element('label', 'field-stack guide-settings__sources');
  sourceLabel.append(textNode('span', null, t, 'guide.sourceLabel', 'XMLTV source URLs'));
  const guideInput = element('textarea', null, {
    name: 'guideSources', rows: 5, spellcheck: false,
    placeholder: translate(t, 'guide.sourcePlaceholder', 'https://example.org/guide.xml'),
    'aria-label': translate(t, 'guide.sourceAriaLabel', 'XMLTV guide URLs'),
  });
  sourceLabel.append(guideInput);
  const advanced = element('details', 'guide-settings__advanced');
  advanced.append(textNode('summary', null, t, 'guide.advancedSources', 'Advanced · add or edit XMLTV URLs manually'), sourceLabel);
  const cadenceLabel = element('label', 'field-stack guide-settings__cadence');
  cadenceLabel.append(textNode('span', null, t, 'guide.refreshCadence', 'Automatic refresh'));
  const cadence = element('select', 'select', { name: 'guideRefreshMinutes' });
  [
    [0, 'Manual only'],
    [30, 'Every 30 minutes'],
    [60, 'Every hour'],
    [360, 'Every 6 hours · recommended'],
    [1440, 'Daily'],
  ].forEach(([value, label]) => cadence.append(element('option', null, { value, textContent: label })));
  cadenceLabel.append(cadence);
  const consent = element('label', 'check-row guide-settings__consent');
  const checkbox = element('input', null, { type: 'checkbox', name: 'guideConsent', required: true });
  consent.append(checkbox, textNode('span', null, t, 'guide.consent', 'I understand these schedules come from third-party providers and Catodo will contact the URLs above.'));
  const formFooter = element('div', 'guide-settings__footer');
  formFooter.append(
    textNode('p', null, t, 'guide.conditionalHint', 'Refreshes use ETag and Last-Modified when the provider supports them, avoiding unchanged downloads.'),
    actionButton({
      t, action: 'save-guide-sources', iconName: 'floppy-disk', key: 'common.save', fallback: 'Save guide settings', className: 'button--primary', type: 'submit',
    }),
  );
  guideForm.append(advanced, cadenceLabel, consent, formFooter);
  guideSettings.append(guideHeader, provider, sourceManager, guideForm);

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
  const backup = element('section', 'panel backup-settings');
  const backupCopy = element('div');
  backupCopy.append(
    textNode('p', 'eyebrow', t, 'backup.eyebrow', 'Portable setup'),
    textNode('h2', null, t, 'backup.title', 'Data & backup'),
    textNode('p', null, t, 'backup.body', 'Export sources, Favorites, guide settings, preferences, and Multiview presets. Cached media and private browser data stay on this device.'),
  );
  const backupActions = element('div', 'backup-settings__actions');
  const importInput = element('input', 'sr-only', { type: 'file', accept: 'application/json,.json', dataset: { action: 'import-backup' } });
  const importLabel = element('label', 'button button--ghost');
  importLabel.append(icon('upload-simple'), textNode('span', 'button__label', t, 'backup.import', 'Restore backup'), importInput);
  backupActions.append(
    actionButton({ t, action: 'export-backup', iconName: 'download-simple', key: 'backup.export', fallback: 'Download backup', className: 'button--primary' }),
    importLabel,
  );
  backup.append(backupCopy, backupActions);
  view.append(heading, syncStatus, worldCatalog, guideSettings, backup, layout);
  return {
    view,
    list,
    proxyForm,
    proxyInput,
    guideInput,
    guideCadence: cadence,
    guideCheckbox: checkbox,
    guideStatus,
    guideCatalogSearch: catalogSearch,
    guideCatalogResults: catalogResults,
    guideInstalled: installed,
    syncStatus,
    syncIcon,
    syncTitle,
    syncDetail,
    syncRetry,
    syncRecover,
  };
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
    ['audioOutput', 'signalLab.audioOutput', 'Audio output'],
    ['audioDecoded', 'signalLab.audioDecoded', 'Audio decoded'],
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
    actionButton({ t, action: 'toggle-favorite', iconName: 'heart', key: 'favorite.add', fallback: 'Favorite', className: 'button--ghost player-toolbar__favorite' }),
    actionButton({ t, action: 'add-to-multiview', iconName: 'grid-four', key: 'multiview.add', fallback: 'Add to Multiview', className: 'button--ghost' }),
  );
  const right = element('div', 'player-toolbar__group');
  right.append(
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
  const status = element('div', 'player-status', { hidden: true });
  const statusCard = element('div', 'player-status__card');
  const statusHeader = element('div', 'player-status__header');
  const statusIcon = icon('spinner-gap', 'is-spinning');
  const statusKicker = textNode('span', null, t, 'player.connectionStatus', 'Connection status');
  statusHeader.append(statusIcon, statusKicker);
  const statusText = textNode('h2', 'player-status__title', t, 'player.loading', 'Contacting stream');
  const statusDetail = textNode('p', 'player-status__detail', t, 'player.connectionStart', 'Selecting a browser-compatible route to the provider.');
  const statusCopy = element('div', 'player-status__copy', { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
  statusCopy.append(statusText, statusDetail);
  const statusProgress = element('div', 'player-status__progress', { 'aria-hidden': 'true' });
  const statusSteps = Array.from({ length: 4 }, () => element('span'));
  statusProgress.append(...statusSteps);
  const statusMeta = element('div', 'player-status__meta mono');
  const statusRoute = element('span');
  statusRoute.textContent = 'DIRECT · ENDPOINT 1/1';
  const statusElapsed = element('span');
  statusElapsed.textContent = '0.0 S';
  statusMeta.append(statusRoute, statusElapsed);
  const statusAdvice = textNode('p', 'player-status__advice', t, 'player.connectionNormal', 'This is within the normal startup window.');
  const statusActions = element('div', 'player-status__actions');
  const statusCancel = actionButton({
    t, action: 'close-player', iconName: 'x', key: 'common.cancel', fallback: 'Cancel', className: 'button--ghost',
  });
  const statusAlternate = actionButton({
    t, action: 'random-player-channel', iconName: 'shuffle', key: 'player.tryAnother', fallback: 'Try another', className: 'button--primary',
  });
  statusAlternate.hidden = true;
  statusActions.append(statusCancel, statusAlternate);
  statusCard.append(statusHeader, statusCopy, statusProgress, statusMeta, statusAdvice, statusActions);
  status.append(statusCard);
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
  const volume = element('div', 'volume-control', {
    role: 'group',
    'aria-label': translate(t, 'player.audioControls', 'Audio controls'),
  });
  const volumeMute = iconButton({
    t,
    action: 'set-player-muted',
    iconName: 'speaker-high',
    key: 'player.mute',
    fallback: 'Mute',
    className: 'volume-control__mute',
    dataset: { muted: 'true' },
  });
  const volumeValue = textNode('span', null, t, 'player.volumeValue', '{value}', { value: 100 });
  const range = element('input', null, {
    type: 'range',
    min: '0',
    max: '100',
    value: '100',
    'aria-label': translate(t, 'player.volume', 'Volume'),
    dataset: { action: 'set-volume' },
  });
  const audioStatus = element('span', 'volume-control__status mono', {
    role: 'status',
    'aria-live': 'polite',
  });
  audioStatus.textContent = translate(t, 'player.audioChecking', 'Audio checking');
  volume.append(volumeMute, volumeValue, range, audioStatus);
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
    statusCard,
    statusIcon,
    statusText,
    statusDetail,
    statusSteps,
    statusRoute,
    statusElapsed,
    statusAdvice,
    statusAlternate,
    signalLab,
    number,
    name,
    meta,
    favoriteButton: toolbar.querySelector('[data-action="toggle-favorite"]'),
    addToMultiviewButton: toolbar.querySelector('[data-action="add-to-multiview"]'),
    labButton,
    playPause,
    volume: range,
    volumeMute,
    volumeValue,
    audioStatus,
    transport,
    programmeStrip,
    programmeList,
    localTime: localTime.querySelector('strong'),
  };
}

function createProgrammeOverlay(t) {
  const backdrop = element('div', 'programme-overlay-backdrop', { hidden: true });
  const panel = element('aside', 'programme-overlay', {
    role: 'dialog', 'aria-modal': 'true', 'aria-label': translate(t, 'guide.channelSchedule', 'Channel schedule'),
  });
  const header = element('header', 'programme-overlay__header');
  const identity = element('div', 'programme-overlay__identity');
  const logo = element('span', 'channel-logo programme-overlay__logo');
  const copy = element('div');
  const name = element('h2');
  const meta = element('p');
  copy.append(name, meta);
  identity.append(logo, copy);
  const close = iconButton({ t, action: 'close-channel-guide', iconName: 'x', key: 'common.close', fallback: 'Close programme guide' });
  header.append(identity, close);
  const now = element('section', 'programme-overlay__now');
  const list = element('div', 'programme-overlay__list');
  const watch = actionButton({ t, action: 'open-channel', iconName: 'play', key: 'channel.watch', fallback: 'Watch channel', className: 'button--primary programme-overlay__watch' });
  panel.append(header, now, list, watch);
  backdrop.append(panel);
  return { backdrop, panel, logo, name, meta, now, list, watch, close };
}

function setProgrammeOverlay(refs, channel, t) {
  const id = safeId(channel?.channelId || channel?.id);
  refs.panel.dataset.channelId = id;
  refs.watch.dataset.channelId = id;
  renderLogo(refs.logo, channel, t);
  refs.name.textContent = safeText(channel?.name, translate(t, 'channel.unknown', 'Unknown channel'));
  refs.meta.textContent = [channel?.country, channel?.quality].map((value) => safeText(value)).filter(Boolean).join(' · ');
  const schedule = channelSchedule(channel);
  const currentTime = Date.now();
  const current = schedule.find((programme) => Number(programme.start) <= currentTime && Number(programme.stop) > currentTime);
  refs.now.replaceChildren();
  if (current) {
    const eyebrow = textNode('p', 'eyebrow', t, 'guide.onNow', 'On now');
    const title = element('h3');
    title.textContent = safeText(current.title);
    const range = element('p', 'mono');
    range.textContent = `${formatProgrammeTime(current.start)}–${formatProgrammeTime(current.stop)}`;
    const progress = element('div', 'programme-overlay__progress');
    const bar = element('span');
    bar.style.width = `${Math.max(0, Math.min(100, ((currentTime - current.start) / (current.stop - current.start)) * 100))}%`;
    progress.append(bar);
    refs.now.append(eyebrow, title, range, progress);
    if (current.description) {
      const description = element('p');
      description.textContent = current.description;
      refs.now.append(description);
    }
  } else refs.now.append(textNode('p', null, t, 'guide.noWindowData', 'Guide matched · no programmes in this time window'));
  refs.list.replaceChildren();
  schedule.filter((programme) => Number(programme.stop) > currentTime).slice(0, 8).forEach((programme) => {
    const row = element('article', 'programme-overlay__item');
    const time = element('time', 'mono');
    time.textContent = formatProgrammeTime(programme.start);
    const title = element('strong');
    title.textContent = safeText(programme.title);
    const detail = element('span');
    detail.textContent = safeText(programme.category || programme.subtitle);
    row.append(time, title, detail);
    refs.list.append(row);
  });
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
  const presets = element('select', 'select multiview-presets', {
    'aria-label': translate(t, 'multiview.presets', 'Multiview presets'), dataset: { action: 'load-multiview-preset' },
  });
  presets.append(element('option', null, { value: '', textContent: translate(t, 'multiview.presets', 'Presets') }));
  const renamePreset = iconButton({
    t,
    action: 'rename-multiview-preset',
    iconName: 'pencil-simple',
    key: 'multiview.renamePreset',
    fallback: 'Rename preset',
    className: 'multiview-preset-action',
  });
  const deletePreset = iconButton({
    t,
    action: 'delete-multiview-preset',
    iconName: 'trash',
    key: 'multiview.deletePreset',
    fallback: 'Delete preset',
    className: 'multiview-preset-action multiview-preset-action--delete',
  });
  renamePreset.hidden = true;
  deletePreset.hidden = true;
  toolbarActions.append(
    presets,
    renamePreset,
    deletePreset,
    actionButton({ t, action: 'save-multiview-preset', iconName: 'floppy-disk', key: 'multiview.savePreset', fallback: 'Save preset', className: 'button--ghost' }),
    actionButton({ t, action: 'add-multiview-channel', iconName: 'plus', key: 'multiview.addChannel', fallback: 'Add channel', className: 'button--ghost' }),
    actionButton({ t, action: 'toggle-fullscreen', iconName: 'corners-out', key: 'player.fullscreen', fallback: 'Full screen', className: 'button--ghost' }),
    actionButton({ t, action: 'close-multiview', iconName: 'sign-out', key: 'common.exit', fallback: 'Exit', className: 'button--ghost' }),
  );
  toolbar.append(titleGroup, layout, toolbarActions);

  const grid = element('div', 'multiview-grid', { dataset: { count: '4' } });
  grid.dataset.action = 'toggle-multiview-chrome';
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
        action: 'expand-multiview-slot',
        iconName: 'corners-out',
        key: 'multiview.expandFeed',
        fallback: 'Open feed full screen',
        className: 'button--media multiview-slot__expand',
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
  return { overlay, toolbar, layout, grid, slots, presets, renamePreset, deletePreset, status: statusNodes };
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
    copy.append(name, channelMeta(channel, 'channel-picker__meta', t));
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
  const status = element('div', 'signal-bar__status');
  const statusLabel = textNode('span', 'signal-bar__telemetry-label', t, 'footer.buffer', 'Buffer');
  const statusText = element('strong', 'mono');
  statusText.textContent = '—';
  const network = element('span', 'signal-bar__network');
  const downLabel = textNode('span', 'signal-bar__telemetry-label', t, 'footer.download', 'Down');
  const downValue = element('strong', 'mono');
  downValue.textContent = '0.00 Mbps';
  const receivedLabel = textNode('span', 'signal-bar__telemetry-label', t, 'footer.received', 'Received');
  const receivedValue = element('strong', 'mono');
  receivedValue.textContent = '0 B';
  network.append(downLabel, downValue, receivedLabel, receivedValue);
  const statusMeta = element('span', 'signal-bar__status-meta mono');
  statusMeta.textContent = 'Waiting';
  status.append(icon('waveform'), statusLabel, statusText, statusMeta, network);
  bar.append(region, clock, bars, status);
  return { bar, clock, status, statusText, statusMeta, network, downValue, receivedValue };
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
    if (source?.healthLabel) {
      const health = element('span', source?.error ? 'is-error' : 'is-ok');
      health.textContent = safeText(source.healthLabel);
      meta.append(health);
    }
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
  const identity = featuredChannelIdentity(
    value,
    channelQuality(value),
    translate(t, 'channel.unknown', 'Unknown channel'),
  );
  refs.channelName.textContent = identity.displayName;
  refs.channelName.title = identity.displayName === identity.rawName ? '' : identity.rawName;
  refs.availability.hidden = !identity.notAlwaysOn;
  const isFavorite = Boolean(value.favorite || value.isFavorite);
  refs.favorite.dataset.channelId = id;
  refs.favorite.dataset.action = isFavorite ? 'remove-favorite' : 'add-favorite';
  refs.favorite.classList.toggle('is-active', isFavorite);
  refs.favorite.setAttribute('aria-pressed', isFavorite ? 'true' : 'false');
  refs.favorite.setAttribute('aria-label', translate(t, isFavorite ? 'favorite.remove' : 'favorite.add', isFavorite ? 'Remove from favorites' : 'Add to favorites'));
  refs.favorite.title = refs.favorite.getAttribute('aria-label');
  refs.favorite.replaceChildren(icon('heart'));
  setFavoriteGlyph(refs.favorite, isFavorite);
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

function setCountryDetail(refs, country, t, guideState = {}) {
  const value = country && typeof country === 'object' ? country : {};
  const iso2 = safeIso2(value.iso2 || value.code);
  const previousIso2 = refs.detail.dataset.iso2;
  refs.detail.dataset.iso2 = iso2;
  refs.detailBack.hidden = !iso2;
  refs.importButton.dataset.iso2 = iso2;
  refs.countryName.textContent = safeText(value.name, translate(t, 'countries.selectPrompt', 'Select a country'));
  refs.detailFlag.replaceChildren(countryFlag(iso2, value.name, 'country-detail__flag-image'));
  refs.detailFlag.hidden = !iso2;
  refs.localName.textContent = safeText(value.localName || value.nativeName);
  refs.localName.hidden = !refs.localName.textContent;
  refs.facts.language.textContent = safeText(value.language || value.languageName, '—');
  refs.facts.region.textContent = safeText(value.region, '—');
  refs.facts.channels.textContent = safeText(value.channelCount ?? value.channels, '—');
  refs.facts.updated.textContent = safeText(value.updatedAt || value.lastUpdated, '—');
  const categoryValues = [...new Map(normaliseArray(value.categories)
    .flatMap((category) => safeText(category).split(/[;,]/))
    .map((category) => category.trim())
    .filter(Boolean)
    .map((category) => [category.toLocaleLowerCase('en-US'), category])).values()]
    .sort((a, b) => a.localeCompare(b));
  refs.categoriesCount.textContent = safeText(categoryValues.length);
  refs.categoriesList.replaceChildren(...categoryValues.map((category) => {
    const chip = element('span');
    chip.textContent = category;
    return chip;
  }));
  refs.categories.hidden = !categoryValues.length;
  if (previousIso2 !== iso2) refs.categories.open = false;
  refs.importButton.hidden = !iso2 || Boolean(value.imported);
  const sourceCount = Math.max(0, Number(guideState.sourceCount) || 0);
  const configuredCount = Math.max(0, Number(guideState.configuredCount) || 0);
  const control = countryGuideControlState({
    sourceCount,
    configuredCount,
    loading: guideState.loading,
    checking: guideState.checking,
    error: guideState.error,
    unavailable: guideState.unavailable,
  });
  const labels = {
    loading: ['countries.loadingGuide', 'Loading guide…'],
    checking: ['countries.checkingGuide', 'Checking guide…'],
    connected: ['countries.guideLoaded', 'Guide loaded'],
    available: ['countries.loadGuide', 'Load guide'],
    error: ['countries.guideRetry', 'Retry guide check'],
    unavailable: ['countries.guideCheckAgain', 'Check again'],
    idle: ['countries.findGuide', 'Find & load guide'],
  };
  const [guideLabelKey, guideLabelFallback] = labels[control.status];
  const guideLabel = translate(t, guideLabelKey, guideLabelFallback);
  if (previousIso2 !== iso2) refs.guideConsentInput.checked = false;
  refs.guideConsent.hidden = !iso2 || control.connected;
  refs.guideConsentInput.disabled = control.disabled;
  refs.guideButton.hidden = !iso2;
  refs.guideButton.disabled = control.disabled;
  refs.guideButton.dataset.iso2 = iso2;
  refs.guideButton.classList.toggle('is-active', control.connected);
  refs.guideButton.setAttribute('aria-label', guideLabel);
  refs.guideButton.querySelector('.button__label').textContent = guideLabel;
  refs.guideStatus.hidden = !iso2;
  refs.guideStatus.textContent = control.status === 'checking'
    ? translate(t, 'countries.guideCheckingHint', 'Checking the GlobeTV country catalog…')
    : control.status === 'error'
      ? translate(t, 'countries.guideLookupFailedHint', 'The GlobeTV catalog could not be checked. Retry when the connection is available.')
      : control.status === 'unavailable'
        ? translate(t, 'countries.guideUnavailableHint', 'No XMLTV feed was found in the current GlobeTV catalog. You can check again later.')
        : control.status === 'idle'
          ? translate(t, 'countries.guideConsentHint', 'Accept the third-party notice, then CATODO will search GlobeTV and connect any country feeds it finds.')
          : control.connected
          ? translate(t, 'countries.guideLoadedHint', '{count} guide sources saved in Settings.', { count: sourceCount })
          : translate(t, 'countries.guideAvailableHint', '{count} known XMLTV sources available. Loading saves them in Settings and contacts those third-party providers.', { count: sourceCount });
  renderCountryShape(refs.shape, iso2, { t });
}

function setCountryChannels(refs, state, selected, selectedIso2, t) {
  const channels = normaliseArray(state.countryChannels);
  const total = Math.max(0, Number(state.countryChannelTotal) || 0);
  const filteredTotal = Math.max(0, Number(state.countryChannelFilteredTotal) || 0);
  const countryName = safeText(selected?.name, selectedIso2);
  refs.atlasMap.hidden = Boolean(selectedIso2);
  refs.channelPanel.hidden = !selectedIso2;
  refs.channelPanel.dataset.iso2 = selectedIso2;
  if (!selectedIso2) return;

  refs.channelFlag.replaceChildren(countryFlag(selectedIso2, countryName, 'country-channels__flag-image'));
  refs.channelTitle.textContent = countryName;
  refs.channelCount.textContent = translate(t, 'countries.channelAvailability', '{shown} shown · {total} available now', {
    shown: channels.length,
    total,
  });
  refs.channelSearch.value = safeText(state.countryChannelQuery);
  setLibrarySelectOptions(
    refs.channelCategory,
    state.countryChannelCategories,
    translate(t, 'library.allCategories', 'All categories'),
    state.countryChannelCategory,
  );
  setLibrarySelectOptions(
    refs.channelLanguage,
    state.countryChannelLanguages,
    translate(t, 'library.allLanguages', 'All languages'),
    state.countryChannelLanguage,
  );

  if (channels.length) renderChannelTiles(refs.channelGrid, channels, t, { schedule: true });
  else if (!total) {
    const importButton = actionButton({
      t,
      action: 'open-import-dialog',
      iconName: 'download-simple',
      key: 'countries.addChannels',
      fallback: 'Add country channels',
      className: 'button--primary',
      dataset: { iso2: selectedIso2 },
    });
    renderEmpty(
      refs.channelGrid,
      t,
      'countries.channelsNotImported',
      `Add ${countryName} channels`,
      'This country is in the public directory, but its playlist is not in your local catalog yet.',
      importButton,
    );
  } else {
    renderEmpty(
      refs.channelGrid,
      t,
      'countries.noChannelMatches',
      'No channels match these filters',
      'Try a different search, category, or language.',
    );
  }
  const remaining = Math.max(0, filteredTotal - channels.length);
  refs.channelLoadActions.hidden = remaining === 0;
  refs.channelLoadMore.hidden = remaining === 0;
  refs.channelLoadAll.hidden = remaining === 0;
  setTranslatedText(refs.channelLoadMore.querySelector('.button__label'), t, 'library.loadMoreCount', 'Load more channels · {count} remaining', { count: remaining });
  setTranslatedText(refs.channelLoadAll.querySelector('.button__label'), t, 'countries.loadAllChannelsCount', 'Load all channels · {count} remaining', { count: remaining });
}

function updateChannelMeta(container, channel, options = {}) {
  container.replaceChildren();
  appendChannelMeta(container, channel, options.t);
  if (!options.localClock) return;
  const local = channelLocalTime(channel, options.now, { locale: options.locale });
  if (!local) return;
  if (container.children.length) container.append(metadataDivider());
  const clock = element('span', 'player-identity__local-clock mono', {
    title: local.timeZone,
    'aria-label': translate(
      options.t,
      'player.localTimeIn',
      'Local time in {place}: {time}',
      { place: local.place, time: local.time },
    ),
  });
  const place = element('span');
  place.textContent = local.place;
  const time = element('strong');
  time.textContent = local.time;
  clock.append(icon('clock'), place, time);
  container.append(clock);
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
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(source.tagName)) return;
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
    if (source.tagName === 'SELECT') return;
    if (source.tagName === 'INPUT' && ['checkbox', 'radio'].includes(source.type)) return;
    dispatch(source.dataset.action, event, source);
  };
  const change = (event) => {
    const source = event.target.closest?.('select[data-action], input[type="checkbox"][data-action], input[type="radio"][data-action]');
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
  root.addEventListener('change', change);
  root.addEventListener('keydown', keydown);
  return { dispatch, destroy: () => {
    root.removeEventListener('click', click);
    root.removeEventListener('submit', submit);
    root.removeEventListener('input', input);
    root.removeEventListener('change', change);
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
  const explore = createExploreView(t);
  const countries = createCountriesView(t);
  const guide = createGuideView(t);
  const library = createLibraryView(t);
  const sources = createSourcesView(t);
  const player = createPlayer(t);
  const programmeOverlay = createProgrammeOverlay(t);
  const multiview = createMultiview(t);
  const multiviewSignalLab = createMultiviewSignalLab(t);
  const channelPicker = createChannelPicker(t);
  const importDialog = createImportDialog(t);
  const signalBar = createSignalBar(t);

  const shell = element('div', 'catodo-shell');
  const main = element('main', 'app-content');
  main.append(home.view, explore.view, countries.view, guide.view, library.view, sources.view);
  shell.append(header.header, main, signalBar.bar);
  root.classList.add('catodo-app');
  root.replaceChildren(shell, player.overlay, multiview.overlay, programmeOverlay.backdrop, multiviewSignalLab.backdrop, channelPicker.backdrop, importDialog.backdrop);

  const toastRegion = element('div', 'toast-region', {
    'aria-live': 'polite',
    'aria-atomic': 'true',
  });
  root.append(toastRegion);
  const dispatcher = makeActionDispatcher(root, options.onAction);
  const views = {
    home: home.view,
    explore: explore.view,
    countries: countries.view,
    guide: guide.view,
    library: library.view,
    sources: sources.view,
  };
  let toastTimer = 0;
  let guideProgrammeTimer = 0;
  let activeShellView = 'home';
  let exploreLoadScheduled = false;
  const loadMoreExploreNearEnd = () => {
    if (exploreLoadScheduled) return;
    const button = explore.collections.querySelector('[data-action="load-more-explore"]');
    if (!button || button.disabled) return;
    const remaining = explore.view.scrollHeight - explore.view.scrollTop - explore.view.clientHeight;
    if (remaining > 520) return;
    exploreLoadScheduled = true;
    scheduleFrame(() => {
      button.click();
      exploreLoadScheduled = false;
    });
  };
  explore.view.addEventListener('scroll', loadMoreExploreNearEnd, { passive: true });

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
      const active = isPrimaryNavActive(key, viewName);
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
      moreMenu: header.moreMenu,
      moreSummary: header.moreSummary,
      searchForm: header.searchForm,
      searchInput: header.searchInput,
      searchToggle: header.searchToggle,
      searchClose: header.searchClose,
      main,
      views,
      home: home.view,
      homeLiveCard: home.liveCard,
      homeLiveStage: home.liveStage,
      homeVideo: home.video,
      exploreVideo: explore.video,
      homeChannelGrid: home.nearbyGrid,
      favoriteGrid: home.favoriteGrid,
      countries: countries.view,
      countryMap: countries.map,
      countryShape: countries.shape,
      countryTableBody: countries.tableBody,
      guide: guide.view,
      guideInput: sources.guideInput,
      guideCadence: sources.guideCadence,
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
      programmeOverlay: programmeOverlay.backdrop,
      signalLab: player.signalLab.panel,
      signalChart: player.signalLab.canvas,
      multiview: multiview.overlay,
      multiviewGrid: multiview.grid,
      multiviewSlots: multiview.slots,
      multiviewVideos: multiview.slots.map((slot) => slot.video),
      multiviewPresets: multiview.presets,
      multiviewPresetRename: multiview.renamePreset,
      multiviewPresetDelete: multiview.deletePreset,
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
        signalBar.receivedValue.textContent = safeText(state.telemetry.received, '0 B');
        signalBar.statusText.textContent = safeText(state.telemetry.buffer, '—');
        signalBar.statusMeta.textContent = safeText(state.telemetry.detail, 'Waiting');
        signalBar.status.classList.toggle('is-error', Boolean(state.telemetry.issue));
      }
      if (state.signalOk !== undefined) {
        signalBar.status.classList.toggle('is-error', !state.signalOk);
      }
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
      const placeholder = state.restoring
        ? {
            name: translate(t, 'home.restoringTitle', 'Restoring shared channels'),
            description: translate(t, 'home.restoringBody', 'Saved playlists are being downloaded for this browser.'),
            autoplay: false,
            muted: true,
            clearSource: true,
          }
        : state.syncError || state.restoreError
          ? {
              name: translate(
                t,
                state.restoreError ? 'home.restoreErrorTitle' : 'home.syncErrorTitle',
                state.restoreError ? 'Saved playlists unavailable' : 'Shared library unavailable',
              ),
              description: translate(
                t,
                state.restoreError ? 'home.restoreErrorBody' : 'home.syncErrorBody',
                state.restoreError
                  ? 'The shared list is safe, but its third-party playlists could not be downloaded on this browser.'
                  : 'Open Settings to retry shared storage. Queued browser changes remain safe.',
              ),
              autoplay: false,
              muted: true,
              clearSource: true,
            }
          : {};
      const featured = state.featured || state.currentChannel || channels[0] || placeholder;
      setFeatured(home, featured, t);
      const playable = Boolean(safeId(featured.channelId || featured.id || featured.tvgId || featured.url));
      home.openPlayer.disabled = !playable;
      home.random.disabled = !playable;
      home.favorite.disabled = !playable;
      home.fullscreen.disabled = !playable;
      home.mute.disabled = !playable;
      home.liveCard.classList.toggle('is-restoring', Boolean(state.restoring || state.syncError || state.restoreError));
      if (state.restoring || state.syncError || state.restoreError) {
        home.liveBadgeText.textContent = translate(
          t,
          state.restoring ? 'status.restoring' : 'status.unavailable',
          state.restoring ? 'RESTORING' : 'UNAVAILABLE',
        );
      }
      setTranslatedText(home.liveCount, t, 'home.liveCount', '{count} LIVE', {
        count: safeText(state.liveCount ?? state.totalLive ?? channels.length),
      });
      setTranslatedText(home.countryCount, t, 'home.countryCount', '{count} COUNTRIES', {
        count: safeText(state.countryCount ?? state.totalCountries ?? 0),
      });
      const featuredId = safeId(featured.channelId || featured.id || featured.tvgId || featured.url);
      const suggestions = channels.filter((channel) => safeId(channel?.channelId || channel?.id || channel?.tvgId || channel?.url) !== featuredId).slice(0, 9);
      home.suggestionsRefresh.disabled = !suggestions.length;
      renderChannelTiles(home.nearbyGrid, suggestions.map((channel) => ({ ...channel, active: false })), t, {
        schedule: true,
        action: 'tune-home-channel',
        ariaLabelKey: 'channel.tuneDashboardAriaLabel',
        ariaLabelFallback: 'Tune {name} in dashboard',
      });
      if (favorites.length) {
        renderChannelTiles(
          home.favoriteGrid,
          favorites.map((channel) => ({
            ...channel,
            active: safeId(channel?.channelId || channel?.id || channel?.tvgId || channel?.url) === featuredId,
          })),
          t,
          {
            action: 'tune-home-channel',
            ariaLabelKey: 'channel.tuneDashboardAriaLabel',
            ariaLabelFallback: 'Tune {name} in dashboard',
          },
        );
      }
      else renderEmpty(
        home.favoriteGrid,
        t,
        'favorites.empty',
        'No favorites yet',
        'Save channels here for one-tap tuning.',
      );
      if (state.time !== undefined) api.updateHeader({ time: state.time });
      return api;
    },

    renderExplore(state = {}) {
      if (shouldActivateShellView(root.dataset.mode, state.activate)) activateShellView('explore');
      const collections = normaliseArray(state.collections);
      const featuredCollection = state.featuredCollection || collections.find((collection) => normaliseArray(collection.channels).some((channel) =>
        safeId(channel?.channelId || channel?.id) === safeId(state.featured?.channelId || state.featured?.id))) || collections[0];
      const placeholder = state.restoring
        ? { name: translate(t, 'home.restoringTitle', 'Restoring shared channels'), autoplay: false, clearSource: true }
        : state.syncError || state.restoreError
          ? {
              name: translate(
                t,
                state.restoreError ? 'home.restoreErrorTitle' : 'home.syncErrorTitle',
                state.restoreError ? 'Saved playlists unavailable' : 'Shared library unavailable',
              ),
              autoplay: false,
              clearSource: true,
            }
          : {};
      const featured = state.featured || featuredCollection?.channels?.[0] || placeholder;
      setExploreHero(explore, featured, featuredCollection, t);
      const playable = Boolean(safeId(featured.channelId || featured.id || featured.tvgId || featured.url));
      explore.watch.disabled = !playable;
      explore.fullscreen.disabled = !playable;
      explore.mute.disabled = !playable;
      explore.random.disabled = !playable;
      explore.surprise.disabled = !playable;
      explore.hero.classList.toggle('is-restoring', Boolean(state.restoring || state.syncError || state.restoreError));
      renderExploreCollections(explore.collections, collections, t);
      Object.entries(explore.filterButtons).forEach(([category, button]) => {
        const active = category === safeText(state.category, 'all');
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      return api;
    },

    renderGuide(state = {}) {
      if (shouldActivateShellView(root.dataset.mode, state.activate)) activateShellView('guide');
      const channels = normaliseArray(state.channels);
      guide.refresh.disabled = Boolean(state.loading) || !state.configured;
      guide.search.value = safeText(state.query);
      guide.favorites.classList.toggle('is-active', Boolean(state.favoritesOnly));
      guide.favorites.setAttribute('aria-pressed', state.favoritesOnly ? 'true' : 'false');
      if (state.loading) setTranslatedText(guide.status, t, 'guide.loading', 'Loading live schedules…');
      else if (state.error) guide.status.textContent = safeText(state.error);
      else if (state.configured && Number(state.staleSourceCount) > 0 && Number(state.covered) === 0) {
        guide.status.textContent = translate(t, 'guide.stale', 'Installed guide data is out of date — latest programme ended {date}. Refreshing will replace known legacy Italian feeds.', { date: formatGuideDateTime(state.latestProgrammeAt) });
      } else if (state.configured && Number(state.matched) > 0 && Number(state.covered) === 0) {
        guide.status.textContent = translate(t, 'guide.matchedNoCurrent', '{matched} channels matched — no current programmes were found in this time window', { matched: state.matched });
      } else if (state.configured && Number(state.covered) === 0) {
        setTranslatedText(guide.status, t, 'guide.empty', 'Sources downloaded, but no channels matched. Review source diagnostics in Settings.');
      } else if (state.configured) {
        guide.status.textContent = translate(t, 'guide.coverage', 'Guide coverage: {covered}/{total} channels — times shown in your timezone (24h)', { covered: state.covered ?? 0, total: state.total ?? channels.length });
      } else setTranslatedText(guide.status, t, 'guide.unconfigured', 'Connect an XMLTV source in Settings to add live programme data.');
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
      setCountryDetail(countries, selected, t, {
        sourceCount: state.countryGuideSourceCount,
        configuredCount: state.countryGuideConfiguredCount,
        loading: state.countryGuideLoading,
        checking: state.countryGuideChecking,
        error: state.countryGuideLookupError,
        unavailable: state.countryGuideUnavailable,
      });
      setCountryChannels(countries, state, selected, selectedIso2, t);
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
      if (state.query !== undefined) library.search.value = safeText(state.query);
      const favoritesOnly = Boolean(state.favoritesOnly);
      library.favorites.classList.toggle('is-active', favoritesOnly);
      library.favorites.setAttribute('aria-pressed', favoritesOnly ? 'true' : 'false');
      const recent = normaliseArray(state.recent);
      library.recent.hidden = !recent.length;
      if (recent.length) renderChannelTiles(library.recentGrid, recent.slice(0, 20), t);
      if (channels.length) renderChannelTiles(library.grid, channels, t);
      else if (state.restoring) renderEmpty(
        library.grid,
        t,
        'library.restoring',
        'Restoring your shared library',
        'CATODO is downloading the saved playlists for this browser. Your Favorites will appear as their channels become available.',
      );
      else if (state.syncError) renderEmpty(
        library.grid,
        t,
        'library.syncError',
        'Your shared library could not be restored',
        'Local data is safe. Open Settings to check the shared-storage status and retry after the connection recovers.',
      );
      else if (state.restoreError) renderEmpty(
        library.grid,
        t,
        'library.restoreError',
        'Saved playlists could not be downloaded',
        'Shared storage is connected, but one or more third-party playlists failed on this browser. Open Settings to refresh those sources.',
      );
      else {
        const isFiltered = Boolean(safeText(state.query).trim() || safeText(state.category).trim() || safeText(state.language).trim() || favoritesOnly);
        renderEmpty(
          library.grid,
          t,
          isFiltered ? 'library.noMatches' : 'library.empty',
          isFiltered ? 'No channels match' : 'Your library is waiting',
          isFiltered
            ? 'Try a different search or clear one of the active filters.'
            : 'Add a playlist or favorite a live channel to keep it close.',
          isFiltered ? null : actionButton({
            t,
            action: 'open-import-dialog',
            iconName: 'plus',
            key: 'library.addPlaylist',
            fallback: 'Add playlist',
            className: 'button--primary',
          }),
        );
      }
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
      renderGuideSourceManager({
        catalogSearch: sources.guideCatalogSearch,
        catalogResults: sources.guideCatalogResults,
        installed: sources.guideInstalled,
      }, state, t);
      const sync = state.installationSync || {};
      const hydrating = Math.max(0, Number(sync.hydrating) || 0);
      const hydrationFailed = Math.max(0, Number(sync.hydrationFailed) || 0);
      const baseStatus = safeText(sync.status, 'loading');
      const status = baseStatus === 'error'
        ? 'error'
        : hydrating > 0
          ? 'hydrating'
          : hydrationFailed > 0
            ? 'restore-error'
            : baseStatus;
      const syncContent = {
        synced: ['cloud-check', 'settings.syncReady', 'Shared library connected', 'settings.syncReadyDetail', 'Sources, Favorites and guide settings follow this installation.'],
        pending: ['cloud-arrow-up', 'settings.syncPending', 'Changes waiting to sync', 'settings.syncPendingDetail', '{count} change(s) are safely queued in this browser.'],
        hydrating: ['cloud-arrow-down', 'settings.syncHydrating', 'Restoring shared channels', 'settings.syncHydratingDetail', '{count} playlist(s) are being downloaded on this browser.'],
        'restore-error': ['warning-circle', 'settings.restoreError', 'Some playlists could not be restored', 'settings.restoreErrorDetail', '{count} saved playlist(s) could not be downloaded on this browser. Shared storage is still connected.'],
        error: ['warning-circle', 'settings.syncError', 'Shared storage unavailable', 'settings.syncErrorDetail', 'Queued changes are safe in this browser. Use Retry shared storage when the connection recovers.'],
        'local-only': ['hard-drives', 'settings.syncLocalOnly', 'Browser-only storage', 'settings.syncLocalOnlyDetail', 'This host does not provide installation-wide synchronization.'],
        loading: ['arrows-clockwise', 'settings.syncLoading', 'Connecting shared library', 'settings.syncLoadingDetail', 'Checking installation storage…'],
      }[status] || ['arrows-clockwise', 'settings.syncLoading', 'Connecting shared library', 'settings.syncLoadingDetail', 'Checking installation storage…'];
      sources.syncStatus.dataset.status = status;
      sources.syncIcon.replaceChildren(icon(syncContent[0]));
      sources.syncTitle.textContent = translate(t, syncContent[1], syncContent[2]);
      sources.syncDetail.textContent = translate(t, syncContent[3], syncContent[4], {
        count: status === 'restore-error' ? hydrationFailed : status === 'pending' ? Number(sync.pending) || 0 : hydrating,
      });
      sources.syncRetry.hidden = !['error', 'pending', 'restore-error'].includes(status);
      sources.syncRecover.hidden = !sync.recoveryAvailable;
      if (Object.prototype.hasOwnProperty.call(state, 'proxy')) {
        sources.proxyInput.value = safeText(state.proxy);
      }
      if (Object.prototype.hasOwnProperty.call(state, 'guideSources')) {
        sources.guideInput.value = normaliseArray(state.guideSources).join('\n');
      }
      if (Object.prototype.hasOwnProperty.call(state, 'guideRefreshMinutes')) {
        sources.guideCadence.value = safeText(state.guideRefreshMinutes, '360');
      }
      if (state.guideLastRefresh) {
        sources.guideStatus.textContent = translate(t, 'guide.lastChecked', 'Last checked {time}', {
          time: formatGuideDateTime(state.guideLastRefresh),
        });
      } else setTranslatedText(sources.guideStatus, t, 'guide.notChecked', 'Not checked yet');
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
      const inlineChannel = ['channelId', 'id', 'tvgId', 'url', 'endpoints']
        .some((key) => Object.prototype.hasOwnProperty.call(state, key)) ? state : null;
      const channel = state.channel || state.currentChannel || inlineChannel;
      if (channel && typeof channel === 'object') {
        const id = safeId(channel.channelId || channel.id || channel.tvgId || channel.url);
        player.overlay.dataset.channelId = id;
        player.favoriteButton.dataset.channelId = id;
        player.addToMultiviewButton.dataset.channelId = id;
        setMedia(player.video, { ...channel, muted: state.muted ?? channel.muted, autoplay: state.autoplay ?? channel.autoplay });
        player.number.textContent = channelNumber(channel, Number(channel.position || 0));
        player.name.textContent = safeText(channel.name, translate(t, 'channel.unknown', 'Unknown channel'));
        updateChannelMeta(player.meta, channel, {
          localClock: true,
          locale: document.documentElement.lang,
          now: Date.now(),
          t,
        });
        const isFavorite = Boolean(channel.favorite || channel.isFavorite);
        player.favoriteButton.classList.toggle('is-active', isFavorite);
        player.favoriteButton.setAttribute('aria-pressed', isFavorite ? 'true' : 'false');
        setFavoriteGlyph(player.favoriteButton, isFavorite);
        setTranslatedText(
          player.favoriteButton.querySelector('.button__label'),
          t,
          isFavorite ? 'favorite.remove' : 'favorite.add',
          isFavorite ? 'Remove favorite' : 'Favorite',
        );
        player.programmeList.replaceChildren();
        const programmes = channelSchedule(channel).slice(0, 8);
        const guideLoading = Boolean(state.guideLoading);
        const showGuide = guideLoading || programmes.length > 0;
        player.programmeStrip.hidden = !showGuide;
        player.transport.classList.toggle('has-guide', showGuide);
        if (!programmes.length) {
          if (guideLoading) {
            const loading = textNode('p', 'player-programmes__empty', t, 'guide.loadingChannel', 'Loading this channel’s guide…');
            loading.setAttribute('role', 'status');
            player.programmeList.append(loading);
          }
        } else {
          programmes.forEach((programme) => {
            const isNow = Number(programme.start) <= Date.now() && Number(programme.stop) > Date.now();
            const item = element('button', `player-programme${isNow ? ' is-now' : ''}`, {
              type: 'button', dataset: { action: 'open-channel-guide', channelId: id },
            });
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
      player.localTime.textContent = formatGuideTime(Date.now());
      if (state.loading !== undefined) {
        player.status.hidden = !state.loading && !state.error;
        const connection = state.connection || {};
        player.statusText.textContent = safeText(
          state.error ? connection.title || translate(t, 'player.error', 'Stream unavailable') : connection.title,
          state.error ? translate(t, 'player.error', 'Stream unavailable') : translate(t, 'player.loading', 'Contacting stream'),
        );
        player.statusDetail.textContent = safeText(
          state.error ? connection.error || state.error || connection.detail : connection.detail,
          state.error ? translate(t, 'player.errorDetail', 'No playable signal was returned by this channel.') : translate(t, 'player.connectionStart', 'Selecting a browser-compatible route to the provider.'),
        );
        player.statusRoute.textContent = safeText(connection.meta, 'DIRECT · ENDPOINT 1/1');
        player.statusElapsed.textContent = `${(Math.max(0, Number(connection.elapsedMs) || 0) / 1000).toFixed(1)} S`;
        player.statusAdvice.textContent = safeText(connection.advice, translate(t, 'player.connectionNormal', 'This is within the normal startup window.'));
        const activeStep = Math.max(1, Math.min(4, Number(connection.step) || 1));
        player.statusSteps.forEach((step, index) => step.classList.toggle('is-active', index < activeStep));
        player.statusAlternate.hidden = !connection.canTryAnother;
        player.status.dataset.tone = safeText(connection.tone, state.error ? 'error' : 'loading');
        player.status.classList.toggle('is-error', Boolean(state.error));
        player.statusIcon.className = `ph ph-${state.error ? 'warning-circle' : 'spinner-gap'}${state.error ? '' : ' is-spinning'}`;
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
      if (state.muted !== undefined) {
        const muted = Boolean(state.muted);
        player.volumeMute.replaceChildren(icon(muted ? 'speaker-slash' : 'speaker-high'));
        player.volumeMute.dataset.muted = muted ? 'false' : 'true';
        player.volumeMute.setAttribute('aria-pressed', muted ? 'true' : 'false');
        player.volumeMute.setAttribute('aria-label', translate(t, muted ? 'player.unmute' : 'player.mute', muted ? 'Unmute' : 'Mute'));
        player.volumeMute.title = player.volumeMute.getAttribute('aria-label');
      }
      if (state.audioStatus !== undefined) {
        const status = state.audioStatus || {};
        player.audioStatus.textContent = safeText(status.label, translate(t, 'player.audioChecking', 'Audio checking'));
        player.audioStatus.dataset.tone = safeText(status.tone, 'checking');
        player.audioStatus.title = safeText(status.detail, player.audioStatus.textContent);
      }
      if (state.signalLab !== undefined) api.showSignalLab(state.signalLab);
      return api;
    },

    showMultiview(state = {}) {
      shell.hidden = true;
      setViewVisible(player.overlay, false);
      setViewVisible(multiview.overlay, true);
      root.dataset.mode = 'multiview';
      multiview.overlay.classList.toggle('is-chrome-visible', state.chromeVisible !== false);
      api.updateMultiview(state);
      return api;
    },

    updateMultiview(state = {}) {
      const feeds = normaliseArray(state.feeds || state.channels).slice(0, MULTIVIEW_SIZE);
      const layoutCount = Math.max(2, Math.min(4, Number(state.layout || state.count || Math.max(feeds.length, 4)) || 4));
      if (state.chromeVisible !== undefined) {
        multiview.overlay.classList.toggle('is-chrome-visible', Boolean(state.chromeVisible));
      }
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
        const audioLabel = translate(
          t,
          isListening ? 'multiview.muteFeed' : 'multiview.listenToFeed',
          isListening ? 'Mute this feed' : 'Listen to this feed',
        );
        refs.audio.setAttribute('aria-label', audioLabel);
        refs.audio.title = audioLabel;
        refs.audio.setAttribute('aria-pressed', String(isListening));
        if (feed) {
          setMedia(refs.video, { ...feed, muted: !isListening, autoplay: state.autoplay !== false });
          refs.number.textContent = String(index + 1).padStart(2, '0');
          refs.channelName.textContent = safeText(feed.name, translate(t, 'channel.unknown', 'Unknown channel'));
          updateChannelMeta(refs.meta, feed, { t });
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
      if (options.action?.name && options.action?.label) {
        const action = element('button', 'toast__action', {
          type: 'button',
          dataset: { action: options.action.name, ...(options.action.dataset || {}) },
        });
        action.textContent = safeText(options.action.label);
        node.append(action);
      }
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

    showProgrammeOverlay(channel) {
      if (!channel) return api;
      setProgrammeOverlay(programmeOverlay, channel, t);
      programmeOverlay.backdrop.hidden = false;
      programmeOverlay.close.focus();
      return api;
    },

    hideProgrammeOverlay() {
      programmeOverlay.backdrop.hidden = true;
      return api;
    },

    expandGuideProgrammeCard(card) {
      if (!(card instanceof Element) || !card.classList.contains('programme-card')) return false;
      const clipped = programmeCardNeedsExpansion(card);
      const expanded = card.classList.contains('is-expanded');
      guide.grid.querySelectorAll('.programme-card.is-expanded').forEach((item) => {
        item.classList.remove('is-expanded');
        item.setAttribute('aria-expanded', 'false');
      });
      window.clearTimeout(guideProgrammeTimer);
      if (expanded || !clipped) return false;
      card.classList.add('is-expanded');
      card.setAttribute('aria-expanded', 'true');
      guideProgrammeTimer = window.setTimeout(() => {
        card.classList.remove('is-expanded');
        card.setAttribute('aria-expanded', 'false');
      }, 5200);
      return true;
    },

    playFavoriteEffect(anchor, mode = 'add') {
      return playFavoriteEffect(root, anchor, mode === 'remove' ? 'remove' : 'add');
    },

    destroy() {
      window.clearTimeout(toastTimer);
      window.clearTimeout(guideProgrammeTimer);
      explore.view.removeEventListener('scroll', loadMoreExploreNearEnd);
      dispatcher.destroy();
      root.replaceChildren();
      root.classList.remove('catodo-app');
      delete root.dataset.mode;
      delete root.dataset.view;
      mountedApps.delete(root);
    },
  };

  renderWorldMap(countries.map, { t });
  renderEmpty(home.favoriteGrid, t, 'favorites.empty', 'No favorites yet', 'Save channels here for one-tap tuning.');
  renderEmpty(library.grid, t, 'library.empty', 'Your library is waiting', 'Add a playlist or favorite a live channel to keep it close.');
  renderSources(sources.list, [], t);
  activateShellView('home');
  mountedApps.set(root, api);
  return api;
}

export { renderChannelTiles };
