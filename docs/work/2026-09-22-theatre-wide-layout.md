# Wide Theatre opening — 2026-09-22

## Request and decision

The user identified unused horizontal space in Theatre's featured-film opening,
especially on the extended Tesla viewport, and requested frontend/UI plugin
review. Product Design's audit guidance and an independent read-only design
review agreed on placing film/credits beside the filters. Build Web Apps'
frontend implementation/testing guidance was used for the change and validation.
The final screenshots and diff received a second review with no blocking issue.

At widths of 1101 CSS pixels and above, the idle film card and expandable credits
occupy the left column; search, collection/language and genres occupy the right.
The existing brand, text sizes and 44-pixel minimum filter targets are retained.
Search now precedes the selectors and genres in both DOM and visual order.
Below that boundary the opening stays in one column. The intermediate-width
header allocates less space to global search so Library and all other navigation
destinations remain visible.

The same video node remains mounted. Play makes the stage full-width; Close
removes its media source and restores the browsing layout. Archive discovery
hides the complete opening and pauses the player. No catalog, rights, image
consent, media loading or motion policy changed.

## Browser evidence

Production bundles were served on a task-owned loopback server. IAB through CUA
provided interactive inspection and the same-engine before/after comparison.
The dedicated Browser plugin was unavailable; the existing bundled Playwright
runtime supplied reproducible viewport, screenshot and interaction checks under
the Web Apps testing fallback. PHP installation calls used an empty mock for
automated runs; this is frontend evidence, not server synchronization proof.

| Viewport | Result |
| --- | --- |
| Tesla extended, 1254×784, DPR 1.53 | Film and filters align; IAB shelf top moved from 748.2 to 574.2 CSS px, a 174 px gain. Automated Chromium measured 572.7 px. All navigation fits. |
| Tesla compressed, 773×601, DPR 1.53 | Single column; initial Play ends at 496.9 px, before the 549 px footer boundary. |
| Desktop, 1600×900 | Balanced two columns; shelf starts at 570.4 px. |
| Phone, 390×844 | Stacked controls, visible initial Play, no horizontal overflow. |
| Boundary, 1181×784 | Single-row header fits every destination; two-column Theatre remains usable. |
| Boundary, 1101×784 | Existing two-row header and two-column Theatre fit without overflow. |

All six passed search/empty results, combined collection filters and Randomize,
keyboard order, expandable credits/QR, archive round-trip, persistent video
identity, touch-target and no-eager-media checks, with zero page errors. Both
Tesla sizes also passed BBS episode controls, TPB AFK/Decay warnings, actual
Europe to the Stars playback with advancing time/decoded frames, native
fullscreen entry/exit and Close restoring the original stage width. Screenshot
review covered both Tesla sizes, desktop and phone. Global search, Library and
return to Theatre were also exercised interactively at 1254×784.

Evidence is retained outside the repository in
`/Users/enuzzo/Documents/Codex/catodo-release-2.11.1-2026-09-22/`.
`results.json` marks playback/fullscreen false for non-Tesla widths because those
steps were only run on the two Tesla cases; all six layout runs passed.

## Publication and next start

Release 2.11.1 passed all 202 Node tests, syntax/release checks for 122 JavaScript
files, production build, four PHP lints and diff/link checks. The existing
world-map chunk warning remains. Manifest/installable icons remain square and
opaque; branded transparent assets retain their RGBA corners. The production
bundle also passed synthetic HLS single-player decoding, favorites, volume/mute,
four decoded Multiview feeds, one-audible-feed selection, replacement and return
navigation. Versioned final screenshots cover both Tesla dimensions.

Commit/push and production deployment verification are recorded below once
complete.

Physical Tesla/iOS viewing, audibility and Home Screen installation are not
established by browser emulation. The open editorial/territory decisions remain
in the [archive handoff](2026-09-22-theatre-archive-index.md) and
[artwork register](2026-09-22-theatre-artwork-curation.md); this layout refinement
does not approve additional films.
