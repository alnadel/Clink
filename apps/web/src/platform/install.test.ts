import { describe, expect, it } from 'vitest';
import { shouldShowInstallPrompt, shouldShowSurvey } from './install';

const fresh = { installPromptCount: 0 };

describe('shouldShowInstallPrompt (D18)', () => {
  it('shows on the first solve of level 5 and level 15', () => {
    expect(shouldShowInstallPrompt('w1-05', true, fresh, false)).toBe(true);
    expect(shouldShowInstallPrompt('w1-15', true, fresh, false)).toBe(true);
  });

  it('never on a replay, another level, when installed, or after two showings', () => {
    expect(shouldShowInstallPrompt('w1-05', false, fresh, false)).toBe(false);
    expect(shouldShowInstallPrompt('w1-06', true, fresh, false)).toBe(false);
    expect(shouldShowInstallPrompt('w1-05', true, fresh, true)).toBe(false);
    expect(shouldShowInstallPrompt('w1-15', true, { installPromptCount: 2 }, false)).toBe(false);
    expect(shouldShowInstallPrompt('w1-15', true, { installPromptCount: 1 }, false)).toBe(true);
  });
});

describe('shouldShowSurvey (D19)', () => {
  it('asks once, on the first solve of level 10', () => {
    expect(shouldShowSurvey('w1-10', true, false)).toBe(true);
    expect(shouldShowSurvey('w1-10', false, false)).toBe(false);
    expect(shouldShowSurvey('w1-10', true, true)).toBe(false);
    expect(shouldShowSurvey('w1-09', true, false)).toBe(false);
  });
});
