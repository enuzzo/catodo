# Frontend work

Applies to `src/`. Also consult for `app.html`, `styles/main.css` and the two
locale mirrors. Data, player and EPG subtrees add their own guidance.

- `app.js` coordinates state/services; `ui/markup.js` constructs and updates DOM.
  Prefer existing focused `ui/*-model.js` helpers for decisions. Keep parsing,
  persistence and recovery logic in the owning service.
- Keep video elements persistent. Favorite, telemetry, guide and chrome updates
  must not retune playback or reset mute/volume implicitly. Trace both the
  dispatcher in `markup.js` and the handler in `app.js` for interaction changes.
- Preserve the Soft Signal Grid design in [BRIEF.md](../BRIEF.md), touch targets,
  keyboard access, responsive containment and reduced-motion behavior. Styling
  lives in `styles/main.css`; a focused fix is not a redesign.
- Add product strings through `src/i18n/index.js` and update both
  `locales/en.json` and `public/locales/en.json`. Allow longer translations and
  avoid assuming left-to-right layout.
- `boot/signal-hyperjump.js` owns boot; `ui/signal-easter-egg.js` and its model
  own footer effects. Keep dismissal, silence and reduced-motion paths intact.
- Use relevant `tests/ui/*.test.js` and `tests/i18n/index.test.js`. Visible
  changes need rendered checks at affected viewports; 1600×900 is the Tesla
  layout baseline, not proof of actual vehicle behavior.

See [CODE-MAP.md](../docs/CODE-MAP.md) for cross-file routes and
[TESTING.md](../docs/TESTING.md) for commands and browser limitations.
