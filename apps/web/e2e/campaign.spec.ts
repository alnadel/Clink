import { expect, test } from '@playwright/test';
import { continuePlaying, finishSolve, solveByHints, startMuted, waitForBoard } from './helpers';

test('the first level teaches by doing, then opens the second', async ({ page }) => {
  await startMuted(page);
  await expect(page).toHaveURL(/\/play\/w1-01$/);
  await waitForBoard(page);
  await expect(page.getByText('Tap a glass to hear its note.')).toBeVisible();

  const moves = await solveByHints(page);
  expect(moves).toBeGreaterThan(0);
  await finishSolve(page);
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page).toHaveURL(/\/play\/w1-02$/);
  await waitForBoard(page);
  await expect(page.getByText('Tap the melody bar to hear the song.')).toBeVisible();
});

test('the map shows solved, open and locked levels; locked ones cannot be opened', async ({ page }) => {
  await startMuted(page, '/?unlock=w1-04');
  await page.goto('/map');
  await expect(page.getByRole('link', { name: 'Level 1, 3 stars' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Level 4', exact: true })).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Kitchen Table' }).getByRole('img', { name: 'Level 5, locked' }),
  ).toBeVisible();

  await page.goto('/play/w1-09');
  await expect(page).toHaveURL(/\/map$/);
});

test('a solved tune shows up in the songbook', async ({ page }) => {
  await startMuted(page, '/?unlock=w1-02');
  await continuePlaying(page);
  await waitForBoard(page);
  await solveByHints(page);
  await finishSolve(page);
  await page.goto('/songbook');
  // Level 1 counts as solved by the unlock, so the songbook holds its tune and this one.
  await expect(page.getByRole('button', { name: /^Play / })).toHaveCount(2);
  await expect(page.getByText('Solve a level to add its song here.')).toBeHidden();
});

test('world two introduces the faucet with a hint on the board', async ({ page }) => {
  await startMuted(page, '/?unlock=w2-01');
  await continuePlaying(page);
  await waitForBoard(page);
  await expect(page.getByText(/The faucet fills a glass to the brim/)).toBeVisible();
  await solveByHints(page);
  await finishSolve(page);
});
