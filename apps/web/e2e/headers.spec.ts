import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

// vite preview does not read _headers, so this checks the file the host will serve.
const headers = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');
const block = (path: string): string => {
  const start = headers.indexOf(`\n${path}\n`);
  return start < 0 ? '' : (headers.slice(start + 1).split(/\n\/\S/)[0] ?? '');
};

test('the content security policy is strict (NFR-12)', () => {
  const csp = headers.match(/Content-Security-Policy: (.*)/)?.[1] ?? '';
  expect(csp).toContain("script-src 'self'");
  expect(csp).not.toContain('unsafe-eval');
  expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  expect(headers).toContain('Strict-Transport-Security');
});

test('caching: packs are immutable, the shell and worker are never stale', () => {
  expect(block('/content/packs/*')).toContain('immutable');
  expect(block('/index.html')).toContain('no-cache');
  expect(block('/sw.js')).toContain('no-cache');
});

test('the manifest is served and installable', async ({ request }) => {
  const response = await request.get('/manifest.webmanifest');
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest).toMatchObject({ name: 'Clink', display: 'standalone' });
  expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toContain('512x512');
});
