import {
  applyMove,
  foundTargets,
  type Hint,
  initialState,
  isTuned,
  type Level,
  type Move,
  ringing,
  type State,
  type ToolName,
} from '@clink/rules';
import type { GameEffect, GameSession, GameSessionOptions, SessionSnapshot } from './types';
export function createGameSession(level: Level, o: GameSessionOptions = {}): GameSession {
  const start = initialState(level);
  const hist: State[] = [start];
  const moves: Move[] = [];
  let selected: number | null = null;
  let hinted = o.hinted ?? false;
  let hints = o.hints ?? 0;
  let undos = o.undos ?? 0;
  let restarts = o.restarts ?? 0;
  for (const m of o.resumeMoves ?? []) {
    const r = applyMove(level, hist.at(-1) as State, m);
    if (!r.ok) break;
    hist.push(r.state);
    moves.push(m);
  }
  const cur = () => hist.at(-1) as State;
  const tuned = () => isTuned(level, cur());
  const foundEffect = (prev: boolean[]): GameEffect => {
    const f = foundTargets(level, cur());
    return {
      type: 'found',
      found: f,
      gained: f.flatMap((v, i) => (v && !prev[i] ? [i] : [])),
      lost: f.flatMap((v, i) => (!v && prev[i] ? [i] : [])),
    };
  };
  const doMove = (m: Move, shakeGlass: (reason: string) => number): GameEffect[] => {
    const prev = foundTargets(level, cur());
    const r = applyMove(level, cur(), m);
    if (!r.ok) {
      selected = null;
      return [
        { type: 'shake', glass: shakeGlass(r.reason), reason: r.reason },
        { type: 'select', glass: null },
      ];
    }
    selected = null;
    hist.push(r.state);
    moves.push(m);
    const out: GameEffect[] = [
      { type: 'select', glass: null },
      { type: 'move', move: m, moveNo: moves.length, units: r.units, events: r.events, state: r.state },
      foundEffect(prev),
    ];
    if (tuned()) out.push({ type: 'tuned' });
    return out;
  };
  return {
    level,
    snapshot(): SessionSnapshot {
      return {
        levelId: level.id,
        state: cur(),
        moves: moves.length,
        selected,
        found: foundTargets(level, cur()),
        tuned: tuned(),
        hinted,
        hints,
        undos,
        restarts,
        canUndo: !tuned() && moves.length > 0,
      };
    },
    tapGlass(g) {
      if (tuned() || !Number.isInteger(g) || g < 0 || g >= level.glasses.length) return [];
      const pos = ringing(level, cur())[g] as number;
      if (selected === null) {
        selected = g;
        return [
          { type: 'ring', glass: g, pos },
          { type: 'select', glass: g },
        ];
      }
      if (selected === g) {
        selected = null;
        return [
          { type: 'ring', glass: g, pos },
          { type: 'select', glass: null },
        ];
      }
      const s = selected;
      return doMove({ type: 'pour', from: s, to: g }, (reason) => (reason === 'empty' ? s : g));
    },
    tapTool(t: ToolName) {
      if (tuned() || !level.tools[t]) return [];
      if (selected === null) return [{ type: 'need-selection', tool: t }];
      const s = selected;
      return doMove({ type: t, glass: s }, () => s);
    },
    undo() {
      if (tuned() || moves.length === 0) return [];
      const out: GameEffect[] = [];
      if (selected !== null) {
        selected = null;
        out.push({ type: 'select', glass: null });
      }
      const prev = foundTargets(level, cur());
      hist.pop();
      moves.pop();
      undos++;
      out.push({ type: 'undo', state: cur() }, foundEffect(prev));
      return out;
    },
    restart() {
      if (tuned() || moves.length === 0) return [];
      const out: GameEffect[] = [];
      if (selected !== null) {
        selected = null;
        out.push({ type: 'select', glass: null });
      }
      const prev = foundTargets(level, cur());
      hist.length = 1;
      moves.length = 0;
      restarts++;
      out.push({ type: 'restart', state: cur() }, foundEffect(prev));
      return out;
    },
    noteHintShown(_h: Hint) {
      hinted = true;
      hints++;
    },
    moveList() {
      return [...moves];
    },
  };
}
