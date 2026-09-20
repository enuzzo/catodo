# TV Guide and provider discovery

- `xmltv.js` owns parsing/matching; `service.js` owns fetching/cache/schedules;
  `catalog.js` owns country discovery; `presets.js` owns preset migration.
  UI decisions live in `src/ui/*guide*-model.js` and `app.js`.
- Installation requires explicit consent. Reuse approved sources and preserve
  cadence. Do not invent provider URLs or silently accept a provider.
- Preserve bounded downloads/parsing, deduplicated requests, stale-cache fallback
  and country-scoped updates. One country must not overwrite another country's
  diagnostics or cause unrelated provider requests.
- Download success, channel matching and programme freshness are separate facts.
  Valid XML and nonzero matches do not prove current schedules.
- Provider routes cross `public/epg-cache.php` and the Vite development bridge.
  Consult [server guidance](../../docs/SERVER.md) before changing allowlists or
  compressed/expanded limits. Vite does not validate PHP authentication.
- Most EPG tests, including service/catalog cases, are in `tests/epg/xmltv.test.js`.
  Consent, favorites and timeline also have focused `tests/ui/` coverage.
- Use stubbed fetches for regression tests. Live checks should record date,
  source, request scope and stale/no-match outcomes. Old roadmap counts are
  historical evidence, not current provider availability.
