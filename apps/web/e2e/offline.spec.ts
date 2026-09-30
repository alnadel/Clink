import { expect, test } from '@playwright/test';
import { continuePlaying, pour, startMuted, waitForBoard } from './helpers';

test.use({ serviceWorkers: 'allow' });

const APPENDIX_A: [number, number][] = [
  [2, 1],
  [1, 0],
  [0, 2],
  [1, 0],
  [2, 1],
];

test('after the first load the game plays with the network off (FR-35)', async ({
  page,
  context,
  browserName,
}) => {
  // Playwright's WebKit cannot navigate while offline; offline play on iOS is checked on a device.
  test.skip(browserName !== 'chromium', 'offline navigation is not supported by Playwright WebKit');
  // Without the browser's own HTTP cache, only the service worker can answer once the network is off.
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await startMuted(page, '/?unlock=w1-08');
  await continuePlaying(page);
  await waitForBoard(page);
  // Wait for the service worker to take control and for every level pack to be cached.
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, {
    timeout: 20_000,
  });
  await page.waitForFunction(() => window.__clink?.warmed?.() === true, undefined, { timeout: 20_000 });

  // The worker stores responses after handing them out, so give the writes a moment.
  await expect
    .poll(() =>
      page.evaluate(async () => ({
        manifest: (await caches.match('/content/manifest.json')) !== undefined,
        packs: (await (await caches.open('clink-packs')).keys()).length,
      })),
    )
    .toMatchObject({ manifest: true, packs: expect.any(Number) });
  expect(
    await page.evaluate(async () => (await (await caches.open('clink-packs')).keys()).length),
  ).toBeGreaterThan(0);

  await context.setOffline(true);
  await page.goto('/play/w1-08');
  await waitForBoard(page);
  for (const [i, [from, to]] of APPENDIX_A.entries()) await pour(page, from, to, i + 1);
  await page.waitForFunction(() => window.__clink?.snapshot?.()?.tuned === true);
  expect(await page.evaluate(() => window.__clink?.snapshot?.()?.moves)).toBe(5);
});
