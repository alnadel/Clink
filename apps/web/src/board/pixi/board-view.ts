// The strict CSP forbids eval; this module removes Pixi's use of it. It must come first.
import 'pixi.js/unsafe-eval';
import type { Level, Move, MoveEvent, State, ToolName } from '@clink/rules';
import { Application, type FederatedPointerEvent } from 'pixi.js';
import { computeLayout } from '../layout';
import type { BoardCallbacks, BoardOptions, BoardView, Rect } from '../types';
import { BoardScene } from './scene';
import { type Tween, tween } from './tween';

const UNIT_MS = 110;
const MELT_MS = 220;
const TILT_RADIANS = (15 * Math.PI) / 180;

const inside = (rect: Rect, x: number, y: number): boolean =>
  x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;

/** The PixiJS board. Spec: docs/architecture/05-web-app.md §4. */
export function createBoardView(): BoardView {
  const scene = new BoardScene();
  let app: Application | null = null;
  let callbacks: BoardCallbacks | null = null;
  let options: BoardOptions = { labels: 'none', reducedMotion: false, lowEffects: false };
  let level: Level | null = null;
  let live: State = { water: [], ice: [] };
  let found: readonly boolean[] = [];
  let selected: number | null = null;
  let glowGlass: number | null = null;
  let glowPeriod: number | null = null;
  let guideTarget: Parameters<BoardView['setGuideHighlight']>[0] = null;
  let hintMove: Move | null = null;
  let cursorNote: number | null = null;
  let pending: (() => void) | null = null;
  let run: { skip: boolean } | null = null;
  const tweens = new Set<Tween>();

  const startTween = (durationMs: number, onUpdate: (progress: number) => void): Tween | null => {
    if (!app) return null;
    const t = tween(app.ticker, durationMs, onUpdate);
    tweens.add(t);
    void t.done.then(() => tweens.delete(t));
    return t;
  };

  /** Finishes every running animation at once; a running move then completes instantly. */
  const snapAll = (): void => {
    if (run) run.skip = true;
    for (const t of [...tweens]) t.finish();
  };

  const render = (): void => {
    if (!app || !level) return;
    const layout = computeLayout(app.screen.width, app.screen.height, level);
    scene.build(level, layout, live, found, options);
    scene.setSelected(selected, options.reducedMotion);
    scene.setGlowRect(glowGlass);
    // A rebuild (resize, options) wipes the overlays, so they are drawn again from the layout that now applies.
    scene.setGuideTarget(guideTarget);
    scene.setHint(hintMove);
    scene.setCursor(cursorNote);
  };

  const onPointerDown = (event: FederatedPointerEvent): void => {
    if (!callbacks || !level) return;
    const { x, y } = event.global;
    const { layout } = scene;
    for (const tool of ['faucet', 'sink'] as const) {
      const rect = layout.tools[tool];
      if (rect && inside(rect, x, y)) {
        callbacks.onToolTap(tool);
        return;
      }
    }
    if (inside(layout.melodyBar, x, y)) {
      callbacks.onMelodyTap();
      return;
    }
    const index = layout.glasses.findIndex((glass) => inside(glass.hit, x, y));
    if (index >= 0) callbacks.onGlassTap(index);
  };

  /** Animates one unit of water leaving and/or entering glasses. */
  const animateUnit = async (event: Extract<MoveEvent, { type: 'unit' }>, skip: boolean): Promise<void> => {
    const { from, to } = event;
    if (from !== null && event.fromPos !== null) scene.setRingPos(from, event.fromPos);
    if (to !== null && event.toPos !== null) scene.setRingPos(to, event.toPos);
    const startFrom = from === null ? 0 : (live.water[from] ?? 0);
    const startTo = to === null ? 0 : (live.water[to] ?? 0);
    const water = [...live.water];
    if (from !== null) water[from] = startFrom - 1;
    if (to !== null) water[to] = startTo + 1;
    live = { ...live, water };
    if (skip) {
      if (from !== null) scene.setWater(from, startFrom - 1);
      if (to !== null) scene.setWater(to, startTo + 1);
      return;
    }
    const streaming = !options.lowEffects && !options.reducedMotion;
    if (streaming) scene.setStream(from, to, to === null ? null : scene.glassColor(to));
    await startTween(UNIT_MS, (p) => {
      if (from !== null) scene.setWater(from, startFrom - p);
      if (to !== null) scene.setWater(to, startTo + p);
    })?.done;
    if (streaming) scene.setStream(null, null, null);
  };

  const animateMelt = async (event: Extract<MoveEvent, { type: 'melt' }>, skip: boolean): Promise<void> => {
    const before = live.water[event.glass] ?? 0;
    const water = [...live.water];
    water[event.glass] = before + 1;
    const ice = [...live.ice];
    ice[event.cube] = 0;
    live = { water, ice };
    scene.setRingPos(event.glass, event.pos);
    if (skip) {
      scene.setIce(event.cube, 0, 0, 1);
      scene.setWater(event.glass, before + 1);
      return;
    }
    await startTween(MELT_MS / 2, (p) => scene.setIce(event.cube, 1, 1 - p, 1 - 0.7 * p))?.done;
    scene.setIce(event.cube, 0, 0, 1);
    await startTween(MELT_MS / 2, (p) => scene.setWater(event.glass, before + p))?.done;
  };

  const animateSpill = async (event: Extract<MoveEvent, { type: 'spill' }>, skip: boolean): Promise<void> => {
    const ice = [...live.ice];
    ice[event.cube] = 0;
    live = { ...live, ice };
    if (!skip) await startTween(MELT_MS, (p) => scene.setIce(event.cube, 1, 1 - p, 1))?.done;
    scene.setIce(event.cube, 0, 0, 1);
  };

  return {
    async mount(container, cb) {
      callbacks = cb;
      container.setAttribute('dir', 'ltr'); // the board never mirrors in right-to-left layouts (FR-31)
      const application = new Application();
      await application.init({
        resizeTo: container,
        backgroundAlpha: 0,
        antialias: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
      });
      app = application;
      container.appendChild(application.canvas);
      application.stage.addChild(scene.root);
      application.stage.eventMode = 'static';
      application.stage.hitArea = application.screen;
      application.stage.on('pointerdown', onPointerDown);
      application.ticker.add(() => scene.pulse(performance.now(), glowPeriod, options.reducedMotion));
      pending?.();
      pending = null;
    },

    show(nextLevel, state, nextFound, nextOptions) {
      // Overlays belong to the level being opened. They are cleared now, not when Pixi is ready, so a guide
      // step or hint set right after this call survives a mount that finishes later.
      selected = null;
      glowGlass = null;
      glowPeriod = null;
      guideTarget = null;
      hintMove = null;
      cursorNote = null;
      const apply = () => {
        snapAll();
        level = nextLevel;
        live = state;
        found = nextFound;
        options = nextOptions;
        render();
      };
      if (app) apply();
      else pending = apply;
    },

    setOptions(next) {
      options = next;
      render();
    },

    setSelected(glass) {
      selected = glass;
      if (level) scene.setSelected(glass, options.reducedMotion);
    },

    shake(glass) {
      if (!level) return;
      if (options.reducedMotion) {
        startTween(240, (p) => scene.setFlash(glass, 1 - p));
        return;
      }
      startTween(240, (p) => scene.setShake(glass, Math.sin(p * 3 * 2 * Math.PI) * 6 * (p >= 1 ? 0 : 1)));
    },

    async animateMove(events, finalState, onStep) {
      if (!level) return;
      snapAll();
      const current = { skip: false };
      run = current;

      // The source tilts toward the target for the length of a pour (not with reduced motion or low effects).
      const first = events[0];
      if (first?.type === 'unit' && first.from !== null && first.to !== null) {
        const source = first.from;
        const direction = first.to > source ? 1 : -1;
        const units = events.filter((e) => e.type === 'unit').length;
        if (!options.reducedMotion && !options.lowEffects) {
          startTween(units * UNIT_MS, (p) =>
            scene.setTilt(source, direction * TILT_RADIANS * Math.sin(Math.PI * p)),
          );
        }
      }

      for (const [i, event] of events.entries()) {
        onStep(event, i);
        if (event.type === 'unit') await animateUnit(event, current.skip);
        else if (event.type === 'melt') await animateMelt(event, current.skip);
        else await animateSpill(event, current.skip);
      }
      if (run === current) run = null;
      live = finalState;
      scene.setState(finalState);
      scene.setSelected(selected, options.reducedMotion);
    },

    setFound(next) {
      found = next;
      if (level) scene.setFound(next);
    },

    setMelodyCursor(noteIndex) {
      cursorNote = noteIndex;
      if (level) scene.setCursor(noteIndex);
    },

    showHint(move: Move | null) {
      hintMove = move;
      if (level) scene.setHint(move);
    },

    setGlow(glass, bpm) {
      glowGlass = glass;
      glowPeriod = glass === null ? null : 60 / bpm;
      if (level) scene.setGlowRect(glass);
    },

    setGuideHighlight(target: { glass?: number; melody?: boolean; tool?: ToolName } | null) {
      guideTarget = target;
      if (level) scene.setGuideTarget(target);
    },

    setLocked(locked) {
      if (level) scene.setLocked(locked);
    },

    resize() {
      app?.resize();
      render();
    },

    destroy() {
      snapAll();
      app?.destroy({ removeView: true }, { children: true });
      app = null;
      callbacks = null;
    },
  };
}
