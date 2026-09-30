import type { ToolName } from '@clink/rules';
import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { computeLayout } from '../../board/layout';
import { createBoardView } from '../../board/pixi/board-view';
import type { BoardOptions, BoardView } from '../../board/types';
import { createPlayController, type PlayController, type PlayTarget } from '../../game/play-controller';
import { levelStatuses } from '../../game/unlocks';
import { setCurrentLevelId } from '../../ops/errors';
import { resolveReducedMotion, systemPrefersReducedMotion } from '../../platform/motion';
import { registerTestTarget } from '../../testing/hook';
import { GuideBanner } from '../components/GuideBanner';
import { Hud } from '../components/Hud';
import { SolveCard } from '../components/SolveCard';
import { showToast } from '../components/Toast';
import { useStore } from '../hooks/useStore';
import { type Services, useServices, useT } from '../services';

interface PlayScreenProps {
  levelId?: string;
  kind?: 'campaign' | 'daily';
  /** Daily puzzles are resolved by the /daily route and passed in. */
  target?: PlayTarget;
}

/** Plays one level: the HUD, the Pixi board and the solve card (docs/architecture/05 §5). */
export function PlayScreen({ levelId = '', kind = 'campaign', target }: PlayScreenProps): JSX.Element {
  const services = useServices();
  const t = useT();
  const location = useLocation();
  const host = useRef<HTMLDivElement>(null);
  const boardRef = useRef<BoardView | null>(null);
  const [controller, setController] = useState<PlayController | null>(null);
  const play: PlayTarget = target ?? { kind, levelId, puzzleNo: null };
  const targetKey = `${play.kind}:${play.levelId}:${play.puzzleNo}`;
  const latest = useRef({ play, services });
  latest.current = { play, services };
  const profile = useStore(services.profile);
  const progressNow = useStore(services.progress);
  const disabled = useStore(services.config).disabledLevels;
  const locked =
    play.kind === 'campaign' &&
    levelStatuses(services.content.manifest().levelOrder, new Set(disabled), progressNow).get(
      play.levelId,
    ) === 'locked';
  const view = useStore(controller?.view ?? null);

  useEffect(() => {
    if (locked) {
      location.route('/map', true);
      return;
    }
    const container = host.current;
    if (!container) return;
    const board = createBoardView();
    boardRef.current = board;
    let disposed = false;
    let created: PlayController | null = null;
    // Tests read the board only once Pixi has mounted, so a tap can never hit an empty container.
    let boardReady = false;

    const { play: current, services: svc } = latest.current;
    const ctl = createPlayController(svc, board, current, {
      boardOptions: () => currentBoardOptions(svc),
      notify: (key) => showToast(svc.i18n.get().t(key)),
    });
    created = ctl;
    void board.mount(container, ctl.board).then(() => {
      if (disposed) return;
      boardReady = true;
      // The controller shows the level once it has loaded; a mount that finishes later still gets it.
      setController(ctl);
    });

    setCurrentLevelId(current.levelId);
    const observer = new ResizeObserver(() => board.resize());
    observer.observe(container);

    if (import.meta.env.MODE === 'e2e') {
      registerTestTarget({
        snapshot: () => (boardReady ? ctl.snapshot() : null),
        glassCenter: (index) => centerOf(container, ctl, index),
        melodyCenter: () => {
          const level = ctl.level();
          if (!level) return { x: 0, y: 0 };
          const bar = computeLayout(container.clientWidth, container.clientHeight, level).melodyBar;
          return pageCenter(container, bar);
        },
        toolCenter: (tool: ToolName) => {
          const level = ctl.level();
          const rect =
            level && computeLayout(container.clientWidth, container.clientHeight, level).tools[tool];
          return rect ? pageCenter(container, rect) : { x: 0, y: 0 };
        },
        hint: async () => {
          const level = ctl.level();
          const snap = ctl.snapshot();
          if (!level || !snap) return { type: 'none' };
          return svc.hints.hint(level.id, snap.state);
        },
      });
    }

    return () => {
      disposed = true;
      observer.disconnect();
      created?.dispose();
      setCurrentLevelId(null);
      board.destroy();
      boardRef.current = null;
      setController(null);
    };
    // Only the level's identity recreates the board; everything else is read through `latest`.
  }, [targetKey, locked]);

  const { labels, reducedMotion } = profile.settings;
  useEffect(() => {
    boardRef.current?.setOptions({
      labels,
      reducedMotion: resolveReducedMotion(reducedMotion, systemPrefersReducedMotion()),
      lowEffects: false,
    });
  }, [labels, reducedMotion]);

  const title =
    play.kind === 'daily'
      ? t('play.daily', { n: play.puzzleNo ?? '' })
      : t('play.level', { n: play.levelId });
  const back = play.kind === 'daily' ? '/' : '/map';

  return (
    <div class="play">
      <Hud
        title={title}
        back={back}
        moves={view?.moves ?? 0}
        par={view?.par ?? 0}
        canUndo={view?.canUndo ?? false}
        canRestart={(view?.moves ?? 0) > 0 && view?.status === 'playing'}
        hintReady={(view?.hintReady ?? false) && view?.status === 'playing'}
        onUndo={() => controller?.undo()}
        onRestart={() => controller?.restart()}
        onHint={() => void controller?.hint()}
      />
      <GuideBanner textKey={view?.guideTextKey ?? null} />
      <div class="board-host" ref={host} data-testid="board" />
      {view?.status === 'missing' ? <p class="muted center">{t('play.notFound')}</p> : null}
      {view?.songActive ? (
        <button type="button" class="btn skip" onClick={() => controller?.skipSong()}>
          {t('solve.skip')}
        </button>
      ) : null}
      {view?.status === 'solved' && view.stars !== null ? (
        <SolveCard
          stars={view.stars}
          moves={view.moves}
          par={view.par}
          tuneTitle={view.tuneTitle}
          tuneOrigin={view.tuneOrigin}
          kind={play.kind}
          hasNext={view.nextLevelId !== null}
          onNext={() => view.nextLevelId && location.route(`/play/${view.nextLevelId}`)}
          onReplay={() => controller?.replaySong()}
          onRetry={() => void controller?.retry()}
          onMap={() => location.route('/map')}
          onHome={() => location.route('/')}
        />
      ) : null}
    </div>
  );
}

function currentBoardOptions(services: Services): BoardOptions {
  const { labels, reducedMotion } = services.profile.get().settings;
  return {
    labels,
    reducedMotion: resolveReducedMotion(reducedMotion, systemPrefersReducedMotion()),
    lowEffects: false,
  };
}

function pageCenter(container: HTMLElement, rect: { x: number; y: number; width: number; height: number }) {
  const box = container.getBoundingClientRect();
  return { x: box.left + rect.x + rect.width / 2, y: box.top + rect.y + rect.height / 2 };
}

function centerOf(container: HTMLElement, controller: PlayController, index: number) {
  const level = controller.level();
  const glass = level && computeLayout(container.clientWidth, container.clientHeight, level).glasses[index];
  return glass ? pageCenter(container, glass.hit) : { x: 0, y: 0 };
}
