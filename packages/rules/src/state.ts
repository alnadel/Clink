import type { Level, Pos, State } from './types';
import { at } from './util';

/** Start state: each glass's `water` and each cube's `countdown` from the level file. */
export function initialState(level: Level): State {
  return {
    water: level.glasses.map((glass) => glass.startWater),
    ice: level.ice.map((cube) => cube.startCountdown),
  };
}

/** Position each glass rings: glasses[i].emptyPos - state.water[i] (rule 2). */
export function ringing(level: Level, state: State): Pos[] {
  return level.glasses.map((glass, i) => glass.emptyPos - at(state.water, i));
}

/** For each of level.targets, whether at least one glass rings it (rule 10). */
export function foundTargets(level: Level, state: State): boolean[] {
  const rung = new Set(ringing(level, state));
  return level.targets.map((target) => rung.has(target));
}

/** True when every target is found at once (rule 11). */
export function isTuned(level: Level, state: State): boolean {
  return foundTargets(level, state).every(Boolean);
}

/**
 * Unique integer key for a state (for Map/Set lookups).
 * key = sum(water[i] * 16^i) + sum(ice[j] * 16^(water.length + j)). Multiplication, not bit shifts.
 */
export function stateKey(state: State): number {
  let key = 0;
  let multiplier = 1;
  for (const value of state.water) {
    key += value * multiplier;
    multiplier *= 16;
  }
  for (const value of state.ice) {
    key += value * multiplier;
    multiplier *= 16;
  }
  return key;
}
