# CATODO architecture

This document is the maintainer map for CATODO 2.6.0. It describes the runtime
boundaries, the data flow, and the invariants that should survive future UI and
feature work. For operational procedures and failure symptoms, see
[OPERATIONS.md](OPERATIONS.md).

## System at a glance

```text
User gesture / navigation
        |
        v
src/app.js  <---->  src/ui/* + styles/main.css
   |                         |
   |                         +-- persistent player and multiview DOM
   |
   +-- CatalogService -------+-- IndexedDB catalog and browser caches
   |       |                 +-- installation-api.php (shared canonical state)
   |       +-- iptv-org M3U and JSON directory
   |
   +-- EpgService -----------+-- approved XMLTV sources and local schedule cache
   |
   +-- PlayerManager / MultiviewController
           |-- hls.js or native HLS
           +-- optional Cloudflare Worker playback route

Remote logo URL --> authenticated logo-cache.php --> private .catodo-data/logos
```

CATODO is a vanilla ES-module application. `src/app.js` is the composition root
and state coordinator; it is intentionally not the data store or media engine.
The production artifact is built by Vite. Runtime assets use relative URLs so
the bundle remains compatible with subdirectories, although the official
deployment is the SiteGround root installation.

## Runtime surfaces

| Surface | Responsibility | Important boundary |
| --- | --- | --- |
| `src/app.js` | App state, navigation, rendering orchestration, user actions | Keep low-level parsing, persistence and player recovery out of this file |
| `src/ui/markup.js` | Persistent DOM construction and incremental rendering | Partial updates must not reset media properties unless the property is explicit |
| `src/data/` | Import, identity, deduplication, enrichment, search and persistence | Imported playlists and metadata are untrusted |
| `src/player/` | HLS lifecycle, endpoint fallback, multiview audio and telemetry | `tuned` is not proof that a first frame or audio was decoded |
| `src/epg/` | XMLTV fetch, cache, parsing and channel schedule matching | Guide URLs require user approval; large universal feeds are unsuitable for the browser |
| `public/*.php` | Installation-wide state and private logo cache | Both services require the signed login cookie |
| `index.php` + `.htaccess` | Official deployment login gate | `app.html`, credentials and `.catodo-data/` must remain inaccessible directly |
| `worker.js` | Optional stream proxy and HLS URI rewriting | This is not an anonymous general-purpose proxy |

## Catalog and identity

Playlist import follows this sequence:

1. The UI presents a provider/source and an explicit consent step.
2. `source-policy.js` validates the URL; a trusted iptv-org URL still requires
   confirmation. Deep links are inert intents and never fetch by themselves.
3. `fetcher.js` attempts the direct URL and then the configured catalog proxy.
   It enforces a 20 MB response limit and a 20-second timeout.
4. `m3u.js` parses at most 50,000 records and preserves relevant IPTV metadata.
5. Identity helpers prefer a normalized `tvg-id`; otherwise they use a
   conservative channel fingerprint. Endpoint identity includes request-relevant
   details. This is the basis of cross-playlist deduplication.
6. `replaceSourceSnapshot()` writes source, channel, endpoint and relation data
   atomically. A source points to one active last-known-good snapshot.
7. The safety directory is applied before a new snapshot becomes visible.
   Blocklisted content is excluded; NSFW content is hidden by default and never
   enters random playback.
8. Rich iptv-org metadata enrichment happens separately and atomically for
   channels and endpoints.

Do not identify favourites by stream URL. URLs and mirrors change; the stable
channel identity is the durable key.

### IndexedDB stores

Database `catodo-v2`, schema version 1, contains:

- `sources`, `snapshots`, `channels`, `endpoints`, `channelSources`;
- `favorites`, `history`, `aliases`;
- `settings` for browser caches and preferences, plus the durable installation
  outbox, recovery snapshot and short-lived multi-tab lease;
- `migrationJournal` for one-time legacy localStorage migration.

Changing a store or index requires increasing `DB_VERSION` and writing a safe
upgrade path. Do not delete or recreate the database as an upgrade strategy.

## Installation-wide state

The official PHP installation makes a small canonical configuration available
to every authenticated browser:

- approved playlist source descriptors;
- favourite channel IDs;
- catalog proxy URL;
- XMLTV source URLs and refresh cadence;
- validated Multiview presets (up to eight, with at most four channel IDs each)
  and the preferred 2/3/4-feed layout.

`installation-api.php` stores this in
`.catodo-data/installation-state.json`. Version 2 state includes a server-owned
legacy-migration marker. Writes are schema- and size-validated as a whole,
locked, revision-guarded and atomically renamed. Invalid or corrupt state fails
closed instead of being interpreted as an empty installation.

IndexedDB is still required. It holds parsed playlists, endpoints, metadata,
history and EPG caches close to each browser. When a browser sees a shared source
without a local active snapshot it refreshes that source locally. This avoids
turning the PHP service into a large catalog database.

### First migration invariant

New or valid version 1 server state is normalized to version 2 with
`migration.legacyInstallation = pending`. While pending, CATODO seeds it only
from a browser that already has at least one shared source, favourite or shared
setting. A pristine browser does not claim the migration. The first successful
conditional `link-merge` write changes the marker to `complete` on the server;
an older client cannot write version 1 state or downgrade the marker.

