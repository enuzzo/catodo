<?php
declare(strict_types=1);

const COOKIE_NAME = 'catodo_auth';
const STATE_DIRECTORY = __DIR__ . '/.catodo-data';
const STATE_FILE = STATE_DIRECTORY . '/installation-state.json';
const STATE_LOCK_FILE = STATE_DIRECTORY . '/installation-state.lock';
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

function emptyState(): array {
    return [
        'version' => 2,
        'sources' => [],
        'favorites' => [],
        'settings' => [],
        'migration' => ['legacyInstallation' => 'pending', 'completedAt' => 0],
        'updatedAt' => 0,
    ];
}

function isListArray(mixed $value): bool {
    return is_array($value) && array_is_list($value);
}

function validSettings(mixed $value): bool {
    if (!is_array($value) || (array_is_list($value) && $value !== [])) return false;
    $allowed = ['proxy', 'epg:sources', 'epg:refreshMinutes'];
    foreach (array_keys($value) as $key) if (!in_array($key, $allowed, true)) return false;
    if (array_key_exists('proxy', $value)) {
        if (!is_string($value['proxy']) || ($value['proxy'] !== '' && httpUrl($value['proxy']) === null)) return false;
    }
    if (array_key_exists('epg:sources', $value)) {
        if (!isListArray($value['epg:sources']) || count($value['epg:sources']) > 32) return false;
        foreach ($value['epg:sources'] as $url) if (httpUrl($url) === null) return false;
    }
    if (array_key_exists('epg:refreshMinutes', $value)) {
        if (!is_int($value['epg:refreshMinutes']) || !in_array($value['epg:refreshMinutes'], [0, 30, 60, 360, 1440], true)) return false;
    }
    return true;
}

function validStoredState(array $value): bool {
    $version = $value['version'] ?? null;
    if (!is_int($version) || !in_array($version, [1, 2], true)) return false;
    if (!isListArray($value['sources'] ?? null) || !isListArray($value['favorites'] ?? null)) return false;
    if (count($value['sources']) > 256 || count($value['favorites']) > 10000 || !validSettings($value['settings'] ?? null)) return false;
    if (!isset($value['updatedAt']) || !is_int($value['updatedAt']) || $value['updatedAt'] < 0) return false;
    $sourceIds = [];
    foreach ($value['sources'] as $source) {
        if (!is_array($source) || !is_string($source['sourceId'] ?? null) || trim($source['sourceId'] ?? '') === '' || strlen($source['sourceId']) > 256 || httpUrl($source['url'] ?? null) === null) return false;
        if (isset($sourceIds[$source['sourceId']])) return false;
        if (isset($source['name']) && (!is_string($source['name']) || strlen($source['name']) > 160)) return false;
        if (isset($source['trusted']) && !is_bool($source['trusted'])) return false;
        if (isset($source['createdAt']) && (!is_int($source['createdAt']) || $source['createdAt'] < 0)) return false;
        $sourceIds[$source['sourceId']] = true;
    }
    $favoriteIds = [];
    foreach ($value['favorites'] as $favorite) {
        $id = is_array($favorite) ? ($favorite['channelId'] ?? $favorite['id'] ?? null) : $favorite;
        if (!is_string($id) || trim($id) === '' || strlen($id) > 256 || isset($favoriteIds[$id])) return false;
        if (is_array($favorite) && isset($favorite['createdAt']) && (!is_int($favorite['createdAt']) || $favorite['createdAt'] < 0)) return false;
        $favoriteIds[$id] = true;
    }
    if ($version === 2) {
        $migration = $value['migration'] ?? null;
        $status = is_array($migration) ? ($migration['legacyInstallation'] ?? null) : null;
        if (!in_array($status, ['pending', 'complete'], true) || !is_int($migration['completedAt'] ?? null) || $migration['completedAt'] < 0) return false;
        if ($status === 'pending' && $migration['completedAt'] !== 0) return false;
    }
    return true;
}

function normalizeStoredState(array $value): array {
    if (($value['version'] ?? 0) === 1) {
        $value['version'] = 2;
        $value['migration'] = ['legacyInstallation' => 'pending', 'completedAt' => 0];
    }
    return $value;
}

function readStateFile(): array {
    if (!file_exists(STATE_FILE)) return emptyState();
    $raw = @file_get_contents(STATE_FILE);
    if ($raw === false) failJson(500, 'Cannot read installation state');
    $value = json_decode($raw, true);
    if (!is_array($value) || !validStoredState($value)) failJson(500, 'Installation state is corrupted');
    return normalizeStoredState($value);
}

