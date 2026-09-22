# Third-party notices

CATODO vendors pinned runtime assets so the player can boot without a CDN.

| Component | Version | License | Local notice |
|---|---:|---|---|
| hls.js | 1.5.17 | Apache-2.0 | `assets/vendor/hls/LICENSE` |
| Three.js | r162 / 0.162.0 | MIT | `assets/vendor/three/LICENSE` (legacy vendored archive, not loaded by the current runtime) |
| Phosphor Icons Web | 2.1.2 | MIT | `assets/vendor/phosphor/LICENSE` |
| SVG Maps — World | 2.0.0 | CC-BY-4.0 | `assets/vendor/map/LICENSE.md` |
| flag-icons | 7.5.0 | MIT | `assets/vendor/flags/LICENSE` |
| fake-indexeddb | 6.2.5 | Apache-2.0 | `LICENSES/fake-indexeddb-6.2.5.txt`; constrained-browser in-memory fallback only |
| Exo 2 Variable | 5.3.0 package | OFL-1.1 | `assets/fonts/exo-2/LICENSE.txt` |
| IBM Plex Mono (diagnostic statistics only) | 5.3.0 package | OFL-1.1 | `assets/fonts/ibm-plex-mono/LICENSE` |

The iptv-org APIs/playlists, Open EPG programme feeds, and other user-selected
XMLTV sources are fetched from their providers after user confirmation and are
not included in this repository. Third-party playlist, stream, logo, and EPG
rights are not sublicensed by CATODO.


## Theatre film links

Theatre links to complete film editions under their individual licenses; no complete film or
score is bundled. Selected images are bundled separately under the licenses in
the [artwork register](docs/work/2026-09-22-theatre-artwork-curation.md). The software license does not sublicense
those works. Per-title creators, requested attribution, source and license URLs,
version numbers and viewing conditions live in `src/data/theatre-catalog.js` and
are shown beside the player. See the [edition register](docs/work/2026-09-22-theatre-register.md)
for primary evidence and unresolved candidates. Source QR images are generated
locally; `qrencode` is an optional authoring tool, not a shipped runtime dependency.

## Appearance palette references

CATODO's semantic UI palettes are original adaptations of these published color
references. Muted text, status colors and some accents are adjusted for normal-text
contrast; no editor extension, proprietary Monokai Pro package or remote theme
service is bundled. Theme names identify their inspiration, not affiliation.

- [Catppuccin Latte and Mocha](https://github.com/catppuccin/palette): Catppuccin contributors, MIT; [published palette](https://raw.githubusercontent.com/catppuccin/palette/main/palette.json).
- [Dracula](https://draculatheme.com/contribute): Zeno Rocha and Dracula contributors, MIT; classic dark palette.
- [Monokai classic](https://github.com/microsoft/vscode/blob/main/extensions/theme-monokai/themes/monokai-color-theme.json): classic Monokai reference distributed by Microsoft VS Code under MIT.
- [Solarized](https://ethanschoonover.com/solarized/): Ethan Schoonover, MIT; light and dark base colors.

All theme definitions live in `public/appearance.js` and load from the CATODO host.
