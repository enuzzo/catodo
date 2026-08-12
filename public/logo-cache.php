<?php
declare(strict_types=1);

const COOKIE_NAME = 'catodo_auth';
const CACHE_DIR = __DIR__ . '/.catodo-data/logos';
const MAX_BYTES = 2097152;
const MAX_REDIRECTS = 4;
const CACHE_SECONDS = 2592000;

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
function deniedHost(string $host): bool {
    $host = strtolower(rtrim($host, '.'));
    if ($host === '' || $host === 'localhost' || str_ends_with($host, '.local') || str_ends_with($host, '.internal')) return true;
    if (filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6)) {
        $ips = [$host];
    } else {
        $ips = filter_var($host, FILTER_VALIDATE_IP) ? [$host] : array_values(array_filter(@gethostbynamel($host) ?: []));
    }
    if (!$ips) return true;
    foreach ($ips as $ip) if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) return true;
    return false;
}
function checkedUrl(string $value): string {
    if (strlen($value) > 4096 || !filter_var($value, FILTER_VALIDATE_URL)) throw new RuntimeException('Invalid logo URL');
    $parts = parse_url($value);
    if (strtolower((string)($parts['scheme'] ?? '')) !== 'https' || isset($parts['user']) || isset($parts['pass']) || deniedHost((string)($parts['host'] ?? ''))) throw new RuntimeException('Logo host is not allowed');
    return $value;
}
function resolveUrl(string $base, string $location): string {
    if (preg_match('~^https?://~i', $location)) return $location;
    $parts = parse_url($base);
    if (str_starts_with($location, '//')) return ($parts['scheme'] ?? 'https') . ':' . $location;
    $path = str_starts_with($location, '/') ? $location : preg_replace('~/[^/]*$~', '/', (string)($parts['path'] ?? '/')) . $location;
    $port = isset($parts['port']) ? ':' . $parts['port'] : '';
    return ($parts['scheme'] ?? 'https') . '://' . ($parts['host'] ?? '') . $port . $path;
}
function fetchLogo(string $url): array {
    for ($hop = 0; $hop <= MAX_REDIRECTS; $hop++) {
        $url = checkedUrl($url);
        $headers = [];
        $ch = curl_init($url);
        $oversized = false;
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_USERAGENT => 'CATODO/2 logo-cache',
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
        $type = strtolower(trim(explode(';', (string)curl_getinfo($ch, CURLINFO_CONTENT_TYPE))[0]));
        curl_close($ch);
        if ($status >= 300 && $status < 400) {
            $location = '';
            foreach ($headers as $line) if (stripos($line, 'location:') === 0) $location = trim(substr($line, 9));
            if ($location === '') throw new RuntimeException('Invalid logo redirect');
            $url = resolveUrl($url, $location);
            continue;
        }
        if ($oversized || $status !== 200 || !is_string($body) || strlen($body) === 0 || strlen($body) > MAX_BYTES) throw new RuntimeException('Logo request failed');
        if (!in_array($type, ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'], true)) throw new RuntimeException('Unsupported logo format');
        return [$body, $type];
    }
    throw new RuntimeException('Too many logo redirects');
}

if (!validCookie($_COOKIE[COOKIE_NAME] ?? null)) { http_response_code(401); exit; }
try { $url = checkedUrl((string)($_GET['url'] ?? '')); } catch (Throwable $error) { http_response_code(400); exit; }
$key = hash('sha256', $url);
$metaFile = CACHE_DIR . '/' . $key . '.json';
$dataFile = CACHE_DIR . '/' . $key . '.data';
$meta = json_decode((string)@file_get_contents($metaFile), true);
if (!is_array($meta) || !is_file($dataFile) || time() - (int)($meta['savedAt'] ?? 0) > CACHE_SECONDS) {
    try {
        [$body, $type] = fetchLogo($url);
        if (!is_dir(CACHE_DIR) && !mkdir(CACHE_DIR, 0700, true) && !is_dir(CACHE_DIR)) throw new RuntimeException('Cache unavailable');
        file_put_contents($dataFile, $body, LOCK_EX);
        file_put_contents($metaFile, json_encode(['type' => $type, 'savedAt' => time()]), LOCK_EX);
        @chmod($dataFile, 0600); @chmod($metaFile, 0600);
        $meta = ['type' => $type, 'savedAt' => time()];
    } catch (Throwable $error) { http_response_code(502); exit; }
}
header('Content-Type: ' . ($meta['type'] ?? 'application/octet-stream'));
header('Cache-Control: private, max-age=86400');
header('X-Content-Type-Options: nosniff');
readfile($dataFile);
