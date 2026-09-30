import { expect, test } from '@playwright/test';
import { continuePlaying, flushed, pour, waitForBoard } from './helpers';

const APPENDIX_A: [number, number][] = [
  [2, 1],
  [1, 0],
  [0, 2],
  [1, 0],
  [2, 1],
];

test('a scripted session sends its events in order (FR-36)', async ({ page }) => {
  await page.goto('/?analytics=memory&unlock=w1-08');
  await page.getByRole('button', { name: 'Play muted' }).click();
  await continuePlaying(page);
  await waitForBoard(page);

  for (const [i, [from, to]] of APPENDIX_A.entries()) await pour(page, from, to, i + 1);
  await page.getByRole('button', { name: 'Skip' }).click({ timeout: 10_000 });
  await expect(page.getByRole('dialog', { name: 'Tuned!' })).toBeVisible();

  const events = await flushed(page);
  const names = events.map((event) => event.name).filter((name) => name !== 'audio_state');
  expect(names).toEqual([
    'session_start',
    'setting_change',
    'level_start',
    'move',
    'move',
    'move',
    'move',
    'move',
    'level_tuned',
    'level_complete',
  ]);
  const seqs = events.map((event) => event.seq);
  expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
  expect(events.find((e) => e.name === 'level_tuned')?.props).toMatchObject({
    level_id: 'w1-08',
    moves: 5,
    par: 5,
  });
  expect(events.find((e) => e.name === 'level_complete')?.props).toMatchObject({ stars: 3, song: 'skipped' });
  expect(events.filter((e) => e.name === 'move').map((e) => (e.props as { from: string }).from)).toEqual([
    'C',
    'B',
    'A',
    'B',
    'C',
  ]);
});

test('a forced test error is reported with its message (FR-37)', async ({ page }) => {
  await page.goto('/?analytics=memory&debug=throw');
  await page.waitForTimeout(1500);
  const events = await flushed(page);
  const error = events.find((event) => event.name === 'error');
  expect(error?.props).toMatchObject({ message: 'clink test error' });
});
