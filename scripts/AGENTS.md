# Build and publication tooling

Applies to `scripts/`. Also consult for root package/lock files, `vite.config.js`,
`worker.js` and deployment configuration.

- `release.mjs` updates release metadata; `check-release.mjs` verifies it.
  Preserve the root version contract; never manually bump document versions.
- Vite emits `version.json` and injects the version. `protect-app-entry.mjs`
  moves the built shell to `.catodo-private/app.html`. A raw Vite build alone
  is not the supported production build.
- `siteground-deploy.mjs` uploads protection and the gate before `dist/`, removes
  legacy public `app.html` and preserves private server state. Read the
  [runbook](../docs/OPERATIONS.md#release-checklist), including worktree credential
  cleanup and cache-busted verification, before publication.
- Keep output free of secrets; never enable verbose FTP credential logs.
  Building does not authorize uploading.
- Root `worker.js` is an optional HLS route. Preserve destination/redirect
  validation, HLS URI rewriting and the origin allowlist. CORS is not
  authentication for non-browser clients. Use `tests/worker/redirect-security.test.js`.
- Tooling changes need affected release/security tests and all three root gates
  before publication. See [TESTING.md](../docs/TESTING.md): `check` does not
  syntax-check every root JavaScript file or PHP file.
