import { expect, test } from '@playwright/test';
import { continuePlaying, pour, waitForBoard } from './helpers';

test.use({ serviceWorkers: 'allow' });

const APPENDIX_A: [number, number][] = [
  [2, 1],
  [1, 0],
  [0, 2],
  [1, 0],
  [2, 1],
];

test('after the first load the game plays with the network off (FR-35)', async ({ page, context }) => {
  await page.goto('/?unlock=w1-08');
  await page.getByRole('button', { name: 'Play muted' }).click();
  await continuePlaying(page);
  await waitForBoard(page);
  // Wait for the service worker to take control and for every level pack to be cached.
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, {
    timeout: 20_000,
  });
  await page.waitForFunction(() => window.__clink?.warmed?.() === true, undefined, { timeout: 20_000 });

  await context.setOffline(true);
  await page.goto('/play/w1-08');
  await waitForBoard(page);
  for (const [i, [from, to]] of APPENDIX_A.entries()) await pour(page, from, to, i + 1);
  await page.waitForFunction(() => window.__clink?.snapshot?.()?.tuned === true);
  expect(await page.evaluate(() => window.__clink?.snapshot?.()?.moves)).toBe(5);
});
