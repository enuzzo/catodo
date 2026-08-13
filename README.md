# CATODO 2.3.0

<img src="public/icons/catodo-netmilk-tv-transparent-512.png" alt="CATODO horned CRT" width="150" align="right">

[![Worldwide signal](https://img.shields.io/badge/Signal-worldwide-0866FF?style=for-the-badge)](#experience)
[![Tesla first](https://img.shields.io/badge/Tesla-first-111111?style=for-the-badge&logo=tesla&logoColor=white)](#local-setup)
[![HLS player](https://img.shields.io/badge/HLS-live_player-F72C5B?style=for-the-badge)](#experience)
[![Zero illegal](https://img.shields.io/badge/ZERO_ILLEGAL-zero_pezzotto-00A86B?style=for-the-badge)](#zero-illegal-zero-pezzotto)
[![AGPL 3.0](https://img.shields.io/badge/License-AGPL--3.0-6B21A8?style=for-the-badge)](LICENSE)

**Public world television with a big-screen attitude.** CATODO is an open-source, Tesla-first web player for discovering user-approved live TV sources, crossing countries in a tap, loading XMLTV guides only when they are useful, and putting up to four signals on screen when one is clearly not enough.

*Why “CATODO”?* Because the cathode-ray tube was television before television became a row of anonymous black rectangles. CATODO keeps the zap, the colour bars, the oversized controls and a slightly unreasonable love for broadcast graphics — then gives the whole thing HLS, Multiview and a world map.

> [!IMPORTANT]
> **ZERO ILLEGAL. Zero pezzotto.** CATODO ships no channels, media, playlist snapshots, pirate subscriptions, credentials or DRM tricks. It is a player and discovery interface for external public directories and sources explicitly approved by the user. No decoderino sotto la TV, no guy on Telegram, no “trust me bro” annual renewal.

[Open the official installation](https://catodo.netmilk.dev/) · [Read the changelog](CHANGELOG.md) · [See the roadmap](docs/ROADMAP.md)

CATODO is licensed under [AGPL-3.0-or-later](LICENSE).

It is a vanilla ES-module application with no framework. Pinned runtime assets are vendored, so a CDN is not required to boot; Vite is used for the verified production bundle.

Release history is maintained in [CHANGELOG.md](CHANGELOG.md). `package.json` is
the version source of truth; maintainers prepare releases with
`npm run release -- X.Y.Z` and verify consistency with `npm run check`.

## Experience

- **Soft Signal Grid:** an editorial broadcast UI with electric-blue and EBU accents.
- **Home Live Anchor:** when a cached catalog is available, the first tile at left starts muted and stays live while you explore. Use **Random** beside it to switch quickly to another playable channel.
- **Explore collections:** Explore is a separate editorial surface built entirely from real catalog metadata. **All** shows eight-channel previews that can be randomized independently; category views expose the complete News, Sports, Movies, Music, Kids, Culture, or Local catalog with progressive loading and sorting by relevance, name, quality, or country.
- **Signal Atlas:** explore every country exposed by the upstream catalog, with global search and country discovery.
- **Country directories and guides:** load country channels progressively or reveal the complete filtered collection in one action. When enriched catalog metadata exposes listed XMLTV URLs, a country guide can be connected directly from its profile; the sources are saved in Settings and keep the existing refresh cadence.
- **Country flags:** the Countries index and country detail use self-hosted SVG artwork from the MIT-licensed `flag-icons` collection, with an ISO-code fallback.
- **Multiview:** 2-, 3-, or 4-feed layouts with a remembered four-feed default, renameable/deletable user presets, and exactly one selected audio feed.
- **Signal Lab:** playback diagnostics separate measured, estimated, and manifest-declared values.
- **Channel profiles:** when upstream metadata is available, Signal Lab also surfaces canonical channel, network, owner, category, feed, coverage, language, format, quality, availability, lifecycle, website, logo, and guide descriptors without inventing missing values.
- **Analog boot:** EBU colour bars descend, split around the Catodo ident, then open onto the live dashboard; reduced-motion users get a short static reveal.
- **Home Screen web app:** iPhone, iPad and compatible desktop/mobile browsers receive a standalone manifest plus purpose-built CATODO artwork: a full-canvas vintage CRT carrying EBU colour bars and Netmilk's unmistakable cow horns. Apple-specific 152, 167 and 180 px touch icons complement 192, 512 and 1024 px manifest assets.

## ZERO ILLEGAL. Zero pezzotto.

This boundary is not decorative legal confetti. CATODO ships software and a directory of external source links. It does **not** include playlist snapshots, stream media, video, permanent logo packs, pirate credentials, access-control bypasses, or EPG data. The iptv-org catalog is fetched only after the user has confirmed the provider and disclaimer; no playlist is imported before that consent.

The Settings page promotes **World — all countries**, the official complete worldwide directory, as the broadest one-step default. The Add Playlist dialog also includes country/language/category groupings, major regions, news, sports, movies and music. These are canonical external links, not bundled playlist copies. Selecting a preset only fills the consent dialog; CATODO contacts the source after explicit confirmation.

Multiple sources may be connected safely. CATODO merges records by stable channel identity (`tvg-id` when available, otherwise a conservative fingerprint) and canonical endpoint identity. Matching channels remain one library item while unique mirrors and source provenance are retained. After import, the UI reports how many channels were newly added and how many matched existing records.

CATODO uses the official iptv-org JSON directory as optional metadata: channels, feeds, streams, logos, categories, languages, guides and the upstream blocklist. Guide records are discovery mappings; CATODO can also read user-approved XMLTV URLs, cache parsed schedules locally, and never bundles or redistributes programme data. Settings offers manual, 30-minute, hourly, six-hour and daily refresh cadences. A manual or due refresh sends ETag and Last-Modified validators when the provider supplies them, so unchanged XML can return a compact `304` response. Automatic refresh runs while CATODO is open and checks again when the page becomes visible. Blocklisted sources are excluded and adult content is hidden from default discovery and random playback.

The Italy preset uses the eight current plain-XML feeds published by [Open EPG](https://www.open-epg.com/app/epgguide.php). CATODO automatically replaces the expired 2025 GlobeTV Italy mirror URLs in existing installations; an allowlisted same-origin cache bridges the provider's browser CORS policy without becoming a general-purpose proxy. The broader country picker still reads [GlobeTV's country-organised XMLTV repository](https://github.com/globetvapp/epg) and reports stale programme windows explicitly instead of treating a syntactically valid download as current coverage. Settings caches that country directory for 24 hours and fetches a selected country's plain `.xml` file list only after user consent. `.xml.gz` files remain excluded because the browser parser does not decompress them. CATODO deliberately does not ship or automatically contact a universal mega-feed: those archives can be hundreds of megabytes and are not appropriate for a browser/Tesla client. The [iptv-org EPG project](https://github.com/iptv-org/epg) supplies grabber tooling and channel mappings, not a hosted universal programme database; run its tools yourself if you need a controlled custom feed.

Publicly listed does not automatically mean universally licensed in every jurisdiction. Users remain responsible for ensuring they may access a source where they are. CATODO does not bypass DRM, subscriptions, authentication, geoblocking or provider controls. See [CONTENT_POLICY.md](CONTENT_POLICY.md), [TAKEDOWN.md](TAKEDOWN.md), and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Data and privacy

On the authenticated PHP installation, approved playlist sources, favourites, proxy configuration, and TV Guide source/cadence settings are canonical installation data and follow the user across browsers. IndexedDB remains a fast per-browser catalog/cache and refreshes any installation source that is new to that browser. A server-owned migration marker allows exactly one automatic merge of retained legacy browser data before the server becomes canonical; later retained data is offered as an explicit recovery instead of silently resurrecting deleted records. Shared changes use a persistent browser outbox, survive reloads and remain visibly pending after network failures. Static deployments without the PHP endpoints continue to use browser-only IndexedDB.

Remote channel logos are requested through an authenticated same-origin cache on the private installation. The cache accepts HTTPS images only, enforces public-host resolution, bounded redirects, supported image MIME types, and a 2 MB limit; it is not a general-purpose proxy. This improves durability and avoids every browser hotlinking separately, but does not change copyright or trademark ownership of third-party logos. If the cache cannot fetch a logo, the UI tries the original URL and then its text fallback.

The Italian TV Guide cache follows the same authenticated boundary and accepts only the eight documented Open EPG Italy URLs, with a 20 MB response ceiling and six-hour server cache. Vite provides the same narrow bridge during local development.

## Local setup

Requirements: a current browser with ES modules; Node.js for tests and development utilities. Playback additionally depends on browser HLS/MSE support and the codec, network, CORS, and geographic availability of each third-party source.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite.

```sh
npm test
npm run check
```

The test suite covers catalogue parsing, import policy and migration, random selection, and player/multiview behaviour. `npm run check` performs syntax checks.

## Deployment

### SiteGround (official)

The official hosted instance is [catodo.netmilk.dev](https://catodo.netmilk.dev/).
It runs the Vite production bundle behind the repository's PHP login gate on
SiteGround. GitHub Pages is intentionally disabled and the repository does not
contain an automatic Pages deployment workflow.

To produce the hosting artifact:

```sh
npm ci
npm test
npm run check
npm run build
```

Deploy the generated `dist/` directory over HTTPS; Vite copies the authenticated
PHP services from `public/` into that bundle. Do not publish the source tree as
the application runtime. Maintainers with a local `.env` can publish these
runtime artifacts with `npm run deploy:siteground`; the script updates the
versioned access rules while leaving the existing login endpoint and credentials
untouched. The PHP runtime creates private `.catodo-data/` state/cache files,
which must remain blocked from HTTP access and preserved across deploys.

### Cloudflare Worker proxy (optional)

`worker.js` is an optional Cloudflare Worker for third-party streams that need CORS handling, HTTPS-to-HTTP bridging, or compatible request headers. Deploy it in **Workers & Pages**, keep `ALLOWED_ORIGINS` restricted to the intended CATODO sites, and configure its URL in CATODO. The proxy is not a bypass for access controls, DRM, geoblocking, or content rights; keep its destination restrictions and origin checks intact.

## Limits and compatibility

- Tesla/in-car Chromium variants have constrained CPU, memory, MSE, and codec support. A stream that works in VLC may still fail in the browser.
- Multiview starts multiple independent decoders. Four feeds are the product default and have been validated on the target Tesla installation; individual vehicles, codecs, thermal conditions, or networks can still reduce capacity. CATODO never silently downgrades the layout and keeps one audio feed to reduce noise, not decoder load.
- HLS, codecs, CORS policy, mixed-content blocking, hotlink protection, and geoblocking are controlled by external sources and may change without notice.
- The analog boot sequence is decorative, uses lightweight CSS transforms and respects reduced-motion preferences.

CATODO can be added to the Home Screen from the browser's system share/install
flow. On iOS and iPadOS the browser owns that command; a website cannot invoke
the native **Add to Home Screen** sheet directly. The manifest and touch icons
ensure that the installed item opens standalone and uses CATODO artwork instead
of a page screenshot or generated monogram.

## Locales

English is the current product locale. Add future locales as `locales/<language-tag>.json`, mirror them under `public/locales/` for the production bundle, keep keys aligned with `locales/en.json`, and register/select the locale through the i18n service. UI layouts intentionally allow for strings roughly 30–40% longer than English.

## Dependencies

Runtime dependencies are pinned and vendored: hls.js, Phosphor Icons, SVG Maps World, `flag-icons` 7.5.0 (self-hosted SVG, MIT), and Exo 2 Variable (self-hosted, OFL-1.1) for the interface. IBM Plex Mono is self-hosted only for diagnostic statistics. `fake-indexeddb` is loaded only as an in-memory compatibility fallback when IndexedDB is absent. Development utilities include `basic-ftp` and `bcryptjs`. Licences and notices are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Security

Treat every imported playlist and stream endpoint as untrusted input. Read [SECURITY.md](SECURITY.md) for the reporting process and deployment guidance.

## Maintainer documentation

- [Architecture](docs/ARCHITECTURE.md): runtime boundaries, data model, playback,
  installation synchronization, EPG, security invariants and pressure points.
- [Operations and gotchas](docs/OPERATIONS.md): development, release, migration
  and symptom-oriented troubleshooting.
- [Roadmap](docs/ROADMAP.md): shipped scope, remaining validation and future work.
- [Independent review brief](docs/REVIEW_BRIEF.md): scope and output contract for
  code, product and UI/UX inspections.
