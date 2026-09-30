// Fails if the production build contains the Playwright test hook (docs/architecture/05 §14).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dist = new URL('../apps/web/dist', import.meta.url).pathname;

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* walk(path);
    else yield path;
  }
}

const leaks = [];
for (const file of walk(dist)) {
  if (/\.(js|html|css|json|map)$/.test(file) && readFileSync(file, 'utf8').includes('__clink'))
    leaks.push(file);
}
if (leaks.length > 0) {
  console.error(`test hook found in the production build:\n${leaks.join('\n')}`);
  process.exit(1);
}
console.log('check-no-test-hook: dist is clean');
