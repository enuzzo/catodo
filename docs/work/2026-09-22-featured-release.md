# Complete Featured research and UI release

Historical 2.13.0 checkpoint. In-app Play for all 305 works was subsequently
requested explicitly and is delivered by the [2.14.0 playback release](2026-09-22-featured-playback.md).

Date: 2026-09-22. Release: **2.13.0**. Publication explicitly authorized by the
owner, including all 305 research works. This supersedes the local-only status
of the [audit](2026-09-22-featured-review.md) and [UI work](2026-09-22-local-ui-polish.md).

## Delivered scope

- Theatre → Featured exposes all 305 selections (209 dossier works and 96 new
  discoveries), twelve collections, Music/War genres, search, language filters,
  editorial/year/title sorting and 24-item pagination. No research work is
  hidden solely because its edition is awaiting clearance.
- Authored editorial copy, corrected source links and work-identity notes are
  published as metadata. The 26 incorrect catalog associations are omitted;
  originals and all 888 incoming references remain in the external audit.
- Remote, credited source images load only after consent. Typographic artwork
  remains visible while images load or fail; unlicensed audit captures are not
  copied into the public bundle.
- Detail dialogs support close button, backdrop, Escape and focus restoration;
  60px vertical outside space makes the overlay clear at short screen heights.
- Global 4–6px corners and dropdown gutters; Home has six random cards aligned
  with the preview, up to eighteen roomy Favorites and More; curated Theatre
  opens on a randomized film with a 4:3 preview, footer actions and year sorting.

## Evidence

The release evidence directory is
`/Users/enuzzo/Documents/Codex/CATODO-2.13.0-release-2026-09-22/`.

- `npm test`: 215 passed, zero failed/skipped. `npm run check`: syntax and 2.13.0
  metadata passed. `npm run build`: passed; existing large-chunk advisory remains.
- PHP syntax passed for the gate and three protected service endpoints.
- Production-bundle Chromium Featured checks passed at 1600×900, 1254×784,
  773×601 and 390×844, in light/dark: filters, sorting, pagination, modal
  dismissal/focus, no eager third-party images or movie requests, and persistent
  media DOM across Curated/Featured/Archives. Screenshots were inspected.
- Curated UI regression passed on the same four sizes, including 4:3 preview,
  startup random selection, modal margins and three dismissal methods.
- Actual ESO movie playback decoded frames and advanced time; sorting/dialogs
  preserved the video; fullscreen and archive round-trip passed on the build.
- Production Home checks passed in all four sizes/light-dark using a local
  synthetic playlist: six cards, exact desktop top/bottom alignment, eighteen
  Favorites, More at twenty and hidden at eighteen, with no runtime errors.
- Manifest/icon presence, square opaque installation icons, transparent website
  icons, changed Markdown links and whitespace checks passed.
- Browser plugin was unavailable; the installed Playwright runtime provided
  isolated local Chromium checks. Production browser inspection uses CUA.

## Publication

Published to official `main` as **fd9d56c** and deployed successfully to
[catodo.app](https://catodo.app/) on 2026-09-22. The primary checkout was
fast-forwarded from its clean state. The temporary deployment credential link
was removed; no credential contents were displayed or committed.

Live verification at **17:25:16 UTC** is recorded in `live-verification.json`:

- Cache-busted `version.json` reports **2.13.0**; the browser login page also
  visibly shows 2.13.0.
- The deployed Featured feed contains **305 records and 12 collections** and
  matches the local artifact byte for byte (SHA-256
  `df920803a0d925c0967f71e9e5bd310535f147760abf03da5eff4656bcd5c970`).
- The deployed application JS/CSS, HLS chunk, locale, appearance script and
  discovery index (plain and gzip) match the tested build byte for byte.
- Three authenticated services return 401; private storage, private entry and
  legacy app route return 403; manifest and touch icon return 200.
- The verification browser has no authenticated session. The live login page
  was inspected; authenticated live navigation was **not** claimed or bypassed.
  Full interaction and responsive checks above ran on the identical built
  assets locally. Curl provided the release HTTP checks; the initial Python
  HTTP client received an intermediary 403 and was not used as server evidence.

## Remaining work and limits

The research publication is complete. Its records are **not** 305 new approved
in-app player editions: no `mediaUrl` or playback grant is present in this feed.
International edition clearance, full-length completeness, sound assessment and
image licensing remain explicit audit work. The existing curated player remains
available. The 26 held works stay in the decisions dossier, outside the 305.

Browser decode is not physical audibility or real Tesla/iPhone acceptance.
No real-device Add to Home Screen acceptance was performed for this release.
Multiview audio invariants are covered by the passing automated suite; no new
manual multi-stream playback session was performed in this release pass.
Resume unresolved edition work from the audit ledger and first-thirty priority
notes, without withholding the now-published research catalog.
