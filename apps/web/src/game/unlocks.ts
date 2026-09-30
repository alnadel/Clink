import type { Progress } from '../save/types';

export type LevelStatus = 'locked' | 'open' | 'solved';

/**
 * Status of every campaign level (FR-16, D24). Disabled levels are skipped entirely (absent from the
 * result). Walking in order: solved stays solved; the first unsolved level is open; later ones are locked.
 * A solved level after a locked one (restored progress) stays solved.
 */
export function levelStatuses(
  levelOrder: readonly string[],
  disabled: ReadonlySet<string>,
  progress: Progress,
): Map<string, LevelStatus> {
  const statuses = new Map<string, LevelStatus>();
  let openFound = false;
  for (const id of levelOrder) {
    if (disabled.has(id)) continue;
    if (progress.levels[id]) {
      statuses.set(id, 'solved');
    } else if (!openFound) {
      openFound = true;
      statuses.set(id, 'open');
    } else {
      statuses.set(id, 'locked');
    }
  }
  return statuses;
}

/** The level the player should play next (the first open one), or null when everything is solved. */
export function nextLevel(statuses: ReadonlyMap<string, LevelStatus>): string | null {
  for (const [id, status] of statuses) if (status === 'open') return id;
  return null;
}
