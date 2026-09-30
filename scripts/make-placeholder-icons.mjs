// Generates placeholder PWA icons and the link-preview image using only Node built-ins.
// The artist replaces these later (docs/architecture/07-platform.md §2). Run: node scripts/make-placeholder-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const OUT = new URL('../apps/web/public/', import.meta.url).pathname;
const BG = [15, 23, 42];
const GLASS = [226, 232, 240];
const WATER = [
  [56, 189, 248],
  [251, 146, 60],
  [163, 230, 53],
];

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}
function encodePng(width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    rows[y * (width * 4 + 1)] = 0;
    rgba.copy(rows, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Draws glasses of the given relative heights, centred, into an RGBA buffer. `scale` is the glass unit in pixels. */
function render(width, height, glasses, scale) {
  const buffer = Buffer.alloc(width * height * 4);
  const gap = scale * 0.35;
  const glassWidth = scale * 0.9;
  const total = glasses.length * glassWidth + (glasses.length - 1) * gap;
  const left = (width - total) / 2;
  const bottom = height / 2 + scale * 0.75;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let color = BG;
      glasses.forEach((glass, i) => {
        const x0 = left + i * (glassWidth + gap);
        const glassHeight = scale * glass.height;
        const top = bottom - glassHeight;
        if (x < x0 || x > x0 + glassWidth || y < top || y > bottom) return;
        const edge = scale * 0.045;
        const onOutline = x < x0 + edge || x > x0 + glassWidth - edge || y > bottom - edge;
        const waterTop = bottom - glassHeight * glass.water;
        if (onOutline) color = GLASS;
        else if (y >= waterTop) color = WATER[i % WATER.length];
      });
      const o = (y * width + x) * 4;
      buffer[o] = color[0];
      buffer[o + 1] = color[1];
      buffer[o + 2] = color[2];
      buffer[o + 3] = 255;
    }
  }
  return buffer;
}

const trio = [
  { height: 0.9, water: 0.35 },
  { height: 1.2, water: 0.6 },
  { height: 1.6, water: 0.8 },
];

function write(name, width, height, scale) {
  writeFileSync(`${OUT}${name}`, encodePng(width, height, render(width, height, trio, scale)));
  console.log(`wrote ${name}`);
}

mkdirSync(`${OUT}icons`, { recursive: true });
write('icons/icon-192.png', 192, 192, 192 * 0.18);
write('icons/icon-512.png', 512, 512, 512 * 0.18);
// Maskable icons keep everything inside the central 80% safe zone.
write('icons/icon-maskable-512.png', 512, 512, 512 * 0.14);
write('icons/apple-touch-icon.png', 180, 180, 180 * 0.18);
write('og.png', 1200, 630, 630 * 0.4);
