import { NotImplementedError } from './errors';
import type { Level, Move, MoveResult, State } from './types';

/**
 * Every candidate move in CANONICAL ORDER, legal or not:
 * pours (from ascending, then to ascending, skipping from === to),
 * then faucet per glass (ascending) if the level offers a faucet,
 * then sink per glass (ascending) if the level offers a sink.
 */
export function allMoves(level: Level): Move[] {
  throw new NotImplementedError(`allMoves(${level.id})`);
}

/**
 * Applies one move (rules 7, 8, 9). Pure: never mutates `state`.
 * Does NOT refuse moves on a tuned board: the board lock (rule 11) is the game's job.
 * Spec: docs/architecture/02-rules-engine.md §5.
 */
export function applyMove(level: Level, state: State, move: Move): MoveResult {
  throw new NotImplementedError(`applyMove(${level.id}, ${state.water.length}, ${move.type})`);
}

/** allMoves(level) filtered to the moves applyMove accepts, in canonical order. */
export function legalMoves(level: Level, state: State): Move[] {
  throw new NotImplementedError(`legalMoves(${level.id}, ${state.water.length})`);
}
