import { expect, test } from '@playwright/test';
import { startMuted, waitForBoard } from './helpers';

test('note labels and reduced motion reach the board', async ({ page }) => {
  await startMuted(page, '/?unlock=w1-04');
  await page.goto('/settings');
  await page.getByText('Do Re Mi').click();
  await page.getByText('On', { exact: true }).click();
  await page.goto('/play/w1-04');
  await waitForBoard(page);
  expect(await page.evaluate(() => window.__clink?.boardOptions?.())).toMatchObject({
    labels: 'solfege',
    reducedMotion: true,
  });
});

test('the choices survive a reload', async ({ page }) => {
  await startMuted(page);
  await page.goto('/settings');
  await page.getByText('C D E').click();
  await page.reload();
  await expect(page.getByRole('radio', { name: 'C D E' })).toBeChecked();
});

test('Arabic mirrors the screens but never the board (FR-31)', async ({ page }) => {
  await startMuted(page, '/?unlock=w1-04');
  await page.goto('/settings');
  await page.getByText('العربية').click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');

  await page.goto('/play/w1-04');
  await waitForBoard(page);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByTestId('board')).toHaveAttribute('dir', 'ltr');
  await expect(page.getByRole('button', { name: 'تراجع' })).toBeVisible();
});

test('a restore code moves progress to a fresh browser (FR-33)', async ({ page, browser }) => {
  await startMuted(page, '/?unlock=w1-04');
  await page.goto('/settings');
  const code = (await page.getByTestId('restore-code').textContent())?.trim() ?? '';
  expect(code).not.toBe('');

  const baseURL = test.info().project.use.baseURL;
  const fresh = await browser.newContext({ baseURL, serviceWorkers: 'block' });
  const other = await fresh.newPage();
  await startMuted(other);
  await other.goto('/settings');
  await other.getByPlaceholder('Paste your code').fill(code);
  await other.getByRole('button', { name: 'Check code' }).click();
  await expect(other.getByText('3 levels and 0 daily puzzles found.')).toBeVisible();
  await other.getByRole('button', { name: 'Restore' }).click();

  await other.goto('/map');
  await expect(other.getByRole('link', { name: 'Level 3, 3 stars' })).toBeVisible();
  await expect(other.getByRole('link', { name: 'Level 4', exact: true })).toBeVisible();
  await fresh.close();

  // A mistyped code is refused with a message instead of being half applied.
  const typo = `${code.slice(0, 2)}${code[2] === '7' ? '8' : '7'}${code.slice(3)}`;
  await page.getByPlaceholder('Paste your code').fill(typo);
  await page.getByRole('button', { name: 'Check code' }).click();
  await expect(page.getByText('The code has a typo. Check it and try again.')).toBeVisible();
});
