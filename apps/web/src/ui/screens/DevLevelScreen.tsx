import {
  applyMove,
  compileLevel,
  explore,
  foundTargets,
  initialState,
  type Level,
  legalMoves,
  type Move,
  type SolverGraph,
} from '@clink/rules';
import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { createBoardView } from '../../board/pixi/board-view';
import type { BoardOptions, BoardView } from '../../board/types';
import { createGameSession } from '../../game/session';
import type { GameEffect, GameSession } from '../../game/types';
import { useServices } from '../services';

// A designer's tool, present only in development (docs/architecture/05 §2.1). It is English only and
// never ships, so its text lives here rather than in the translation files.
const S = {
  title: 'Level workbench',
  hint: 'Paste a level file, load it, and play it with the solver beside you.',
  load: 'Load',
  undo: 'Undo',
  restart: 'Restart',
  solved: 'Tuned',
  playing: 'Playing',
  par: 'Par',
  reachable: 'Reachable states',
  optimal: 'Optimal solutions',
  unsolvable: 'Unsolvable states',
  distance: 'Moves to solve from here',
  truncated: 'Search was cut off at the state cap',
  moves: 'Next moves and the distance left after each',
  none: 'none',
  input: 'Level JSON',
} as const;

const BOARD_OPTIONS: BoardOptions = { labels: 'letters', reducedMotion: false, lowEffects: false };

interface Loaded {
  level: Level;
  graph: SolverGraph;
}

const describeMove = (move: Move): string =>
  move.type === 'pour' ? `pour ${move.from} to ${move.to}` : `${move.type} ${move.glass}`;

/** Paste a LevelJson and play it with solver overlays (docs/architecture/03 §5, implementation plan §2.2). */
export function DevLevelScreen(): JSX.Element {
  const services = useServices();
  const [source, setSource] = useState('');
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [tick, setTick] = useState(0);
  const host = useRef<HTMLElement>(null);
  const board = useRef<BoardView | null>(null);
  const session = useRef<GameSession | null>(null);

  useEffect(() => {
    const first = services.content.manifest().levelOrder[0];
    if (first)
      void services.content.levelJson(first).then((json) => setSource(JSON.stringify(json, null, 2)));
  }, [services]);

  const load = (): void => {
    try {
      const level = compileLevel(JSON.parse(source));
      setError('');
      setLoaded({ level, graph: explore(level) });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const perform = (effects: GameEffect[]): void => {
    const view = board.current;
    const current = session.current;
    if (!view || !current) return;
    for (const effect of effects) {
      if (effect.type === 'select') view.setSelected(effect.glass);
      else if (effect.type === 'shake') view.shake(effect.glass);
      else if (effect.type === 'move') void view.animateMove(effect.events, effect.state, () => {});
      else if (effect.type === 'found') view.setFound(effect.found);
      else if (effect.type === 'undo' || effect.type === 'restart') {
        view.show(current.level, effect.state, current.snapshot().found, BOARD_OPTIONS);
      }
    }
    setTick((n) => n + 1);
  };

  useEffect(() => {
    const container = host.current;
    if (!container || !loaded) return;
    const view = createBoardView();
    const current = createGameSession(loaded.level);
    board.current = view;
    session.current = current;
    let disposed = false;
    void view
      .mount(container, {
        onGlassTap: (glass) => perform(current.tapGlass(glass)),
        onToolTap: (tool) => perform(current.tapTool(tool)),
        onMelodyTap: () => {},
      })
      .then(() => {
        if (disposed) return;
        view.show(loaded.level, initialState(loaded.level), current.snapshot().found, BOARD_OPTIONS);
        setTick((n) => n + 1);
      });
    return () => {
      disposed = true;
      view.destroy();
      board.current = null;
      session.current = null;
    };
  }, [loaded]);

  const snapshot = tick >= 0 ? (session.current?.snapshot() ?? null) : null;
  const options =
    loaded && snapshot
      ? legalMoves(loaded.level, snapshot.state).map((move) => {
          const result = applyMove(loaded.level, snapshot.state, move);
          const left = result.ok ? loaded.graph.distanceOf(result.state) : null;
          return { move, left };
        })
      : [];
  const here = loaded && snapshot ? loaded.graph.distanceOf(snapshot.state) : null;
  const found = loaded && snapshot ? foundTargets(loaded.level, snapshot.state) : [];

  return (
    <main class="dev-level">
      <h1>{S.title}</h1>
      <p class="muted">{S.hint}</p>
      <label>
        {S.input}
        <textarea
          rows={10}
          spellcheck={false}
          value={source}
          onInput={(event) => setSource((event.currentTarget as HTMLTextAreaElement).value)}
        />
      </label>
      <p>
        <button type="button" class="btn btn-primary" onClick={load}>
          {S.load}
        </button>
        <button type="button" class="btn" onClick={() => perform(session.current?.undo() ?? [])}>
          {S.undo}
        </button>
        <button type="button" class="btn" onClick={() => perform(session.current?.restart() ?? [])}>
          {S.restart}
        </button>
      </p>
      {error ? <pre role="alert">{error}</pre> : null}
      <section class="board-host dev-board" ref={host} data-testid="dev-board" aria-label={S.title} />
      {loaded ? (
        <dl>
          <dt>{S.par}</dt>
          <dd>{loaded.graph.par ?? S.none}</dd>
          <dt>{S.reachable}</dt>
          <dd>{loaded.graph.reachable}</dd>
          <dt>{S.optimal}</dt>
          <dd>{loaded.graph.optimalSolutions}</dd>
          <dt>{S.unsolvable}</dt>
          <dd>{loaded.graph.unsolvableStates}</dd>
          <dt>{S.distance}</dt>
          <dd>{here ?? S.none}</dd>
          <dt>{snapshot?.tuned ? S.solved : S.playing}</dt>
          <dd>{found.map((value) => (value ? '●' : '○')).join(' ')}</dd>
        </dl>
      ) : null}
      {loaded?.graph.truncated ? <p role="alert">{S.truncated}</p> : null}
      {options.length > 0 ? (
        <>
          <h2>{S.moves}</h2>
          <ul>
            {options.map(({ move, left }) => (
              <li key={describeMove(move)}>{`${describeMove(move)}: ${left ?? S.none}`}</li>
            ))}
          </ul>
        </>
      ) : null}
    </main>
  );
}
