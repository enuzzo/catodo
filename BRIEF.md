# CATODO: operating brief

This folder contains a finished, working project. Do not rewrite it, do not introduce a framework,
do not add a build step. There are four precise tasks, at the bottom.

---

## What it is

A private IPTV receiver that runs inside the Tesla browser, while the vehicle is parked.
A single HTML file, no backend, no dependency other than hls.js from a CDN.
Used by one person only, the car's owner.

The channels come from the public `Free-TV/IPTV` playlist, which only collects stations
declared free to air. No stream is hosted here: the page points to the same URLs
you would use in VLC.

### Technical constraints to respect

They are the reason the code is built this way. Do not "modernize" it.

- **The Tesla browser is Chromium 88.** User agent `Tesla/<firmware>`. No `:has()`,
  no container queries, no syntax beyond ES2016. If you add code, stay within that
  perimeter or you break the target.
- **No native HLS.** Chromium only has the HLS demuxer from 142. hls.js on Media Source Extensions
  is required. Do not replace it with Video.js or Shaka: they are heavier
  and still run on top of hls.js anyway.
- **CORS and mixed content are the real problem.** hls.js downloads manifests, variants, segments
  and keys via XHR: every request is cross-origin. A stream that plays in VLC may not play in the
  browser. On top of that, 109 channels in the useful subset are on `http://` and an https page
  blocks them. This is why `worker.js` exists.
- **Everything must be readable and tappable while stationary in the car.** 72 px minimum target,
  no hover states, high contrast.
- **In the interface language and in any written text: never long or medium dashes.**
  Use commas, parentheses, colons or short hyphens. This also applies to comments, README and
  commit messages.

### Identity

The name comes from the cathode ray tube. The seven EBU color bars are the system:
each channel category takes a bar and keeps it everywhere (column, card, on screen
number, thread above the tuning bar). The background is `#0C0D0B`, the warm green-black of the glass
of a switched off tube. If you touch the graphics, stay within this system.

### Files

```
app.html              the player. Self contained, arrives with no list inside. Served only through index.php.
index.php              login gate: checks username and password against .htpasswd, then streams app.html
worker.js              Cloudflare proxy for CORS, mixed content and hotlinking. Does NOT go on the FTP.
check-playlist.mjs     local diagnosis of an M3U list. Prints to screen, does not write files.
README.md              full documentation, read it before touching anything
```

---

## Baseline rule: CATODO does not distribute anything

This is the project's most important architectural choice and it must not be undone for convenience.

The product arrives **empty**. It does not contain lists, does not host streams, does not act as an
intermediary. The M3U lists are loaded by whoever uses it, from a URL or from a file, and stay in
their browser. The sources screen points to independent third party projects, but those are
links, not content.

Concretely, while working:

- **Do not reintroduce `channels.json`**, or any other channel file inside the repo. A filtered
  copy of a public playlist is still a redistribution, even if the source is public.
- **Do not add preloaded sources** in `CFG.directory` that load themselves on first
  launch. That list describes where to look, and the user decides.
- **Do not cache the lists server side**, not even inside the Worker. The Worker just forwards.
- `check-playlist.mjs` is a local diagnostic tool: it prints to screen and must never
  write channel files meant for the repo or the FTP.
- If a change seems convenient but ends up making the project distribute content,
  stop and ask.

The full reasoning is in `README.md`, section 7.

---

## Task 1: git and GitHub

Initialize the repo and publish it to a **private** GitHub repo.

**Mandatory order.** Write `.gitignore` **before** the first `git add`. If a credential
ends up in even a single commit, it stays in the history forever and the history must be rewritten.

`.gitignore` must cover at least:

```
.env
.env.*
!.env.example
node_modules/
.DS_Store
*.log
deploy/
```

Then: init, first commit, private repo on GitHub via `gh repo create`, push.
Suggested name: `catodo`. Description: private IPTV receiver for the Tesla browser.

Before publishing, check with `git log -p` that no hosts, users or
passwords appear in the diff. If the repo was already initialized elsewhere, check that too.

---

## Task 2: deploy via FTP

The site goes on classic hosting reachable via FTP.

**Prepare `.env.example`** (this one is versioned) with the variable names and no values:

```
FTP_HOST=
FTP_PORT=21
FTP_USER=
FTP_PASSWORD=
FTP_SECURE=true          # FTPS. Set to false only if the hosting does not support it
FTP_REMOTE_DIR=/         # destination folder on the server
SITE_URL=                # public address, needed for the Tesla full screen link
```

