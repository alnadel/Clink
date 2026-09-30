import type { ContentManifest, LevelJson } from '@clink/rules';
import { dailyLevelId } from '../daily/dates';
import type { Progress } from '../save/types';

export interface SongbookEntry {
  tuneId: string;
  title: string;
  origin: string;
  /** The lowest-numbered solved level that uses this tune; its phrase is the one played. */
  levelId: string;
}

/** Level ids the player has solved: campaign levels, plus the dailies they solved (FR-17). */
export function solvedLevelIds(
  progress: Progress,
  manifest: ContentManifest,
  dailyOverrides: Readonly<Record<string, string>> = {},
): string[] {
  const ids = new Set(Object.keys(progress.levels));
  for (const puzzleNo of Object.keys(progress.dailies)) {
    const id = dailyLevelId(Number(puzzleNo), manifest.schedule, dailyOverrides);
    if (id) ids.add(id);
  }
  return [...ids].sort();
}

/**
 * Every solved tune once, sorted by title (FR-17). A daily's tune appears only once that daily is solved,
 * so its title is never given away before the solve (FR-25).
 */
export function songbookEntries(
  progress: Progress,
  manifest: ContentManifest,
  levelJsonById: ReadonlyMap<string, LevelJson>,
  dailyOverrides: Readonly<Record<string, string>> = {},
): SongbookEntry[] {
  const byTune = new Map<string, SongbookEntry>();
  for (const levelId of solvedLevelIds(progress, manifest, dailyOverrides)) {
    const tuneId = levelJsonById.get(levelId)?.melody.tuneId;
    const tune = tuneId === undefined ? undefined : manifest.tunes[tuneId];
    if (tuneId === undefined || !tune || byTune.has(tuneId)) continue;
    byTune.set(tuneId, { tuneId, title: tune.title, origin: tune.origin, levelId });
  }
  return [...byTune.values()].sort((a, b) => a.title.localeCompare(b.title));
}
