# Agent-guidance reorganization checkpoint

Date: 2026-09-20. Scope: repository documentation and working instructions.
Status: complete; the Dropbox verification blocker is resolved.

Publication follow-up: this documentation was included in release 2.8.0.
See the [release handoff](2026-09-20-release-handoff.md). Statements below about
no publication refer to the original documentation-only task.

## Final verification

- Git and dependency directories now report zero online-only files. Git status
  and diff are readable; changes are limited to the intended Markdown files.
- The first build exposed a missing `@rollup/rollup-darwin-x64` package on this
  Intel host. `npm ci --ignore-scripts --no-audit --no-fund` restored dependencies
  from the existing lockfile without changing package versions or the lockfile.
- After reinstall: `npm test` passed 173 tests with zero failures or skips;
  `npm run check` passed 99 syntax checks and release metadata at 2.7.1;
  `npm run build` passed and protected `dist/.catodo-private/app.html`.
- Vite reports an application chunk above 500 kB (about 1.58 MB minified).
  Bundle splitting remains the existing ENG-02 candidate, outside this docs task.
- `git diff --check` and documentation links/anchors passed. The original roadmap
  archive matches its prior tracked body. No runtime source changed; browser,
  live-site and physical-device acceptance were not required or claimed here.
- No commit, push or deployment: this task reorganized local repository guidance.

Earlier attempts below explain the resolved environment issue.

## Completed

- Root task router, scoped frontend/data/player/EPG/tooling/documentation guides.
- Code/test maps, documentation index and workflow rationale with official sources.
- PHP guidance outside deployable `public/`; existing release rules preserved.
- Open roadmap separated from historical QA; old roadmap body preserved verbatim.
- Historical plans labelled inactive; obsolete mandatory skill triggers removed.
- Stale architecture/product descriptions corrected; Unreleased entry added.
- Local documentation links/whitespace checked; JavaScript syntax passed for
  99 files through the first stage of `npm run check`.

## Historical follow-up after partial Dropbox hydration

On the next check, Git status became readable on `main` and showed only the
expected documentation changes. All 25 documentation hashes still matched the
previous checkpoint. `npm run check` completed successfully: 99 JavaScript files
passed syntax checks and release metadata was consistent at 2.7.1.

Filesystem metadata still reported 1,992 online-only files under `.git` and
4,000 under `node_modules`. Git diff/whitespace checks, `npm test` and
`npm run build` remained waiting and were interrupted. Complete offline
availability of these subdirectories is still needed before final verification.

## Initial verification blocker

Git status, full `npm test`, release-metadata stage of `npm run check` and
`npm run build` could not finish while required Dropbox files were online-only
(`dataless` metadata observed on Git files, the lockfile and Vite dependencies).
Waiting commands were interrupted deliberately; this is not a passing gate or a
reported application regression. No commit, push, release or deployment occurred.
The application version remains controlled by `package.json`; no runtime code
was edited. Local copies of the original documentation were saved before editing.

## Next start

No maintenance verification remains open. Start the next product task from the
user's new brief and the relevant route in `CODE-MAP.md`. Commit/publication
remain subject to the requested scope; documentation work needs no deployment.
