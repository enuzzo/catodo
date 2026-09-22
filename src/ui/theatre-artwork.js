/** Local artwork only. Two visible thumbnails may move; hidden views do no work. */
export function createTheatreArtwork({ root, creditLabel }) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const connection = navigator.connection;
  let active = false, enabled = true, playing = false, timer;
  let entries = [];
  const visible = new Set();
  const events = new AbortController();
  const observer = new IntersectionObserver((changes) => {
    for (const change of changes) {
      if (change.isIntersecting && change.intersectionRatio >= .6) visible.add(change.target);
      else visible.delete(change.target);
    }
    sync();
  }, { root, threshold: [0, .6] });

  function eligible() {
    return active && enabled && !playing && !document.hidden && !reduced.matches && !connection?.saveData;
  }
  function sync() {
    const moving = eligible() ? entries.filter((entry) => visible.has(entry.art)).slice(0, 2) : [];
    for (const entry of entries) {
      const animate = moving.includes(entry);
      entry.art.classList.toggle('is-moving', animate);
      if (!animate) entry.generation++;
    }
    if (moving.length && !timer) timer = window.setInterval(advance, 8000);
    else if (!moving.length && timer) { clearInterval(timer); timer = undefined; }
  }
  async function advance() {
    for (const entry of entries.filter((item) => item.art.classList.contains('is-moving'))) {
      const generation = ++entry.generation;
      const index = (entry.index + 1) % entry.gallery.length;
      const artwork = entry.gallery[index];
      const next = new Image();
      next.decoding = 'async'; next.src = artwork.src;
      try { await next.decode(); } catch { continue; }
      if (generation !== entry.generation || !eligible() || !visible.has(entry.art)) continue;
      const incoming = entry.frames[1 - entry.front], outgoing = entry.frames[entry.front];
      incoming.src = artwork.src; incoming.width = artwork.width; incoming.height = artwork.height;
      incoming.classList.add('is-front'); outgoing.classList.remove('is-front');
      entry.front = 1 - entry.front; entry.index = index;
      entry.credit.textContent = creditLabel(artwork.credit); entry.credit.href = artwork.sourceUrl;
    }
  }
  function clear() {
    clearInterval(timer); timer = undefined; observer.disconnect(); visible.clear();
    entries.forEach((entry) => { entry.generation++; }); entries = [];
  }
  reduced.addEventListener('change', sync, { signal: events.signal });
  connection?.addEventListener('change', sync, { signal: events.signal });
  document.addEventListener('visibilitychange', sync, { signal: events.signal });
  return {
    add(art, photo, credit, title) {
      // ND excerpts remain complete, static frames. No extra remote media is requested.
      const gallery = [title.artwork, ...(title.artworks || [])];
      if (gallery.length < 2 || gallery.some((image) => !image.motionAllowed)) return;
      const second = document.createElement('img'); second.alt = ''; second.className = 'theatre-card__image';
      second.decoding = 'async'; art.append(second); photo.classList.add('is-front'); art.classList.add('has-gallery');
      entries.push({ art, frames: [photo, second], credit, gallery, front: 0, index: 0, generation: 0 }); observer.observe(art);
    },
    clear,
    setActive(value) { active = value; sync(); },
    setEnabled(value) { enabled = value; sync(); },
    setPlaying(value) { playing = value; sync(); },
    destroy() { clear(); events.abort(); },
  };
}
