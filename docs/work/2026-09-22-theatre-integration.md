# Theatre and Discover — editorial reset and local implementation

Status: published and verified on SiteGround. Started 2026-09-22 on `main`, application 2.8.0.
The subsequent user instruction explicitly authorized version/changelog update,
commit, push and SiteGround deployment; it also requested artwork and research
into curated vintage horror and Elvis films. Publication evidence is appended below.

## Objective and selection contract

Build Theatre around internationally interesting classic cinema and substantive
documentaries, English first, with silent cinema welcome and Italian optional.
Aim for at least 50 genuinely relevant works with edition-specific rights and
attribution evidence. Do not count chapters as separate films, inflate the count
with newsreels, or confuse a rights-friendly archive with an editorial selection.
Metropolis and Chaplin are editorial references to investigate, not cleared works.
Blender films are low priority.

The former 50 Dutch historical shorts were explicitly **rejected by the user**.
The [old register](2026-09-22-licensed-title-register.md) and research previews are
historical evidence only. None of those titles may enter Theatre or the new count.
This document supersedes the old shortlist and the earlier Video.js pilot choice.

For each candidate record: title, creator, year, duration, languages/subtitles,
original synopsis, genre, authoritative work page, exact edition/file, licensor,
license URL and conditions, attribution, dated evidence, and a decision of usable,
conditional or excluded. Uploader metadata alone is insufficient. Distinguish
underlying film, restoration, score and subtitles; territorial public domain is
not a worldwide license. Report actual cleared counts, never promote uncertainty.

## Product and technical scope

- Theatre: MP4 playback; persistent media DOM; visible credits and rights; local
  QR to the authoritative work page; favorites; All / Favorited / genre filters;
  language filtering where useful. Explicit consent before external media loads.
- Discover: Adrenaline first and Documentaries; select relevant live feeds only
  from the user's approved imported catalog. Do not imply access to Red Bull's
  full VOD catalog, or equate reachable endpoints with integration permission.
- Choose native MP4, existing HLS or a player library from demonstrated needs.
  The prior Video.js 10 RC control test failed; no production readiness inferred.
- Preserve the PHP gate and private storage, existing live-player lifecycle and
  one-audible-feed invariant. No bundled complete films or playlist snapshots; licensed artwork is separately attributed.
- Verify meaningful transitions and controls at 1600×900 and 390×844. Browser
  playback does not establish Tesla compatibility, audibility or physical QR use.

## Starting state and preservation

Existing modified files: CHANGELOG.md, docs/README.md, docs/ROADMAP.md and
docs/work/2026-09-20-release-handoff.md. Existing untracked files: the September 20
cinema proposal and September 22 source verification / rejected title register.
Preserve their history and unrelated edits. One writer in this Dropbox checkout.

## Delivered locally

- Theatre: 22 works / 29 MP4 editions, with BBS counted once across eight episodes.
  Native player, full source/rights/edition notes, original synopses, local QR,
  per-origin visit consent, device-local favorites and combined filters.
- Discover: Adrenaline first and Documentaries over the already approved catalog;
  View all reaches every matching identity beyond the eight-card preview. No
  playlist snapshot, new automatic source or Red Bull VOD integration.
- Navigation and audio: persistent film DOM, pause on departure, no automatic
  start on title/episode selection, late live-play suppression and native film
  telemetry. Mobile More still exposes Multiview, Guide, Library and Settings.
- Documentation and Unreleased updated. Rejected historical research retained
  with clear supersession notices. Publication subsequently authorized; release evidence below.

The [edition register](2026-09-22-theatre-register.md) separates **22 active works**
from **43 conditional/excluded candidates**. This is a 65-work research universe,
not 65 cleared films. The requested **50 usable works are not delivered**. No
silent classic has yet passed the exact edition/score/restoration checks. There
is no claim that current rights findings provide commercial deployment rights.

## Decisions

Native MP4 was sufficient for actual tested gestures, seeking, mute and fullscreen;
no new library is shipped. The former Video.js 10 RC test is superseded, not
retroactively treated as passing. Retain complete source media and credits.
No film files are bundled. The follow-up replaces typographic placeholders with
22 local images; the [artwork register](2026-09-22-theatre-artwork-curation.md)
records separate rights, exact sources and the distinction between cover and still. Lower-resolution archive editions are labeled SD,
including files with misleading HD/720p names. Only the two verified in-picture
English subtitle editions promise captions inside the player.

Film favorites deliberately remain on the device. They do not silently enter
installation-wide sync, PHP storage or backups. QR targets are direct authoritative
source pages (sometimes archived original pages), not redirects or QR services.
QR rendering preserves four screen pixels per authored module: a fixed 148 px
render failed one desktop decode, which was corrected before the final run.

## Initial implementation verification — 2026-09-22

| Layer | Result | Limit |
| --- | --- | --- |
| Node suite | 192 passed, 0 failed, 0 skipped | Synthetic services and media fakes; not physical devices |
| Syntax/release consistency | Passed; 116 JavaScript files, application remains 2.8.0 | Not a publication |
| Production build | Passed; private app entry relocated | Existing deferred world-map chunk warning remains; no hosting test |
| Real MP4 browser playback | All 29 editions advanced and decoded frames through real UI consent | Short samples, not complete-film viewing or physical audibility |
| Player interaction | 1600×900 and 390×844: play/pause, seek, mute, fullscreen enter/exit, favorite/filter persistence of media DOM, navigation pause, real native telemetry, suppression of late live play | Chromium; Safari/Tesla remain separate |
| Discover | Real local synthetic playlist consent, exactly one import request, all 11 separate Adrenaline identities and the documentary category, View all and mobile Multiview | Reserved invalid stream URLs; no actual Red Bull availability claim |
| QR | 22 source images decoded to exact URLs; all 44 desktop/mobile rendered QR captures decoded after the sizing fix | No physical camera/Tesla scan |
| Layout | Screenshots inspected at both viewports, no horizontal overflow or page errors | Viewport emulation, not a physical phone |
| Repository hygiene | Locale mirrors, changed local Markdown links, private build entry and whitespace checked | Initial dirty documentation preserved; no staging/commit/push |

