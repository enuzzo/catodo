# CATODO roadmap

This file separates shipped behavior from work that still needs implementation
or real-device validation. It is intentionally concrete and ordered by value.

## Shipped in the current release

- Home live channels and Favorites tune the dashboard preview instead of
  jumping directly to fullscreen; random suggestions have their own refresh.
- Fullscreen always opens explicitly and returns to the page that launched it.
  The redundant Fit control has been removed.
- Favorites use one red, substantial heart language everywhere, with restrained
  star-burst add and lightning remove micro-animations.
- The Home featured surface is a compact neutral control row: Favorite,
  fullscreen and Random; country/language/quality metadata is larger and
  separated by vertical rules.
- Explore All shows eight items per collection with independent randomization.
  Dedicated categories expose progressively loaded full grids and sorting.
- Countries supports Load more, Load all and known-country guide connection.
  Country cards reserve enough width and height for long titles and metadata;
  guide sources are discovered dynamically from GlobeTV instead of requiring a
  hand-written country allowlist.
- Multiview saved presets expose Rename and Delete actions.
- TV Guide sources can be searched and installed by country, grouped and
  removed by country/source, and report download time, programme counts and
  actual channel matches. The guide only lists matched channels and includes
  timeline, channel overlays, tile indicators and a player programme strip.
- Stream diagnostics now expose real download throughput/loaded bytes when the
  browser or HLS runtime reports them; unavailable upload telemetry is labelled
  honestly instead of displaying a false zero.
- The production package includes a standalone web-app manifest and original
  full-canvas vintage-TV/EBU artwork with Netmilk cow horns for iPhone, iPad and
  other installable browsers.
- Website branding and the animated splash use a true-alpha naked CRT mark with
  silhouette-aware depth, while installable iOS/PWA icons keep their backing.
- Fullscreen playback fetches only the tuned channel's mapped guide on demand,
  with request deduplication and configured-source fallback.

## Implemented and verified in 2.3.0–2.4.0

- Library now presents Favorites, imported-channel and active-source counts as
  a compact inline summary beneath the heading instead of three large statistic
  cards, preserving the useful overview while returning vertical space to
  recent and saved channels.
- Channel metadata now uses a shared badge renderer across Home, Explore,
  Countries, Library, TV Guide, the Multiview picker and the immersive player.
  Country, language, resolution and the first available genre keep neutral pill
  backgrounds while only their compact icons carry a stable type color; absent
  genre metadata is omitted rather than inferred.
- The immersive player now adds a compact 24-hour local clock for the streaming
  location, sourced from the feed's official IANA timezone metadata and labelled
  by timezone city to disambiguate multi-zone countries. It remains hidden when
  metadata is absent rather than guessing from a country code. Rendered QA at
  1600×900 verified live channel changes from `Amsterdam 00:02` to `Rome 00:02`,
  complete containment with Guide visible, and automatic omission at 390×844
  where the transport does not have enough horizontal space.
- Player Favorite feedback now uses a top-layer-safe stacking level, keeps its
  burst inside the viewport instead of centering it against the top edge, and
  gives both add and removal states enough time to remain perceptible. Rendered
  verification covers the actual player overlay; native Fullscreen API entry
  remains a physical/connected-browser check where automation denies top-layer
  permission.
- Favorites now request an already mapped guide immediately after being saved,
  reuse country/custom XMLTV sources that the user previously accepted, and
  expose a direct country-guide consent action when coverage is not configured.
  Provider `unmatched`, `stale` and `error` outcomes remain visible instead of
  being presented as guaranteed programme coverage. Focused decision-model
  tests pass; rendered browser verification at 1600×900 followed an Australian
  Favorite from Home to the unchecked GlobeTV/provider consent in Countries.
  At 390×844 the actionable toast remained fully inside the viewport. No
  provider acceptance or new guide installation was performed during this QA.
- Explore refreshes its eight-channel category rails on every view entry, tunes
  channel-card selections in the embedded preview instead of opening the player,
  and exposes preview audio plus full-player controls matching Home. Verified in
  rendered Chromium at 1600×900 and 390×844, including rail refresh after player
  return, exact preview/player channel identity, audio state and mobile containment.
