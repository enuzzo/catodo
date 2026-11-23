import { readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

// Plain JSON remains the readable source/fallback. Ship a smaller on-demand copy.
for (const [name, limit] of [['archive-index.json', 30_000_000], ['archive-recordings.json', 10_000_000]]) {
  const path = new URL(`../dist/theatre/${name}`, import.meta.url);
  const source = await readFile(path);
  if (source.length > limit) throw new Error(`${name} exceeds the client size limit`);
  const compressed = gzipSync(source, { level: 9 });
  await writeFile(new URL(`${path.href}.gz`), compressed);
  console.log(`${name}: ${source.length} bytes → ${compressed.length} bytes on demand`);
}
