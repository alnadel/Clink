import { join } from 'node:path';
import {
  applyMove,
  compileLevel,
  explore,
  type GuideStep,
  type GuidesFile,
  initialState,
  type LevelJson,
  solutionPath,
  type ToolName,
  type TunePhraseJson,
  type TunesFile,
  type WorldNumber,
} from '@clink/rules';
import { type Candidate, generate, SCALE_KINDS, setupKey } from './generate';
import { readJson, writeJson } from './io';
import { loadContent } from './load';

const PENT = {
  name: 'C major pentatonic',
  tonicHz: 130.81,
  stepsCents: [0, 200, 400, 700, 900],
  range: ['C3', 'A5'] as [string, string],
};
const MAJOR = {
  name: 'C major',
  tonicHz: 130.81,
  stepsCents: [0, 200, 400, 500, 700, 900, 1100],
  range: ['C3', 'A5'] as [string, string],
};

const phrase = (
  id: string,
  scale: typeof PENT,
  notes: string,
  bpm = 100,
  beats?: number[],
): TunePhraseJson => {
  const list = notes.split(' ');
  return { id, scale, notes: list, beats: beats ?? list.map(() => 1), bpm };
};

/** Transcriptions added to content/tunes.json. Recognizable openings, kept short (3-8 notes). */
export const PHRASES: Record<string, TunePhraseJson[]> = {
  'brahms-lullaby': [
    phrase('w1-a', PENT, 'E4 E4 G4', 84, [1, 1, 2]),
    phrase('w2-a', PENT, 'E4 E4 G4 E4 E4 G4', 84, [1, 1, 2, 1, 1, 2]),
  ],
  'frere-jacques': [phrase('w1-a', PENT, 'C4 D4 E4 C4', 108, [1, 1, 1, 1])],
  'row-row-row-your-boat': [
    phrase('w1-a', PENT, 'C4 C4 C4 D4 E4', 96, [1, 1, 0.75, 0.25, 1]),
    phrase('w2-a', PENT, 'C4 C4 C4 D4 E4 E4', 96, [1, 1, 0.75, 0.25, 1, 0.75]),
  ],
  'twinkle-twinkle-little-star': [
    phrase('w1-a', PENT, 'C4 C4 G4 G4 A4'),
    phrase('w2-a', PENT, 'C4 C4 G4 G4 A4 A4'),
    phrase('w2-major-a', MAJOR, 'G4 F4 F4 E4 E4 D4'),
    phrase('w3-a', MAJOR, 'G4 F4 F4 E4 E4 D4 D4 C4'),
  ],
  'mary-had-a-little-lamb': [
    phrase('w1-a', PENT, 'E4 D4 C4 D4 E4'),
    phrase('w2-a', PENT, 'E4 D4 C4 D4 E4 E4'),
  ],
  'morning-mood': [phrase('w1-a', PENT, 'G4 E4 D4 C4 D4', 88), phrase('w2-a', PENT, 'G4 E4 D4 C4 D4 E4', 88)],
  'oh-susanna': [phrase('w1-a', PENT, 'C4 D4 E4 G4 G4', 112), phrase('w2-a', PENT, 'C4 D4 E4 G4 G4 E4', 112)],
  'ode-to-joy': [
    phrase('w2-major-a', MAJOR, 'E4 E4 F4 G4 G4', 108),
    phrase('w3-a', MAJOR, 'E4 E4 F4 G4 G4 F4 E4 D4', 108),
  ],
  'london-bridge': [
    phrase('w2-major-a', MAJOR, 'G4 A4 G4 F4 E4', 104),
    phrase('w3-a', MAJOR, 'G4 A4 G4 F4 E4 F4 G4', 104),
  ],
  'in-the-hall-of-the-mountain-king': [
    phrase('w2-major-a', MAJOR, 'D4 E4 F4 G4 E4', 120),
    phrase('w3-a', MAJOR, 'C4 D4 E4 F4 G4 E4 G4', 120),
  ],
};

interface Slot {
  id: string;
  kind: 'campaign' | 'daily';
  world: WorldNumber;
  band: 'easy' | 'medium' | 'hard';
  /** tune/phrase pairs to draw from, in order. */
  phrases: [string, string][];
  /** Exact tool set required (undefined = any). */
  tools?: ToolName[];
  /** Preferred par within the band (the closest candidate wins). */
  targetPar?: number;
  seed: number;
}

