import type { ContentManifest, LevelJson } from '@clink/rules';
import { describe, expect, it } from 'vitest';
import type { Progress } from '../save/types';
import { songbookEntries } from './songbook';

const level = (id: string, tuneId: string) =>
  [id, { id, melody: { tuneId } } as unknown as LevelJson] as const;
const manifest = {
  tunes: {
    mary: { title: 'Mary', origin: 'American' },
    ode: { title: 'Ode to Joy', origin: 'Beethoven' },
  },
  schedule: { schemaVersion: 1, launchDate: '2026-11-30', puzzles: ['d001', 'd002'] },
} as unknown as ContentManifest;
const solved = (levels: string[], dailies: number[] = []): Progress => ({
  schema: 1,
  levels: Object.fromEntries(levels.map((id) => [id, { stars: 3 as const, bestMoves: 1, solvedAt: 'x' }])),
  dailies: Object.fromEntries(dailies.map((n) => [String(n), { moves: 1, par: 1, stars: 3 as const }])),
});
const json = new Map([
  level('w1-02', 'mary'),
  level('w1-05', 'mary'),
  level('w1-06', 'ode'),
  level('d001', 'ode'),
]);

describe('songbookEntries', () => {
  it('lists each tune once with the lowest solved level, sorted by title', () => {
    const entries = songbookEntries(solved(['w1-05', 'w1-02', 'w1-06']), manifest, json);
    expect(entries.map((e) => [e.title, e.levelId])).toEqual([
      ['Mary', 'w1-02'],
      ['Ode to Joy', 'w1-06'],
    ]);
  });

  it('an unsolved level contributes nothing', () => {
    expect(songbookEntries(solved(['w1-02']), manifest, json).map((e) => e.tuneId)).toEqual(['mary']);
    expect(songbookEntries(solved([]), manifest, json)).toEqual([]);
  });

  it("a solved daily adds its tune, and an unsolved daily's tune stays hidden", () => {
    expect(songbookEntries(solved([], [1]), manifest, json).map((e) => e.tuneId)).toEqual(['ode']);
    expect(songbookEntries(solved([], []), manifest, json)).toEqual([]);
  });
});
