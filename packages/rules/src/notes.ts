import { NotImplementedError } from './errors';

/**
 * Parses a note name to absolute cents (MIDI note number * 100).
 * Grammar: /^([A-G])([#b]?)([0-9])$/. "C4" -> 6000, "A4" -> 6900, "C#4" and "Db4" -> 6100.
 * MIDI = 12 * (octave + 1) + pitchClass(letter) + (# ? 1 : b ? -1 : 0).
 * Throws LevelError('E_NOTE_NAME') on anything else.
 * Spec: docs/architecture/02-rules-engine.md §2.
 */
export function parseNote(name: string): number {
  throw new NotImplementedError(`parseNote(${name})`);
}
