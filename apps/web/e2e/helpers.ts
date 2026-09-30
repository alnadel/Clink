import type { Page } from '@playwright/test';

/** Waits until the board exists and the browser has painted a couple of frames. */
export async function waitForBoard(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__clink?.snapshot?.() != null);
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );
}

async function click(page: Page, index: number): Promise<void> {
  const point = await page.evaluate((i) => window.__clink?.glassCenter?.(i), index);
  if (!point) throw new Error('the board is not ready');
  await page.mouse.click(point.x, point.y);
}

/**
 * Taps a glass and waits until the game registered it (selected, or a move happened). Headless Chromium can
 * lose a click that arrives before its first compositor frame, so a missed tap is retried a few times.
 */
export async function tapGlass(page: Page, index: number): Promise<void> {
  const before = await page.evaluate(() => {
    const s = window.__clink?.snapshot?.();
    return { moves: s?.moves ?? 0, selected: s?.selected ?? null, tuned: s?.tuned ?? false };
  });
  for (let attempt = 0; attempt < 4; attempt++) {
    await click(page, index);
    try {
      await page.waitForFunction(
        (b) => {
          const s = window.__clink?.snapshot?.();
          return !!s && (s.moves !== b.moves || s.selected !== b.selected || s.tuned !== b.tuned);
        },
        before,
        { timeout: 600 },
      );
      return;
    } catch {
      // not registered yet: click again
    }
  }
  throw new Error(`tap on glass ${index} was never registered`);
}

/** Pours one glass into another and waits for the move counter. */
export async function pour(page: Page, from: number, to: number, expectMoves: number): Promise<void> {
  await tapGlass(page, from);
  await tapGlass(page, to);
  await page.waitForFunction((n) => window.__clink?.snapshot?.()?.moves === n, expectMoves);
}

/** Taps the faucet or the sink on the board (a glass must be selected first). */
export async function tapTool(page: Page, tool: 'faucet' | 'sink'): Promise<void> {
  const before = await page.evaluate(() => window.__clink?.snapshot?.()?.moves ?? 0);
  for (let attempt = 0; attempt < 4; attempt++) {
    const point = await page.evaluate((name) => window.__clink?.toolCenter?.(name), tool);
    if (!point) throw new Error('the board is not ready');
    await page.mouse.click(point.x, point.y);
    try {
      await page.waitForFunction((n) => (window.__clink?.snapshot?.()?.moves ?? 0) !== n, before, {
        timeout: 600,
      });
      return;
    } catch {
      // not registered yet: click again
    }
  }
  throw new Error(`tap on the ${tool} was never registered`);
}

/**
 * Solves the open level by playing the solver's hints, one move at a time, through real taps.
 * Returns the number of moves played. Uses the test hook rather than the Hint button, so the
 * result still counts as unhinted.
 */
export async function solveByHints(page: Page): Promise<number> {
  for (let guard = 0; guard < 60; guard++) {
    const snap = await page.evaluate(() => window.__clink?.snapshot?.());
    if (snap?.tuned) return snap.moves;
    const hint = await page.evaluate(() => window.__clink?.hint?.());
    if (!snap || !hint || hint.type !== 'move') throw new Error(`no move to play: ${JSON.stringify(hint)}`);
    const { move } = hint;
    if (move.type === 'pour') {
      await tapGlass(page, move.from);
      await tapGlass(page, move.to);
    } else {
      await tapGlass(page, move.glass);
      await tapTool(page, move.type);
    }
    await page.waitForFunction((n) => (window.__clink?.snapshot?.()?.moves ?? 0) > n, snap.moves);
  }
  throw new Error('the level was not solved in 60 moves');
}

/** Chooses "Play muted" on a first launch and waits for the board of the level it opens. */
export async function startMuted(page: Page, url = '/'): Promise<void> {
  await page.goto(url);
  await page.getByRole('button', { name: 'Play muted' }).click();
}

/** Opens the next open level from the home screen, the way a player continues. */
export async function continuePlaying(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'Continue' }).click();
}

/** Skips the song that plays after a solve, if it is still playing, and waits for the solve card. */
export async function finishSolve(page: Page): Promise<void> {
  const skip = page.getByRole('button', { name: 'Skip' });
  const card = page.getByRole('dialog', { name: 'Tuned!' });
  await skip.or(card).first().waitFor({ timeout: 15_000 });
  if (await skip.isVisible()) await skip.click();
  await card.waitFor({ timeout: 15_000 });
}

/** Sends the queued analytics events now and returns everything the in-memory adapter has received. */
export async function flushed(page: Page) {
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await page.waitForTimeout(200);
  return page.evaluate(() => window.__clink?.events?.() ?? []);
}
