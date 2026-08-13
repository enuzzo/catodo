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
