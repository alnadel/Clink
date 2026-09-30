import { describe, expect, it } from 'vitest';
import { createFpsMeter, shouldLowerEffects } from './fps';

describe('createFpsMeter', () => {
  it('waits for enough frames before it reports', () => {
    const meter = createFpsMeter();
    for (let i = 0; i < 19; i++) meter.frame(16.7);
    expect(meter.fps()).toBeNull();
    meter.frame(16.7);
    expect(meter.fps()).toBeCloseTo(60, 0);
  });

  it('only remembers its window', () => {
    const meter = createFpsMeter(30);
    for (let i = 0; i < 30; i++) meter.frame(50);
    for (let i = 0; i < 30; i++) meter.frame(10);
    expect(meter.fps()).toBeCloseTo(100, 0);
  });

  it('ignores impossible frame times and can be reset', () => {
    const meter = createFpsMeter();
    for (let i = 0; i < 30; i++) meter.frame(Number.NaN);
    expect(meter.fps()).toBeNull();
    for (let i = 0; i < 30; i++) meter.frame(20);
    meter.reset();
    expect(meter.fps()).toBeNull();
  });
});

describe('shouldLowerEffects', () => {
  it('is false until measured and above 40 fps', () => {
    expect(shouldLowerEffects(null)).toBe(false);
    expect(shouldLowerEffects(58)).toBe(false);
    expect(shouldLowerEffects(40)).toBe(false);
  });

  it('is true below 40 fps', () => {
    expect(shouldLowerEffects(31)).toBe(true);
  });
});
