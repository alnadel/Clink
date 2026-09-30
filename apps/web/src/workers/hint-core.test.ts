import { describe, expect, it } from 'vitest';
import { w108Json } from '../../test/fixtures';
import { createHintCore } from './hint-core';

describe('hint core', () => {
  it('loads a level and reports its state count', () => {
    const core = createHintCore();
    const response = core.handle({ type: 'load', requestId: 1, level: w108Json() });
    expect(response).toMatchObject({ type: 'loaded', requestId: 1, levelId: 'w1-08', reachable: 18 });
  });

  it('hints the first move of the shortest solution', () => {
    const core = createHintCore();
    core.handle({ type: 'load', requestId: 1, level: w108Json() });
    expect(
      core.handle({ type: 'hint', requestId: 2, levelId: 'w1-08', state: { water: [0, 0, 9], ice: [] } }),
    ).toEqual({
      type: 'hint',
      requestId: 2,
      levelId: 'w1-08',
      hint: { type: 'move', move: { type: 'pour', from: 2, to: 1 } },
    });
  });

  it('errors for a wrong level id and before any load', () => {
    const state = { water: [0, 0, 9], ice: [] };
    const fresh = createHintCore();
    expect(fresh.handle({ type: 'hint', requestId: 1, levelId: 'w1-08', state }).type).toBe('error');
    fresh.handle({ type: 'load', requestId: 2, level: w108Json() });
    expect(fresh.handle({ type: 'hint', requestId: 3, levelId: 'other', state }).type).toBe('error');
  });

  it('turns an invalid level into an error with the LevelError message', () => {
    const level = w108Json();
    level.glasses = [];
    const response = createHintCore().handle({ type: 'load', requestId: 1, level });
    expect(response).toMatchObject({ type: 'error', requestId: 1 });
    expect((response as { message: string }).message).toContain('E_GLASS_COUNT');
  });
});
