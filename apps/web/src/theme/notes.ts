import type { ScalePosition } from '@clink/rules';
import type { NoteLabelMode } from '../board/types';

export type GlyphShape = 'circle' | 'triangle' | 'square' | 'pentagon' | 'diamond' | 'star' | 'hexagon';

export interface NoteStyle {
  color: string;
  glyph: GlyphShape;
  /** Sharps are drawn hollow so they differ from their natural in grayscale (FR-29). */
  hollow: boolean;
  /** Dots above (positive) or below (negative) the glyph: octave - 4. */
  octaveDots: number;
}

// Docs: architecture/10-i18n-a11y.md §3. Indexed by pitch class (C = 0 ... B = 11).
const BASE: readonly { color: string; glyph: GlyphShape; hollow: boolean }[] = [
  { color: '#FF5A5F', glyph: 'circle', hollow: false }, // C
  { color: '#FF8A8D', glyph: 'circle', hollow: true }, // C#
  { color: '#FF9F1C', glyph: 'triangle', hollow: false }, // D
  { color: '#FFBE66', glyph: 'triangle', hollow: true }, // D#
  { color: '#FFE14D', glyph: 'square', hollow: false }, // E
  { color: '#6BD968', glyph: 'pentagon', hollow: false }, // F
  { color: '#9BE89A', glyph: 'pentagon', hollow: true }, // F#
  { color: '#2EC4B6', glyph: 'diamond', hollow: false }, // G
  { color: '#7ADCD3', glyph: 'diamond', hollow: true }, // G#
  { color: '#4EA8FF', glyph: 'star', hollow: false }, // A
  { color: '#8CC5FF', glyph: 'star', hollow: true }, // A#
  { color: '#B388FF', glyph: 'hexagon', hollow: false }, // B
];

/** Colour, glyph and octave marks for a note. Every note in C3-A5 gets a unique combination. */
export function noteStyle(pitchClass: number, octave: number): NoteStyle {
  const base = BASE[((pitchClass % 12) + 12) % 12] as (typeof BASE)[number];
  return { ...base, octaveDots: octave - 4 };
}

const SOLFEGE = ['do', 'do♯', 're', 're♯', 'mi', 'fa', 'fa♯', 'sol', 'sol♯', 'la', 'la♯', 'ti'];
const LETTERS = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

/** The text label for a position: letters (C D E), solfège (do re mi) or nothing (FR-28). */
export function noteLabel(position: ScalePosition, mode: NoteLabelMode): string {
  if (mode === 'letters') return LETTERS[position.pitchClass] ?? '';
  if (mode === 'solfege') return SOLFEGE[position.pitchClass] ?? '';
  return '';
}
