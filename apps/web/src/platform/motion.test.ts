import { describe, expect, it } from 'vitest';
import { resolveReducedMotion } from './motion';

describe('resolveReducedMotion', () => {
  it('the system setting follows the OS preference', () => {
    expect(resolveReducedMotion('system', true)).toBe(true);
    expect(resolveReducedMotion('system', false)).toBe(false);
  });

  it('explicit settings win over the OS', () => {
    expect(resolveReducedMotion('off', true)).toBe(false);
    expect(resolveReducedMotion('on', false)).toBe(true);
  });
});
