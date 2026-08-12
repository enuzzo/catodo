# Design QA — Home density, TV Guide and immersive player

- Source visual truth: `/tmp/catodo-qa/reference.png`
- Implementation: `/tmp/catodo-qa/implementation-home.png`, `/tmp/catodo-qa/implementation-player.png`
- Viewport: desktop 1280 × 720 CSS px at device scale 1; mobile checked at 390 × 844 CSS px.
- Source pixels: 3084 × 2092. Implementation pixels: 1280 × 720. The source is an annotated product screenshot rather than a 1:1 composition target, so the focused comparison uses the highlighted channel-directory region and requested interaction states.
- State: QA catalog populated; Home Live; player before and after a single tap; favorite toggled in-place.

## Full-view comparison evidence

The Home preserves Catodo's approved Soft Signal Grid while applying the annotated density request: the directory now has three rows of three tiles, larger source logos, tighter internal padding and Now/Next lines. The selected player is stream-only until tapped. The Guide is a new requested route, so it has no direct source frame and follows existing panel, type and radius tokens.

## Focused region comparison evidence

- Reference highlighted a 3 × 2 directory with unused vertical space; implementation renders a readable 3 × 3 directory in the same desktop region.
- Logos are substantially larger and remain contained without cropping.
- The requested programme hierarchy is present: Now and Next in Home when XMLTV data exists, and a horizontal programme timeline with Now Playing badges in TV Guide.
- The player opens with no chrome; one stage tap reveals top actions and the bottom local-time/schedule/transport bar.

## Comparison history

1. P1 interaction: clicking the video could be intercepted by the loading status layer, so the chrome remained hidden. Fixed by moving the action to the stage and making the status overlay pointer-transparent. Post-fix browser evidence shows `is-chrome-visible` after one tap.
2. P1 favorite regression: verified the player remains in `data-mode="player"`, the media blob URL is unchanged, and the action changes from Favorite to Remove favorite without retuning or closing.
3. P2 reuse drift: programme placeholders appeared on every generic Library/Favorites tile. Fixed by making schedule rows an explicit Home-directory option only.

## Required fidelity surfaces

- Typography: Exo 2 Variable and IBM Plex Mono remain unchanged; compact programme labels use existing optical hierarchy.
- Spacing/layout: passed at desktop and mobile; no button/map overlaps or hidden persistent controls observed.
- Colors/tokens: existing signal blue, paper, lines and rounded/brutalist balance preserved.
- Image quality: remote channel logos remain original image assets with contained scaling and existing fallbacks.
- Copy/content: all new UI is English, locale-keyed, honest about missing schedule coverage and local timezone.

## Residual P3

- At 390 px the primary navigation remains horizontally scrollable, consistent with the existing app; a future compact overflow menu could reduce first-viewport density.
- Some unusually wide logos visually dominate compact tiles, but remain uncropped.

## Verification

- Page identity and non-blank meaningful content: passed.
- Framework overlay: none.
- Console warnings/errors: none relevant.
- Interaction: Home → channel → stream-only player → single tap → favorite → state persists without stream change: passed.
- TV Guide navigation and XMLTV consent form: passed.
- Automated tests: 60/60 passed; syntax and Vite production build passed.

final result: passed

## Home channel-card hierarchy — 2026-08-12

- Source visual truth: `/var/folders/48/00rryty17dzb6g7877yxqym00000gn/T/codex-clipboard-57fba3de-2a84-4280-9c03-a113c7d335e6.png`.
- Implementation evidence: in-app Browser at 1536 × 900 and 390 × 844 CSS px.
- The former vertical stack left large blank regions when grid rows stretched. Cards now use a masthead for number + contained logo, a 19 px desktop title, wrapped metadata chips, and a bottom-aligned Now/Next strip.
- Nine dashboard cards remain visible at desktop; mobile uses one resilient 347 px card column with no horizontal body overflow.
- Favorite hearts are visible on the dashboard directory and the featured live channel uses the same red active-state language.
- Console/framework health: no warnings, errors or overlays.
- Automated verification: 64/64 tests, syntax check, production build and diff check passed.

final result: passed

## Home re-entry random + featured favorite — 2026-08-12

