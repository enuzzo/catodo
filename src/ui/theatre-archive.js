import { APP_VERSION } from '../version.js';
import { ARCHIVE_GENRES, ARCHIVE_PROVIDERS, archiveThumbnail, prepareArchiveIndex, selectArchivePage } from '../data/theatre-archive-model.js';

/** A paginated discovery catalog. Only the existing reviewed shelf can play. */
export function createTheatreArchive({ t, titles, onReviewed, fetchImpl = (...args) => fetch(...args) }) {
  const tr = (key, fallback, vars = {}) => t(`archiveCatalog.${key}`, fallback, vars);
  const node = (tag, className = '', text) => {
    const element = document.createElement(tag); element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const link = (label, href) => { const element = node('a', 'theatre-link', label); element.href = href; element.target = '_blank'; element.rel = 'noopener noreferrer'; return element; };
  const button = (label) => { const element = node('button', 'button button--ghost', label); element.type = 'button'; return element; };
  const root = node('section', 'theatre-archive'); root.hidden = true;
  root.setAttribute('aria-label', tr('title', 'Explore archives'));
  const events = new AbortController(); let data, loading, debounce, active = false, imagesAllowed = false;
  const state = { query: '', genre: '', source: '', rights: '', kind: '', decade: '', minVotes: '', minRating: '', sort: 'rating', page: 1 };
  const status = node('p', 'theatre-archive-status'); status.setAttribute('role', 'status');
  const retry = button(tr('retry', 'Retry catalog')); retry.hidden = true;
  const controls = node('div', 'theatre-archive-tools'); controls.hidden = true;
  const primary = node('div', 'theatre-archive-primary');
  const search = node('input', 'theatre-search'); search.type = 'search'; search.placeholder = tr('search', 'Search the whole archive…'); search.setAttribute('aria-label', search.placeholder);
  const select = (key, label, options, parent = primary) => {
    const element = node('select', 'theatre-select'); element.dataset.archiveFilter = key; element.setAttribute('aria-label', label);
    for (const [value, text] of options) { const option = node('option', '', text); option.value = value; element.append(option); }
    element.value = state[key];
    element.addEventListener('change', () => { state[key] = element.value; state.page = 1; render(); }, { signal: events.signal });
    parent.append(element); return element;
  };
  primary.append(search);
  select('genre', tr('category', 'Archive category'), [['', tr('allCategories', 'All categories')], ...Object.entries(ARCHIVE_GENRES).map(([key, label]) => [key, tr(`categories.${key}`, label)])]);
  const refine = node('details', 'theatre-archive-refine'); refine.append(node('summary', '', tr('refine', 'Source, rights & ratings')));
  const refinements = node('div', 'theatre-archive-filters');
  select('source', tr('source', 'Catalog source'), [['', tr('allSources', 'All three sources')], ...Object.entries(ARCHIVE_PROVIDERS)], refinements);
  select('rights', tr('rights', 'Rights information'), [['', tr('allRights', 'All rights information')], ['reviewed', tr('reviewed', 'Reviewed for Theatre')], ['cc', tr('cc', 'Creative Commons declared')], ['public-domain', tr('pd', 'Public domain declared')], ['public-domain-us', tr('pdUs', 'Public domain U.S. — directory')], ['unknown', tr('unknown', 'Rights not established')]], refinements);
  select('minRating', tr('minRating', 'Minimum Archive rating'), [['', tr('anyRating', 'Any rating')], ['3', '3+ / 5'], ['4', '4+ / 5'], ['4.5', '4.5+ / 5']], refinements);
  select('minVotes', tr('minVotes', 'Minimum review count'), [['', tr('anyVotes', 'Any review count')], ['3', '3+'], ['10', '10+'], ['25', '25+'], ['100', '100+']], refinements);
  select('decade', tr('decade', 'Film decade'), [['', tr('allYears', 'All decades')], ...Array.from({ length: 15 }, (_, index) => [String(1880 + index * 10), `${1880 + index * 10}s`]), ['unknown', tr('unknownYear', 'Year not listed')]], refinements);
  select('kind', tr('kind', 'Entry type'), [['', tr('allKinds', 'All entry types')], ['film', tr('film', 'Films & shorts')], ['episode', tr('episode', 'Episodes & serials')], ['trailer', tr('trailer', 'Trailers')], ['collection', tr('collection', 'Collections & guides')]], refinements);
  const reset = button(tr('reset', 'Reset filters')); refinements.append(reset);
  refine.append(refinements, node('p', 'theatre-archive-note', tr('ratingsNote', 'Archive stars rate a particular upload. Best rated balances stars with the number of reviews; these are not IMDb ratings.')));
  const meta = node('div', 'theatre-archive-meta');
  select('sort', tr('sort', 'Archive order'), [['rating', tr('bestRated', 'Best rated · weighted')], ['popular', tr('popular', 'Most downloaded')], ['title', tr('alphabetical', 'Title A–Z')], ['oldest', tr('oldest', 'Oldest first')], ['newest', tr('newest', 'Newest first')]], meta);
  const images = button(tr('showImages', 'Show source images')); images.setAttribute('aria-pressed', 'false');
  meta.append(images);
  const imageNote = node('p', 'theatre-archive-note', tr('imageConsent', 'Source images connect to Archive.org, Public Domain Movies or YouTube. Text-only browsing stays on CATODO.'));
  controls.append(primary, meta, refine);
  const results = node('p', 'theatre-archive-results'); results.setAttribute('role', 'status');
  const grid = node('div', 'theatre-grid theatre-archive-grid-results');
  const pagination = node('nav', 'theatre-archive-pagination'); pagination.setAttribute('aria-label', tr('pages', 'Archive pages')); pagination.hidden = true;
  const previous = button(tr('previous', 'Previous')), next = button(tr('next', 'Next'));
  const page = node('input', 'theatre-select'); page.type = 'number'; page.min = '1'; page.inputMode = 'numeric'; page.setAttribute('aria-label', tr('pageNumber', 'Page number'));
  const pageTotal = node('span'); pagination.append(previous, page, pageTotal, next);
  const about = node('details', 'theatre-archive-about'); about.append(node('summary', '', tr('about', 'About this index & its sources')));
  const aboutBody = node('div'); about.append(aboutBody);
  root.append(status, retry, controls, results, grid, pagination, about);

  function card(record) {
    const item = node('article', 'theatre-archive-card'); item.dataset.archiveId = record.id;
    const art = node('div', 'theatre-archive-art');
    art.append(node('span', 'theatre-archive-year', record.year ? String(record.year) : '—'), node('span', 'theatre-archive-type', tr(record.kind, record.kind)));
    const image = archiveThumbnail(record);
    if (image && (!image.remote || (imagesAllowed && active))) {
      const photo = node('img'); photo.alt = ''; photo.loading = 'lazy'; photo.decoding = 'async'; photo.referrerPolicy = 'no-referrer'; photo.src = image.src;
      photo.addEventListener('error', () => photo.remove(), { once: true }); art.append(photo);
    }
    const body = node('div', 'theatre-archive-card-body');
    body.append(node('p', 'theatre-card__year', record.genres.map((genre) => tr(`categories.${genre}`, ARCHIVE_GENRES[genre])).join(' · ')), node('h3', '', record.title));
    if (record.creators.length) body.append(node('p', 'theatre-card__creator', record.creators.join(' · ')));
    const synopsis = record.reviewed?.synopsis || tr('entryContext', '{year} · {kind}. {languages} Read the synopsis and edition notes on the source page.', { year: record.year || tr('unknownYear', 'Year not listed'), kind: tr(record.kind, record.kind), languages: record.languages.join(' / ') });
    body.append(node('p', 'theatre-card__synopsis', synopsis));
    const rating = record.rating ? tr('rating', '★ {stars}/5 · {votes} Archive reviews', { stars: record.rating.value.toFixed(1), votes: record.rating.count.toLocaleString('en') }) : tr('unrated', 'No Archive reviews listed');
    body.append(node('p', 'theatre-archive-rating', rating));
    const rights = record.reviewed ? tr('reviewedCopy', 'Reviewed edition available in Theatre') : record.rights.label || tr('unknown', 'Rights not established');
    body.append(node('p', 'theatre-archive-rights', rights));
    if (record.rights.url && !record.reviewed) body.append(link(tr('declaredLicense', 'Declared license ↗'), record.rights.url));
    const sources = node('div', 'theatre-archive-card-links');
    for (const source of record.sources) sources.append(link(`${ARCHIVE_PROVIDERS[source.provider]} ↗`, source.url));
    if (record.archiveId && !record.sources.some((source) => source.provider === 'archive')) sources.append(link('Internet Archive ↗', `https://archive.org/details/${record.archiveId}`));
    if (record.reviewed) {
      const play = button(tr('openReviewed', 'Open reviewed film')); play.dataset.reviewedId = record.reviewed.id; sources.prepend(play);
    }
    body.append(sources); item.append(art, body);
    if (image) item.append(link(tr('imageCredit', 'Image source: {source}', { source: image.credit }), image.sourceUrl));
    return item;
  }
  function render() {
    if (!data) return;
    const selection = selectArchivePage(data.records, state); state.page = selection.page;
    results.textContent = tr('results', '{count} entries · page {page} of {pages}', { count: selection.total.toLocaleString('en'), page: selection.page, pages: selection.pages.toLocaleString('en') });
    grid.replaceChildren(...selection.records.map(card));
    previous.disabled = selection.page === 1; next.disabled = selection.page === selection.pages;
    page.value = String(selection.page); page.max = String(selection.pages); pageTotal.textContent = `/ ${selection.pages.toLocaleString('en')}`;
    pagination.hidden = selection.total === 0;
  }
  async function load() {
    if (data || loading) return loading;
    status.textContent = tr('loading', 'Loading the archive index…'); retry.hidden = true;
    loading = (async () => {
      try {
        const compressed = typeof DecompressionStream === 'function' && !import.meta.env.DEV;
        const url = `./theatre/archive-index.json${compressed ? '.gz' : ''}?v=${encodeURIComponent(APP_VERSION)}`;
        let response = await fetchImpl(url, { signal: events.signal });
        if (compressed && response.status === 404) response = await fetchImpl(`./theatre/archive-index.json?v=${encodeURIComponent(APP_VERSION)}`, { signal: events.signal });
        if (!response.ok || Number(response.headers.get('content-length')) > 30_000_000) throw new Error('Catalog unavailable');
        const bytes = new Uint8Array(await response.arrayBuffer()); if (bytes.length > 30_000_000) throw new Error('Catalog too large');
        // Some hosts apply Content-Encoding themselves; only decode gzip magic.
        const content = bytes[0] === 31 && bytes[1] === 139
          ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
          : new TextDecoder().decode(bytes);
        if (content.length > 30_000_000) throw new Error('Catalog too large');
        data = prepareArchiveIndex(JSON.parse(content), titles); controls.hidden = false;
        status.textContent = tr('coverage', '{count} indexed entries · {date}', { count: data.records.length.toLocaleString('en'), date: data.manifest.generatedAt.slice(0, 10) });
        aboutBody.append(imageNote, node('p', '', tr('rightsNote', 'This is a discovery index. Directory membership and uploader license labels do not approve an edition for Theatre. Source links open the original sites; only reviewed editions have an in-app film button.')),
          node('p', '', tr('scopeNote', 'The index includes Archive’s feature_films collection and the direct entries in the two directories. Linked collections remain single collection entries; similar titles can be different editions. Years and categories follow source metadata.')));
        for (const source of data.manifest.sources) aboutBody.append(link(`${source.name}: ${data.manifest.sourceCounts[source.id].toLocaleString('en')}`, source.url));
        render();
      } catch (error) {
        if (error.name !== 'AbortError') { status.textContent = tr('failed', 'The archive index could not load. Your reviewed films are still available.'); retry.hidden = false; }
      } finally { loading = null; }
    })();
    return loading;
  }
  search.addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(() => { state.query = search.value; state.page = 1; render(); }, 180); }, { signal: events.signal });
  grid.addEventListener('click', (event) => {
    const id = event.target.closest('[data-reviewed-id]')?.dataset.reviewedId;
    const title = titles.find((item) => item.id === id && item.decision === 'usable');
    if (title) onReviewed(title);
  }, { signal: events.signal });
  images.addEventListener('click', () => { imagesAllowed = !imagesAllowed; images.setAttribute('aria-pressed', String(imagesAllowed)); images.textContent = imagesAllowed ? tr('hideImages', 'Hide source images') : tr('showImages', 'Show source images'); render(); }, { signal: events.signal });
  reset.addEventListener('click', () => {
    for (const key of Object.keys(state)) state[key] = key === 'page' ? 1 : key === 'sort' ? 'rating' : '';
    clearTimeout(debounce); search.value = ''; controls.querySelectorAll('[data-archive-filter]').forEach((select) => { select.value = state[select.dataset.archiveFilter]; }); render();
  }, { signal: events.signal });
  function go(value) { state.page = value; render(); controls.scrollIntoView({ block: 'start', behavior: 'instant' }); }
  previous.addEventListener('click', () => go(state.page - 1), { signal: events.signal });
  next.addEventListener('click', () => go(state.page + 1), { signal: events.signal });
  page.addEventListener('change', () => go(page.value), { signal: events.signal });
  retry.addEventListener('click', load, { signal: events.signal });
  return {
    root,
    setActive(value) { active = value; root.hidden = !value; if (value) { if (data) render(); else load(); } },
    destroy() { clearTimeout(debounce); events.abort(); },
  };
}
