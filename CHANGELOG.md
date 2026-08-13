# Changelog 📡

All notable changes to CATODO are documented here: new signals, sharper pixels,
fewer ghosts in the machine.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
The emoji are navigation, not confetti: `✨` new things, `🛠` changed things,
`🐛` fixed things and `🔐` security work.

## [Unreleased]

## [2.3.0] - 2026-08-13

### 🛠 Changed

- Explore now prefers Euronews Italian for its initial featured channel when that signal is available, while later user selections and randomization remain untouched.
- Short TV Guide programmes can now expand in place on first click so their full title is readable; a second click still opens the complete channel guide.

### 🐛 Fixed

- Fullscreen Favorite changes now show the same star-burst add and lightning remove feedback as the rest of CATODO.
- TV Guide's `Now playing` badge no longer overflows or gets clipped vertically inside programme cards.

## [2.2.1] - 2026-08-13

### 🛠 Changed

- Home now starts each app session on a randomly selected playable Favorite when one is available; later Home returns and Random presses keep using the full catalog.
- Country guide discovery now starts only after an explicit third-party acceptance, remains available for every GlobeTV country instead of presenting an inert unavailable state, and distinguishes outdated, unmatched and unconfigured guide data on channel cards.
- Dedicated Explore categories now expose inline sort choices, a country filter with per-country channel counts, and a separated filtered-total indicator.

### 🐛 Fixed

- TV Guide timelines can now be dragged horizontally with a mouse or pointer while preserving ordinary programme-card clicks and native touch panning.
- Country-specific TV Guide loads now contact only that country's installed feeds, preserving match diagnostics for other countries and avoiding unrelated provider refreshes.
- Form controls no longer dispatch their action on the opening click, so Explore and other select menus stay open until the user makes a choice.

## [2.2.0] - 2026-08-13

*The next signal is tuning.*

### ✨ Added

- Full-screen playback now loads only the tuned channel's mapped TV Guide on demand — cached, deduplicated and without waking the whole XMLTV planet. Configured sources remain the fallback for unmapped channels.

### 🛠 Changed

- The website now wears the naked, transparent horned CRT mark — including the animated EBU splash — with soft RGBA depth behind its horns and beneath the cabinet. CATODO identity and login controls are bigger across phone, iPad and Tesla, while iOS Home Screen icons sensibly keep their backing.
- README and project metadata now have the ScryBar-family swagger: chunky badges, a sharper short description, discoverability tags and an impossible-to-miss **ZERO ILLEGAL / zero pezzotto** boundary.

### 🐛 Fixed

- TV Guide now chooses one coherent schedule when multiple XMLTV feeds match, instead of stacking duplicate programmes like broadcast lasagna.
- Country details now discover GlobeTV feeds dynamically. France, Germany and every mapped upstream country no longer need a hand-written permission slip.

## [2.1.1] - 2026-08-13

*The guide learned to tell time and stopped pretending stale data was live.*

### 🛠 Changed

- Home's **Favorites → View all** now lands in Library with Favorites already selected. One tap means one tap.
- TV Guide times now respect the local timezone and use unambiguous 24-hour notation.
- Channel metadata traded compressed pipe separators for properly breathing dashes.

### 🐛 Fixed

- Replaced the expired Italian EPG mirror with current Open EPG feeds, plus automatic migration, a narrow development bridge and an authenticated production cache.
- TV Guide now tells stale matches from actual live coverage and lists only channels with programmes in the current window. A valid XML file is not automatically a time machine.
- The Guide filter row no longer stretches into modern art when **Favorites only** returns a short list.

## [2.1.0] - 2026-08-13

*CATODO stopped being a player page and became a worldwide television cockpit.*

### ✨ Added

- Netmilk TV identity on the login gate and application header.
- One build-owned version shared by splash screen, frontend and PHP login, because three disagreeing version numbers are how hauntings begin.
- Automated release and version-consistency gates.
- Installable iPhone and iPad Home Screen package with the horned CRT icon.
- Complete country directories, country-guide setup and editorial Explore collections.
- TV Guide, XMLTV source management and an immersive in-player guide.
- Two-, three- and four-feed Multiview layouts, channel picker and named presets.
- Recently watched channels, real stream telemetry and installation-wide source synchronization.

### 🛠 Changed

- Rebuilt the application as a worldwide, Tesla-first television explorer with controls that do not require tweezers.
- Made Home preview-first, so channel changes no longer throw the viewer into fullscreen without asking.
- Unified favourite language, states and feedback across the interface.
- Refined player navigation, responsive channel cards and properly chunky in-car touch targets.
- Replaced the original app icon with Netmilk's larger horned television mark.

### 🐛 Fixed

- Preserved playback and fullscreen state while catalogues and UI refresh underneath them.
- Restored player audio and made weak-network playback less inclined to faint dramatically.
- Prevented stale icon caches after Home Screen artwork updates.
- Hardened shared-state recovery, catalogue hydration and player transitions.
- Gave country-card typography room to breathe and normalized channel metadata.

## [2.0.0] - 2026-08-11

*First carrier wave.*

### ✨ Added

- Initial open-source CATODO web player with consented public M3U discovery and HLS playback.
- PHP authentication gate, persistent lockout protection and signed login cookies.
- English interface, resilient channel-logo resolution and production deployment tooling.
- Tesla-oriented controls, weak-connection handling and defensive security headers.

### 🔐 Security

- Killed the unrestricted proxy and moved the entire application behind the server-side login boundary. A television app does not need to moonlight as an open relay.

[Unreleased]: https://github.com/enuzzo/catodo/compare/v2.3.0...HEAD
[2.3.0]: https://github.com/enuzzo/catodo/compare/v2.2.1...v2.3.0
[2.2.1]: https://github.com/enuzzo/catodo/compare/v2.2.0...v2.2.1
[2.2.0]: https://github.com/enuzzo/catodo/compare/v2.1.1...v2.2.0
[2.1.1]: https://github.com/enuzzo/catodo/compare/v2.1.0...v2.1.1
[2.1.0]: https://github.com/enuzzo/catodo/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/enuzzo/catodo/releases/tag/v2.0.0
