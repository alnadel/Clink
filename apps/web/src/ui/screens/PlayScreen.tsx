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
import {
  canPromptNatively,
  isInstalled,
  isIosSafari,
  shouldShowInstallPrompt,
  shouldShowSurvey,
} from '../../platform/install';
import { resolveReducedMotion, systemPrefersReducedMotion, watchReducedMotion } from '../../platform/motion';
import { registerTestTarget } from '../../testing/hook';
import { GuideBanner } from '../components/GuideBanner';
import { Hud } from '../components/Hud';
import { InstallPrompt } from '../components/InstallPrompt';
import { LiveRegion } from '../components/LiveRegion';
import { SolveCard } from '../components/SolveCard';
import { SurveyModal } from '../components/SurveyModal';
import { showToast } from '../components/Toast';
import { useStore } from '../hooks/useStore';
import { actionForKey } from '../keyboard';
import { levelLabel } from '../levelLabel';
import { type Services, useServices, useT } from '../services';
import { shareResult } from '../share';

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
  const i18n = useStore(services.i18n);
  const location = useLocation();
  const host = useRef<HTMLElement>(null);
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
  const [prompt, setPrompt] = useState<{ kind: 'install' | 'survey'; then: () => void } | null>(null);

  // The new-player tutorial from a shared link: play the tutorial levels, then land in today's daily (FR-23).
  const manifest = services.content.manifest();
  const tutorial = location.query.tutorial === '1';
  const tutorialIds = manifest.guides.linkTutorial.filter((id) => manifest.levelOrder.includes(id));

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
        boardOptions: () => currentBoardOptions(svc),
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

  // Desktop keys (docs/architecture/10 §5) and the operating system's reduced-motion preference (FR-30).
  useEffect(() => {
    if (!controller) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      const action = actionForKey({
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        targetTag: target?.tagName,
        isContentEditable: target?.isContentEditable,
      });
      if (!action || document.querySelector('[role="dialog"]')) return;
      event.preventDefault();
      if (action.type === 'glass') controller.board.onGlassTap(action.index);
      else if (action.type === 'tool') controller.board.onToolTap(action.tool);
      else if (action.type === 'melody') controller.board.onMelodyTap();
      else controller.undo();
    };
    document.addEventListener('keydown', onKeyDown);
    const stopWatching = watchReducedMotion(() =>
      boardRef.current?.setOptions(currentBoardOptions(services)),
    );
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      stopWatching();
    };
  }, [controller, services]);

  const move = view?.lastMove ?? null;
  const announcement = move
    ? t(move.type === 'pour' ? 'a11y.moved' : move.type === 'faucet' ? 'a11y.faucet' : 'a11y.sink', {
        from: move.from ?? '',
        to: move.to ?? '',
        moves: move.moves,
      })
    : '';

  const share = async (): Promise<void> => {
    if (!view || view.stars === null || play.puzzleNo === null) return;
    const outcome = await shareResult({
      puzzleNo: play.puzzleNo,
      moves: services.progress.get().dailies[String(play.puzzleNo)]?.moves ?? view.moves,
      par: view.par,
      stars: services.progress.get().dailies[String(play.puzzleNo)]?.stars ?? view.stars,
      origin: window.location.origin,
    });
    if (outcome === 'share' || outcome === 'clipboard') {
      services.analytics.track('share_complete', { puzzle_no: play.puzzleNo, method: outcome });
      if (outcome === 'clipboard') showToast(t('daily.copied'));
    } else if (outcome === 'failed') {
      showToast(t('daily.shareFailed'));
    }
  };

  /** After the solve card's action, show an install prompt or the survey first if one is due (D18, D19). */
  const proceed = (then: () => void) => () => {
    const firstSolve = play.kind === 'campaign' && view?.firstSolve === true;
    if (shouldShowSurvey(play.levelId, firstSolve, profile.surveyAnswered)) {
      setPrompt({ kind: 'survey', then });
    } else if (
      shouldShowInstallPrompt(play.levelId, firstSolve, profile, isInstalled()) &&
      (canPromptNatively() || isIosSafari())
    ) {
      services.profile.update((p) => ({ ...p, installPromptCount: p.installPromptCount + 1 }));
      setPrompt({ kind: 'install', then });
    } else {
      then();
    }
  };

  const goNext = (): void => {
    if (!tutorial) {
      if (view?.nextLevelId) location.route(`/play/${view.nextLevelId}`);
      return;
    }
    const next = tutorialIds[tutorialIds.indexOf(play.levelId) + 1];
    if (next) {
      location.route(`/play/${next}?tutorial=1`);
      return;
    }
    services.profile.update((p) =>
      p.seenGuides.includes('linkTutorial') ? p : { ...p, seenGuides: [...p.seenGuides, 'linkTutorial'] },
    );
    location.route('/daily');
  };

  const title =
    play.kind === 'daily'
      ? t('play.daily', { n: play.puzzleNo ?? '' })
      : t('play.level', { n: levelLabel(play.levelId, i18n.dir === 'rtl') });
  const back = play.kind === 'daily' || tutorial ? '/' : '/map';

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
      <section class="board-host" ref={host} data-testid="board" aria-label={t('a11y.board')} />
      <LiveRegion text={view?.status === 'solved' ? t('a11y.solved') : announcement} />
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
          hasNext={tutorial || view.nextLevelId !== null}
          onNext={proceed(goNext)}
          onReplay={() => controller?.replaySong()}
          onRetry={() => void controller?.retry()}
          onMap={proceed(() => location.route('/map'))}
          onHome={() => location.route('/')}
          onShare={() => void share()}
        />
      ) : null}
      {prompt?.kind === 'install' ? (
        <InstallPrompt
          onClose={() => {
            const { then } = prompt;
            setPrompt(null);
            then();
          }}
        />
      ) : null}
      {prompt?.kind === 'survey' ? (
        <SurveyModal
          onAnswer={(answer) => {
            const { then } = prompt;
            services.analytics.track('survey_answer', { answer });
            services.profile.update((p) => ({ ...p, surveyAnswered: true }));
            setPrompt(null);
            then();
          }}
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