/** Difficulty curve for the 20 levels of a world: gentle start, a breather every fifth level. */
const CURVE: Slot['band'][] = [
  'easy',
  'easy',
  'easy',
  'easy',
  'easy',
  'medium',
  'medium',
  'medium',
  'medium',
  'easy',
  'medium',
  'medium',
  'hard',
  'hard',
  'medium',
  'hard',
  'hard',
  'hard',
  'hard',
  'hard',
];

const W1: [string, string][] = [
  ['brahms-lullaby', 'w1-a'],
  ['frere-jacques', 'w1-a'],
  ['row-row-row-your-boat', 'w1-a'],
  ['twinkle-twinkle-little-star', 'w1-a'],
  ['mary-had-a-little-lamb', 'w1-a'],
  ['morning-mood', 'w1-a'],
  ['oh-susanna', 'w1-a'],
];
const W2_PENT: [string, string][] = [
  ['brahms-lullaby', 'w2-a'],
  ['row-row-row-your-boat', 'w2-a'],
  ['twinkle-twinkle-little-star', 'w2-a'],
  ['mary-had-a-little-lamb', 'w2-a'],
  ['morning-mood', 'w2-a'],
  ['oh-susanna', 'w2-a'],
];
const W2_MAJOR: [string, string][] = [
  ['ode-to-joy', 'w2-major-a'],
  ['london-bridge', 'w2-major-a'],
  ['in-the-hall-of-the-mountain-king', 'w2-major-a'],
  ['twinkle-twinkle-little-star', 'w2-major-a'],
];
const W3: [string, string][] = [
  ['ode-to-joy', 'w3-a'],
  ['london-bridge', 'w3-a'],
  ['in-the-hall-of-the-mountain-king', 'w3-a'],
  ['twinkle-twinkle-little-star', 'w3-a'],
];

const pick = <T>(list: readonly T[], i: number): T => list[i % list.length] as T;

/** The 60 campaign slots. w1-08 is BRD Appendix A and is kept as written. */
export function planCampaign(): Slot[] {
  const slots: Slot[] = [];
  for (let n = 1; n <= 20; n++) {
    const id = `w1-${String(n).padStart(2, '0')}`;
    slots.push({
      id,
      kind: 'campaign',
      world: 1,
      band: CURVE[n - 1] ?? 'easy',
      phrases: [pick(W1, n - 1)],
      // The first three levels teach with a single pour; later easy levels take two moves.
      targetPar: n <= 3 ? 1 : 2,
      seed: 100 + n,
    });
  }
  for (let n = 1; n <= 20; n++) {
    const id = `w2-${String(n).padStart(2, '0')}`;
    // Level 1 introduces the faucet alone, level 2 the sink alone; later levels may use both.
    const tools: ToolName[] | undefined = n === 1 ? ['faucet'] : n === 2 ? ['sink'] : undefined;
    const source = n <= 10 ? W2_PENT : W2_MAJOR;
    slots.push({
      id,
      kind: 'campaign',
      world: 2,
      band: CURVE[n - 1] ?? 'easy',
      phrases: [pick(source, n)],
      tools,
      seed: 200 + n,
    });
  }
  for (let n = 1; n <= 20; n++) {
    const id = `w3-${String(n).padStart(2, '0')}`;
    slots.push({
      id,
      kind: 'campaign',
      world: 3,
      band: CURVE[n - 1] ?? 'easy',
      phrases: [pick(W3, n)],
      seed: 300 + n,
    });
  }
  return slots;
}

/** 60 daily puzzles: mostly World 1-2 mechanics, some ice, at medium to hard difficulty. */
export function planDaily(): Slot[] {
  const worlds: WorldNumber[] = [1, 2, 1, 3, 2];
  const bands: Slot['band'][] = ['medium', 'hard', 'medium'];
  const slots: Slot[] = [];
  for (let n = 1; n <= 60; n++) {
    const world = worlds[(n - 1) % worlds.length] as WorldNumber;
    const pool = world === 1 ? W1 : world === 2 ? [...W2_PENT, ...W2_MAJOR] : W3;
    slots.push({
      id: `d${String(n).padStart(3, '0')}`,
      kind: 'daily',
      world,
      band: bands[(n - 1) % bands.length] as Slot['band'],
      phrases: [pick(pool, n * 3)],
      seed: 500 + n,
    });
  }
  return slots;
}

