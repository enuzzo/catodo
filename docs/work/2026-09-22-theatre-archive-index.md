# Integrated film discovery index — 2026-09-22

## Scope and publication

Requested: index the Archive feature_films collection, Public Domain Movies and
Open Culture, integrate categories and covers, and use ratings where available.
The session also authorizes version/changelog, commit, push and deployment.
Release candidate: 2.11.0; final publication evidence will be recorded below.
This extends the [compact Theatre release](2026-09-22-theatre-compact-curation.md).

## Snapshot coverage

| Source | Direct source entries | Evidence |
| --- | ---: | --- |
| Internet Archive | 28,467 | Cursor search: 29 pages, unique identifiers, cursor exhausted, returned count equals initial total |
| Open Culture | 871 | Every direct film/collection entry in the seven curated groups; duplicate cross-category entries consolidated |
| Public Domain Movies | 893 | Every unique public all-movies directory link; repeated category memberships combined |
| Integrated records | 30,067 | 164 exact Archive references consolidated; similar titles never merged |

The index is dated in the UI. Open Culture has 869 resulting records because
some distinct directory labels reference the same Archive item. All 871 direct
entries contribute to the manifest; linked collections such as the NFB library
remain collection entries, not thousands of invented individual records.

Primary sources:
[Archive query](https://archive.org/advancedsearch.php?q=collection%3A%28feature_films%29%20AND%20mediatype%3A%28movies%29&output=json),
[Public Domain Movies full list](https://publicdomainmovies.info/all-movies/),
[Open Culture directory](https://www.openculture.com/freemoviesonline).
Archive's [search documentation](https://archive.org/help/aboutsearch.htm)
explains the paged-search limit; the indexer uses its cursor scrape API instead
of truncating at 10,000 results. The indexer uses public HTML for PDM; its REST
API requires authorization, and no account/paywall bypass is attempted.

Counts are records, not unique feature films or rights-cleared editions. Source
metadata is imperfect: 16,587 entries have no mapped genre and remain under Not
categorized. Entry type is inferred; the initial snapshot has 101 trailer,
154 episode/serial and 24 collection labels. Source years can be upload dates
when film dates are absent; the UI does not establish original release dates.
No original editorial descriptions, movie bytes or playlists are bundled.

## Rights, imagery and ratings

The source declares 1,425 Creative Commons records, 7,682 public-domain records,
893 U.S.-public-domain directory records and 20,067 records without established
rights. These are **declarations**, not clearance. Archive's own
[movies guidance](https://archivesupport.zendesk.com/hc/en-us/articles/360017808151-Movies-and-Videos-A-Basic-Guide)
does not guarantee all uploader claims. The capture includes contemporary
commercial titles carrying questionable CC tags, so automated license filtering
cannot replace edition review. PDM's stated scope is U.S. public domain.

The user has been asked for intended countries of use; no answer was available
when this index was prepared. The existing 29 reviewed works / 37 editions stay
the active player catalog. Three exact Archive references connect to reviewed
Decay, The Yes Men Fix the World and Insecurity. That selects the reviewed film;
it does not play arbitrary files from the source item or bypass consent.

29,569 records have source-image references: Archive item thumbnails, 893 PDM
public-post images and 180 direct YouTube thumbnails referenced by Open Culture.
These are not 29,569 individually inspected or licensed posters. PDM metadata
retrieval completed without failures; image availability remains remote and can
change. Images load only after Show source images, lazily, with source credit,
no referrer and a typographic fallback. They are not bundled or transformed.
Existing approved local artwork takes precedence for reviewed entries. There
are no GIFs, background movie downloads or remote-image animations.

5,504 records have Archive ratings/review counts. Stars describe a particular
upload. Weighted ordering uses `(stars × reviews + 35) / (reviews + 10)` to dampen
very small samples. Archive's review count can include text-only reviews, so the
score is a ranking heuristic rather than an exact Bayesian vote estimate. The
actual reported stars and number of reviews remain visible; missing values are
not replaced with zero-star ratings. No IMDb/Rotten Tomatoes ratings are implied.

Unreviewed cards show factual year/type/language context and link to the source
for synopsis and edition notes. This does not claim an authored plot synopsis
for every discovery record. Verified Theatre records keep their original prose.

## Implementation and reproduction

- `scripts/theatre-index.py`: Python standard library plus curl; bounded network
  requests and two concurrent public PDM metadata reads, full cursor traversal,
  source-specific parsers, exact-ID deduplication, atomic snapshot replacement.
- `public/theatre/archive-index.json`: 13,334,672 bytes of factual metadata.
  Build gzip: 1,584,396 bytes (1.58 MB decimal), fetched only when Explore opens.
- `src/data/theatre-archive-model.js`: schema/link validation, source/category/
  declared-rights/decade/type/review filters, accent-insensitive search, stable
  ordering and 24-record pagination. Exact approved edition IDs alone bridge
  discovery and playback.
- `src/ui/theatre-archive.js`: lazy loading, retry, gzip/plain compatibility,
  image opt-in/fallback, reviewed-film selection and source links. Entering
  discovery pauses the existing video and galleries, preserving the media DOM.

Refresh commands and capture-cache policy are in
[OPERATIONS.md](../OPERATIONS.md#refresh-the-film-discovery-index). Raw public
captures and the HTTP cache remain outside the repository in
`/tmp/catodo-archive-index/` during this run. Do not use this stale cache for a
future live refresh. A source refresh does not change the film approval register.

## Verification

Seven new Node tests include four Python parser cases: nested Open Culture
markup, repeated categories, collection records, missing-page failure, untrusted
links, rights-declaration isolation, exact-edition matching, rating order,
combined filters, pagination and complete generated-snapshot reconciliation.

Development browser checks passed at 773×601 and 1254×784 (DPR 1.53), 1600×900
and 390×844: compact opening Play remains visible in Tesla split, no eager index
fetch, 24-card bounds, all-source filtering, search, rating thresholds, exact
reviewed-film return with persistent DOM/no autoplay, cover consent/loading,
last-page clamping, empty results and no horizontal overflow or page errors.
Local first-open load/render was 250–266 ms; this loopback measurement is not a
Tesla or mobile-network performance promise. The final production bundle passed the same four-viewport flow (267–289 ms
loopback first-open). Additional checks passed gzip 404 fallback, browsers without
DecompressionStream, repeated load failure/retry, image-error fallback, and real
Europe to the Stars decoding in both Tesla layouts. Entering the archive pauses
the same video; a deliberately late Play event is blocked while the film is
hidden. Discover navigation preserves the archive mode and returning to the film
preserves position without autoplay.

Live source-image samples decoded from all three image providers: six Archive
horror thumbnails, the PDM Frankenstein card and a directly linked Open Culture
YouTube thumbnail. This sample does not validate every indexed cover.

The controlled HLS regression passed search, consent import, single decoded
player, favorite, volume/mute, four decoded Multiview feeds, audio focus 1→2,
channel replacement retaining one audio source and return navigation.

Release gates: 202 tests passed, zero skips; syntax check of 122 JavaScript files,
release metadata check, production build, four PHP lints, locale mirror and diff
whitespace all passed. The existing deferred world-map chunk warning remains.
There is no new dependency or PHP endpoint. Runtime/browser checks establish
neither physical Tesla audio/touch nor rights for unreviewed media.

Durable evidence outside Git:
`/Users/enuzzo/Documents/Codex/catodo-release-2.11.0-2026-09-22/` contains the
four-viewport screenshots/results, error/transition checks, Live smoke, gate logs
and SHA-256 build manifest. Authenticated live and public HTTP proof follows.

## Remaining work and next start

- Confirm country of use; review exact vintage horror/Elvis editions and their
  image/score/restoration rights before adding playable works. The 50-work target
  remains open, independent of this discovery index.
- Improve source metadata where evidence supports genre, date and original
  synopsis. Unknown values are visible rather than silently guessed.
- Linked collections can be expanded in a future explicitly scoped source pass;
  the direct directory index is complete without pretending that these member
  catalogs were traversed.
- Physical parked Tesla touch/audio/fullscreen and real iOS acceptance remain
  separate from the mandatory browser viewport matrix.
