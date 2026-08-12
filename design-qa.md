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
