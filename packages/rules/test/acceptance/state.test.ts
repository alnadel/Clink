// ACCEPTANCE TEST — owned by the architecture. Only remove `.skip`; never change expectations.
// Spec: docs/architecture/02-rules-engine.md §4.
import { describe, expect, it } from 'vitest';
import { compileLevel, foundTargets, initialState, isTuned, ringing, stateKey } from '../../src';
import { FIXTURE_IDS, frozenState, levelJson } from '../helpers';

describe.skip('state helpers', () => {
  it.each(FIXTURE_IDS)('%s: initialState copies water and countdowns from the file', (id) => {
    const json = levelJson(id);
    const level = compileLevel(json);
    expect(initialState(level)).toEqual({
      water: json.glasses.map((g) => g.water),
      ice: json.ice.map((c) => c.countdown),
    });
  });

  it('ringing: each glass rings emptyPos - water (w1-08 start = G4, C5, C3)', () => {
    const level = compileLevel(levelJson('w1-08'));
    const pos = ringing(level, frozenState([0, 0, 9]));
    expect(pos).toEqual([8, 10, 0]);
    expect(pos.map((p) => level.positions[p]?.name)).toEqual(['G4', 'C5', 'C3']);
  });

  it('foundTargets and isTuned (rules 10 and 11)', () => {
    const level = compileLevel(levelJson('w1-08'));
    // targets are E4, D4, C4
    expect(foundTargets(level, frozenState([0, 0, 9]))).toEqual([false, false, false]);
    expect(foundTargets(level, frozenState([0, 5, 4]))).toEqual([false, false, true]);
    expect(foundTargets(level, frozenState([1, 0, 8]))).toEqual([true, false, false]);
    expect(foundTargets(level, frozenState([1, 5, 3]))).toEqual([true, true, true]);
    expect(isTuned(level, frozenState([1, 0, 8]))).toBe(false);
    expect(isTuned(level, frozenState([1, 5, 3]))).toBe(true);
  });

  it('notes are matched by exact pitch, octave included (D3 is not D4)', () => {
    const level = compileLevel(levelJson('w1-08'));
    // Glass C with 8 units rings D3; the target is D4.
    expect(ringing(level, frozenState([0, 1, 8]))[2]).toBe(1);
    expect(foundTargets(level, frozenState([0, 1, 8]))).toEqual([false, false, false]);
  });

  it('stateKey follows the documented formula', () => {
    expect(stateKey(frozenState([0, 0, 9]))).toBe(2304);
    expect(stateKey(frozenState([3, 0, 1], [1, 4]))).toBe(266499);
    expect(stateKey(frozenState([0, 0], []))).toBe(0);
  });

  it('stateKey is unique across every water combination of w1-08', () => {
    const keys = new Set<number>();
    for (let a = 0; a <= 4; a++)
      for (let b = 0; b <= 5; b++) for (let c = 0; c <= 9; c++) keys.add(stateKey(frozenState([a, b, c])));
    expect(keys.size).toBe(300);
  });

  it('stateKey stays a safe integer at the maximum shape (5 glasses of 12, 3 cubes of 15)', () => {
    const key = stateKey(frozenState([12, 12, 12, 12, 12], [15, 15, 15]));
    expect(Number.isSafeInteger(key)).toBe(true);
  });
});
