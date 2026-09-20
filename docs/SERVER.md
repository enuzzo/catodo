# PHP services and public assets

Applies to `public/`. Also consult for root `index.php`, `.htaccess`, deployment
entry protection and the PHP-related Vite bridge.

- `installation-api.php`, `logo-cache.php` and `epg-cache.php` require the signed
  gate cookie. Keep private storage, gate bookkeeping, `.htpasswd` and built
  `.catodo-private/app.html` inaccessible through public HTTP paths.
- Installation state needs whole-payload validation, optimistic revisions,
  locking and atomic replacement. Corrupt state fails closed. Consult
  [data guidance](../src/data/AGENTS.md) for the corresponding client.
- Logos retain HTTPS/public-IP/redirect/MIME/size checks. EPG retains the
  provider/path allowlist and compressed/expanded size limits. Neither service
  is a general-purpose proxy.
- PHP tests use temporary synthetic credentials/storage. Do not test migrations
  by editing live canonical JSON or the user's credentials.
- `manifest.webmanifest` starts at `/`, through the gate. Installable PNGs are
  square/opaque; website branding retains transparency. Keep both locale mirrors
  synchronized. Caching the authenticated shell in a service worker requires
  explicit consideration of its security boundary.
- Run PHP syntax checks on changed endpoints and their built copies, plus
  relevant PHP/security/branding tests from [TESTING.md](TESTING.md).
  Vite does not execute PHP; PHP CLI cannot validate SiteGround Nginx/Apache
  routing. Report these as different evidence levels.
