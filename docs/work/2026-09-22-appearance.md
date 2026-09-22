# Day/night appearance — 2026-09-22

## Decision and implementation

Settings → Appearance offers Auto, Light and Dark. New browsers start in Auto,
with CATODO Light for day and CATODO Dark for night. Day/night palettes are chosen
independently, with local miniature previews. The eight choices are CATODO
Light/Dark, Catppuccin Latte/Mocha, Solarized Light/Dark, Dracula and Monokai.
The named palettes are semantic adaptations; some foreground colors differ from
the editor originals to retain normal-text contrast. See the
[palette references](../../THIRD_PARTY_NOTICES.md#appearance-palette-references).

Auto follows the browser's `prefers-color-scheme` and responds to changes while
open. Light is a valid response even at night. If neither query is supported,
Auto falls back to the device-local clock: light from 07:00 inclusive to 19:00
exclusive. The same schedule is explicitly selectable for a car browser that
always reports light. No location permission, solar estimate, account preference
or third-party request is involved.

This distinction follows [MDN's media-feature definition](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-color-scheme).
[Tesla's display manual](https://www.tesla.com/ownersmanual/model3/en_ie/GUID-518C51C1-E9AC-4A68-AE12-07F4FF8C881E.html)
describes native display Auto but does not establish whether the browser forwards
that preference. **Physical Tesla signal verification remains open.**

The single registry/controller in `public/appearance.js` is a versioned classic
script, loaded synchronously before paint in both `app.html` and `index.php`.
It updates root CSS tokens, native control `color-scheme` and browser theme color.
Settings dispatches to this controller without remounting application or media
DOM. The script is 8.5 KB before HTTP compression and has no runtime dependency.
Settings, guide/timeline, maps, dialogs, player chrome and diagnostic charts use
semantic colors. Film images, video surfaces, EBU bars and intentional media
overlays retain their original colors.

The normalized preference lives under `catodo:appearance:v1` in localStorage,
separately from the shared installation/backup. Browser tabs follow storage
changes. Blocked storage retains the current session choice and displays that
limit. Wake-up, page restoration and a 30-second local clock check update Auto;
media-query listeners support both current and older browser APIs.

## Verification

Build Web Apps implementation/testing guidance was used. The dedicated Browser
plugin was unavailable; the existing bundled Playwright runtime provided
repeatable production-bundle checks, and CUA/IAB provided direct visual/UI
inspection. Automated profiles used synthetic playlist/guide data and a local
PHP gate copy without real credentials or shared installation state.

- 208 Node/PHP tests passed, no skips. The six new appearance tests cover invalid
  preferences, day/night boundaries, system/manual precedence, persistence and
  failures, cross-tab updates, old media listeners, cleanup and palette contrast.
- `npm run check`: 125 JS/MJS files and release consistency passed; `public/` is
  now included in the syntax gate. `npm run build` passed; the existing deferred
  world-map chunk size warning remains.
- PHP lint passed for the gate and three built endpoints; diff whitespace passed.
- All eight palettes rendered in Settings and Theatre at 1254×784 and 773×601
  (DPR 1.53), 1600×900 and 390×844. Auto system changes, clock override, reload
  persistence, 48px appearance controls and horizontal containment passed.
  Direct IAB inspection confirmed Catppuccin Latte in the compressed layout and
  Dracula in the extended layout. Core selectors fit above the compressed footer.
- Live, Discover, Countries, TV Guide and Library rendered in CATODO Dark in
  all four sizes. PHP login passed light/dark layout checks in all four sizes.
- Synthetic HLS playback decoded, favorite/volume/mute worked, four Multiview
  feeds decoded, audio focus moved 1→2, and channel replacement retained one
  audible feed. Four palette changes preserved video nodes and audio focus,
  without source resets or pause events.
- Europe to the Stars decoded in both Tesla layouts. A browser light→dark change
  during playback and a Dracula change during fullscreen preserved the video
  node, source, mute and volume; playback advanced and Close restored browsing.
  This is browser decoding evidence, not proof of physical speakers or Tesla.
- A populated synthetic TV Guide and its programme drawer are included in the
  final screenshot set; provider freshness is outside this theme change.

Local scripts, screenshots, gate/test logs and JSON results are archived under
`/Users/enuzzo/Documents/Codex/catodo-release-2.12.0-2026-09-22/`.
The initial QA harness was corrected to use explicit select labels, the actual
mobile More action, guide metadata associations, and the drawer's Close button.
Final results, rather than those earlier harness failures, establish acceptance.

## Publication and next start

Release 2.12.0 is prepared and locally verified. Commit, push, upload and live
verification are pending at the time of this implementation commit.

Next physical check: park the Tesla, leave CATODO in Auto → Browser preference,
switch the car display between Light and Dark, and read the reported mode in
Settings. If it does not follow, choose Local time. This check does not block the
explicit schedule/manual choices. Actual iOS/PWA chrome remains a device check.
The separate Claude curation dossier and the existing Theatre catalog/editorial
queue remain intact; this release adds no film editions.
