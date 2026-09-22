import { THEATRE_TITLES } from '../data/theatre-catalog.js';
import { THEATRE_COLLECTIONS, THEATRE_ARCHIVE_GUIDES } from '../data/theatre-collections.js';
import { filterTheatre, randomTheatreTitle, readTheatreFavorites, saveTheatreFavorites, theatreTime } from '../data/theatre-model.js';
import { TheatrePlayer } from '../player/theatre-player.js';
import { createTheatreArtwork } from './theatre-artwork.js';
import { createTheatreArchive } from './theatre-archive.js';
import { createTheatreFeatured } from './theatre-featured.js';
import { featuredReportUrl } from '../data/theatre-featured-model.js';

/** Self-contained shelf and persistent player; catalog refreshes never remount it. */
export function createTheatreView({ t, beforePlay, titles = THEATRE_TITLES } = {}) {
  const tr = (key, fallback, vars = {}) => {
    const text = typeof t === 'function' ? t(`theatre.${key}`, fallback, vars) : fallback;
    return String(text || fallback).replace(/\{(\w+)\}/g, (match, name) => vars[name] ?? match);
  };
  const node = (tag, className, text) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const button = (text, action, className = 'button button--ghost') => {
    const el = node('button', className, text);
    el.type = 'button'; el.dataset.theatreAction = action;
    return el;
  };
  const link = (text, href) => {
    const el = node('a', 'theatre-link', text);
    el.href = href; el.target = '_blank'; el.rel = 'noopener noreferrer';
    return el;
  };
  let storage;
  try { storage = window.localStorage; } catch { /* Device storage may be unavailable. */ }
  let favorites = readTheatreFavorites(storage, titles);
  let selected = randomTheatreTitle(titles);
  let editionIndex = 0;
  const consentedOrigins = new Set();
  const state = { filter: 'all', collection: [], language: '', query: '', sort: 'editorial' };
  const events = new AbortController();
  let active = false, mode = 'curated';
  const view = node('section', 'page page--theatre'); view.dataset.page = 'theatre';
  const intro = node('header', 'theatre-intro');
  const introCopy = node('div');
  introCopy.append(node('p', 'eyebrow', tr('eyebrow', 'CATODO / CINEMA')), node('h1', '', tr('title', 'Theatre')),
    node('p', 'theatre-lead', tr('description', 'Films worth your time. A curated collection with a source behind every story.')));
  const count = node('p', 'theatre-count');
  const introActions = node('div', 'theatre-intro-actions');
  const randomize = button(tr('randomize', 'Randomize'), 'randomize');
  let motionEnabled = true;
  try { motionEnabled = storage?.getItem('catodo:theatre:motion:v1') !== 'off'; } catch { /* Visit preference still works. */ }
  const motion = button(tr('motion', 'Motion'), 'motion'); motion.setAttribute('aria-pressed', String(motionEnabled));
  motion.title = tr('motionHint', 'Animate visible artwork. Reduced motion and data saver always take priority.');
  introActions.append(count, randomize, motion);
  const modes = node('div', 'theatre-modes'); modes.setAttribute('aria-label', tr('browsingMode', 'Theatre browsing mode'));
  const curatedMode = button(tr('curatedMode', 'Curated films'), 'curated-mode'); curatedMode.setAttribute('aria-pressed', 'true');
  const archiveMode = button(tr('archiveMode', 'Explore archives'), 'archive-mode'); archiveMode.setAttribute('aria-pressed', 'false');
  const featuredMode = button(tr('featuredMode', 'Featured'), 'featured-mode'); featuredMode.setAttribute('aria-pressed', 'false');
  modes.append(curatedMode, featuredMode, archiveMode);
  const introTools = node('div', 'theatre-intro-tools'); introTools.append(introActions, modes); intro.append(introCopy, introTools);
  const stage = node('section', 'theatre-stage'); stage.setAttribute('aria-label', tr('playerLabel', 'Film player'));
  const screen = node('div', 'theatre-screen');
  const video = node('video', 'theatre-video'); video.controls = true; video.preload = 'none'; video.playsInline = true;
  video.setAttribute('aria-label', tr('playerLabel', 'Film player'));
  const curtain = node('div', 'theatre-curtain');
  const cover = node('img', 'theatre-cover'); cover.alt = ''; cover.decoding = 'async';
  const coverCredit = node('a', 'theatre-cover-credit'); coverCredit.target = '_blank'; coverCredit.rel = 'noopener noreferrer';
  curtain.append(cover);
  screen.append(video, curtain);
  const info = node('div', 'theatre-info');
  const meta = node('p', 'theatre-meta'), heading = node('h2'), creator = node('p', 'theatre-creator');
  const synopsis = node('p', 'theatre-synopsis'), warning = node('p', 'theatre-warning');
  const editions = node('select', 'theatre-select'); editions.setAttribute('aria-label', tr('edition', 'Edition or episode'));
  const play = button(tr('allowPlay', 'Allow source & play'), 'play', 'button button--primary theatre-play');
  const favorite = button('', 'favorite');
  const status = node('p', 'theatre-status'); status.setAttribute('role', 'status');
  const actions = node('div', 'theatre-actions'); actions.append(play, favorite);
  const controls = node('div', 'theatre-controls');
  const back = button(tr('back', '−15 seconds'), 'back');
  const forward = button(tr('forward', '+15 seconds'), 'forward');
  const mute = button(tr('mute', 'Mute'), 'mute');
  const fullscreen = button(tr('fullscreen', 'Fullscreen'), 'fullscreen');
  const close = button(tr('closePlayer', 'Close player'), 'close');
  controls.append(back, forward, mute, fullscreen, close);
  controls.hidden = true;
  info.append(meta, heading, creator, synopsis, warning);
  const stageFooter = node('div', 'theatre-stage-footer');
  stageFooter.append(editions, actions, coverCredit, controls, status);
  stage.append(screen, info, stageFooter);
  const toolbar = node('div', 'theatre-toolbar');
  const filters = node('div', 'theatre-filters'); filters.setAttribute('aria-label', tr('filterLabel', 'Film collections'));
  const genres = [...new Set(titles.filter((title) => title.decision === 'usable').flatMap((title) => title.genres))];
  ['all', 'favorited', ...genres].forEach((id) => {
    const el = button(tr(`filters.${id}`, id === 'favorited' ? 'Favorited' : id.charAt(0).toUpperCase() + id.slice(1)), 'filter');
    el.dataset.filter = id; filters.append(el);
  });
  const refinements = node('div', 'theatre-refinements');
  const collection = node('select', 'theatre-select'); collection.setAttribute('aria-label', tr('collection', 'Curated collection'));
  const allCollections = node('option', '', tr('allCollections', 'All collections')); allCollections.value = ''; collection.append(allCollections);
  THEATRE_COLLECTIONS.filter((entry) => entry.ids.some((id) => titles.some((title) => title.id === id))).forEach((entry) => {
    const option = node('option', '', tr(`collections.${entry.id}`, entry.title)); option.value = entry.id; collection.append(option);
  });
  const search = node('input', 'theatre-search'); search.type = 'search';
  search.placeholder = tr('search', 'Search films, directors…'); search.setAttribute('aria-label', search.placeholder);
  const language = node('select', 'theatre-select'); language.setAttribute('aria-label', tr('languageFilter', 'Film language'));
  const allLanguages = node('option', '', tr('allLanguages', 'All languages')); allLanguages.value = ''; language.append(allLanguages);
  [...new Set(titles.flatMap((title) => title.languages))].forEach((code) => {
    const option = node('option', '', tr(`languages.${code}`, code)); option.value = code; language.append(option);
  });
  const order = node('select', 'theatre-select theatre-order'); order.setAttribute('aria-label', tr('sort.label', 'Order by'));
  for (const [value, label] of [['editorial', 'Editorial order'], ['newest', 'Year · newest first'], ['oldest', 'Year · oldest first'], ['title', 'Title · A–Z'], ['shortest', 'Duration · shortest first']]) {
    const option = node('option', '', tr(`sort.${value}`, label)); option.value = value; order.append(option);
  }
  refinements.append(search, collection, language, order); toolbar.append(refinements, filters);
  const grid = node('div', 'theatre-grid'), empty = node('p', 'theatre-empty', tr('empty', 'No films match this selection. Try All or clear your search.'));
  const credits = button(tr('credits', 'Source, credits & viewing notes'), 'credits', 'theatre-credits');
  credits.setAttribute('aria-haspopup', 'dialog');
  credits.setAttribute('aria-controls', 'theatre-credits-dialog');
  const creditDialog = node('dialog', 'theatre-credits-dialog'); creditDialog.id = 'theatre-credits-dialog';
  creditDialog.setAttribute('aria-labelledby', 'theatre-credits-title');
  const creditHeader = node('header', 'theatre-credits__header');
  const creditTitle = node('h2', '', tr('credits', 'Source, credits & viewing notes')); creditTitle.id = 'theatre-credits-title';
  const creditClose = button('×', 'close-credits', 'icon-button theatre-credits__close');
  creditClose.setAttribute('aria-label', tr('closeCredits', 'Close credits')); creditClose.autofocus = true;
  creditHeader.append(creditTitle, creditClose);
  const creditBody = node('div', 'theatre-credits__body'); creditDialog.append(creditHeader, creditBody);
  const outsideDialog = (event) => {
    const bounds = creditDialog.getBoundingClientRect();
    return event.target === creditDialog && (event.clientX < bounds.left || event.clientX > bounds.right
      || event.clientY < bounds.top || event.clientY > bounds.bottom);
  };
  let backdropPress = false;
  creditDialog.addEventListener('pointerdown', (event) => { backdropPress = outsideDialog(event); }, { signal: events.signal });
  creditDialog.addEventListener('click', (event) => {
    if (backdropPress && outsideDialog(event)) creditDialog.close();
    backdropPress = false;
  }, { signal: events.signal });
  creditDialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const focusable = [...creditDialog.querySelectorAll('button:not(:disabled), a[href], select:not(:disabled), [tabindex="0"]')]
      .filter((element) => element.getClientRects().length);
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }, { signal: events.signal });
  creditDialog.addEventListener('close', () => {
    if (active && credits.isConnected) credits.focus({ preventScroll: true });
  }, { signal: events.signal });
  const storageNote = node('p', 'theatre-storage', tr('localFavorites', 'Film favorites are saved on this device.'));
  const archiveGuides = node('section', 'theatre-archive-guides');
  archiveGuides.append(node('h2', '', tr('archiveGuides', 'Further into the archive')),
    node('p', 'theatre-lead', tr('archiveGuideNote', 'Explore these collections on their source sites. Individual editions, restorations and territorial rights need their own review.')));
  const guideGrid = node('div', 'theatre-archive-grid');
  THEATRE_ARCHIVE_GUIDES.forEach((guide) => {
    const item = node('article', 'theatre-archive-guide');
    item.append(node('h3', '', tr(`archive.${guide.id}.title`, guide.title)), node('p', '', tr(`archive.${guide.id}.description`, guide.description)),
      link(tr('browseArchive', 'Browse on Archive.org ↗'), guide.sourceUrl), link(guide.curator, guide.curatorUrl)); guideGrid.append(item);
  });
  archiveGuides.append(guideGrid);
  const archiveCatalog = createTheatreArchive({ t: tr, titles, onReviewed(title) {
    setMode('curated'); selectTitle(title); stage.scrollIntoView({ block: 'start', behavior: 'instant' });
  } });
  const featuredCatalog = createTheatreFeatured({ t: tr, beforePlay });
  const opening = node('div', 'theatre-opening');
  const feature = node('div', 'theatre-feature'); feature.append(stage, credits);
  opening.append(feature, toolbar);
  view.append(intro, opening, grid, empty, archiveGuides, storageNote, featuredCatalog.root, archiveCatalog.root, creditDialog);

  const artworkMotion = createTheatreArtwork({ root: view, creditLabel: (credit) => tr('imageCredit', 'Image: {credit}', { credit }) });
  artworkMotion.setEnabled(motionEnabled);

  const player = new TheatrePlayer({ video, beforePlay, onState: (snapshot) => {
    play.textContent = snapshot.playing ? tr('pause', 'Pause') : playLabel();
    play.setAttribute('aria-pressed', String(snapshot.playing));
    curtain.hidden = Boolean(video.getAttribute('src'));
    controls.hidden = !video.getAttribute('src');
    stage.classList.toggle('is-loaded', Boolean(video.getAttribute('src')));
    opening.classList.toggle('is-loaded', Boolean(video.getAttribute('src')));
    artworkMotion.setPlaying(snapshot.playing);
    mute.textContent = snapshot.muted ? tr('unmute', 'Unmute') : tr('mute', 'Mute');
    status.textContent = snapshot.error === 'gesture' ? tr('gesture', 'Press Play to start this film.')
      : snapshot.error ? tr('unavailable', 'This source is unavailable. Try again or open the source page.') : '';
  } });
  function playLabel() {
    return selected && consentedOrigins.has(new URL(selected.editions[editionIndex].url).origin)
      ? tr('play', 'Play film') : tr('allowPlay', 'Allow source & play');
  }
  function updateFavorite() {
    const saved = favorites.includes(selected?.id);
    favorite.textContent = saved ? tr('saved', '★ Favorited') : tr('save', '☆ Favorite');
    favorite.setAttribute('aria-pressed', String(saved));
  }
  function renderShelf() {
    artworkMotion.clear();
    const visible = filterTheatre(titles, { ...state, favorites });
    randomize.disabled = !visible.some((title) => title.id !== selected?.id);
    count.textContent = visible.length === 1 ? tr('countOne', '1 film') : tr('count', '{count} films', { count: visible.length });
    filters.querySelectorAll('button').forEach((el) => {
      el.setAttribute('aria-pressed', String(el.dataset.filter === state.filter));
    });
    const cards = visible.map((title) => {
      const card = button('', 'select', 'theatre-card'); card.dataset.title = title.id;
      card.dataset.tone = title.tone || 'blue'; card.setAttribute('aria-pressed', String(title.id === selected?.id));
      const artwork = node('span', 'theatre-card__art');
      const photo = node('img', 'theatre-card__image'); photo.src = title.artwork.src; photo.alt = '';
      photo.loading = 'lazy'; photo.decoding = 'async'; photo.width = title.artwork.width; photo.height = title.artwork.height;
      artwork.append(photo);
      const label = node('span', 'theatre-card__label');
      label.append(node('span', 'theatre-card__year', `${title.year} / ${theatreTime(title.duration)}`),
        node('span', 'theatre-card__title', title.title), node('span', 'theatre-card__creator', title.creator),
        node('span', 'theatre-card__synopsis', title.synopsis));
      const saved = node('span', 'theatre-card__saved', favorites.includes(title.id) ? '★' : ''); saved.setAttribute('aria-hidden', 'true');
      card.append(artwork, label, saved);
      const wrapper = node('article', 'theatre-card-wrap');
      const imageCredit = link(tr('imageCredit', 'Image: {credit}', { credit: title.artwork.credit }), title.artwork.sourceUrl);
      imageCredit.className = 'theatre-image-credit';
      artworkMotion.add(artwork, photo, imageCredit, title);
      wrapper.append(card, imageCredit); return wrapper;
    });
    grid.replaceChildren(...cards); empty.hidden = mode !== 'curated' || cards.length > 0;
  }
  function renderSelection() {
    if (!selected) { stage.hidden = true; credits.hidden = true; return; }
    heading.textContent = selected.title;
    cover.src = selected.artwork.src; cover.width = selected.artwork.width; cover.height = selected.artwork.height;
    coverCredit.textContent = tr('imageCredit', 'Image: {credit}', { credit: selected.artwork.credit });
    coverCredit.href = selected.artwork.sourceUrl;
    meta.textContent = `${selected.year} / ${theatreTime(selected.duration)} / ${selected.languages.map((code) => tr(`languages.${code}`, code)).join(', ')}`;
    creator.textContent = selected.creator; synopsis.textContent = selected.synopsis;
    warning.textContent = selected.contentNote || ''; warning.hidden = !selected.contentNote;
    editions.replaceChildren(...selected.editions.map((edition, index) => { const option = node('option', '', edition.label); option.value = index; return option; }));
    editions.hidden = selected.editions.length < 2; editions.value = editionIndex;
    const url = new URL(selected.editions[editionIndex].url);
    play.textContent = playLabel(); play.setAttribute('aria-pressed', 'false'); updateFavorite();
    const sourceLinks = node('div', 'theatre-source-links');
    sourceLinks.append(link(tr('source', 'Open source page'), selected.sourceUrl), link(selected.license, selected.licenseUrl));
    sourceLinks.append(link(tr('featured.report', 'Report an issue or rights concern on GitHub ↗'), featuredReportUrl(selected)));
    if (url.hostname === 'archive.org' && url.pathname.startsWith('/download/')) {
      sourceLinks.append(link(tr('archiveEdition', 'This edition on Archive.org'), `https://archive.org/details/${url.pathname.split('/')[2]}`));
    }
    const qr = node('img', 'theatre-qr'); qr.src = selected.qr; qr.width = 148; qr.height = 148;
    qr.alt = tr('qr', 'QR code for the film source page'); qr.loading = 'lazy';
    qr.addEventListener('load', () => {
      // Authored at eight pixels per module; preserve four screen pixels per module.
      const size = qr.naturalWidth / 2;
      qr.style.width = `${size}px`; qr.style.height = `${size}px`;
    }, { once: true });
    const rights = node('div', 'theatre-rights');
    rights.append(node('h3', '', selected.title), node('p', '', selected.synopsis), node('h3', '', selected.sourceName), node('p', '', selected.rights), node('p', '', selected.editionNote),
      node('p', '', selected.subtitles), sourceLinks, node('p', 'theatre-attribution', selected.attribution));
    const art = selected.artwork;
    rights.append(node('p', '', tr('artworkNote', 'Cover image: {note}', { note: art.note })),
      link(tr('artworkSource', 'Image source'), art.sourceUrl), document.createTextNode(' · '), link(art.license, art.licenseUrl));
    for (const alternate of selected.artworks || []) {
      rights.append(node('p', '', alternate.note), link(alternate.credit, alternate.sourceUrl),
        document.createTextNode(' · '), link(alternate.license, alternate.licenseUrl));
    }
    const qrBlock = node('div', 'theatre-qr-block'); qrBlock.append(qr, node('p', '', tr('scan', 'Take the source with you.')));
    creditBody.replaceChildren(rights, qrBlock);
  }
  function selectTitle(next, { keepPosition = false } = {}) {
    if (!next || next === selected) return;
    player.clear(); selected = next; editionIndex = 0; renderSelection(); renderShelf();
    if (!keepPosition) {
      heading.tabIndex = -1; heading.focus({ preventScroll: true }); stage.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
  }
  function setMode(next) {
    if (creditDialog.open) creditDialog.close();
    mode = next; const curated = mode === 'curated';
    player.setActive(active && curated);
    [introActions, opening, grid, archiveGuides, storageNote].forEach((element) => { element.hidden = !curated; });
    empty.hidden = !curated || grid.childElementCount > 0;
    curatedMode.setAttribute('aria-pressed', String(curated));
    featuredMode.setAttribute('aria-pressed', String(mode === 'featured'));
    archiveMode.setAttribute('aria-pressed', String(mode === 'archive'));
    artworkMotion.setActive(active && curated);
    archiveCatalog.setActive(active && mode === 'archive');
    featuredCatalog.setActive(active && mode === 'featured');
  }
  view.addEventListener('click', async (event) => {
    const target = event.target.closest('[data-theatre-action]'); if (!target) return;
    switch (target.dataset.theatreAction) {
      case 'credits': if (selected && !creditDialog.open) { creditDialog.showModal(); creditBody.scrollTop = 0; } break;
      case 'close-credits': creditDialog.close(); break;
      case 'curated-mode': setMode('curated'); break;
      case 'archive-mode': setMode('archive'); break;
      case 'featured-mode': setMode('featured'); break;
      case 'select': {
        const next = titles.find((title) => title.id === target.dataset.title && title.decision === 'usable');
        selectTitle(next);
        break;
      }
      case 'randomize': selectTitle(randomTheatreTitle(filterTheatre(titles, { ...state, favorites }), selected?.id), { keepPosition: true }); break;
      case 'motion':
        motionEnabled = !motionEnabled; motion.setAttribute('aria-pressed', String(motionEnabled));
        artworkMotion.setEnabled(motionEnabled);
        try { storage?.setItem('catodo:theatre:motion:v1', motionEnabled ? 'on' : 'off'); } catch { /* Visit preference. */ }
        break;
      case 'close': player.clear(); break;
      case 'play':
        if (!selected) return;
        if (!video.paused) { player.pause(); return; }
        consentedOrigins.add(new URL(selected.editions[editionIndex].url).origin);
        await player.play(selected, { consent: true, editionIndex });
        break;
      case 'favorite': {
        if (!selected) return;
        favorites = favorites.includes(selected.id) ? favorites.filter((id) => id !== selected.id) : [...favorites, selected.id];
        const saved = saveTheatreFavorites(storage, favorites);
        storageNote.textContent = saved ? tr('localFavorites', 'Film favorites are saved on this device.') : tr('storageUnavailable', 'Device storage is unavailable. Favorites will last for this visit.');
        updateFavorite(); renderShelf(); break;
      }
      case 'back': player.seek(-15); break;
      case 'forward': player.seek(15); break;
      case 'mute': video.muted = !video.muted; break;
      case 'fullscreen':
        try {
          if (video.requestFullscreen) await video.requestFullscreen();
          else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
          else status.textContent = tr('fullscreenUnavailable', 'Fullscreen is unavailable in this browser.');
        } catch { status.textContent = tr('fullscreenUnavailable', 'Fullscreen is unavailable in this browser.'); }
        break;
      case 'filter': state.filter = target.dataset.filter; renderShelf(); break;
      default: break;
    }
  }, { signal: events.signal });
  search.addEventListener('input', () => { state.query = search.value; renderShelf(); }, { signal: events.signal });
  order.addEventListener('change', () => { state.sort = order.value; renderShelf(); }, { signal: events.signal });
  language.addEventListener('change', () => { state.language = language.value; renderShelf(); }, { signal: events.signal });
  collection.addEventListener('change', () => { state.collection = THEATRE_COLLECTIONS.find((entry) => entry.id === collection.value)?.ids || []; renderShelf(); }, { signal: events.signal });
  editions.addEventListener('change', () => { player.clear(); editionIndex = Number(editions.value); renderSelection(); }, { signal: events.signal });
  renderSelection(); renderShelf();
  return { view, video, player, setActive(value) { active = value; if (!value && creditDialog.open) creditDialog.close(); player.setActive(value && mode === 'curated'); artworkMotion.setActive(value && mode === 'curated'); archiveCatalog.setActive(value && mode === 'archive'); featuredCatalog.setActive(value && mode === 'featured'); }, destroy() { if (creditDialog.open) creditDialog.close(); events.abort(); archiveCatalog.destroy(); featuredCatalog.destroy(); artworkMotion.destroy(); player.destroy(); } };
}
