import { expect, test } from '@playwright/test';
import { continuePlaying, finishSolve, flushed, solveByHints, startMuted, waitForBoard } from './helpers';

test('the install prompt appears after the first solve of level 5, (FR-34)', async ({ page }) => {
  await startMuted(page, '/?unlock=w1-05');
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(event, { prompt: async () => {}, userChoice: Promise.resolve({ outcome: 'dismissed' }) });
    window.dispatchEvent(event);
  });
  await continuePlaying(page);
  await waitForBoard(page);
  await solveByHints(page);
  await finishSolve(page);
  await page.getByRole('button', { name: 'Next' }).click();

  const prompt = page.getByRole('dialog', { name: 'Add Clink to your home screen' });
  await expect(prompt).toBeVisible();
  await prompt.getByRole('button', { name: 'Not now' }).click();
  await expect(page).toHaveURL(/\/play\/w1-06$/);
});

test('no install prompt is shown when the browser cannot install the app', async ({ page }) => {
  await startMuted(page, '/?unlock=w1-05');
  await continuePlaying(page);
  await waitForBoard(page);
  await solveByHints(page);
  await finishSolve(page);
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page).toHaveURL(/\/play\/w1-06$/);
  await expect(page.getByRole('dialog', { name: 'Add Clink to your home screen' })).toHaveCount(0);
});

test('the one-question survey follows level 10 (D19)', async ({ page }) => {
  await startMuted(page, '/?analytics=memory&unlock=w1-10');
  await continuePlaying(page);
  await waitForBoard(page);
  await solveByHints(page);
  await finishSolve(page);
  await page.getByRole('button', { name: 'Next' }).click();

  const survey = page.getByRole('dialog', { name: 'How would you feel if you could no longer play Clink?' });
  await expect(survey).toBeVisible();
  await survey.getByRole('button', { name: 'Very disappointed' }).click();
  await expect(page).toHaveURL(/\/play\/w1-11$/);

  const answer = (await flushed(page)).find((event) => event.name === 'survey_answer');
  expect(answer?.props).toMatchObject({ answer: 'very' });
});
