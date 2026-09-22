# Changelog 📡

All notable changes to CATODO are documented here: new signals, sharper pixels,
fewer ghosts in the machine.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
The emoji are navigation, not confetti: `✨` new things, `🛠` changed things,
`🐛` fixed things and `🔐` security work.

## [Unreleased]

## [2.14.0] - 2026-09-22

### ✨ Added

- Play all 305 Featured films inside CATODO, directly from cards or details, with persistent native video, mute, fullscreen, source credits and prefilled GitHub issue reports. Playback starts only on a viewer's Play action and pauses when leaving the section.
- Apply the 16 previously tested alternate editions plus ten additional source corrections, replacing wrong films, incompatible files, excerpts, a mixed program and a distorted portrait derivative. Preserve silent/fragment edition notes and qualified rights declarations.

## [2.13.0] - 2026-09-22

### ✨ Added

- Published the complete 305-work editorial Featured research in Theatre, with twelve collections, Music/War genres, search, language/year/title ordering, 24-card pages, opt-in credited source imagery and accessible detail dialogs. Corrected known source identities and collection memberships; external research remains distinct from approved in-app film editions.
- Added Theatre shelf ordering by editorial sequence, newest/oldest year, title A–Z and shortest duration; sorting composes with filters and preserves the selected film.

### 🛠 Changed

- Start Theatre with a random usable film, show preview artwork in a 4:3 frame and place edition/Play/Favorite controls below it. Removed the connection disclaimer while keeping explicit source consent before loading media.
- Open Theatre source, credits and viewing notes in a scrollable modal with 60px of space above and below, with X, backdrop and Escape dismissal, keyboard focus handling and uninterrupted playback.

### 🐛 Fixed

- Aligned Home’s six random channel cards (three columns, two rows) with the Live Anchor’s top and bottom edges, with both headings sharing a row on wide layouts.
- Restored readable Home favorites: up to 18 cards in six columns on wide layouts, responsive rows on smaller screens, and More opening the complete favorite Library only when additional favorites exist.
- Softened remaining square cards, panels and Theatre fields with restrained 4–6 px corners, preserving joined panel edges and clipped artwork.
- Kept Multiview presets and toolbar actions readable and reachable in compressed Tesla and phone layouts.
- Gave native dropdowns across all sections a consistent inset arrow and a dedicated text gutter, including Theatre collections/languages, archive filters and Settings; retained keyboard selection, RTL placement and the system arrow in forced colors.

## [2.12.0] - 2026-09-22

### ✨ Added

- Added Light / Dark / Auto appearance, defaulting to the browser preference, with an optional local-time schedule and automatic fallback for browsers without a color-scheme signal.
- Added independent day and night palettes: CATODO, Catppuccin Latte/Mocha, Solarized Light/Dark, Dracula and Monokai, with local previews, readable semantic colors and browser-local persistence.

### 🛠 Changed

- Applied appearance before the app and PHP login render, including browser chrome, TV Guide, maps, dialogs and player controls. Theme changes preserve existing media and Multiview audio focus; Settings stays touch-friendly in both Tesla layouts.

## [2.11.1] - 2026-09-22

### 🐛 Fixed

- Used Theatre's wide opening for a film-and-credits panel beside search, collection, language and genre filters. The first shelf now starts about 174 CSS pixels earlier at the extended Tesla viewport; Play expands the persistent player to the full content width, and Close restores browsing.
- Kept every primary navigation destination visible at intermediate desktop/Tesla widths without reducing the brand or touch targets. Narrow Theatre layouts retain their single column and visible Play action.

## [2.11.0] - 2026-09-22

### ✨ Added

- Added Theatre’s Explore archives catalog: 30,067 discovery entries from the complete Archive feature_films response and the direct Open Culture / Public Domain Movies directories, grouped by available categories with source, rights-declaration, decade, type and Archive-review filters.
- Added weighted Archive rating order, search, bounded pagination, credited opt-in source images and links back to the exact reviewed Theatre editions. Unreviewed entries open their original sources; uploader license labels do not approve playback.
- Added a reproducible directory indexer and a 1.58 MB compressed catalog loaded only on demand, with retry, plain-JSON compatibility fallback and image fallbacks.

## [2.10.1] - 2026-09-22

### 🐛 Fixed

- Versioned translation requests with the application release so a cached locale cannot hide newly added text, including Theatre’s “No dialogue” label.

## [2.10.0] - 2026-09-22

### 🛠 Changed

- Made Theatre’s opening film card compact, expanding the persistent video only after Play; added Close player, synopsis excerpts on every thumbnail and larger image credits.
- Made both Tesla browser layouts mandatory for visible UI work: 773×601 split view and a 1254×784 fullscreen simulation, alongside desktop and phone checks.

