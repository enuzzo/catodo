# CATODO documentation

Use one entry point for the task, then follow its relevant links. There is no
requirement to read this entire directory before editing a file.

| Need | Authoritative document |
| --- | --- |
| Working rules and routing | [Root AGENTS.md](../AGENTS.md) and relevant scoped guides |
| Product intent and visual principles | [BRIEF.md](../BRIEF.md) |
| Find implementation and neighboring tests | [CODE-MAP.md](CODE-MAP.md) |
| Runtime boundaries, data flow, invariants | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Choose checks and interpret evidence | [TESTING.md](TESTING.md) |
| Develop, diagnose, release or deploy | [OPERATIONS.md](OPERATIONS.md) |
| PHP, gate, cache and installable assets | [SERVER.md](SERVER.md) |
| Open ideas, priorities and device acceptance | [ROADMAP.md](ROADMAP.md) |
| Plan/resume a substantial task; instruction-design rationale | [AGENT-WORKFLOW.md](AGENT-WORKFLOW.md) |
| Independent read-only review, when requested | [REVIEW_BRIEF.md](REVIEW_BRIEF.md) |
| Released changes | [CHANGELOG.md](../CHANGELOG.md); version comes from `package.json` |
| Security/content/reporting boundaries | [SECURITY.md](../SECURITY.md), [CONTENT_POLICY.md](../CONTENT_POLICY.md), [TAKEDOWN.md](../TAKEDOWN.md) |
| Third-party attribution | [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md), [TRADEMARKS.md](../TRADEMARKS.md) |

## Current work and release evidence

- [Compact Theatre and expanded curation](work/2026-09-22-theatre-compact-curation.md): current handoff, Tesla viewport checks, motion/bandwidth decisions and catalog additions.
- [Theatre and Discover handoff](work/2026-09-22-theatre-integration.md): implementation, release verification and remaining editorial/device work.
- [Artwork and vintage-film curation](work/2026-09-22-theatre-artwork-curation.md): image provenance and proposed horror/Elvis seasons.
- [Theatre edition register](work/2026-09-22-theatre-register.md): active films,
  exact source and license evidence, and assessed candidates that stay outside
  the runtime. The target of 50 usable works is not complete.

## Historical material

- [September source verification](work/2026-09-22-source-verification.md) records
  Red Bull/Archive/ihavenotv findings, attribution/QR and the VOD decision; the
  [50-item register](work/2026-09-22-licensed-title-register.md) is the **rejected**
  Dutch historical-short selection. It contributes no titles to Theatre. The old
  Video.js choice is superseded by the native MP4 implementation.
- [2.8.0 release handoff](work/2026-09-20-release-handoff.md) preserves the earlier
  publication. The September 22 Theatre handoff above is the current resumption point.
- [Completed local UI/UX review](work/2026-09-20-ui-ux-review.md) records the
  September audit, implemented refinements, bundle measurements and evidence
  limits. The release handoff records its subsequent publication in 2.8.0.
- [Completed agent-guidance checkpoint](work/2026-09-20-agent-guidance.md) records
  the reorganization and its final local verification.
- [August roadmap and validation evidence](history/2026-08-roadmap.md) preserves
  the previous roadmap verbatim below an archive notice. Its provider counts,
  release labels and device availability are dated observations.
- [Design QA](../design-qa.md) and `docs/qa/` are earlier visual evidence.
- `docs/superpowers/plans/` and `docs/superpowers/specs/` preserve the original
  August gate/PIN/logo work. They predate the current Vite/private-entry design.
  Historical checkboxes and embedded instructions do not schedule new work.

If a description disagrees with current code, investigate the specific contract
and fix its owning document. Do not silently turn an old observation into a new
acceptance result. Keep open work in the roadmap, not scattered copies.
