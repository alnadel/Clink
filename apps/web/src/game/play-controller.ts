import {
  foundTargets,
  type Hint,
  type Level,
  type LevelJson,
  type Move,
  type MoveEvent,
  type RemoteConfig,
  ringing,
  starsFor,
  type ToolName,
} from '@clink/rules';
import type { AudioEngine, PhrasePlayback } from '../audio/types';
import type { BoardCallbacks, BoardOptions, BoardView } from '../board/types';
import type { ContentStore } from '../content/store';
import { createGuideDriver, type GuideDriver } from '../guide/driver';
import type { GuideEvent } from '../guide/runner';
import { selectScripts } from '../guide/select';
import { createStore, type Store } from '../lib/store';
import type { Analytics } from '../ops/events';
import type { ResolvedFlags } from '../ops/flags';
import type { CurrentLevel, Profile, Progress, SaveStore } from '../save/types';
import type { HintClient } from '../workers/hint-client';
import { createPlayAlong, glassForNote } from './playalong';
import { createGameSession } from './session';
import type { GameEffect, GameSession, SessionSnapshot } from './types';

export interface PlayTarget {
  kind: 'campaign' | 'daily';
  levelId: string;
  /** Daily puzzle number, or null for campaign levels. */
  puzzleNo: number | null;
}

/** The subset of the app's services the controller needs (game/ never imports ui/). */
export interface PlayDeps {
  save: SaveStore;
  audio: AudioEngine;
  analytics: Analytics;
  content: ContentStore;
  hints: HintClient;
  profile: Store<Profile>;
  progress: Store<Progress>;
  flags: Store<ResolvedFlags>;
  config: Store<RemoteConfig>;
}

export interface PlayOptions {
  /** Current board options (labels, reduced motion), read fresh each time. */
  boardOptions(): BoardOptions;
  /** Shows a message for an i18n key (e.g. 'play.selectGlassFirst'). */
  notify(key: string): void;
  /** Called when the level cannot be shown (unknown id). */
  onMissing?(): void;
}

export interface PlayViewState {
  status: 'loading' | 'missing' | 'playing' | 'song' | 'solved';
  moves: number;
  par: number;
  canUndo: boolean;
  hintReady: boolean;
  /** True while the play-along asks the player to tap glasses (a Skip button shows). */
  songActive: boolean;
  /** i18n key of the guide line to show, or null. */
  guideTextKey: string | null;
  stars: 1 | 2 | 3 | null;
  tuneTitle: string;
  tuneOrigin: string;
  nextLevelId: string | null;
}

export interface PlayController {
  readonly view: Store<PlayViewState>;
  /** Wire these to BoardView.mount. */
  readonly board: BoardCallbacks;
  level(): Level | null;
  snapshot(): SessionSnapshot | null;
  undo(): void;
  restart(): void;
  hint(): Promise<void>;
  skipSong(): void;
  replaySong(): void;
  retry(): Promise<void>;
  dispose(): void;
}

const INITIAL: PlayViewState = {
  status: 'loading',
  moves: 0,
  par: 0,
  canUndo: false,
  hintReady: false,
  songActive: false,
  guideTextKey: null,
  stars: null,
  tuneTitle: '',
  tuneOrigin: '',
  nextLevelId: null,
};

const SOLVE_PAUSE_MS = 600;
const SONG_REPLAY_PAUSE_MS = 300;

/**
 * Turns the game session's effects into board, audio, save and analytics actions, and runs the solve
 * flow (play-along, stars, progress). Spec: docs/architecture/05-web-app.md §5-§6.
 */
