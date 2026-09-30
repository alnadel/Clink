import { expect, type Page, test } from '@playwright/test';
import { pour, tapGlass, waitForBoard } from './helpers';

/** Appendix A: C into B, B into A, A into C, B into A, C into B (glass indices 2>1, 1>0, 0>2, 1>0, 2>1). */
const APPENDIX_A: [number, number][] = [
  [2, 1],
  [1, 0],
  [0, 2],
  [1, 0],
  [2, 1],
];

async function open(page: Page, path = '/play/w1-08') {
  await page.goto('/');
  await page.getByRole('button', { name: 'Play muted' }).click();
  await page.goto(path);
  await waitForBoard(page);
}

const snapshot = (page: Page) => page.evaluate(() => window.__clink?.snapshot?.());

test('Appendix A tunes on the fifth move and locks the board', async ({ page }) => {
  await open(page);
  expect(await snapshot(page)).toMatchObject({ moves: 0, tuned: false, state: { water: [0, 0, 9] } });
  for (const [i, [from, to]] of APPENDIX_A.entries()) await pour(page, from, to, i + 1);
  await page.waitForFunction(() => window.__clink?.snapshot?.()?.tuned === true);
  expect(await snapshot(page)).toMatchObject({ moves: 5, tuned: true, state: { water: [1, 5, 3] } });
});

test('a refused pour costs no move', async ({ page }) => {
  await open(page);
  await tapGlass(page, 0); // glass A is empty
  await tapGlass(page, 1);
  await page.waitForTimeout(400);
  expect(await snapshot(page)).toMatchObject({ moves: 0, selected: null });
});

test('undo restores the exact earlier state', async ({ page }) => {
  await open(page);
  await pour(page, 2, 1, 1);
  await page.getByRole('button', { name: 'Undo' }).click();
  await page.waitForFunction(() => window.__clink?.snapshot?.()?.moves === 0);
  expect(await snapshot(page)).toMatchObject({ state: { water: [0, 0, 9] }, canUndo: false });
});

test('closing the tab mid-level and reopening resumes the same state (FR-32)', async ({ page }) => {
  await open(page);
  await pour(page, 2, 1, 1);
  await pour(page, 1, 0, 2);
  await page.reload();
  await waitForBoard(page);
  expect(await snapshot(page)).toMatchObject({ moves: 2, state: { water: [4, 1, 4] } });
});

test('the first hint is the first move of the shortest solution', async ({ page }) => {
  await open(page);
  const hintButton = page.getByRole('button', { name: 'Hint' });
  await expect(hintButton).toBeEnabled();
  expect(await page.evaluate(() => window.__clink?.hint?.())).toEqual({
    type: 'move',
    move: { type: 'pour', from: 2, to: 1 },
  });
});

test('solving shows the song, then a card with three stars', async ({ page }) => {
  await open(page);
  for (const [i, [from, to]] of APPENDIX_A.entries()) await pour(page, from, to, i + 1);
  await page.getByRole('button', { name: 'Skip' }).click({ timeout: 10_000 });
  const card = page.getByRole('dialog', { name: 'Tuned!' });
  await expect(card).toBeVisible();
  await expect(card).toContainText('5 moves · par 5');
  await expect(card).toContainText('Mary Had a Little Lamb');
  await expect(card.getByRole('img', { name: '3 / 3' })).toBeVisible();
});

test('using a hint caps the solve at two stars', async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.__clink?.hint?.());
  await page.getByRole('button', { name: 'Hint' }).click();
  for (const [i, [from, to]] of APPENDIX_A.entries()) await pour(page, from, to, i + 1);
  await page.getByRole('button', { name: 'Skip' }).click({ timeout: 10_000 });
  await expect(
    page.getByRole('dialog', { name: 'Tuned!' }).getByRole('img', { name: '2 / 3' }),
  ).toBeVisible();
});
