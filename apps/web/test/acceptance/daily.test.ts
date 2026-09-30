// ACCEPTANCE TEST — owned by the architecture. Only remove `.skip`; never change expectations.
// Spec: docs/architecture/08-save-daily-share.md §3-§5 (rule 17, FR-21, FR-22, FR-24).
import type { ScheduleFile } from '@clink/rules';
import { describe, expect, it } from 'vitest';
import {
  addDays,
  dailyLevelId,
  daysBetween,
  formatLocalDate,
  localDateOf,
  parseLocalDate,
  puzzleNumber,
} from '../../src/daily/dates';
import { shareText, shareUrl } from '../../src/daily/share';
import { currentStreak } from '../../src/daily/streak';

const d = (s: string) => parseLocalDate(s);
const LAUNCH = '2026-11-30';

describe('local dates', () => {
  it('parses and formats', () => {
    expect(d('2026-11-30')).toEqual({ year: 2026, month: 11, day: 30 });
    expect(formatLocalDate({ year: 2027, month: 1, day: 5 })).toBe('2027-01-05');
  });

  it.each(['2026-13-01', '2026-02-30', '2026-2-3', '26-01-01', '', '2026-11-30T00:00'])('rejects %j', (s) => {
    expect(() => parseLocalDate(s)).toThrow(RangeError);
  });

  it('takes the calendar date in local time', () => {
    expect(localDateOf(new Date(2026, 10, 30, 23, 59, 59))).toEqual({ year: 2026, month: 11, day: 30 });
    expect(localDateOf(new Date(2026, 11, 1, 0, 0, 1))).toEqual({ year: 2026, month: 12, day: 1 });
  });

  it('counts days by calendar, not by 24-hour blocks', () => {
    expect(daysBetween(d('2026-11-30'), d('2026-12-01'))).toBe(1);
    expect(daysBetween(d('2026-12-01'), d('2026-11-30'))).toBe(-1);
    expect(daysBetween(d('2027-03-13'), d('2027-03-15'))).toBe(2); // across a DST change
    expect(daysBetween(d('2026-11-30'), d('2027-01-28'))).toBe(59);
    expect(addDays(d('2026-12-31'), 1)).toEqual(d('2027-01-01'));
    expect(addDays(d('2028-02-28'), 1)).toEqual(d('2028-02-29'));
    expect(addDays(d('2027-01-01'), -1)).toEqual(d('2026-12-31'));
  });
});

describe('puzzle numbers (rule 17, FR-21)', () => {
  it('launch day is #1', () => {
    expect(puzzleNumber(d('2026-11-30'), d(LAUNCH))).toBe(1);
    expect(puzzleNumber(d('2026-12-01'), d(LAUNCH))).toBe(2);
    expect(puzzleNumber(d('2027-01-28'), d(LAUNCH))).toBe(60);
    expect(puzzleNumber(d('2026-11-29'), d(LAUNCH))).toBe(0);
  });

  const schedule: ScheduleFile = { schemaVersion: 1, launchDate: LAUNCH, puzzles: ['d001', 'd002', 'd003'] };

  it('maps numbers to levels, with overrides and wrap-around', () => {
    expect(dailyLevelId(1, schedule, {})).toBe('d001');
    expect(dailyLevelId(3, schedule, {})).toBe('d003');
    expect(dailyLevelId(4, schedule, {})).toBe('d001');
    expect(dailyLevelId(2, schedule, { '2': 'd045' })).toBe('d045');
    expect(dailyLevelId(0, schedule, {})).toBeNull();
    expect(dailyLevelId(1, { ...schedule, puzzles: [] }, {})).toBeNull();
    expect(dailyLevelId(1, { ...schedule, puzzles: [] }, { '1': 'd009' })).toBe('d009');
  });
});

describe('share card (FR-22)', () => {
  it('uses one drop per move and shows no board state', () => {
    expect(shareText({ puzzleNo: 42, moves: 6, par: 5, stars: 2, origin: 'https://clink.example' })).toBe(
      'Clink #42 ⭐⭐\n💧💧💧💧💧💧 6/5\nhttps://clink.example/d/42?src=share',
    );
    expect(shareText({ puzzleNo: 1, moves: 3, par: 3, stars: 3, origin: 'https://x.test' })).toBe(
      'Clink #1 ⭐⭐⭐\n💧💧💧 3/3\nhttps://x.test/d/1?src=share',
    );
    expect(shareUrl('https://x.test', 7)).toBe('https://x.test/d/7?src=share');
  });
});

describe('streak (FR-24)', () => {
  it('counts consecutive solved puzzles ending today or yesterday', () => {
    expect(currentStreak(new Set([]), 10)).toBe(0);
    expect(currentStreak(new Set([10]), 10)).toBe(1);
    expect(currentStreak(new Set([8, 9, 10]), 10)).toBe(3);
    expect(currentStreak(new Set([8, 9]), 10)).toBe(2); // today not solved yet: streak still alive
    expect(currentStreak(new Set([7, 8]), 10)).toBe(0); // missed yesterday
    expect(currentStreak(new Set([1, 2, 4, 5]), 5)).toBe(2);
  });
});
