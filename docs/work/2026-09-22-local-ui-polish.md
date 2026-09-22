# Local UI polish — 2026-09-22

Status: included in the owner-authorized [2.13.0 release](2026-09-22-featured-release.md). The following records the earlier local checkpoint. Based on `7019343` in the isolated
`7b58/catodo` worktree (detached HEAD). No commit, push, version bump or deployment
was requested or performed. Published CATODO remains 2.12.0. Preserve all local
changes from this session together; the user authorized these UI refinements
while waiting for Claude's editorial output.

## Delivered behavior

- Shared 4–6 px corners on previously square standalone surfaces; dropdown arrows
  inset 14px with 44px text gutters, RTL placement and forced-color native fallback.
  Multiview presets/actions remain reachable in compressed and phone layouts.
- Home: six random suggestions, three columns/two rows aligned with the preview
  on wide layouts. Up to 18 readable favorites, six columns at 1600/1254px, three
  at 773px and two at 390px. More opens the full favorite Library only above 18.
- Theatre: randomly choose the initial usable film without starting playback.
  Keep the selection when returning to the view. Idle artwork has a 4:3 contain
  frame; edition, Play and Favorite controls sit below image and description.
  Remove the connection sentence while retaining explicit Allow source & play.
- Credits: native modal, complete source/edition/artwork evidence and local QR,
  60px outer top/bottom margins, fixed close header, scrollable body,
  X/backdrop/Escape dismissal and keyboard
  focus cycling/restoration. Viewing credits preserves playback.
- Order by: editorial, newest/oldest year, title A–Z and shortest duration. Combine
  with current filters without changing preview or catalog data; missing numeric
  values remain last and equal values retain editorial order.

## Evidence and boundaries

Playwright with bundled Chromium (Browser plugin unavailable) used local Vite at
`http://127.0.0.1:5193/app.html?qa`, a mocked unavailable PHP endpoint and isolated
profiles. All four baseline viewports and light/dark modes were rendered.
The final suite passed 210 tests with no skips; syntax/release checks and the
production build passed. Changed Markdown links and diff whitespace were checked.

Home's synthetic 20-favorite run checked the 18-card cap, More's filtered Library
route and hiding at 18. Wide preview/suggestion top and bottom differences were
0px. Randomize preserved the preview node and source. Synthetic streams establish
layout and behavior only; the displayed five-digit counts were a heading stress
fixture, not a refreshed installation count.

Theatre checks covered 4:3 geometry, deterministic startup RNG, modal containment,
all three dismissals, inside-click preservation and focus. All 29 previews retain
initial Play visibility at 773×601. Real ESO film playback decoded and advanced;
credits and sorting preserved media state in both Tesla viewports, and fullscreen,
Close and the archive round trip passed. No film request occurred before consent.

Evidence directories outside the repository:

- `/Users/enuzzo/Documents/Codex/CATODO-soft-corners-2026-09-22/`
- `/Users/enuzzo/Documents/Codex/CATODO-home-alignment-2026-09-22/`
- `/Users/enuzzo/Documents/Codex/CATODO-theatre-preview-2026-09-22/`

No production PHP/sync, physical Tesla/iPhone, audibility or new rights approval
is established. The existing build-size warning remains separate from correctness.

## Next start

The user subsequently supplied the package and explicitly authorized commit,
push and deploy. Follow the [release handoff](2026-09-22-featured-release.md).
Featured research is integrated; expanded in-app film playback remains subject
to the separate edition/rights review.
