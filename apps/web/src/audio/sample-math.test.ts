import { describe, expect, it } from 'vitest';
import { hzToCents, nearestSample, playbackRate, trimLeadingSilence } from './sample-math';

describe('sample math', () => {
  it('nearestSample picks the closest sample; ties go to the lower index', () => {
    expect(nearestSample(6000, [4800, 5500, 6300])).toBe(2);
    expect(nearestSample(5900, [4800, 5500, 6300])).toBe(1);
    expect(nearestSample(5000, [4800, 5200])).toBe(0);
    expect(nearestSample(9999, [4800, 5200])).toBe(1);
  });

  it('playbackRate doubles per octave', () => {
    expect(playbackRate(6900, 5700)).toBeCloseTo(2, 9);
    expect(playbackRate(6900, 6900)).toBe(1);
    expect(playbackRate(6900, 6700)).toBeCloseTo(1.1225, 4);
  });

  it('hzToCents puts A4 at 6900', () => {
    expect(hzToCents(440)).toBeCloseTo(6900, 9);
    expect(hzToCents(880)).toBeCloseTo(8100, 9);
  });

  it('trimLeadingSilence finds the first audible sample', () => {
    expect(trimLeadingSilence(new Float32Array([0, 0.0005, 0.002, 0.5]))).toBe(2);
    expect(trimLeadingSilence(new Float32Array([0, 0, 0]))).toBe(0);
    expect(trimLeadingSilence(new Float32Array([-0.5]))).toBe(0);
  });
});
