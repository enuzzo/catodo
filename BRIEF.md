# CATODO 2.5.1 — product brief

CATODO is an open-source, Tesla-first web player for discovering and watching
public live television sources from around the world.

## Product principles

- **Soft Signal Grid.** A light, editorial broadcast interface: rigorous grid,
  selective rounded corners, generous spacing, electric blue and EBU accents.
- **English first, localisation ready.** Product copy is resolved through the
  locale service. Components leave room for translations 30–40% longer.
- **Immediate signal.** When cached channels exist, Home starts a muted Live
  Anchor and keeps it playing while the user explores. `Random` swaps it quickly.
- **Global, not Italy-first.** Every country exposed by the upstream provider is
  discoverable through Signal Atlas and the country directory.
- **Consent before fetch.** Curated links can prepare an import, but no playlist
  is fetched until the user confirms the provider and disclaimer.
- **Local ownership.** Sources, snapshots, favourites and history persist on the
  device. A failed refresh never replaces the last known good snapshot.
- **One audible feed.** Multiview supports 2, 3 and 4 feeds, with one explicit
  audio source at a time.
- **Truthful diagnostics.** Signal Lab distinguishes measured, estimated and
  manifest-declared values; unsupported upload telemetry is shown as unavailable.
- **Capability over user-agent.** WebGL, HLS/MSE and decoder behaviour are tested
  by capability, with graceful fallbacks and final verification on real hardware.

## Runtime constraints

- No framework; Vite produces the only supported production artifact (`dist/`), deployed to SiteGround behind the PHP access gate.
- Vanilla ES modules split by data, player, UI, i18n and boot responsibilities.
- Vendored, pinned runtime dependencies; no CDN is required to boot.
- The optional Cloudflare proxy remains available for compatible third-party stream handling; it keeps an explicit origin allowlist.
- Target baseline is a conservative in-car Chromium/WebGL environment at
  1600×900, plus responsive desktop/tablet use.

## Content boundary

CATODO ships software and a directory of external source links. It does not ship
third-party playlist snapshots, stream media, permanent logo packs or EPG data.
See `CONTENT_POLICY.md`, `TAKEDOWN.md` and `THIRD_PARTY_NOTICES.md`.
