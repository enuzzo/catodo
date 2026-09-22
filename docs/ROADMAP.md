# CATODO roadmap

Resume from the [appearance handoff](work/2026-09-22-appearance.md) for the latest
publication status and theme evidence; the [wide Theatre handoff](work/2026-09-22-theatre-wide-layout.md)
retains its layout evidence and the [archive index handoff](work/2026-09-22-theatre-archive-index.md)
retains catalog coverage and the recommended editorial next task.
The next session starts from the [Claude curation handoff](work/2026-09-22-claude-featured-handoff.md)
and waits for the user's returned files before implementing Featured or new filters.

Open work and ideas, reconciled with repository documentation and code on
2026-09-20. Priorities combine retained ideas and the
[completed local UI/UX review](work/2026-09-20-ui-ux-review.md); the next user
request chooses what to implement. That review includes browser observations,
not physical-device acceptance or a systematic live-provider availability scan.

CONTENT-01/02/03 were updated after the 2026-09-22 source-research pass. Their
research evidence does not change the release or implementation status of other rows.

Release membership belongs to [CHANGELOG.md](../CHANGELOG.md). Earlier shipped
features and detailed QA results are preserved in
[the August evidence archive](history/2026-08-roadmap.md).

## Open validation

| ID | Priority | Remaining acceptance | Existing evidence / limit |
| --- | --- | --- | --- |
| QA-01 | P0 | Native Tesla touch: navigation, Guide drag, fullscreen return, 2/3/4-feed audio focus | Both Tesla browser layouts are now mandatory: 773×601 split and 1254×784 fullscreen simulation, plus 1600×900 baseline. Browser checks are not physical vehicle acceptance |
| QA-02 | P0 | Real iPhone/iPad Home Screen installation, standalone safe areas, rotation, cookie continuity and system-fullscreen exit; corrected mobile header in Safari | September 390×844 browser checks plus earlier iOS Simulator evidence; no new physical iOS test |
| QA-04 | P1 | Check whether the parked Tesla browser forwards native display day/night changes to `prefers-color-scheme` | Auto, manual modes, eight palettes and a 07:00–19:00 local-clock option are implemented. Browser emulation establishes app behavior; only the vehicle can establish its signal |
| QA-03 | P0 | Recheck current EPG country coverage with a bounded, reproducible provider sample | Earlier IT/FR/DE counts and stale feeds are dated; later provider discovery changes shipped |
| EPG-01 | Decision | Decide whether removing a guide should purge its retained local programme cache | Retention was observed and documented; no new removal policy selected |

## Product work and proposed ideas

