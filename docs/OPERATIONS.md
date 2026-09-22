# CATODO maintainer runbook

This runbook covers common development, diagnosis and release tasks. The design
and runtime boundaries are documented in [ARCHITECTURE.md](ARCHITECTURE.md).

## Local development

```sh
npm ci
npm run dev
```

In a Dropbox checkout, wait for Git metadata and dependencies to be available
offline before diagnosing stalled commands. Downloading `node_modules/` from
another Mac does not make its native packages compatible with this machine.
If Rollup/esbuild reports a missing platform package, verify `process.arch` and
restore the locked dependencies locally with
`npm ci --ignore-scripts --no-audit --no-fund`. Do not delete or regenerate the
lockfile to fix a platform mismatch. Keep `node_modules/` and `dist/` out of Git.

Vite serves the frontend, but it does not execute the PHP services. A local Vite
session therefore uses browser-only storage: requests to `installation-api.php`
and `logo-cache.php` will fail or return the dev fallback. Test installation-wide
sync and the authenticated logo cache on a PHP-capable environment.

The QA query parameter used by visual development should never be treated as a
production data source. Use real imported channels for playback validation.

## Release checklist

### Refresh the film discovery index

Use Python 3, curl and a new dated cache **outside the repository**. No account,
API token or movie download is needed:

```sh
npm run index:theatre -- --cache /tmp/catodo-index-YYYY-MM-DD --pdm-covers
node --test tests/data/theatre-archive-model.test.js
```

The indexer follows all Archive cursors, reads the direct Open Culture / Public
Domain Movies directory lists and (with `--pdm-covers`) retrieves public post
image metadata at a maximum concurrency of two. Collection links are not
recursively expanded. Failed directory parsing or incomplete/repeated Archive
responses must not replace the previous snapshot. Inspect the manifest counts,
cover failures and changes before publication; cached responses intentionally
make a run reproducible, so use a fresh dated cache for a live refresh.

For an offline replay, optional `--archive-input`, `--oc-input` and `--pdm-input`
accept previously captured public data. Keep those raw captures outside Git;
only the factual `public/theatre/archive-index.json` belongs in the release.
`npm run build` also emits its gzip copy. Verify both deployed artifacts against
the build and test the versioned request actually used by the browser. This
refresh indexes discovery metadata only and never admits new player editions.

### Publish a release

Use this checklist when release/publication is in the authorized task scope;
reading it during local maintenance does not authorize a deployment.

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
   php -l dist/epg-cache.php
   php -l index.php
   git diff --check
   ```

   Confirm that `dist/manifest.webmanifest` and the complete `dist/icons/`
   family exist. Installable iOS/PWA icon PNGs must be square and opaque; the
   website brand/favicons must remain true RGBA with transparent corners.

4. Smoke-test the production bundle in a real Chromium browser:
   navigation, search, favourites, a single player, volume/mute, player chrome,
   Multiview audio focus, channel replacement and return navigation.
5. Commit and push the intended branch within the task scope; the official
   release branch is `main`. Apply the Git/worktree notes below.
6. Deploy with `npm run deploy:siteground`.
7. Verify the public security boundary without credentials:

   ```sh
   curl -sI https://catodo.app/installation-api.php
   curl -sI https://catodo.app/logo-cache.php
   curl -sI https://catodo.app/epg-cache.php
   curl -sI https://catodo.app/.catodo-data/installation-state.json
   curl -sI https://catodo.app/.catodo-private/app.html
   curl -sI https://catodo.app/app.html
   curl -sI https://catodo.app/manifest.webmanifest
   curl -sI https://catodo.app/icons/apple-touch-icon-netmilk-180.png
   ```

   Expected: authenticated services return `401`; private storage, the private
   app entry and legacy `app.html` route return `403`; the manifest and touch
   icon return `200`.
8. Fetch production `version.json` with a cache buster such as
   `https://catodo.app/version.json?release=X.Y.Z` and compare the returned version
   to `package.json`. A stale response without a cache buster does not prove
   upload failure. Sign in normally and verify that the built app loads. The
   official deployment is SiteGround; GitHub Pages is intentionally not the release target.
9. On a real iPhone or iPad, use Share → **Add to Home Screen**, confirm the CRT
   icon is sharp and centered, then launch it and verify standalone navigation,
   safe-area padding, playback and return behavior.

