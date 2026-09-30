/**
 * CONTRACT FILE. Owned by the architecture (docs/architecture/02-rules-engine.md).
 * Do not change these types in an implementation issue. If a type looks wrong,
 * stop and comment on the issue instead.
 */

/** Current level file format version. */
export const SCHEMA_VERSION = 1;

/** Hard cap on explored states for the solver, the CI checker and hints (FR-19). */
export const DEFAULT_MAX_STATES = 100_000;

/** Default factor for the 2-star threshold: moves <= ceil(1.5 * par) (rule 14). */
export const DEFAULT_TWO_STAR_FACTOR = 1.5;

export type ToolName = 'faucet' | 'sink';
export type WorldNumber = 1 | 2 | 3;

// ---------------------------------------------------------------------------
// Level JSON: exactly what is stored in content/levels/**.json and content/daily/*.json
// ---------------------------------------------------------------------------

export interface ScaleJson {
  /** Display name only, e.g. "C major pentatonic". */
  name: string;
  /** Frequency of the tonic. The tonic's note is round(69 + 12*log2(tonicHz/440)) as MIDI. */
  tonicHz: number;
  /** Scale steps within one octave, in cents. Starts at 0, strictly increasing, all < 1200. */
  stepsCents: number[];
  /** Lowest and highest playable notes, inclusive, e.g. ["C3", "A5"]. Both must be on the scale. */
  range: [string, string];
}

export interface MelodyJson {
  /** Key into content/tunes.json. */
  tuneId: string;
  title: string;
  /** Phrase of 3 to 8 notes, e.g. ["E4", "D4", "C4"]. */
  notes: string[];
  /** Length of each note in beats. Same length as `notes`. Each > 0. */
  beats: number[];
  /** Tempo, 40 to 240. */
  bpm: number;
}

export interface GlassJson {
  /** Unique within the level, e.g. "A". */
  id: string;
  /** 2 to 12 units. */
  capacity: number;
  /** Note the glass rings when empty. Must be on the scale. */
  emptyNote: string;
  /** Starting water, 0 to capacity. */
  water: number;
}

export interface IceJson {
  /** Glass id the cube sits in. */
  glass: string;
  /** Moves until the cube melts, 1 to 15. */
  countdown: number;
}

export interface LevelJson {
  schemaVersion: 1;
  /** "w1-08" for campaign levels, "d001" for daily puzzles. */
  id: string;
  world: WorldNumber;
  scale: ScaleJson;
  melody: MelodyJson;
  /** 2 to 5 glasses, in display order (left to right). */
  glasses: GlassJson[];
  /** Subset of ["faucet", "sink"], no duplicates. */
  tools: ToolName[];
  /** 0 to 3 ice cubes. */
  ice: IceJson[];
  /** Written by `pnpm levels:prove`, checked in CI. */
  par: number;
  /** Written by `pnpm levels:prove`, checked in CI. */
  optimalSolutions: number;
}

// ---------------------------------------------------------------------------
// Compiled level: produced by compileLevel(), used everywhere else.
// ---------------------------------------------------------------------------

/**
 * A scale position: index into Level.positions, 0 = the lowest note in the range.
 * Moving up one position = one scale step higher. Glasses ring `emptyPos - water`.
 */
export type Pos = number;

export interface ScalePosition {
  readonly pos: Pos;
  /** Absolute pitch in cents: MIDI note number * 100 (C4 = 6000). */
  readonly cents: number;
  /** Frequency in Hz: tonicHz * 2^((cents - tonicCents) / 1200). */
  readonly hz: number;
  /** Name using sharps, e.g. "C4", "F#4". */
  readonly name: string;
  /** 0 = C, 1 = C#, ... 11 = B. */
  readonly pitchClass: number;
  /** Scientific octave: C4 is middle C. */
  readonly octave: number;
}

export interface Glass {
  readonly id: string;
  /** Index in Level.glasses and in State.water. */
  readonly index: number;
  readonly capacity: number;
  /** Position the glass rings when it holds no water. */
  readonly emptyPos: Pos;
  readonly startWater: number;
}

export interface IceCube {
  /** Index in Level.ice and in State.ice. */
  readonly index: number;
  /** Index of the glass the cube sits in. */
  readonly glass: number;
  readonly startCountdown: number;
}

