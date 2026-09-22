# CATODO 2.8.0 — release handoff

## Resume here

The September UI/UX and agent-guidance work is complete. The user explicitly
requested commit, push and live SiteGround deployment on 2026-09-20.
Runtime release commit `c7bb0d8` was pushed to `origin/main` and deployed to
SiteGround successfully. Live `version.json` and the authenticated UI both
confirmed **2.8.0**. The documentation follow-up records that outcome.

Start the next task with Git status, this note and the relevant route in
[CODE-MAP.md](../CODE-MAP.md). Do not repeat the audit or reimport the global
playlist: it was already connected. Keep one writer in this Dropbox checkout.

## Included work

- Scoped agent guidance, code/test maps and historical documentation separation.
- Library filtering, result counts/reset, mobile navigation and Live layout.
- Settings section shortcuts and accurate connected-world/source status.
- Country table/map coverage, Guide loading state and identical locale mirrors.
- Deferred map geometry: main app JS approximately 1.58 MB → 357 kB.
- Regression tests and synthetic local UI fixtures, excluded from production.

The [UI review](2026-09-20-ui-ux-review.md) contains audit evidence and measurement
limits. Its original local-only status describes the preceding task; this note
owns the subsequent publication outcome. The same applies to the earlier
[agent-guidance checkpoint](2026-09-20-agent-guidance.md).

## Verification and publication

- 2.8.0 release gates passed: 183 tests, 109 JavaScript syntax checks, release
  metadata, production build, PHP lint on all three built services and the gate,
  and Git whitespace checks.
- Built private entry and complete icon family verified; manifest icon PNGs are
  square opaque RGB. Brand transparency regression tests passed.
- Production bundle boot, version, lazy map and Settings verified on localhost.
  Prior detailed desktop/mobile interactions used the same runtime changes.
- Commit `c7bb0d8` pushed to `main`; `npm run deploy:siteground` completed.
- Unauthenticated curl checks: installation, logo and EPG APIs returned 401;
  private installation state, private shell and legacy app.html returned 403;
  manifest and Apple touch icon returned 200. Cache-busted version.json was 2.8.0.
  Python urllib received 403 even on public metadata; curl and browser checks
  established the expected behavior without weakening server rules.
- Authenticated live UI restored the library and showed Shared library connected.
  The existing world playlist was recognized; global search returned the expected
  channel and was cleared afterward. No new source was imported.
- Deejay TV and Rai Storia played with advancing video and decoded audio reported
  by the browser. Volume 50/100 and mute were verified. Multiview audio moved
  between the first two feeds with exactly one unmuted video; replacement and
  player-to-Multiview return worked. Original preset was restored, no preset was
  saved, and playback was left muted. The other two sample feeds did not establish
  playback, so this is not four-provider availability acceptance.
- Favorites remained present; add/remove persistence was not retested live.
  Physical fullscreen, Tesla/iOS installation, physical audibility and device
  performance remain outside this browser verification.

No schema migration, credential rotation or provider reconfiguration is part of
this release. Local synthetic tests remain separate from the live checks above.

## Next product decision

New user idea recorded after release: CONTENT-01/02, Red Bull TV and a dedicated
Cinema & Docs section. The [source proposal](2026-09-20-cinema-docs-proposal.md)
preserves ihavenotv, Internet Archive, GitHub research leads and open-film options,
with the exact next investigation. This is queued, not implemented.

The [September 22 source verification](2026-09-22-source-verification.md)
records the next research pass: Red Bull upstream/browser evidence, ihavenotv
rights limits, a 50-item licensed historical-short register with attribution/QR,
and the VOD technology decision. Blender is now low priority. Runtime integration
and publication remain unimplemented; read that note before resuming CONTENT work.

Recommended order, all still proposals in [ROADMAP.md](../ROADMAP.md):

1. PLAY-03: clearer connection, first-frame, buffering and recovery feedback.
2. UX-02: named saved filters, with explicit local/shared persistence decisions.
3. PLAY-02: optional adaptive-HLS bandwidth cap, preserving Auto and honest
   native-HLS limitations.

EPG-02 covers country-level guide diagnostics; UX-03 covers mobile Countries
density and quieter missing-logo placeholders. Do not start these solely because
they are listed here. Physical Tesla/iOS, speaker audibility and device startup
benchmarks remain open; browser checks cannot substitute for them.

## Superseding September 22 implementation

The [Theatre and Discover handoff](2026-09-22-theatre-integration.md) supersedes
the content-research status above. It records the rejection of the Dutch shorts,
22 active works, native playback, credited artwork and the subsequent publication
authorization. Use it as the current restart point for content and release work.
