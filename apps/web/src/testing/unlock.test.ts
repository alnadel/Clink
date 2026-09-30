import { describe, expect, it } from 'vitest';
import type { Progress } from '../save/types';
import { unlockProgress } from './unlock';

const empty: Progress = { schema: 1, levels: {}, dailies: {} };
const order = ['a', 'b', 'c', 'd'];

describe('unlockProgress', () => {
  it('solves every level before the given one', () => {
    expect(Object.keys(unlockProgress(empty, order, 'c').levels)).toEqual(['a', 'b']);
  });

  it('all solves everything', () => {
    expect(Object.keys(unlockProgress(empty, order, 'all').levels)).toEqual(order);
  });

  it('keeps results that already exist', () => {
    const kept = { stars: 1 as const, bestMoves: 9, solvedAt: 'x' };
    const next = unlockProgress({ ...empty, levels: { a: kept } }, order, 'c');
    expect(next.levels.a).toBe(kept);
  });
});
