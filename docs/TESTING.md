# Verification map

Use the smallest check that can establish the changed behavior during iteration.
Before commit, push or deployment, all three project gates remain mandatory:

```sh
npm test
npm run check
npm run build
```

Run commands from the repository root with the local lockfile/dependencies.
`npm ci` restores a clean install when needed; do not replace dependencies merely
for a documentation edit. Use a Node version compatible with the installed Vite
package (check its `engines` if setup fails).

## Focused checks

| Area | Example command | Additional evidence when relevant |
| --- | --- | --- |
| Catalog/storage | `node --test tests/data/*.test.js` | Include PHP test for shared-state contracts |
| Player/audio | `node --test tests/player/*.test.js` | Real gesture, playback, mute/volume and return path |
| Theatre | `node --test tests/data/theatre-model.test.js tests/player/theatre-player.test.js tests/ui/telemetry-model.test.js` | No media before consent; playback controls, persistent DOM, late live-play isolation, QR decoding, all artwork loading/credits and navigation in real Chromium |
| Archive discovery | `node --test tests/data/theatre-archive-model.test.js` | Includes Python 3 standard-library parser fixtures; source-count reconciliation, exact-edition approval, URL safety, rating/filter/page behavior. Browser: lazy gzip/plain loading, retry, opt-in images/fallback, all-source search and preserved film DOM in all four viewports |
| Guide | `node --test tests/epg/*.test.js` | Consent UI and country/status isolation |
| UI models/copy | `node --test tests/ui/*.test.js tests/i18n/*.test.js` | Render the changed surface at desktop/Tesla baseline and narrow viewport |
| Appearance | `node --test tests/ui/appearance.test.js` | Auto/browser/clock boundaries, persistence failure, cross-tab changes, listener cleanup and palette contrast. Render all palettes, themed PHP login and populated guide; change theme during decoded playback without replacing videos or changing audio focus |
| PHP state | `node --test tests/php/installation-api.test.js` | Requires PHP; test skips when PHP is absent |
| Hosting boundary/Worker | `node --test tests/security/*.test.js tests/worker/*.test.js` | Actual hosting routing and configured proxy behavior are separate |
| One regression | `node --test tests/ui/view-mode.test.js` | Substitute the owning test from CODE-MAP |
| Markdown only | Check changed local links and whitespace | Release gate if metadata was touched; full gates before publication |

Do not invent `npm run lint`, browser-test or coverage commands: none is defined
in `package.json`. Existing Node tests use fixtures/fakes and PHP temporary
storage; do not replace them with live-provider calls.

## Theatre preview, credits and order

Verify a random initial usable film, followed by stable selection across ordinary
navigation. In all four viewports and both themes, check the 4:3 artwork frame,
full image containment, the footer controls and popup bounds (at least 60px of
space above and below the centered dialog). All current previews
must keep Play fully visible initially on compressed Tesla, including long content
notes and edition selectors. Credits must close with X, Escape and backdrop click,
stay open for inside clicks, cycle keyboard focus, restore it to the trigger and
keep the close button reachable while long credits scroll.

Exercise every Order by option after filtering, editorial reset, unchanged preview
selection, unknown-value ordering and archive round trips. Before consent, assert
no film media request. During real decoded playback, sorting and credits must
preserve the video node, source, current time, volume and mute; verify fullscreen
and Close restore the 4:3 idle frame. Historical expanded-credits checks below
refer to the former accordion; current behavior is the modal described here.

## Home alignment and favorite limits

Import the synthetic playlist through the real app and save 20 favorites. Home
must show six random suggestions and 18 favorites; More must open all 20 in the
favorite Library, then disappear when the total returns to 18. Refreshing random
suggestions must preserve the preview video node and source. Compare preview
and suggestion-grid top/bottom edges on wide layouts, including long channel
names and five-digit live counts. Verify six favorite columns at 1600/1254px,
three at 773px and two at 390px, with no hidden cards or fixed-height shelf.
Capture both themes, the initial viewport and the favorite shelf after scrolling.
Synthetic channels establish layout and navigation, not live playback.

## Shared corners and dropdowns

For shared CSS changes, inspect Live, Discover, Theatre (including archives),
Countries, Multiview, Guide, Library and Settings in both themes and all four
baseline viewports. Check clipped artwork against rounded outer borders, joined
panel seams, selected/focus outlines, and native dropdown text with its reserved
44px trailing gutter. Verify collection/language filtering, keyboard Tab order,
RTL arrow placement and the native-arrow fallback in forced colors. The archive
page-number input shares a field class but must never gain a dropdown arrow.
Multiview presets and actions must remain reachable alongside the feed-count
controls, including after a saved preset exposes rename/delete actions.

