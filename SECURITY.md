# Security policy

## Supported versions

Security fixes are applied to the current `main` branch. Please update to the latest revision before reporting an issue.

## Reporting a vulnerability

Use GitHub's private **Security Advisory** reporting flow for this repository when it is available. Include a clear reproduction, affected revision, impact, and any proposed mitigation. Do not publish a proof of concept, credentials, private URLs, or exploit details in a public issue before maintainers have had a reasonable chance to respond.

If private reporting is not enabled, contact the maintainers through the repository's published contact channel and request a private exchange. Content or source-link reports belong in [TAKEDOWN.md](TAKEDOWN.md), not in security reports.

## Security model and deployment notes

- **Untrusted playlists:** M3U data, channel metadata, logos, manifests, and all stream URLs are third-party input. Do not treat them as trusted HTML, script, credentials, or application configuration. Preserve parsing and rendering boundaries when extending imports.
- **Deep links:** accept only explicitly allowed in-app destinations and validate route parameters. Do not turn arbitrary URL fragments, query values, or imported metadata into navigation targets.
- **Worker proxy / SSRF:** `worker.js` fetches user-selected remote URLs and therefore must remain restrictive: allow only `http`/`https`, reject localhost, private, link-local, metadata, and other internal targets, and retain origin checks, response-size limits, and redirect-aware validation. Do not deploy it with `ALLOW_ORIGIN = "*"` outside local testing, and do not turn it into a general-purpose fetch proxy.
- **Optional PHP gate:** keep `.htpasswd` out of version control, use HTTPS, and verify that a reverse proxy or static cache cannot expose `app.html` directly. Rotate credentials after suspected disclosure.
- **Third-party media:** CATODO cannot make an upstream stream safe or available. Do not add DRM circumvention, credential replay, geo-restriction bypassing, or secret-bearing source URLs.

## Scope

Relevant reports include vulnerabilities in CATODO's client, import and storage handling, optional PHP gate, or Worker proxy. Availability or rights issues in third-party playlists, logos, EPG data, and streams are outside the software security scope unless CATODO itself introduces the vulnerability.
