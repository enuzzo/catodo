# Working on CATODO

CATODO is a Tesla-first live-TV web app: vanilla JavaScript ES modules, Vite,
IndexedDB and a PHP access gate on SiteGround. Product intent: [BRIEF.md](BRIEF.md).

## Start with the task

- Check the current Git branch and working tree; preserve unrelated changes.
  This checkout is Dropbox-synced: keep one active writer and investigate
  unexpected changes before overwriting anything. Do not repair Git locks or
  recreate metadata to work around sandbox or online-only file problems.
- Read only guidance relevant to the task. Use the routes below; open
  [the code map](docs/CODE-MAP.md) when the entry point is unclear.
- Before editing a subtree, read its applicable `AGENTS.md` files even when
  the session started at the repository root. Linked Markdown is reference
  material to open on demand, not an automatically loaded instruction layer.
- Complete authorized, reversible local work without repeated confirmation.
  Ask when missing information materially changes the result; continue
  independent work while waiting. A roadmap item is not authorization to build it.

## Task routes

| Work | Read when relevant |
| --- | --- |
| Frontend, UI, copy, boot; root CSS/HTML and locale mirrors | [src/AGENTS.md](src/AGENTS.md) |
| Catalog, identity, persistence, shared configuration | [src/data/AGENTS.md](src/data/AGENTS.md) |
| Playback, audio, Multiview, stream telemetry | [src/player/AGENTS.md](src/player/AGENTS.md) |
| XMLTV, guide discovery and schedules | [src/epg/AGENTS.md](src/epg/AGENTS.md) |
| PHP endpoints, root login/gate, private caches, installable assets | [server guidance](docs/SERVER.md), [SECURITY.md](SECURITY.md) |
| Build, versions, release, deployment, root Worker/Vite config | [scripts/AGENTS.md](scripts/AGENTS.md), [operations](docs/OPERATIONS.md) |
| Documentation, planning, historical evidence | [docs/AGENTS.md](docs/AGENTS.md), [documentation index](docs/README.md) |
| Cross-module behavior | Relevant section of [architecture](docs/ARCHITECTURE.md) |
| Verification | [test map and evidence levels](docs/TESTING.md) |

Root-file routes are explicit: nested instruction discovery alone does not
cover files outside the subtree where the guide lives.

## Non-negotiable boundaries

- Preserve explicit consent before importing third-party playlists or guides.
  Imported URLs, metadata and media are untrusted. Do not bundle third-party
  streams, playlist snapshots or programme archives.
- Preserve the authenticated PHP gate, private app entry and private storage.
  Do not read, print or commit `.env`, `.htpasswd`, cookies or production data.
  Deployment may consume credentials through its existing script without
  displaying them; follow the worktree procedure in `docs/OPERATIONS.md`.
- Keep persistent media DOM and the one-audible-feed Multiview invariant.
  Browser playback evidence does not establish physical audibility or Tesla
  compatibility.

## Verification and release

- `package.json` is the only application version source. For user-visible
  changes, add a concise `CHANGELOG.md` entry under `Unreleased` in the same change.
- Prepare releases with `npm run release -- X.Y.Z`; never manually change
  splash, login or documentation version strings. Use SemVer: compatible fix =
  patch, compatible feature = minor, breaking change = major.
- Run `npm test`, `npm run check` and `npm run build` before commit, push or
  deployment. `check` includes release-metadata consistency. During iteration,
  choose focused checks from `docs/TESTING.md`; repeat passed checks only after
  relevant changes or new evidence. Report skipped or blocked checks explicitly.
- For publication, read the release checklist and Git/worktree/credential
  notes in [OPERATIONS.md](docs/OPERATIONS.md). Preserve sandbox escalation for
  Git metadata writes; native Git push does not require `gh` authentication.
- This file grants no blanket publication permission. Follow the current task's
  authorized scope; documentation maintenance alone does not call for deployment.

## Collaboration

Explain choices in concise Italian; repository documentation and product copy
stay English. Use 🌟 for advice and ❓ for questions requiring a reply. Preserve
useful ideas in [ROADMAP.md](docs/ROADMAP.md) with their actual status. Close with
changes, checks and their limits, publication status, open work and next start.
For longer work, use the lightweight [workflow](docs/AGENT-WORKFLOW.md).
