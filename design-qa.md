# CATODO Soft Signal Grid design QA

Source visual truth was provided as four generated design frames during review;
those private working references are intentionally not committed.

- Home
- Countries
- Player and Signal Lab
- Multiview

Implementation evidence:

- `docs/qa/design-qa-home-final.png`
- `docs/qa/design-qa-countries-final.png`
- `docs/qa/design-qa-signal-lab-final.png`
- `docs/qa/design-qa-multiview-final.png`
- `docs/qa/design-qa-boot-final.png`
- `docs/qa/design-qa-responsive-1280.png`
- `docs/qa/design-qa-comparison-home-final.png`
- `docs/qa/design-qa-comparison-countries-final.png`
- `docs/qa/design-qa-comparison-signal-lab-final.png`
- `docs/qa/design-qa-comparison-multiview-final.png`

Viewport, normalization and state:

- Source desktop frames: `1672 × 941` pixels. Each was normalized to `1680 × 946` with density `1` for comparison.
- Implementation desktop: CSS viewport `1680 × 946`, device pixel ratio `1`, capture `1680 × 946`.
- Responsive evidence: CSS viewport and capture `1280 × 720`, device pixel ratio `1`; DOM reported no horizontal overflow.
- Home state: English locale, ten playable channels from ten countries, first channel tuned muted, five favorites, ten Atlas markers.
- Countries state: Italy selected, channel counts sorted descending, map mode, import action available.
- Player state: live channel tuned, muted autoplay, Signal Lab open with honest zero/N/A values while the remote stream is still tuning.
- Multiview state: three active feeds after a removal test, layout `3`, exactly one selected audio feed.

## Findings

No actionable P0/P1/P2 mismatch remains in the final normalized comparisons.

## Required fidelity surfaces

- **Fonts and typography:** Exo 2 Variable is self-hosted and used across navigation, titles and controls; IBM Plex Mono is isolated to diagnostics and telemetry. The final captures preserve the mock's condensed broadcast hierarchy, optical weights, all-caps labels and compact metadata without broken wrapping.
- **Spacing and layout rhythm:** Home uses the same headline/live-directory/Atlas composition, a full-width lower Multiview-and-Favorites band and the persistent signal footer. Countries, Player and Multiview keep the reference's dominant split proportions. Cards mix square grid logic with restrained rounded corners as approved.
- **Colors and visual tokens:** warm paper, signal blue, black text, pale map land and EBU accent bars map directly to the selected direction. Active, live, listening, imported and error states have distinct semantic treatments and usable contrast.
- **Image quality and asset fidelity:** real remote channel logos and real live video elements replace the mock's fictional imagery. The world map is the vendored SVG Maps dataset, Phosphor supplies UI icons and Three.js renders the boot sequence; no emoji, placeholder boxes or handcrafted substitute illustrations are used. Logo/network failures degrade to safe media fallbacks.
- **Copy and content:** product copy is English and locale-key driven. Real catalog names, countries, languages, source state and measured/estimated diagnostic labels replace the fictional mock content without changing its information architecture.
- **Icons and controls:** the supplied Phosphor set is consistent across navigation, Atlas, playback, source import, Multiview and Signal Lab. Active/listening states visibly change icon and border treatment.
- **Accessibility and responsiveness:** semantic buttons/forms, labels, keyboard-focusable map countries, alt text, reduced-motion boot handling, muted autoplay and user-gesture audio are present. The `1280 × 720` evidence keeps core controls accessible with no horizontal overflow; smaller layouts remain scrollable rather than clipping persistent controls.

## Full-view comparison evidence

The four `docs/qa/design-qa-comparison-*-final.png` artifacts were opened as combined reference-plus-implementation inputs. They show matching hierarchy and region proportions across Home, Countries, Player/Signal Lab and Multiview. Dynamic real-world stream imagery differs intentionally from the generated fictional stations; the surrounding product composition remains faithful.

## Focused-region comparison evidence

Separate region crops were unnecessary after the final captures: each combined artifact is `1680 × 1892`, and the high-resolution review kept header typography, live controls, channel metadata, Atlas tools, country table, Signal Lab cells, Multiview audio badge and footer telemetry readable. The final Home capture was also opened independently at original resolution to inspect logo fit, truncation and card density.

## Comparison history

1. The first working capture (not retained in the release) exposed P0 catalog state drift (`1559 LIVE / 0 COUNTRIES`), an empty Atlas/Favorites state and a P1 compressed layout with the Atlas below the headline.
2. Country inference and deterministic QA sampling were added; Home now shows ten channels from ten nations, five Favorites and ten colored Atlas markers. IndexedDB-backed production data remains untouched by the QA presentation layer.
3. The desktop grid was rebuilt so Atlas spans headline and directory rows, the live directory and lower shelf regained the selected proportions, header/search/footer density was retuned and the EBU strip gained its eighth black segment. A working iteration confirmed those P1 fixes before the retained final pass.
4. A focused interaction audit found P0/P1 behavior defects: country import lost its ISO code, North/South America filters were empty, Global Search did not clear, Multiview removal re-added the feed and Atlas zoom controls were no-ops. All were fixed and exercised in the in-app browser.
5. The final Home comparison (`docs/qa/design-qa-comparison-home-final.png`) confirmed the selected Soft Signal Grid composition with real data, live muted anchor, adjacent Random action and working Atlas.
6. The remaining three final combined comparisons confirmed the Countries split, honest Signal Lab and 2/3/4 Multiview system. Browser checks verified one unmuted feed only, removal from four to three feeds, Italy's exact auto-import URL and functional Atlas viewBox zoom/reset.
7. The normal (non-QA) boot was captured at 180 ms with WebGL canvas plus EBU fallback and was hidden after 3.2 seconds with Home visible. The `1280 × 720` pass reported no horizontal overflow.
8. Final runtime reload showed the `10 LIVE 10 COUNTRIES` Home and no browser console warning/error. Production build, syntax check and all 30 unit tests passed.
9. A production-bundle smoke pass verified `app.html`, split Three.js/hls.js chunks and the shipped English locale. The constrained test browser intentionally exposes no `fetch`, `IndexedDB`, `localStorage`, `performance` or `requestAnimationFrame`; CATODO still renders its shell and full country fallback via the in-memory database adapter. Real persisted/live catalog behavior was verified in source preview with the user's existing browser data.

## Primary interactions tested

- Home Random changes the featured station while the interface remains browsable.
- Global Search enters Library, filters live and clears back to the full list.
- Favorites persist through the catalog identity layer.
- Countries select Italy, filter North/South America and open an import dialog containing `https://iptv-org.github.io/iptv/countries/it.m3u` plus consent.
- Atlas zoom-in changes the SVG viewBox and Center Map restores it.
- Player opens, tunes muted and exposes Signal Lab with copyable diagnostics.
- Multiview switches between 2/3/4 layouts, removes a feed without re-adding it and selects exactly one audio source after a user gesture.
- Normal Three.js boot and graceful CSS EBU fallback both mount; the intro exits into Home.

## Implementation checklist

- Final combined visual comparisons opened and reviewed.
- P0/P1/P2 findings fixed and re-captured.
- Browser console warnings/errors empty on the final reload.
- Production build succeeds; 30/30 tests and syntax checks pass.
- Verified local preview remains open at `http://127.0.0.1:4173/app.html?qa=1`.

## Follow-up polish

- [P3] Live poster/logo composition varies by broadcaster. The current contain-on-signal treatment prevents cropping; an optional future first-frame thumbnail cache could make cold tuning feel more editorial.
- [P3] A future locale switcher can expose the already isolated translation layer when the second language ships.

final result: passed
