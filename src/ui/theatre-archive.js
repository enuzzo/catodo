import { loadTheatreJson } from '../data/theatre-json.js';
import { ARCHIVE_GENRES, ARCHIVE_PROVIDERS, archiveThumbnail, prepareArchiveIndex, prepareArchiveRecordings, selectArchivePage } from '../data/theatre-archive-model.js';

/** A paginated source index with exact links to enabled film editions. */
export function createTheatreArchive({ t, titles, loadTitles, onReviewed, fetchImpl = (...args) => fetch(...args) }) {
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
  const events = new AbortController(); let data, loading, debounce, active = false;
  let playableTitles = titles;
  let lastOpenedRecord;
  const defaults = { query: '', genre: '', source: '', rights: '', kind: '', decade: '', minVotes: '', minRating: '', playableOnly: false, sort: 'editorial', page: 1 };
  const state = { ...defaults };
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
  select('source', tr('source', 'Catalog source'), [['', tr('allSources', 'All sources')], ...Object.entries(ARCHIVE_PROVIDERS)], refinements);
  select('rights', tr('rights', 'Rights information'), [['', tr('allRights', 'All rights information')], ['cc', tr('cc', 'Creative Commons declared')], ['public-domain', tr('pd', 'Public domain declared')], ['public-domain-us', tr('pdUs', 'Public domain U.S. — directory')], ['unknown', tr('unknown', 'Rights not established')]], refinements);
  select('minRating', tr('minRating', 'Minimum Archive rating'), [['', tr('anyRating', 'Any rating')], ['3', '3+ / 5'], ['4', '4+ / 5'], ['4.5', '4.5+ / 5']], refinements);
  select('minVotes', tr('minVotes', 'Minimum review count'), [['', tr('anyVotes', 'Any review count')], ['3', '3+'], ['10', '10+'], ['25', '25+'], ['100', '100+']], refinements);
  select('decade', tr('decade', 'Film decade'), [['', tr('allYears', 'All decades')], ...Array.from({ length: 15 }, (_, index) => [String(1880 + index * 10), `${1880 + index * 10}s`]), ['unknown', tr('unknownYear', 'Year not listed')]], refinements);
  select('kind', tr('kind', 'Entry type'), [['', tr('allKinds', 'All entry types')], ['film', tr('film', 'Films & shorts')], ['episode', tr('episode', 'Episodes & serials')], ['trailer', tr('trailer', 'Trailers')], ['collection', tr('collection', 'Collections & guides')], ['recording', tr('recording', 'TV & archive recordings')]], refinements);
  const reset = button(tr('reset', 'Reset filters')); refinements.append(reset);
  refine.append(refinements, node('p', 'theatre-archive-note', tr('ratingsNote', 'Archive stars rate a particular upload. Best rated balances stars with the number of reviews; these are not IMDb ratings.')));
  select('sort', tr('sort', 'Archive order'), [['editorial', tr('editorial', 'Editorial order')], ['rating', tr('bestRated', 'Best rated · weighted')], ['popular', tr('popular', 'Most downloaded')], ['title', tr('alphabetical', 'Title A–Z')], ['oldest', tr('oldest', 'Oldest first')], ['newest', tr('newest', 'Newest first')]]);
  const playable = button(tr('reviewed', 'Available in Theatre')); playable.setAttribute('aria-pressed', 'false');
  controls.append(primary, playable, refine);
  const results = node('p', 'theatre-archive-results'); results.setAttribute('role', 'status');
  const clearResults = button(tr('reset', 'Reset filters')); clearResults.hidden = true;
  const grid = node('div', 'theatre-grid theatre-archive-grid-results');
  const pagination = node('nav', 'theatre-archive-pagination'); pagination.setAttribute('aria-label', tr('pages', 'Archive pages')); pagination.hidden = true;
  const previous = button(tr('previous', 'Previous')), next = button(tr('next', 'Next'));
  const page = node('input', 'theatre-select'); page.type = 'number'; page.min = '1'; page.inputMode = 'numeric'; page.setAttribute('aria-label', tr('pageNumber', 'Page number'));
  const pageTotal = node('span'); pagination.append(previous, page, pageTotal, next);
  const about = node('details', 'theatre-archive-about'); about.append(node('summary', '', tr('about', 'About this index & its sources')));
  const aboutBody = node('div'); about.append(aboutBody);
  root.append(status, retry, controls, results, clearResults, grid, pagination, about);

  function card(record) {
    const item = node('article', 'theatre-archive-card'); item.dataset.archiveId = record.id;
    const source = record.sources.find((entry) => entry.provider === 'archive') || record.sources[0];
    const primary = record.reviewed ? button(record.title) : link(record.title, source.url);
    primary.className = 'theatre-archive-card-open';
    if (record.reviewed) {
      primary.dataset.reviewedId = record.reviewed.id;
      primary.dataset.edition = record.editionIndex;
    }
    const destination = record.reviewed ? tr('openInTheatre', 'Open in Theatre')
      : tr('openAtSource', 'Open on {source}', { source: ARCHIVE_PROVIDERS[source.provider] });
    primary.setAttribute('aria-label', `${record.title} · ${destination}`);
    const art = node('div', 'theatre-archive-art');
    if (record.year) art.append(node('span', 'theatre-archive-year', String(record.year)));
    art.append(node('span', 'theatre-archive-type', tr(record.kind, record.kind)));
    const image = archiveThumbnail(record);
    let imageCredit;
    if (image) {
      imageCredit = link(tr('imageCredit', 'Image source: {source}', { source: image.credit }), image.sourceUrl);
      imageCredit.hidden = true;
      const photo = node('img'); photo.alt = ''; photo.loading = 'lazy'; photo.decoding = 'async'; photo.referrerPolicy = 'no-referrer';
      art.classList.add('has-image');
      photo.addEventListener('load', () => { photo.classList.add('is-ready'); imageCredit.hidden = false; }, { once: true });
      photo.addEventListener('error', () => { photo.remove(); art.classList.remove('has-image'); }, { once: true });
      photo.src = image.src; art.append(photo);
    }
    const cue = node('span', 'theatre-archive-destination', destination);
    const arrow = node('i', record.reviewed ? 'ph ph-arrow-right' : 'ph ph-arrow-up-right');
    cue.setAttribute('aria-hidden', 'true'); cue.append(arrow);
    const body = node('div', 'theatre-archive-card-body');
    const heading = node('h3'); heading.append(primary);
    const genres = record.genres.filter((genre) => genre !== 'unclassified').map((genre) => tr(`categories.${genre}`, ARCHIVE_GENRES[genre]));
    if (genres.length || record.languages.length) body.append(node('p', 'theatre-card__year', [...genres, ...record.languages].join(' · ')));
    body.append(heading, cue);
    if (record.creators.length) body.append(node('p', 'theatre-card__creator', record.creators.join(' · ')));
    const synopsis = record.editorial?.note || record.reviewed?.synopsis;
    if (synopsis) body.append(node('p', 'theatre-card__synopsis', synopsis));
    if (record.rating) body.append(node('p', 'theatre-archive-rating', tr('rating', '★ {stars}/5 · {votes} Archive reviews', { stars: record.rating.value.toFixed(1), votes: record.rating.count.toLocaleString('en') })));
    const rights = record.rights.label || tr('unknown', 'Rights not established');
    body.append(node('p', 'theatre-archive-rights', rights));
    if (record.rights.url) body.append(link(tr('declaredLicense', 'Declared license ↗'), record.rights.url));
    const sources = node('div', 'theatre-archive-card-links');
    for (const alternate of record.sources) {
      if (record.reviewed || alternate.url !== source.url) sources.append(link(`${ARCHIVE_PROVIDERS[alternate.provider]} ↗`, alternate.url));
    }
    if (record.archiveId && !record.sources.some((source) => source.provider === 'archive')) sources.append(link('Internet Archive ↗', `https://archive.org/details/${record.archiveId}`));
    body.append(sources); item.append(art, body);
    if (imageCredit) item.append(imageCredit);
    return item;
  }
  function render() {
    if (!data || !active) return;
    const selection = selectArchivePage(data.records, state); state.page = selection.page;
    const count = selection.total.toLocaleString('en');
    const scope = selection.total === data.records.length ? tr('entryCount', '{count} entries', { count })
      : tr('filteredCount', '{count} of {total} entries', { count, total: data.records.length.toLocaleString('en') });
    results.textContent = selection.total ? scope : tr('noMatches', 'No archive entries match this search.');
    if (selection.pages > 1) results.textContent += ' · ' + tr('pageOf', 'page {page} of {pages}', { page: selection.page, pages: selection.pages.toLocaleString('en') });
    clearResults.hidden = selection.total > 0;
    playable.setAttribute('aria-pressed', String(state.playableOnly));
    grid.replaceChildren(...selection.records.map(card));
    previous.disabled = selection.page === 1; next.disabled = selection.page === selection.pages;
    page.value = String(selection.page); page.max = String(selection.pages); pageTotal.textContent = `/ ${selection.pages.toLocaleString('en')}`;
    pagination.hidden = selection.pages <= 1;
  }
  async function load() {
    if (loading) return loading;
    status.textContent = tr('loading', 'Loading the archive index…'); status.hidden = false; retry.hidden = true;
    loading = (async () => {
      try {
        const compressed = typeof DecompressionStream === 'function' && !import.meta.env.DEV;
        const options = { signal: events.signal, fetchImpl };
        const [index, recordings, playable] = await Promise.all([
          loadTheatreJson('archive-index.json', { ...options, limit: 30_000_000, compressed }),
          loadTheatreJson('archive-recordings.json', { ...options, limit: 10_000_000, compressed }).then(prepareArchiveRecordings).catch(() => null),
          loadTitles ? loadTitles().catch(() => titles) : titles,
        ]);
        playableTitles = playable;
        data = prepareArchiveIndex(index, playableTitles, recordings?.records); controls.hidden = false;
        status.hidden = Boolean(recordings);
        if (!recordings) {
          status.textContent = tr('recordingsUnavailable', 'Additional recordings unavailable');
          retry.hidden = false;
        }
        aboutBody.replaceChildren();
        aboutBody.append(node('p', '', tr('rightsNote', 'This is a discovery index. Directory membership and uploader license labels do not approve an edition for Theatre. Cards open in Theatre when there is a matching film edition. All other cards open their source in a new tab.')),
          node('p', '', tr('scopeNote', 'The index includes Archive’s feature_films collection together with additional Archive recordings and the direct entries in the two directories. Linked collections remain single collection entries; similar titles can be different editions. Years and categories follow source metadata.')));
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
    const target = event.target.closest('[data-reviewed-id]');
    if (!target) return;
    const title = playableTitles.find((item) => item.id === target.dataset.reviewedId);
    if (title) {
      lastOpenedRecord = target.closest('[data-archive-id]').dataset.archiveId;
      onReviewed(title, Number(target.dataset.edition));
    }
  }, { signal: events.signal });
  playable.addEventListener('click', () => { state.playableOnly = !state.playableOnly; state.page = 1; render(); }, { signal: events.signal });
  function searchAll(query = '') {
    clearTimeout(debounce);
    Object.assign(state, defaults, { query });
    lastOpenedRecord = null;
    search.value = query;
    controls.querySelectorAll('[data-archive-filter]').forEach((select) => { select.value = state[select.dataset.archiveFilter]; });
    render();
  }
  reset.addEventListener('click', () => searchAll(), { signal: events.signal });
  clearResults.addEventListener('click', () => { searchAll(); search.focus(); }, { signal: events.signal });
  function go(value) { state.page = value; render(); controls.scrollIntoView({ block: 'start', behavior: 'instant' }); }
  previous.addEventListener('click', () => go(state.page - 1), { signal: events.signal });
  next.addEventListener('click', () => go(state.page + 1), { signal: events.signal });
  page.addEventListener('change', () => go(page.value), { signal: events.signal });
  retry.addEventListener('click', load, { signal: events.signal });
  return {
    root, searchAll,
    setActive(value) {
      active = value; root.hidden = !value;
      if (!value) return;
      if (!data) { load(); return; }
      render();
      if (lastOpenedRecord) {
        grid.querySelector(`[data-archive-id="${CSS.escape(lastOpenedRecord)}"] .theatre-archive-card-open`)?.focus();
        lastOpenedRecord = null;
      }
    },
    destroy() { clearTimeout(debounce); events.abort(); },
  };
}
