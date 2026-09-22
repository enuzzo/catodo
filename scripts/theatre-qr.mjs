// Optional authoring tool (macOS/Homebrew: qrencode). Runtime uses local PNGs only.
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { THEATRE_TITLES } from '../src/data/theatre-catalog.js';
const directory = new URL('../public/theatre/qr/', import.meta.url);
mkdirSync(directory, { recursive: true });
for (const title of THEATRE_TITLES) {
  execFileSync('qrencode', ['-l', 'M', '-m', '4', '-s', '8', '-o', fileURLToPath(new URL(`${title.id}.png`, directory)), title.sourceUrl]);
  console.log(`Generated ${title.id}: ${title.sourceUrl}`);
}
