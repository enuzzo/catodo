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