### ✨ Added

- Added Randomize within the current collection and filters, avoiding the selected film and preserving source consent.
- Added six editorial collections and seven reviewed works: The Lionshare, Snowblind, Sintel, Elephants Dream, Tears of Steel, Big Buck Bunny and The Internet’s Own Boy. Theatre now contains 29 works and 37 editions/episodes; the 50-work target remains open.
- Added alternate artwork with subtle Ken Burns motion and crossfades for 16 films. At most two visible thumbnails animate; Motion, reduced-motion, data-saver, navigation and film playback pause the effect. All 61 images load locally; no GIFs or preview videos are bundled.
- Added explicit Archive.org edition links and external discovery guides for horror/science fiction, film noir and silent cinema, with credited curatorial references. External guides do not imply that their entire catalogs are cleared for the player.

## [2.9.0] - 2026-09-22

### 🛠 Changed

- Renamed Explore to Discover, with Adrenaline first, a Documentaries collection and View all actions over the existing approved catalog; regional live-feed identities remain separate.
- Superseded the rejected Dutch-newsreel shortlist and unverified Video.js pilot with a new edition-specific film register; the 50-work editorial target remains open.

### ✨ Added

- Added Theatre with 22 curated works, native MP4 controls, explicit external-source consent, device-local favorites, combined filters, original synopses, visible attribution and source/license links with locally generated QR codes. Film files are not bundled.
- Added images for all 22 works: two official covers, one licensed observatory photograph and 19 selected film stills, with local loading and visible image credits.
- Isolated Theatre from live audio and late autoplay, preserved its video across shelf updates, and used native buffer/frame telemetry without inventing download measurements.

## [2.8.0] - 2026-09-20

### 🛠 Changed

- Refined Library search with readable genre filters (including existing combined playlist groups), visible result counts, one-tap filter reset, and more accurate empty states.
- Reordered Settings around connected playlists, guide sources and backups, added section shortcuts, and replaced the repeated world-import offer with the saved source's actual count when already connected.
- Deferred world-map geometry until Countries is opened, while keeping a compact offline country directory available at startup.
- Improved mobile navigation context, keyboard menu dismissal, Live channel details, touch targets and country-table containment; synchronized existing English locale keys without dropping either mirror's copy.
- Reorganized maintainer guidance into task-based agent instructions, code/test maps and a focused open roadmap; refreshed README setup/deployment guidance, added a release handoff and preserved earlier plans and validation as explicitly historical references.

### 🐛 Fixed

- Country-map coverage now includes channels imported through worldwide playlists; guide loading no longer briefly claims that no covered channels exist.
- Playlist status now describes the last catalog check without implying that every stream plays successfully.

## [2.7.1] - 2026-08-26

### 🔐 Security

- The production player shell now lives outside the public static root, preventing Nginx from bypassing the PHP login gate when serving `app.html` directly.

## [2.7.0] - 2026-08-26

### ✨ Added

- EBU Breakout is now a playable keyboard, pointer and touch mini-game with real ball physics, brick collisions, score, lives, replay and a giant Rickroll victory screen.

### 🛠 Changed

- The official CATODO installation, project links and proxy origin now use `https://catodo.app`.
- Rickroll now uses transparent animated Rick Astley dancers, while Nyan Cow uses the supplied complete transparent Nyan Cat GIF without a duplicate CSS rainbow trail.
- Explore's featured preview now uses a narrower 16:9 media stage, leaving more room for channel details and actions.

### 🐛 Fixed

- Country guide discovery now combines fresh Open EPG country feeds with an EPGShare01 fallback, uses GlobeTV only when no current provider entry exists, safely expands bounded country archives through the authenticated cache, and removes stale or invalid sources automatically.
- Country guide actions now open an explicit consent dialog, reuse guides already saved in Preferences after reload, refresh already-connected sources instead of asking again, and match XMLTV channel aliases more reliably.
- Removed the “Recalibrating reality” degauss easter egg from the signal-anomaly roulette and adjusted the five-effect finale.
- Active Favorite controls now use the compact “Unfavorite” label on one line, with white button text and red reserved for the heart icon.

## [2.6.0] - 2026-08-14

### ✨ Added

- The footer EBU bars now hide a six-effect, no-repeat signal-anomaly roulette: a local CSS Rickroll flip, Nyan Cow, pirate Teletext, a surreal numbers station, Breakout and CRT degauss, followed by a secret finale after the full set is discovered. Effects stay silent, can be dismissed immediately and respect reduced-motion preferences.
- Explore's featured preview now includes a Favorite control with the same saved state and feedback used across CATODO.
- Every visible `Guide not connected` state is now an accessible action: it opens the channel's country page, keeps third-party acceptance explicit, and connects the complete country guide after consent so one setup can cover many channels.