The build moves the player shell to `dist/.catodo-private/app.html`, outside the
public static namespace. The deploy script uploads protective `.htaccess` and
the versioned PHP login gate before `dist/`, then removes any legacy public
`app.html`. It does not delete the remote directory, `.htpasswd`, login
bookkeeping or `.catodo-data/`.

`package.json` is the only version source of truth. Vite injects it into the
splash and frontend JavaScript and emits `version.json`, which the PHP login gate
reads at runtime. `npm run check` deliberately fails when the lockfile,
changelog, maintainer documents or build wiring are stale, so version and
release notes cannot be forgotten silently.

## Git and worktree publication

- Codex worktrees share the primary checkout's Git metadata outside the
  worktree sandbox. Read-only Git commands can run normally, but commands that
  write Git metadata (`git add`, `git commit`) and network publication
  (`git push`) should request escalated execution on the first attempt. An
  `index.lock: Operation not permitted` error here is a sandbox boundary, not
  repository corruption; do not delete locks or retry blindly.
- This repository's `origin` uses HTTPS with the macOS `osxkeychain` credential
  helper. A routine push to an existing tracked branch uses native Git and does
  not depend on the separate `gh` token. Treat `gh auth status` as a prerequisite
  only for operations that actually use GitHub CLI/API features, such as opening
  a pull request or editing a GitHub release; an expired `gh` token alone must
  not block a normal `git push`.
- When deploying from a worktree, the deployment `.env` is intentionally stored
  only in the primary checkout,
  whose root is the parent of `git rev-parse --git-common-dir`; Codex worktrees
  normally have no local `.env`. Before `npm run deploy:siteground`, resolve and
  confirm that primary `.env` without printing its contents, expose it to the
  worktree only through a temporary `.env` symlink, and remove the symlink after
  every success or failure. Verify that the worktree no longer contains `.env`
  before finishing.
- Verify a deployment with a cache-busting request to production
  `version.json` (for example `?release=X.Y.Z`). A stale response without a
  cache buster is not evidence that the FTP upload failed.

The primary checkout keeps its original `.env`; never remove it as worktree
cleanup. Resolve a relative `--git-common-dir` against the current directory.
Create the temporary symlink only if no worktree `.env` already exists, arrange
cleanup before running the uploader, and verify removal on failure as well as
success. Do not display credential contents.

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

## Appearance diagnosis

Settings → Appearance shows the active palette and whether the browser or local
clock chose it. Auto respects the browser's light/dark response; Tesla display
Auto is not proof that its browser forwards this preference. Select **Local time**
if it stays light at night: day is 07:00–19:00 in the device's timezone. Appearance
is browser-local and excluded from shared configuration/backups. A blocked store
retains a session-only choice. Verify the versioned `appearance.js` on the login
and authenticated app after deployment; it is a public script with no credentials.

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
- Direct XMLTV responses are limited to 20 MB. The authenticated built-in cache
  accepts only allowlisted Open EPG country XML and EPGShare01 country archives,
  caps compressed downloads at 12 MB and expanded XML at 32 MB. Larger or
  universal feeds still need a dedicated server-side preprocessing pipeline.
- Missing programmes usually indicate identifier mismatch, not a rendering bug.
  Compare channel `tvgId`, guide `siteId` and the XMLTV `<channel id>`.
- A successful XML download is not proof of current coverage. Source diagnostics
  show the latest programme timestamp and mark feeds whose window has ended.
- Existing GlobeTV Italy URLs are migrated to the eight current Open EPG feeds.
  Country discovery checks the cached Open EPG JSON catalog, then the allowlisted
  EPGShare01 country tag, and uses GlobeTV only as a final repository fallback.
  `epg-cache.php` accepts only those provider/path combinations; a `400` indicates
  a URL outside that boundary and a `502` indicates an upstream, archive or size
  failure. Current-source validation removes stale, empty and implausibly future
  feeds from Preferences after a country refresh.
- Failed refreshes may intentionally show stale cached programmes.

## Installation sync diagnosis

The local Vite server cannot execute PHP, but it supplies a narrow development
bridge for allowlisted Open EPG and EPGShare01 country sources. On the official
host:

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

## Future engineering work

Use [ROADMAP.md](ROADMAP.md) as the single queue for engineering candidates.
Manual configuration export/import already exists; timestamped/automatic recovery
and other backup extensions remain separate proposals there.
