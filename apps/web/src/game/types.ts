/**
 * CONTRACT FILE. The game session: a pure, DOM-free controller around @clink/rules.
 * Spec: docs/architecture/05-web-app.md §3. Do not change in an implementation issue.
 */
import type { Hint, Level, Move, MoveEvent, Pos, RefuseReason, State, ToolName } from '@clink/rules';

/** Everything the UI needs to draw the level right now. */
export interface SessionSnapshot {
  readonly levelId: string;
  readonly state: State;
  /** Moves on the counter = number of moves in history (undo removes one). */
  readonly moves: number;
  readonly selected: number | null;
  /** Aligned with level.targets. */
  readonly found: readonly boolean[];
  /** True once every target is found: the board is locked (rule 11). */
  readonly tuned: boolean;
  /** True once any hint was shown for this level; survives undo and restart (decision D3). */
  readonly hinted: boolean;
  readonly hints: number;
  readonly undos: number;
  readonly restarts: number;
  readonly canUndo: boolean;
}

/**
 * Side effects for the UI to perform, in order. The session never touches the DOM, audio,
 * storage or analytics itself; the play screen turns effects into those calls.
 */
export type GameEffect =
  /** Ring a glass (tap to hear). */
  | { readonly type: 'ring'; readonly glass: number; readonly pos: Pos }
  | { readonly type: 'select'; readonly glass: number | null }
  /** A refused pour or tool use: shake this glass, no move counted. */
  | { readonly type: 'shake'; readonly glass: number; readonly reason: RefuseReason }
  /** A tool was tapped with no glass selected: pulse the glasses, no move counted. */
  | { readonly type: 'need-selection'; readonly tool: ToolName }
  /** A move was made. `moveNo` is the counter after the move (1-based). */
  | {
      readonly type: 'move';
      readonly move: Move;
      readonly moveNo: number;
      readonly units: number;
      readonly events: readonly MoveEvent[];
      readonly state: State;
    }
  /** Found-note set after a move, undo or restart (always emitted after those). */
  | {
      readonly type: 'found';
      readonly found: readonly boolean[];
      readonly gained: number[];
      readonly lost: number[];
    }
  | { readonly type: 'undo'; readonly state: State }
  | { readonly type: 'restart'; readonly state: State }
  /** The level is solved; emitted once, after the 'found' of the solving move. */
  | { readonly type: 'tuned' };

export interface GameSession {
  readonly level: Level;
  snapshot(): SessionSnapshot;
  /** Rules 6 and 7. See the tap table in the spec. Returns [] when the board is locked. */
  tapGlass(glass: number): GameEffect[];
  /** Faucet or sink: acts on the selected glass (decision D9). */
  tapTool(tool: ToolName): GameEffect[];
  /** Returns [] when there is nothing to undo or the board is locked. */
  undo(): GameEffect[];
  /** Returns [] when already at the start or the board is locked. */
  restart(): GameEffect[];
  /** Records that a hint was shown (sets hinted, increments hints). Returns nothing to do. */
  noteHintShown(hint: Hint): void;
  /** Moves currently in history, oldest first (what the save stores). */
  moveList(): Move[];
}

export interface GameSessionOptions {
  /** Moves to replay silently on creation (resume from save, FR-32). Invalid moves are dropped from the first failure on. */
  readonly resumeMoves?: readonly Move[];
  readonly hinted?: boolean;
  readonly hints?: number;
  readonly undos?: number;
  readonly restarts?: number;
}
