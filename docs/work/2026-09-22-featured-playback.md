# Featured: all 305 works playable inside CATODO

Date: 2026-09-22. Release: **2.14.0**. The owner explicitly requested in-app
playback for every Featured work, superseding the research-only scope of
[2.13.0](2026-09-22-featured-release.md). This is an operational publication
decision, not a claim that source rights have been verified worldwide.

## Result

- Every Featured card and detail dialog has Play. Media stays inside CATODO in
  a persistent native video with pause, mute, seeking, fullscreen and Close.
- Only a Play gesture loads external media. Sorting, filtering and credits do
  not retune playback; leaving Featured pauses it. The existing shared audio
  release callback prevents live/Multiview audio overlap.
- Applied all sixteen previously tested alternative editions and ten further
  corrections: The Kid, The Cut-Ups, Mickey Mouse in Vietnam, Shoes, Grass,
  Aelita, In the Land of the Head Hunters, Blood and Sand, Gilbreth and Duck and
  Cover. The latter uses the correctly proportioned government-source H.264
  file rather than a distorted portrait derivative or audio-only MPEG-4 copy.
- Edition durations and silent/near-silent/fragments notes are explicit.
  Alternate-edition source declarations are labelled as original-dossier
  evidence where they refer to the superseded file.
- Per-film GitHub reports are linked from both Featured and curated credits.
  They prefill public title/source context, never submit an issue automatically.
  The noncommercial artistic purpose, attribution and correction/removal contact
  are visible; neither credits nor fair use are presented as a blanket license.
- Media is linked from public Archive/Commons HTTPS URLs; no movie bytes are
  hosted and no source access control, DRM or geographic restriction is bypassed.

## Verification

Evidence directory:
`/Users/enuzzo/Documents/Codex/CATODO-featured-playback-2026-09-22/`.

The browser audit opens each selected URL and requires advancing time plus
decoded video frames. A source returning HTTP 200 or audio alone is insufficient.
The first 305-file run produced 304 starts; Spider Baby passed a bounded retry.
Duck and Cover was subsequently upgraded to a correctly proportioned source,
with a separate check of the final URL. Replacement sample checks seek to
beginning, midpoint and end, preserving any transport limitations in their logs.

The rendered interaction loop is Theatre → Featured → card/detail Play → moving
video → credits/filter/fullscreen → navigation/close. Four viewports (1600×900,
1254×784, 773×601, 390×844) are checked in light/dark. The shorter Tesla layout
keeps the player controls within its available height. Browser plugin was not
available; the installed Playwright runtime runs isolated Chromium checks.

Final local results:

- **216 tests passed**, syntax/release metadata and production build passed.
  The existing large-JavaScript-chunk advisory remains. Four PHP lint checks and
  changed Markdown links/whitespace checks passed.
- **305/305 current catalog URLs** have decoded-video evidence reconciled by
  exact URL in `final-305-starts.json`; this includes the final Duck replacement.
- All ten additional replacement editions passed browser start/midpoint/end
  checks. FFmpeg could not reliably sample the Commons file, so browser seek
  evidence is retained without misreporting the FFmpeg outcome.
- The initial standalone Mickey file played to its end but failed decoder
  recovery after rewind. It was replaced with the `mmiv-1968-4k-16mm` derivative,
  which passed all three browser samples. Failed superseded-file evidence stays
  in the audit folder rather than being erased.
- Production-bundle UI checks passed in all four viewports/light-dark: card and
  dialog Play, initially muted video, volume/mute preserved by credits, sorting
  without replacement, fullscreen, paused navigation, resume and source release.
  Final-color screenshots were inspected after disabling capture-time theme
  transitions; controls fit the 773×601 player view.

The final Mickey edition also passed Play, forward seek and rewind through the
actual production-bundle Featured UI (`mickey-in-app.json`).

## Publication

Application commit **fb85847** was pushed to official `main` and deployed to
[catodo.app](https://catodo.app/) using the existing SiteGround script. The clean
primary checkout was fast-forwarded; the temporary credential symlink was
removed without displaying credential contents.

Live checks at **2026-09-22 18:44:21 UTC** (`live-verification.json`) confirm:

- Version endpoint and rendered public gate report **2.14.0**.
- All **305 records** contain source editions; all twelve collections remain.
- Featured feed SHA-256:
  `eba191c8584780fac721d72d645e77b2d276e878f3b23c27ef48c3b786c61d19`.
- The feed, application JS/CSS, HLS chunk, locale, appearance script and plain/
  gzip archive index match the tested build byte for byte.
- Three protected APIs return 401; private storage, private entry and legacy
  app route return 403; manifest and touch icon return 200.

No authenticated production browser session was available. Interaction QA ran
on the final production bundle locally; public deployed artifacts and the gate
were checked live. No authentication was bypassed and no installation data was
used for the synthetic app checks.

## Limits retained honestly

Start/midpoint/end samples do not constitute watching all films end to end.
Some editions are silent; The Story of the Kelly Gang survives only in fragments.
Source availability can change. Browser audio counters do not prove physical
audibility, real Tesla behavior or iPhone Add to Home Screen acceptance.
The historical international-rights audit remains available; runtime Play is
not represented as a new legal clearance. The separate 26-work hold dossier
was not added to the 305-work selection.
