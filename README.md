# CATODO 2.0

CATODO is an open-source, Tesla-first web player for discovering and watching public live television sources. It is licensed under [AGPL-3.0-or-later](LICENSE).

It is a vanilla ES-module application with no framework. Pinned runtime assets are vendored, so a CDN is not required to boot; Vite is used for the verified production bundle.

## Experience

- **Soft Signal Grid:** an editorial broadcast UI with electric-blue and EBU accents.
- **Home Live Anchor:** when a cached catalog is available, the first tile at left starts muted and stays live while you explore. Use **Random** beside it to switch quickly to another playable channel.
- **Explore collections:** Explore is a separate editorial surface built entirely from real catalog metadata. Filter ready-made rails for News, Sports, Movies, Music, Kids, Culture, and Local television; preview one live feed muted or use **Surprise me** to jump into a world-random channel.
- **Signal Atlas:** explore every country exposed by the upstream catalog, with global search and country discovery.
- **Country flags:** the Countries index and country detail use self-hosted SVG artwork from the MIT-licensed `flag-icons` collection, with an ISO-code fallback.
- **Multiview:** 2-, 3-, or 4-feed layouts; exactly one selected feed supplies audio.
- **Signal Lab:** playback diagnostics separate measured, estimated, and manifest-declared values.
- **Channel profiles:** when upstream metadata is available, Signal Lab also surfaces canonical channel, network, owner, category, feed, coverage, language, format, quality, availability, lifecycle, website, logo, and guide descriptors without inventing missing values.
- **Analog boot:** EBU colour bars descend, split around the Catodo ident, then open onto the live dashboard; reduced-motion users get a short static reveal.

## Content boundary

CATODO ships software and a directory of external source links. It does **not** include playlist snapshots, stream media, video, permanent logo packs, or EPG data. The iptv-org catalog is fetched only after the user has confirmed the provider and disclaimer; no playlist is imported before that consent.

The Settings page promotes **World — all countries**, the official complete worldwide directory, as the broadest one-step default. The Add Playlist dialog also includes country/language/category groupings, major regions, news, sports, movies and music. These are canonical external links, not bundled playlist copies. Selecting a preset only fills the consent dialog; CATODO contacts the source after explicit confirmation.

Multiple sources may be connected safely. CATODO merges records by stable channel identity (`tvg-id` when available, otherwise a conservative fingerprint) and canonical endpoint identity. Matching channels remain one library item while unique mirrors and source provenance are retained. After import, the UI reports how many channels were newly added and how many matched existing records.

CATODO uses the official iptv-org JSON directory as optional metadata: channels, feeds, streams, logos, categories, languages, guides and the upstream blocklist. Guide records are discovery mappings; CATODO can also read user-approved XMLTV URLs, cache parsed schedules locally, and never bundles or redistributes programme data. Settings offers manual, 30-minute, hourly, six-hour and daily refresh cadences. A manual or due refresh revalidates through the browser HTTP cache, so providers that publish ETag or Last-Modified metadata do not need to resend unchanged XML. Automatic refresh runs while CATODO is open and checks again when the page becomes visible. Blocklisted sources are excluded and adult content is hidden from default discovery and random playback.

The recommended free EPG preset links to [GlobeTV's country-organised XMLTV repository](https://github.com/globetvapp/epg) (GPL-3.0, updated daily). CATODO currently provides the five Italy XML files as a one-click, consent-gated preset and links to the provider's worldwide country catalog. It deliberately does not ship or automatically contact a universal mega-feed: those archives can be hundreds of megabytes and are not appropriate for a browser/Tesla client. The [iptv-org EPG project](https://github.com/iptv-org/epg) supplies grabber tooling and channel mappings, not a hosted universal programme database; run its tools yourself if you need a controlled custom feed.

Users are responsible for ensuring they may access a source in their jurisdiction. See [CONTENT_POLICY.md](CONTENT_POLICY.md), [TAKEDOWN.md](TAKEDOWN.md), and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Data and privacy

On the authenticated PHP installation, approved playlist sources, favourites, proxy configuration, and TV Guide source/cadence settings are canonical installation data and follow the user across browsers. IndexedDB remains a fast per-browser catalog/cache and refreshes any installation source that is new to that browser. Existing legacy browser storage is migrated on first use. A failed refresh does not replace the last known-good snapshot. Static deployments without the PHP endpoints continue to use browser-only IndexedDB.

Remote channel logos are requested through an authenticated same-origin cache on the private installation. The cache accepts HTTPS images only, enforces public-host resolution, bounded redirects, supported image MIME types, and a 2 MB limit; it is not a general-purpose proxy. This improves durability and avoids every browser hotlinking separately, but does not change copyright or trademark ownership of third-party logos. If the cache cannot fetch a logo, the UI tries the original URL and then its text fallback.

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
- Multiview starts multiple independent decoders. On Tesla hardware, 2 feeds is the practical default; 3 or 4 can exhaust decoder, thermal, or network capacity. CATODO keeps one audio feed to reduce noise, not decoder load.
- HLS, codecs, CORS policy, mixed-content blocking, hotlink protection, and geoblocking are controlled by external sources and may change without notice.
- The analog boot sequence is decorative, uses lightweight CSS transforms and respects reduced-motion preferences.

## Locales

English is the current product locale. Add future locales as `locales/<language-tag>.json`, mirror them under `public/locales/` for the production bundle, keep keys aligned with `locales/en.json`, and register/select the locale through the i18n service. UI layouts intentionally allow for strings roughly 30–40% longer than English.

## Dependencies

Runtime dependencies are pinned and vendored: hls.js, Phosphor Icons, SVG Maps World, `flag-icons` 7.5.0 (self-hosted SVG, MIT), and Exo 2 Variable (self-hosted, OFL-1.1) for the interface. IBM Plex Mono is self-hosted only for diagnostic statistics. `fake-indexeddb` is loaded only as an in-memory compatibility fallback when IndexedDB is absent. Development utilities include `basic-ftp` and `bcryptjs`. Licences and notices are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Security

Treat every imported playlist and stream endpoint as untrusted input. Read [SECURITY.md](SECURITY.md) for the reporting process and deployment guidance.