## What the gates establish

- `test`: Node behavior tests. Read the summary for failures **and skips**.
- `check`: syntax for JS/MJS under `src/`, `tests/`, `scripts/`, `public/`, then version
  consistency across package/lock/changelog, selected docs and build wiring.
  It does not cover PHP, CSS/layout or every root JavaScript file.
- `build`: Vite production assets, private-entry relocation and discovery-index gzip. It can expose
  bundle-size warnings; a successful build is not a browser or deployment pass.

For changed root JavaScript, use `node --check worker.js` or
`node --check vite.config.js` as applicable. For server/release work with PHP:

```sh
php -l index.php
php -l public/installation-api.php
php -l public/logo-cache.php
php -l public/epg-cache.php
# After build, also lint the deployed endpoint copies:
php -l dist/installation-api.php
php -l dist/logo-cache.php
php -l dist/epg-cache.php
```

## Browser and device evidence

Vite development can render frontend behavior and its narrow EPG bridge, but
cannot execute the PHP services. `npm run preview` also does not provide a PHP
login/sync environment. For the authenticated production shell, use a PHP-capable
environment; SiteGround Nginx/Apache denial rules still require hosting checks.
Do not publish a temporary unprotected app entry to make a smoke test convenient.

Every visible UI change must cover **both Tesla browser layouts**: **773×601 CSS
pixels** for the view beside the car column, and **1254×784** for the fullscreen
simulation. The split dimensions were measured on a real Tesla in earlier
diagnostics (logical screen 1254×784, DPR 1.53). The fullscreen dimensions are a
simulation based on that screen, not a fresh measurement of browser chrome.
Keep the **1600×900** desktop baseline and a representative **390×844** phone
viewport when responsive behavior matters. Test the initial viewport before
scrolling, touch target reachability, expanded video and return to browsing.
Parked vehicle acceptance remains a separate physical check. Check focus/keyboard,
containment and the relevant player transitions. QA fixtures show layout; real
HLS playback requires an approved source. Fresh profiles isolate test state.

For reproducible Library, category, pagination and country checks, use the
[synthetic UI fixtures](../tests/fixtures/README.md). Import the local playlist
through the real app for behavior; use the isolated renderer pages only for
connected-world and guide-loading layouts. Their reserved stream URLs cannot
establish playback, and Vite does not establish production PHP synchronization.

Report separately: static/code checks, Node/PHP tests, build, rendered browser,
production HTTP behavior, live provider freshness and physical Tesla/iOS results.
No fixed historical source count, screenshot or decoded-byte counter proves all
of those. Once relevant checks pass, rerun only if changes or failures justify it.


The September 22 Theatre/Discover run is recorded in the
[local handoff](work/2026-09-22-theatre-integration.md). Its fresh-profile browser
checks use an explicitly empty mocked PHP installation response; this isolates
frontend behavior and does not prove server synchronization. Remote MP4 files
must actually decode and advance before an edition is called playable. HTTP 200,
file extensions, nominal “HD” filenames and uploader licensing labels alone do
not establish compatibility, resolution or integration rights. QR decoding is
separate from physical camera scanning.

The [wide Theatre opening run](work/2026-09-22-theatre-wide-layout.md) covers
1254×784 and 773×601 Tesla viewports, 1600×900 desktop, 390×844 phone, and
1181/1101-pixel layout boundaries. Check side-by-side film/filter alignment only
above 1100 pixels, visible Play on the compressed Tesla viewport, complete
header navigation, search → collection → language keyboard order, expanded
credits/QR, long titles, episode selection and warning text. Actual film decode,
native fullscreen and Close must preserve the video node and restore the idle
layout; switching to/from Explore archives must hide/show the whole opening.

## Featured playback

`tests/data/theatre-featured-model.test.js` checks all 305 records, complete
pagination, composed filters, unknown-year ordering, corrected source identities
and collection assignments, media host/scheme boundaries, required editions and
safe exact-work GitHub report links. Rights status is separate from availability.
Rendered QA covers 1600×900, 1254×784, 773×601 and 390×844 in light/dark mode:
search + collection, sorting, page changes, image opt-in, modal containment and
X/backdrop/Escape/focus restoration, all three browsing modes, retained video
identity, no movie requests before Play, card/detail Play, decoded moving frames,
muted start, volume preservation across credits, fullscreen, pause on navigation,
resume without a retune and Close releasing the source. Check all 305 selected
URLs in Chromium; investigate failures and sample replacement editions.
Production bundle and live-feed
identity checks are recorded in the release handoff. No physical Tesla/iPhone
or worldwide rights approval is inferred from these checks.
