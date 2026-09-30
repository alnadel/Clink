import { expect, test } from '@playwright/test';

test('a fresh player chooses sound, lands in the first level, and is not asked again', async ({ page }) => {
  await page.goto('/');
  const dialog = page.getByRole('dialog', { name: 'How do you want to play?' });
  await expect(dialog).toBeVisible();

  await page.getByRole('button', { name: 'Play muted' }).click();
  await expect(page).toHaveURL(/\/play\/w1-01$/);
  await expect(dialog).toBeHidden();

  await page.reload();
  await expect(page).toHaveURL(/\/play\/w1-01$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('the e2e build exposes the test hook', async ({ page }) => {
  await page.goto('/');
  expect(await page.evaluate(() => typeof window.__clink)).toBe('object');
});

test('unknown paths show the not-found screen', async ({ page }) => {
  await page.goto('/nowhere');
  await expect(page.locator('[data-screen="notfound"]')).toBeAttached();
});
