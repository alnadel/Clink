// ACCEPTANCE TEST — owned by the architecture. Only remove `.skip`; never change expectations.
// Spec: docs/architecture/02-rules-engine.md §7 (rule 14, FR-07).
import { describe, expect, it } from 'vitest';
import { starsFor } from '../../src';

describe('starsFor', () => {
  it.each([
    // moves, par, hinted, expected
    [5, 5, false, 3],
    [6, 5, false, 2],
    [8, 5, false, 2], // ceil(1.5 * 5) = 8
    [9, 5, false, 1],
    [4, 4, false, 3],
    [6, 4, false, 2], // ceil(1.5 * 4) = 6
    [7, 4, false, 1],
    [1, 1, false, 3],
    [2, 1, false, 2], // ceil(1.5) = 2
    [3, 1, false, 1],
    [5, 5, true, 2], // a hint caps the solve at 2 stars
    [8, 5, true, 2],
    [9, 5, true, 1],
  ] as const)('%i moves at par %i (hinted: %s) -> %i stars', (moves, par, hinted, expected) => {
    expect(starsFor(moves, par, hinted)).toBe(expected);
  });

  it('uses a custom two-star factor for A/B tests (FR-39)', () => {
    expect(starsFor(10, 5, false, 2)).toBe(2);
    expect(starsFor(11, 5, false, 2)).toBe(1);
  });

  it('is safe from floating-point error: 2.2 * 25 is 55.00000000000001 in JavaScript', () => {
    // Without the -1e-9 epsilon, Math.ceil gives 56 and 56 moves would wrongly earn 2 stars.
    expect(starsFor(55, 25, false, 2.2)).toBe(2);
    expect(starsFor(56, 25, false, 2.2)).toBe(1);
  });
});
