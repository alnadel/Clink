// ACCEPTANCE TEST — owned by the architecture. Only remove `.skip`; never change expectations.
// Spec: docs/architecture/02-rules-engine.md §5.
import { describe, expect, it } from 'vitest';
import { allMoves, applyMove, compileLevel, legalMoves, type Move } from '../../src';
import { deepFreeze, FIXTURE_IDS, frozenState, levelJson, MOVE_CASES } from '../helpers';

describe('applyMove: fixture cases', () => {
  it.each(MOVE_CASES.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const level = compileLevel(levelJson(c.level));
    const state = frozenState(c.state.water, c.state.ice);
    const move = deepFreeze(c.move as Move);
    expect(applyMove(level, state, move)).toEqual(c.expected);
  });
});

describe('allMoves and legalMoves', () => {
  const pours = (n: number): Move[] => {
    const out: Move[] = [];
    for (let from = 0; from < n; from++)
      for (let to = 0; to < n; to++) if (from !== to) out.push({ type: 'pour', from, to });
    return out;
  };

  it('pour-only level: 6 pours in canonical order', () => {
    const level = compileLevel(levelJson('w1-08'));
    expect(allMoves(level)).toEqual(pours(3));
  });

  it('faucet and sink level: pours, then faucets, then sinks', () => {
    const level = compileLevel(levelJson('fx-tools'));
    expect(allMoves(level)).toEqual([
      ...pours(3),
      { type: 'faucet', glass: 0 },
      { type: 'faucet', glass: 1 },
      { type: 'faucet', glass: 2 },
      { type: 'sink', glass: 0 },
      { type: 'sink', glass: 1 },
      { type: 'sink', glass: 2 },
    ]);
  });

  it('sink-only level: pours, then sinks', () => {
    const level = compileLevel(levelJson('fx-sink'));
    expect(allMoves(level)).toEqual([
      ...pours(3),
      { type: 'sink', glass: 0 },
      { type: 'sink', glass: 1 },
      { type: 'sink', glass: 2 },
    ]);
  });

  it('legalMoves at the start of w1-08: only glass C can pour', () => {
    const level = compileLevel(levelJson('w1-08'));
    expect(legalMoves(level, frozenState([0, 0, 9]))).toEqual([
      { type: 'pour', from: 2, to: 0 },
      { type: 'pour', from: 2, to: 1 },
    ]);
  });

  it.each(FIXTURE_IDS)('%s: legalMoves is exactly allMoves filtered by applyMove', (id) => {
    const level = compileLevel(levelJson(id));
    const json = levelJson(id);
    const state = frozenState(
      json.glasses.map((g) => g.water),
      json.ice.map((c) => c.countdown),
    );
    const expected = allMoves(level).filter((m) => applyMove(level, state, m).ok);
    expect(legalMoves(level, state)).toEqual(expected);
  });
});