- Multiview now treats the first saved preset as its default entry state. A
  channel added from fullscreen replaces the preset's first slot while keeping
  the saved preset itself unchanged and avoiding duplicate feeds. Verified in
  rendered Chromium at an exact 1600×900 viewport, including the neutral preset
  selector for the temporary layout and restoration on the next normal entry.
- Explore now chooses Euronews Italian as the initial hero when it exists in the
  imported catalog. Fullscreen Favorite feedback is mounted inside the active
  fullscreen element, and Guide programme cards keep `Now playing` within
  bounds while allowing clipped short-programme titles to expand temporarily.
  Focused model tests cover the Explore choice and fullscreen host selection;
  rendered 1600×900 browser verification covers Guide geometry, expansion,
  second-click details and automatic collapse. Browser automation did not grant
  actual Fullscreen API entry in either the in-app browser or Chrome, so visual
  confirmation of the fullscreen animation and physical Tesla touch remain
  device-owner checks.
- Dedicated Explore categories now use inline radio-style sorting, expose a
  country selector with per-country counts and place the filtered channel total
  after a visual separator. The form-action regression that destroyed a select
  on its opening click is fixed at the shared dispatcher. Browser-plugin QA used
  the real local catalog at 1600×900 and 390×844: country selection, filtered
  totals, hero replacement and quality sorting all updated coherently with no
  console errors or framework overlay. Native Tesla/mobile touch remains a
  device-owner check rather than a simulator claim.

## Next work

### P0 — validate on target devices

- Complete the remaining 1600×900 Tesla smoke evidence. The 2026-08-13 browser
  pass verified Home preview, Countries long-title wrapping, Explore
  randomization, fullscreen launch/return to Home, Explore, Countries and
  Multiview, plus two-, three- and four-feed Multiview with audio selection.
  It reproduced pointer drag staying at `scrollLeft = 0`; the Unreleased fix is
  now verified in Playwright at the exact 1600×900 viewport: the timeline moved
  by roughly one hour, normal programme selection remained usable and
  **Favorites only** reduced the Guide to the single persisted favorite.
  Focused pointer/touch unit coverage is also present. Native Tesla touch
  behavior remains a target-device check, not a browser-emulation claim.
- Keep the real XMLTV matrix reproducible without overloading providers. Italy
  is verified against the real 310-channel country playlist and all eight Open
  EPG feeds: one manual refresh produced 182 source matches, current programmes
  through Aug 16, 2026 and 35/36 covered channels in the visible Guide candidate
  set. Pre-refresh stale rows and the transition to current data were observed.
  France and Germany were then validated at service level with real country
  playlists and one GlobeTV feed each, cadence set to Manual only: France
  matched 9/214 channels (22,466 programmes; 205 real no-matches) and Germany
  matched 11/294 (20,540 programmes; 283 real no-matches). Both upstream feeds
  were genuinely stale, ending Jan 2 and Jan 3, 2026 respectively. Each country
  used one playlist request and one XMLTV request; removal issued zero provider
  requests and returned schedules to `unconfigured`. The retained local XMLTV
  cache after removal is documented behavior to revisit. The 1600×900 browser
  UI pass now also connects France (two GlobeTV sources) and Germany (four)
  after an explicit third-party acceptance. The installed local catalog had
  one French and 48 German channels; none matched those upstream identifiers,
  so the cards now report `No guide match` instead of the false, generic
  `Guide unavailable`. This UI evidence proves discovery, consent and install,
  not fresh programme coverage; the real upstream data remains stale as noted
  above.
- The cross-country EPG sequence reproduced a separate regression before the
  fix: evaluating French channels overwrote all eight Italian source rows from
  182 matches to zero. The Unreleased implementation now scopes country loads
  to the relevant installed feeds, with a regression test proving that another
  country's provider is not fetched and its diagnostics are not overwritten.
