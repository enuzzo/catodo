# CATODO maintainer runbook

This runbook covers common development, diagnosis and release tasks. The design
and runtime boundaries are documented in [ARCHITECTURE.md](ARCHITECTURE.md).

## Local development

```sh
npm install
npm run dev
```

Vite serves the frontend, but it does not execute the PHP services. A local Vite
session therefore uses browser-only storage: requests to `installation-api.php`
and `logo-cache.php` will fail or return the dev fallback. Test installation-wide
sync and the authenticated logo cache on a PHP-capable environment.

The QA query parameter used by visual development should never be treated as a
production data source. Use real imported channels for playback validation.

## Release checklist

1. Inspect `git status` and preserve unrelated/user changes.
2. Add every user-visible change to `CHANGELOG.md` under **Unreleased**, then
   prepare the release with `npm run release -- X.Y.Z`. Use a patch version for
   compatible fixes, a minor version for backward-compatible features and a
   major version only for breaking changes.
3. Run:

   ```sh
   npm test
   npm run check
   npm run build
   php -l dist/installation-api.php
   php -l dist/logo-cache.php
   git diff --check
   ```

   Confirm that `dist/manifest.webmanifest` and the complete `dist/icons/`
   family exist. Installable iOS/PWA icon PNGs must be square and opaque; the
   website brand/favicons must remain true RGBA with transparent corners.

4. Smoke-test the production bundle in a real Chromium browser:
   navigation, search, favourites, a single player, volume/mute, player chrome,
   Multiview audio focus, channel replacement and return navigation.
5. Commit and push `main` intentionally.
6. Deploy with `npm run deploy:siteground`.
7. Verify the public security boundary without credentials:

   ```sh
   curl -sI https://catodo.netmilk.dev/installation-api.php
   curl -sI https://catodo.netmilk.dev/logo-cache.php
   curl -sI https://catodo.netmilk.dev/.catodo-data/installation-state.json
   curl -sI https://catodo.netmilk.dev/app.html
   curl -sI https://catodo.netmilk.dev/manifest.webmanifest
   curl -sI https://catodo.netmilk.dev/icons/apple-touch-icon-netmilk-180.png
   ```

   Expected: authenticated services return `401`; private storage and direct
   `app.html` return `403`; the manifest and touch icon return `200`.
8. Sign in normally and verify that the built app loads. The official deployment
   is SiteGround; GitHub Pages is intentionally not the release target.
9. On a real iPhone or iPad, use Share → **Add to Home Screen**, confirm the CRT
   icon is sharp and centered, then launch it and verify standalone navigation,
   safe-area padding, playback and return behavior.

The deploy script uploads protective `.htaccess` and the versioned PHP login
gate before `dist/`. It does not delete the remote directory, `.htpasswd`, login
bookkeeping or `.catodo-data/`.

`package.json` is the only version source of truth. Vite injects it into the
splash and frontend JavaScript and emits `version.json`, which the PHP login gate
reads at runtime. `npm run check` deliberately fails when the lockfile,
changelog, maintainer documents or build wiring are stale, so version and
release notes cannot be forgotten silently.

## First installation-state migration

After deploying installation synchronization for the first time:

1. Before opening CATODO, preserve the profile/storage of the browser that
   already contains the intended playlists, favourites or settings.
2. Visit CATODO first with that browser. While the server migration marker is
   `pending`, its first upgraded visit queues a durable `link-merge`. The server
   changes the marker to `complete` only after the conditional write succeeds.
3. Wait for Settings to show **Shared library connected**. If it instead offers
   **Recover retained data**, inspect and confirm that explicit recovery before
   opening other browsers.
4. Open a second browser and confirm that sources and favourites appear. That
   browser downloads and parses each shared playlist into its own IndexedDB;
   **Restoring shared channels** is expected during that bounded hydration.

A pristine browser will not seed an empty installation. If every browser is
empty, import/configure a source normally and the first mutation creates the
canonical state. Do not delete `.catodo-data/installation-state.json` to reset a
library: a deliberate empty state is a revisioned write with `updatedAt > 0`,
whereas a missing/pristine file intentionally reopens the recovery window.

## Playback diagnosis

### Video opens but has no sound

Check the Player overlay or Signal Lab in this order:

- `Muted` and volume: a zero volume is treated as mute.
- `Paused`/`playing`: autoplay may have been blocked despite source attachment.
- audio codec: manifest metadata such as `mp4a.40.2` confirms an audio rendition
  was advertised.
- decoded audio bytes: a growing Chromium counter confirms audio data reached
  the decoder. `N/A` means the browser exposes no compatible counter.
- endpoint/route: compare direct and proxy paths.

Do not infer success from `tuned`; use `playing`, advancing `currentTime` and
decoded counters. A browser cannot confirm speakers, OS mixer state or physical
audibility. Avoid rerender code that assigns `video.muted` or `video.volume`
implicitly.

### Stream works in VLC but not CATODO

Typical causes are CORS, mixed HTTP content, unsupported codec, geoblocking,
expiring tokens, a required forbidden header, DRM, or a non-HLS URL mislabeled
as HLS. Inspect the browser network panel and hls.js errors. Use the optional
Worker only for compatible, authorized sources; it must rewrite all HLS variant,
segment and key URLs, not merely the top-level manifest.

### Fullscreen exits or the stream restarts after a UI action

