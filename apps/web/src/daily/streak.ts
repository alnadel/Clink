/**
 * Daily streak (FR-24): consecutive puzzle numbers solved, ending today, or ending
 * yesterday if today is not solved yet. Spec: docs/architecture/08-save-daily-share.md §5.
 */
import { NotImplementedError } from '../lib/not-implemented';

export function currentStreak(solved: ReadonlySet<number>, todayPuzzleNo: number): number {
  throw new NotImplementedError(`currentStreak(${solved.size}, ${todayPuzzleNo})`);
}
