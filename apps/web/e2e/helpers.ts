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
