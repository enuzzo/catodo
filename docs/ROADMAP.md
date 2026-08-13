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
  Country cards reserve enough width and height for long titles and metadata.
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

## Next work

### P0 — validate on target devices

- Run a complete 1600×900 Tesla smoke pass: Home preview, Countries long-title
  grid, Explore, TV Guide drag, fullscreen launch/return and Multiview.
- Validate at least one Italian and two non-Italian XMLTV country packs against
  real channels, including no-match, stale-data, refresh and removal states.
- Validate iPhone and iPad Home Screen installation: sharp icon, standalone
  launch, safe-area layout, orientation changes, login-cookie continuity and
  video/fullscreen behavior.

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