### 🛠 Changed

- Decorative channel numbers have been removed from cards and the immersive player; channel logos are larger throughout the directory while functional Multiview slot numbers remain.

## [2.5.1] - 2026-08-14

### 🐛 Fixed

- Multiview presets and the preferred 2/3/4-feed layout now follow the shared installation into new browsers, migrate once from the original browser's local storage, and are included in manual backups; Multiview still opens with the first saved preset by default.

## [2.5.0] - 2026-08-14

### 🐛 Fixed

- Mobile navigation now has a reliable leading gutter and one shared vertical alignment for every primary item, including the More trigger.
- Home preview live/audio controls now share one contained status group, and the video stage can no longer exceed its mobile grid track and clip them against the edge.

### 🛠 Changed

- Mobile global search now opens from a compact header button into an anchored dropdown, preserving dashboard space while keeping the full search field one tap away.

## [2.4.0] - 2026-08-14

### 🐛 Fixed

- Player and fullscreen Favorite feedback now renders above the video layer, stays clear of the top viewport edge and remains visible long enough for the star burst and lightning removal to read clearly.

### 🛠 Changed

- Library replaces its three oversized statistic cards with a compact inline summary beneath the heading, keeping Favorites, imported-channel and active-source counts visible while returning the space to channel discovery.
- Channel cards now include the first available TV genre and use one restrained badge language everywhere: neutral pills with small, consistently colored icons for country, language, resolution and genre.
- The immersive player now shows the streaming location's current time beside channel metadata, using the feed's official timezone and an unambiguous city label in 24-hour format; channels without trustworthy timezone metadata remain uncluttered.
- Adding a Favorite now resolves its mapped TV Guide immediately, reuses already accepted country sources, and offers a direct consent-first country-guide action when no provider has been connected yet; unmatched and stale provider results remain explicit.
- Multiview now opens with the first saved preset by default; adding a channel from fullscreen uses that preset as its base, replaces the first slot without duplicating a feed, and clears the preset selection until the customized layout is saved.
- Explore now refreshes every category rail with eight random channels whenever the view opens. Channel cards tune the in-page preview first, which now includes direct mute/unmute and full-player controls with a contained small-screen layout.

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

[Unreleased]: https://github.com/enuzzo/catodo/compare/v2.14.0...HEAD
[2.14.0]: https://github.com/enuzzo/catodo/compare/v2.13.0...v2.14.0
[2.13.0]: https://github.com/enuzzo/catodo/compare/v2.12.0...v2.13.0
[2.12.0]: https://github.com/enuzzo/catodo/compare/v2.11.1...v2.12.0
[2.11.1]: https://github.com/enuzzo/catodo/compare/v2.11.0...v2.11.1
[2.11.0]: https://github.com/enuzzo/catodo/compare/v2.10.1...v2.11.0
[2.10.1]: https://github.com/enuzzo/catodo/compare/v2.10.0...v2.10.1
[2.10.0]: https://github.com/enuzzo/catodo/compare/v2.9.0...v2.10.0
[2.9.0]: https://github.com/enuzzo/catodo/compare/v2.8.0...v2.9.0
[2.8.0]: https://github.com/enuzzo/catodo/compare/v2.7.1...v2.8.0
[2.7.1]: https://github.com/enuzzo/catodo/compare/v2.7.0...v2.7.1
[2.7.0]: https://github.com/enuzzo/catodo/compare/v2.6.0...v2.7.0
[2.6.0]: https://github.com/enuzzo/catodo/compare/v2.5.1...v2.6.0
[2.5.1]: https://github.com/enuzzo/catodo/compare/v2.5.0...v2.5.1
[2.5.0]: https://github.com/enuzzo/catodo/compare/v2.4.0...v2.5.0
[2.4.0]: https://github.com/enuzzo/catodo/compare/v2.3.0...v2.4.0
[2.3.0]: https://github.com/enuzzo/catodo/compare/v2.2.1...v2.3.0
[2.2.1]: https://github.com/enuzzo/catodo/compare/v2.2.0...v2.2.1
[2.2.0]: https://github.com/enuzzo/catodo/compare/v2.1.1...v2.2.0
[2.1.1]: https://github.com/enuzzo/catodo/compare/v2.1.0...v2.1.1
[2.1.0]: https://github.com/enuzzo/catodo/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/enuzzo/catodo/releases/tag/v2.0.0
