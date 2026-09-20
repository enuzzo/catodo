# CATODO 2.8.0 — release handoff

## Resume here

The September UI/UX and agent-guidance work is complete. The user explicitly
requested commit, push and live SiteGround deployment on 2026-09-20.
Publication is in progress; the final outcome will be recorded below.

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
- Commit/push and SiteGround publication pending; live checks will follow.

No schema migration, credential rotation or provider reconfiguration is part of
this release. The local build cannot verify PHP synchronization or live playback.

## Next product decision

Recommended order, all still proposals in [ROADMAP.md](../ROADMAP.md):

1. PLAY-03: clearer connection, first-frame, buffering and recovery feedback.
2. UX-02: named saved filters, with explicit local/shared persistence decisions.
3. PLAY-02: optional adaptive-HLS bandwidth cap, preserving Auto and honest
   native-HLS limitations.

EPG-02 covers country-level guide diagnostics; UX-03 covers mobile Countries
density and quieter missing-logo placeholders. Do not start these solely because
they are listed here. Physical Tesla/iOS, speaker audibility and device startup
benchmarks remain open; browser checks cannot substitute for them.
