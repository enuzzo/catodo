<?php
declare(strict_types=1);

const COOKIE_NAME = 'catodo_auth';
const CACHE_DIR = __DIR__ . '/.catodo-data/epg';
const MAX_BYTES = 20971520;
const MAX_REDIRECTS = 3;
const CACHE_SECONDS = 21600;

function readHtpasswd(): array {
    $line = trim((string)@file_get_contents(__DIR__ . '/.htpasswd'));
    return array_pad(explode(':', $line, 2), 2, '');
}

function validCookie(?string $value): bool {
    [$user, $hash] = readHtpasswd();
    if ($hash === '' || $value === null) return false;
    $parts = explode('.', $value, 2);
    return count($parts) === 2 && ctype_digit($parts[0]) && (int)$parts[0] >= time()
        && hash_equals(hash_hmac('sha256', $parts[0] . ':' . $user, $hash), $parts[1]);
}

function checkedFeedUrl(string $value): string {
    if (strlen($value) > 512 || !filter_var($value, FILTER_VALIDATE_URL)) throw new RuntimeException('Invalid guide URL');
    $parts = parse_url($value);
    $host = strtolower((string)($parts['host'] ?? ''));
    $path = (string)($parts['path'] ?? '');
    $query = [];
    parse_str((string)($parts['query'] ?? ''), $query);
    $isFeed = preg_match('~^/files/italy[1-8]\.xml$~', $path) === 1;
    $isDownload = $path === '/app/download.php' && preg_match('~^italy[1-8]\.xml$~', (string)($query['file'] ?? '')) === 1;
    if (($parts['scheme'] ?? '') !== 'https' || $host !== 'www.open-epg.com' || (!$isFeed && !$isDownload)) {
        throw new RuntimeException('Guide host is not allowed');
    }
    return $value;
}

function resolveUrl(string $base, string $location): string {
    if (preg_match('~^https://~i', $location)) return $location;
    $parts = parse_url($base);
    if (str_starts_with($location, '//')) return 'https:' . $location;
    $path = str_starts_with($location, '/') ? $location : preg_replace('~/[^/]*$~', '/', (string)($parts['path'] ?? '/')) . $location;
    return 'https://' . ($parts['host'] ?? '') . $path;
}

function fetchGuide(string $url): string {
    for ($hop = 0; $hop <= MAX_REDIRECTS; $hop++) {
        $url = checkedFeedUrl($url);
        $headers = [];
        $oversized = false;
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_CONNECTTIMEOUT => 8,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_USERAGENT => 'CATODO/2 epg-cache',
            CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
            CURLOPT_MAXFILESIZE => MAX_BYTES,
            CURLOPT_HEADERFUNCTION => function($ch, $line) use (&$headers, &$oversized) {
                $headers[] = trim($line);
                if (stripos($line, 'content-length:') === 0 && (int)trim(substr($line, 15)) > MAX_BYTES) $oversized = true;
                return strlen($line);
            },
        ]);
        $body = curl_exec($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);
        if ($status >= 300 && $status < 400) {
            $location = '';
            foreach ($headers as $line) if (stripos($line, 'location:') === 0) $location = trim(substr($line, 9));
            if ($location === '') throw new RuntimeException('Invalid guide redirect');
            $url = resolveUrl($url, $location);
            continue;
        }
        if ($oversized || $status !== 200 || !is_string($body) || strlen($body) === 0 || strlen($body) > MAX_BYTES) {
            throw new RuntimeException('Guide request failed');
        }
        if (stripos(ltrim($body), '<?xml') !== 0 && stripos(ltrim($body), '<tv') !== 0) throw new RuntimeException('Invalid XMLTV response');
        return $body;
    }
    throw new RuntimeException('Too many guide redirects');
}

if (!validCookie($_COOKIE[COOKIE_NAME] ?? null)) { http_response_code(401); exit; }
try { $url = checkedFeedUrl((string)($_GET['url'] ?? '')); } catch (Throwable $error) { http_response_code(400); exit; }
$key = hash('sha256', $url);
$dataFile = CACHE_DIR . '/' . $key . '.xml';
if (!is_file($dataFile) || time() - (int)@filemtime($dataFile) > CACHE_SECONDS) {
    try {
        $body = fetchGuide($url);
        if (!is_dir(CACHE_DIR) && !mkdir(CACHE_DIR, 0700, true) && !is_dir(CACHE_DIR)) throw new RuntimeException('Cache unavailable');
        file_put_contents($dataFile, $body, LOCK_EX);
        @chmod($dataFile, 0600);
    } catch (Throwable $error) { http_response_code(502); exit; }
}
header('Content-Type: application/xml; charset=utf-8');
header('Cache-Control: private, max-age=900');
header('X-Content-Type-Options: nosniff');
readfile($dataFile);
