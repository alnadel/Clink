import { NotImplementedError } from './errors';
import type { Level, Pos, State } from './types';

/** Start state: each glass's `water` and each cube's `countdown` from the level file. */
export function initialState(level: Level): State {
  throw new NotImplementedError(`initialState(${level.id})`);
}

/** Position each glass rings: glasses[i].emptyPos - state.water[i] (rule 2). */
export function ringing(level: Level, state: State): Pos[] {
  throw new NotImplementedError(`ringing(${level.id}, ${state.water.length})`);
}

/** For each of level.targets, whether at least one glass rings it (rule 10). */
export function foundTargets(level: Level, state: State): boolean[] {
  throw new NotImplementedError(`foundTargets(${level.id}, ${state.water.length})`);
}

/** True when every target is found at once (rule 11). */
export function isTuned(level: Level, state: State): boolean {
  throw new NotImplementedError(`isTuned(${level.id}, ${state.water.length})`);
}

/**
 * Unique integer key for a state (for Map/Set lookups).
 * key = sum(water[i] * 16^i) + sum(ice[j] * 16^(water.length + j)). Use multiplication, not bit shifts.
 */
export function stateKey(state: State): number {
  throw new NotImplementedError(`stateKey(${state.water.length})`);
}
