import type { ScheduleFile } from '@clink/rules';
import { dailyLevelId, localDateOf, parseLocalDate, puzzleNumber } from './dates';

export interface TodaysPuzzle {
  puzzleNo: number;
  levelId: string;
}

/**
 * Today's daily puzzle in the player's local time (rule 17): the number counts from launch day, and the level
 * comes from the schedule (or a remote-config override). Null before launch or with nothing scheduled.
 */
export function todaysPuzzle(
  now: Date,
  schedule: ScheduleFile,
  overrides: Readonly<Record<string, string>>,
): TodaysPuzzle | null {
  const puzzleNo = puzzleNumber(localDateOf(now), parseLocalDate(schedule.launchDate));
  const levelId = dailyLevelId(puzzleNo, schedule, overrides);
  return levelId === null ? null : { puzzleNo, levelId };
}
