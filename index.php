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

// Sent on every response, the login form included. The form is the page worth
// protecting from framing: it is where the password gets typed.
header('Cache-Control: private, no-store');
header('X-Frame-Options: DENY');

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

/** Drops entries that are neither mid failure streak nor still locked out. */
function pruneAttempts($data){
    foreach ($data as $ip => $record) {
        $fails = $record['fails'] ?? 0;
        $lockUntil = $record['lockUntil'] ?? 0;
        if ($fails === 0 && $lockUntil < time()) {
            unset($data[$ip]);
        }
    }
    return $data;
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
    $submittedUser = is_string($_POST['user'] ?? null) ? $_POST['user'] : '';
    $submittedPass = is_string($_POST['pass'] ?? null) ? $_POST['pass'] : '';

    $outcome = withAttempts(function($data) use ($ip, $storedUser, $storedHash, $submittedUser, $submittedPass) {
        $record = $data[$ip] ?? ['fails' => 0, 'lockUntil' => 0];

        if (time() < ($record['lockUntil'] ?? 0)) {
            return ['data' => pruneAttempts($data), 'status' => 'locked'];
        }

        $userOk = $storedUser !== '' && hash_equals($storedUser, $submittedUser);
        $passOk = $storedHash !== '' && password_verify($submittedPass, $storedHash);

        if ($userOk && $passOk) {
            unset($data[$ip]);
            return ['data' => pruneAttempts($data), 'status' => 'ok'];
        }

        $record['fails']++;
        if ($record['fails'] >= MAX_ATTEMPTS) {
            $record['lockUntil'] = time() + LOCK_SECONDS;
            $record['fails'] = 0;
        }
        $data[$ip] = $record;
        return ['data' => pruneAttempts($data), 'status' => 'fail'];
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
    header('Content-Type: text/html; charset=utf-8');
    echo $app;
    exit;
}

function readAppVersion(): string
{
    $raw = @file_get_contents(__DIR__ . '/version.json');
    if ($raw === false) {
        return '';
    }

    $manifest = json_decode($raw, true);
    $version = is_array($manifest) ? ($manifest['version'] ?? '') : '';
    if (!is_string($version) || preg_match('/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/', $version) !== 1) {
        return '';
    }
    return $version;
}

$appVersion = readAppVersion();
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow, noarchive, nosnippet">
<meta name="referrer" content="no-referrer">
<meta name="theme-color" content="#F2F1EA">
<meta name="application-name" content="CATODO">
<meta name="description" content="Tesla-first world TV explorer for user-approved public IPTV sources. Zero bundled streams, zero DRM bypass, zero pezzotto.">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="CATODO">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<title>CATODO</title>
<link rel="manifest" href="./manifest.webmanifest">
<link rel="icon" type="image/png" sizes="32x32" href="./icons/catodo-netmilk-tv-transparent-32.png">
<link rel="apple-touch-icon" sizes="152x152" href="./icons/apple-touch-icon-netmilk-152.png">
<link rel="apple-touch-icon" sizes="167x167" href="./icons/apple-touch-icon-netmilk-167.png">
<link rel="apple-touch-icon" sizes="180x180" href="./icons/apple-touch-icon-netmilk-180.png">
<style>
:root{
  --ebu-white:#BFBFBF; --ebu-yellow:#BFBF00; --ebu-cyan:#00BFBF; --ebu-green:#00BF00;
  --ebu-magenta:#BF00BF; --ebu-red:#BF0000; --ebu-blue:#1D1DBF;
  --c-red:#E05545; --c-amber:#FFB03A;
  --glass:#F2F1EA; --cabinet:#FFFFFF; --line:#D8D5CA; --dim:#6E6D68; --ink:#0A0B0D;
  --mono: ui-monospace, "SF Mono", "Roboto Mono", "DejaVu Sans Mono", Menlo, Consolas, monospace;
  --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "DejaVu Sans", Arial, sans-serif;
  --tap:84px; --r:2px;
}
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
html,body{height:100%;overflow:hidden}
body{background:var(--glass);color:var(--ink);font-family:var(--sans);font-size:16px;line-height:1.35;
  -webkit-font-smoothing:antialiased;display:flex;align-items:center;justify-content:center}
button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}
input{font:inherit;color:inherit}
input::placeholder{color:var(--dim)}
#gate{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:30px;width:min(92vw,460px);padding:24px}
.login-brand{display:flex;flex-direction:column;align-items:center}
.login-logo{width:210px;height:210px;object-fit:contain;margin-bottom:18px;
  filter:drop-shadow(2px 5px 3px rgba(20,17,13,.24)) drop-shadow(0 13px 10px rgba(20,17,13,.18))}
h1{font-size:60px;font-weight:780;line-height:.94;letter-spacing:-.05em;text-align:center}
.login-version{margin-top:11px;color:var(--dim);font-family:var(--mono);font-size:11px;font-weight:700;letter-spacing:.18em;text-align:center}
.sub{font-size:13px;font-weight:700;letter-spacing:.24em;color:var(--dim);margin-top:12px;text-align:center}
.sub.bad{color:var(--c-red);letter-spacing:.1em;max-width:360px;line-height:1.6}
form{display:flex;flex-direction:column;gap:12px;width:100%}
input[type=text],input[type=password]{height:var(--tap);border:2px solid var(--line);border-radius:16px;
  background:var(--cabinet);font-family:var(--mono);font-size:22px;font-weight:600;padding:0 22px;width:100%}
input[type=text]:focus,input[type=password]:focus{border-color:var(--c-amber)}
button[type=submit]{height:var(--tap);border:2px solid #1457FF;border-radius:16px;background:#1457FF;color:#fff;
  font-family:var(--mono);font-size:18px;font-weight:700;letter-spacing:.1em;transition:background .07s,color .07s,border-color .07s}
button[type=submit]:active{background:var(--c-amber);border-color:var(--c-amber);color:#000}
#note{font-size:11px;color:var(--dim);max-width:340px;text-align:center;line-height:1.6}
@media (max-width:520px){
  :root{--tap:76px}
  #gate{gap:22px;width:min(94vw,420px);padding:16px}
  .login-logo{width:170px;height:170px;margin-bottom:14px}
  h1{font-size:50px}
  input[type=text],input[type=password]{font-size:20px;padding-inline:19px}
}
@media (max-height:720px){
  :root{--tap:70px}
  #gate{gap:16px;padding-block:12px}
  .login-logo{width:142px;height:142px;margin-bottom:10px}
  h1{font-size:46px}
  #note{display:none}
}
</style>
</head>
<body>
<div id="gate">
  <div class="login-brand">
    <img class="login-logo" src="./icons/catodo-netmilk-tv-transparent-512.png" alt="" aria-hidden="true">
    <h1>Catodo</h1>
    <?php if ($appVersion !== ''): ?><div class="login-version">VERSION <?= htmlspecialchars($appVersion, ENT_QUOTES, 'UTF-8') ?></div><?php endif; ?>
    <div class="sub<?= $error !== '' ? ' bad' : '' ?>"><?= $error !== '' ? htmlspecialchars($error, ENT_QUOTES, 'UTF-8') : 'SIGN IN' ?></div>
  </div>
  <form method="post" autocomplete="off">
    <input type="text" name="user" placeholder="USERNAME" autocomplete="off" autocapitalize="off" spellcheck="false" required>
    <input type="password" name="pass" placeholder="PASSWORD" autocomplete="off" required>
    <button type="submit">ENTER</button>
  </form>
  <div id="note">This login runs before the page is ever sent, so nobody who does not know the password can reach it.</div>
</div>
</body>
</html>
