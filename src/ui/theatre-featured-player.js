import { TheatrePlayer } from '../player/theatre-player.js';
import { featuredPlaybackTitle } from '../data/theatre-featured-model.js';
import { theatreTime } from '../data/theatre-model.js';

/** One persistent video for Featured; shelf filtering and credits never retune it. */
export function createFeaturedPlayer({ t, beforePlay, onDetails }) {
  const node = (tag, cls = '', text = '') => { const el = document.createElement(tag); el.className = cls; el.textContent = text; return el; };
  const button = (key, fallback, action) => { const el = node('button', 'button button--ghost', t(key, fallback)); el.type = 'button'; el.addEventListener('click', action, { signal: events.signal }); return el; };
  const events = new AbortController();
  const root = node('section', 'theatre-featured-player'); root.hidden = true; root.setAttribute('aria-label', t('playerLabel', 'Featured film player'));
  const video = node('video', 'theatre-featured-video'); video.controls = true; video.preload = 'none'; video.playsInline = true; video.muted = true;
  video.setAttribute('aria-label', t('playerLabel', 'Featured film player'));
  const info = node('div', 'theatre-featured-player-info'), title = node('h2'), meta = node('p', 'theatre-meta');
  const controls = node('div', 'theatre-controls');
  const status = node('p', 'theatre-status'); status.setAttribute('role', 'status');
  let record, editionIndex = 0;
  const player = new TheatrePlayer({ video, beforePlay, onState(snapshot) {
    toggle.textContent = snapshot.playing ? t('pause', 'Pause') : t('play', 'Play film');
    toggle.setAttribute('aria-pressed', String(snapshot.playing));
    mute.textContent = snapshot.muted ? t('unmute', 'Unmute') : t('mute', 'Mute');
    status.textContent = snapshot.error === 'gesture' ? t('gesture', 'Press Play to start this film.')
      : snapshot.error ? t('unavailable', 'This source is unavailable. Retry or report the problem in the film details.') : '';
  } });
  async function start(next) {
    if (!featuredPlaybackTitle(next)) return false;
    if (record?.id !== next.id) { player.clear(); editionIndex = 0; }
    record = next; root.hidden = false;
    title.textContent = record.title; video.setAttribute('aria-label', `${t('playerLabel', 'Featured film player')}: ${record.title}`);
    meta.textContent = [record.year, record.creators.join(' · '), theatreTime(record.editions[editionIndex].duration)].filter(Boolean).join(' / ');
    editions.replaceChildren(...record.editions.map((edition, index) => { const option = node('option', '', edition.label); option.value = index; return option; }));
    editions.value = editionIndex; editions.hidden = record.editions.length < 2;
    root.scrollIntoView({ block: 'start', behavior: 'instant' });
    return player.play(featuredPlaybackTitle(record), { consent: true, editionIndex });
  }
  const toggle = button('play', 'Play film', () => { if (!video.paused) player.pause(); else if (record) start(record); });
  const mute = button('unmute', 'Unmute', () => { video.muted = !video.muted; });
  const fullscreen = button('fullscreen', 'Fullscreen', async () => {
    try { if (video.requestFullscreen) await video.requestFullscreen(); else video.webkitEnterFullscreen?.(); }
    catch { status.textContent = t('fullscreenUnavailable', 'Use the video controls to enter fullscreen.'); }
  });
  const details = button('details', 'Source, credits & viewing notes', () => { if (record) onDetails(record, details); });
  const close = button('closePlayer', 'Close player', () => { player.clear(); root.hidden = true; });
  const editions = node('select', 'theatre-select'); editions.setAttribute('aria-label', t('edition', 'Featured edition'));
  editions.addEventListener('change', () => { editionIndex = Number(editions.value); player.clear(); start(record); }, { signal: events.signal });
  controls.append(toggle, mute, fullscreen, details, close); info.append(title, meta, editions, controls, status); root.append(video, info);
  return { root, video, player, play: start, setActive(value) { player.setActive(value); }, destroy() { events.abort(); player.destroy(); } };
}
