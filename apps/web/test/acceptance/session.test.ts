// ACCEPTANCE TEST — owned by the architecture. Only remove `.skip`; never change expectations.
// Spec: docs/architecture/05-web-app.md §3 (rules 6, 7, 8, 11, 13; FR-02, FR-03, FR-05).
import { compileLevel, type Move } from '@clink/rules';
import { describe, expect, it } from 'vitest';
import { createGameSession } from '../../src/game/session';
import { APPENDIX_A_MOVE_1, fxToolsJson, w108Json } from '../fixtures';

const w108 = () => compileLevel(w108Json());
const pour = (from: number, to: number): Move => ({ type: 'pour', from, to });
const APPENDIX_A: Move[] = [pour(2, 1), pour(1, 0), pour(0, 2), pour(1, 0), pour(2, 1)];

describe('game session: tapping glasses (rules 6 and 7)', () => {
  it('starts at the level start', () => {
    const s = createGameSession(w108()).snapshot();
    expect(s).toEqual({
      levelId: 'w1-08',
      state: { water: [0, 0, 9], ice: [] },
      moves: 0,
      selected: null,
      found: [false, false, false],
      tuned: false,
      hinted: false,
      hints: 0,
      undos: 0,
      restarts: 0,
      canUndo: false,
    });
  });

  it('tap rings and selects; tapping again rings and deselects', () => {
    const session = createGameSession(w108());
    expect(session.tapGlass(2)).toEqual([
      { type: 'ring', glass: 2, pos: 0 },
      { type: 'select', glass: 2 },
    ]);
    expect(session.snapshot().selected).toBe(2);
    expect(session.tapGlass(2)).toEqual([
      { type: 'ring', glass: 2, pos: 0 },
      { type: 'select', glass: null },
    ]);
    expect(session.snapshot().selected).toBeNull();
    expect(session.snapshot().moves).toBe(0);
  });

  it('tapping another glass pours: select(null), move, found', () => {
    const session = createGameSession(w108());
    session.tapGlass(2);
    expect(session.tapGlass(1)).toEqual([
      { type: 'select', glass: null },
      {
        type: 'move',
        move: pour(2, 1),
        moveNo: 1,
        units: 5,
        events: APPENDIX_A_MOVE_1,
        state: { water: [0, 5, 4], ice: [] },
      },
      { type: 'found', found: [false, false, true], gained: [2], lost: [] },
    ]);
    expect(session.snapshot()).toMatchObject({ moves: 1, selected: null, canUndo: true });
    expect(session.moveList()).toEqual([pour(2, 1)]);
  });

  it('a pour from an empty glass shakes the source and costs nothing', () => {
    const session = createGameSession(w108());
    session.tapGlass(0);
    expect(session.tapGlass(1)).toEqual([
      { type: 'shake', glass: 0, reason: 'empty' },
      { type: 'select', glass: null },
    ]);
    expect(session.snapshot().moves).toBe(0);
  });

  it('a pour into a full glass shakes the target and costs nothing', () => {
    const session = createGameSession(w108(), { resumeMoves: [pour(2, 1)] });
    session.tapGlass(2);
    expect(session.tapGlass(1)).toEqual([
      { type: 'shake', glass: 1, reason: 'full' },
      { type: 'select', glass: null },
    ]);
    expect(session.snapshot().moves).toBe(1);
  });

  it('ignores taps on glass indices that do not exist', () => {
    const session = createGameSession(w108());
    expect(session.tapGlass(3)).toEqual([]);
    expect(session.tapGlass(-1)).toEqual([]);
  });
});

