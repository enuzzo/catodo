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
| Guide | `node --test tests/epg/*.test.js` | Consent UI and country/status isolation |
| UI models/copy | `node --test tests/ui/*.test.js tests/i18n/*.test.js` | Render the changed surface at desktop/Tesla baseline and narrow viewport |
| PHP state | `node --test tests/php/installation-api.test.js` | Requires PHP; test skips when PHP is absent |
| Hosting boundary/Worker | `node --test tests/security/*.test.js tests/worker/*.test.js` | Actual hosting routing and configured proxy behavior are separate |
| One regression | `node --test tests/ui/view-mode.test.js` | Substitute the owning test from CODE-MAP |
| Markdown only | Check changed local links and whitespace | Release gate if metadata was touched; full gates before publication |

Do not invent `npm run lint`, browser-test or coverage commands: none is defined
in `package.json`. Existing Node tests use fixtures/fakes and PHP temporary
storage; do not replace them with live-provider calls.

## What the gates establish

- `test`: Node behavior tests. Read the summary for failures **and skips**.
- `check`: syntax for JS/MJS under `src/`, `tests/`, `scripts/`, then version
  consistency across package/lock/changelog, selected docs and build wiring.
  It does not cover PHP, CSS/layout or every root JavaScript file.
- `build`: Vite production assets plus private-entry relocation. It can expose
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
