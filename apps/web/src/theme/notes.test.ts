import type { ScalePosition } from '@clink/rules';
import { describe, expect, it } from 'vitest';
import { noteLabel, noteStyle } from './notes';

const position = (midi: number): ScalePosition => ({
  pos: 0,
  cents: midi * 100,
  hz: 0,
  name: '',
  pitchClass: midi % 12,
  octave: Math.floor(midi / 12) - 1,
});

describe('noteStyle', () => {
  it('matches the documented table', () => {
    expect(noteStyle(0, 3)).toEqual({ color: '#FF5A5F', glyph: 'circle', hollow: false, octaveDots: -1 });
    expect(noteStyle(1, 4)).toMatchObject({ glyph: 'circle', hollow: true, octaveDots: 0 });
    expect(noteStyle(9, 5)).toMatchObject({ glyph: 'star', hollow: false, octaveDots: 1 });
  });

  it('gives every note from C3 to A5 a unique glyph/hollow/octave combination (FR-29)', () => {
    const seen = new Set<string>();
    for (let midi = 48; midi <= 81; midi++) {
      const style = noteStyle(midi % 12, Math.floor(midi / 12) - 1);
      seen.add(`${style.glyph}|${style.hollow}|${style.octaveDots}`);
    }
    expect(seen.size).toBe(34);
  });
});

describe('noteLabel', () => {
  it('labels C4, F#4 and B3 in every mode', () => {
    expect(noteLabel(position(60), 'letters')).toBe('C');
    expect(noteLabel(position(66), 'letters')).toBe('F♯');
    expect(noteLabel(position(59), 'letters')).toBe('B');
    expect(noteLabel(position(60), 'solfege')).toBe('do');
    expect(noteLabel(position(66), 'solfege')).toBe('fa♯');
    expect(noteLabel(position(59), 'solfege')).toBe('ti');
    expect(noteLabel(position(60), 'none')).toBe('');
  });
});
