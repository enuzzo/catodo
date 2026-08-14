<?php
declare(strict_types=1);

const COOKIE_NAME = 'catodo_auth';
const CACHE_DIR = __DIR__ . '/.catodo-data/epg';
const MAX_BYTES = 33554432;
const MAX_DOWNLOAD_BYTES = 12582912;
const MAX_CATALOG_BYTES = 262144;
const MAX_REDIRECTS = 3;
const CACHE_SECONDS = 21600;
const OPEN_EPG_CATALOG_URL = 'https://www.open-epg.com/app/epgfetch.php';
const EPG_SHARE_TAGS = [
    'AE1', 'AL1', 'AR1', 'AT1', 'AU1', 'BA1', 'BE1', 'BG1', 'BR1', 'CA1', 'CH1', 'CL1', 'CO1', 'CR1', 'CY1', 'CZ1',
    'DE1', 'DK1', 'DO1', 'EC1', 'ES1', 'FI1', 'FR1', 'GR1', 'HK1', 'HR1', 'HU1', 'ID1', 'IE1', 'IL1', 'IN1', 'IT1',
    'JM1', 'JP1', 'KE1', 'KR1', 'LT1', 'LV1', 'MT1', 'MX1', 'MY1', 'NG1', 'NL1', 'NO1', 'NZ1', 'PA1', 'PE1', 'PH1',
    'PK1', 'PL1', 'PT1', 'RO1', 'RS1', 'SA1', 'SE1', 'SG1', 'SK1', 'SV1', 'TR1', 'UK1', 'US1', 'UY1', 'VN1', 'ZA1',
];

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
    $openEpgFile = preg_match('~^[a-z0-9_-]{2,64}\.xml$~i', basename($path)) === 1;
    $isOpenEpgFeed = $host === 'www.open-epg.com' && preg_match('~^/files/[a-z0-9_-]{2,64}\.xml$~i', $path) === 1;
    $isOpenEpgDownload = $host === 'www.open-epg.com' && $path === '/app/download.php'
        && preg_match('~^[a-z0-9_-]{2,64}\.xml$~i', (string)($query['file'] ?? '')) === 1;
    $shareMatch = [];
    $isEpgShare = $host === 'epgshare01.online'
        && preg_match('~^/epgshare01/epg_ripper_([A-Z]{2}1)\.xml\.gz$~', $path, $shareMatch) === 1
        && in_array($shareMatch[1] ?? '', EPG_SHARE_TAGS, true);
    if (($parts['scheme'] ?? '') !== 'https' || (!$isOpenEpgFeed && !$isOpenEpgDownload && !$isEpgShare) || (!$openEpgFile && !$isEpgShare && !$isOpenEpgDownload)) {
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
            CURLOPT_MAXFILESIZE => MAX_DOWNLOAD_BYTES,
            CURLOPT_NOPROGRESS => false,
            CURLOPT_XFERINFOFUNCTION => static function($ch, float $downloadSize, float $downloaded): int {
                return $downloadSize > MAX_DOWNLOAD_BYTES || $downloaded > MAX_DOWNLOAD_BYTES ? 1 : 0;
            },
            CURLOPT_HEADERFUNCTION => function($ch, $line) use (&$headers, &$oversized) {
                $headers[] = trim($line);
                if (stripos($line, 'content-length:') === 0 && (int)trim(substr($line, 15)) > MAX_DOWNLOAD_BYTES) $oversized = true;
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
        if ($oversized || $status !== 200 || !is_string($body) || strlen($body) === 0 || strlen($body) > MAX_DOWNLOAD_BYTES) {
            throw new RuntimeException('Guide request failed');
        }
        if (str_starts_with($body, "\x1f\x8b")) {
            $decoded = @gzdecode($body, MAX_BYTES + 1);
            if (!is_string($decoded) || strlen($decoded) === 0 || strlen($decoded) > MAX_BYTES) throw new RuntimeException('Guide archive is invalid or too large');
            $body = $decoded;
        }
        if (strlen($body) > MAX_BYTES) throw new RuntimeException('Guide response is too large');
        if (stripos(ltrim($body), '<?xml') !== 0 && stripos(ltrim($body), '<tv') !== 0) throw new RuntimeException('Invalid XMLTV response');
        return $body;
    }
    throw new RuntimeException('Too many guide redirects');
}

function fetchOpenEpgCatalog(): string {
    $ch = curl_init(OPEN_EPG_CATALOG_URL);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_USERAGENT => 'CATODO/2 epg-catalog',
        CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
        CURLOPT_MAXFILESIZE => MAX_CATALOG_BYTES,
        CURLOPT_NOPROGRESS => false,
        CURLOPT_XFERINFOFUNCTION => static function($ch, float $downloadSize, float $downloaded): int {
            return $downloadSize > MAX_CATALOG_BYTES || $downloaded > MAX_CATALOG_BYTES ? 1 : 0;
        },
    ]);
    $body = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if ($status !== 200 || !is_string($body) || strlen($body) === 0 || strlen($body) > MAX_CATALOG_BYTES) throw new RuntimeException('Guide catalog request failed');
    $rows = json_decode($body, true, 32, JSON_THROW_ON_ERROR);
    if (!is_array($rows)) throw new RuntimeException('Invalid guide catalog');
    $safe = [];
    foreach ($rows as $row) {
        if (!is_array($row)) continue;
        try { $url = checkedFeedUrl((string)($row['url'] ?? '')); } catch (Throwable $error) { continue; }
        $safe[] = [
            'cou' => substr((string)($row['cou'] ?? ''), 0, 80),
            'url' => $url,
            'age' => substr((string)($row['age'] ?? ''), 0, 16),
            'cnt' => (int)($row['cnt'] ?? 0),
        ];
    }
    return json_encode($safe, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
}

if (!validCookie($_COOKIE[COOKIE_NAME] ?? null)) { http_response_code(401); exit; }
if ((string)($_GET['catalog'] ?? '') === 'open-epg') {
    $catalogFile = CACHE_DIR . '/open-epg-catalog.json';
    if (!is_file($catalogFile) || time() - (int)@filemtime($catalogFile) > CACHE_SECONDS) {
        try {
            $body = fetchOpenEpgCatalog();
            if (!is_dir(CACHE_DIR) && !mkdir(CACHE_DIR, 0700, true) && !is_dir(CACHE_DIR)) throw new RuntimeException('Cache unavailable');
            file_put_contents($catalogFile, $body, LOCK_EX);
            @chmod($catalogFile, 0600);
        } catch (Throwable $error) { http_response_code(502); exit; }
    }
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: private, max-age=900');
    header('X-Content-Type-Options: nosniff');
    readfile($catalogFile);
    exit;
}
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
