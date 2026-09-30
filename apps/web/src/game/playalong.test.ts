import { compileLevel, ringing } from '@clink/rules';
import { describe, expect, it } from 'vitest';
import { w108Json } from '../../test/fixtures';
import { createPlayAlong, glassForNote } from './playalong';

const level = compileLevel(w108Json());
const tuned = { water: [1, 5, 3], ice: [] };

describe('glassForNote', () => {
  it('finds the glass ringing each phrase note of Appendix A (E4 D4 C4 D4 E4 E4 E4)', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((i) => glassForNote(level, tuned, i))).toEqual([0, 2, 1, 2, 0, 0, 0]);
  });

  it('picks the lowest glass when two ring the same note (D4)', () => {
    // Glass A (G4 empty) with 2 units rings D4, and so does glass C (A4 empty) with 3 units.
    const state = { water: [2, 0, 3], ice: [] };
    expect(ringing(level, state)[0]).toBe(ringing(level, state)[2]);
    expect(glassForNote(level, state, 1)).toBe(0);
  });

  it('is -1 when no glass rings the note', () => {
    expect(glassForNote(level, { water: [0, 0, 9], ice: [] }, 0)).toBe(-1);
  });
});

describe('createPlayAlong', () => {
  it('advances on the right glass and finishes after the last note', () => {
    const pa = createPlayAlong(level, tuned);
    const expected = [0, 2, 1, 2, 0, 0, 0];
    expected.forEach((glass, i) => {
      expect(pa.current()).toBe(glass);
      expect(pa.noteIndex()).toBe(i);
      expect(pa.tap(glass)).toBe(i === expected.length - 1 ? 'done' : 'advance');
    });
    expect(pa.current()).toBeNull();
  });

  it('a wrong glass does not advance', () => {
    const pa = createPlayAlong(level, tuned);
    expect(pa.tap(1)).toBe('wrong');
    expect(pa.noteIndex()).toBe(0);
    expect(pa.tap(0)).toBe('advance');
  });
});
