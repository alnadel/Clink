import { expect, test } from '@playwright/test';
import { finishSolve, flushed, solveByHints, startMuted, waitForBoard } from './helpers';

// The schedule launches on 2026-11-30 (content/schedule.json); the test picks the third day.
const DAY_3 = new Date(2026, 11, 2, 12, 0, 0);

test('before launch there is no daily puzzle', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 8, 30, 12, 0, 0));
  await startMuted(page);
  await page.goto('/daily');
  await expect(page.getByText('No puzzle today. Come back tomorrow!')).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('link', { name: /^Daily #/ })).toHaveCount(0);
});

test('the daily can be solved, shared and starts a streak', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.clock.setFixedTime(DAY_3);
  await startMuted(page, '/?analytics=memory&unlock=w1-02');
  await page.getByRole('link', { name: 'Daily #3' }).click();
  await waitForBoard(page);
  await expect(page.getByText('Daily #3')).toBeVisible();

  await solveByHints(page);
  await finishSolve(page);
  await page.getByRole('button', { name: 'Share' }).click();
  const shared = await page.evaluate(() => navigator.clipboard.readText());
  expect(shared).toMatch(/^Clink #3 ⭐+\n💧+ \d+\/\d+\nhttp.*\/d\/3\?src=share$/u);

  const names = (await flushed(page)).map((e) => e.name);
  expect(names).toContain('level_complete');
  expect(names).toContain('share_complete');

  await page.goto('/');
  await expect(page.getByText('1-day streak')).toBeVisible();
});
