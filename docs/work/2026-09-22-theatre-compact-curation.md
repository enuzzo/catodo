# Compact Theatre and expanded curation — 2026-09-22

## Authorized scope and state

Follow-up to the published [2.9.0 handoff](2026-09-22-theatre-integration.md):
compact the opening film, add Randomize, readable synopsis/credits and subtle
multi-image motion; always verify both Tesla browser layouts; continue source
curation. The session explicitly authorizes version/changelog, commit, push and
deployment. Publication evidence is appended below after the release gates.

## Product decisions

- Compact idle card; the same native video expands after Play and collapses on
  Close player. Source selection and Randomize never start a film.
- Randomize draws from the current collection, genre, favorite, language and
  text filters, avoids the selected work, and disables when no alternative exists. Repeated Randomize keeps its button
  in view and preserves keyboard focus.
- All cards include a three-line synopsis and 13 px image credits. Full synopsis
  remains available in the selected film's details.
- Six original editorial collections: After dark, Digital lives, Look up,
  Human connections, Small strange worlds, Questions worth asking.
- Sixteen films have three-image galleries; 61 local images in total, 3,221,315
  bytes for the entire catalog. No thumbnails contact a third-party image service.
  Alternate stills have time, source, license, attribution and SHA-256 records.
- At most two visible cards animate, advancing every eight seconds. Complete
  frames remain inside their container. Credit links follow the visible image.
  Motion has a device-local switch; reduced motion, data saver, background tabs,
  navigation and film playback stop it. ND excerpts stay static.

## GIF / video decision

