# CATODO UI review · November 23, 2026

CATODO's broadcast identity works best when the screen gives the viewer a clear
next action. The largest gains in 2.16.0 came from replacing an empty live
player, giving Theatre more room on a split Tesla display and making day and
night palettes possible to compare before choosing them.

Astra reviewed the original screens independently at extra-high reasoning
effort, then revisited the changes. Both passes used rendered screens. Color
measurements and interaction checks came from the browser. The palette pairings
below are editorial judgments.

## Findings and decisions

| Priority | Confidence | What a viewer experienced | Change checked in the browser |
| --- | --- | --- | --- |
| P1 | High | Live and Discover showed a live badge, a muted black frame and disabled actions on an installation with zero channels. | Offer Add playlist, Browse Theatre and a credited Sintel still. Both import and film playback need an explicit action. A catalog being restored keeps its own state. |
| P1 | High | Mute and the volume range disappeared below 821 px in the single-channel player. | Reflow the transport and expose both audio controls on the split Tesla and phone. |
| P2 | High | At 773 × 601, the two-row masthead used 148 px. The opening film's play action started at y=495. Genre buttons competed with four browsing modes. | The masthead now uses 104 px with 48 px navigation targets. Play starts at y=399 for the same film, with credits in view. Genres and favorites open on demand. |
| P2 | High | The toolbar's random action gave no indication that filters applied. Returning to a previously selected Sintel preserved an off-screen scroll position. | Pick from results reveals the selected film and focuses its heading. The in-player die draws across the whole catalog. Opening Sintel again after scrolling 1,220 px returned its stage to y=120. |
| P2 | High | The yellow Now/Next label measured about 1.69:1 on the light card. Saved-state text in several dark themes ranged from 1.55:1 to 2.41:1. Documentaries wrapped inside the word. | Use semantic ink for labels, a filled heart for saved state, 44 px favorite targets and an intact, scrollable category strip. |
| P2 | High | Connecting a valid manual XMLTV guide to a plain M3U playlist returned an empty guide despite matching channel identifiers. | The bounded scan also considers unmapped channels when a custom guide has been approved. The populated timeline was checked with a 96-channel fixture. |

The contrast reference was 4.5:1 for normal text. A 44 × 44 CSS pixel target
guided the revised favorite buttons and palette rows. The checks cover the named
components and states. [W3C text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) · [W3C enhanced target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html)

## Palette guide

The eight original palettes join CATODO's existing eight. The chooser displays
the surface, ink and accent of each option. Day and night can be mixed freely.
Each row below pairs two different interpretations of a similar material.

| Day | Character | Night | Character |
| --- | --- | --- | --- |
| Newsprint | Warm newsprint and graphite, with a quiet play button | Silver Halide | Graphite and cool silver, with the least color around a film |
| Rose Glass | Pale rose with a burgundy accent | Velvet | Dark plum with a coral accent |
| Field Guide | Sage paper and forest-green ink | Vectorscope | A deep green control-room surface with a mint signal |
| Lithograph | Pale lilac with a violet accent | Amber Monitor | Warm brown-black with a phosphor-amber accent |

## Verification

- Inspected the release bundle at 773 × 601, 1254 × 784, 1600 × 900 and
  390 × 844. Captured Live, Discover, Theatre, Explore archives, Countries,
  Guide, Library and Settings in both light and dark. Multiview was checked in
  both schemes with four synthetic feeds.
- Exercised all sixteen palettes at every size, native radio-key navigation,
  the active-mode indicator, switching the browser's color preference,
  persistence after reload and the forced-colors controls. Checked all eight
  additions on the isolated PHP sign-in page.
- In decoded MP4 playback a theme change in another tab preserved the video
  element, source, progress, volume and mute state. The synthetic HLS stream
  exercised fullscreen player chrome, volume, mute, Multiview audio selection,
  feed replacement and return. Both playlist and guide went through the normal
  consent controls.
- The regression suite covers a genuinely empty installation, independent
  palette choices, semantic contrast and a manually connected guide. Test data,
  media and browser profiles were local fixtures. Publication follows the
  [release checklist](../OPERATIONS.md#publish-a-release).

## Next device check

On a parked Tesla, compare Newsprint in direct daylight and Amber Monitor at
night. Check the first-view play action, glare, the volume range and whether
Auto follows the vehicle display. On an iPhone, check the same controls in
standalone mode and the return from system fullscreen. Physical audibility
and touch comfort remain open.
