// ACCEPTANCE TEST — owned by the architecture. Only remove `.skip`; never change expectations.
// Spec: docs/architecture/02-rules-engine.md §6 (FR-04, FR-06, FR-19).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  applyMove,
  compileLevel,
  explore,
  hint,
  initialState,
  isTuned,
  type Level,
  legalMoves,
  type SolverGraph,
  type State,
  solutionPath,
  solve,
  stateKey,
} from '../../src';
import { FIXTURE_IDS, levelJson, SOLVER_EXPECTED } from '../helpers';

function followHints(level: Level, graph: SolverGraph, from: State, limit = 200): number {
  let state = from;
  for (let moves = 0; moves <= limit; moves++) {
    const h = hint(level, graph, state);
    if (h.type === 'none') return moves;
    if (h.type === 'restart') throw new Error('hint said restart on a solvable state');
    const result = applyMove(level, state, h.move);
    if (!result.ok) throw new Error(`hint suggested a refused move: ${result.reason}`);
    state = result.state;
  }
  throw new Error('hints did not reach a tuned state');
}

describe('solve and explore: fixtures', () => {
  it.each(FIXTURE_IDS)('%s: reachable, par and optimalSolutions', (id) => {
    const level = compileLevel(levelJson(id));
    const expected = SOLVER_EXPECTED[id];
    const summary = solve(level);
    expect({
      reachable: summary.reachable,
      par: summary.par,
      optimalSolutions: summary.optimalSolutions,
      truncated: summary.truncated,
    }).toEqual({
      reachable: expected.reachable,
      par: expected.par,
      optimalSolutions: expected.optimalSolutions,
      truncated: false,
    });
    // The fixture files carry the proven values, as levels:prove would write them.
    expect(level.par).toBe(expected.par);
    expect(level.optimalSolutions).toBe(expected.optimalSolutions);
  });

  it('w1-08 counts 18 states, not 15: exploration does not stop at tuned states', () => {
    expect(solve(compileLevel(levelJson('w1-08'))).reachable).toBe(18);
  });

  it.each(FIXTURE_IDS)('%s: explore() graph shape', (id) => {
    const level = compileLevel(levelJson(id));
    const expected = SOLVER_EXPECTED[id];
    const graph = explore(level);
    expect(graph.reachable).toBe(expected.reachable);
    expect(graph.states).toHaveLength(expected.reachable);
    expect(graph.states[0]).toEqual(initialState(level));
    expect(graph.unsolvableStates).toBe(expected.unsolvableStates);
    expect(graph.distanceOf(initialState(level))).toBe(expected.par);
    expect(new Set(graph.states.map(stateKey)).size).toBe(expected.reachable);
    for (const state of graph.states) {
      const d = graph.distanceOf(state);
      if (isTuned(level, state)) expect(d).toBe(0);
      else expect(d === null || d > 0).toBe(true);
    }
    expect(graph.states.filter((s) => graph.distanceOf(s) === null)).toHaveLength(expected.unsolvableStates);
  });

  it('distanceOf throws RangeError for a state that was not explored', () => {
    const level = compileLevel(levelJson('w1-08'));
    const graph = explore(level);
    expect(() => graph.distanceOf({ water: [3, 3, 3], ice: [] })).toThrow(RangeError);
  });

  it('stops at maxStates and reports truncation', () => {
    const graph = explore(compileLevel(levelJson('fx-tools')), { maxStates: 10 });
    expect(graph.truncated).toBe(true);
    expect(graph.reachable).toBe(10);
    expect(graph.states).toHaveLength(10);
  });

  it('a level tuned at the start has par 0 and one (empty) solution', () => {
    const json = levelJson('w1-08');
    json.glasses[0] = { id: 'A', capacity: 4, emptyNote: 'G4', water: 1 };
    json.glasses[1] = { id: 'B', capacity: 5, emptyNote: 'C5', water: 5 };
    json.glasses[2] = { id: 'C', capacity: 9, emptyNote: 'A4', water: 3 };
    const level = compileLevel(json);
    const graph = explore(level);
    expect(graph.par).toBe(0);
    expect(graph.optimalSolutions).toBe(1);
    expect(graph.reachable).toBe(18);
    expect(hint(level, graph, initialState(level))).toEqual({ type: 'none' });
    expect(solutionPath(level, graph)).toEqual([]);
  });

  it('an unsolvable level has par null and every hint says restart', () => {
    const json = levelJson('w1-08');
    json.melody.notes = ['A5', 'G5', 'A5']; // no glass can ring A5
    json.melody.beats = [1, 1, 2];
    const level = compileLevel(json);
    const graph = explore(level);
    expect(graph.par).toBeNull();
    expect(graph.optimalSolutions).toBe(0);
    expect(graph.unsolvableStates).toBe(18);
    expect(hint(level, graph, initialState(level))).toEqual({ type: 'restart' });
    expect(solutionPath(level, graph)).toEqual([]);
  });
});

describe('hints and solution paths (FR-04, FR-06)', () => {
  it.each(FIXTURE_IDS)('%s: solutionPath matches the reference exactly', (id) => {
    const level = compileLevel(levelJson(id));
    const graph = explore(level);
    expect(solutionPath(level, graph)).toEqual(SOLVER_EXPECTED[id].solutionPath);
  });

  it.each(FIXTURE_IDS)('%s: replaying solutionPath tunes on exactly the last move (FR-04)', (id) => {
    const level = compileLevel(levelJson(id));
    const path = solutionPath(level, explore(level));
    let state = initialState(level);
    path.forEach((move, i) => {
      expect(isTuned(level, state)).toBe(false);
      const result = applyMove(level, state, move);
      if (!result.ok) throw new Error(`refused: ${result.reason}`);
      state = result.state;
      expect(isTuned(level, state)).toBe(i === path.length - 1);
    });
  });

  it.each(FIXTURE_IDS)(
    '%s: from EVERY explored state, hints solve in exactly distanceOf moves (FR-06)',
    (id) => {
      const level = compileLevel(levelJson(id));
      const graph = explore(level);
      for (const state of graph.states) {
        const d = graph.distanceOf(state);
        if (d === null) {
          expect(hint(level, graph, state)).toEqual({ type: 'restart' });
        } else {
          expect(followHints(level, graph, state)).toBe(d);
        }
      }
    },
  );

  it.each(FIXTURE_IDS)('%s: any sequence of legal moves stays inside the explored graph', (id) => {
    const level = compileLevel(levelJson(id));
    const graph = explore(level);
    fc.assert(
      fc.property(fc.array(fc.nat(), { maxLength: 30 }), (choices) => {
        let state = initialState(level);
        for (const choice of choices) {
          const moves = legalMoves(level, state);
          if (moves.length === 0) break;
          const result = applyMove(level, state, moves[choice % moves.length] as (typeof moves)[number]);
          if (!result.ok) return false;
          state = result.state;
          graph.distanceOf(state); // throws if the state is unknown
        }
        return true;
      }),
      { numRuns: 200 },
    );
  });
});
