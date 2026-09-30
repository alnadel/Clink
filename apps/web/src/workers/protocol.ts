/**
 * CONTRACT FILE. Messages between the play screen and the hint worker (FR-06).
 * Spec: docs/architecture/05-web-app.md §7. Do not change in an implementation issue.
 */
import type { Hint, LevelJson, State } from '@clink/rules';

export type HintWorkerRequest =
  /** Compile the level and explore its full state graph. Replaces any previously loaded level. */
  | { type: 'load'; requestId: number; level: LevelJson }
  /** Hint for `state` in the loaded level. */
  | { type: 'hint'; requestId: number; levelId: string; state: State };

export type HintWorkerResponse =
  | { type: 'loaded'; requestId: number; levelId: string; reachable: number; ms: number }
  | { type: 'hint'; requestId: number; levelId: string; hint: Hint }
  | { type: 'error'; requestId: number; message: string };
