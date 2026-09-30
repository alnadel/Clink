// ACCEPTANCE TEST — owned by the architecture. Only remove `.skip`; never change expectations.
// Replays BRD Appendix A (level w1-08) move by move.
import { describe, expect, it } from 'vitest';
import {
  applyMove,
  compileLevel,
  foundTargets,
  initialState,
  isTuned,
  type Move,
  ringing,
  type State,
} from '../../src';
import { APPENDIX_A_TRACE, levelJson } from '../helpers';

describe('BRD Appendix A: w1-08 in five moves', () => {
  it('matches the table in Appendix A after every move', () => {
    const level = compileLevel(levelJson(APPENDIX_A_TRACE.level));
    const names = (s: State) => ringing(level, s).map((p) => level.positions[p]?.name);

    let state = initialState(level);
    expect(state.water).toEqual(APPENDIX_A_TRACE.start.water);
    expect(names(state)).toEqual(APPENDIX_A_TRACE.start.ringing);
    expect(foundTargets(level, state)).toEqual(APPENDIX_A_TRACE.start.found);

    for (const step of APPENDIX_A_TRACE.steps) {
      const result = applyMove(level, state, step.move as Move);
      if (!result.ok) throw new Error(`move refused: ${result.reason}`);
      expect(result.units).toBe(step.units);
      state = result.state;
      expect(state.water).toEqual(step.water);
      expect(names(state)).toEqual(step.ringing);
      expect(foundTargets(level, state)).toEqual(step.found);
      expect(isTuned(level, state)).toBe(step.tuned);
    }
  });
});
