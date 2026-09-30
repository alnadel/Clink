import { applyMove, legalMoves } from './moves';
import { initialState, isTuned, stateKey } from './state';
import {
  DEFAULT_MAX_STATES,
  type ExploreOptions,
  type Hint,
  type Level,
  type Move,
  type SolverGraph,
  type SolveSummary,
  type State,
} from './types';

/**
 * Breadth-first search over every state reachable from the start, NOT stopping at tuned states
 * (D11). Computes reachable, par, optimalSolutions and distance-to-goal for every state.
 * Spec: docs/architecture/02-rules-engine.md §6.
 */
export function explore(level: Level, options?: ExploreOptions): SolverGraph {
  const maxStates = options?.maxStates ?? DEFAULT_MAX_STATES;
  const start = initialState(level);
  const states: State[] = [start];
  const index = new Map<number, number>([[stateKey(start), 0]]);
  const depth: number[] = [0];
  const ways: number[] = [1]; // shortest move sequences reaching each state
  const edgeFrom: number[] = [];
  const edgeTo: number[] = [];
  let truncated = false;

  for (let i = 0; i < states.length; i++) {
    const current = states[i];
    if (!current) continue;
    const currentDepth = depth[i] ?? 0;
    for (const move of legalMoves(level, current)) {
      const result = applyMove(level, current, move);
      if (!result.ok) continue;
      const key = stateKey(result.state);
      let j = index.get(key);
      if (j === undefined) {
        if (states.length >= maxStates) {
          truncated = true;
          continue;
        }
        j = states.length;
        states.push(result.state);
        index.set(key, j);
        depth.push(currentDepth + 1);
        ways.push(0);
      }
      edgeFrom.push(i);
      edgeTo.push(j);
      if (depth[j] === currentDepth + 1) ways[j] = (ways[j] ?? 0) + (ways[i] ?? 0);
    }
  }

  const tuned = states.map((state) => isTuned(level, state));
  let par: number | null = null;
  tuned.forEach((isGoal, i) => {
    const d = depth[i] ?? 0;
    if (isGoal && (par === null || d < par)) par = d;
  });
  let optimalSolutions = 0;
  if (par !== null) {
    tuned.forEach((isGoal, i) => {
      if (isGoal && depth[i] === par) optimalSolutions += ways[i] ?? 0;
    });
  }

  // Distance to a solve: reverse BFS from every tuned state.
  const predecessors: number[][] = states.map(() => []);
  edgeFrom.forEach((from, e) => {
    predecessors[edgeTo[e] ?? 0]?.push(from);
  });
  const distance = new Int32Array(states.length).fill(-1);
  const queue: number[] = [];
  tuned.forEach((isGoal, i) => {
    if (isGoal) {
      distance[i] = 0;
      queue.push(i);
    }
  });
  for (let head = 0; head < queue.length; head++) {
    const x = queue[head] ?? 0;
    for (const p of predecessors[x] ?? []) {
      if (distance[p] === -1) {
        distance[p] = (distance[x] ?? 0) + 1;
        queue.push(p);
      }
    }
  }
  let unsolvableStates = 0;
  for (const d of distance) if (d === -1) unsolvableStates++;

  return {
    reachable: states.length,
    par,
    optimalSolutions,
    truncated,
    states,
    unsolvableStates,
    distanceOf(state: State): number | null {
      const i = index.get(stateKey(state));
      if (i === undefined) throw new RangeError('state was not explored');
      const d = distance[i] ?? -1;
      return d === -1 ? null : d;
    },
  };
}

/** explore() reduced to its summary. */
export function solve(level: Level, options?: ExploreOptions): SolveSummary {
  const { reachable, par, optimalSolutions, truncated } = explore(level, options);
  return { reachable, par, optimalSolutions, truncated };
}

/**
 * Next move of a shortest solution from `state` (rule 15): the FIRST move in legalMoves() order
 * whose resulting state is one step closer (D12). Tuned -> none. No reachable solve -> restart.
 */
export function hint(level: Level, graph: SolverGraph, state: State): Hint {
  const d = graph.distanceOf(state);
  if (d === 0) return { type: 'none' };
  if (d === null) return { type: 'restart' };
  for (const move of legalMoves(level, state)) {
    const result = applyMove(level, state, move);
    if (result.ok && graph.distanceOf(result.state) === d - 1) return { type: 'move', move };
  }
  throw new Error('inconsistent solver graph');
}

/** Follows hint() from the start state until tuned. Returns [] if the start is tuned or unsolvable. */
export function solutionPath(level: Level, graph: SolverGraph): Move[] {
  const path: Move[] = [];
  let state = initialState(level);
  for (;;) {
    const next = hint(level, graph, state);
    if (next.type === 'restart') return [];
    if (next.type === 'none') return path;
    path.push(next.move);
    const result = applyMove(level, state, next.move);
    if (!result.ok) throw new Error('hint suggested a refused move');
    state = result.state;
  }
}
