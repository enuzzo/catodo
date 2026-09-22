# CATODO code map

This is a routing map, not a required reading list or exhaustive file inventory.
Paths and symbols were checked against the checkout on 2026-09-20. Recheck the
relevant route as code changes; architecture owns the detailed contracts.

## Runtime flow

```text
app.html -> src/app.js -> src/ui/markup.js + styles/main.css
                  |
                  +-> CatalogService -> IndexedDB
                  |          +-> InstallationSync -> installation-api.php
                  +-> EpgService / CountryGuideResolver -> XMLTV / epg-cache.php
                  +-> PlayerManager / MultiviewController -> HLS / optional Worker

npm run build -> Vite -> protect-app-entry.mjs -> dist/.catodo-private/app.html
production / -> index.php + .htaccess -> authenticated private app entry
```

`src/app.js` is the composition root. `src/ui/markup.js` owns persistent DOM.
Keep a focused change in its owning module; follow cross-area edges when the
behavior crosses consent, persistence, playback or hosting boundaries.

## Where to start

| Task or symptom | Implementation entry points | Closest existing tests |
| --- | --- | --- |
| View/action/navigation | `src/app.js`, `src/ui/markup.js` (`makeActionDispatcher`, `mountAppUI`), `src/ui/view-mode.js` | `tests/ui/view-mode.test.js` plus rendered interaction |
| Home/Discover/channel picker | `src/ui/home-selection.js`, `explore-model.js`, `channel-picker-filter.js` | Same-named tests under `tests/ui/` |
| Library genres/filter results | `src/data/channel-categories.js`, `catalog-service.js`, `m3u.js`, `src/app.js`, `src/ui/markup.js` | `tests/data/channel-categories.test.js`, `m3u.test.js`, rendered search/reset/pagination |
| Connected source state/Settings sections | `src/ui/source-settings-model.js`, `markup.js`, `src/app.js` | `tests/ui/source-settings-model.test.js`, Settings shortcut/focus checks |
| Layout/branding/copy | `styles/main.css`, `app.html`, `src/ui/markup.js`, `src/i18n/index.js`, both locale mirrors | `tests/ui/branding-assets.test.js`, `tests/i18n/index.test.js`, rendered viewport checks |
| Import/consent/duplicate identity | `src/data/source-policy.js`, `fetcher.js`, `m3u.js`, `identity.js`, `catalog-service.js` | `tests/data/source-policy.test.js`, `m3u.test.js`, `identity.test.js`, `iptv-org-metadata.test.js` |
| DB/migration/shared favorites/settings | `src/data/db.js`, `migration.js`, `catalog-service.js`, `installation-sync.js`, `public/installation-api.php` | `tests/data/installation-sync.test.js`, `catalog-installation-sync.test.js`, `migration.test.js`, `tests/php/installation-api.test.js` |
| Configuration backup/Multiview presets | `src/data/backup.js`, `multiview-presets.js`, `src/ui/multiview-preset-model.js`, PHP schema | `tests/data/backup.test.js`, `tests/ui/multiview-preset-model.test.js`, sync/PHP tests |
| Tune/retry/no audio/fullscreen transition | `src/player/player-slot.js`, `player-manager.js`, `player-transition.js`, `src/ui/markup.js` (`setMedia`) | `tests/player/player-slot.test.js`, `player-manager.test.js`, `player-transition.test.js`, browser playback |
| Multiview/audio focus | `src/player/multiview-controller.js`, `src/app.js`, `src/ui/markup.js` | `tests/player/multiview-controller.test.js` plus browser gestures |
| Stream diagnostics | `src/player/stream-metrics.js`, `src/ui/telemetry-model.js`, `connection-model.js` | Same-named tests under `tests/player/` and `tests/ui/` |
| EPG discovery/cache/matching | `src/epg/catalog.js`, `presets.js`, `service.js`, `xmltv.js`, `public/epg-cache.php`, `vite.config.js` | `tests/epg/xmltv.test.js` includes catalog and service cases |
| Country/Favorite guide consent, timeline | `src/ui/country-guide-model.js`, `favorite-guide-model.js`, `guide-timeline-drag.js`, `guide-programme-card.js`, `src/app.js` | Same-named tests under `tests/ui/` |
| Map/loading/country labels | `src/ui/lazy-world-map.js`, `deferred-renderer.js`, `world-map.js`, `src/data/country-names.js`, `countries.js` | `tests/ui/deferred-renderer.test.js`, `world-map.test.js`, `tests/data/country-names.test.js` |
| Search/worker | `src/data/search.js`, `src/workers/catalog-search.worker.js`, `src/app.js` | Rendered search/filter integration; [synthetic fixtures](../tests/fixtures/README.md) |
| Boot/footer effects | `src/boot/signal-hyperjump.js`, `src/ui/signal-easter-egg.js`, `signal-easter-egg-model.js` | `tests/ui/signal-easter-egg-model.test.js`, reduced-motion/dismissal browser checks |
| Login/private app/host routing | `index.php`, `.htaccess`, `scripts/protect-app-entry.mjs`, `public/*.php` | `tests/security/deployment-boundary.test.js`, `tests/php/installation-api.test.js`, PHP lint and hosting checks |
| Playback proxy | `worker.js` | `tests/worker/redirect-security.test.js` |
| Version/build/deploy | `package.json`, `scripts/release.mjs`, `check-release.mjs`, `siteground-deploy.mjs`, `vite.config.js` | Release gate and deployment-boundary tests |

