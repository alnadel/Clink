import type { ScheduleFile } from '@clink/rules';
import { describe, expect, it } from 'vitest';
import { todaysPuzzle } from './today';

const schedule: ScheduleFile = { schemaVersion: 1, launchDate: '2026-11-30', puzzles: ['d001', 'd002'] };

describe('todaysPuzzle', () => {
  it('launch day is puzzle 1, using local time', () => {
    expect(todaysPuzzle(new Date(2026, 10, 30, 0, 5), schedule, {})).toEqual({
      puzzleNo: 1,
      levelId: 'd001',
    });
    expect(todaysPuzzle(new Date(2026, 10, 30, 23, 55), schedule, {})).toEqual({
      puzzleNo: 1,
      levelId: 'd001',
    });
    expect(todaysPuzzle(new Date(2026, 11, 1, 9), schedule, {})).toEqual({ puzzleNo: 2, levelId: 'd002' });
  });

  it('wraps around when the schedule runs out (D16)', () => {
    expect(todaysPuzzle(new Date(2026, 11, 2, 9), schedule, {})?.levelId).toBe('d001');
  });

  it('remote overrides win', () => {
    expect(todaysPuzzle(new Date(2026, 11, 1), schedule, { '2': 'd050' })?.levelId).toBe('d050');
  });

  it('is null before launch or with nothing scheduled', () => {
    expect(todaysPuzzle(new Date(2026, 10, 29), schedule, {})).toBeNull();
    expect(todaysPuzzle(new Date(2026, 11, 1), { ...schedule, puzzles: [] }, {})).toBeNull();
  });
});
