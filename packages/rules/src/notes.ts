import { LevelError } from './errors';

const PITCH_CLASS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/**
 * Parses a note name to absolute cents (MIDI note number * 100).
 * Grammar: /^([A-G])([#b]?)([0-9])$/. "C4" -> 6000, "A4" -> 6900, "C#4" and "Db4" -> 6100.
 * Throws LevelError('E_NOTE_NAME') on anything else.
 * Spec: docs/architecture/02-rules-engine.md §2.
 */
export function parseNote(name: string): number {
  const match = /^([A-G])([#b]?)([0-9])$/.exec(name);
  if (!match) throw new LevelError('E_NOTE_NAME', `bad note name ${JSON.stringify(name)}`);
  const [, letter = '', accidental = '', octave = ''] = match;
  const shift = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0;
  return (12 * (Number(octave) + 1) + (PITCH_CLASS[letter] ?? 0) + shift) * 100;
}
