# PHP login gate + English translation: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Apache Basic Auth barrier from `2026-08-11-pin-security-logos.md` (Task 3) with a CATODO styled login verified server side by PHP, then translate the whole project to English, then finish the remaining tasks from the original plan (logo.dev, README disclaimer, final verification) written directly in English.

**Architecture:** `app.html` (renamed from `index.html`) stays the real player, unchanged in logic, blocked from direct HTTP access by `.htaccess`. `index.php` is the only entry point: it shows a login form styled like CATODO's existing gate, verifies the submission against the same bcrypt `.htpasswd` file `gen-htpasswd.mjs` already writes, opens a PHP session on success, then streams `app.html`'s bytes itself (a plain filesystem read, not an HTTP request, so Apache's block on `app.html` never applies to it). No other backend logic is added.

**Tech Stack:** PHP 8 (`password_verify`, `session_start`, no framework), same Apache/`.htaccess` as before, same bcrypt `.htpasswd` format from `gen-htpasswd.mjs`.

## Global Constraints

- Carries forward every constraint from `2026-08-11-pin-security-logos.md`'s Global Constraints section: ES2016 client JS, no runtime dependency beyond hls.js, no redistribution, `.env`/`.htpasswd` never in git, one commit per task.
- New for this plan: **the whole project's human facing text moves to English** — UI strings, comments, `README.md`, `BRIEF.md`. Internal identifiers were checked and are already English (function names, HTML ids, CSS classes, `CFG` keys), so no renames are needed there; do not rename working ids/classes/keys as part of translation, only translate what a reader sees (strings, comments, prose, and `CFG.label`/`CFG.directory` values, which are user facing text stored as data).
- The "never long or medium dashes in written text" rule from the original brief applies in English too (the brief states it applies to "qualunque testo scritto", not tied to Italian): use commas, parentheses, colons, or short hyphens instead of em or en dashes, in UI text, comments, README, and commit messages.
- `app.html` must never be reachable by a direct HTTP request once `.htaccess` is updated; only `index.php` may read it (a plain filesystem read from PHP, not routed through Apache's URL handling, so the `<Files>` block does not affect it).
- The PHP session cookie must be `secure`, `httponly`, and scoped to `path=/`.

---

## Task 4 (revised): PHP login gate

**Files:**
- Rename: `index.html` -> `app.html` (content unchanged except the one line noted below)
- Modify: `app.html` (drop the `<title>` favicon/meta duplication is fine to leave, only remove nothing else; no functional change)
- Modify: `test-pin.mjs:12` (HTML_PATH must point to `app.html`)
- Modify: `.htaccess` (drop Basic Auth, add file blocking + DirectoryIndex)
- Create: `index.php`

**Interfaces:**
- Consumes: `.htpasswd` written by `gen-htpasswd.mjs` (Task 3, unchanged), format `user:$2y$...`.
- Produces: visiting `/` with no valid session shows the login form; POST with correct credentials sets `$_SESSION['authed'] = true` and streams `app.html`; `app.html` and `.htpasswd` return `403` on direct request once deployed (Apache only, cannot be verified with PHP's built in server, verified live in Task 5).

- [ ] **Step 1: Rename index.html to app.html**

```bash
cd /Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/catodo
git mv index.html app.html
```

- [ ] **Step 2: Point test-pin.mjs at app.html**

In `test-pin.mjs`, line 12:

```js
const HTML_PATH = new URL("./index.html", import.meta.url);
```

becomes:

```js
const HTML_PATH = new URL("./app.html", import.meta.url);
```

- [ ] **Step 3: Run the PIN test to confirm the rename did not break anything**

```bash
npm run test:pin
```

Expected: still 10/10 PASS, exit code 0 (nothing about the gate logic changed, only the filename).

- [ ] **Step 4: Rewrite .htaccess**

Replace the entire content of `.htaccess` with:

```apache
# CATODO: real barrier in front of the site. index.php is the only entry
# point: it shows a styled login, verifies it in PHP, then streams
# app.html itself. app.html and .htpasswd are blocked from direct
# requests below, so the only way to reach the player is through the
# login.

DirectoryIndex index.php

<Files "app.html">
  Require all denied
</Files>

<Files ".htpasswd">
  Require all denied
</Files>

<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteCond %{HTTPS} off
  RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
</IfModule>

<IfModule mod_headers.c>
  Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
  Header always set X-Content-Type-Options "nosniff"
  Header always set Referrer-Policy "no-referrer"
</IfModule>
```

- [ ] **Step 5: Write index.php**

Create `/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/catodo/index.php`:

```php
<?php
/**
 * CATODO: login gate
 *
 * Shows a CATODO styled login form and verifies the submitted username
 * and password against .htpasswd (the same bcrypt file gen-htpasswd.mjs
 * writes). On success it opens a PHP session and streams app.html, the
 * real player, which stays blocked from direct requests by .htaccess.
 * app.html's bytes only ever leave through this file.
 */

session_set_cookie_params([
    'lifetime' => 60 * 60 * 24 * 30,
    'path' => '/',
    'secure' => true,
    'httponly' => true,
    'samesite' => 'Lax',
]);
session_start();

$maxAttempts = 5;
$lockSeconds = 30;
$error = '';

if (!isset($_SESSION['fails'])) $_SESSION['fails'] = 0;
if (!isset($_SESSION['lockUntil'])) $_SESSION['lockUntil'] = 0;

if (empty($_SESSION['authed']) && $_SERVER['REQUEST_METHOD'] === 'POST') {
    if (time() < $_SESSION['lockUntil']) {
        $error = 'Too many attempts. Wait a moment and try again.';
    } else {
        $submittedUser = (string)($_POST['user'] ?? '');
        $submittedPass = (string)($_POST['pass'] ?? '');
        $line = trim((string)@file_get_contents(__DIR__ . '/.htpasswd'));
        $parts = explode(':', $line, 2);
        $storedUser = $parts[0] ?? '';
        $storedHash = $parts[1] ?? '';

        $userOk = $storedUser !== '' && hash_equals($storedUser, $submittedUser);
        $passOk = $storedHash !== '' && password_verify($submittedPass, $storedHash);

        if ($userOk && $passOk) {
            session_regenerate_id(true);
            $_SESSION['authed'] = true;
            $_SESSION['fails'] = 0;
        } else {
            $_SESSION['fails']++;
            if ($_SESSION['fails'] >= $maxAttempts) {
                $_SESSION['lockUntil'] = time() + $lockSeconds;
                $_SESSION['fails'] = 0;
            }
            usleep(400000);
            $error = 'Wrong username or password.';
        }
    }
}

if (!empty($_SESSION['authed'])) {
    $app = @file_get_contents(__DIR__ . '/app.html');
    if ($app === false) {
        http_response_code(500);
        echo 'app.html not found.';
        exit;
    }
    echo $app;
    exit;
}
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow, noarchive, nosnippet">
<meta name="referrer" content="no-referrer">
<meta name="theme-color" content="#0C0D0B">
<title>CATODO</title>
<style>
:root{
  --ebu-white:#BFBFBF; --ebu-yellow:#BFBF00; --ebu-cyan:#00BFBF; --ebu-green:#00BF00;
  --ebu-magenta:#BF00BF; --ebu-red:#BF0000; --ebu-blue:#1D1DBF;
  --c-red:#E05545; --c-amber:#FFB03A;
  --glass:#0C0D0B; --cabinet:#191714; --line:#332E27; --dim:#8A8175; --ink:#F0EBE1;
  --mono: ui-monospace, "SF Mono", "Roboto Mono", "DejaVu Sans Mono", Menlo, Consolas, monospace;
  --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "DejaVu Sans", Arial, sans-serif;
  --tap:72px; --r:2px;
}
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
html,body{height:100%;overflow:hidden}
body{background:var(--glass);color:var(--ink);font-family:var(--sans);font-size:16px;line-height:1.35;
  -webkit-font-smoothing:antialiased;display:flex;align-items:center;justify-content:center}
button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}
input{font:inherit;color:inherit}
.fringe{text-shadow:1.2px 0 0 rgba(224,85,69,.75), -1.2px 0 0 rgba(63,214,214,.7)}
.barStrip{display:flex;gap:2px;width:126px;height:11px;margin:0 auto 17px}
.barStrip i{flex:1}
.barStrip i:nth-child(1){background:var(--ebu-white)}
.barStrip i:nth-child(2){background:var(--ebu-yellow)}
.barStrip i:nth-child(3){background:var(--ebu-cyan)}
.barStrip i:nth-child(4){background:var(--ebu-green)}
.barStrip i:nth-child(5){background:var(--ebu-magenta)}
.barStrip i:nth-child(6){background:var(--ebu-red)}
.barStrip i:nth-child(7){background:var(--ebu-blue)}
#gate{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;padding:20px;max-width:360px}
h1{font-size:15px;font-weight:800;letter-spacing:.46em;text-indent:.46em;text-align:center}
.sub{font-size:10.5px;letter-spacing:.24em;color:var(--dim);margin-top:10px;text-align:center}
.sub.bad{color:var(--c-red);letter-spacing:.1em;max-width:360px;line-height:1.6}
form{display:flex;flex-direction:column;gap:12px;width:100%}
input[type=text],input[type=password]{height:var(--tap);border:1px solid var(--line);border-radius:var(--r);
  background:var(--cabinet);font-family:var(--mono);font-size:18px;padding:0 16px;width:100%}
input[type=text]:focus,input[type=password]:focus{outline:2px solid var(--c-amber)}
button[type=submit]{height:var(--tap);border:1px solid var(--line);border-radius:var(--r);background:var(--cabinet);
  font-family:var(--mono);font-size:15px;letter-spacing:.1em;transition:background .07s,color .07s,border-color .07s}
button[type=submit]:active{background:var(--c-amber);border-color:var(--c-amber);color:#000}
#note{font-size:11px;color:var(--dim);max-width:340px;text-align:center;line-height:1.6}
</style>
</head>
<body>
<div id="gate">
  <div>
    <div class="barStrip"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
    <h1 class="fringe">CATODO</h1>
    <div class="sub<?= $error !== '' ? ' bad' : '' ?>"><?= $error !== '' ? htmlspecialchars($error, ENT_QUOTES, 'UTF-8') : 'SIGN IN' ?></div>
  </div>
  <form method="post" autocomplete="off">
    <input type="text" name="user" placeholder="USERNAME" autocomplete="off" autocapitalize="off" spellcheck="false" required>
    <input type="password" name="pass" placeholder="PASSWORD" autocomplete="off" required>
    <button type="submit">ENTER</button>
  </form>
  <div id="note">This login keeps out anyone who does not know the password. It runs before the page is sent, unlike the in app PIN.</div>
</div>
</body>
</html>
```

- [ ] **Step 6: Test the gate locally with PHP's built in server**

Create a throwaway test fixture (do not commit this): a `.htpasswd` with a known test user for local testing only. Do this in a scratch copy, not the real project directory, since the real `.htpasswd` (if present from Task 4 of the previous plan) holds real credentials.

```bash
SCRATCH=/private/tmp/claude-501/-Users-enuzzo-Library-CloudStorage-Dropbox-Mitnick-catodo/56153107-1b04-42e2-aa14-4f8c6f9ae44b/scratchpad/php-gate-check
mkdir -p "$SCRATCH"
cp /Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/catodo/index.php "$SCRATCH/"
echo '<html><body>REAL APP CONTENT MARKER</body></html>' > "$SCRATCH/app.html"
node -e '
const bcrypt = require("/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/catodo/node_modules/bcryptjs");
const hash = bcrypt.hashSync("testpass123", 10).replace(/^\$2[aby]\$/, "$2y$");
require("fs").writeFileSync(process.env.SCRATCH + "/.htpasswd", "testuser:" + hash + "\n");
' SCRATCH="$SCRATCH"

cd "$SCRATCH"
php -S localhost:8899 >/tmp/php-gate-check.log 2>&1 &
PHP_PID=$!
sleep 1

echo "--- unauthenticated GET ---"
curl -s -c cookies.txt http://localhost:8899/ | grep -o "SIGN IN" && echo "shows login form: OK"
curl -s -b cookies.txt http://localhost:8899/ | grep -q "REAL APP CONTENT MARKER" && echo "FAIL: leaked app content without auth" || echo "did not leak app content: OK"

echo "--- wrong password ---"
curl -s -c cookies.txt -b cookies.txt -d "user=testuser&pass=wrongpass" http://localhost:8899/ | grep -o "Wrong username or password" && echo "rejects wrong password: OK"

echo "--- correct password ---"
curl -s -c cookies.txt -b cookies.txt -d "user=testuser&pass=testpass123" http://localhost:8899/ | grep -q "REAL APP CONTENT MARKER" && echo "serves app content on correct login: OK"

echo "--- reuse session, no credentials needed again ---"
curl -s -b cookies.txt http://localhost:8899/ | grep -q "REAL APP CONTENT MARKER" && echo "session persists: OK"

echo "--- lockout after 5 wrong attempts ---"
rm -f cookies2.txt
for i in 1 2 3 4 5; do curl -s -c cookies2.txt -b cookies2.txt -d "user=testuser&pass=nope" http://localhost:8899/ >/dev/null; done
curl -s -b cookies2.txt -c cookies2.txt -d "user=testuser&pass=testpass123" http://localhost:8899/ | grep -o "Too many attempts" && echo "lockout engages: OK"

kill $PHP_PID
rm -rf "$SCRATCH"
```

Expected: every line prints its "OK" confirmation; the "FAIL" line must NOT print. If the "FAIL: leaked app content without auth" line prints, STOP, this is a Critical security defect, do not proceed to commit.

Note: this local test cannot verify that Apache blocks direct requests to `app.html` and `.htpasswd` (PHP's built in server ignores `.htaccess` entirely). That is verified live in Task 5.

- [ ] **Step 7: Commit**

```bash
git add app.html index.php .htaccess test-pin.mjs
git commit -m "$(cat <<'EOF'
feat: PHP login gate replaces Apache Basic Auth

index.php shows a login styled like the rest of CATODO instead of the
browser's native Basic Auth prompt, and verifies it server side with
password_verify against the same bcrypt .htpasswd Basic Auth already
used. app.html (the real player, renamed from index.html) is blocked
from direct requests: only index.php can read it, after a valid
session. Lockout after 5 wrong attempts in 30 seconds.
EOF
)"
```

---

## Task 4b (new): harden the gate against cookie-clearing brute force and short-lived sessions

Task 4's review (Approved) found two Important, plan-mandated gaps: the 5-attempt lockout lives in `$_SESSION`, so clearing cookies resets it to zero (no real protection against automated guessing), and the 30-day cookie's server-side session data is garbage-collected by PHP after roughly 24 minutes of inactivity on most hosts (default `session.gc_maxlifetime`), so the login does not actually last 30 days. The human confirmed both should be fixed before continuing.

**Files:**
- Modify: `index.php` (replace session-based auth and lockout entirely)
- Modify: `.htaccess` (block all dotfiles with one rule instead of listing them one by one)
- Modify: `.gitignore` (add the new attempts file)

**Interfaces:**
- Produces: no more `$_SESSION` usage. Auth state is a signed cookie (`catodo_auth`) verified against the current `.htpasswd` contents (`hash_hmac('sha256', ...)` keyed by the bcrypt hash itself, so rotating the password invalidates every existing cookie). Failed attempts are tracked per IP address in `.gate-attempts.json` (gitignored, blocked from direct HTTP access), locked for 5 minutes after 5 failures from the same IP, independent of any cookie.

- [ ] **Step 1: Replace index.php**

Replace the entire content of `index.php` with:

```php
<?php
/**
 * CATODO: login gate
 *
 * Shows a CATODO styled login form and verifies the submitted username
 * and password against .htpasswd (the same bcrypt file gen-htpasswd.mjs
 * writes). On success it sets a signed cookie, not a PHP session, so it
 * keeps working regardless of the host's session garbage collection, and
 * streams app.html, the real player, which stays blocked from direct
 * requests by .htaccess. app.html's bytes only ever leave through this
 * file. Failed attempts are throttled per IP address in a local file, so
 * clearing cookies does not reset the lockout.
 */

const COOKIE_NAME = 'catodo_auth';
const COOKIE_DAYS = 30;
const MAX_ATTEMPTS = 5;
const LOCK_SECONDS = 300;
const ATTEMPTS_FILE = __DIR__ . '/.gate-attempts.json';

function readHtpasswd(){
    $line = trim((string)@file_get_contents(__DIR__ . '/.htpasswd'));
    $parts = explode(':', $line, 2);
    return [$parts[0] ?? '', $parts[1] ?? ''];
}

function signToken($expires, $storedUser, $storedHash){
    return hash_hmac('sha256', $expires . ':' . $storedUser, $storedHash);
}

function validCookie($cookieValue, $storedUser, $storedHash){
    if ($storedHash === '' || $cookieValue === null) return false;
    $parts = explode('.', $cookieValue, 2);
    if (count($parts) !== 2) return false;
    [$expires, $sig] = $parts;
    if (!ctype_digit($expires) || (int)$expires < time()) return false;
    $expected = signToken($expires, $storedUser, $storedHash);
    return hash_equals($expected, $sig);
}

function clientIp(){
    return $_SERVER['REMOTE_ADDR'] ?? 'unknown';
}

/** Reads, mutates, and writes .gate-attempts.json under one exclusive lock. */
function withAttempts(callable $mutator){
    $fp = fopen(ATTEMPTS_FILE, 'c+');
    if ($fp === false) return $mutator([]);
    flock($fp, LOCK_EX);
    rewind($fp);
    $raw = stream_get_contents($fp);
    $data = json_decode((string)$raw, true);
    if (!is_array($data)) $data = [];

    $result = $mutator($data);

    rewind($fp);
    ftruncate($fp, 0);
    fwrite($fp, json_encode($result['data']));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);

    return $result;
}

[$storedUser, $storedHash] = readHtpasswd();
$authed = validCookie($_COOKIE[COOKIE_NAME] ?? null, $storedUser, $storedHash);
$error = '';

if (!$authed && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $ip = clientIp();
    $submittedUser = (string)($_POST['user'] ?? '');
    $submittedPass = (string)($_POST['pass'] ?? '');

    $outcome = withAttempts(function($data) use ($ip, $storedUser, $storedHash, $submittedUser, $submittedPass) {
        $record = $data[$ip] ?? ['fails' => 0, 'lockUntil' => 0];

        if (time() < $record['lockUntil']) {
            return ['data' => $data, 'status' => 'locked'];
        }

        $userOk = $storedUser !== '' && hash_equals($storedUser, $submittedUser);
        $passOk = $storedHash !== '' && password_verify($submittedPass, $storedHash);

        if ($userOk && $passOk) {
            unset($data[$ip]);
            return ['data' => $data, 'status' => 'ok'];
        }

        $record['fails']++;
        if ($record['fails'] >= MAX_ATTEMPTS) {
            $record['lockUntil'] = time() + LOCK_SECONDS;
            $record['fails'] = 0;
        }
        $data[$ip] = $record;
        return ['data' => $data, 'status' => 'fail'];
    });

    if ($outcome['status'] === 'locked') {
        $error = 'Too many attempts. Wait a few minutes and try again.';
    } elseif ($outcome['status'] === 'ok') {
        $expires = time() + 60 * 60 * 24 * COOKIE_DAYS;
        $token = $expires . '.' . signToken((string)$expires, $storedUser, $storedHash);
        setcookie(COOKIE_NAME, $token, [
            'expires' => $expires,
            'path' => '/',
            'secure' => true,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        $authed = true;
    } else {
        usleep(400000);
        $error = 'Wrong username or password.';
    }
}

if ($authed) {
    $app = @file_get_contents(__DIR__ . '/app.html');
    if ($app === false) {
        http_response_code(500);
        echo 'app.html not found.';
        exit;
    }
    echo $app;
    exit;
}
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow, noarchive, nosnippet">
<meta name="referrer" content="no-referrer">
<meta name="theme-color" content="#0C0D0B">
<title>CATODO</title>
<style>
:root{
  --ebu-white:#BFBFBF; --ebu-yellow:#BFBF00; --ebu-cyan:#00BFBF; --ebu-green:#00BF00;
  --ebu-magenta:#BF00BF; --ebu-red:#BF0000; --ebu-blue:#1D1DBF;
  --c-red:#E05545; --c-amber:#FFB03A;
  --glass:#0C0D0B; --cabinet:#191714; --line:#332E27; --dim:#8A8175; --ink:#F0EBE1;
  --mono: ui-monospace, "SF Mono", "Roboto Mono", "DejaVu Sans Mono", Menlo, Consolas, monospace;
  --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "DejaVu Sans", Arial, sans-serif;
  --tap:72px; --r:2px;
}
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
html,body{height:100%;overflow:hidden}
body{background:var(--glass);color:var(--ink);font-family:var(--sans);font-size:16px;line-height:1.35;
  -webkit-font-smoothing:antialiased;display:flex;align-items:center;justify-content:center}
button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}
input{font:inherit;color:inherit}
.fringe{text-shadow:1.2px 0 0 rgba(224,85,69,.75), -1.2px 0 0 rgba(63,214,214,.7)}
.barStrip{display:flex;gap:2px;width:126px;height:11px;margin:0 auto 17px}
.barStrip i{flex:1}
.barStrip i:nth-child(1){background:var(--ebu-white)}
.barStrip i:nth-child(2){background:var(--ebu-yellow)}
.barStrip i:nth-child(3){background:var(--ebu-cyan)}
.barStrip i:nth-child(4){background:var(--ebu-green)}
.barStrip i:nth-child(5){background:var(--ebu-magenta)}
.barStrip i:nth-child(6){background:var(--ebu-red)}
.barStrip i:nth-child(7){background:var(--ebu-blue)}
#gate{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;padding:20px;max-width:360px}
h1{font-size:15px;font-weight:800;letter-spacing:.46em;text-indent:.46em;text-align:center}
.sub{font-size:10.5px;letter-spacing:.24em;color:var(--dim);margin-top:10px;text-align:center}
.sub.bad{color:var(--c-red);letter-spacing:.1em;max-width:360px;line-height:1.6}
form{display:flex;flex-direction:column;gap:12px;width:100%}
input[type=text],input[type=password]{height:var(--tap);border:1px solid var(--line);border-radius:var(--r);
  background:var(--cabinet);font-family:var(--mono);font-size:18px;padding:0 16px;width:100%}
input[type=text]:focus,input[type=password]:focus{outline:2px solid var(--c-amber)}
button[type=submit]{height:var(--tap);border:1px solid var(--line);border-radius:var(--r);background:var(--cabinet);
  font-family:var(--mono);font-size:15px;letter-spacing:.1em;transition:background .07s,color .07s,border-color .07s}
button[type=submit]:active{background:var(--c-amber);border-color:var(--c-amber);color:#000}
#note{font-size:11px;color:var(--dim);max-width:340px;text-align:center;line-height:1.6}
</style>
</head>
<body>
<div id="gate">
  <div>
    <div class="barStrip"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
    <h1 class="fringe">CATODO</h1>
    <div class="sub<?= $error !== '' ? ' bad' : '' ?>"><?= $error !== '' ? htmlspecialchars($error, ENT_QUOTES, 'UTF-8') : 'SIGN IN' ?></div>
  </div>
  <form method="post" autocomplete="off">
    <input type="text" name="user" placeholder="USERNAME" autocomplete="off" autocapitalize="off" spellcheck="false" required>
    <input type="password" name="pass" placeholder="PASSWORD" autocomplete="off" required>
    <button type="submit">ENTER</button>
  </form>
  <div id="note">This login keeps out anyone who does not know the password. It runs before the page is sent, unlike the in app PIN.</div>
</div>
</body>
</html>
```

- [ ] **Step 2: Harden .htaccess to block all dotfiles at once**

Replace the two separate `<Files "app.html">` / `<Files ".htpasswd">` blocks (keep `app.html` separate, it has no leading dot) with a single `<FilesMatch>` covering every current and future dotfile:

```apache
DirectoryIndex index.php

<Files "app.html">
  Require all denied
</Files>

<FilesMatch "^\.">
  Require all denied
</FilesMatch>

<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteCond %{HTTPS} off
  RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
</IfModule>

<IfModule mod_headers.c>
  Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
  Header always set X-Content-Type-Options "nosniff"
  Header always set Referrer-Policy "no-referrer"
</IfModule>
```

- [ ] **Step 3: Add the attempts file to .gitignore**

Add a line to `.gitignore`:

```
.gate-attempts.json
```

- [ ] **Step 4: Verify locally with an extended script**

Same scratch-directory approach as Task 4 Step 6 (throwaway `.htpasswd` with `testuser`/`testpass123`, PHP built in server on `localhost:8899`, real `app.html` replaced with a one line marker file), with these checks:

1. Unauthenticated GET: shows `SIGN IN`, response does not contain the app marker.
2. Wrong password once: response contains `Wrong username or password`.
3. Correct password: response contains the app marker, and the `Set-Cookie` header for `catodo_auth` has `Secure`, `HttpOnly`, and an `expires`/`Max-Age` roughly 30 days out (print the raw `Set-Cookie` header and check it yourself, do not assume).
4. Fresh request reusing only the cookie (no form fields) on a plain `GET`: still shows the app marker (this is the persistence check).
5. A cookie with the signature byte-flipped (change one character in the token after the `.`): rejected, shows the login form again.
6. Lockout: from a NEW, empty cookie jar (simulating a cleared browser), POST 5 wrong passwords in a row, then a 6th attempt with the CORRECT password: must still show `Too many attempts`, proving the lockout survives clearing cookies (this is the fix's core acceptance test). Wait roughly the `LOCK_SECONDS` is 300 in real code but do not actually sleep 5 minutes in the test: temporarily point `ATTEMPTS_FILE`'s lock window low enough to observe deterministically instead by checking the JSON file's `lockUntil` value directly with `cat .gate-attempts.json` right after the 5th failure, and confirm it is roughly `now + 300`, rather than sleeping out the real lockout.
7. Inspect `.gate-attempts.json` directly after the test run: confirms it exists, is valid JSON, and is not readable through the PHP built in server at `/.gate-attempts.json` (note: like Task 4, PHP's built in server ignores `.htaccess`, so this specific HTTP-level check is only meaningful live in Task 5; here just confirm the file's contents are sane).

Clean up the scratch directory afterward.

- [ ] **Step 5: Run npm run test:pin to confirm nothing in app.html or the Node tooling was touched**

Expected: 10/10 PASS (this task does not touch `app.html` or `test-pin.mjs`).

- [ ] **Step 6: Commit**

```bash
git add index.php .htaccess .gitignore
git commit -m "$(cat <<'EOF'
fix: gate lockout survives cleared cookies, login lasts 30 days

Failed login attempts are now tracked per IP address in a local file
instead of the PHP session, so an attacker cannot reset the lockout by
dropping cookies. The authenticated cookie is signed with HMAC keyed
by the current bcrypt hash instead of relying on a PHP session, so it
actually lasts the stated 30 days instead of expiring with the host's
session garbage collection. Rotating the password invalidates every
existing cookie, since the hash is part of the signature.
EOF
)"
```

---

## Task 5 (new): live verification of the PHP gate on FTP

**Files:** none in the repo (upload and network verification only).

**Interfaces:**
- Consumes: `app.html`, `index.php`, `.htaccess`, `.gitignore` from Task 4 and Task 4b; `.htpasswd` already generated in the previous plan's Task 4 (or regenerate with `node gen-htpasswd.mjs` if it does not exist locally); `HTPASSWD_USER`/`HTPASSWD_PASSWORD` from `.env`. The cookie the gate sets is named `catodo_auth` (not a PHP session cookie).

- [ ] **Step 1: Confirm .htpasswd exists locally, regenerate if needed**

```bash
node gen-htpasswd.mjs
```

- [ ] **Step 2: Upload app.html, index.php, .htaccess, .htpasswd, robots.txt to the FTP root**

Write and run a scratch Node script (same pattern used earlier in this session: read FTP credentials from `.env`, never print them) that uploads these five files with `basic-ftp`, replacing whatever `index.html` used to be live (delete the old `index.html` from the FTP root if it still exists there, since the new entry point is `index.php`). Do not upload `.gate-attempts.json`, it is runtime state the live gate creates on its own.

- [ ] **Step 3: Verify the gate live**

Write and run a scratch Node script that reads `SITE_URL`, `HTPASSWD_USER`, `HTPASSWD_PASSWORD` from `.env` (never printing them) and checks, using `fetch` with a cookie jar kept in memory between calls:
1. `GET SITE_URL` with no cookies: response contains `SIGN IN`, does not contain any marker unique to `app.html` (e.g. `id="gate"` from the player's own gate, or `CFG`).
2. `POST SITE_URL` with wrong credentials: response contains `Wrong username or password`.
3. `POST SITE_URL` with correct credentials, keeping the `Set-Cookie` (`catodo_auth=...`) from the response: response contains a marker unique to `app.html` (e.g. `CATODO` player specific text, or the string `buildGate`). Print the raw `Set-Cookie` header and confirm it has `Secure`, `HttpOnly`, and an expiry roughly 30 days out.
4. `GET SITE_URL` again reusing only the `catodo_auth` cookie: same authenticated content, no login form.
5. `GET SITE_URL + "/app.html"` directly: status `403`.
6. `GET SITE_URL + "/.htpasswd"` directly: status `403`.
7. `GET SITE_URL + "/.gate-attempts.json"` directly: status `403` (this file only exists after step 2 or 5 below have caused at least one POST; if it does not exist yet, POST one deliberately wrong login first so the file gets created, then check it is still blocked).
8. Lockout survives a fresh cookie jar: with a brand new, empty cookie jar, POST 5 wrong passwords in a row, then a 6th attempt with the CORRECT password: must still show `Too many attempts`. This is the live confirmation of Task 4b's fix.

Expected: all eight checks pass. If step 5, 6, or 7 does not return `403`, apply the same `AllowOverride` diagnosis used in the previous plan's Task 4 Step 5 (PHP probe for `DOCUMENT_ROOT`; this gate's blocking needs the same `AllowOverride` support, so if it was confirmed working earlier in this session it should still work here unless the account structure changed).

- [ ] **Step 4: Report to the user**

Summarize all eight results. No commit in this task, nothing in the repo changes.

---

## Task 6 (new): translate the whole project to English

**Files:**
- Modify: `app.html` (all user visible strings, all comments; `CFG.label` values, `CFG.directory` `what`/`name` text; keep every id, class, function name, variable name, and `CFG` key exactly as is, they are already English)
- Modify: `README.md` (full translation)
- Modify: `BRIEF.md` (full translation)
- Modify: `worker.js` (comments only, code is already English identifiers)
- Modify: `check-playlist.mjs` (comments and any Italian console output strings)
- Modify: `gen-htpasswd.mjs` (comments)
- Modify: `test-pin.mjs` (comments and the Italian check labels passed to `check(...)`, e.g. `"CFG.pin e impostato a 1984"` becomes an English sentence, same meaning)
- Modify: `.htaccess` (comment)
- Modify: `.env.example` (inline comments on `FTP_SECURE`/`FTP_REMOTE_DIR`/`SITE_URL`)

**Interfaces:**
- Consumes: nothing new. Must not change any id, class, function name, variable name, `CFG` object key, file name, or test assertion logic, only the text.

- [ ] **Step 1: Translate app.html**

Read the full file. Translate every user visible string (gate messages, sources screen, settings panel labels and descriptions, toasts, badges text that is actual language like "Undefined"/"Senza gruppo", OSD text, troubleshooting reasons) and every comment, to natural English with the same meaning. Specifically:
- `CFG.directory[].name` and `.what`: translate `.what` (description prose); `name` values that are proper nouns (e.g. "Free-TV / IPTV", "iptv-org, solo Italia") translate only the descriptive part ("iptv-org, solo Italia" -> "iptv-org, Italy only").
- `CFG.label` values: `"Italia"` -> `"Italy"`, `"Svizzera"` -> `"Switzerland"`, `"Film e serie IT"` -> `"Movies & shows (IT)"`, `"Senza gruppo"` -> `"No group"`, etc. Do not translate `CFG.label` or `CFG.order`'s KEYS (`"Italy"`, `"Switzerland"`, ...): those match the M3U `group-title` values coming from external playlists and must stay exactly as those playlists write them.
- Keep every HTML `id`, every CSS class name, every JS function and variable name unchanged.
- Keep the "no em or en dash" rule in the translated text.

Do not touch `CFG.pin`, `CFG.logoDevToken`, `CFG.logoDomains` if present (later tasks own those), or any line of executable logic.

- [ ] **Step 2: Translate README.md and BRIEF.md**

Full translation to English, same structure (headings, code blocks, tables), same meaning. Update any remaining reference to `index.html` as the entry point to describe the actual current setup (`index.php` gate, `app.html` player) instead. Keep the "no em or en dash" rule.

- [ ] **Step 3: Translate comments in worker.js, check-playlist.mjs, gen-htpasswd.mjs, test-pin.mjs, .htaccess, .env.example**

Comments and any Italian strings printed to the console or shown to the user, translated to English. Do not change any logic, regex, variable name, or the exact bcrypt/env parsing behavior.

For `test-pin.mjs` specifically: the strings passed to `check("...", cond)` are translated (e.g. `"CFG.pin e impostato a 1984"` -> `"CFG.pin is set to 1984"`), but the assertions themselves (the `cond` expressions) do not change.

- [ ] **Step 4: Run the automated test to confirm nothing broke**

```bash
npm run test:pin
```

Expected: 10/10 PASS, exit code 0. Translating `check()` labels must not change which assertions run.

- [ ] **Step 5: Grep for leftover Italian**

```bash
grep -rniE "[àèéìòù]|perche|gia |cosi |puo |all |sull |dell |nell |funziona|schermata|impostazioni" app.html README.md BRIEF.md worker.js check-playlist.mjs gen-htpasswd.mjs test-pin.mjs .htaccess .env.example index.php
```

Expected: no matches (or only false positive matches you can justify in the report, e.g. a URL or a proper noun). Fix any real leftover Italian before committing.

- [ ] **Step 6: Commit**

```bash
git add app.html README.md BRIEF.md worker.js check-playlist.mjs gen-htpasswd.mjs test-pin.mjs .htaccess .env.example
git commit -m "$(cat <<'EOF'
i18n: translate the project to English

User facing text, comments, README and BRIEF move to English. No id,
class, function name, variable name, or CFG key changed: they were
already English. CFG.label values and CFG.directory descriptions are
translated since they are user facing data, not identifiers.
EOF
)"
```

---

## Task 7: logo.dev channel logos, in English

Same as Task 5 in `2026-08-11-pin-security-logos.md`, with two differences: the file to edit is now `app.html` (not `index.html`), and every new comment is written directly in English. The code and behavior are otherwise identical:

**Files:**
- Modify: `app.html` (CFG block: add `logoDevToken` and `logoDomains`; add `normalizeChannelName`/`logoDevUrl` helpers before `makeTile`; update the logo fallback inside `makeTile`)

Use the exact CFG and function code from `2026-08-11-pin-security-logos.md` Task 5 Steps 1 to 3, with comments translated to English:

```js
  /* Publishable logo.dev token, safe to expose client side: that is how
     logo.dev designs it (a "publishable" key, not a secret). Sign up
     for free at https://logo.dev and paste your token here. */
  logoDevToken: "",

  /* Text only: normalized channel name (lowercase, no spaces or symbols,
     no HD/4K/+1) -> the broadcaster's official domain. The logo image is
     always served live by logo.dev from that domain, never a file of
     ours: CATODO does not host or store logo images. Deliberately
     partial list, a starting point for the main Italian and Swiss
     broadcasters, extend it here later. Channels outside this table show
     the initials badge. */
  logoDomains: {
    "rai1": "rai.it", "rai2": "rai.it", "rai3": "rai.it",
    "canale5": "mediaset.it", "italia1": "mediaset.it", "rete4": "mediaset.it",
    "la7": "la7.it",
    "nove": "nove.tv",
    "realtime": "realtime.it",
    "dmax": "dmax.it",
    "foodnetwork": "foodnetwork.it",
    "srf1": "srf.ch", "srf2": "srf.ch",
    "rsila1": "rsi.ch", "rsila2": "rsi.ch",
    "rts1": "rts.ch", "rts2": "rts.ch"
  }
```

```js
function normalizeChannelName(name){
  return String(name || "")
    .toLowerCase()
    .replace(/\b(hd|fhd|uhd|sd|4k|8k)\b/g, "")
    .replace(/\+\d+/g, "")
    .replace(/[^a-z0-9]+/g, "");
}
function logoDevUrl(c){
  if (!CFG.logoDevToken) return "";
  const domain = CFG.logoDomains[normalizeChannelName(c.name)];
  return domain ? "https://img.logo.dev/" + domain + "?token=" + CFG.logoDevToken : "";
}
```

```js
  const logo = b.querySelector(".logo");
  const logoSrc = c.logo || logoDevUrl(c);
  if (logoSrc){
    const img = document.createElement("img");
    img.loading = "lazy"; img.referrerPolicy = "no-referrer"; img.alt = "";
    img.src = logoSrc;
    img.onerror = () => { logo.innerHTML = '<span class="fallback">' + initials(c.name) + '</span>'; };
    logo.appendChild(img);
  } else logo.innerHTML = '<span class="fallback">' + initials(c.name) + '</span>';
```

- [ ] **Step 1: Locate CFG, renderGrid/makeTile boundary, and the logo block in app.html** (line numbers will differ from the old plan after the rename and translation, find them by content, not by the old line numbers)

- [ ] **Step 2: Apply the three edits above**

- [ ] **Step 3: Verify the pure functions with the isolated check**

```bash
node --input-type=module -e '
const CFG = { logoDevToken: "tok_test", logoDomains: { "rai1": "rai.it", "la7": "la7.it" } };
function normalizeChannelName(name){
  return String(name || "").toLowerCase()
    .replace(/\b(hd|fhd|uhd|sd|4k|8k)\b/g, "")
    .replace(/\+\d+/g, "")
    .replace(/[^a-z0-9]+/g, "");
}
function logoDevUrl(c){
  if (!CFG.logoDevToken) return "";
  const domain = CFG.logoDomains[normalizeChannelName(c.name)];
  return domain ? "https://img.logo.dev/" + domain + "?token=" + CFG.logoDevToken : "";
}
const cases = [
  [normalizeChannelName("RAI 1 HD"), "rai1"],
  [normalizeChannelName("La7"), "la7"],
  [logoDevUrl({name:"RAI 1 HD"}), "https://img.logo.dev/rai.it?token=tok_test"],
  [logoDevUrl({name:"Unknown Channel"}), ""]
];
let fail = 0;
for (const [got, want] of cases){
  const ok = got === want;
  if (!ok) fail++;
  console.log((ok ? "PASS" : "FAIL") + "  " + JSON.stringify(got) + " expected " + JSON.stringify(want));
}
process.exit(fail ? 1 : 0);
'
```

Expected: four `PASS` lines, exit code 0.

- [ ] **Step 4: Run npm run test:pin to confirm the gate still works**

Expected: 10/10 PASS.

Do not commit yet, this accorpates with Task 8.

---

## Task 8: attribution, README disclaimer, commit

Same as Task 6 in `2026-08-11-pin-security-logos.md`, in English, targeting `app.html` and the already translated `README.md`.

**Files:**
- Modify: `app.html` (settings panel: add an attribution row near the other settings rows, after whichever row is the Tesla fullscreen link row)
- Modify: `README.md` (add a short paragraph near the legal/context section)

- [ ] **Step 1: Add the attribution row in the settings panel**

Find the settings panel's last informational row before the footer buttons (in the pre-translation plan this was the "Tesla fullscreen" row) and add, right after it:

```html
    <div class="row" style="display:block">
      <div class="rl"><b>Channel logos</b><span>When the playlist has no logo, some known broadcasters get one fetched from <a href="https://logo.dev" target="_blank" rel="noreferrer">logo.dev</a>. Names and logos remain their respective owners'.</span></div>
    </div>
```

- [ ] **Step 2: Add the README disclaimer**

Add a short paragraph near the end of the legal section (the section discussing legal position), before the final closing paragraph:

```markdown
**On logos.** When the playlist does not provide a channel logo, some known broadcasters show one fetched live from [logo.dev](https://logo.dev): CATODO never saves or hosts those files, the viewer's browser requests them, every time. Channel names and logos remain trademarks of their respective broadcasters; CATODO is not affiliated with them.
```

- [ ] **Step 3: Commit**

```bash
git add app.html README.md
git commit -m "$(cat <<'EOF'
feat: channel logos via logo.dev with a curated domain table

For channels without a tvg-logo in the M3U list, a static table of
normalized channel name to domain tries to fetch a logo from logo.dev
live. No image is ever saved or hosted by CATODO: consistent with the
project not redistributing content. Attribution in settings, disclaimer
in the README.
EOF
)"
```

---

## Task 9: final verification, real browser and live site

- [ ] **Step 1: Ask the user for the logo.dev token**, paste into `CFG.logoDevToken` in `app.html`.

- [ ] **Step 2: Local browser walkthrough**

Open `file:///Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/catodo/app.html` directly (bypassing the PHP gate, which only exists on the live server) with the Browser tool: skip the intro, enter PIN `1984`, load the Free-TV/IPTV list from the sources screen, confirm a channel from `CFG.logoDomains` requests `img.logo.dev`, confirm an unmatched channel shows the initials badge, open a channel, zap forward and back with the paddles, close.

- [ ] **Step 3: Live site walkthrough**

Navigate the Browser tool to `SITE_URL`. Confirm the CATODO styled login appears (not a browser native dialog). Ask the user for the real login username and password if you do not already have them from `.env` (do not print them). Sign in, confirm the player loads, confirm the PIN gate still appears inside the player, confirm the session persists on reload without asking to sign in again.

- [ ] **Step 4: Report to the user**

Summarize what was verified locally and live. State plainly what is still outside this plan: `deploy.mjs` for automated future deploys (original plan's Incarico 2) has not been written; today's deploy was done by hand through scratch scripts.
