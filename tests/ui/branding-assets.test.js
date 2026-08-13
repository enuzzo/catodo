import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import test from 'node:test';

const text = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

function paeth(left, up, upperLeft) {
  const estimate = left + up - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) return left;
  return upDistance <= upperLeftDistance ? up : upperLeft;
}

function pngAlpha(path) {
  const file = readFileSync(new URL(`../../${path}`, import.meta.url));
  assert.deepEqual([...file.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);

  let offset = 8;
  let width = 0;
  let height = 0;
  const dataChunks = [];
  while (offset < file.length) {
    const length = file.readUInt32BE(offset);
    const type = file.toString('ascii', offset + 4, offset + 8);
    const data = file.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      assert.equal(data[8], 8, 'brand PNG must use 8-bit channels');
      assert.equal(data[9], 6, 'brand PNG must be true RGBA, not an opaque RGB image');
      assert.equal(data[12], 0, 'interlaced PNGs are not supported by this regression test');
    }
    if (type === 'IDAT') dataChunks.push(data);
    offset += length + 12;
  }

  const inflated = inflateSync(Buffer.concat(dataChunks));
  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const pixels = new Uint8Array(width * height * bytesPerPixel);
  let sourceOffset = 0;
  for (let row = 0; row < height; row += 1) {
    const filter = inflated[sourceOffset];
    sourceOffset += 1;
    const rowOffset = row * stride;
    for (let column = 0; column < stride; column += 1) {
      const raw = inflated[sourceOffset + column];
      const left = column >= bytesPerPixel ? pixels[rowOffset + column - bytesPerPixel] : 0;
      const up = row > 0 ? pixels[rowOffset + column - stride] : 0;
      const upperLeft = row > 0 && column >= bytesPerPixel
        ? pixels[rowOffset + column - stride - bytesPerPixel]
        : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = Math.floor((left + up) / 2);
      else if (filter === 4) predictor = paeth(left, up, upperLeft);
      else assert.equal(filter, 0, `unsupported PNG filter ${filter}`);
      pixels[rowOffset + column] = (raw + predictor) & 255;
    }
    sourceOffset += stride;
  }

  const alpha = [];
  for (let index = 3; index < pixels.length; index += bytesPerPixel) alpha.push(pixels[index]);
  return { width, height, alpha };
}

test('website brand asset has real, useful transparency', () => {
  const { width, height, alpha } = pngAlpha('public/icons/catodo-netmilk-tv-transparent-512.png');
  assert.equal(width, 512);
  assert.equal(height, 512);
  assert.ok(alpha.includes(0));
  assert.ok(alpha.includes(255));
  assert.ok(alpha.filter((value) => value === 0).length > alpha.length * 0.25);
  assert.ok(alpha.some((value) => value > 0 && value < 255), 'silhouette should keep an antialiased alpha edge');
  assert.deepEqual([alpha[0], alpha[width - 1], alpha[(height - 1) * width], alpha.at(-1)], [0, 0, 0, 0]);
});

test('web surfaces use the naked mark while installable iOS artwork keeps its backing', () => {
  const markup = text('src/ui/markup.js');
  const styles = text('styles/main.css');
  const app = text('app.html');
  const login = text('index.php');
  const manifest = text('public/manifest.webmanifest');

  assert.match(markup, /catodo-netmilk-tv-transparent-512\.png/);
  assert.match(app, /catodo-netmilk-tv-transparent-32\.png/);
  assert.match(app, /boot-lockup__logo[^>]+catodo-netmilk-tv-transparent-512\.png/);
  assert.match(login, /login-logo[^>]+catodo-netmilk-tv-transparent-512\.png/);
  assert.match(login, /catodo-netmilk-tv-transparent-32\.png/);
  assert.match(app, /apple-touch-icon-netmilk-180\.png/);
  assert.match(login, /apple-touch-icon-netmilk-180\.png/);
  assert.match(manifest, /catodo-netmilk-tv-192\.png/);
  assert.doesNotMatch(manifest, /transparent/);
  assert.match(styles, /\.brand__logo\s*\{[^}]*filter:[^}]*drop-shadow\([^)]*rgba\([^)]*\)[^}]*drop-shadow\([^)]*rgba\([^)]*\)/s);
  assert.match(styles, /\.boot-lockup__logo\s*\{[^}]*filter:[^}]*drop-shadow\([^)]*rgba\([^)]*\)[^}]*drop-shadow\([^)]*rgba\([^)]*\)/s);
  assert.match(login, /\.login-logo\{[^}]*filter:[^}]*drop-shadow\([^)]*rgba\([^)]*\)[^}]*drop-shadow\([^)]*rgba\([^)]*\)/s);
});
