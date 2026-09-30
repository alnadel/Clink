import { compileLevel, foundTargets, initialState, solve } from '@clink/rules';
import { describe, expect, it } from 'vitest';
import { runA2Check } from '../src/a2';
import { generate } from '../src/generate';
import { mulberry32, randInt } from '../src/random';
import { tempContent } from './helpers';

const HARD = {
  tune: 'mary-had-a-little-lamb',
  phrase: 'a-pentatonic-c',
  world: 1 as const,
  band: 'hard',
  count: 3,
  seed: 1,
  attempts: 5000,
};

describe('random', () => {
  it('mulberry32 is deterministic and in [0, 1)', () => {
    const a = mulberry32(1);
    const b = mulberry32(1);
    const first = [a(), a(), a()];
    expect(first).toEqual([b(), b(), b()]);
    expect(first.every((n) => n >= 0 && n < 1)).toBe(true);
    expect(mulberry32(2)()).not.toBe(first[0]);
  });

  it('randInt stays inside its inclusive bounds and reaches both', () => {
    const rng = mulberry32(7);
    const seen = new Set<number>();
    for (let i = 0; i < 10_000; i++) {
      const n = randInt(rng, 3, 6);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(6);
      seen.add(n);
    }
    expect([...seen].sort()).toEqual([3, 4, 5, 6]);
  });
});

describe('generate', () => {
  it('returns valid, proven candidates inside the band, deterministically', () => {
    const contentDir = tempContent();
    const candidates = generate({ contentDir, ...HARD });
    expect(candidates).toHaveLength(3);
    for (const candidate of candidates) {
      const level = compileLevel(candidate.level);
      expect(foundTargets(level, initialState(level)).every(Boolean)).toBe(false);
      const summary = solve(level);
      expect(summary.par).toBe(candidate.par);
      expect(summary.optimalSolutions).toBe(candidate.optimalSolutions);
      expect(candidate.par).toBeGreaterThanOrEqual(5);
      expect(candidate.par).toBeLessThanOrEqual(7);
      expect(candidate.level.par).toBe(candidate.par);
    }
    expect(generate({ contentDir, ...HARD })).toEqual(candidates);
    expect(generate({ contentDir, ...HARD, seed: 2 })).not.toEqual(candidates);
  }, 60_000);

  it('rejects a phrase whose scale the world does not allow', () => {
    expect(() => generate({ contentDir: tempContent(), ...HARD, world: 3 })).toThrow(/world 3/);
  });

  it('rejects an unknown band', () => {
    expect(() => generate({ contentDir: tempContent(), ...HARD, band: 'nope' })).toThrow(/band/);
  });
});

describe('A2 check', () => {
  it('reports every band of the chosen worlds, and World 1 has enough candidates in each', () => {
    const rows = runA2Check({ contentDir: tempContent(), seed: 1, attempts: 400, worlds: [1] });
    expect(rows).toHaveLength(3);
    for (const row of rows.filter((r) => r.world === 1)) expect(row.candidates).toBeGreaterThanOrEqual(3);
  }, 300_000);
});
