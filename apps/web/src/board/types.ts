/**
 * CONTRACT FILE. The board: the PixiJS play area (melody bar, glasses, fill marks, tools).
 * Spec: docs/architecture/05-web-app.md §4. Do not change in an implementation issue.
 */
import type { Level, Move, MoveEvent, State, ToolName } from '@clink/rules';

export type NoteLabelMode = 'none' | 'letters' | 'solfege';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GlassLayout {
  index: number;
  /** The drawn glass. */
  body: Rect;
  /** Touch target: at least 44 x 44 CSS px, never overlapping another glass's hit rect. */
  hit: Rect;
  /** y (CSS px) of the water surface for each water amount 0..capacity. fillLineY[0] = bottom. */
  fillLineY: number[];
}

export interface BoardLayout {
  width: number;
  height: number;
  /** Height in CSS px of one unit of water. */
  unit: number;
  melodyBar: Rect;
  /** One rect per phrase note, left to right. */
  melodyNotes: Rect[];
  glasses: GlassLayout[];
  /** Present only for tools the level offers. */
  tools: Partial<Record<ToolName, Rect>>;
}

export interface BoardOptions {
  labels: NoteLabelMode;
  /** Replace movement with fades (FR-30). */
  reducedMotion: boolean;
  /** Fewer particles and no water wobble (R11). */
  lowEffects: boolean;
}

export interface BoardCallbacks {
  onGlassTap(glass: number): void;
  onMelodyTap(): void;
  onToolTap(tool: ToolName): void;
}

export interface BoardView {
  /** Creates the Pixi application inside `container` and wires pointer input. */
  mount(container: HTMLElement, callbacks: BoardCallbacks): Promise<void>;
  /** Shows a level at `state` instantly (level open, undo, restart, resume). */
  show(level: Level, state: State, found: readonly boolean[], options: BoardOptions): void;
  setOptions(options: BoardOptions): void;
  setSelected(glass: number | null): void;
  shake(glass: number): void;
  /**
   * Animates a move. Calls onStep for every event at the moment it is shown, so the caller
   * can ring the matching notes (FR-11). Resolves when the animation ends.
   */
  animateMove(
    events: readonly MoveEvent[],
    finalState: State,
    onStep: (event: MoveEvent, index: number) => void,
  ): Promise<void>;
  setFound(found: readonly boolean[]): void;
  /** Melody bar cursor while the phrase plays; null clears it. */
  setMelodyCursor(noteIndex: number | null): void;
  /** Hint arrow or pulse for a move; null clears it. */
  showHint(move: Move | null): void;
  /** Play-along glow (rule 12), pulsing at the tempo; null clears it. */
  setGlow(glass: number | null, bpm: number): void;
  /** Guide highlight (onboarding); null clears it. */
  setGuideHighlight(target: { glass?: number; melody?: boolean; tool?: ToolName } | null): void;
  setLocked(locked: boolean): void;
  /** Call on container resize. */
  resize(): void;
  destroy(): void;
}
