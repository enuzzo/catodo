import { APP_VERSION } from '../version.js';
import { prepareFeatured, selectFeatured } from '../data/theatre-featured-model.js';

/** Complete editorial selection, with external sources and no unreviewed player admission. */
export function createTheatreFeatured({ t, fetchImpl = (...args) => fetch(...args) }) {
  const tr = (key, fallback, vars = {}) => t(`featured.${key}`, fallback, vars);
  const node = (tag, cls = '', text) => { const el = document.createElement(tag); el.className = cls; if (text !== undefined) el.textContent = text; return el; };
  const button = (text, cls = 'button button--ghost') => { const el = node('button', cls, text); el.type = 'button'; return el; };
  const link = (text, url) => { const el = node('a', 'theatre-link', text); el.href = url; el.target = '_blank'; el.rel = 'noopener noreferrer'; return el; };
  const root = node('section', 'theatre-featured'); root.hidden = true;
  root.setAttribute('aria-label', tr('title', 'Featured'));
  const events = new AbortController();
  let data, loading, active = false, imagesAllowed = false, opener, debounce;
  const state = { query: '', collection: '', genre: '', language: '', sort: 'editorial', page: 1 };
  const header = node('div', 'theatre-featured-header');
  const heading = node('h2', '', tr('heading', 'A different kind of movie night.'));
  header.append(heading, node('p', 'theatre-lead', tr('lead', 'Silent inventions, midnight monsters and futures that never arrived. An editorial journey through 305 films and archive discoveries.')));
  const status = node('p', 'theatre-archive-status'); status.setAttribute('role', 'status');
  const retry = button(tr('retry', 'Retry selection')); retry.hidden = true;
  const tools = node('div', 'theatre-featured-tools'); tools.hidden = true;
  const search = node('input', 'theatre-search'); search.type = 'search'; search.placeholder = tr('search', 'Search films, filmmakers, stories…'); search.setAttribute('aria-label', search.placeholder);
  const selects = {};
  function select(key, label, options) {
    const el = node('select', 'theatre-select'); el.setAttribute('aria-label', label); el.dataset.featuredFilter = key;
    for (const [value, text] of options) { const option = node('option', '', text); option.value = value; el.append(option); }
    el.addEventListener('change', () => { state[key] = el.value; state.page = 1; render(); }, { signal: events.signal });
    selects[key] = el; return el;
  }
  tools.append(search);
  const collection = select('collection', tr('collection', 'Featured collection'), [['', tr('allCollections', 'All collections')]]);
  const genre = select('genre', tr('genre', 'Featured genre'), [['', tr('allGenres', 'All genres')]]);
  const language = select('language', tr('language', 'Featured language'), [['', tr('allLanguages', 'All languages')]]);
  const sort = select('sort', tr('order', 'Featured order'), [['editorial', tr('editorial', 'Editorial order')], ['newest', tr('newest', 'Newest first')], ['oldest', tr('oldest', 'Oldest first')], ['title', tr('alphabetical', 'Title A–Z')]]);
  tools.append(collection, genre, language, sort);
  const meta = node('div', 'theatre-featured-meta');
  const results = node('p', 'theatre-archive-results'); results.setAttribute('role', 'status');
  const images = button(tr('showImages', 'Show source images')); images.setAttribute('aria-pressed', 'false');
  const reset = button(tr('reset', 'Reset filters'));
  meta.append(results, images, reset); meta.hidden = true;
  const collectionNote = node('p', 'theatre-featured-collection-note'); collectionNote.hidden = true;
  const note = node('p', 'theatre-archive-note', tr('sourceNote', 'Explore each film on its source site. Editions and international availability vary; viewing notes explain what has been checked. Source images load only when enabled.'));
  const grid = node('div', 'theatre-grid theatre-featured-grid');
  const empty = node('p', 'theatre-empty', tr('empty', 'No films match. Try another collection or reset the filters.')); empty.hidden = true;
  const pagination = node('nav', 'theatre-archive-pagination'); pagination.setAttribute('aria-label', tr('pages', 'Featured pages')); pagination.hidden = true;
  const previous = button(tr('previous', 'Previous')), next = button(tr('next', 'Next')), pageLabel = node('span');
  pagination.append(previous, pageLabel, next);
  const dialog = node('dialog', 'theatre-credits-dialog theatre-featured-dialog'); dialog.setAttribute('aria-labelledby', 'featured-detail-title');
  const dialogHeader = node('header', 'theatre-credits__header'), dialogTitle = node('h2'); dialogTitle.id = 'featured-detail-title';
  const close = button('×', 'icon-button theatre-credits__close'); close.setAttribute('aria-label', tr('close', 'Close film details')); close.autofocus = true;
  const body = node('div', 'theatre-featured-detail'); dialogHeader.append(dialogTitle, close); dialog.append(dialogHeader, body);
  root.append(header, status, retry, tools, collectionNote, meta, grid, empty, pagination, note, dialog);

  function cover(record) {
    const art = node('div', 'theatre-featured-art');
    art.dataset.tone = String(record.rank % 5);
    art.append(node('span', 'theatre-featured-year', record.year || '—'), node('span', 'theatre-featured-art-title', record.title));
    if (imagesAllowed && active && record.image) {
      const photo = node('img'); photo.alt = ''; photo.loading = 'lazy'; photo.decoding = 'async'; photo.referrerPolicy = 'no-referrer'; photo.src = record.image.url;
      photo.addEventListener('load', () => photo.classList.add('is-ready'), { once: true });
      photo.addEventListener('error', () => photo.remove(), { once: true }); art.append(photo);
    }
    return art;
  }
  function show(record, trigger) {
    opener = trigger; dialogTitle.textContent = record.title;
    const copy = node('div', 'theatre-featured-detail-copy');
    copy.append(node('p', 'theatre-meta', [record.year, ...record.creators].filter(Boolean).join(' · ')), node('p', '', record.synopsis));
    if (record.contentNote) copy.append(node('p', 'theatre-featured-context', record.contentNote));
    const sources = node('div', 'theatre-featured-sources');
    if (record.sourceUrl) sources.append(link(tr('openSource', 'Explore film at source ↗'), record.sourceUrl));
    copy.append(sources, node('h3', '', tr('viewingNotes', 'Edition & viewing notes')), node('p', '', record.editionNote));
    const rights = node('details', 'theatre-featured-rights'); rights.append(node('summary', '', tr('rights', 'International rights & sources')));
    rights.append(node('p', '', record.rightsNote), node('p', '', tr('notCleared', 'This research entry is not an approval for worldwide in-app playback.')));
    record.rightsSources.forEach((url) => rights.append(link(new URL(url).hostname, url)));
    copy.append(rights);
    const visual = node('div', 'theatre-featured-detail-art'); visual.append(cover(record));
    if (imagesAllowed && record.image) visual.append(link(tr('imageCredit', 'Image: {credit}', { credit: record.image.credit }), record.image.sourceUrl));
    body.replaceChildren(visual, copy); dialog.showModal(); body.scrollTop = 0;
  }
  function card(record) {
    const item = node('article', 'theatre-featured-card'); item.dataset.featuredId = record.id;
    const open = button('', 'theatre-featured-card-open'); open.setAttribute('aria-label', tr('detailsFor', 'Read about {title}', { title: record.title }));
    const copy = node('div', 'theatre-featured-card-copy');
    copy.append(node('p', 'theatre-card__year', `${record.year || '—'} / ${record.genres.slice(0, 2).map((g) => t(`filters.${g}`, g)).join(' · ')}`), node('h3', '', record.title), node('p', 'theatre-card__creator', record.creators.join(' · ')), node('p', 'theatre-featured-hook', record.hook || record.synopsis));
    open.append(cover(record), copy); open.addEventListener('click', () => show(record, open), { signal: events.signal });
    const footer = node('div', 'theatre-featured-card-footer');
    if (record.sourceUrl) footer.append(link(tr('source', 'Source ↗'), record.sourceUrl));
    if (imagesAllowed && record.image) footer.append(link(tr('imageCredit', 'Image: {credit}', { credit: record.image.credit }), record.image.sourceUrl));
    item.append(open, footer); return item;
  }
  function render() {
    if (!data) return;
    const selected = selectFeatured(data.records, state); state.page = selected.page;
    results.textContent = tr('results', '{count} selections · {page} / {pages}', { count: selected.total, page: selected.page, pages: selected.pages });
    collectionNote.textContent = data.collections.find((c) => c.id === state.collection)?.description || ''; collectionNote.hidden = !collectionNote.textContent;
    grid.replaceChildren(...selected.records.map(card)); empty.hidden = selected.total > 0;
    previous.disabled = selected.page <= 1; next.disabled = selected.page >= selected.pages;
    pageLabel.textContent = `${selected.page} / ${selected.pages}`; pagination.hidden = selected.pages <= 1;
  }
  async function load() {
    if (data || loading) return loading;
    status.textContent = tr('loading', 'Loading the Featured selection…'); retry.hidden = true;
    loading = (async () => {
      try {
        const response = await fetchImpl(`./theatre/featured-research.json?v=${encodeURIComponent(APP_VERSION)}`, { signal: events.signal });
        if (!response.ok || Number(response.headers.get('content-length')) > 2_000_000) throw new Error('Featured unavailable');
        const text = await response.text(); if (text.length > 2_000_000) throw new Error('Featured too large');
        data = prepareFeatured(JSON.parse(text));
        const add = (el, value, label) => { const option = node('option', '', label); option.value = value; el.append(option); };
        data.collections.forEach((c) => add(collection, c.id, c.title));
        [...new Set(data.records.flatMap((r) => r.genres))].sort().forEach((g) => add(genre, g, t(`filters.${g}`, g.charAt(0).toUpperCase() + g.slice(1))));
        [...new Set(data.records.flatMap((r) => r.languages))].sort().forEach((lang) => { let name = lang; try { name = new Intl.DisplayNames(['en'], { type: 'language' }).of(lang); } catch { /* Preserve source code. */ } add(language, lang, name); });
        tools.hidden = false; meta.hidden = false; status.textContent = ''; render();
      } catch (error) { if (error.name !== 'AbortError') { status.textContent = tr('failed', 'Featured is temporarily unavailable. Try again or browse Curated films.'); retry.hidden = false; } }
      finally { loading = null; }
    })(); return loading;
  }
  search.addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(() => { state.query = search.value; state.page = 1; render(); }, 160); }, { signal: events.signal });
  images.addEventListener('click', () => { imagesAllowed = !imagesAllowed; images.setAttribute('aria-pressed', String(imagesAllowed)); images.textContent = imagesAllowed ? tr('hideImages', 'Hide source images') : tr('showImages', 'Show source images'); render(); }, { signal: events.signal });
  reset.addEventListener('click', () => { clearTimeout(debounce); Object.assign(state, { query: '', collection: '', genre: '', language: '', sort: 'editorial', page: 1 }); search.value = ''; Object.entries(selects).forEach(([key, el]) => { el.value = state[key]; }); render(); }, { signal: events.signal });
  function go(delta) { state.page += delta; render(); tools.scrollIntoView({ block: 'start', behavior: 'instant' }); }
  previous.addEventListener('click', () => go(-1), { signal: events.signal }); next.addEventListener('click', () => go(1), { signal: events.signal });
  retry.addEventListener('click', load, { signal: events.signal }); close.addEventListener('click', () => dialog.close(), { signal: events.signal });
  const outside = (event) => { const b = dialog.getBoundingClientRect(); return event.target === dialog && (event.clientX < b.left || event.clientX > b.right || event.clientY < b.top || event.clientY > b.bottom); };
  let backdropPress = false;
  dialog.addEventListener('pointerdown', (event) => { backdropPress = outside(event); }, { signal: events.signal });
  dialog.addEventListener('click', (event) => { if (backdropPress && outside(event)) dialog.close(); backdropPress = false; }, { signal: events.signal });
  dialog.addEventListener('close', () => { if (active && opener?.isConnected) opener.focus({ preventScroll: true }); }, { signal: events.signal });
  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const list = [...dialog.querySelectorAll('button, a[href], summary')].filter((el) => el.getClientRects().length);
    if (event.shiftKey && document.activeElement === list[0]) { event.preventDefault(); list.at(-1)?.focus(); }
    else if (!event.shiftKey && document.activeElement === list.at(-1)) { event.preventDefault(); list[0]?.focus(); }
  }, { signal: events.signal });
  return { root, setActive(value) { active = value; root.hidden = !value; if (!value && dialog.open) dialog.close(); if (value) { if (data) render(); else load(); } }, destroy() { clearTimeout(debounce); if (dialog.open) dialog.close(); events.abort(); } };
}
