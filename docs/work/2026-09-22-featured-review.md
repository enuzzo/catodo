# Featured package: intake, evidence and remaining clearance

Date: 2026-09-22. Historical audit checkpoint. The user subsequently authorized
publication of all 305 research works; see the [release](2026-09-22-featured-release.md).
The findings below still govern unresolved in-app edition admission.
The user's territory decision is **international access**. The separately
authorized [UI polish](2026-09-22-local-ui-polish.md) is included in that release.

## Deliverables

The complete local evidence directory is
`/Users/enuzzo/Documents/Codex/CATODO-featured-review-2026-09-22/`:

- `README-review.md`: findings, evidence boundaries and next actions.
- `original/` and `intake-provenance.json`: unchanged delivery and SHA-256 hashes.
- `review-ledger.jsonl`, `review-ledger.csv`, `review-summary.json`: all 305 works,
  separate playback/identity/rights/image outcomes, and exact counts.
- `priority-30.md`: rank-priority rights and edition actions.
- `catalog-link-corrections.json`: 26 proposed unlinks across nine works; source
  records retained. Existing IDs do not establish correct work identity.
- `replacement-check/`: 16 alternative editions, browser and decode evidence.
- `artwork/poster-review.json`, `cover-review.json`, `artwork-summary.json`:
  visual judgments and image exceptions, without rights approval.
- `taxonomy-review.json`: all twelve collection proposals and Music/War evaluated.

Large source metadata and media evidence stay outside the repository/public
bundle. No private application data or credentials were used in this audit.

## Findings

All 305 records validate against the return schema. Ranks, collection counts and
888 referenced IDs reconcile with the dossier snapshot. However, at least 26
links point to different films, and three selected files are the wrong works:
The Kid, The City (1939) and The Unknown (1927). Five editions are explicitly Part
I; five more are substantially shortened versions. Mickey Mouse in Vietnam is
a mixed program. The Cut-Ups has conflicting file/item identity. The Story of
the Kelly Gang needs an explicit surviving-fragments description.

All 305 delivered URLs were opened in muted Chromium: 293 showed moving video,
six were rejected and six decoded audio without video. Every one of these twelve
failures has a tested alternative showing video. Four further alternatives
address identity or Part I selections, for sixteen tested alternatives in total.
Start/middle/end decode samples, targeted follow-ups and raw logs are retained.
An FFmpeg zero exit status with zero decoded frames is not accepted as success.

The payload represents 206.72 hours. No full-work viewing or full-file decode
was completed; samples do not prove complete editions, physical audio or Tesla
compatibility. Do not mass-promote `playbackVerified` or integration approval.

Rights intake: 180 declared-only, 125 unknown. Five documented permission/rights
cases are restricted in the review ledger; 177 declared-only and 123 unknown
remain unresolved. **Zero works are approved worldwide.** The requested territory
is known; the legal basis is still missing for those unresolved records. A
publication hold is not a determination that a work is copyrighted everywhere.
The [retired CC US certification](https://creativecommons.org/publicdomain/certification/1.0/us/)
appears on 130 records. Preserve the stronger, explicit
[Prelinger worldwide-reuse policy](https://archivesupport.zendesk.com/hc/en-us/articles/360004715031-Prelinger-Archive)
as evidence while reviewing the exact item and rights layers. Thirty priority
entries have individual next-action notes; primary work-specific research covers
a smaller subset, not a completed worldwide legal review of every title.

The remaining 32 Commons images were visually checked. All 255 supplied stills
were inspected; 198 are only 160×110 pixels. New extraction and a refinement pass
produced 253 image candidates and WebP copies. There are 234 visually usable
candidates and 21 cover/edition exceptions, including two failed captures.
These remain stills, not authentic posters, and none is worldwide-rights approved.

All twelve collection concepts are useful, with membership corrections. Music
and War are useful proposed genres; avoid assigning Music merely because an
actor is a musician or War merely because a film concerns wartime employment.
The generic commercials compilation stays on editorial hold. The original 26
hold decisions are preserved. No new collection or genre has been activated.

## Verification and next start

Intake/schema, exact-file metadata, all URL browser starts, bounded audio/video
decoding and rendered image sheets were checked on 2026-09-22. Local evidence
validation checks record coverage and provenance hashes. Markdown links and diff
whitespace are checked for this documentation-only repository change. Runtime
tests/build were not repeated for the audit; earlier UI verification is recorded
in its own handoff. Nothing was published.

Start with `README-review.md` and `priority-30.md` in the evidence directory.
Apply reviewed identity corrections to a separate candidate payload, compare full
editions, resolve worldwide rights and the 21 artwork exceptions, then integrate
only records passing those gates. The intake and technical triage are complete;
full completeness, clearance and Featured integration remain open.
