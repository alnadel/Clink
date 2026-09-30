import type { Hint, ToolName } from '@clink/rules';
import type { BoardOptions } from '../board/types';
import type { SessionSnapshot } from '../game/types';
import type { EventEnvelope } from '../ops/events';

interface Point {
  x: number;
  y: number;
}

/**
 * Test hook for Playwright: the board is a canvas, so tests need coordinates and state. Installed
 * only when the app is built with `--mode e2e`; production builds must not contain it
 * (scripts/check-no-test-hook.mjs enforces that). Spec: docs/architecture/05 §14.
 */
export interface ClinkTestHook {
  snapshot(): SessionSnapshot | null;
  glassCenter(index: number): Point;
  melodyCenter(): Point;
  toolCenter(tool: ToolName): Point;
  hint(): Promise<Hint>;
  events(): EventEnvelope[];
  warmed(): boolean;
  boardOptions(): BoardOptions | null;
}

declare global {
  interface Window {
    __clink?: Partial<ClinkTestHook>;
  }
}

export function installTestHook(): void {
  window.__clink = {};
}

/** Adds or replaces hook members. Does nothing outside e2e builds. */
export function registerTestTarget(target: Partial<ClinkTestHook>): void {
  if (window.__clink) Object.assign(window.__clink, target);
}
