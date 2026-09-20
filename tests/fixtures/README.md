# UI review fixture

`ui-review.m3u` contains 96 synthetic channels and reserved `.invalid` stream
URLs. It contains no third-party streams and is not part of the production build.

With Vite running, open `/app.html?qa` on a separate local origin/profile and
import `http://127.0.0.1:5173/tests/fixtures/ui-review.m3u` through Add playlist.
The normal import confirmation still applies. Use it to verify category/language
filters, clear/reset, pagination, country coverage, empty results and long names.
Playback attempts fail by design; this fixture is not evidence of media delivery.
Do not import it into the production installation.

`/tests/fixtures/ui-states.html` mounts the production renderer with synthetic
connected-world metadata only. `?state=guide-loading` shows the guide loading
state. These layout fixtures do not fetch playlists, guide feeds or media, do not
sync data, and only implement navigation needed for visual inspection. Use the
real `/app.html?qa` path for end-to-end behavior.
