# Changelog

All notable changes to CATODO are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.1.1] - 2026-08-13

### Changed

- Home's Favorites “View all” action now opens Library with the Favorites filter already selected.
- TV Guide times now use the local timezone with unambiguous 24-hour notation.
- Channel metadata uses spaced dashes instead of compressed pipe separators.

### Fixed

- Replaced the expired Italian EPG mirror with current Open EPG feeds, including automatic migration, a development bridge and an authenticated production cache.
- TV Guide now distinguishes stale matches from live schedule coverage and only lists channels with programme data in the current window.
- Prevented the Guide filter row from stretching when “Favorites only” leaves a short result set.

## [2.1.0] - 2026-08-13

### Added

- Netmilk TV logo on the login gate and application header.
- Build-owned version metadata shared by the splash screen, frontend and PHP login.
- Automated release and version-consistency checks.
- Installable iPhone and iPad Home Screen package with a horned CRT icon.
- Complete country directories, country guide setup and editorial Explore collections.
- TV Guide, XMLTV source management and an immersive player guide surface.
- Multiview layouts, channel picker and saved preset management.
- Recently watched channels, stream telemetry and installation-wide source synchronization.

### Changed

- Rebuilt the application as a worldwide, Tesla-first television explorer.
- Made Home preview-first so channel changes do not force fullscreen playback.
- Unified favourite language, states and feedback across the interface.
- Refined player navigation, responsive channel cards and in-car touch targets.
- Replaced the original app icon with the larger Netmilk horned television mark.

### Fixed

- Preserved playback and fullscreen state during catalogue and UI refreshes.
- Restored player audio and hardened weak-network playback.
- Prevented stale icon caches after Home Screen icon updates.
- Hardened shared-state recovery, catalogue hydration and player transitions.
- Corrected compressed country-card typography and inconsistent channel metadata.

## [2.0.0] - 2026-08-11

### Added

- Initial open-source CATODO web player with public M3U discovery and playback.
- PHP authentication gate, persistent lockout protection and signed login cookies.
- English interface, channel logo resolution and production deployment tooling.
- Tesla-oriented controls, weak-connection handling and security headers.

### Security

- Closed the unrestricted proxy and moved the entire application behind the server-side login boundary.

[Unreleased]: https://github.com/enuzzo/catodo/compare/v2.1.1...HEAD
[2.1.1]: https://github.com/enuzzo/catodo/compare/v2.1.0...v2.1.1
[2.1.0]: https://github.com/enuzzo/catodo/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/enuzzo/catodo/releases/tag/v2.0.0