const sameTools = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((tool) => b.includes(tool));

/**
 * Picks a candidate. Easy levels take the par closest to `targetPar` (then the smallest state space);
 * medium and hard levels take the generator's ranking (few optimal solutions, lots of giving up notes).
 */
function choose(candidates: Candidate[], slot: Slot): Candidate | undefined {
  if (slot.band !== 'easy') return candidates[0];
  const target = slot.targetPar ?? 1;
  return [...candidates].sort(
    (a, b) => Math.abs(a.par - target) - Math.abs(b.par - target) || a.reachable - b.reachable,
  )[0];
}

export interface SeedOptions {
  contentDir: string;
  log?: (line: string) => void;
  /** Only slots whose id starts with one of these prefixes (all by default). */
  only?: string[];
}

/** Merges the phrase transcriptions into content/tunes.json, keeping titles, origins and rights. */
export function seedTunes(contentDir: string): void {
  const file = join(contentDir, 'tunes.json');
  const tunes = readJson(file) as TunesFile;
  for (const [tuneId, phrases] of Object.entries(PHRASES)) {
    const tune = tunes.tunes[tuneId];
    if (!tune) throw new Error(`unknown tune ${tuneId}`);
    const existing = tune.phrases.filter((p) => !phrases.some((next) => next.id === p.id));
    tune.phrases = [...existing, ...phrases];
  }
  writeJson(file, tunes);
}

interface Attempt {
  tune: string;
  phrase: string;
  band: Slot['band'];
  /** A single quick search (fallbacks are not worth a long one). */
  quick: boolean;
}

const BELOW: Record<Slot['band'], Slot['band'][]> = { hard: ['medium', 'easy'], medium: ['easy'], easy: [] };

/**
 * The searches to try for a slot, in order: the planned phrase, then the same phrase at each easier band,
 * then the other phrases of the world at the easiest band tried. (Bands above the generator's reach, such
 * as World 3 hard, would otherwise burn a long search per phrase before giving in.)
 */
function alternatives(slot: Slot): Attempt[] {
  const [tune, phrase] = pick(slot.phrases, 0);
  const pool = slot.world === 1 ? W1 : slot.world === 2 ? [...W2_PENT, ...W2_MAJOR] : W3;
  const lower = BELOW[slot.band];
  const list: Attempt[] = [{ tune, phrase, band: slot.band, quick: false }];
  for (const band of lower) list.push({ tune, phrase, band, quick: band !== 'easy' });
  const last = lower.at(-1) ?? slot.band;
  for (const [otherTune, otherPhrase] of pool) {
    if (otherTune !== tune || otherPhrase !== phrase)
      list.push({ tune: otherTune, phrase: otherPhrase, band: last, quick: true });
  }
  return list;
}