| ID | Priority | Proposal | Completion boundary |
| --- | --- | --- | --- |
| UX-01 | P1 | Dismissible Add to Home guidance on eligible mobile/tablet browsers | Native install prompt where supported; accurate iOS instructions; hide in standalone; remembered dismissal |
| PLAY-01 | P1 | One Stream entry for supported AirPlay/Chromecast routes | Real receiver/network/codec/auth/expiry/disconnect tests; no simulated discovery; hide when unsupported/Tesla |
| PLAY-02 | P1 | Optional Data saver for adaptive HLS, including Multiview | Cap only available renditions; retain Auto; handle native HLS honestly; measure traffic and recovery on real devices |
| PLAY-03 | P1 | Clearer tuning progress and recovery, with useful recent playback evidence | Distinguish connecting, first frame, buffering and failure; show last success as device-local evidence; keep cancel/retry immediate |
| UX-02 | P1 | Named saved filters such as “News in Italian” or “Evening documentaries” | Reuse existing filter semantics; define browser-local versus shared ownership, backup/schema implications and empty-result recovery before implementation |
| EPG-02 | P1 | Guide coverage summary by country with direct repair actions | Separate downloaded feed, matched channel, current programme and stale schedule counts; use explicit denominators and timestamps |
| UX-03 | P2 | Compact Countries entry on phones and quieter missing-logo placeholders | Keep map accessible, reduce unselected-detail space and maintain readable channel identity; check both genuine logos and fallbacks |
| UX-04 | Planned; next editorial session | Theatre discovery by era, year, editorial theme, duration and language, with useful sorting | Reconcile existing archive decade/review filters first. Keep genres, eras and overlapping editorial collections distinct; verify original release years and missing values. Compact progressive controls in both Tesla viewports; see [handoff](work/2026-09-22-claude-featured-handoff.md) |
| UX-05 | Planned | Consistent emoji or small pictograms alongside filter labels in Theatre and other suitable sections | Keep text labels and country flags, use a restrained shared mapping and accessible names, and check glyph rendering, touch sizes and light/dark contrast on both Tesla viewports |
| CONTENT-01 | Published; provider/device acceptance open | Discover: Adrenaline first, Documentaries and full-category navigation | Groups all matching approved catalog identities without importing sources or promising Red Bull VOD rights. Synthetic multi-feed rendering and browser transitions verified; actual installation coverage and Tesla playback remain open. See [handoff](work/2026-09-22-theatre-integration.md) |
| CONTENT-02 | Partial: 29 usable works; 50-work target open | Theatre: internationally interesting films and substantive documentaries, with edition-specific rights | Compact persistent player, Randomize, six editorial collections, 61 credited images and 16 optional galleries. [Register](work/2026-09-22-theatre-register.md) separates active works and unresolved candidates. Rejected newsreels count zero; Metropolis/Chaplin remain conditional. Improve low-resolution copies and verified captions; publication tracked in the [current handoff](work/2026-09-22-theatre-compact-curation.md) |
| CONTENT-03 | Published; physical scan open | Visible source, attribution, exact license and source QR | Local generation and independent decoding; no QR service, tracking or film bundle. Real-phone/Tesla scanning and viewing remain open. See [handoff](work/2026-09-22-theatre-integration.md) |
| CONTENT-04 | Complete source index integrated; vintage playback remains research | Curated vintage horror and Elvis seasons; stronger official poster coverage | Explore archives indexes 30,067 entries from all returned Archive feature_films records and the direct Open Culture / Public Domain Movies lists, with categories, declared-rights and review filters, opt-in images and provenance. Linked collections are not recursively expanded; this does not add 30,067 playable films. Territory clarification and exact edition review remain open. [Vintage register](work/2026-09-22-theatre-artwork-curation.md) retains Midnight Monsters / Drive-in After Dark / Elvis on Screen; review edition, territory, score and artwork separately |
| CONTENT-05 | Awaiting Claude's files | Integrate an editorial Featured selection of roughly 300 distinctive works, including about 100 unusual Archive discoveries | Quality takes priority over counts. Validate the existing return schema, deduplicate works/editions, review source and artwork evidence, preserve all other records for search/progressive discovery. This is the new editorial target beyond CONTENT-02's earlier 50-work milestone; see [handoff](work/2026-09-22-claude-featured-handoff.md) |

## Engineering candidates

| ID | Priority | Proposal | Constraints |
| --- | --- | --- | --- |
| ENG-01 | P2 | Extract focused app controllers/UI renderers as product work touches them | Preserve persistent media and navigation; no blanket rewrite |
| ENG-02 | P2 | Measure further Guide splitting and map geometry simplification | Map deferred in 2.8.0; initial app JS 1.58 MB → 357 KB. Remaining map chunk is 1.24 MB; measure actual timing and memory before more work |
| ENG-03 | P2 | Finish i18n extraction and generate the served locale from one source | September changes reconcile all existing English keys; both JSON mirrors must still be edited together |
| ENG-04 | P2 | Repeatable browser/visual and manifest/icon checks in CI | Cover audio state, return paths, touch targets and mobile/tablet layout |
| ENG-05 | Candidate | Timestamped/recoverable installation backups beyond manual export/import | Manual configuration export/import already exists; define retention/recovery separately |
| ENG-06 | Candidate | Logo cache cleanup and size/health visibility | Preserve private authenticated cache and takedown handling |
| ENG-07 | Candidate | Source refresh history and last-good snapshot visibility | September wording distinguishes playlist checks from stream health; richer history remains open and must not imply universal availability |

## Keep the queue useful

Add ideas here with a stable ID, status and acceptance boundary. Distinguish a
proposal, an implementation and browser/provider/device acceptance. When shipped,
move its behavior to the changelog and leave only genuinely open acceptance here.
For a task that spans sessions, link a short active work note as described in
[AGENT-WORKFLOW.md](AGENT-WORKFLOW.md); do not treat old checkboxes as a work queue.