The user proposed three-second GIFs when covers are missing. Every admitted film
has a checked cover/still, so no GIF or preview video is needed in this release.
A local comparison used the same three-second Decay excerpt at 320 px / 12 fps:
**202,540 bytes GIF versus 19,849 bytes H.264 MP4 without audio (10.2×)**. This is
one measured sample, not a universal compression ratio. The test media stays
outside the repository/deployment. Future video previews should use muted video
without an audio track, visibility-aware loading and the same motion controls.
See the [Chrome team's performance guidance](https://web.dev/learn/performance/video-performance).

## Catalog and archive boundaries

The [edition register](2026-09-22-theatre-register.md) now contains **29 works /
37 editions or episodes**. Added The Lionshare (original package with Legacy),
Snowblind, Sintel, Elephants Dream, Tears of Steel, Big Buck Bunny and The
Internet's Own Boy. Original film credits remain in place. Snowblind is explicitly
a rough 2010 B-western; it is not described as vintage cinema. Four selected
Blender narrative shorts do not stand in for the requested classic-film research.

Three external guides link to Archive's [Sci-Fi / Horror](https://archive.org/details/SciFi_Horror),
[Film Noir](https://archive.org/details/Film_Noir) and [Silent Films](https://archive.org/details/silent_films)
collections, with Public Domain Review references. They open the original sites;
they do not import metadata/streams, count as playable works, or license an entire
collection. Direct Archive edition links now accompany each applicable film.

The 50-work target remains open. The Blob, Creature from the Black Lagoon and the
Elvis season remain research rather than playable claims. Night of the Living
Dead, Carnival of Souls and other vintage leads still need edition/territory
decisions. PDR itself distinguishes PD U.S. from unclear digital-copy rights for
[Night of the Living Dead](https://publicdomainreview.org/collection/night-of-the-living-dead)
and [Plan 9](https://publicdomainreview.org/collection/plan-9-from-outer-space-1959/).
The newly found Cosmonaut copy has inconsistent runtime/aspect metadata and no
decodable frame near its declared end; it remains conditional.

## Verification and evidence

Browser plugin not available; use the existing bundled Playwright/Chromium.
Flow: Theatre entry → compact card → filters/Randomize → visible gallery → source
consent → decoded playback/seek/fullscreen → close/return, without replacing the
video element or starting another audible feed.

Mandatory matrix: 773×601 CSS pixels (Tesla with car column), 1254×784 fullscreen
simulation, 1600×900 desktop and 390×844 phone. The first two also receive playback
checks at DPR 1.53. Split dimensions were physically observed in earlier Tesla
diagnostics; fullscreen dimensions are a simulation based on that logical screen,
not a fresh measurement of browser chrome. This requirement is now retained in
`src/AGENTS.md` and `docs/TESTING.md` for subsequent visible changes.

Initial same-viewport comparison of the selected Europe to the Stars card:

| CSS viewport | Published 2.9.0 height | Compact card height |
| --- | ---: | ---: |
| 773×601 | 518 px | 265 px |
| 1254×784 | 414 px | 248 px |
| 1600×900 | 536 px | 253 px |
| 390×844 | 630 px | 334 px |

Completed release gates:

- `npm test`: 194 passed, none skipped. `npm run check`: 118 JavaScript files,
  release metadata 2.10.0. `npm run build`: passed; protected private app entry.
- All four viewport runs passed on the final production bundle: compact layout,
  no horizontal overflow, repeat Randomize with focus/position preserved, genre
  and collection constraints, empty results, synopsis/credit sizing, native
  fullscreen, close/collapse and persistent video through favorite changes.
- Eight added editions decoded and sought successfully in each Tesla viewport
  (16 checks), with positive video frames and audio decode byte counters. This
  checks samples, not every frame of every film. The final subsequent change only
  preserves Randomize scroll/focus; the four-viewport UI suite was repeated.
- All 61 local images decoded at their recorded dimensions; hashes passed unit
  checks. All 29 QR files decoded to the corresponding authoritative source URL.
- Observed real image changes with at most two visible galleries; Motion off,
  reduced motion, data saver, view navigation and playback stop animation.
  Preference survives reload; data saver requests no alternate stills. No remote
  image/media request occurs before source consent.
- Collection/language/favorite/search combinations and the external-guide layout
  passed both Tesla layouts and phone. Browser page errors: none.
- Production-bundle Live regression smoke: six synthetic HLS channels imported
  with consent, navigation/search/favorite, decoded single player, volume/mute,
  four decoded Multiview feeds, focus 1→2, replacement retaining one audible feed,
  close and return to Theatre. This is controlled browser transport evidence.
- PHP lints, locale mirror and `git diff --check` passed. Existing deferred
  world-map chunk warning remains; no new build failure.

Evidence directory (outside Git):
`/Users/enuzzo/Documents/Codex/catodo-release-2.10.0-2026-09-22/`.
Screenshots: `before-*`, `open-*`, `shelf-*`, `play-*`, `archive-*`;
structured results: `ui-qa.json`, `extras-qa.json`, `additions-qa.json`,
`live-smoke.json`, `bundle-manifest.json` and `test.log`. Browser
decode, native controls and screenshots do not prove physical Tesla touch/audio,
Safari/iPhone behavior, all-network availability or complete-film integrity.

## Publication

Version 2.10.0 was prepared with `npm run release -- 2.10.0`, committed and pushed
as `ce89694e446f502f252e4d648d21a93947f5c37b`, then uploaded with the existing
SiteGround deployment script. Public verification matched all 95 checked assets
(active app JS/CSS, 61 images, 29 QR codes, locale, manifest and touch icon).
Authenticated API routes returned 401; private storage/app routes 403; installable
assets 200. An authenticated Chrome visit showed 2.10.0 / 29 films, working
Randomize and decoded Big Buck Bunny playback at 640×360, followed by Close player.

### Cache correction found during live acceptance

The existing browser displayed the new no-dialogue language as `zxx`. A public
GET of the unversioned locale still returned the previous language table, while
the release-query URL matched the new build. This was a cache identity problem,
not a missing translation. Translation requests now carry `?v=APP_VERSION`;
each locale remains memoized within the running instance.

The corrective patch is version **2.10.1**, prepared with the release script.
The full suite passed 195 tests; syntax/release checks and build passed. A focused
production-bundle check simulates stale unversioned translations and verifies
the correct No dialogue label, language filtering, Randomize and containment
at all four viewport sizes. Full movie transport and Multiview evidence above
still applies: the correction only changes locale request identity.

Patch evidence is kept in
`/Users/enuzzo/Documents/Codex/catodo-release-2.10.1-2026-09-22/`.
Patch upload and final public verification are appended after completion.

## Next start

1. Verify the deployed version and current Git state against the evidence below.
2. Prioritize exact editions of the vintage horror/Elvis candidates, then the
   remaining substantive documentary/independent-film queue in the register.
3. Improve low-resolution sources and verified English/Italian captions.
4. Perform parked Tesla touch, playback/fullscreen return and physical QR checks;
   keep physical acceptance separate from the mandatory browser matrix.
