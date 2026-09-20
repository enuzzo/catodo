# UI/UX review and performance refinement — 2026-09-20

Status: completed locally and verified; not committed or published. The existing
CATODO broadcast identity, persistent media surfaces and consent boundaries are
preserved. This pass covers navigation, Live, Explore, Library/search, Countries,
Guide, Settings and Multiview. New product ideas remain proposals in
[ROADMAP.md](../ROADMAP.md).

## Audit findings and implemented work

The design already has a recognizable visual identity, consistent channel
actions, useful discovery surfaces and explicit third-party import consent.
The strongest opportunities were unclear state, mobile containment and the cost
of loading a rarely used map on every startup. The resulting local interface is
more coherent; physical touch/playback acceptance remains open.

| Flow | Observed friction | Result / remaining work |
| --- | --- | --- |
| Navigation → destination | Mobile More did not identify the active hidden destination; disclosure state could outlive the open menu | Active destination label, correct current-page/expanded semantics, outside dismissal and Escape focus return |
| Live → channel → player | Desktop channel details stretched below the preview; mobile names and controls competed for space | Stable compact details, wrapping names, 44 px mobile actions and three-column facts; real stream recovery is a separate follow-up |
| Explore → preview | Strong preview-first discovery, but logo fallbacks can dominate empty media areas | Existing interaction retained; quieter placeholders proposed as UX-03 |
| Library → filter → results | Combined playlist groups produced unwieldy genres; result extent and recovery were unclear | Normalize existing and new groups, readable selectors, shown/total counts, clear filters, accurate no-match state and whole-catalog global search |
| Countries → country → channels | Table cells overflowed; worldwide imports did not fully color the map | Contained table, visible counts/status, correct imported-country coverage; map loads on demand with list fallback and retry |
| Guide → loading → programmes | A transient empty message could imply no coverage while discovery was running | Explicit loading message and busy state; coverage by country proposed as EPG-02 |
| Settings → source/guide/backup | Already-connected world source still received an import promotion; connected playlists sat below setup material | Connected-source summary with actual saved count, Browse action, reordered sections and direct shortcuts that preserve the header |
| Multiview → feeds/audio | Four restored feeds and consistent controls were present; logo placeholders could dominate | Media/audio code unchanged and automated invariants passed; Data saver proposed as PLAY-02, device acceptance still required |

Playlist status now describes a catalog check rather than claiming stream health.
Both English locale mirrors preserve the union of their previous keys and remain
identical. Shared settings schemas, authentication and release version were not
changed.

## Measured build result

Comparable production builds, with the same installed dependency versions:

| Asset | Before | After |
| --- | ---: | ---: |
| Main application JS | 1,583.52 kB | 356.66 kB |
| Main application JS, Vite gzip | 503.81 kB | 107.77 kB |
| HLS JS | 396.52 kB | 396.52 kB |
| Map JS loaded on demand | Included in main application | 1,238.69 kB |
| Application CSS | 182.51 kB | 184.94 kB |

The main entry is approximately **77.5% smaller before compression**. Geometry
has moved off the initial path; this is not a claim that all downloaded assets
combined are 77.5% smaller. Built HTML preloads the app and HLS, not the map.
The deferred map still triggers Vite's large-chunk advisory. Actual startup
latency, first map latency and device memory were not benchmarked.

The compact ISO/name directory retains all 250 locations from the vendored map;
tests compare it with that source. A shared lazy import handles superseded
renders, cancellation and retry. Unchanged filter options are also retained
instead of rebuilding their DOM during every search update.

## Verification

- `npm test`: **183 passed, 0 failed, 0 skipped** (previous baseline: 173).
- `npm run check`: **109 JavaScript files** and release metadata passed.
- `npm run build`: passed; built app entry remains private.
- Locale mirrors identical; whitespace and changed-document links checked.
- Rendered desktop **1600×900** and phone **390×844** checks, plus one initial
  **1280×720** Library capture. Recent inspected console warnings/errors: none.
- Real local app imported 96 synthetic channels through the normal consent
  flow. Verified split genres, combined genre/language filters, no results,
  reset, 72→96 pagination, global search reset and visible counts.
- Verified map loading/zoom/reset, keyboard country selection, mobile menu
  Escape/focus/current destination and Settings shortcut scroll/focus. Phone
  page and country table had no horizontal overflow.
- Isolated renderer fixtures verified connected-world and Guide loading states.
  See [fixture instructions](../../tests/fixtures/README.md) for the distinction
  between layout states and actual application behavior.

Synthetic streams deliberately use `.invalid` URLs and cannot prove playback.
Vite does not run the authenticated PHP installation, so its local sync warning
is expected. Production was inspected without importing another world playlist
or changing source configuration. No new physical Tesla/iOS, speaker audibility,
full live-provider availability or end-to-end production release test is claimed.

## Visual evidence

Exact screenshots were saved, reopened and inspected in
`/tmp/catodo-ui-audit-20260920/`; they are temporary local evidence, not repository
assets or bundled third-party content. `notes.md` records captures and later
corrections. Useful comparisons:

| Surface | Before capture | After capture |
| --- | --- | --- |
| Live desktop | `03-live-before.png` | `15-live-after-desktop.png` |
| Countries desktop | `05-countries-before.png` | `17-countries-after-desktop.png` |
| Mobile Library | `09-mobile-library-before.png` | `20-library-after-mobile.png` |
| Mobile Live | `11-mobile-live-before.png` | `19-live-after-mobile.png` |
| Connected world source | `02-settings-top-before.png` | `21-world-connected-after.png` (synthetic renderer state) |
| Guide loading | Observed transient state | `22-guide-loading-after.png` (synthetic renderer state) |

Before/after catalogs differ: production supplies the before observations and
synthetic channels supply local layout/interaction evidence. They are not a
controlled provider-content or playback comparison.

## Recommended next work

Recommended order: PLAY-03 for clearer tuning/recovery, UX-02 for reusable saved
filters, then PLAY-02 for optional bandwidth control. EPG-02 would make guide
setup easier to diagnose; UX-03 addresses remaining visual density. Acceptance
boundaries and other retained ideas live only in the roadmap.

Next start: review the local app at `/app.html?qa`, choose a proposed feature or
perform physical-device acceptance. Publication requires the current task's
authorization and the release procedure; this pass did not prepare a release.

## Research informing decisions

Primary references consulted on 2026-09-20:

- [web.dev: Code split JavaScript](https://web.dev/learn/performance/code-split-javascript)
  supports loading optional functionality on demand; the byte result above is
  CATODO's own build measurement.
- [WAI-ARIA: Disclosure navigation](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/)
  informs expanded/current state and Escape/focus behavior. This pass is not an
  accessibility conformance certification.
- [hls.js: autoLevelCapping](https://hlsjs.video-dev.org/api-docs/hls.js.hls.autolevelcapping)
  provides a possible basis for PLAY-02. Product behavior and native-HLS
  limitations still need design and device validation before implementation.
