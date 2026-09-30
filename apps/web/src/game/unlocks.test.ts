import { describe, expect, it } from 'vitest';
import type { Progress } from '../save/types';
import { levelStatuses, nextLevel } from './unlocks';

const ORDER = ['a', 'b', 'c'];
const solved = (...ids: string[]): Progress => ({
  schema: 1,
  levels: Object.fromEntries(ids.map((id) => [id, { stars: 3 as const, bestMoves: 1, solvedAt: 'x' }])),
  dailies: {},
});
const entries = (map: Map<string, string>) => [...map.entries()];

describe('levelStatuses', () => {
  it('a fresh save opens only the first level', () => {
    expect(entries(levelStatuses(ORDER, new Set(), solved()))).toEqual([
      ['a', 'open'],
      ['b', 'locked'],
      ['c', 'locked'],
    ]);
  });

  it('solving a level opens the next, in exactly that order (FR-16)', () => {
    expect(entries(levelStatuses(ORDER, new Set(), solved('a')))).toEqual([
      ['a', 'solved'],
      ['b', 'open'],
      ['c', 'locked'],
    ]);
  });

  it('disabled levels are absent and skipped in the unlock order (D24)', () => {
    const statuses = levelStatuses(ORDER, new Set(['b']), solved('a'));
    expect(statuses.has('b')).toBe(false);
    expect(statuses.get('c')).toBe('open');
  });

  it('a solved level after a locked one stays solved (restored progress)', () => {
    expect(levelStatuses(ORDER, new Set(), solved('c')).get('c')).toBe('solved');
    expect(levelStatuses(ORDER, new Set(), solved('c')).get('a')).toBe('open');
  });
});

describe('nextLevel', () => {
  it('is the first open level', () => {
    expect(nextLevel(levelStatuses(ORDER, new Set(), solved('a')))).toBe('b');
  });

  it('is null when everything is solved', () => {
    expect(nextLevel(levelStatuses(ORDER, new Set(), solved('a', 'b', 'c')))).toBeNull();
  });
});
