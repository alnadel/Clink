// ACCEPTANCE TEST — owned by the architecture. Only remove `.skip`; never change expectations.
// Spec: docs/architecture/02-rules-engine.md §2.
import { describe, expect, it } from 'vitest';
import { parseNote } from '../../src';
import { levelErrorCode } from '../helpers';

describe.skip('parseNote', () => {
  it.each([
    ['C4', 6000],
    ['A4', 6900],
    ['C#4', 6100],
    ['Db4', 6100],
    ['B3', 5900],
    ['Cb4', 5900],
    ['B#3', 6000],
    ['C3', 4800],
    ['A5', 8100],
    ['C0', 1200],
    ['G9', 12700],
  ])('%s is %i cents', (name, cents) => {
    expect(parseNote(name)).toBe(cents);
  });

  it.each(['H4', 'c4', 'C', 'C44', 'C-1', 'C##4', 'E 4', '', 'C4 ', 'C♯4'])(
    'rejects %j with E_NOTE_NAME',
    (name) => {
      expect(levelErrorCode(() => parseNote(name))).toBe('E_NOTE_NAME');
    },
  );
});
