# Cinema & Docs: source verification and playback decision

> **SUPERSEDED DECISIONS — 2026-09-22.** The Dutch-short selection was explicitly
> rejected. The Video.js RC pilot is not the selected runtime; its final control
> test failed. Keep the observations below as historical evidence and follow the
> [editorial reset and implementation](2026-09-22-theatre-integration.md).

Research date: 2026-09-22. Follow-up to the [initial proposal](2026-09-20-cinema-docs-proposal.md).
Owners: CONTENT-01, CONTENT-02 and CONTENT-03 in the [roadmap](../ROADMAP.md).

## User direction and scope

Prioritize Red Bull TV, Internet Archive and ihavenotv. Blender is a low priority
and is not included in this selection. The requested deliverable is at least
50 titles with documented integration rights and attribution, potentially with
a scannable QR pointing to the evidence, and a current playback technology choice.
This task researches and tests sources; it does not import, publish or implement
a new production catalog or player.

## Outcome and important editorial limitation

The [50-title rights register](2026-09-22-licensed-title-register.md) identifies
50 historical shorts/newsreels with item-specific CC BY-SA 3.0 NL declarations
cross-checked against the publishing institution's current OAI records. Each
has an Internet Archive mirror, explicit attribution and an original MP4.
They are Dutch-language items, mostly one to four minutes, with two longer
pieces. They are **not 50 feature films or contemporary long documentaries**.
This is a defensible historical collection candidate, not a substitute for the
editorial Cinema & Docs ambition. Do not auto-import it simply to meet a count.

