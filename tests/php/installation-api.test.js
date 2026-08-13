import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { copyFile, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const phpAvailable = spawnSync('php', ['-v'], { stdio: 'ignore' }).status === 0;

function request(documentRoot, { method = 'GET', revision = '', body = '' } = {}) {
  const expires = Math.floor(Date.now() / 1000) + 3_600;
  const signature = createHmac('sha256', 'test-secret').update(`${expires}:tester`).digest('hex');
  const result = spawnSync('php', [join(documentRoot, 'request.php')], {
    cwd: documentRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      TEST_METHOD: method,
      TEST_REVISION: revision,
      TEST_BODY: body,
      TEST_COOKIE: `${expires}.${signature}`,
    },
  });
  const status = Number(result.stderr.match(/CATODO_STATUS:(\d+)/)?.[1] || 0);
  return { status, body: result.stdout, json: JSON.parse(result.stdout || '{}') };
}

test('installation API uses conditional atomic state writes and fails closed on corruption', {
  skip: !phpAvailable && 'PHP is not installed',
}, async (context) => {
  const documentRoot = await mkdtemp(join(tmpdir(), 'catodo-installation-api-'));
  const apiSource = new URL('../../public/installation-api.php', import.meta.url);
  await copyFile(apiSource, join(documentRoot, 'installation-api.php'));
  await writeFile(join(documentRoot, '.htpasswd'), 'tester:test-secret\n', { mode: 0o600 });
  await writeFile(join(documentRoot, 'request.php'), `<?php
final class TestInputStream {
    public mixed $context;
    private string $value = '';
    private int $offset = 0;
    public function stream_open(string $path, string $mode, int $options, mixed &$openedPath): bool {
        $this->value = $path === 'php://input' ? (string)getenv('TEST_BODY') : '';
        return true;
    }
    public function stream_read(int $count): string {
        $chunk = substr($this->value, $this->offset, $count);
        $this->offset += strlen($chunk);
        return $chunk;
    }
    public function stream_eof(): bool { return $this->offset >= strlen($this->value); }
    public function stream_stat(): array { return []; }
}
register_shutdown_function(function(): void {
    fwrite(STDERR, 'CATODO_STATUS:' . (http_response_code() ?: 200));
});
stream_wrapper_unregister('php');
stream_wrapper_register('php', TestInputStream::class);
$_SERVER['REQUEST_METHOD'] = (string)getenv('TEST_METHOD');
$_SERVER['CONTENT_LENGTH'] = strlen((string)getenv('TEST_BODY'));
$_SERVER['HTTP_IF_MATCH'] = (string)getenv('TEST_REVISION');
$_COOKIE['catodo_auth'] = (string)getenv('TEST_COOKIE');
require __DIR__ . '/installation-api.php';
`, 'utf8');
  context.after(async () => {
    await rm(documentRoot, { recursive: true, force: true });
  });

  const initialResponse = request(documentRoot);
  assert.equal(initialResponse.status, 200);
  const initial = initialResponse.json;
  assert.equal(initial.version, 2);
  assert.equal(initial.updatedAt, 0);
  assert.equal(initial.migration.legacyInstallation, 'pending');
  assert.match(initial.revision, /^[a-f0-9]{64}$/);

  const revisionless = request(documentRoot, {
    method: 'PUT',
    body: JSON.stringify({ version: 2, sources: [], favorites: [], settings: {} }),
  });
  assert.equal(revisionless.status, 428);

  const oldClient = request(documentRoot, {
    method: 'PUT',
    revision: initial.revision,
    body: JSON.stringify({ version: 1, sources: [], favorites: [], settings: {} }),
  });
  assert.equal(oldClient.status, 400);

  const saveResponse = request(documentRoot, {
    method: 'PUT',
    revision: initial.revision,
    body: JSON.stringify({
      version: 2,
      sources: [{ sourceId: 'shared', name: 'Shared', url: 'https://example.test/list.m3u' }],
      favorites: ['channel:favorite'],
      settings: { 'epg:refreshMinutes': 30 },
    }),
  });
  assert.equal(saveResponse.status, 200);
  const saved = saveResponse.json;
  assert.notEqual(saved.revision, initial.revision);
  assert.equal(saved.migration.legacyInstallation, 'complete');
  assert.deepEqual(saved.sources.map((source) => source.sourceId), ['shared']);
  assert.deepEqual(saved.favorites.map((favorite) => favorite.channelId), ['channel:favorite']);

  const staleWrite = request(documentRoot, {
    method: 'PUT',
    revision: initial.revision,
    body: JSON.stringify({ version: 2, sources: [], favorites: [], settings: {} }),
  });
  assert.equal(staleWrite.status, 409);

  const stored = JSON.parse(await readFile(join(documentRoot, '.catodo-data', 'installation-state.json'), 'utf8'));
  assert.deepEqual(stored.sources.map((source) => source.sourceId), ['shared']);
  assert.ok((await readdir(join(documentRoot, '.catodo-data'))).every((name) => !name.startsWith('installation-state.') || name === 'installation-state.json' || name === 'installation-state.lock'));

  const beforeRejectedWrite = await readFile(join(documentRoot, '.catodo-data', 'installation-state.json'), 'utf8');
  const tooManySources = request(documentRoot, {
    method: 'PUT',
    revision: saved.revision,
    body: JSON.stringify({
      version: 2,
      sources: Array.from({ length: 257 }, (_, index) => ({
        sourceId: `source:${index}`,
        name: `Source ${index}`,
        url: `https://example.test/${index}.m3u`,
      })),
      favorites: [],
      settings: {},
    }),
  });
  assert.equal(tooManySources.status, 400);
  assert.equal(await readFile(join(documentRoot, '.catodo-data', 'installation-state.json'), 'utf8'), beforeRejectedWrite);

  const invalidRecord = request(documentRoot, {
    method: 'PUT',
    revision: saved.revision,
    body: JSON.stringify({
      version: 2,
      sources: [{ sourceId: 'bad', name: 'Bad', url: 'file:///etc/passwd' }],
      favorites: [],
      settings: {},
    }),
  });
  assert.equal(invalidRecord.status, 400);
  assert.equal(await readFile(join(documentRoot, '.catodo-data', 'installation-state.json'), 'utf8'), beforeRejectedWrite);

  await mkdir(join(documentRoot, '.catodo-data'), { recursive: true });
  await writeFile(join(documentRoot, '.catodo-data', 'installation-state.json'), '{broken', 'utf8');
  const corrupt = request(documentRoot);
  assert.equal(corrupt.status, 500);
  assert.match(corrupt.json.error, /corrupted/i);

  await writeFile(join(documentRoot, '.catodo-data', 'installation-state.json'), JSON.stringify({ version: 2, updatedAt: 123 }), 'utf8');
  const semanticCorrupt = request(documentRoot);
  assert.equal(semanticCorrupt.status, 500);
  assert.match(semanticCorrupt.json.error, /corrupted/i);
});