Browser-plugin tooling was unavailable; the announced frontend testing skill's
Playwright fallback used bundled Chromium in fresh temporary profiles. The normal
browser run used an empty mocked PHP installation response; the synthetic import
run used the supported static-host 404 fallback. Neither touched production
credentials or installation data. Temporary browser launches needed the macOS
sandbox exception; no approval review rejection occurred.

Durable local evidence: `/Users/enuzzo/Documents/Codex/catodo-theatre-review-2026-09-22/`.
It contains browser/QR results, selected screenshots, anonymous source evidence,
codec probes and reproduction scripts, without full media downloads or secrets.
The local development server was started on `http://127.0.0.1:5176/app.html?qa=1`.
It is a frontend preview, not a working PHP hosting environment.

## Remaining work and exact next start

1. Resume from the register's conditional section: prioritise The Immigrant,
   The Pawnshop and A Trip to the Moon for classic-cinema editions; The Internet's
   Own Boy and The Lionshare for substantive contemporary additions. Resolve
   exact source/license/file gaps before activating any record. Do not pad to 50.
2. Broaden subjects, improve SD sources and attach verified English captions where
   available. Optional Italian-language breadth remains under-represented.
3. Check physical Tesla playback/audio/fullscreen, phone QR scanning and Safari.
   Inspect actual installed approved Red Bull identities without importing new
   sources unless the user requests that action.
4. Follow the artwork/curation register for the newly requested vintage horror
   and Elvis seasons. Publication is now authorized and tracked in the release
   section; do not treat conditional titles as already available.

To resume implementation: inspect Git first (this task began with dirty docs), then
`src/data/theatre-catalog.js`, this handoff and the edition register. The rest of
the product queue remains in ROADMAP; this work does not authorize those items.


## Authorized 2.9.0 release follow-up — 2026-09-22

Prepared with `npm run release -- 2.9.0` after explicit user authorization for
version/changelog, commit, push and deployment. Artwork and vintage-film research
are documented in the linked register. The runtime contains 22 local images
(two official DVD covers, one ESO photograph, 19 unaltered film stills).
No new vintage title or Elvis film is presented as cleared or playable.

The artwork review found real corruption in the earlier Code Rush encode. The
replacement H.264/AAC transfer was visually checked at opening, two middle
positions and credits, then played and sought to 5:46 in the compiled app.
Nonsquare video samples are normalized for cover JPEGs without cropping content.

Release checks:

- 192 Node tests passed, none skipped; JavaScript syntax and 2.9.0 metadata passed.
- Production build passed with private app entry; four PHP syntax checks passed.
- All nine installable/transparent icon alpha and shape checks passed.
- Compiled-app Theatre controls and Discover flows passed at 1600×900 and 390×844.
- Compiled TV smoke passed: explicit local synthetic HLS import, search, saved
  favorite, decoded single player, volume/mute, chrome gestures, four decoded
  Multiview feeds, audio focus 1 to 2, replacement preserving one audio feed,
  and return navigation. This verifies mechanics, not live-provider availability.
- All 22 card images and 22 selected-film images loaded at each viewport; no
  external artwork/media request before consent, no horizontal overflow.
- Code Rush decoded 77 frames in the new playback sample, with successful seek
  to 346 seconds and no media error. Browser display width reflects sample aspect.
- Source QR URLs/assets did not change; prior 44 rendered decodes remain valid,
  with an additional source-panel QR render in each compiled-app viewport.
- Locale mirrors and local Markdown links checked. Existing world-map chunk
  size warning remains; the map is already deferred.

Evidence is retained in
`/Users/enuzzo/Documents/Codex/catodo-release-2.9.0-2026-09-22/`.
The production-bundle runner uses a loopback-only isolated shell route and fresh
browser profiles; this is not a production authentication test or a replacement
for the public hosting boundary checks. No production credentials or stored
installation data are copied into QA.

Publication completed:

- Runtime release commit: `e3667eb581d214db52be1c3d13d630cdc257338a` on `main`.
  Native Git push succeeded; remote main matched that SHA before the evidence commit.
- `npm run deploy:siteground` completed successfully. Existing deploy script
  consumed credentials privately; no credential, cookie or installation-state
  extraction was used for verification.
- Cache-busted production `version.json` returned CATODO 2.9.0. All 30 selected
  public assets (compiled app JS/CSS, 22 artwork files, locale, manifest and touch
  icon) matched local build bytes exactly. Unversioned English locale also matched.
- Public HEAD requests: installation/logo/EPG APIs returned 401; private state,
  private app entry and legacy app.html returned 403; manifest/touch icon returned 200.
- Existing authenticated Chrome session loaded the actual 2.9.0 app and Theatre
  with 22 works, rendered artwork and English language labels. Europe to the Stars
  played with visible moving frames and 1280×720 telemetry; mute worked. Selecting
  Eyes on the Skies cleared the media and stopped playback. The Theatre tab was
  left open without a running film. No installation catalog edits were made.
- Python urllib received a public-resource 403 during verification; the runbook's
  standard curl client succeeded. Only the successful curl results are used for
  hosting/byte-identity conclusions.

The evidence-only follow-up commit updates this handoff and roadmap; it does not
change the deployed runtime and does not require another upload.
Physical Tesla/iPhone playback, audibility, fullscreen and camera scanning remain
open. Short browser samples do not establish uninterrupted full-film availability.