export function createPlayController(
  deps: PlayDeps,
  board: BoardView,
  target: PlayTarget,
  options: PlayOptions,
): PlayController {
  const view = createStore<PlayViewState>(INITIAL);
  let level: Level | null = null;
  let levelJson: LevelJson | null = null;
  let session: GameSession | null = null;
  let disposed = false;
  let abandonSent = false;
  let attempt = 1;
  let accumulatedMs = 0;
  let visibleSince: number | null =
    typeof document !== 'undefined' && document.visibilityState === 'visible' ? performance.now() : null;
  let songTap: ((glass: number) => void) | null = null;
  let songSkip: (() => void) | null = null;
  let replay: PhrasePlayback | null = null;
  let guide: GuideDriver | null = null;
  const timers = new Set<ReturnType<typeof setTimeout>>();

  const elapsedMs = (): number =>
    accumulatedMs + (visibleSince === null ? 0 : performance.now() - visibleSince);
  const onVisibility = (): void => {
    const now = performance.now();
    if (document.visibilityState === 'hidden' && visibleSince !== null) {
      accumulatedMs += now - visibleSince;
      visibleSince = null;
    } else if (document.visibilityState === 'visible' && visibleSince === null) {
      visibleSince = now;
    }
  };
  const onPageHide = (): void => {
    persist();
    sendAbandon();
  };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onPageHide);

  const wait = (ms: number): Promise<void> =>
    new Promise((resolve) => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        resolve();
      }, ms);
      timers.add(timer);
    });

  const hz = (pos: number): number => level?.positions[pos]?.hz ?? 440;
  const glassId = (index: number | null): string | null =>
    index === null ? null : (level?.glasses[index]?.id ?? null);

  const syncView = (): void => {
    if (!session) return;
    const snap = session.snapshot();
    view.update((v) => ({ ...v, moves: snap.moves, canUndo: snap.canUndo }));
  };

  const persist = (): void => {
    if (!session || !level) return;
    const snap = session.snapshot();
    const current: CurrentLevel = {
      schema: 1,
      kind: target.kind,
      levelId: target.levelId,
      puzzleNo: target.puzzleNo,
      levelHash: deps.content.manifest().levelHashes[target.levelId] ?? '',
      moves: session.moveList(),
      hinted: snap.hinted,
      hints: snap.hints,
      undos: snap.undos,
      restarts: snap.restarts,
      elapsedMs: Math.round(elapsedMs()),
      attempt,
    };
    void deps.save.saveCurrent(current);
  };

  function sendAbandon(): void {
    if (abandonSent || !session) return;
    const snap = session.snapshot();
    if (snap.tuned || snap.moves < 1) return;
    abandonSent = true;
    deps.analytics.track('level_abandon', {
      level_id: target.levelId,
      moves: snap.moves,
      seconds: Math.round(elapsedMs() / 1000),
    });
  }

  const nextLevelId = (): string | null => {
    const order = deps.content.manifest().levelOrder;
    const disabled = new Set(deps.config.get().disabledLevels);
    const start = order.indexOf(target.levelId);
    if (target.kind !== 'campaign' || start < 0) return null;
    return order.slice(start + 1).find((id) => !disabled.has(id)) ?? null;
  };

  // --- guides (onboarding, intros) --------------------------------------------------------------

  const applyGuideStep = (): void => {
    const step = guide?.current() ?? null;
    view.update((v) => ({ ...v, guideTextKey: step?.textKey ?? null }));
    board.setGuideHighlight(step?.highlight ?? null);
  };

  const feedGuide = (events: readonly GuideEvent[]): void => {
    if (!guide) return;
    const result = guide.feed(events);
    if (result.completedStep) deps.analytics.track('ftue_step', { step: result.completedStep });
    const finished = result.finishedScript;
    if (finished) {
      deps.profile.update((p) =>
        p.seenGuides.includes(finished) ? p : { ...p, seenGuides: [...p.seenGuides, finished] },
      );
    }
    if (result.completedStep) applyGuideStep();
  };

  const guideEvents = (effects: readonly GameEffect[]): GuideEvent[] => {
    const events: GuideEvent[] = [];
    for (const effect of effects) {
      if (effect.type === 'ring') events.push({ on: 'ring', glass: effect.glass });
      else if (effect.type === 'move') {
        const move = effect.move;
        events.push(
          move.type === 'pour'
            ? { on: 'pour', from: move.from, to: move.to }
            : { on: 'tool', tool: move.type },
        );
      } else if (effect.type === 'found')
        for (const target of effect.gained) events.push({ on: 'found', target });
      else if (effect.type === 'tuned') events.push({ on: 'tuned' });
    }
    return events;
  };

  // --- opening a level --------------------------------------------------------------------------

  const open = async (resume: boolean): Promise<void> => {
    view.set(INITIAL);
    try {
      [level, levelJson] = await Promise.all([
        deps.content.level(target.levelId),
        deps.content.levelJson(target.levelId),
      ]);
    } catch {
      view.update((v) => ({ ...v, status: 'missing' }));
      options.onMissing?.();
      return;
    }
    if (disposed) return;

    const stored = resume ? await deps.save.loadCurrent() : null;
    const hash = deps.content.manifest().levelHashes[target.levelId] ?? '';
    const resumable =
      stored !== null &&
      stored.levelId === target.levelId &&
      stored.kind === target.kind &&
      stored.puzzleNo === target.puzzleNo &&
      stored.levelHash === hash;
    if (resumable) {
      attempt = stored.attempt;
      accumulatedMs = stored.elapsedMs;
    } else {
      attempt = (deps.profile.get().levelAttempts[target.levelId] ?? 0) + 1;
      accumulatedMs = 0;
      deps.profile.update((p) => ({
        ...p,
        levelAttempts: { ...p.levelAttempts, [target.levelId]: attempt },
      }));
    }
    session = createGameSession(
      level,
      resumable
        ? {
            resumeMoves: stored.moves,
            hinted: stored.hinted,
            hints: stored.hints,
            undos: stored.undos,
            restarts: stored.restarts,
          }
        : {},
    );
    abandonSent = false;
    const snap = session.snapshot();
    board.show(level, snap.state, snap.found, options.boardOptions());
    board.setLocked(snap.tuned);
    view.set({
      ...INITIAL,
      status: 'playing',
      moves: snap.moves,
      par: level.par,
      canUndo: snap.canUndo,
      nextLevelId: nextLevelId(),
    });
    const variant = deps.flags.get().flags.onboardingVariant;
    guide = createGuideDriver(
      snap.tuned
        ? []
        : selectScripts(
            target.levelId,
            level,
            deps.content.manifest().guides,
            deps.profile.get().seenGuides,
            typeof variant === 'string' ? variant : 'a',
          ),
    );
    applyGuideStep();
    if (!resumable) persist();
    deps.analytics.track('level_start', { level_id: target.levelId, world: level.world, attempt });
    if (target.kind === 'daily' && target.puzzleNo !== null)
      deps.analytics.track('daily_start', { puzzle_no: target.puzzleNo });
    if (snap.tuned) {
      void solveFlow();
      return;
    }
    void deps.hints
      .load(levelJson)
      .then(() => {
        if (!disposed) view.update((v) => ({ ...v, hintReady: true }));
      })
      .catch(() => {});
  };

  // --- handling effects -------------------------------------------------------------------------

  const stepSounds = (event: MoveEvent, index: number, move: Move): void => {
    if (event.type === 'unit') {
      if (index === 0)
        deps.audio.sfx(move.type === 'faucet' ? 'faucet' : move.type === 'sink' ? 'drain' : 'pour');
      // Both glasses ring their new notes for each unit: an in-tune run (rule 7, FR-11).
      if (event.fromPos !== null) deps.audio.ring(hz(event.fromPos), undefined, 0.6);
      if (event.toPos !== null) deps.audio.ring(hz(event.toPos), undefined, 0.6);
    } else if (event.type === 'melt') {
      deps.audio.sfx('melt');
      deps.audio.ring(hz(event.pos), undefined, 0.6);
    } else {
      deps.audio.sfx('ice-clink');
    }
  };

  const handleEffects = async (effects: GameEffect[]): Promise<void> => {
    for (const effect of effects) {
      if (disposed || !level || !session) return;
      switch (effect.type) {
        case 'ring':
          deps.audio.ring(hz(effect.pos));
          break;
        case 'select':
          board.setSelected(effect.glass);
          break;
        case 'shake':
          board.shake(effect.glass);
          deps.audio.sfx('refuse');
          break;
        case 'need-selection':
          options.notify('play.selectGlassFirst');
          break;
        case 'move': {
          board.showHint(null);
          const move = effect.move;
          await board.animateMove(effect.events, effect.state, (event, index) =>
            stepSounds(event, index, move),
          );
          persist();
          syncView();
          deps.analytics.track('move', {
            level_id: target.levelId,
            move_no: effect.moveNo,
            type: move.type,
            from:
              move.type === 'pour' ? glassId(move.from) : move.type === 'sink' ? glassId(move.glass) : null,
            to: move.type === 'pour' ? glassId(move.to) : move.type === 'faucet' ? glassId(move.glass) : null,
            units: effect.units,
          });
          break;
        }
        case 'found':
          board.setFound(effect.found);
          if (effect.gained.length > 0) deps.audio.sfx('found');
          break;
        case 'undo':
        case 'restart':
          board.show(level, effect.state, foundTargets(level, effect.state), options.boardOptions());
          board.showHint(null);
          persist();
          syncView();
          break;
        case 'tuned':
          syncView();
          await solveFlow();
          break;
      }
    }
    syncView();
  };

  // --- the solve flow: song, stars, progress ----------------------------------------------------

  const finishSong = (song: 'played' | 'auto' | 'skipped'): void => {
    songTap = null;
    songSkip = null;
    board.setGlow(null, 60);
    board.setMelodyCursor(null);
    view.update((v) => ({ ...v, songActive: false }));
    finish(song);
  };

  const playPhrase = (onNote?: (index: number) => void): PhrasePlayback => {
    const melody = (level as Level).melody;
    return deps.audio.playPhrase(melody.notes.map(hz), melody.beats, melody.bpm, (i) => {
      board.setMelodyCursor(i);
      onNote?.(i);
    });
  };

  const playAlong = (): void => {
    if (!level || !session) return;
    const activeLevel = level;
    const state = session.snapshot().state;
    const pa = createPlayAlong(activeLevel, state);
    view.update((v) => ({ ...v, songActive: true }));
    const showCurrent = (): void => {
      board.setGlow(pa.current(), activeLevel.melody.bpm);
      board.setMelodyCursor(pa.noteIndex());
    };
    showCurrent();
    songSkip = () => {
      replay?.stop();
      finishSong('skipped');
    };
    songTap = (glass) => {
      const pos = ringing(activeLevel, state)[glass];
      if (pos !== undefined) deps.audio.ring(hz(pos));
      const result = pa.tap(glass);
      if (result === 'advance') showCurrent();
      if (result === 'done') {
        songTap = null;
        board.setGlow(null, 60);
        void wait(SONG_REPLAY_PAUSE_MS).then(() => {
          if (disposed) return;
          replay = playPhrase();
          void replay.done.then(() => {
            if (!disposed && songSkip) finishSong('played');
          });
        });
      }
    };
  };

  const autoPlay = (): void => {
    if (!level || !session) return;
    const activeLevel = level;
    const state = session.snapshot().state;
    view.update((v) => ({ ...v, songActive: true }));
    songSkip = () => {
      replay?.stop();
      finishSong('skipped');
    };
    replay = playPhrase((i) => board.setGlow(glassForNote(activeLevel, state, i), activeLevel.melody.bpm));
    void replay.done.then(() => {
      if (!disposed && songSkip) finishSong('auto');
    });
  };

  /** Final steps once the song ends: progress, analytics, and the solve card. */
  const finish = (song: 'played' | 'auto' | 'skipped'): void => {
    if (!level || !session) return;
    const snap = session.snapshot();
    const stars = solvedStars();
    recordProgress(stars, snap.moves);
    deps.analytics.track('level_complete', { level_id: target.levelId, stars, song });
    if (target.kind === 'daily' && target.puzzleNo !== null) {
      deps.analytics.track('daily_complete', {
        puzzle_no: target.puzzleNo,
        moves: snap.moves,
        par: level.par,
      });
    }
    const tune = deps.content.manifest().tunes[level.melody.tuneId];
    view.update((v) => ({
      ...v,
      status: 'solved',
      stars,
      tuneTitle: tune?.title ?? level?.melody.title ?? '',
      tuneOrigin: tune?.origin ?? '',
    }));
  };

  const solvedStars = (): 1 | 2 | 3 => {
    if (!level || !session) return 1;
    const snap = session.snapshot();
    const factor = deps.flags.get().flags.twoStarFactor;
    return starsFor(snap.moves, level.par, snap.hinted, typeof factor === 'number' ? factor : undefined);
  };

  const recordProgress = (stars: 1 | 2 | 3, moves: number): void => {
    const now = new Date().toISOString();
    if (target.kind === 'daily' && target.puzzleNo !== null) {
      const key = String(target.puzzleNo);
      // A daily keeps its first solve (D28).
      if (!deps.progress.get().dailies[key]) {
        deps.progress.update((p) => ({
          ...p,
          dailies: { ...p.dailies, [key]: { moves, par: level?.par ?? 0, stars } },
        }));
      }
      return;
    }
    deps.progress.update((p) => {
      const existing = p.levels[target.levelId];
      return {
        ...p,
        levels: {
          ...p.levels,
          [target.levelId]: {
            stars: existing ? (Math.max(existing.stars, stars) as 1 | 2 | 3) : stars,
            bestMoves: existing ? Math.min(existing.bestMoves, moves) : moves,
            solvedAt: existing?.solvedAt ?? now,
          },
        },
      };
    });
  };

  const solveFlow = async (): Promise<void> => {
    if (!level || !session) return;
    const snap = session.snapshot();
    board.setLocked(true);
    void deps.save.saveCurrent(null);
    view.update((v) => ({ ...v, status: 'song' }));
    deps.analytics.track('level_tuned', {
      level_id: target.levelId,
      moves: snap.moves,
      par: level.par,
      hints: snap.hints,
      undos: snap.undos,
      restarts: snap.restarts,
      seconds: Math.round(elapsedMs() / 1000),
    });
    deps.audio.sfx('flourish');
    await wait(SOLVE_PAUSE_MS);
    if (disposed) return;
    if (deps.profile.get().settings.autoPlaySong) autoPlay();
    else playAlong();
  };

  // --- input ------------------------------------------------------------------------------------

  const unlockAudio = (): void => {
    if (deps.audio.status === 'locked') void deps.audio.unlock();
  };

  const run = (effects: GameEffect[]): void => {
    // Save the moment the session accepts a move, not when its animation ends: a player who closes the
    // tab half a second after a move must not lose it (FR-32).
    if (effects.some((e) => e.type === 'move' || e.type === 'undo' || e.type === 'restart')) persist();
    void handleEffects(effects);
  };

  /** Runs an accepted input's effects and tells the guide what happened. */
  const runInput = (effects: GameEffect[]): void => {
    feedGuide([...guideEvents(effects), { on: 'tap' }]);
    run(effects);
  };

  const callbacks: BoardCallbacks = {
    onGlassTap(glass) {
      unlockAudio();
      if (!session || !level) return;
      if (songTap) return songTap(glass);
      if (session.snapshot().tuned) {
        const pos = ringing(level, session.snapshot().state)[glass];
        if (pos !== undefined) deps.audio.ring(hz(pos));
        return;
      }
      if (guide && !guide.allows({ kind: 'glass', glass })) return applyGuideStep();
      runInput(session.tapGlass(glass));
    },
    onMelodyTap() {
      unlockAudio();
      if (!level) return;
      if (guide && !guide.allows({ kind: 'melody' })) return applyGuideStep();
      feedGuide([{ on: 'melody' }, { on: 'tap' }]);
      replay?.stop();
      replay = playPhrase();
      void replay.done.then(() => board.setMelodyCursor(null));
    },
    onToolTap(tool: ToolName) {
      unlockAudio();
      if (!session) return;
      if (guide && !guide.allows({ kind: 'tool', tool })) return applyGuideStep();
      runInput(session.tapTool(tool));
    },
  };

  void open(true);

  return {
    view,
    board: callbacks,
    level: () => level,
    snapshot: () => session?.snapshot() ?? null,
    undo() {
      if (session && (!guide || guide.allows({ kind: 'undo' }))) runInput(session.undo());
    },
    restart() {
      if (session) run(session.restart());
    },
    async hint() {
      if (!session || !level) return;
      const snap = session.snapshot();
      if (snap.tuned || (guide && !guide.allows({ kind: 'hint' }))) return;
      let result: Hint;
      try {
        result = await deps.hints.hint(level.id, snap.state);
      } catch {
        return;
      }
      if (disposed || !session) return;
      if (result.type === 'move') {
        board.showHint(result.move);
      } else if (result.type === 'restart') {
        options.notify('play.hintRestart');
      } else {
        return;
      }
      session.noteHintShown(result);
      deps.analytics.track('hint_used', { level_id: level.id, move_no: snap.moves });
      persist();
    },
    skipSong() {
      songSkip?.();
    },
    replaySong() {
      if (!level) return;
      replay?.stop();
      replay = playPhrase();
    },
    async retry() {
      replay?.stop();
      songTap = null;
      songSkip = null;
      board.setGlow(null, 60);
      board.setMelodyCursor(null);
      board.setLocked(false);
      await open(false);
    },
    dispose() {
      sendAbandon();
      disposed = true;
      for (const timer of timers) clearTimeout(timer);
      replay?.stop();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
    },
  };
}
