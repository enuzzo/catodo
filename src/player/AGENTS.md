# Playback and Multiview

- Start with `player-slot.js` for endpoint lifecycle, `player-manager.js` for
  coordination and `multiview-controller.js` for slots/audio focus.
  `player-transition.js` releases the single player during transitions.
- Keep retries, recovery and fallback bounded. Release listeners, timers and
  HLS instances when replacing or destroying a slot.
- `tuned` means attachment/play request; `playing` is playback evidence. History
  and successful-endpoint memory follow `playing`, not manifest availability.
- Autoplay begins muted; unmuting needs a gesture. Multiview has at most one
  audible slot; entering it releases the single player and starts muted.
- Trace UI changes into `src/ui/markup.js` and `src/app.js`: preserve the media
  element, mute/volume and return to the originating view or Multiview mode.
- `stream-metrics.js` separates measurements, manifest declarations and missing
  counters. No browser counter proves audible physical speakers.
- Use relevant `tests/player/*.test.js` and their `fakes.js`. Audio, autoplay and
  fullscreen changes also need real-browser interactions. Fakes and viewport
  emulation are not real-device validation.

Proxy changes cross into root `worker.js`; consult
[scripts/AGENTS.md](../../scripts/AGENTS.md) and the Worker security tests.
