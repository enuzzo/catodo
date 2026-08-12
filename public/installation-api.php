<?php
declare(strict_types=1);

const COOKIE_NAME = 'catodo_auth';
const STATE_FILE = __DIR__ . '/.catodo-data/installation-state.json';
const STATE_MAX_BYTES = 262144;

header('Cache-Control: private, no-store');
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

function failJson(int $status, string $message): never {
    http_response_code($status);
    echo json_encode(['error' => $message], JSON_UNESCAPED_SLASHES);
    exit;
}

function readHtpasswd(): array {
    $line = trim((string)@file_get_contents(__DIR__ . '/.htpasswd'));
    return array_pad(explode(':', $line, 2), 2, '');
}

function validCookie(?string $value): bool {
    [$user, $hash] = readHtpasswd();
    if ($hash === '' || $value === null) return false;
    $parts = explode('.', $value, 2);
    if (count($parts) !== 2 || !ctype_digit($parts[0]) || (int)$parts[0] < time()) return false;
    $expected = hash_hmac('sha256', $parts[0] . ':' . $user, $hash);
    return hash_equals($expected, $parts[1]);
}

function currentState(): array {
    $raw = @file_get_contents(STATE_FILE);
    $value = json_decode((string)$raw, true);
    return is_array($value) ? $value : ['version' => 1, 'sources' => [], 'favorites' => [], 'settings' => [], 'updatedAt' => 0];
}

function revision(array $state): string {
    return hash('sha256', json_encode($state, JSON_UNESCAPED_SLASHES));
}

function respond(array $state): never {
    echo json_encode([...$state, 'revision' => revision($state)], JSON_UNESCAPED_SLASHES);
    exit;
}

function httpUrl(mixed $value): ?string {
    if (!is_string($value) || strlen($value) > 4096 || !filter_var($value, FILTER_VALIDATE_URL)) return null;
    $scheme = strtolower((string)parse_url($value, PHP_URL_SCHEME));
    return in_array($scheme, ['http', 'https'], true) ? $value : null;
}

function cleanPayload(array $input): array {
    $sources = [];
    foreach (array_slice(is_array($input['sources'] ?? null) ? $input['sources'] : [], 0, 256) as $source) {
        if (!is_array($source)) continue;
        $url = httpUrl($source['url'] ?? null);
        $id = is_string($source['sourceId'] ?? null) ? substr($source['sourceId'], 0, 256) : '';
        if ($url === null || $id === '') continue;
        $sources[] = [
            'sourceId' => $id,
            'kind' => 'url',
            'name' => substr((string)($source['name'] ?? 'Playlist'), 0, 160),
            'url' => $url,
            'trusted' => (bool)($source['trusted'] ?? false),
            'createdAt' => max(0, (int)($source['createdAt'] ?? time() * 1000)),
        ];
    }
    $favorites = [];
    foreach (array_slice(is_array($input['favorites'] ?? null) ? $input['favorites'] : [], 0, 10000) as $favorite) {
        $id = is_array($favorite) ? ($favorite['channelId'] ?? $favorite['id'] ?? '') : $favorite;
        $id = is_string($id) ? substr($id, 0, 256) : '';
        if ($id !== '') $favorites[$id] = ['id' => $id, 'channelId' => $id, 'createdAt' => time() * 1000];
    }
    $allowed = ['proxy', 'epg:sources', 'epg:refreshMinutes'];
    $inputSettings = is_array($input['settings'] ?? null) ? $input['settings'] : [];
    $settings = [];
    foreach ($allowed as $key) if (array_key_exists($key, $inputSettings)) $settings[$key] = $inputSettings[$key];
    if (isset($settings['proxy']) && $settings['proxy'] !== '' && httpUrl($settings['proxy']) === null) $settings['proxy'] = '';
    if (isset($settings['epg:sources'])) {
        $settings['epg:sources'] = array_values(array_filter(array_slice(is_array($settings['epg:sources']) ? $settings['epg:sources'] : [], 0, 32), fn($url) => httpUrl($url) !== null));
    }
    if (isset($settings['epg:refreshMinutes']) && !in_array((int)$settings['epg:refreshMinutes'], [0, 30, 60, 360, 1440], true)) $settings['epg:refreshMinutes'] = 360;
    return ['version' => 1, 'sources' => $sources, 'favorites' => array_values($favorites), 'settings' => $settings, 'updatedAt' => time() * 1000];
}

if (!validCookie($_COOKIE[COOKIE_NAME] ?? null)) failJson(401, 'Authentication required');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'GET') respond(currentState());
if ($method !== 'PUT') failJson(405, 'Method not allowed');
$length = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
if ($length > STATE_MAX_BYTES) failJson(413, 'State payload is too large');
$raw = (string)file_get_contents('php://input');
if ($raw === '' || strlen($raw) > STATE_MAX_BYTES) failJson(413, 'State payload is too large');
$input = json_decode($raw, true);
if (!is_array($input)) failJson(400, 'Invalid JSON');
$next = cleanPayload($input);
$directory = dirname(STATE_FILE);
if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) failJson(500, 'Cannot create installation storage');
$handle = @fopen(STATE_FILE, 'c+');
if ($handle === false || !flock($handle, LOCK_EX)) failJson(500, 'Cannot lock installation state');
rewind($handle);
$currentRaw = stream_get_contents($handle);
$current = json_decode((string)$currentRaw, true);
$state = is_array($current) ? $current : ['version' => 1, 'sources' => [], 'favorites' => [], 'settings' => [], 'updatedAt' => 0];
$expected = trim((string)($_SERVER['HTTP_IF_MATCH'] ?? ''));
if ($expected !== '' && !hash_equals(revision($state), $expected)) {
    flock($handle, LOCK_UN);
    fclose($handle);
    failJson(409, 'State changed; reload before saving');
}
$encoded = json_encode($next, JSON_UNESCAPED_SLASHES);
if ($encoded === false || !ftruncate($handle, 0) || rewind($handle) === false || fwrite($handle, $encoded) === false || !fflush($handle)) {
    flock($handle, LOCK_UN);
    fclose($handle);
    failJson(500, 'Cannot save installation state');
}
flock($handle, LOCK_UN);
fclose($handle);
@chmod(STATE_FILE, 0600);
respond($next);
