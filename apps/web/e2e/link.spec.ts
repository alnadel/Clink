import { expect, test } from '@playwright/test';
import { finishSolve, flushed, solveByHints, waitForBoard } from './helpers';

const DAY_3 = new Date(2026, 11, 2, 12, 0, 0);

test('a shared link sends a new player through the tutorial and into the daily (FR-23)', async ({ page }) => {
  await page.clock.setFixedTime(DAY_3);
  await page.goto('/d/3?src=share&analytics=memory');
  await page.getByRole('button', { name: 'Play muted' }).click();

  await expect(page).toHaveURL(/\/play\/w1-01\?tutorial=1$/);
  await waitForBoard(page);
  await solveByHints(page);
  await finishSolve(page);
  await page.getByRole('button', { name: 'Next' }).click();

  await expect(page).toHaveURL(/\/play\/w1-02\?tutorial=1$/);
  await waitForBoard(page);
  await solveByHints(page);
  await finishSolve(page);
  await page.getByRole('button', { name: 'Next' }).click();

  await expect(page).toHaveURL(/\/daily$/);
  await waitForBoard(page);
  const link = (await flushed(page)).find((event) => event.name === 'link_open');
  expect(link?.props).toMatchObject({ puzzle_no: 3, new_device: true });

  // Having finished the tutorial once, the same link now goes straight to the daily.
  await page.goto('/d/3');
  await expect(page).toHaveURL(/\/daily$/);
});