/** Writes proven levels for every slot that has no file yet. Deterministic. */
export function seedLevels(options: SeedOptions): void {
  const log = options.log ?? (() => {});
  const content = loadContent(options.contentDir);
  const used = new Set<string>();
  for (const level of content.levels) {
    if (level.json) used.add(setupKey(level.json as LevelJson));
  }
  const existingIds = new Set(content.levels.map((l) => (l.json as { id?: string } | null)?.id));

  for (const slot of [...planCampaign(), ...planDaily()]) {
    if (options.only && !options.only.some((prefix) => slot.id.startsWith(prefix))) continue;
    if (existingIds.has(slot.id)) continue;
    const started = Date.now();
    let chosen: Candidate | undefined;
    let usedSearch = '';
    // The planned phrase first; when the generator finds nothing, other phrases of the world, and then
    // the next easier band, so that every slot ends up with a level.
    for (const attempt of alternatives(slot)) {
      let candidates: Candidate[] = [];
      try {
        // Harder bands rarely have candidates; a long search there costs more than falling back.
        for (const attempts of attempt.band === 'easy' && !attempt.quick ? [3000, 12000] : [3000]) {
          candidates = generate({
            contentDir: options.contentDir,
            tune: attempt.tune,
            phrase: attempt.phrase,
            world: slot.world,
            band: attempt.band,
            count: 30,
            seed: slot.seed,
            attempts,
          }).filter(
            (c) => !used.has(setupKey(c.level)) && (!slot.tools || sameTools(c.level.tools, slot.tools)),
          );
          if (candidates.length > 0 || attempt.quick) break;
        }
      } catch (error) {
        log(`${slot.id}: FAILED ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }
      chosen = choose(candidates, { ...slot, band: attempt.band });
      if (chosen) {
        usedSearch = `${attempt.tune} ${attempt.band}`;
        break;
      }
      log(`${slot.id}: NO CANDIDATE (${attempt.tune}/${attempt.phrase} world ${slot.world} ${attempt.band})`);
    }
    if (!chosen) continue;
    used.add(setupKey(chosen.level));
    const dir = slot.kind === 'daily' ? 'daily' : join('levels', `w${slot.world}`);
    writeJson(join(options.contentDir, dir, `${slot.id}.json`), { ...chosen.level, id: slot.id });
    log(
      `${slot.id}: ${usedSearch} par ${chosen.par} reach ${chosen.reachable} opt ${chosen.optimalSolutions} (${Date.now() - started} ms)`,
    );
  }
}

// --- onboarding guides ----------------------------------------------------------------------------

const step = (
  id: string,
  textKey: string | null,
  until: GuideStep['until'],
  extra: Partial<GuideStep> = {},
): GuideStep => ({ id, textKey, until, ...extra });

/** Guide scripts for levels 1-3 (built from each level's own solution) and the mechanic intros. */
export function buildGuides(contentDir: string): GuidesFile {
  const content = loadContent(contentDir);
  const levels: GuidesFile['levels'] = {};
  const first = (id: string) => {
    const file = content.levels.find((l) => (l.json as { id?: string } | null)?.id === id);
    if (!file?.json) throw new Error(`${id} is missing`);
    const level = compileLevel(file.json as LevelJson);
    const moves = solutionPath(level, explore(level));
    const move = moves[0];
    let state = initialState(level);
    const result = move && applyMove(level, state, move);
    if (result?.ok) state = result.state;
    return { level, move };
  };

  const one = first('w1-01').move;
  if (one?.type === 'pour') {
    levels['w1-01'] = [
      step(
        'listen',
        'guide.listen',
        { on: 'ring', glass: one.from },
        { highlight: { glass: one.from }, allow: { glasses: [one.from] } },
      ),
      step(
        'pour',
        'guide.pour',
        { on: 'pour', from: one.from, to: one.to },
        { highlight: { glass: one.to }, allow: { glasses: [one.from, one.to] } },
      ),
      step('tuned', 'guide.tuned', { on: 'tuned' }),
    ];
  }
  levels['w1-02'] = [
    step('melody', 'guide.melody', { on: 'melody' }, { highlight: { melody: true } }),
    step('goal', 'guide.goal', { on: 'found' }),
    step('tuned', null, { on: 'tuned' }),
  ];
  levels['w1-03'] = [
    step('found', 'guide.found', { on: 'found' }),
    step('giveUp', 'guide.giveUp', { on: 'tuned' }),
  ];

  return {
    schemaVersion: 1,
    levels,
    intros: {
      faucet: [step('faucet', 'guide.faucet', { on: 'tap' }, { highlight: { tool: 'faucet' } })],
      sink: [step('sink', 'guide.sink', { on: 'tap' }, { highlight: { tool: 'sink' } })],
      ice: [step('ice', 'guide.ice', { on: 'tap' })],
    },
    linkTutorial: ['w1-01', 'w1-02'],
  };
}

export function seedGuides(contentDir: string): void {
  writeJson(join(contentDir, 'guides.json'), buildGuides(contentDir));
}

/** Points schedule.json at the daily files that exist, in order. */
export function seedSchedule(contentDir: string): void {
  const file = join(contentDir, 'schedule.json');
  const schedule = readJson(file) as { puzzles: string[] };
  const existing = new Set(
    loadContent(contentDir)
      .levels.filter((l) => l.kind === 'daily')
      .map((l) => (l.json as { id?: string } | null)?.id),
  );
  schedule.puzzles = planDaily()
    .map((slot) => slot.id)
    .filter((id) => existing.has(id));
  writeJson(file, schedule);
}

export { SCALE_KINDS };
