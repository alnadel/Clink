import { expect, test } from '@playwright/test';
import { continuePlaying, finishSolve, solveByHints, startMuted, waitForBoard } from './helpers';

test('world two introduces the sink', async ({ page }) => {
  await startMuted(page, '/?unlock=w2-02');
  await continuePlaying(page);
  await waitForBoard(page);
  await expect(page.getByText(/The sink empties a glass/)).toBeVisible();
  await solveByHints(page);
  await finishSolve(page);
});

test('world three has ice that melts into water, and it can be solved', async ({ page }) => {
  await startMuted(page, '/?unlock=w3-01');
  await continuePlaying(page);
  await waitForBoard(page);
  await expect(page.getByText(/Ice melts into water/)).toBeVisible();
  const ice = await page.evaluate(() => window.__clink?.snapshot?.()?.state.ice ?? []);
  expect(ice.length).toBeGreaterThan(0);
  expect(ice.every((countdown) => countdown > 0)).toBe(true);

  await solveByHints(page);
  await finishSolve(page);
  await expect(page.getByRole('dialog', { name: 'Tuned!' })).toContainText('par');
});

test('the second world opens after the first is finished', async ({ page }) => {
  await startMuted(page, '/?unlock=w2-01');
  await page.getByRole('link', { name: 'Levels' }).click();
  await expect(page.getByRole('link', { name: 'Level 20, 3 stars' })).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Café Counter' }).getByRole('link', { name: 'Level 1', exact: true }),
  ).toBeVisible();
});