- Validate iPhone and iPad Home Screen installation: sharp icon, standalone
  launch, safe-area layout, orientation changes, login-cookie continuity and
  video/fullscreen behavior. Static review confirms correctly sized 152, 167
  and 180 px Apple touch icons, a standalone manifest with `orientation: any`,
  `viewport-fit=cover`, a signed 30-day Secure/HttpOnly login cookie and inline
  video setup. Simulator evidence is now available on iOS 26.5 with an iPhone
  17 Pro and iPad Pro 13-inch (M5): Safari portrait/landscape rendering,
  Countries, mobile More → TV Guide, an explicitly consented Italy import,
  live HLS playback, immersive player entry/return, standard Fullscreen entry
  and first-session Favorite selection all worked without mirror/automation
  console errors or framework overlays. The
  iPad pass loaded 304 playable channels and retained Rai Sport as the only
  Favorite across a reload, then selected a non-Favorite on the next
  Explore → Live return. This remains simulator evidence: safe-area insets are
  currently applied explicitly only to the splash Skip control, and no real
  Home Screen installation, standalone launch, cookie continuity, rotation or
  system-fullscreen exit result is claimed. `devicectl` sees one physical
  iPhone (`iPhone18,1`) but reports it as `unavailable`; no iPad is listed, so
  physical-device verification remains with the device owner.

### P0 validation evidence status

| Surface | Shipped / implementation state | Verified in this pass | Still open |
| --- | --- | --- | --- |
| Tesla shell | Home, Countries, Explore and exact player return shipped in 2.2.0; pointer drag implemented under Unreleased | 1600×900 viewport, long country title, real interactions, return origins, rendered Guide drag and Favorites | Native target-device touch behavior |
| Multiview | 2/3/4 feeds, audio selection and slot expansion | All layouts, audio state and expanded-slot return at 1600×900 | Native target-device touch behavior |
| Italy EPG | Eight-feed Open EPG preset and stale reporting | Real playlist, one refresh, match counts, current programmes and stale-to-current transition | UI removal was superseded by service-level removal; retained-cache policy remains open |
| France/Germany EPG | Dynamic GlobeTV discovery; consent-first country connection and precise channel states implemented under Unreleased | Real service-level install/match/no-match/stale/removal plus 1600×900 UI connection of two French and four German sources; rendered no-match state is explicit | A future fresh-data provider recheck; do not represent stale feeds as current coverage |
| Cross-country EPG isolation | Not shipped in 2.2.0; scoped-loading fix implemented under Unreleased | Reproduced 182→0 Italy diagnostic corruption before fix; focused test verifies provider/status isolation after fix; cumulative IT+FR+DE UI retained Italy Guide coverage at 35/37 | Retained-cache removal policy remains open |
| iPhone/iPad | Installable manifest and artwork | iOS 26.5 Simulator: iPhone/iPad Safari portrait/landscape, navigation, Italy import, live HLS, player/return, Fullscreen entry and Favorite-first launch | Real-device Home Screen installation, standalone safe areas, cookie continuity and system-fullscreen exit |

### P1 — guided installation UI

- Add a small, dismissible **Add to Home** entry point only on eligible mobile
  and tablet browsers. Use `beforeinstallprompt` where a browser exposes it.
- On iOS/iPadOS, show concise Share → Add to Home Screen instructions instead of
  pretending the native install sheet can be opened from JavaScript. Hide the
  prompt when `display-mode: standalone` or `navigator.standalone` confirms the
  app is already installed.
- Reuse the vintage-TV artwork in the guide and add accessible copy plus a
  remembered dismissal state.

### P1 — remote playback

- Add one mobile-first **Stream** button, hidden on Tesla and browsers with no
  supported remote-playback route. Its sheet presents AirPlay and Chromecast
  with their own icon, availability state and short connection guidance.
- Use WebKit playback-target detection and the native AirPlay picker on
  iPhone/iPad. Apple owns device discovery and device names; CATODO must not
  simulate a custom scan that the browser does not expose.
- Prototype Chromecast through standards-based Remote Playback first, then use
  the Google Cast Web Sender SDK if real-device coverage requires it. Let the
  system/Cast picker present receiver names while CATODO keeps one consistent
  entry point.
- Validate hotel/guest-network behavior, authenticated and cross-origin HLS,
  cookies, expiring stream URLs, receiver codecs and disconnect/reconnect states
  before treating either route as shipped.

### P2 — maintainability and polish

- Move remaining new inline English status/toast strings into the locale files.
- Split low-frequency Countries/Guide code from the main production chunk and
  measure boot/memory impact before and after.
- Add repeatable mobile/tablet visual regression snapshots and a manifest/icon
  validation step to CI.
