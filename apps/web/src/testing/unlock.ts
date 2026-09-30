import type { Progress } from '../save/types';

/**
 * Test-only: marks levels solved so a test can open a later level without playing the ones before it.
 * `all` solves everything; a level id solves every level before it, leaving that level open.
 */
export function unlockProgress(progress: Progress, levelOrder: readonly string[], until: string): Progress {
  const levels = { ...progress.levels };
  for (const id of levelOrder) {
    if (until !== 'all' && id === until) break;
    levels[id] ??= { stars: 3, bestMoves: 1, solvedAt: '2026-01-01T00:00:00.000Z' };
  }
  return { ...progress, levels };
}