The media DOM must remain persistent across catalog subscriptions and partial
renders. Inspect calls to `showPlayer`, `updatePlayer`, `setMedia` and overlay
mode transitions. Favourite, schedule, telemetry and chrome updates must update
only their intended properties and must not recreate or retune the video.

### Multiview audio is silent

Audio focus requires a real user gesture. Confirm that the chosen slot is
registered and activated, only that slot is unmuted, and `video.play()` is
retried inside the gesture handler. Layout recreation resets focus, gesture and
audio state by design.

## Catalog diagnosis

### Only a small number of channels appear

Check Sources before blaming parsing. The source count reports parsed records;
a country playlist may genuinely contain only a few dozen channels. Home is a
curated/random sample, not the total library. A global import can contain many
thousands of channels and take time to enrich/index.

### Duplicate channels

Deduplication prefers `tvg-id`; sources without a stable ID use conservative
metadata fingerprints. Similar display names are not sufficient proof of a
duplicate. Inspect channel ID, aliases, endpoint IDs and source provenance
before changing identity rules: aggressive merging can combine regional feeds
that should stay separate.

### Import fails

Confirm consent was explicitly submitted, URL scheme is HTTP(S), response is
under 20 MB, text is M3U, the request completes within 20 seconds, and direct or
configured proxy access is possible. A safety metadata failure deliberately
rolls back the staged source snapshot rather than exposing unchecked content.

### Search appears stale

Search is rebuilt from hydrated catalog rows. Verify the source has an active
snapshot and enrichment has completed. Large global catalogs use a worker;
avoid synchronous fuzzy work across the full catalog on every keystroke.

## TV Guide diagnosis

- Source configuration and cadence are installation-wide; programme bodies are
  browser-local caches.
- Automatic cadence is checked while the app is open and again on visibility.
  CATODO is not a background server scheduler.
- Each XMLTV response is limited to 20 MB. Large compressed or universal feeds
  need a server-side preprocessing pipeline, not a larger browser limit.
- Missing programmes usually indicate identifier mismatch, not a rendering bug.
  Compare channel `tvgId`, guide `siteId` and the XMLTV `<channel id>`.
- A successful XML download is not proof of current coverage. Source diagnostics
  show the latest programme timestamp and mark feeds whose window has ended.
- Existing GlobeTV Italy URLs are migrated to the eight current Open EPG feeds.
  `epg-cache.php` accepts only those allowlisted URLs; a `400` indicates a URL
  outside that boundary and a `502` indicates an upstream/download failure.
- Failed refreshes may intentionally show stale cached programmes.

## Installation sync diagnosis

The local Vite server cannot execute PHP, but it supplies a narrow development
bridge for the allowlisted Italian EPG feeds. On the official host:

- `401` from `installation-api.php` means the gate cookie is absent/expired;
- `404`/`405` disables installation sync and the client remains browser-local;
- `428` means a client attempted an unsafe write without first loading a
  revision; current clients must never produce it;
- `409` is an optimistic revision conflict and is reloaded/retried once;
- load/save failures are shown as **Shared storage unavailable** and do not
  destroy the local catalog. Do not treat a browser-local success as proof that
  another browser can see the change while this status is present.

The canonical file is private server state. Do not edit it manually while the
app is writing. The in-product configuration backup covers sources, Favorites,
proxy and guide settings, plus Multiview presets/layout; browser caches,
programme bodies and operational sync records remain excluded. Also back up the
private server state at the hosting layer before migration or major schema work.

## Logo cache diagnosis

A missing logo falls back to the original remote URL and then channel initials.
Common cache rejections are non-HTTPS URLs, private/localhost DNS results,
redirects to unsafe hosts, bodies over 2 MB, unsupported MIME types and IPv6-only
hosts. Preserve `401` for unauthenticated callers and `403` for `.catodo-data/`.

The cache is not evidence of a licence. Keep attribution notices current and
honour takedown requests regardless of cache expiry.

## Localization gotcha

Every English key is mirrored in both `locales/en.json` and
`public/locales/en.json`. Vite's `publicDir` means the latter is the production
runtime copy. Update both and keep their object shape identical. A future build
step should generate one from the other to remove this footgun.

## Hosting and secrets

- `.env` and `.htpasswd` are secrets and are never committed.
- `.env.example` documents names only; deployment reads FTP credentials locally.
- The PHP gate signs a 30-day HttpOnly, Secure, SameSite=Lax cookie using the
  stored password hash. Rotating `.htpasswd` invalidates existing cookies.
- Failed login attempts are rate-limited per remote IP in `.gate-attempts.json`.
- Do not replace the SiteGround gate with frontend-only hiding.
- Keep Worker `ALLOWED_ORIGINS` explicit. CORS headers alone are not access
  control for non-browser clients.

## High-value future engineering work

These are candidates, not committed roadmap promises:

1. Split `src/app.js` into destination controllers and split UI renderers by
   surface while retaining persistent media elements.
2. Lazy-load map/country and low-frequency product areas to reduce the large
   initial JavaScript chunk.
3. Generate production locale files from one canonical source and add a key
   parity test.
4. Add authenticated export/import and timestamped backups for installation
   configuration.
5. Add logo cache garbage collection and health/size visibility.
6. Add browser-level smoke tests for player audio state, overlay return paths,
   touch targets and navigation regressions.
7. Add source health and last-known-good visibility without claiming universal
   availability from upstream metadata.
