import { describe, expect, it } from 'vitest';
import { phraseDuration, phraseTimes } from './schedule';

describe('phraseTimes', () => {
  it('starts each note after the beats before it', () => {
    expect(phraseTimes([1, 1, 2], 120, 10)).toEqual([10, 10.5, 11]);
  });

  it('spaces Appendix A notes 0.6 s apart at 100 bpm', () => {
    const times = phraseTimes([1, 1, 1, 1, 1, 1, 2], 100, 0);
    expect(times).toHaveLength(7);
    times.slice(1, 6).forEach((t, i) => {
      expect(t - (times[i] ?? 0)).toBeCloseTo(0.6, 9);
    });
    expect(times[6]).toBeCloseTo(3.6, 9);
  });

  it('handles an empty phrase', () => {
    expect(phraseTimes([], 100, 0)).toEqual([]);
    expect(phraseDuration([], 100)).toBe(0);
  });

  it('computes the whole phrase duration', () => {
    expect(phraseDuration([1, 1, 1, 1, 1, 1, 2], 100)).toBeCloseTo(4.8, 9);
  });
});
