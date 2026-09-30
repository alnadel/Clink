import type { Ticker } from 'pixi.js';

export interface Tween {
  readonly done: Promise<void>;
  /** Jumps to the end state and resolves. */
  finish(): void;
}

export const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
export const linear = (t: number): number => t;

/**
 * A small tween on the Pixi ticker. `onUpdate` receives eased progress 0..1 and is always called with 1
 * at the end, whether the tween runs out or is finished early. No dependencies.
 */
export function tween(
  ticker: Ticker,
  durationMs: number,
  onUpdate: (progress: number) => void,
  ease: (t: number) => number = easeInOut,
): Tween {
  let elapsed = 0;
  let ended = false;
  let resolve: () => void = () => {};
  const done = new Promise<void>((r) => {
    resolve = r;
  });
  const end = () => {
    if (ended) return;
    ended = true;
    ticker.remove(step);
    onUpdate(1);
    resolve();
  };
  function step(): void {
    elapsed += ticker.deltaMS;
    if (elapsed >= durationMs) end();
    else onUpdate(ease(elapsed / durationMs));
  }
  if (durationMs <= 0) end();
  else {
    onUpdate(0);
    ticker.add(step);
  }
  return { done, finish: end };
}
