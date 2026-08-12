# CATODO 2.0

CATODO is an open-source, Tesla-first web player for discovering and watching public live television sources. It is licensed under [AGPL-3.0-or-later](LICENSE).

It is a vanilla ES-module application with no framework. Pinned runtime assets are vendored, so a CDN is not required to boot; Vite is used for the verified production bundle.

## Experience

- **Soft Signal Grid:** an editorial broadcast UI with electric-blue and EBU accents.
- **Home Live Anchor:** when a cached catalog is available, the first tile at left starts muted and stays live while you explore. Use **Random** beside it to switch quickly to another playable channel.
- **Signal Atlas:** explore every country exposed by the upstream catalog, with global search and country discovery.
- **Country flags:** the Countries index and country detail use self-hosted SVG artwork from the MIT-licensed `flag-icons` collection, with an ISO-code fallback.
- **Multiview:** 2-, 3-, or 4-feed layouts; exactly one selected feed supplies audio.
- **Signal Lab:** playback diagnostics separate measured, estimated, and manifest-declared values.
- **Channel profiles:** when upstream metadata is available, Signal Lab also surfaces canonical channel, network, owner, category, feed, coverage, language, format, quality, availability, lifecycle, website, logo, and guide descriptors without inventing missing values.
- **Resilient boot:** a Three.js r162 signal sequence uses capability detection and a graceful non-WebGL fallback.

## Content boundary

CATODO ships software and a directory of external source links. It does **not** include playlist snapshots, stream media, video, permanent logo packs, or EPG data. The iptv-org catalog is fetched only after the user has confirmed the provider and disclaimer; no playlist is imported before that consent.

CATODO uses the official iptv-org JSON directory as optional metadata: channels, feeds, streams, logos, categories, languages, guides and the upstream blocklist. Guide records are discovery mappings only; CATODO does not bundle or redistribute programme data. Blocklisted sources are excluded and adult content is hidden from default discovery and random playback.

Users are responsible for ensuring they may access a source in their jurisdiction. See [CONTENT_POLICY.md](CONTENT_POLICY.md), [TAKEDOWN.md](TAKEDOWN.md), and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Data and privacy

Sources, imported catalog snapshots, favourites, history, and settings stay on the device in IndexedDB. Existing legacy browser storage is migrated on first use. A failed refresh does not replace the last known-good snapshot. If an unusually restricted embedded browser exposes no IndexedDB at all, CATODO falls back to an in-memory session catalog and does not claim persistence.

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

### GitHub Pages (official)

CATODO is published from the Vite production bundle. A push to `main` runs
`.github/workflows/deploy-pages.yml`: it uses Node.js 22, installs the locked
dependencies, runs tests and syntax checks, builds `dist/`, and deploys that
artifact to GitHub Pages. The public site is
[enuzzo.github.io/catodo](https://enuzzo.github.io/catodo/).

For an equivalent self-hosted release:

```sh
npm ci
npm test
npm run check
npm run build
```

Deploy only the generated `dist/` directory over HTTPS. Do not publish the
source tree as the application runtime.

### Cloudflare Worker proxy (optional)

`worker.js` is an optional Cloudflare Worker for third-party streams that need CORS handling, HTTPS-to-HTTP bridging, or compatible request headers. Deploy it in **Workers & Pages**, keep `ALLOWED_ORIGINS` restricted to the intended CATODO sites, and configure its URL in CATODO. The proxy is not a bypass for access controls, DRM, geoblocking, or content rights; keep its destination restrictions and origin checks intact.

## Limits and compatibility

- Tesla/in-car Chromium variants have constrained CPU, memory, WebGL, MSE, and codec support. A stream that works in VLC may still fail in the browser.
- Multiview starts multiple independent decoders. On Tesla hardware, 2 feeds is the practical default; 3 or 4 can exhaust decoder, thermal, or network capacity. CATODO keeps one audio feed to reduce noise, not decoder load.
- HLS, codecs, CORS policy, mixed-content blocking, hotlink protection, and geoblocking are controlled by external sources and may change without notice.
- The Three.js boot sequence is decorative and falls back when WebGL is unavailable.

## Locales

English is the current product locale. Add future locales as `locales/<language-tag>.json`, mirror them under `public/locales/` for the production bundle, keep keys aligned with `locales/en.json`, and register/select the locale through the i18n service. UI layouts intentionally allow for strings roughly 30–40% longer than English.

## Dependencies

Runtime dependencies are pinned and vendored: hls.js, Three.js r162, Phosphor Icons, SVG Maps World, `flag-icons` 7.5.0 (self-hosted SVG, MIT), and Exo 2 Variable (self-hosted, OFL-1.1) for the interface. IBM Plex Mono is self-hosted only for diagnostic statistics. `fake-indexeddb` is loaded only as an in-memory compatibility fallback when IndexedDB is absent. Development utilities include `basic-ftp` and `bcryptjs`. Licences and notices are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Security

Treat every imported playlist and stream endpoint as untrusted input. Read [SECURITY.md](SECURITY.md) for the reporting process and deployment guidance.