export interface Melody {
  readonly tuneId: string;
  readonly title: string;
  /** Phrase notes as positions. */
  readonly notes: readonly Pos[];
  readonly beats: readonly number[];
  readonly bpm: number;
  /** For each phrase note, its index in Level.targets. */
  readonly targetIndex: readonly number[];
}

export interface Level {
  readonly id: string;
  readonly world: WorldNumber;
  /** The JSON this level was compiled from (unchanged). */
  readonly source: LevelJson;
  /** Every scale position in the range, ascending. */
  readonly positions: readonly ScalePosition[];
  readonly glasses: readonly Glass[];
  readonly ice: readonly IceCube[];
  readonly tools: { readonly faucet: boolean; readonly sink: boolean };
  readonly melody: Melody;
  /** Distinct phrase positions in order of first appearance (rule 5). */
  readonly targets: readonly Pos[];
  readonly par: number;
  readonly optimalSolutions: number;
}

// ---------------------------------------------------------------------------
// State and moves
// ---------------------------------------------------------------------------

/** Board state. Immutable: every function returns a new object. */
export interface State {
  /** Water units per glass, same order as Level.glasses. */
  readonly water: readonly number[];
  /** Countdown per ice cube, same order as Level.ice. 0 = melted. */
  readonly ice: readonly number[];
}

export type Move =
  | { readonly type: 'pour'; readonly from: number; readonly to: number }
  | { readonly type: 'faucet'; readonly glass: number }
  | { readonly type: 'sink'; readonly glass: number };

export type RefuseReason =
  /** A glass index is out of range. */
  | 'bad-glass'
  /** Pour from a glass into itself. */
  | 'same-glass'
  /** Pour or sink from a glass with no water. */
  | 'empty'
  /** Pour into, or faucet on, a full glass. */
  | 'full'
  /** Faucet or sink used in a level that does not offer it. */
  | 'no-tool';

export type MoveEvent =
  /**
   * One unit of water moved. Emitted once per unit, in order.
   * Pour: both glasses set. Faucet: from = null. Sink: to = null.
   * fromPos/toPos = the position that glass rings right after this unit moved.
   */
  | {
      readonly type: 'unit';
      readonly from: number | null;
      readonly to: number | null;
      readonly fromPos: Pos | null;
      readonly toPos: Pos | null;
    }
  /** An ice cube reached 0 and added one unit to its glass. pos = what the glass now rings. */
  | { readonly type: 'melt'; readonly cube: number; readonly glass: number; readonly pos: Pos }
  /** An ice cube reached 0 but its glass was full: the unit is lost. */
  | { readonly type: 'spill'; readonly cube: number; readonly glass: number };

export type MoveResult =
  | {
      readonly ok: true;
      readonly state: State;
      /** Water units moved by the move itself (not counting melts). */
      readonly units: number;
      readonly events: readonly MoveEvent[];
    }
  | { readonly ok: false; readonly reason: RefuseReason };

// ---------------------------------------------------------------------------
// Solver
// ---------------------------------------------------------------------------

export interface SolveSummary {
  /** States reachable from the start, NOT stopping at tuned states (see rules spec §6). */
  readonly reachable: number;
  /** Fewest moves to a tuned state, or null if no tuned state is reachable. */
  readonly par: number | null;
  /** Number of distinct move sequences of length `par` that end tuned. 0 if par is null. */
  readonly optimalSolutions: number;
  /** True if exploration stopped at maxStates. All other fields are then unreliable. */
  readonly truncated: boolean;
}

export interface SolverGraph extends SolveSummary {
  /** Every explored state, in BFS discovery order. states[0] is the start state. */
  readonly states: readonly State[];
  /** Explored states from which no tuned state can be reached. */
  readonly unsolvableStates: number;
  /**
   * Fewest moves from `state` to any tuned state.
   * Returns 0 for a tuned state, null if no tuned state is reachable from it.
   * Throws RangeError if `state` was not explored.
   */
  distanceOf(state: State): number | null;
}

export type Hint =
  /** Play this move next. */
  | { readonly type: 'move'; readonly move: Move }
  /** No tuned state is reachable from here: suggest restart. */
  | { readonly type: 'restart' }
  /** The state is already tuned. */
  | { readonly type: 'none' };

export interface ExploreOptions {
  /** Defaults to DEFAULT_MAX_STATES. */
  readonly maxStates?: number;
}
