import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { finishSolve, solveByHints, startMuted, waitForBoard } from './helpers';

// A slow soak: every campaign level and every daily is played to the end with real taps, following the
// solver's hints. Run it with `pnpm test:e2e:full` (E2E_FULL=1); the normal suite skips it.
const CONTENT = join(import.meta.dirname, '..', '..', '..', 'content');
const WORLD_NAMES: Record<string, string> = {
  '1': 'Kitchen Table',
  '2': 'Café Counter',
  '3': 'Winter Window',
};
const LAUNCH = new Date(2026, 10, 30, 12, 0, 0);

interface LevelFile {
  id: string;
  par: number;
}

function levelFiles(dir: string): LevelFile[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => JSON.parse(readFileSync(join(dir, name), 'utf8')) as LevelFile);
}

async function openCampaignLevel(page: Page, id: string): Promise<void> {
  const [, world = '', number = ''] = /^w(\d)-(\d+)$/.exec(id) ?? [];
  await page.getByRole('link', { name: 'Levels' }).click();
  await page
    .getByRole('region', { name: WORLD_NAMES[world] })
    .getByRole('link', { name: new RegExp(`^Level ${Number(number)}, `) })
    .click();
  await waitForBoard(page);
}

if (process.env.E2E_FULL === '1') {
  test.describe.configure({ timeout: 90_000 });

  for (const world of ['w1', 'w2', 'w3']) {
    for (const level of levelFiles(join(CONTENT, 'levels', world))) {
      test(`campaign ${level.id} is solved in ${level.par} moves`, async ({ page }) => {
        await startMuted(page, '/?unlock=all');
        await openCampaignLevel(page, level.id);
        expect(await solveByHints(page)).toBe(level.par);
        await finishSolve(page);
      });
    }
  }

  levelFiles(join(CONTENT, 'daily')).forEach((level, index) => {
    test(`daily ${level.id} is solved in ${level.par} moves`, async ({ page }) => {
      await page.clock.setFixedTime(new Date(LAUNCH.getTime() + index * 86_400_000));
      await startMuted(page, '/?unlock=w1-02');
      await page.getByRole('link', { name: `Daily #${index + 1}` }).click();
      await waitForBoard(page);
      expect(await solveByHints(page)).toBe(level.par);
      await finishSolve(page);
    });
  });
}
