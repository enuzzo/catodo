import { readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

// Plain JSON remains the readable source/fallback. Ship a smaller on-demand copy.
const path = new URL('../dist/theatre/archive-index.json', import.meta.url);
const source = await readFile(path);
if (source.length > 30_000_000) throw new Error('Theatre index exceeds the client size limit');
const compressed = gzipSync(source, { level: 9 });
await writeFile(new URL(`${path.href}.gz`), compressed);
console.log(`Theatre index: ${source.length} bytes → ${compressed.length} bytes on demand`);
