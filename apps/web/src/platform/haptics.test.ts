import { describe, expect, it, vi } from 'vitest';
import { createHaptics } from './haptics';

describe('createHaptics', () => {
  it('vibrates with short patterns when enabled', () => {
    const vibrate = vi.fn(() => true);
    const haptics = createHaptics(() => true, vibrate);
    haptics.step();
    haptics.refuse();
    haptics.solve();
    expect(vibrate.mock.calls).toEqual([[8], [30], [[20, 40, 20]]]);
  });

  it('is silent when the setting is off', () => {
    const vibrate = vi.fn(() => true);
    const haptics = createHaptics(() => false, vibrate);
    haptics.step();
    haptics.solve();
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('is silent when the browser has no vibration API', () => {
    const haptics = createHaptics(() => true, undefined);
    expect(() => {
      haptics.step();
      haptics.refuse();
      haptics.solve();
    }).not.toThrow();
  });
});
