/**
 * Local calendar dates and puzzle numbers (rule 17, FR-21).
 * Spec: docs/architecture/08-save-daily-share.md §3. All arithmetic uses Date.UTC on
 * calendar fields, so results never depend on time zones or DST.
 */
import type { ScheduleFile } from '@clink/rules';
import { NotImplementedError } from '../lib/not-implemented';
import type { LocalDate } from './types';

/** "2026-11-30" -> { year: 2026, month: 11, day: 30 }. Throws RangeError on anything invalid (e.g. "2026-02-30"). */
export function parseLocalDate(text: string): LocalDate {
  throw new NotImplementedError(`parseLocalDate(${text})`);
}

/** { year: 2026, month: 1, day: 5 } -> "2026-01-05". */
export function formatLocalDate(date: LocalDate): string {
  throw new NotImplementedError(`formatLocalDate(${date.year})`);
}

/** The calendar date of `instant` in the device's local time zone. */
export function localDateOf(instant: Date): LocalDate {
  throw new NotImplementedError(`localDateOf(${instant.getTime()})`);
}

/** Whole days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  throw new NotImplementedError(`daysBetween(${from.year}, ${to.year})`);
}

export function addDays(date: LocalDate, days: number): LocalDate {
  throw new NotImplementedError(`addDays(${date.year}, ${days})`);
}

/** Launch day is puzzle #1. Days before launch give 0 or less. */
export function puzzleNumber(today: LocalDate, launch: LocalDate): number {
  throw new NotImplementedError(`puzzleNumber(${today.year}, ${launch.year})`);
}

/**
 * Daily level id for a puzzle number: dailyOverrides[String(n)] first, else
 * schedule.puzzles[(n - 1) % schedule.puzzles.length] (wraps around, decision D16).
 * Returns null if n < 1 or there is nothing to play.
 */
export function dailyLevelId(
  puzzleNo: number,
  schedule: ScheduleFile,
  overrides: Readonly<Record<string, string>>,
): string | null {
  throw new NotImplementedError(
    `dailyLevelId(${puzzleNo}, ${schedule.puzzles.length}, ${Object.keys(overrides).length})`,
  );
}
