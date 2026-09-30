// ACCEPTANCE TEST — owned by the architecture. Only remove `.skip`; never change expectations.
// Spec: docs/architecture/09-ops.md §4 (FR-39).
import type { RemoteConfig } from '@clink/rules';
import { describe, expect, it } from 'vitest';
import { assignVariant, bucketOf, resolveFlags } from '../../src/ops/flags';

const DEV0 = '00000000-0000-4000-8000-000000000000';
const DEV1 = '11111111-2222-4333-8444-555555555555';

describe.skip('A/B flags', () => {
  it('buckets are stable golden values', () => {
    expect(bucketOf(DEV0, 'stars')).toBe(74);
    expect(bucketOf(DEV0, 'onboarding')).toBe(68);
    expect(bucketOf(DEV1, 'stars')).toBe(97);
    expect(bucketOf(DEV1, 'onboarding')).toBe(21);
  });

  it('assigns variants by cumulative weight in key order', () => {
    const w = { control: 50, loose: 50 };
    expect(assignVariant(0, w)).toBe('control');
    expect(assignVariant(49, w)).toBe('control');
    expect(assignVariant(50, w)).toBe('loose');
    expect(assignVariant(99, w)).toBe('loose');
    expect(assignVariant(95, { a: 10, b: 20 })).toBe('a'); // weights short of 100: first key
  });

  it('resolves assignments and merged flag values', () => {
    const config: RemoteConfig = {
      schemaVersion: 1,
      disabledLevels: [],
      dailyOverrides: {},
      refreshMinutes: 30,
      experiments: {
        stars: {
          variants: { control: { twoStarFactor: 1.5 }, loose: { twoStarFactor: 2 } },
          weights: { control: 50, loose: 50 },
        },
        onboarding: {
          variants: { a: { onboardingVariant: 'a' }, b: { onboardingVariant: 'b' } },
          weights: { a: 50, b: 50 },
        },
      },
    };
    expect(resolveFlags(config, DEV0)).toEqual({
      assignments: { stars: 'loose', onboarding: 'b' },
      flags: { twoStarFactor: 2, onboardingVariant: 'b' },
    });
    expect(resolveFlags(config, DEV1)).toEqual({
      assignments: { stars: 'loose', onboarding: 'a' },
      flags: { twoStarFactor: 2, onboardingVariant: 'a' },
    });
  });
});
