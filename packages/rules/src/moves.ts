import type { Level, Move, MoveEvent, MoveResult, State } from './types';

/**
 * Every candidate move in CANONICAL ORDER, legal or not: pours (from ascending, then to ascending),
 * then a faucet per glass, then a sink per glass, when the level offers them.
 */
export function allMoves(level: Level): Move[] {
  const count = level.glasses.length;
  const moves: Move[] = [];
  for (let from = 0; from < count; from++) {
    for (let to = 0; to < count; to++) {
      if (from !== to) moves.push({ type: 'pour', from, to });
    }
  }
  if (level.tools.faucet) for (let glass = 0; glass < count; glass++) moves.push({ type: 'faucet', glass });
  if (level.tools.sink) for (let glass = 0; glass < count; glass++) moves.push({ type: 'sink', glass });
  return moves;
}

/**
 * Applies one move (rules 7, 8, 9). Pure: never mutates `state`. Does NOT refuse moves on a
 * tuned board: the board lock (rule 11) is the game session's job.
 * Spec: docs/architecture/02-rules-engine.md §5.
 */
export function applyMove(level: Level, state: State, move: Move): MoveResult {
  const water = [...state.water];
  const ice = [...state.ice];
  const count = water.length;
  const capacity = (glass: number) => level.glasses[glass]?.capacity ?? 0;
  const inRange = (glass: number) => Number.isInteger(glass) && glass >= 0 && glass < count;
  const ring = (glass: number) => (level.glasses[glass]?.emptyPos ?? 0) - (water[glass] ?? 0);
  const events: MoveEvent[] = [];
  let units = 0;

  if (move.type === 'pour') {
    const { from, to } = move;
    if (!inRange(from) || !inRange(to)) return { ok: false, reason: 'bad-glass' };
    if (from === to) return { ok: false, reason: 'same-glass' };
    if ((water[from] ?? 0) === 0) return { ok: false, reason: 'empty' };
    if ((water[to] ?? 0) >= capacity(to)) return { ok: false, reason: 'full' };
    units = Math.min(water[from] ?? 0, capacity(to) - (water[to] ?? 0));
    for (let unit = 0; unit < units; unit++) {
      water[from] = (water[from] ?? 0) - 1;
      water[to] = (water[to] ?? 0) + 1;
      events.push({ type: 'unit', from, to, fromPos: ring(from), toPos: ring(to) });
    }
  } else {
    const glass = move.glass;
    if (!inRange(glass)) return { ok: false, reason: 'bad-glass' };
    if (!level.tools[move.type]) return { ok: false, reason: 'no-tool' };
    if (move.type === 'faucet') {
      if ((water[glass] ?? 0) >= capacity(glass)) return { ok: false, reason: 'full' };
      units = capacity(glass) - (water[glass] ?? 0);
      for (let unit = 0; unit < units; unit++) {
        water[glass] = (water[glass] ?? 0) + 1;
        events.push({ type: 'unit', from: null, to: glass, fromPos: null, toPos: ring(glass) });
      }
    } else {
      if ((water[glass] ?? 0) === 0) return { ok: false, reason: 'empty' };
      units = water[glass] ?? 0;
      for (let unit = 0; unit < units; unit++) {
        water[glass] = (water[glass] ?? 0) - 1;
        events.push({ type: 'unit', from: glass, to: null, fromPos: ring(glass), toPos: null });
      }
    }
  }

  // Rule 9 / D2: every countdown above 0 drops by one, in cube order; a cube reaching 0 melts.
  for (const cube of level.ice) {
    const countdown = ice[cube.index] ?? 0;
    if (countdown <= 0) continue;
    ice[cube.index] = countdown - 1;
    if (countdown - 1 !== 0) continue;
    if ((water[cube.glass] ?? 0) < capacity(cube.glass)) {
      water[cube.glass] = (water[cube.glass] ?? 0) + 1;
      events.push({ type: 'melt', cube: cube.index, glass: cube.glass, pos: ring(cube.glass) });
    } else {
      events.push({ type: 'spill', cube: cube.index, glass: cube.glass });
    }
  }

  return { ok: true, state: { water, ice }, units, events };
}

/** allMoves(level) filtered to the moves applyMove accepts, in canonical order. */
export function legalMoves(level: Level, state: State): Move[] {
  return allMoves(level).filter((move) => applyMove(level, state, move).ok);
}