function currentState(): array {
    if (!is_dir(STATE_DIRECTORY)) return emptyState();
    $lock = @fopen(STATE_LOCK_FILE, 'c+');
    if ($lock === false || !flock($lock, LOCK_SH)) failJson(500, 'Cannot lock installation state');
    $state = readStateFile();
    flock($lock, LOCK_UN);
    fclose($lock);
    return $state;
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
    if (($input['version'] ?? null) !== 2) failJson(400, 'Unsupported installation state version');
    if (!isListArray($input['sources'] ?? null) || count($input['sources']) > 256) failJson(400, 'Invalid sources');
    if (!isListArray($input['favorites'] ?? null) || count($input['favorites']) > 10000) failJson(400, 'Invalid favorites');
    if (!validSettings($input['settings'] ?? null)) failJson(400, 'Invalid settings');
    $sources = [];
    foreach ($input['sources'] as $source) {
        if (!is_array($source)) failJson(400, 'Invalid source record');
        $url = httpUrl($source['url'] ?? null);
        $id = is_string($source['sourceId'] ?? null) ? $source['sourceId'] : '';
        if ($url === null || trim($id) === '') failJson(400, 'Invalid source record');
        if (strlen($id) > 256 || !is_string($source['name'] ?? 'Playlist') || strlen((string)($source['name'] ?? 'Playlist')) > 160) failJson(400, 'Invalid source record');
        if (isset($source['trusted']) && !is_bool($source['trusted'])) failJson(400, 'Invalid source record');
        if (isset($source['createdAt']) && (!is_int($source['createdAt']) || $source['createdAt'] < 0)) failJson(400, 'Invalid source record');
        if (isset($sources[$id])) failJson(400, 'Duplicate source record');
        $sources[$id] = [
            'sourceId' => $id,
            'kind' => 'url',
            'name' => (string)($source['name'] ?? 'Playlist'),
            'url' => $url,
            'trusted' => (bool)($source['trusted'] ?? false),
            'createdAt' => max(0, (int)($source['createdAt'] ?? time() * 1000)),
        ];
    }
    $favorites = [];
    foreach ($input['favorites'] as $favorite) {
        $id = is_array($favorite) ? ($favorite['channelId'] ?? $favorite['id'] ?? '') : $favorite;
        $id = is_string($id) ? $id : '';
        if (trim($id) === '') failJson(400, 'Invalid favorite record');
        if (strlen($id) > 256 || isset($favorites[$id])) failJson(400, 'Invalid favorite record');
        if (is_array($favorite) && isset($favorite['createdAt']) && (!is_int($favorite['createdAt']) || $favorite['createdAt'] < 0)) failJson(400, 'Invalid favorite record');
        $favorites[$id] = ['id' => $id, 'channelId' => $id, 'createdAt' => time() * 1000];
    }
    $allowed = ['proxy', 'epg:sources', 'epg:refreshMinutes'];
    $inputSettings = is_array($input['settings'] ?? null) ? $input['settings'] : [];
    $settings = [];
    foreach ($allowed as $key) if (array_key_exists($key, $inputSettings)) $settings[$key] = $inputSettings[$key];
    if (isset($settings['epg:sources'])) {
        $settings['epg:sources'] = array_values($settings['epg:sources']);
    }
    return [
        'version' => 2,
        'sources' => array_values($sources),
        'favorites' => array_values($favorites),
        'settings' => $settings,
        'migration' => ['legacyInstallation' => 'complete', 'completedAt' => time() * 1000],
        'updatedAt' => time() * 1000,
    ];
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
$expected = trim((string)($_SERVER['HTTP_IF_MATCH'] ?? ''));
if ($expected === '') failJson(428, 'If-Match revision required');
if (!is_dir(STATE_DIRECTORY) && !mkdir(STATE_DIRECTORY, 0700, true) && !is_dir(STATE_DIRECTORY)) failJson(500, 'Cannot create installation storage');
$lock = @fopen(STATE_LOCK_FILE, 'c+');
if ($lock === false || !flock($lock, LOCK_EX)) failJson(500, 'Cannot lock installation state');
$state = readStateFile();
if (!hash_equals(revision($state), $expected)) {
    flock($lock, LOCK_UN);
    fclose($lock);
    failJson(409, 'State changed; reload before saving');
}
$encoded = json_encode($next, JSON_UNESCAPED_SLASHES);
if ($encoded === false) {
    flock($lock, LOCK_UN);
    fclose($lock);
    failJson(500, 'Cannot encode installation state');
}
$temporary = @tempnam(STATE_DIRECTORY, 'installation-state.');
$handle = $temporary === false ? false : @fopen($temporary, 'wb');
if ($handle === false) {
    flock($lock, LOCK_UN);
    fclose($lock);
    failJson(500, 'Cannot save installation state');
}
$remaining = $encoded;
$written = 0;
while ($remaining !== '') {
    $count = fwrite($handle, $remaining);
    if ($count === false || $count === 0) break;
    $written += $count;
    $remaining = substr($remaining, $count);
}
$flushed = $written === strlen($encoded) && fflush($handle);
if ($flushed && function_exists('fsync')) $flushed = fsync($handle);
fclose($handle);
if (!$flushed || !@chmod($temporary, 0600) || !@rename($temporary, STATE_FILE)) {
    @unlink($temporary);
    flock($lock, LOCK_UN);
    fclose($lock);
    failJson(500, 'Cannot save installation state');
}
flock($lock, LOCK_UN);
fclose($lock);
@chmod(STATE_LOCK_FILE, 0600);
respond($next);