Once complete, the server is canonical and another browser never performs an
automatic legacy union. If retained browser data differs, CATODO stores a
versioned recovery snapshot and offers an explicit, additive recovery action in
Settings. This prevents a second browser with stale legacy data from silently
resurrecting a playlist or favourite that was deliberately removed elsewhere.

### Current synchronization semantics

The installation is a single-user configuration with optimistic revisions.
Every write requires the revision returned by a successful GET. Client
mutations are committed locally with absolute, idempotent intents in a durable
FIFO outbox. A failed head stays pending across reloads and blocks later writes;
Retry reloads the latest server revision and reapplies the same intent. After a
conflict or acknowledgement, the local projection is reconciled from canonical
server state plus the remaining outbox. A short IndexedDB lease prevents two
same-origin tabs from intentionally draining concurrently, while server
revisions remain the final concurrency guard. A stale full snapshot is never
replayed.

The PHP service serializes readers and writers through one lock and publishes a
fully flushed temporary file with an atomic rename. It is not a multi-user
account system or a general three-way merge engine. Browser-local history,
parsed data, metadata and EPG programme bodies are deliberately not
synchronized.

## Logo cache

External HTTPS channel logos are rewritten to
`logo-cache.php?url=<encoded-url>`. The service:

- requires the same signed HttpOnly cookie as the app;
- rejects credentials, non-HTTPS URLs, local/private IPv4 targets and unsafe
  redirects;
- limits redirects, accepted image MIME types and body size (2 MB);
- stores files privately under `.catodo-data/logos/` for 30 days;
- exposes a short private browser cache and falls back to the original URL,
  then initials, if fetching fails.

The cache improves consistency but does not grant rights in third-party logos.
It must stay private and must never evolve into an unrestricted fetch proxy.
The current DNS guard is conservative and IPv4-oriented; IPv6-only logo hosts
may fail closed.

## Playback model

`PlayerSlot` normalizes direct, fallback and proxy endpoints. It prefers hls.js
when Media Source Extensions are supported and otherwise uses native HLS. It
performs bounded network retries, bounded media recovery and endpoint fallback.

Important event meanings:

- `tuning`: an endpoint attempt is starting;
- `tuned`: a source was attached and `play()` was requested;
- `playing`: the media element is actually advancing;
- `autoplay-blocked`: a user gesture is required;
- `fatal`: retries/recovery for that path were exhausted.

Use the media element's `playing`, `waiting`, `pause` and `error` events for UI
truth. Remember watch history on `playing`, not on `tuned`.

### Audio invariant

All players attach muted to satisfy browser autoplay policy. Home stays muted
until a gesture. The single-channel player may open with the user's retained
volume after the click that opened it. UI rerenders must preserve `video.muted`
and `video.volume`; `setMedia()` changes mute only when a caller explicitly
provides it. Multiview accepts audio only after a user gesture and exactly one
slot may be audible. Entering Multiview from the single-channel player first
mutes, pauses and releases that player; the Multiview grid starts muted. Tapping
the currently audible Multiview slot again returns the grid to all-muted.

Stream diagnostics report manifest codec data plus measured browser counters.
`webkitAudioDecodedByteCount` is useful evidence in Chromium but is not portable;
`N/A` is correct when the browser exposes no decoded-audio counter. The browser
cannot prove that speakers are physically audible.

Successful endpoint choices are remembered locally after the media element emits
`playing`. A later tune prefers the most recently successful URL on that device,
then retains the normal bounded fallback order. This is local evidence, not a
global availability claim, and the compact history is never synchronized.

### Supported media and proxy boundary

The current engine is HLS-oriented. Platform pages, DASH manifests, RTMP/RTSP
and arbitrary progressive media are not interchangeable with HLS endpoints.
Browser-forbidden headers such as `User-Agent` and often `Referer` cannot be
reliably supplied by page JavaScript. Streams requiring them need a server-side
route.

The optional Worker proxies playback, not merely playlist discovery. It follows
redirects manually, validates each destination, rewrites variant/segment/key
URIs in HLS playlists, and restricts browser origins. Origin checks are not
authentication against a determined non-browser client; abuse would require a
stronger secret or authenticated edge architecture.

## EPG and TV Guide

`EpgService` combines installation-approved XMLTV sources with guide mappings
from enriched channel/feed metadata. It:

- accepts HTTP(S) sources only;
- limits each response to 20 MB;
- parses both the XMLTV channel registry and programmes, then caches them for six hours in IndexedDB;
- deduplicates concurrent fetches and uses stale cached programmes on failure;
- supports manual, 30-minute, hourly, six-hour and daily refresh preferences;
- returns an eight-hour schedule window by default.

Channel matching first considers explicit `tvgId`, internal identity and guide
site IDs, then compares conservative normalized channel names with XMLTV
`display-name` aliases. `HD`, `FHD`, `DTT`, punctuation and a trailing country
suffix are ignored; aggressive fuzzy matching is intentionally avoided. Source
diagnostics separately report download success, registry matches and the latest
programme timestamp, because a valid XML file can contain stale schedules.

