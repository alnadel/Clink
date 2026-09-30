import {
  applyMove,
  compileLevel,
  explore,
  foundTargets,
  initialState,
  type LevelJson,
  legalMoves,
  type ScaleKind,
  type ToolName,
  type WorldNumber,
} from '@clink/rules';
import { loadContent } from './load';
import { mulberry32, randInt } from './random';

export interface GenerateOptions {
  contentDir: string;
  tune: string;
  phrase: string;
  world: WorldNumber;
  band: string;
  count: number;
  seed: number;
  attempts: number;
}

export interface Candidate {
  level: LevelJson;
  par: number;
  reachable: number;
  optimalSolutions: number;
  /** Moves on the shortest solution after which fewer targets are found (giving a note up, as in Appendix A). */
  backwardSteps: number;
}

export const SCALE_KINDS: Record<string, ScaleKind> = {
  '0,200,400,700,900': 'major-pentatonic',
  '0,200,400,500,700,900,1100': 'major',
};

/**
 * Candidates larger than this are skipped while generating: they make poor levels and are slow to
 * solve. (The checker's hard limit is still 100,000 states.)
 */
const GENERATOR_MAX_STATES = 20_000;
/** Approximate size of the state space a generated setup may have (product of glass capacities plus one). */
const STATE_BUDGET = 4000;

const GLASS_IDS = ['A', 'B', 'C', 'D', 'E'];

/** Identifies a candidate's setup, to drop duplicates. */
export function setupKey(level: LevelJson): string {
  return JSON.stringify([level.glasses, level.tools, level.ice]);
}

/**
 * Proposes solver-proven candidate levels for a tune phrase, a world and a difficulty band.
 * Deterministic for a given seed. Spec: docs/architecture/03-content-pipeline.md §5.
 */
