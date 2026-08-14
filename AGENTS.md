# CATODO repository instructions

- Treat `package.json` as the single source of truth for the application version.
- For every user-visible change, add a concise entry to `CHANGELOG.md` under
  `Unreleased` in the same change set.
- Before publishing a release, run `npm run release -- X.Y.Z`; do not edit the
  splash, login or documentation version strings manually.
- Follow Semantic Versioning: patch for compatible fixes, minor for compatible
  features and major only for breaking changes.
- Run `npm test`, `npm run check` and `npm run build` before commit, push or
  deployment. `npm run check` is the release-metadata consistency gate.

## Local publish and deployment notes

- Codex worktrees share the primary checkout's Git metadata outside the
  worktree sandbox. Read-only Git commands can run normally, but commands that
  write Git metadata (`git add`, `git commit`) and network publication
  (`git push`) should request escalated execution on the first attempt. An
  `index.lock: Operation not permitted` error here is a sandbox boundary, not
  repository corruption; do not delete locks or retry blindly.
- This repository's `origin` uses HTTPS with the macOS `osxkeychain` credential
  helper. A routine push to an existing tracked branch uses native Git and does
  not depend on the separate `gh` token. Treat `gh auth status` as a prerequisite
  only for operations that actually use GitHub CLI/API features, such as opening
  a pull request or editing a GitHub release; an expired `gh` token alone must
  not block a normal `git push`.
- The deployment `.env` is intentionally stored only in the primary checkout,
  whose root is the parent of `git rev-parse --git-common-dir`; Codex worktrees
  normally have no local `.env`. Before `npm run deploy:siteground`, resolve and
  confirm that primary `.env` without printing its contents, expose it to the
  worktree only through a temporary `.env` symlink, and remove the symlink after
  every success or failure. Verify that the worktree no longer contains `.env`
  before finishing.
- Verify a deployment with a cache-busting request to production
  `version.json` (for example `?release=X.Y.Z`). A stale response without a
  cache buster is not evidence that the FTP upload failed.
