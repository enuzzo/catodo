import { prepareArchiveRecordings } from '../data/theatre-archive-model.js';
import { featuredPlaybackTitle, loadFeaturedCatalog } from '../data/theatre-featured-model.js';
import { loadTheatreJson } from '../data/theatre-json.js';
import { shuffleTvPrograms, theatreTvPrograms } from '../data/theatre-tv-model.js';
import { TheatrePlayer } from '../player/theatre-player.js';
import { createVideoPoster } from './theatre-source-image.js';

export function createTheatreTv({ t, beforePlay, loadCatalog }) {
  const tr = (key, fallback, vars) => t(`tv.${key}`, fallback, vars);
  const events = new AbortController();
  const eventOptions = { signal: events.signal };
  const node = (tag, className = '', text) => {
    const element = document.createElement(tag);
    element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  function button(key, label, action, primary = false) {
    const element = node('button', `button button--${primary ? 'primary' : 'ghost'}`, tr(key, label));
    element.type = 'button';
    element.addEventListener('click', action, eventOptions);
    return element;
  }

  const root = node('section', 'catodo-tv'); root.hidden = true;
  root.setAttribute('aria-label', tr('title', 'CATODO TV'));
  const screen = node('div', 'catodo-tv-screen');
  const video = node('video', 'catodo-tv-video');
  video.preload = 'none'; video.playsInline = true; video.muted = true;
  video.setAttribute('aria-label', tr('video', 'CATODO TV player'));
  const idle = node('div', 'catodo-tv-idle');
  const title = node('h2', '', tr('title', 'CATODO TV'));
  const intro = node('p', '', tr('loading', 'Loading the channel…'));
  const start = button('start', 'Start CATODO TV', () => { if (order.length) tune(1); else load(); }, true);
  start.disabled = true;
  idle.append(title, intro, start);
  const overlay = node('div', 'catodo-tv-overlay'); overlay.hidden = true;
  const programTitle = node('h2'); programTitle.setAttribute('aria-live', 'polite');
  const meta = node('p', 'catodo-tv-meta');
  const description = node('p', 'catodo-tv-description');
  overlay.append(programTitle, meta, description);
  screen.append(video, idle, overlay);

  const controls = node('div', 'theatre-controls catodo-tv-controls'); controls.hidden = true;
  const previous = button('previous', 'Previous', () => tune(-1));
  const next = button('next', 'Next', () => tune(1));
  function togglePlayback() {
    if (!current) return;
    if (video.paused) playCurrent(); else player.pause();
  }
  const play = button('play', 'Play', togglePlayback);
  const mute = button('unmute', 'Unmute', () => { video.muted = !video.muted; });
  let showInfo = true;
  const info = button('info', 'Info', () => {
    showInfo = !showInfo;
    overlay.hidden = !showInfo;
    info.setAttribute('aria-pressed', String(showInfo));
  });
  info.setAttribute('aria-pressed', 'true');
  const status = node('p', 'theatre-status catodo-tv-status'); status.setAttribute('role', 'status');
  const fullscreen = button('fullscreen', 'Fullscreen', async () => {
    try {
      if (document.fullscreenElement === root) await document.exitFullscreen();
      else if (root.requestFullscreen) await root.requestFullscreen();
      else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
      else status.textContent = tr('fullscreenUnavailable', 'Fullscreen is unavailable on this device.');
    } catch { status.textContent = tr('fullscreenUnavailable', 'Fullscreen is unavailable on this device.'); }
  });
  controls.append(previous, play, next, mute, info, fullscreen);

  const details = node('details', 'catodo-tv-details'); details.hidden = true;
  const credits = node('div', 'catodo-tv-credits');
  const imageCredit = node('a', 'theatre-link'); imageCredit.target = '_blank'; imageCredit.rel = 'noopener noreferrer'; imageCredit.hidden = true;
  const setPoster = createVideoPoster(video, imageCredit, (name) => t('imageCredit', 'Image: {credit}', { credit: name }));
  details.append(node('summary', '', tr('credits', 'Source & credits')), credits, imageCredit);
  root.append(screen, controls, status, details);

  let order = [], cursor = -1, current = null, loading = null;
  const player = new TheatrePlayer({ video, beforePlay, onState(snapshot) {
    play.textContent = snapshot.playing ? tr('pause', 'Pause') : tr('play', 'Play');
    mute.textContent = snapshot.muted ? tr('unmute', 'Unmute') : tr('mute', 'Mute');
    status.textContent = snapshot.error === 'gesture' ? tr('gesture', 'Press Play to resume.')
      : snapshot.error ? tr('unavailable', 'This recording is unavailable. Try Play again or choose Next.') : '';
  } });

  function playCurrent() {
    return player.play(featuredPlaybackTitle(current.record), { consent: true, editionIndex: current.editionIndex });
  }
  function tune(delta) {
    if (!player.active || !order.length) return;
    const first = !current;
    cursor = (cursor + delta + order.length) % order.length;
    current = order[cursor];
    const { record, editionIndex } = current;
    setPoster(record);
    const edition = record.editions[editionIndex];
    programTitle.textContent = record.title;
    meta.textContent = [record.year || '', record.creators.join(' · ')].filter(Boolean).join(' · ');
    description.textContent = record.hook || record.synopsis || '';
    video.setAttribute('aria-label', record.title);
    idle.hidden = true; overlay.hidden = !showInfo;
    controls.hidden = false; details.hidden = false;
    previous.disabled = next.disabled = order.length < 2;
    const source = node('a', 'theatre-link', tr('source', 'Open on Internet Archive ↗'));
    source.href = edition.sourceUrl; source.target = '_blank'; source.rel = 'noopener noreferrer';
    credits.replaceChildren(source);
    if (record.license || record.attribution) credits.append(node('p', '', [record.license, record.attribution].filter(Boolean).join(' · ')));
    if (record.editionNote || record.rightsNote) credits.append(node('p', '', [record.editionNote, record.rightsNote].filter(Boolean).join(' ')));
    if (first) play.focus({ preventScroll: true });
    playCurrent();
  }

  function load() {
    if (loading || order.length) return;
    const options = { signal: events.signal };
    const compressed = typeof DecompressionStream === 'function' && !import.meta.env.DEV;
    start.disabled = true;
    intro.textContent = tr('loading', 'Loading the channel…');
    loading = Promise.all([
      loadCatalog ? loadCatalog() : loadFeaturedCatalog(options),
      loadTheatreJson('archive-recordings.json', { ...options, limit: 10_000_000, compressed }).then(prepareArchiveRecordings),
    ]).then(([featured, recordings]) => {
      order = shuffleTvPrograms(theatreTvPrograms(featured.records, recordings.records));
      if (!order.length) throw new Error('Empty TV lineup');
      intro.textContent = tr('intro', 'Shuffle {count} films and recordings from Internet Archive. Playback starts muted.', { count: order.length });
      start.textContent = tr('start', 'Start CATODO TV');
      start.disabled = false;
    }).catch((error) => {
      if (error.name === 'AbortError') return;
      intro.textContent = tr('failed', 'The channel could not load.');
      start.textContent = tr('retry', 'Retry channel');
      start.disabled = false;
    }).finally(() => { loading = null; });
  }

  video.addEventListener('ended', () => { if (video.ended) tune(1); }, eventOptions);
  root.addEventListener('keydown', (event) => {
    if (!current || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.repeat) return;
    if (event.key === 'ArrowLeft') tune(-1);
    else if (event.key === 'ArrowRight') tune(1);
    else return;
    event.preventDefault();
  }, eventOptions);
  previous.setAttribute('aria-keyshortcuts', 'ArrowLeft');
  next.setAttribute('aria-keyshortcuts', 'ArrowRight');

  return {
    root, video, player,
    setActive(active) { root.hidden = !active; player.setActive(active); setPoster(active ? current?.record : null); if (active) load(); },
    destroy() { setPoster(null); events.abort(); player.destroy(); },
  };
}