export function generate(options: GenerateOptions): Candidate[] {
  const content = loadContent(options.contentDir);
  const rules = content.bands?.worlds[String(options.world) as '1' | '2' | '3'];
  const tune = content.tunes?.tunes[options.tune];
  const phrase = tune?.phrases.find((p) => p.id === options.phrase);
  if (!rules || !tune || !phrase)
    throw new Error(`unknown tune, phrase or world: ${options.tune}/${options.phrase}/${options.world}`);
  const band = rules.bands.find((b) => b.id === options.band);
  if (!band) throw new Error(`world ${options.world} has no band ${options.band}`);
  const kind = SCALE_KINDS[phrase.scale.stepsCents.join(',')];
  if (!kind || !rules.scales.includes(kind)) {
    throw new Error(
      `world ${options.world} does not allow the ${kind ?? 'custom'} scale used by ${options.phrase}`,
    );
  }

  const baseLevel = (glasses: LevelJson['glasses'], tools: ToolName[], ice: LevelJson['ice']): LevelJson => ({
    schemaVersion: 1,
    id: 'cand',
    world: options.world,
    scale: phrase.scale,
    melody: {
      tuneId: options.tune,
      title: tune.title,
      notes: phrase.notes,
      beats: phrase.beats,
      bpm: phrase.bpm,
    },
    glasses,
    tools,
    ice,
    par: 0,
    optimalSolutions: 0,
  });

  // Probe the scale once for its positions and the phrase's targets.
  const top = phrase.scale.range[1];
  const probe = compileLevel(
    baseLevel(
      GLASS_IDS.map((id) => ({ id, capacity: 2, emptyNote: top, water: 0 })),
      [],
      [],
    ),
  );
  const positions = probe.positions;
  const targets = probe.targets;
  const minGlasses = Math.max(rules.glasses[0], targets.length);
  if (minGlasses > rules.glasses[1]) throw new Error('the phrase needs more glasses than the world allows');

  const rng = mulberry32(options.seed);
  const pool: Candidate[] = [];
  const seen = new Set<string>();
  const wanted = Math.max(options.count * 5, 30);

  for (let attempt = 0; attempt < options.attempts && pool.length < wanted; attempt++) {
    const glassCount = randInt(rng, minGlasses, rules.glasses[1]);
    // Keep the state space small enough to solve: more glasses means smaller glasses.
    const maxCapacity = Math.max(2, Math.min(12, Math.floor(STATE_BUDGET ** (1 / glassCount)) - 1));
    const glasses: LevelJson['glasses'] = [];
    for (let i = 0; i < glassCount; i++) {
      const capacity = randInt(rng, 2, maxCapacity);
      const emptyPos = randInt(rng, capacity, positions.length - 1);
      const water = randInt(rng, 0, capacity);
      glasses.push({ id: GLASS_IDS[i] ?? 'Z', capacity, emptyNote: positions[emptyPos]?.name ?? top, water });
    }
    const tools: ToolName[] = [];
    if (options.world >= 2) {
      for (const tool of rules.tools) if (rng() < 0.5) tools.push(tool);
      if (options.world === 2 && tools.length === 0 && rules.tools.length > 0) {
        tools.push(rules.tools[randInt(rng, 0, rules.tools.length - 1)] as ToolName);
      }
    }
    const iceCount = randInt(rng, rules.ice[0], rules.ice[1]);
    const ice: LevelJson['ice'] = [];
    for (let i = 0; i < iceCount; i++) {
      ice.push({ glass: GLASS_IDS[randInt(rng, 0, glassCount - 1)] ?? 'A', countdown: randInt(rng, 1, 8) });
    }

    // Every target must be a fill line of some glass.
    const reachableTargets = targets.every((target) =>
      glasses.some((glass) => {
        const emptyPos = positions.findIndex((p) => p.name === glass.emptyNote);
        return target <= emptyPos && target >= emptyPos - glass.capacity;
      }),
    );
    if (!reachableTargets) continue;

    const json = baseLevel(glasses, tools, ice);
    let level: ReturnType<typeof compileLevel>;
    try {
      level = compileLevel(json);
    } catch {
      continue;
    }
    if (foundTargets(level, initialState(level)).every(Boolean)) continue;
    const graph = explore(level, { maxStates: GENERATOR_MAX_STATES });
    if (graph.truncated || graph.par === null) continue;
    if (graph.par < band.par[0] || graph.par > band.par[1]) continue;
    const key = setupKey(json);
    if (seen.has(key)) continue;
    seen.add(key);

    pool.push({
      level: { ...json, par: graph.par, optimalSolutions: graph.optimalSolutions },
      par: graph.par,
      reachable: graph.reachable,
      optimalSolutions: graph.optimalSolutions,
      backwardSteps: countBackwardSteps(level, graph),
    });
  }

  pool.sort(
    (a, b) =>
      a.optimalSolutions - b.optimalSolutions ||
      b.backwardSteps - a.backwardSteps ||
      b.reachable - a.reachable,
  );
  return pool.slice(0, options.count).map((candidate, i) => ({
    ...candidate,
    level: { ...candidate.level, id: `cand-${String(i + 1).padStart(2, '0')}` },
  }));
}

function countBackwardSteps(
  level: ReturnType<typeof compileLevel>,
  graph: ReturnType<typeof explore>,
): number {
  let state = initialState(level);
  let found = foundTargets(level, state).filter(Boolean).length;
  let backward = 0;
  // Follow the graph greedily along distance-to-goal, as hints do.
  for (;;) {
    const d = graph.distanceOf(state);
    if (d === null || d === 0) return backward;
    let next: typeof state | null = null;
    for (const move of legalMoves(level, state)) {
      const result = applyMove(level, state, move);
      if (result.ok && graph.distanceOf(result.state) === d - 1) {
        next = result.state;
        break;
      }
    }
    if (!next) return backward;
    const nextFound = foundTargets(level, next).filter(Boolean).length;
    if (nextFound < found) backward++;
    found = nextFound;
    state = next;
  }
}
