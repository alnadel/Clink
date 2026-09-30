import type { GuideStep, GuidesFile, Level } from '@clink/rules';

export interface GuideScript {
  scriptId: string;
  steps: readonly GuideStep[];
}

const MECHANICS = ['faucet', 'sink', 'ice'] as const;

/**
 * Which scripts run when a level opens (docs/architecture/05 §8): the level's own script if unseen
 * (preferring the A/B variant `<id>:<variant>`), otherwise an intro for each mechanic not yet seen.
 */
export function selectScripts(
  levelId: string,
  level: Level,
  guides: GuidesFile,
  seenGuides: readonly string[],
  variant: string,
): GuideScript[] {
  const own = guides.levels[`${levelId}:${variant}`] ?? guides.levels[levelId];
  if (own && own.length > 0 && !seenGuides.includes(`level:${levelId}`)) {
    return [{ scriptId: `level:${levelId}`, steps: own }];
  }
  const present: Record<(typeof MECHANICS)[number], boolean> = {
    faucet: level.tools.faucet,
    sink: level.tools.sink,
    ice: level.ice.length > 0,
  };
  const scripts: GuideScript[] = [];
  for (const mechanic of MECHANICS) {
    const steps = guides.intros[mechanic];
    if (present[mechanic] && steps.length > 0 && !seenGuides.includes(`intro:${mechanic}`)) {
      scripts.push({ scriptId: `intro:${mechanic}`, steps });
    }
  }
  return scripts;
}
