import { describe, expect, it } from 'vitest';
import { levelLabel } from './levelLabel';

describe('levelLabel', () => {
  it('shows world and number', () => {
    expect(levelLabel('w1-08')).toBe('1-8');
    expect(levelLabel('w3-20')).toBe('3-20');
  });

  it('leaves other ids alone', () => {
    expect(levelLabel('d004')).toBe('d004');
  });

  it('isolates the number in right-to-left text', () => {
    expect(levelLabel('w1-12', true)).toBe('\u20661-12\u2069');
  });
});
