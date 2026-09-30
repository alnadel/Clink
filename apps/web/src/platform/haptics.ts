/** Light vibration where the browser supports it (FR-15). Silent when the setting or the API is off. */
export interface Haptics {
  /** One unit of water moved. */
  step(): void;
  /** A refused move. */
  refuse(): void;
  /** The level was solved. */
  solve(): void;
}

export function createHaptics(
  isEnabled: () => boolean,
  vibrate: ((pattern: number | number[]) => boolean) | undefined = typeof navigator !== 'undefined' &&
  'vibrate' in navigator
    ? navigator.vibrate.bind(navigator)
    : undefined,
): Haptics {
  const buzz = (pattern: number | number[]): void => {
    if (vibrate && isEnabled()) vibrate(pattern);
  };
  return {
    step: () => buzz(8),
    refuse: () => buzz(30),
    solve: () => buzz([20, 40, 20]),
  };
}
