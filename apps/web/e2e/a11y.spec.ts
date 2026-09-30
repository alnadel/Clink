import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { startMuted, waitForBoard } from './helpers';

/** Automated WCAG 2.1 A and AA checks (NFR-07). They catch a part of the problems; manual review does the rest. */
async function violations(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return result.violations.map((v) => ({
    id: v.id,
    nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
  }));
}

const SCREENS = ['/', '/map', '/settings', '/songbook', '/privacy'];

for (const path of SCREENS) {
  test(`${path} has no detectable accessibility violations`, async ({ page }) => {
    await startMuted(page, '/?unlock=w1-04');
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    expect(await violations(page)).toEqual([]);
  });
}

test('the play screen and the sound choice have no detectable violations', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('dialog', { name: 'How do you want to play?' })).toBeVisible();
  expect(await violations(page)).toEqual([]);

  await page.getByRole('button', { name: 'Play muted' }).click();
  await waitForBoard(page);
  expect(await violations(page)).toEqual([]);
});

test('Arabic screens have no detectable violations', async ({ page }) => {
  await startMuted(page, '/?unlock=w1-04');
  await page.goto('/settings');
  await page.getByText('العربية').click();
  await page.goto('/map');
  expect(await violations(page)).toEqual([]);
});
