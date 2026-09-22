import { THEATRE_TITLES } from '../data/theatre-catalog.js';
import { filterTheatre, readTheatreFavorites, saveTheatreFavorites, theatreTime } from '../data/theatre-model.js';
import { TheatrePlayer } from '../player/theatre-player.js';

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
  let selected = titles.find((title) => title.decision === 'usable');
  let editionIndex = 0;
  const consentedOrigins = new Set();
  const state = { filter: 'all', language: '', query: '' };
  const events = new AbortController();
  const view = node('section', 'page page--theatre'); view.dataset.page = 'theatre';
  const intro = node('header', 'theatre-intro');
  const introCopy = node('div');
  introCopy.append(node('p', 'eyebrow', tr('eyebrow', 'CATODO / CINEMA')), node('h1', '', tr('title', 'Theatre')),
    node('p', 'theatre-lead', tr('description', 'Films worth your time. A curated collection with a source behind every story.')));
  const count = node('p', 'theatre-count');
  intro.append(introCopy, count);
  const stage = node('section', 'theatre-stage'); stage.setAttribute('aria-label', tr('playerLabel', 'Film player'));
  const screen = node('div', 'theatre-screen');
  const video = node('video', 'theatre-video'); video.controls = true; video.preload = 'none'; video.playsInline = true;
  video.setAttribute('aria-label', tr('playerLabel', 'Film player'));
  const curtain = node('div', 'theatre-curtain');
  const cover = node('img', 'theatre-cover'); cover.alt = ''; cover.decoding = 'async';
  const coverCredit = node('a', 'theatre-cover-credit'); coverCredit.target = '_blank'; coverCredit.rel = 'noopener noreferrer';
  curtain.append(cover, coverCredit);
  screen.append(video, curtain);
  const info = node('div', 'theatre-info');
  const meta = node('p', 'theatre-meta'), heading = node('h2'), creator = node('p', 'theatre-creator');
  const synopsis = node('p', 'theatre-synopsis'), warning = node('p', 'theatre-warning');
  const editions = node('select', 'theatre-select'); editions.setAttribute('aria-label', tr('edition', 'Edition or episode'));
  const consent = node('p', 'theatre-consent');
  const play = button(tr('allowPlay', 'Allow source & play'), 'play', 'button button--primary theatre-play');
  const favorite = button('', 'favorite');
  const status = node('p', 'theatre-status'); status.setAttribute('role', 'status');
  const actions = node('div', 'theatre-actions'); actions.append(play, favorite);
  const controls = node('div', 'theatre-controls');
  const back = button(tr('back', '−15 seconds'), 'back');
  const forward = button(tr('forward', '+15 seconds'), 'forward');
  const mute = button(tr('mute', 'Mute'), 'mute');
  const fullscreen = button(tr('fullscreen', 'Fullscreen'), 'fullscreen');
  controls.append(back, forward, mute, fullscreen);
  controls.hidden = true;
  info.append(meta, heading, creator, synopsis, warning, editions, consent, actions, controls, status);
  stage.append(screen, info);
  const toolbar = node('div', 'theatre-toolbar');
  const filters = node('div', 'theatre-filters'); filters.setAttribute('aria-label', tr('filterLabel', 'Film collections'));
  const genres = [...new Set(titles.filter((title) => title.decision === 'usable').flatMap((title) => title.genres))];
  ['all', 'favorited', ...genres].forEach((id) => {
    const el = button(tr(`filters.${id}`, id === 'favorited' ? 'Favorited' : id.charAt(0).toUpperCase() + id.slice(1)), 'filter');
    el.dataset.filter = id; filters.append(el);
  });
  const refinements = node('div', 'theatre-refinements');
  const search = node('input', 'theatre-search'); search.type = 'search';
  search.placeholder = tr('search', 'Search films, directors…'); search.setAttribute('aria-label', search.placeholder);
  const language = node('select', 'theatre-select'); language.setAttribute('aria-label', tr('languageFilter', 'Film language'));
  const allLanguages = node('option', '', tr('allLanguages', 'All languages')); allLanguages.value = ''; language.append(allLanguages);
  [...new Set(titles.flatMap((title) => title.languages))].forEach((code) => {
    const option = node('option', '', tr(`languages.${code}`, code)); option.value = code; language.append(option);
  });
  refinements.append(search, language); toolbar.append(filters, refinements);
  const grid = node('div', 'theatre-grid'), empty = node('p', 'theatre-empty', tr('empty', 'No films match this selection. Try All or clear your search.'));
  const credits = node('details', 'theatre-credits');
  credits.append(node('summary', '', tr('credits', 'Source, credits & viewing notes')));
  const creditBody = node('div', 'theatre-credits__body'); credits.append(creditBody);
  const storageNote = node('p', 'theatre-storage', tr('localFavorites', 'Film favorites are saved on this device.'));
  view.append(intro, stage, credits, toolbar, grid, empty, storageNote);

  const player = new TheatrePlayer({ video, beforePlay, onState: (snapshot) => {
    play.textContent = snapshot.playing ? tr('pause', 'Pause') : playLabel();
    play.setAttribute('aria-pressed', String(snapshot.playing));
    curtain.hidden = Boolean(video.getAttribute('src'));
    controls.hidden = !video.getAttribute('src');
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
    const visible = filterTheatre(titles, { ...state, favorites });
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
        node('span', 'theatre-card__title', title.title), node('span', 'theatre-card__creator', title.creator));
      const saved = node('span', 'theatre-card__saved', favorites.includes(title.id) ? '★' : ''); saved.setAttribute('aria-hidden', 'true');
      card.append(artwork, label, saved);
      const wrapper = node('article', 'theatre-card-wrap');
      const imageCredit = link(tr('imageCredit', 'Image: {credit}', { credit: title.artwork.credit }), title.artwork.sourceUrl);
      imageCredit.className = 'theatre-image-credit';
      wrapper.append(card, imageCredit); return wrapper;
    });
    grid.replaceChildren(...cards); empty.hidden = cards.length > 0;
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
    consent.textContent = tr('consent', 'Play connects to {host}, which receives your IP address. No film loads until you allow it.', { host: url.hostname });
    play.textContent = playLabel(); play.setAttribute('aria-pressed', 'false'); updateFavorite();
    const sourceLinks = node('div', 'theatre-source-links');
    sourceLinks.append(link(tr('source', 'Open source page'), selected.sourceUrl), link(selected.license, selected.licenseUrl));
    const qr = node('img', 'theatre-qr'); qr.src = selected.qr; qr.width = 148; qr.height = 148;
    qr.alt = tr('qr', 'QR code for the film source page'); qr.loading = 'lazy';
    qr.addEventListener('load', () => {
      // Authored at eight pixels per module; preserve four screen pixels per module.
      const size = qr.naturalWidth / 2;
      qr.style.width = `${size}px`; qr.style.height = `${size}px`;
    }, { once: true });
    const rights = node('div', 'theatre-rights');
    rights.append(node('h3', '', selected.sourceName), node('p', '', selected.rights), node('p', '', selected.editionNote),
      node('p', '', selected.subtitles), sourceLinks, node('p', 'theatre-attribution', selected.attribution));
    const art = selected.artwork;
    rights.append(node('p', '', tr('artworkNote', 'Cover image: {note}', { note: art.note })),
      link(tr('artworkSource', 'Image source'), art.sourceUrl), document.createTextNode(' · '), link(art.license, art.licenseUrl));
    const qrBlock = node('div', 'theatre-qr-block'); qrBlock.append(qr, node('p', '', tr('scan', 'Take the source with you.')));
    creditBody.replaceChildren(rights, qrBlock);
  }
  view.addEventListener('click', async (event) => {
    const target = event.target.closest('[data-theatre-action]'); if (!target) return;
    switch (target.dataset.theatreAction) {
      case 'select': {
        const next = titles.find((title) => title.id === target.dataset.title && title.decision === 'usable');
        if (!next || next === selected) return;
        player.clear(); selected = next; editionIndex = 0; renderSelection(); renderShelf();
        heading.tabIndex = -1; heading.focus({ preventScroll: true }); stage.scrollIntoView({ block: 'start', behavior: 'instant' });
        break;
      }
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
  language.addEventListener('change', () => { state.language = language.value; renderShelf(); }, { signal: events.signal });
  editions.addEventListener('change', () => { player.clear(); editionIndex = Number(editions.value); renderSelection(); }, { signal: events.signal });
  renderSelection(); renderShelf();
  return { view, video, player, setActive: (active) => player.setActive(active), destroy() { events.abort(); player.destroy(); } };
}
