import { type Level, ringing, type State } from '@clink/rules';

/**
 * The glass that glows for phrase note `noteIndex` (rule 12, D4): the lowest-numbered glass whose
 * ringing position equals the note. -1 if none (cannot happen in a tuned state).
 */
export function glassForNote(level: Level, state: State, noteIndex: number): number {
  const target = level.melody.notes[noteIndex];
  return target === undefined ? -1 : ringing(level, state).indexOf(target);
}

export interface PlayAlong {
  /** The glowing glass, or null once the phrase is complete. */
  current(): number | null;
  /** Index of the phrase note being asked for. */
  noteIndex(): number;
  /** advance: right glass, more to go. wrong: any other glass (it rings, nothing advances). done: last note played. */
  tap(glass: number): 'advance' | 'wrong' | 'done';
}

/** Play-along after the solve: the player taps each glowing glass in turn (rule 12, D25). */
export function createPlayAlong(level: Level, state: State): PlayAlong {
  let index = 0;
  const total = level.melody.notes.length;
  return {
    current: () => (index >= total ? null : glassForNote(level, state, index)),
    noteIndex: () => index,
    tap(glass) {
      if (index >= total || glass !== glassForNote(level, state, index)) return 'wrong';
      index++;
      return index >= total ? 'done' : 'advance';
    },
  };
}
