// NFR-02: the first download is 3 MB or less compressed (docs/architecture/07 §6).
// Gzips every file the service worker precaches; JavaScript alone should stay under 350 KB.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const TOTAL_BUDGET = 3_000_000;
const JS_BUDGET = 350_000;

const dist = new URL('../apps/web/dist/', import.meta.url).pathname;
const swPath = join(dist, 'sw.js');
if (!existsSync(swPath)) {
  console.error('check-size: apps/web/dist/sw.js not found; run pnpm build first');
  process.exit(1);
}

const manifest = [...readFileSync(swPath, 'utf8').matchAll(/\{\s*"?url"?\s*:\s*"([^"]+)"/g)].map(
  (match) => match[1],
);
if (manifest.length === 0) {
  console.error('check-size: no precache entries found in sw.js');
  process.exit(1);
}

let total = 0;
let js = 0;
const rows = [];
for (const url of manifest) {
  const path = join(dist, url.split('?')[0]);
  if (!existsSync(path)) continue;
  const bytes = gzipSync(readFileSync(path)).length;
  total += bytes;
  if (url.endsWith('.js')) js += bytes;
  rows.push({ url, bytes });
}

rows.sort((a, b) => b.bytes - a.bytes);
for (const row of rows.slice(0, 8)) console.log(`${String(row.bytes).padStart(9)}  ${row.url}`);
console.log(
  `check-size: ${rows.length} precached files, ${total} bytes gzip (budget ${TOTAL_BUDGET}); JS ${js} (budget ${JS_BUDGET})`,
);

// The JavaScript figure is a target, not a gate (docs/architecture/07 §6): it only warns.
if (js > JS_BUDGET) console.warn(`check-size: warning: JavaScript is ${js} bytes gzip, over ${JS_BUDGET}`);
if (total > TOTAL_BUDGET) {
  console.error(`check-size: precache is ${total} bytes gzip, over ${TOTAL_BUDGET}`);
  process.exit(1);
}
