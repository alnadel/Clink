import { describe, expect, it } from 'vitest';
import {
  mergeRestoreData,
  progressToRestoreData,
  RESTORE_LEVEL_SLOTS,
  type RestoreData,
} from './restore-code';
import { DEFAULT_SETTINGS, type Progress } from './types';

const ORDER = ['w1-01', 'w1-02', 'w1-03'];
const empty: Progress = { schema: 1, levels: {}, dailies: {} };

describe('progressToRestoreData', () => {
  it('places stars by level order and runs dailies to the highest solved puzzle', () => {
    const progress: Progress = {
      schema: 1,
      levels: {
        'w1-02': { stars: 3, bestMoves: 4, solvedAt: 'x' },
        'w1-03': { stars: 1, bestMoves: 9, solvedAt: 'x' },
      },
      dailies: { '3': { moves: 5, par: 5, stars: 2 } },
    };
    const data = progressToRestoreData(progress, ORDER, DEFAULT_SETTINGS);
    expect(data.levelStars).toHaveLength(RESTORE_LEVEL_SLOTS);
    expect(data.levelStars.slice(0, 4)).toEqual([0, 3, 1, 0]);
    expect(data.dailyStars).toEqual([0, 0, 2]);
    expect(data.settings).toBe(DEFAULT_SETTINGS);
  });

  it('is empty for empty progress', () => {
    const data = progressToRestoreData(empty, ORDER, DEFAULT_SETTINGS);
    expect(data.levelStars.every((s) => s === 0)).toBe(true);
    expect(data.dailyStars).toEqual([]);
  });
});

describe('mergeRestoreData', () => {
  const data: RestoreData = {
    levelStars: [3, 1, 0, ...Array<0>(57).fill(0)],
    dailyStars: [2, 0, 3],
    settings: DEFAULT_SETTINGS,
  };

  it('keeps the higher stars per level', () => {
    const progress: Progress = {
      ...empty,
      levels: {
        'w1-01': { stars: 2, bestMoves: 6, solvedAt: 'old' },
        'w1-02': { stars: 3, bestMoves: 4, solvedAt: 'old' },
      },
    };
    const merged = mergeRestoreData(progress, data, ORDER, 'now');
    expect(merged.levels['w1-01']).toEqual({ stars: 3, bestMoves: 6, solvedAt: 'old' });
    expect(merged.levels['w1-02']).toEqual({ stars: 3, bestMoves: 4, solvedAt: 'old' });
    expect(merged.levels['w1-03']).toBeUndefined();
  });

  it('adds restored dailies without move counts and keeps existing ones', () => {
    const progress: Progress = { ...empty, dailies: { '1': { moves: 6, par: 5, stars: 1 } } };
    const merged = mergeRestoreData(progress, data, ORDER, 'now');
    expect(merged.dailies['1']).toEqual({ moves: 6, par: 5, stars: 2 });
    expect(merged.dailies['2']).toBeUndefined();
    expect(merged.dailies['3']).toEqual({ moves: 0, par: 0, stars: 3 });
  });

  it('does not mutate its input', () => {
    const progress: Progress = { ...empty, levels: { 'w1-01': { stars: 1, bestMoves: 3, solvedAt: 'a' } } };
    mergeRestoreData(progress, data, ORDER, 'now');
    expect(progress.levels['w1-01']?.stars).toBe(1);
  });
});
