import type { ScheduleFile } from '@clink/rules';
import type { LocalDate } from './types';
export function parseLocalDate(text: string): LocalDate {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) throw new RangeError(text);
  const year = Number(m[1]),
    month = Number(m[2]),
    day = Number(m[3]);
  const t = new Date(Date.UTC(year, month - 1, day));
  if (t.getUTCFullYear() !== year || t.getUTCMonth() !== month - 1 || t.getUTCDate() !== day)
    throw new RangeError(text);
  return { year, month, day };
}
export function formatLocalDate(d: LocalDate): string {
  return `${String(d.year).padStart(4, '0')}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
}
export function localDateOf(i: Date): LocalDate {
  return { year: i.getFullYear(), month: i.getMonth() + 1, day: i.getDate() };
}
const utc = (d: LocalDate) => Date.UTC(d.year, d.month - 1, d.day);
export function daysBetween(a: LocalDate, b: LocalDate): number {
  return Math.round((utc(b) - utc(a)) / 86400000);
}
export function addDays(d: LocalDate, n: number): LocalDate {
  const t = new Date(utc(d) + n * 86400000);
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() };
}
export function puzzleNumber(today: LocalDate, launch: LocalDate): number {
  return daysBetween(launch, today) + 1;
}
export function dailyLevelId(n: number, s: ScheduleFile, o: Readonly<Record<string, string>>): string | null {
  if (n < 1) return null;
  const ov = o[String(n)];
  if (ov) return ov;
  if (s.puzzles.length === 0) return null;
  return s.puzzles[(n - 1) % s.puzzles.length] ?? null;
}