**Then create `.env`** with the same empty keys, already ignored by git, and **explicitly tell me
to fill it in myself**. Do not make up values, do not ask me for them in chat, do not write them
anywhere else.

**Write `deploy.mjs`**, consistent with `check-playlist.mjs` which already exists (Node, ESM, no
transpiler). Use `basic-ftp`. Requirements:

- upload **only** `app.html`, `index.php`, `.htaccess`, `robots.txt`
- never upload `.env`, `worker.js`, `check-playlist.mjs`, `node_modules`, `.git`
- if `FTP_SECURE=true` use explicit FTPS, and fail with a clear message if the server
  does not offer it, instead of silently falling back to plain text
- verify that all the variables exist before connecting, and explain which one is missing
- print what it uploaded and how many bytes
- add the script to `package.json` as `npm run deploy`

In the README, add a short section on the deploy. State in writing that **plain FTP
sends credentials in the clear** and that if the hosting offers SFTP or FTPS, that should be used instead.

---

## Task 3: the PIN does not work, and I know why

The owner reports that the correct code is being rejected. I have already isolated the cause
by running the page in jsdom across ten scenarios. **Do not restart the investigation from scratch.**

Results: the flow works with the default PIN, from the keypad, from a physical keyboard, with
fast typing, with an OK confirmation, with a six digit PIN and opened from `file://`.
It fails in two cases, both caused by changing that line:

1. **`pin: 0712`** (a number with a leading zero, without quotes)
   Generates `SyntaxError: Octal literals are not allowed in strict mode`. The entire script dies
   at parsing, so the page stays stuck on the test card and does not respond to anything.
2. **`pin: "1957 "`** (a trailing space, typical from copy and paste)
   No error, no warning: the comparison never matches and the correct code is always
   rejected. This is the symptom described.

**The real defect is not the value, it is the comparison.** In `app.html`, inside `buildGate()`:

```js
const submit = () => {
  if (buf === String(CFG.pin)) { ... }
```

Make it tolerant and not silent:

- normalize both sides with `String(...).trim()`
- on startup, validate `CFG.pin`: if it contains non numeric characters or is empty, show an
  explicit message on the access screen instead of silently rejecting, because
  the keypad can only produce digits and a PIN you cannot type is a dead end
- the number of dots must follow the PIN's actual length, not be fixed at four
- in the comment next to `pin:` state that the value must **always be in quotes**

Verify the result with an automated test, not by eye: there is already a precedent in
`check-playlist.mjs` for standalone Node scripts. Cover at least the two cases above.

---

## Task 4: security, done for real

It must be stated clearly and written in the README: **a PIN inside a public HTML file is not
protection.** Anyone who opens the source reads it in five seconds. The repo is private, but the
site is not: that is what matters.

The PIN stays, but its role changes: it becomes the lock screen that keeps a passenger
from ending up inside by tapping the car's screen. The real barrier goes in front of it.

**Since the deploy is on FTP, the right solution is HTTP Basic Auth via `.htaccess`.**

- generate `.htaccess` and `.htpasswd` (bcrypt, not crypt)
- keep `.htpasswd` outside the document root if the hosting allows it, otherwise inside it but with
  access denied via `<Files>`
- the password file does not go into git: add it to `.gitignore` and instead provide a small
  command that generates it from the variables in `.env`
- first verify that the hosting is Apache with `AllowOverride` enabled. If it is nginx, the file
  has no effect and that must be stated instead of leaving it there to give false security
- force https and add `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: no-referrer`
- add `robots.txt` with `Disallow: /`, in addition to the `noindex` meta tag already present

**Two more things to fix:**

- In `worker.js` the `ALLOW_ORIGIN` constant is set to `*`. It must be set to the site's real
  domain, otherwise anyone who finds the worker's address gets a free open proxy at the
  owner's expense. Take the value from `SITE_URL`.
- If the domain moves to Cloudflare in the future, the better protection becomes Cloudflare
  Access with a policy on email addresses: free up to 50 users, session as long as you like, no
  password in the repo. Note it in the README as an upgrade path, do not do it now.

---

## How I want the work done

Proceed in this order: `.gitignore` and repo, then the PIN bug, then security, then deploy.
Make a separate, readable commit for each task.

Before declaring it done: open `app.html` in a real browser, sign in with the PIN, load a list from the
sources screen, open a channel, zap forward and back, close it. If any of these things does not work, the
work is not done.

Stop and ask before: changing the playback engine, adding runtime dependencies,
touching the palette or the interface structure, running a real deploy.
