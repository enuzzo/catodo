# Cinema & Docs — future source and product proposal

> **Current direction:** [Theatre editorial reset](2026-09-22-theatre-integration.md).
> The later Dutch-short shortlist was rejected; it is not an approved catalog.

Status: idea recorded at the user's request on 2026-09-20, with preliminary
source research. Not implemented, imported or approved as a content catalog.
Roadmap owners: CONTENT-01 and CONTENT-02.

**2026-09-22 follow-up:** the user deprioritized Blender and requested Red Bull,
Internet Archive and ihavenotv verification, at least 50 documented titles,
visible attribution/QR and a current VOD technology choice. See the
[source verification and decision](2026-09-22-source-verification.md) and
[50-item historical-short register](2026-09-22-licensed-title-register.md).
These supersede the priority order below. The historical-short selection is
not a cleared catalog of 50 feature films; editorial selection remains open.

## Product direction

Explore a dedicated **Cinema & Docs** destination for on-demand documentaries,
classic cinema, independent films and open animation. Red Bull TV also merits a
live-channel entry if an official supported route is available. Keep live feeds,
on-demand titles and provider links distinguishable in the UI.

Suggested shelves: Documentaries, Classic Cinema, Adventure & Sport, Open Movies.
Potential functions: language/subtitle and duration filters, Watch later,
Continue watching and a compact source/credits panel. These are design proposals,
not commitments or completed features. Prefer a small curated pilot over an
automatic import of an entire archive.

## Sources to investigate

| Candidate | Preliminary observation | Next verification |
| --- | --- | --- |
| [Red Bull TV](https://www.redbull.tv/en) | Official service offers live/24-hour programming, films and shows; user requests its inclusion | Check whether the existing world catalog already contains it. Verify official playback/embed availability, permitted use, geography and URL stability before adding a duplicate or custom integration |
| [ihavenotv](https://ihavenotv.com/) | Site presents a curated free documentary catalog | Treat as a discovery lead. This initial review did not establish rights or integration permission; identify original publishers and authorized playback routes per title |
| [Internet Archive](https://help.archive.org/help/movies-and-videos-a-basic-guide/) | Documents movie streaming and direct MP4 playback; explicitly cannot guarantee uploader rights information | Curate exact items/editions with documented rights; distinguish public domain from Creative Commons. Check applicable territories and separately assess dubbing, subtitles, soundtrack and restoration |
| [Blender Studio open movies](https://studio.blender.org/remixing/) | Studio generally uses CC BY and publishes asset-specific licensing | Good pilot candidate. Confirm each film's attribution and exclusions; source playback from an authorized origin |

One concrete open-film candidate is
[Spring](https://studio.blender.org/projects/spring/pages/about/): its publisher
states CC BY 4.0, with attribution and trademark/third-party exclusions. It is an
example of a documented license, not an assertion that all free films share it.

GitHub discovery leads found during this pass:

- [Free Official YouTube Content](https://github.com/SuperAB123/Free-Official-Youtube-Content):
  leads to publisher channels across documentaries, films and other categories.
- [Awesome Free Movies](https://github.com/MiKatre/awesome-free-movies):
  service discovery organized by country/language; verify each provider directly.
- [Public-domain/free IMDb tools](https://github.com/petterreinholdtsen/public-domain-free-imdb):
  candidate title identifiers and evidence links, not final rights clearance.

A repository's code/list license does not establish a film's distribution rights.
Free viewing, permitted embedding and permission to reuse media are separate
questions. Do not infer that every Archive upload or an old/famous film is public
domain everywhere. No famous title was cleared during this preliminary pass.

## Technical investigation before implementation

CATODO currently has an HLS-oriented live player. Progressive MP4, seeking,
duration, completion and resume state require an explicit VOD path; they should
not be treated as interchangeable live M3U entries. Evaluate native MP4 playback,
byte-range seeking, codecs, CORS, subtitles and Tesla/iOS behavior. Official
embeds or external provider links may be appropriate where direct playback is
not supported. Do not work around DRM, provider restrictions or expiring access.

Internet Archive's [metadata API](https://archive.org/developers/md-read.html)
exposes item metadata and file records at `/metadata/{identifier}`. Investigate
bounded metadata reads, stable item IDs, playable derivatives, cache policy and
service usage terms. Metadata is evidence to review, not proof of rights.

For each pilot title record original source, edition, language/subtitles,
duration, rights evidence URL and review date, required attribution, territory,
integration mode and playback test result. Keep third-party contact subject to
existing consent rules; do not bundle films or downloaded catalog snapshots.
Define whether Watch later/resume is local or shared before changing persistence,
backup or the PHP schema.

## Next start

When the user chooses this work: first check existing Red Bull catalog coverage,
then prepare a short reviewed shortlist spanning Red Bull, open documentaries,
Archive classics and Blender films. Present integration mode and evidence gaps
alongside each title. Choose the initial section scope before implementing VOD.
No provider playback or full legal review was performed in this note.