Basenames in a cell share the directory of that cell's preceding full path
unless a new directory is specified. Use `rg --files src tests scripts public`
when the route needs more detail; exclude `.env`, private data, generated output
and dependency trees from content searches.

## Appearance entry points

Appearance starts in `public/appearance.js`: shared synchronous PHP/app bootstrap,
palette registry, preference validation, Auto resolution and browser-local storage.
`src/ui/appearance-settings.js` owns Settings controls; `src/app.js` dispatches their
changes. `styles/main.css` uses semantic tokens. Start verification with
`tests/ui/appearance.test.js`; the bootstrap deliberately has no application or
media dependency.

## Theatre entry points

- `src/ui/theatre.js`: persistent shelf/player, consent, filters, credits and QR.
- `src/ui/theatre-artwork.js`: visibility-aware local artwork galleries and motion lifecycle.
- `src/ui/theatre-archive.js`, `src/data/theatre-archive-model.js`: lazy discovery index, source-image consent, filtering/ranking/pagination and exact reviewed-edition links.
- `scripts/theatre-index.py`, `scripts/compress-theatre-index.mjs`: reproducible public-directory snapshot and build-time gzip; parser/model fixtures in `tests/data/theatre-archive-model.test.js` and `tests/data/theatre-index-parser.py`.
- `src/data/theatre-collections.js`: original editorial collections and external Archive discovery links.
- `src/data/theatre-catalog.js`: reviewed edition metadata; evidence in the
  [register](work/2026-09-22-theatre-register.md).
- `src/data/theatre-model.js`, `src/player/theatre-player.js`: local favorites,
  filtering and native media lifecycle; corresponding `tests/data/` and
  `tests/player/` files.
- `src/ui/telemetry-model.js`: native buffer/frame evidence without transfer
  counters; `scripts/theatre-qr.mjs`: local source-QR regeneration.

## Cross-area changes to notice

- Shared setting: client schema + IndexedDB projection/outbox + PHP validation +
  configuration backup + relevant UI. A browser-only success is insufficient.
- Provider: resolver + service + PHP allowlist + Vite bridge + consent UI.
- Media UI: renderer + action coordinator + lifecycle/audio tests + browser.
- Entry/build: Vite + private-shell post-build step + PHP gate + host rules.

`dist/` and `node_modules/` are generated/local, not editing targets.
`public/` is copied into the build: keep agent documentation in `docs/`, not
in deployable assets. Vendored assets carry their own licenses/notices.