- Implementation evidence: in-app Browser at 1536 × 900 CSS px.
- Flow: Live channel → Countries → Live. The featured channel changed from Nopola News to South Park – Pluto TV, and the media blob source changed, proving a real retune rather than a cosmetic card swap.
- The featured heart sits immediately after the channel name, reuses the established heart language, and switches `add-favorite` → `remove-favorite` with `aria-pressed=true` while the app remains in shell/Home mode.
- Console/framework health: no warnings, errors or overlays.
- Automated verification: 64/64 tests, syntax check, production build and diff check passed.

final result: passed

## Countries Atlas → channel directory iteration — 2026-08-12

- Source visual truth: `/var/folders/48/00rryty17dzb6g7877yxqym00000gn/T/codex-clipboard-07915d1c-c6db-4807-8c36-711436beadfc.png`.
- Implementation evidence: `/tmp/catodo-countries-qa/implementation-desktop.png` and `/tmp/catodo-countries-qa/implementation-mobile.png`; combined comparison: `/tmp/catodo-countries-qa/comparison.png`.
- Viewports: desktop 1536 × 900 CSS px; mobile 390 × 844 CSS px. Source pixels: 4412 × 2274; desktop implementation pixels: 1536 × 900.
- Visual target: preserve the existing Soft Signal Grid, Exo 2 typography, paper panels, thin rules and compact broadcast directory; change only the selected-country information architecture.

### Full-view comparison evidence

The reference left 58% of the selected-country screen occupied by a map whose selection job was already complete, while the channel destination remained a secondary button. The implementation uses the same footprint for an immediate country-channel directory and keeps the selected row, compact country profile and country browser in the right rail. The layout remains within the existing density and radius system.

### Focused comparison evidence

- Selecting a country from either map or table produces the same state: country flag/name, honest local availability count, search, category/language filters and channel grid.
- “Back to world map” restores an unselected Atlas; the initial profile has no misleading default country.
- Categories are split, case-insensitively deduplicated, displayed as chips inside a native details element, and closed on every country change.
- Large countries render 72 channels initially and expose a remaining-count Load More action; this avoids thousands of simultaneous TV cards on Tesla-class hardware.
- Countries with catalog channels are marked Imported even when their channels came from the world preset rather than a country-specific source.

### Comparison history

1. P1 source-state mismatch: world-catalog channels were shown as available in the left directory while the right table still said Not imported. Fixed by treating local country statistics as an imported state.
2. P2 prompt noise: the initial unselected country profile showed a Back arrow with nowhere meaningful to go. Hidden until a real country is selected.
3. P2 density: the original comma-separated category list expanded the profile dramatically. Replaced by a collapsed summary with a count and a bounded chip list.

### Required fidelity surfaces

- Typography and icon system: passed; no new asset family or font introduced.
- Spacing/layout: passed at desktop and mobile; no horizontal body overflow, clipped toolbar, or control overlap.
- Image quality: existing vendored SVG flags and source channel logos remain contained without stretching.
- Copy/content: English and locale-keyed; counts distinguish channels “available now” from the wider provider directory.
- Interaction: map selection, table selection, channel search, Categories disclosure, Load More, filters and world-map return passed.
- Console/framework health: no warnings, errors or overlays.
- Automated verification: 64/64 tests, syntax check, production build and diff check passed.

final result: passed

## Home atlas removal iteration — 2026-08-12

- Previous accepted implementation: `/tmp/catodo-qa/implementation-home.png` (1280 × 720).
- Latest implementation: `/tmp/catodo-home-wide.png` (1280 × 720) and `/tmp/catodo-home-mobile.png` (390 × 844).
- User direction: remove Signal Atlas from Live/Home, keep it in Countries, and use the recovered width for a more cinematic 16:9 live anchor.
- Full comparison: the right-hand Atlas is removed; the live anchor and nine-channel directory now occupy the full content width. No replacement filler panel or unapproved copy was added.
- Focused checks: 16:9 stream geometry, Random visibility, nine channel tiles, Home without Atlas, Countries with Atlas, mobile stacking, Exo 2 hierarchy, existing palette/radii and icon treatment.
- Browser proof: Home `Signal Atlas` hidden; Countries `Signal Atlas` and `.world-map-shell--countries` visible; Random visible; nine directory tiles; console clean.
- Material fix after first render: the old ≤1450px media query still constrained the live anchor. Replaced it with balanced full-width columns and an explicit 16:9 stage.
- Intentional deviation: narrow mobile naturally stacks the nine-channel directory below the live anchor; the live frame remains 16:9 and horizontally unclipped.
- Above-the-fold copy diff: no new copy; all existing labels retained.

final result: passed