The register establishes a published copyright license and its conditions,
not a warranty that all conceivable third-party, personality or territorial
issues have been adjudicated. Creative Commons itself makes that distinction
in the [license deed](https://creativecommons.org/licenses/by-sa/3.0/nl/).
Preserve full original films, their credits and context. Do not present a
publisher's license label as a separate signed indemnity or universal clearance.

## Red Bull TV: present upstream; integration permission still open

- The public [world playlist](https://iptv-org.github.io/iptv/index.m3u) contains
  eight Red Bull entries: AU, BR, DE, ES, EUMENA, SD, UK and US. The public
  [stream API](https://iptv-org.github.io/api/streams.json) contains 17 endpoints
  for channel `RedBullTV.at` across those eight feed identities.
- The Akamai SD master advertised six AVC/AAC renditions, 320×180 through
  1920×1080, and returned HTTP 200 with permissive CORS at review time.
- An isolated Chromium 151 test using CATODO's installed HLS.js 1.5.17 decoded
  81 frames and advanced from 162.53 to 164.55 seconds, muted, at 320×180.
  This proves that sampled endpoint played in that browser; 1080p is manifest
  evidence, not a tested 1080p rendition. Other regional endpoints were not played.
- The installation's stored catalog was not inspected or changed. Upstream
  presence does not prove that a particular installation has the current entry.
  On resumption, use normal Library search for Red Bull before adding duplicates.
- Red Bull's [official media partnerships page](https://www.redbullmediahouse.com/en/partnerships/media-partnerships/)
  describes content licensing, digital linear feeds, FAST and platform/app
  integration. It directs prospective integrations to contact the company.
  No general public grant to redistribute the raw stream in CATODO was found.

Status: upstream coverage and a browser playback sample verified; a dedicated
official integration remains conditional on a supported embed/partnership route.
No provider was contacted, no credentials used, and no new source imported.

## Internet Archive: verify the publisher as well as the item

### Open Images / Netherlands Institute for Sound and Vision

The Archive `openimages` collection had 1,415 movie records in the bounded
discovery query. A set of 101 distinct candidate IDs was checked against the
institution's [documented OAI interface](https://www.openbeelden.nl/api) and
the Archive item metadata API. Of these, 58 had the selected explicit CC BY-SA
3.0 NL license, attribution fields and MP4 entries on both sides. The selected
50 exclude several very short, ambiguous or less relevant entries.

The OAI `attributionName`, `attributionURL` and `license` fields are the evidence
source; do not infer ownership from an arbitrary Archive uploader. The old
Archive mirrors use a misspelled `licensurl` field in some records. A resolver
must inspect both field names, then verify the primary source; it must not
treat either string alone as sufficient clearance.

Some primary records now have a Public Domain Mark while Archive still carries
an older license; other original records are absent. Those are excluded from
this 50-item CC selection. A Public Domain Mark, the old US public-domain
dedication and CC0 are different instruments and must not be conflated.

The [publisher's terms](https://www.openbeelden.nl/terms.en) separate media-item
licenses from the website license. Its [attribution instructions](https://www.openbeelden.nl/help)
require naming/linking the creator and linking the applicable license.
For CC BY-SA, distribute adaptations under the applicable ShareAlike terms;
the CATODO UI is not automatically a derivative of a film merely because it
links or plays the unchanged work. Do not add DRM or contractual restrictions
to rights granted by the media license.

**Edition matters:** the sampled Archive MP4 for `oi3874` is 640×480 and
386.72 seconds, while the current publisher HD file is 1920×1080 and 395.2
seconds. They are not interchangeable exact copies. The register binds the
current rights and attribution to the original publisher edition; Archive is
a discovery/mirror reference. Prefer the original HD file where available;
do not silently switch editions or carry resume timestamps across them.

### Prelinger: attractive editorial candidates, separate rights status

The [current Prelinger policy](https://www.panix.com/~footage/prelarch.html)
explicitly says the whole collection is not public domain. Its old dedication
remains effective for items to which it was attached, but it is
[US-law-based dedication/certification](https://creativecommons.org/publicdomain/certification/1.0/us/),
not CC0 or a new worldwide license warranty. It also distinguishes complete-film
programming and written licensing agreements. Keep territorial/exact-edition
review open before putting these in the strict cleared group.

The following exact Archive items were checked for license metadata and MP4
availability; they are additional candidates, **not counted among the 50**:

| Title | Duration reported by Archive | Rights finding |
| --- | --- | --- |
| [Design for Dreaming](https://archive.org/details/Designfo1956) | 9:16 | Old US PD dedication; territory/edition review open |
| [To New Horizons](https://archive.org/details/ToNewHor1940) | 22:59 | Old US PD dedication; territory/edition review open |
| [Around the Corner](https://archive.org/details/Aroundth1937) | 9:29 | Old US PD dedication; territory/edition review open |
| [How a Watch Works](https://archive.org/details/HowaWatc1949) | 18:40 | Old US PD dedication; territory/edition review open |
| [On Guard! The Story of SAGE](https://archive.org/details/OnGuard1956) | 12:15 | Old US PD dedication; territory/edition review open |
| [Sound And The Story](https://archive.org/details/SoundAndTheS) | Not supplied in reviewed field | Old US PD dedication; territory/edition review open |
| [Living Stereo](https://archive.org/details/LivingSt1958) | 7:42 | Old US PD dedication; territory/edition review open |
| [Private Life of a Cat](https://archive.org/details/PrivateL1947) | 22:01 | Old US PD dedication; territory/edition review open |
| [Plow that Broke the Plains](https://archive.org/details/plow_that_broke_the_plains) | 25:26 | Old US PD dedication; creator missing from reviewed field |
| [San Francisco (1955 Cinemascope film)](https://archive.org/details/SanFrancisco1955CinemascopeFilm) | 21:28 | Archive states CC BY-SA 3.0 and Tullio Pellegrini; establish original grant provenance |
| [This is Coffee](https://archive.org/details/ThisisCo1961) | 11:56 | Old US PD dedication; territory/edition review open |
| [Bridging San Francisco Bay](https://archive.org/details/Bridging1937) | 16:42 | Old US PD dedication; territory/edition review open |

## ihavenotv: discovery, not a blanket integration license

The [site](https://ihavenotv.com/) says its files come from unaffiliated third
parties. The examined pages supply no reusable catalog-wide grant. An iframe,
download link or free viewing price does not establish permission to incorporate
the underlying film in CATODO. No unapproved playback URLs were extracted.

| Lead examined | What can be concluded | Integration status |
| --- | --- | --- |
| [Everything is a Remix](https://ihavenotv.com/everything-is-a-remix) | Leads to Kirby Ferguson; the [author's site](https://www.everythingisaremix.info/watch-the-series) distinguishes original and updated 2023 editions | Verify the exact edition and an official embed grant; no blanket direct-MP4 permission established |
| [Urbanized](https://ihavenotv.com/urbanized) | Documentary discovery lead | No integration license established from the inspected page |
| [The Alpinist](https://ihavenotv.com/the-alpinist) | Documentary discovery lead | No integration license established from the inspected page |

Another substantive documentary candidate is **Patent Absurdity** by Luca
Lucarini: the [FSF release announcement](https://www.fsf.org/news/new-documentary-film-patent-absurdity)
expressly permits sharing under CC BY-ND. Exact delivery-file identification,
license version, retained notices and playback still need checking; do not
mistake the announcement webpage's footer license for an exact media-file record.
For **The Internet's Own Boy**, inspected Archive copies disagree about license
terms. The prominent `TheInternetsOwnBoyTheStoryofAaronSwartzHD` record states
CC BY-NC-SA 3.0. Resolve filmmaker provenance and the NonCommercial condition
before counting a particular copy. Neither title is in the 50-item register.

## Selected VOD technology and why

**Select Video.js 10's framework-free HTML/custom-element layer over native
HTMLMediaElement for the VOD implementation pilot.** Use native progressive
MP4 playback as the foundation; load adaptive engines only for actual adaptive
sources. Keep a native-controls fallback. This is a current technical decision
for the next implementation, not a production migration in this task.

Verified on 2026-09-22: `@videojs/html` latest/next is `10.0.0-rc.2`, Shaka Player
latest is `5.2.11`, HLS.js latest is `1.7.3`; CATODO currently pins HLS.js 1.5.17.
No dependency or lockfile was changed. Recheck versions when implementing.

| Option | Assessment for CATODO |
| --- | --- |
| [Video.js 10 RC](https://videojs.org/blog/videojs-v10-release-candidate) + native MP4 | Selected pilot: modular controls, captions, keyboard/touch, multiple media adapters and a framework-free path. Still a release candidate; require integration/device gates before publication |
| [Shaka Player](https://github.com/shaka-project/shaka-player) | Strong maintained DASH/HLS/DRM engine; unnecessary additional engine for plain Archive MP4. Retain as an option if real DASH requirements appear |
| Native video + CATODO-owned controls | Compatibility fallback and core decoder; minimal media overhead, but CATODO must implement all accessible VOD interactions itself |
| New custom WebCodecs playback pipeline | Not selected: reimplementing demux, timing, seeking and audio would add risk without evidence of an advantage for these sources |

Video.js [targets the latest two stable evergreen browser versions](https://videojs.org/docs/framework/html/concepts/browser-support).
Tesla is not a certified target in that matrix. Do not infer vehicle support
from modern desktop Chrome or from this selection. Native Safari/iOS, actual
Tesla playback, touch/fullscreen and physical audibility are release gates.

Playback requirements:

- MP4 is a container, not a quality tier or codec. Prefer the best authorized
  original rendition supported efficiently by the device. AVC/H.264 + AAC is
  the compatibility baseline. Use AV1/HEVC only when a real source rendition
  exists and device capability/runtime evidence supports it.
- Check `canPlayType` and [MediaCapabilities](https://developer.mozilla.org/en-US/docs/Web/API/MediaCapabilities/decodingInfo)
  (`supported`, `smooth`, `powerEfficient`) where available, with fallback;
  these hints do not replace measurement. Do not upscale SD and call it HD.
- Progressive MP4 has byte-range seeking but no automatic multi-bitrate
  adaptation by itself. Use official HLS/DASH where supplied and tested, or
  explicitly switch available MP4 renditions while preserving position.
- Preserve CATODO's persistent media DOM and one-audible-feed rule. Stop/release
  live playback before entering VOD; do not replace live/Multiview engines merely
  to add a VOD screen. Lazy-load VOD controls.
- Add finite duration, seeking, ended/completed state, replay, optional chapters,
  captions and recoverable errors. Bind resume to title **and edition**.
- Prefer device-local resume/watch-later for a first pilot. Shared persistence
  remains a proposal requiring explicit schema/backup design, not an assumed
  change to installation state.
- Do not set `crossorigin="anonymous"` blindly on remote MP4. The tested Archive
  and original servers lacked CORS headers; that mode failed. Native video
  without the attribute played successfully. This does not grant JS pixel access.
  Captions, canvas thumbnails and cross-origin text tracks require their own
  supported delivery/CORS path; do not weaken access controls or add a generic proxy.
- Asset quality and delivery differ independently of the JS player. No benchmark
  here establishes an absolute fastest player; the recommendation is based on
  architecture, current maintenance and a bounded working playback sample.

## Attribution and QR design

Each title must expose its title, named creator/attribution parties, original
source, exact license/version and link, retained notices, edition, review date
and whether changes were made. A QR complements this visible text; it does not
replace attribution. Keep source/credit links available in the detail sheet and
player's Credits action without covering the film.

Prefer the QR target **the specific publisher item page**, which establishes
the relationship between film and license, rather than only a generic CC deed.
Keep a separate direct license link. Generate QR locally without a tracking or
short-link service. Use black/white contrast, a four-module quiet zone, no logo
overlay and a readable caption; verify decoding independently and later by phone
at the real Tesla viewing distance. No private installation URL, cookie or token
belongs in a QR.

## Verification, publication and next start

The linked register contains per-item HTTP evidence and license references.
An isolated localhost playback bench used a fresh Playwright Chromium 151
profile because the Browser plugin was not available. It did not access CATODO
production state. The initial browser launch required sandbox escalation; the
authorized isolated retry succeeded.

The 50 selected original MP4s each returned HTTP 206 for a 512-byte range
request, with an MP4 signature; one transient 502 passed a single retry.
All 50 locally generated QR payloads were independently decoded with Apple
Vision and matched the expected publisher item URL. This is machine decoding,
not a physical phone/vehicle scan.

A standalone searchable title/credits/QR review artifact was rendered at
1280×950 and 390×844. Both views passed: 50 records and QR images, filtering,
expanded credits, empty state, restoration, no horizontal overflow or script
errors, and zero automatic external requests. Artifacts are outside the repo
at `/Users/enuzzo/Documents/Codex/catodo-source-review-2026-09-22/`; the durable
rights register remains in this repo. The preview is research, not CATODO UI.

After removing the inappropriate CORS attribute, observed playback:

| Sample | Evidence | Limits |
| --- | --- | --- |
| Archive mirror of `oi3874`, native MP4 | 640×480; 386.72 s; 71 decoded frames; time 0.64 → 2.66 s; seek to 60 s and continue | One mirror edition only |
| Publisher original of `3874`, native MP4 | 1920×1080; 395.2 s; 71 frames; time 0.66 → 2.68 s; seek to 60 s and continue | Desktop Chromium, muted |
| Same original, Video.js 10 RC layer | 1920×1080; 71 frames; time 0.73 → 2.74 s; seek and continue | Initial harness layout needed explicit container dimensions; UI verification recorded separately |
| Red Bull sampled live endpoint, existing HLS.js | 81 frames; time 162.53 → 164.55 s; 320×180 | Does not clear integration rights or certify all regional feeds |

No application runtime, dependencies, production state or credentials changed.
No commit, push or deploy was requested or performed. Full npm gates are not
needed for this documentation/research-only change; they remain mandatory
before any future commit/publication. Validate local Markdown links and whitespace.

Next start: resolve whether this historical-short selection belongs in the
product; continue substantive documentary/feature-film rights research from
the candidate table without lowering the evidence threshold. For implementation,
start with an isolated Video.js/native MP4 adapter plus visible credits/QR on
one approved edition, then validate Safari and Tesla before catalog rollout.