describe('game session: undo and restart (rule 13)', () => {
  it('undo steps back one move and takes it off the count', () => {
    const session = createGameSession(w108());
    session.tapGlass(2);
    session.tapGlass(1);
    expect(session.undo()).toEqual([
      { type: 'undo', state: { water: [0, 0, 9], ice: [] } },
      { type: 'found', found: [false, false, false], gained: [], lost: [2] },
    ]);
    expect(session.snapshot()).toMatchObject({ moves: 0, undos: 1, canUndo: false });
    expect(session.undo()).toEqual([]);
    expect(session.snapshot().undos).toBe(1);
  });

  it('undo clears a selection first', () => {
    const session = createGameSession(w108(), { resumeMoves: [pour(2, 1)] });
    session.tapGlass(0);
    expect(session.undo()[0]).toEqual({ type: 'select', glass: null });
    expect(session.snapshot().selected).toBeNull();
  });

  it('restart returns to the start and counts restarts', () => {
    const session = createGameSession(w108(), { resumeMoves: APPENDIX_A.slice(0, 3) });
    expect(session.restart()).toEqual([
      { type: 'restart', state: { water: [0, 0, 9], ice: [] } },
      { type: 'found', found: [false, false, false], gained: [], lost: [] },
    ]);
    expect(session.snapshot()).toMatchObject({ moves: 0, restarts: 1 });
    expect(session.restart()).toEqual([]);
  });

  it('hints stay recorded through undo and restart (decision D3)', () => {
    const session = createGameSession(w108());
    session.noteHintShown({ type: 'move', move: pour(2, 1) });
    session.tapGlass(2);
    session.tapGlass(1);
    session.undo();
    session.restart();
    expect(session.snapshot()).toMatchObject({ hinted: true, hints: 1 });
  });
});

describe('game session: solving (rule 11)', () => {
  it('Appendix A tunes on move 5, emits tuned last, then locks the board', () => {
    const session = createGameSession(w108(), { resumeMoves: APPENDIX_A.slice(0, 4) });
    session.tapGlass(2);
    const effects = session.tapGlass(1);
    expect(effects.map((e) => e.type)).toEqual(['select', 'move', 'found', 'tuned']);
    expect(effects[2]).toEqual({ type: 'found', found: [true, true, true], gained: [1, 2], lost: [] });
    expect(session.snapshot()).toMatchObject({ tuned: true, moves: 5, canUndo: false });
    expect(session.tapGlass(0)).toEqual([]);
    expect(session.undo()).toEqual([]);
    expect(session.restart()).toEqual([]);
  });

  it('resuming a tuned move list starts locked', () => {
    const session = createGameSession(w108(), { resumeMoves: APPENDIX_A });
    expect(session.snapshot()).toMatchObject({ tuned: true, moves: 5 });
  });

  it('resume replays until the first refused move and drops the rest', () => {
    const session = createGameSession(w108(), {
      resumeMoves: [pour(2, 1), pour(0, 1), pour(1, 0)],
      hinted: true,
      hints: 2,
      undos: 3,
      restarts: 1,
    });
    expect(session.snapshot()).toMatchObject({
      moves: 1,
      state: { water: [0, 5, 4], ice: [] },
      hinted: true,
      hints: 2,
      undos: 3,
      restarts: 1,
    });
    expect(session.moveList()).toEqual([pour(2, 1)]);
  });
});

describe('game session: faucet and sink (rule 8, decision D9)', () => {
  it('a tool with no glass selected asks for a selection and costs nothing', () => {
    const session = createGameSession(compileLevel(fxToolsJson()));
    expect(session.tapTool('faucet')).toEqual([{ type: 'need-selection', tool: 'faucet' }]);
    expect(session.snapshot().moves).toBe(0);
  });

  it('a tool acts on the selected glass and counts one move', () => {
    const session = createGameSession(compileLevel(fxToolsJson()));
    session.tapGlass(0);
    const effects = session.tapTool('faucet');
    expect(effects.map((e) => e.type)).toEqual(['select', 'move', 'found']);
    expect(effects[1]).toMatchObject({
      type: 'move',
      move: { type: 'faucet', glass: 0 },
      moveNo: 1,
      units: 1,
    });
    expect(session.snapshot().state.water).toEqual([4, 5, 4]);
  });

  it('a refused tool use shakes the selected glass', () => {
    const session = createGameSession(compileLevel(fxToolsJson()));
    session.tapGlass(1);
    expect(session.tapTool('faucet')).toEqual([
      { type: 'shake', glass: 1, reason: 'full' },
      { type: 'select', glass: null },
    ]);
  });

  it('tools the level does not offer do nothing', () => {
    const session = createGameSession(w108());
    session.tapGlass(2);
    expect(session.tapTool('sink')).toEqual([]);
    expect(session.snapshot().selected).toBe(2);
  });
});
