import { NotImplementedError } from './errors';
import type { ExploreOptions, Hint, Level, Move, SolverGraph, SolveSummary, State } from './types';

/**
 * Breadth-first search over every state reachable from the start, NOT stopping at tuned states.
 * Computes reachable, par, optimalSolutions and distance-to-goal for every state.
 * Spec: docs/architecture/02-rules-engine.md §6 (includes pseudocode).
 */
export function explore(level: Level, options?: ExploreOptions): SolverGraph {
  throw new NotImplementedError(`explore(${level.id}, ${options?.maxStates})`);
}

/** explore() reduced to its summary. */
export function solve(level: Level, options?: ExploreOptions): SolveSummary {
  throw new NotImplementedError(`solve(${level.id}, ${options?.maxStates})`);
}

/**
 * Next move of a shortest solution from `state` (rule 15):
 * the FIRST move in legalMoves() order whose resulting state has distance d - 1.
 * Tuned state -> { type: 'none' }. No reachable solve -> { type: 'restart' }.
 */
export function hint(level: Level, graph: SolverGraph, state: State): Hint {
  throw new NotImplementedError(`hint(${level.id}, ${graph.reachable}, ${state.water.length})`);
}

/** Follows hint() from the start state until tuned. Returns [] if the start is tuned or unsolvable. */
export function solutionPath(level: Level, graph: SolverGraph): Move[] {
  throw new NotImplementedError(`solutionPath(${level.id}, ${graph.reachable})`);
}
