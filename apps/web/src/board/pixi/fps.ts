/** Frames per second from a sliding window of frame times, for the low-effects switch and the FPS overlay. */
export interface FpsMeter {
  /** Records one frame that took `deltaMs`. */
  frame(deltaMs: number): void;
  /** Frames per second over the recorded window, or null until enough frames are in. */
  fps(): number | null;
  reset(): void;
}

const MIN_FRAMES = 20;

export function createFpsMeter(windowFrames = 90): FpsMeter {
  let times: number[] = [];
  return {
    frame(deltaMs) {
      if (!(deltaMs > 0)) return;
      times.push(deltaMs);
      if (times.length > windowFrames) times = times.slice(times.length - windowFrames);
    },
    fps() {
      if (times.length < MIN_FRAMES) return null;
      const average = times.reduce((sum, t) => sum + t, 0) / times.length;
      return 1000 / average;
    },
    reset() {
      times = [];
    },
  };
}

/** Below this the board drops its particles and tilt (NFR-03, R11). */
export const LOW_EFFECTS_BELOW_FPS = 40;

export const shouldLowerEffects = (fps: number | null): boolean =>
  fps !== null && fps < LOW_EFFECTS_BELOW_FPS;
