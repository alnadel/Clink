/**
 * Test helpers shared by the acceptance tests. Owned by the architecture.
 * Do not change expected values in fixtures/ — they were computed by a reference
 * implementation that reproduces BRD Appendix A exactly.
 */
import { LevelError, type LevelJson, type State } from '../src';
import appendixATrace from './fixtures/appendix-a-trace.json';
import compileExpected from './fixtures/compile-expected.json';
import fxIce from './fixtures/levels/fx-ice.json';
import fxIce2 from './fixtures/levels/fx-ice-2.json';
import fxSink from './fixtures/levels/fx-sink.json';
import fxTools from './fixtures/levels/fx-tools.json';
import w108 from './fixtures/levels/w1-08.json';
import moveCases from './fixtures/move-cases.json';
import solverExpected from './fixtures/solver-expected.json';

export const FIXTURE_IDS = ['w1-08', 'fx-tools', 'fx-sink', 'fx-ice', 'fx-ice-2'] as const;
export type FixtureId = (typeof FIXTURE_IDS)[number];

const LEVELS: Record<FixtureId, LevelJson> = {
  'w1-08': w108 as unknown as LevelJson,
  'fx-tools': fxTools as unknown as LevelJson,
  'fx-sink': fxSink as unknown as LevelJson,
  'fx-ice': fxIce as unknown as LevelJson,
  'fx-ice-2': fxIce2 as unknown as LevelJson,
};

/** A fresh deep copy of a fixture level, safe to mutate. */
export function levelJson(id: FixtureId): LevelJson {
  return JSON.parse(JSON.stringify(LEVELS[id])) as LevelJson;
}

export interface CompileExpected {
  positions: string[];
  firstHz: number;
  lastHz: number;
  emptyPos: number[];
  targets: number[];
  targetIndex: number[];
  iceGlass: number[];
}
export const COMPILE_EXPECTED = compileExpected as Record<FixtureId, CompileExpected>;

export interface MoveCase {
  name: string;
  level: FixtureId;
  state: { water: number[]; ice: number[] };
  move: unknown;
  expected: unknown;
}
export const MOVE_CASES = moveCases as MoveCase[];

export interface SolverExpected {
  reachable: number;
  par: number | null;
  optimalSolutions: number;
  truncated: boolean;
  unsolvableStates: number;
  solutionPath: unknown[];
}
export const SOLVER_EXPECTED = solverExpected as Record<FixtureId, SolverExpected>;

export interface TraceStep {
  move: unknown;
  units: number;
  water: number[];
  ringing: string[];
  found: boolean[];
  tuned: boolean;
}
export const APPENDIX_A_TRACE = appendixATrace as {
  level: FixtureId;
  start: { water: number[]; ringing: string[]; found: boolean[] };
  steps: TraceStep[];
};

/** Recursively freezes an object so any mutation throws (ES modules run in strict mode). */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

export function frozenState(water: number[], ice: number[] = []): State {
  return deepFreeze({ water: [...water], ice: [...ice] });
}

/** Runs fn and returns the LevelError code it throws, or undefined if it does not throw. */
export function levelErrorCode(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    if (error instanceof LevelError) return error.code;
    throw error;
  }
  return undefined;
}
