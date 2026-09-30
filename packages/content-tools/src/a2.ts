import { generate, SCALE_KINDS, setupKey } from './generate';
import { loadContent } from './load';

export interface A2Row {
  world: number;
  band: string;
  candidates: number;
}

/**
 * Assumption A2 (Gate 2): the generator must find at least 3 distinct valid candidates for every
 * world x band, summed across the tune phrases whose scale that world allows.
 * A world with no fitting phrase reports 0. Spec: docs/architecture/03-content-pipeline.md §5.
 */
export function runA2Check(options: {
  contentDir: string;
  seed: number;
  attempts?: number;
  worlds?: readonly (1 | 2 | 3)[];
}): A2Row[] {
  const content = loadContent(options.contentDir);
  const rows: A2Row[] = [];
  if (!content.bands || !content.tunes) return rows;
  for (const world of options.worlds ?? ([1, 2, 3] as const)) {
    const rules = content.bands.worlds[String(world) as '1' | '2' | '3'];
    for (const band of rules.bands) {
      const seen = new Set<string>();
      for (const [tuneId, tune] of Object.entries(content.tunes.tunes)) {
        for (const phrase of tune.phrases) {
          const kind = SCALE_KINDS[phrase.scale.stepsCents.join(',')];
          if (!kind || !rules.scales.includes(kind)) continue;
          // A phrase the world cannot host (too many distinct notes for its glasses) offers no candidates.
          try {
            const candidates = generate({
              contentDir: options.contentDir,
              tune: tuneId,
              phrase: phrase.id,
              world,
              band: band.id,
              count: 3,
              seed: options.seed,
              attempts: options.attempts ?? 5000,
            });
            for (const candidate of candidates) seen.add(setupKey(candidate.level));
          } catch {
            // no candidates from this phrase
          }
        }
      }
      rows.push({ world, band: band.id, candidates: seen.size });
    }
  }
  return rows;
}