The TV Guide exposes a shared horizontal timeline, search, a Favorites-only
view, honest coverage counts and only channels with programmes in the active
window. Times use the local timezone and 24-hour notation. The Italian preset
uses eight current Open EPG feeds; known expired GlobeTV Italy URLs are migrated
automatically. Because Open EPG does not expose browser CORS headers, production
uses an authenticated, host/path-allowlisted PHP cache and Vite supplies the same
narrow bridge during development. The broader GlobeTV catalog is cached for 24
hours and country file lists are loaded lazily; installed URLs remain
installation-wide settings while source status and programme bodies stay local
to each browser. Settings can export a versioned
JSON configuration backup and merge a validated backup into the installation;
runtime caches, credentials, logs and programme bodies are excluded.

Country profiles expose guide loading only when enriched channel metadata lists
real XMLTV source URLs. Activating it merges those URLs into the installation's
existing EPG sources, preserves the chosen refresh cadence and immediately
refreshes a bounded first set of country schedules. Missing mappings remain an
explicit unavailable state rather than generating provider URLs heuristically.

## UI, navigation and localization

The primary destinations are Live, Explore, Countries, Multiview, TV Guide and
Library. Settings is a separate setup surface. Fullscreen Player and Multiview
are persistent overlays rather than page rebuilds; closing a player reached
from Multiview returns to Multiview.

The interface is English today but all user-facing additions should receive an
i18n key. Locale files currently exist in two places:

- `locales/en.json` is the source/development mirror;
- `public/locales/en.json` is what Vite serves and copies to `dist/`.

Keep both files synchronized until the build has a single generated locale
source. Design for strings 30–40% longer than English and do not assume LTR in
new layout logic.

`styles/main.css` is the single design system and responsive stylesheet. The
visual language combines a structured broadcast grid, restrained rounding,
Exo 2 Variable, IBM Plex Mono for diagnostics, electric blue and EBU accents.
Interactive targets must remain comfortable on Tesla touch displays.

The boot ident is CSS/DOM animation controlled by `AnalogBoot`; it is skippable,
has a reduced-motion path and must not delay data initialization unnecessarily.

### Home Screen installation

`public/manifest.webmanifest` is the cross-platform Home Screen contract. It
keeps the production start URL on `/`, because the authenticated PHP gate is the
only legal entry point and direct access to `app.html` is denied. The manifest
requests standalone display and provides 192, 512 and 1024 px square PNGs.

`app.html` and the PHP login gate also declare Apple touch icons at 152, 167 and
180 px. Artwork remains square, opaque and unmasked; iOS/iPadOS applies the
platform corner treatment. The same centered vintage-TV silhouette is retained
at every size so the installed app remains recognizable; substantial cow horns
replace thin antenna strokes and make the Netmilk signature survive small Home
Screen sizes. Do not point the
manifest at `app.html`, add a pre-rounded mask to the source artwork, or cache
the authenticated shell in a service worker without a separate security review.

## Security and content boundaries

Security invariants that must not be weakened:

- every import, including a trusted preset, requires explicit consent;
- playlist, XMLTV, metadata, logo and stream URLs are untrusted input;
- `.htpasswd`, `app.html`, `.catodo-data/` and gate bookkeeping are not public;
- installation state and logo cache require the signed gate cookie;
- proxy and logo redirects are validated at every hop;
- URL/body/record limits remain enforced;
- CATODO stores external links and user-approved configuration, not bundled
  stream media, playlist snapshots, logo packs or programme archives.

See [../SECURITY.md](../SECURITY.md), [../CONTENT_POLICY.md](../CONTENT_POLICY.md)
and [../TAKEDOWN.md](../TAKEDOWN.md) for policy details.

## Test map

The Node test suite covers identity, parsing, migration, safety/enrichment,
source consent, installation synchronization, randomization, EPG parsing,
player recovery, multiview audio, telemetry, UI models, map math and Worker
redirect security. Run all three release gates:

```sh
npm test
npm run check
npm run build
```

PHP endpoints also need syntax checks against the built copies:

```sh
php -l dist/installation-api.php
php -l dist/logo-cache.php
```

Tests are strong at module boundaries but do not replace a real-browser smoke
test with a live HLS source, autoplay policy, pointer/touch behavior, fullscreen
transitions and actual hosting headers.

## Known architectural pressure points

- `src/app.js` and `src/ui/markup.js` are large. New product areas should prefer
  focused controllers/renderers instead of adding another broad switch branch.
- The production application chunk is large; boot-path code splitting and lazy
  loading of country/map or low-frequency surfaces are worthwhile future work.
- Installation synchronization has no accounts, per-device profiles or
  automatic backups; its intent rebase is deliberately narrower than a general
  three-way merge.
- The logo cache does not proactively refresh or garbage-collect unused files.
- Search indexing and full global catalogs can consume meaningful browser memory.
- EPG programme parsing is client-side and therefore intentionally bounded.
- Tesla browser capabilities vary by vehicle software; graceful degradation is
  a product requirement, not an optional polish pass.
