// ACCEPTANCE TEST — owned by the architecture. Only remove `.skip`; never change expectations.
// Spec: docs/architecture/02-rules-engine.md §3.
import { describe, expect, it } from 'vitest';
import { compileLevel, type LevelJson } from '../../src';
import { COMPILE_EXPECTED, deepFreeze, FIXTURE_IDS, levelErrorCode, levelJson } from '../helpers';

describe('compileLevel: fixtures', () => {
  it.each(FIXTURE_IDS)('%s resolves positions, glasses, targets and ice', (id) => {
    const json = levelJson(id);
    const expected = COMPILE_EXPECTED[id];
    const level = compileLevel(json);

    expect(level.id).toBe(json.id);
    expect(level.world).toBe(json.world);
    expect(level.par).toBe(json.par);
    expect(level.optimalSolutions).toBe(json.optimalSolutions);
    expect(level.source).toEqual(json);

    expect(level.positions.map((p) => p.name)).toEqual(expected.positions);
    level.positions.forEach((p, i) => {
      expect(p.pos).toBe(i);
      if (i > 0) expect(p.cents).toBeGreaterThan(level.positions[i - 1]?.cents ?? Infinity);
    });
    expect(level.positions[0]?.hz).toBeCloseTo(expected.firstHz, 3);
    expect(level.positions.at(-1)?.hz).toBeCloseTo(expected.lastHz, 3);

    expect(level.glasses.map((g) => g.emptyPos)).toEqual(expected.emptyPos);
    level.glasses.forEach((g, i) => {
      expect(g.index).toBe(i);
      expect(g.id).toBe(json.glasses[i]?.id);
      expect(g.capacity).toBe(json.glasses[i]?.capacity);
      expect(g.startWater).toBe(json.glasses[i]?.water);
    });

    expect(level.targets).toEqual(expected.targets);
    expect(level.melody.targetIndex).toEqual(expected.targetIndex);
    level.melody.notes.forEach((note, i) => {
      expect(level.targets[level.melody.targetIndex[i] ?? -1]).toBe(note);
    });
    expect(level.melody.beats).toEqual(json.melody.beats);
    expect(level.melody.bpm).toBe(json.melody.bpm);
    expect(level.melody.title).toBe(json.melody.title);
    expect(level.melody.tuneId).toBe(json.melody.tuneId);

    expect(level.ice.map((c) => c.glass)).toEqual(expected.iceGlass);
    level.ice.forEach((c, i) => {
      expect(c.index).toBe(i);
      expect(c.startCountdown).toBe(json.ice[i]?.countdown);
    });

    expect(level.tools).toEqual({
      faucet: json.tools.includes('faucet'),
      sink: json.tools.includes('sink'),
    });
  });

  it('w1-08 details match BRD Appendix A', () => {
    const level = compileLevel(levelJson('w1-08'));
    // C major pentatonic from C3 to A5: 15 positions.
    expect(level.positions).toHaveLength(15);
    expect(level.positions[5]).toMatchObject({ pos: 5, cents: 6000, name: 'C4', pitchClass: 0, octave: 4 });
    expect(level.positions[0]?.hz).toBeCloseTo(130.81, 6);
    expect(level.positions[9]?.name).toBe('A4');
    expect(level.positions[9]?.hz).toBeCloseTo(439.9906, 3);
    // Glass A rings G4 empty, B rings C5, C rings A4.
    expect(level.glasses.map((g) => level.positions[g.emptyPos]?.name)).toEqual(['G4', 'C5', 'A4']);
    // Targets E4, D4, C4 in order of first appearance.
    expect(level.targets.map((p) => level.positions[p]?.name)).toEqual(['E4', 'D4', 'C4']);
    expect(level.melody.notes).toEqual([7, 6, 5, 6, 7, 7, 7]);
    expect(level.melody.targetIndex).toEqual([0, 1, 2, 1, 0, 0, 0]);
  });

  it('does not mutate its input', () => {
    const json = deepFreeze(levelJson('fx-ice'));
    expect(() => compileLevel(json)).not.toThrow();
  });
});

type Mutation = [name: string, code: string, mutate: (j: LevelJson) => void];

const glass = (id: string, capacity = 3, emptyNote = 'C5', water = 0) => ({ id, capacity, emptyNote, water });

const MUTATIONS: Mutation[] = [
  [
    'schemaVersion 2',
    'E_SCHEMA',
    (j) => {
      (j as { schemaVersion: number }).schemaVersion = 2;
    },
  ],
  [
    'empty id',
    'E_SCHEMA',
    (j) => {
      j.id = '';
    },
  ],
  [
    'world 4',
    'E_SCHEMA',
    (j) => {
      (j as { world: number }).world = 4;
    },
  ],
  [
    'glasses not an array',
    'E_SCHEMA',
    (j) => {
      (j as { glasses: unknown }).glasses = null;
    },
  ],
  [
    'bpm 30',
    'E_SCHEMA',
    (j) => {
      j.melody.bpm = 30;
    },
  ],
  [
    'bpm 250',
    'E_SCHEMA',
    (j) => {
      j.melody.bpm = 250;
    },
  ],
  [
    'beats length differs from notes',
    'E_SCHEMA',
    (j) => {
      j.melody.beats = [1, 1];
    },
  ],
  [
    'a beat of 0',
    'E_SCHEMA',
    (j) => {
      j.melody.beats[0] = 0;
    },
  ],
  [
    'duplicate tool',
    'E_SCHEMA',
    (j) => {
      j.tools = ['faucet', 'faucet'];
    },
  ],
  [
    'unknown tool',
    'E_SCHEMA',
    (j) => {
      (j as { tools: string[] }).tools = ['hose'];
    },
  ],
  [
    'bad range note name',
    'E_NOTE_NAME',
    (j) => {
      j.scale.range = ['C3', 'H5'];
    },
  ],
  [
    'tonicHz 0',
    'E_RANGE',
    (j) => {
      j.scale.tonicHz = 0;
    },
  ],
  [
    'stepsCents not starting at 0',
    'E_RANGE',
    (j) => {
      j.scale.stepsCents = [100, 200];
    },
  ],
  [
    'stepsCents not increasing',
    'E_RANGE',
    (j) => {
      j.scale.stepsCents = [0, 700, 400];
    },
  ],
  [
    'stepsCents reaching 1200',
    'E_RANGE',
    (j) => {
      j.scale.stepsCents = [0, 700, 1200];
    },
  ],
  [
    'range reversed',
    'E_RANGE',
    (j) => {
      j.scale.range = ['A5', 'C3'];
    },
  ],
  [
    'range endpoint off the scale',
    'E_RANGE',
    (j) => {
      j.scale.range = ['C#3', 'A5'];
    },
  ],
  [
    '1 glass',
    'E_GLASS_COUNT',
    (j) => {
      j.glasses = [glass('A')];
    },
  ],
  [
    '6 glasses',
    'E_GLASS_COUNT',
    (j) => {
      j.glasses = ['A', 'B', 'C', 'D', 'E', 'F'].map((id) => glass(id));
    },
  ],
  [
    'capacity 1',
    'E_GLASS',
    (j) => {
      j.glasses[0] = glass('A', 1);
    },
  ],
  [
    'capacity 13',
    'E_GLASS',
    (j) => {
      j.glasses[2] = glass('C', 13, 'A5');
    },
  ],
  [
    'capacity 2.5',
    'E_GLASS',
    (j) => {
      j.glasses[0] = glass('A', 2.5);
    },
  ],
  [
    'water above capacity',
    'E_GLASS',
    (j) => {
      j.glasses[0] = glass('A', 3, 'C5', 4);
    },
  ],
  [
    'negative water',
    'E_GLASS',
    (j) => {
      j.glasses[0] = glass('A', 3, 'C5', -1);
    },
  ],
  [
    'duplicate glass id',
    'E_GLASS',
    (j) => {
      j.glasses[1] = glass('A');
    },
  ],
  [
    'empty glass id',
    'E_GLASS',
    (j) => {
      j.glasses[1] = glass('');
    },
  ],
  [
    'bad emptyNote name',
    'E_NOTE_NAME',
    (j) => {
      j.glasses[0] = glass('A', 3, 'H4');
    },
  ],
  [
    'emptyNote off the scale',
    'E_OFF_SCALE',
    (j) => {
      j.glasses[0] = glass('A', 3, 'F4');
    },
  ],
  [
    'emptyNote above the range',
    'E_OFF_SCALE',
    (j) => {
      j.glasses[0] = glass('A', 3, 'C6');
    },
  ],
  [
    'lowest fill line below the range',
    'E_FILL_RANGE',
    (j) => {
      j.glasses[2] = glass('C', 9, 'G4', 9);
    },
  ],
  [
    'melody note off the scale',
    'E_OFF_SCALE',
    (j) => {
      j.melody.notes[0] = 'F4';
    },
  ],
  [
    'melody note name invalid',
    'E_NOTE_NAME',
    (j) => {
      j.melody.notes[0] = 'E';
    },
  ],
  [
    'phrase of 2 notes',
    'E_PHRASE',
    (j) => {
      j.melody.notes = ['E4', 'D4'];
      j.melody.beats = [1, 1];
    },
  ],
  [
    'phrase of 9 notes',
    'E_PHRASE',
    (j) => {
      j.melody.notes = Array(9).fill('E4');
      j.melody.beats = Array(9).fill(1);
    },
  ],
  [
    '6 targets',
    'E_PHRASE',
    (j) => {
      j.glasses = ['A', 'B', 'C', 'D', 'E'].map((id) => glass(id));
      j.melody.notes = ['C4', 'D4', 'E4', 'G4', 'A4', 'C5'];
      j.melody.beats = Array(6).fill(1);
    },
  ],
  [
    'more targets than glasses',
    'E_PHRASE',
    (j) => {
      j.melody.notes = ['C4', 'D4', 'E4', 'G4'];
      j.melody.beats = [1, 1, 1, 1];
    },
  ],
  [
    '4 ice cubes',
    'E_ICE',
    (j) => {
      j.ice = Array(4).fill({ glass: 'A', countdown: 2 });
    },
  ],
  [
    'ice in an unknown glass',
    'E_ICE',
    (j) => {
      j.ice = [{ glass: 'Z', countdown: 2 }];
    },
  ],
  [
    'ice countdown 0',
    'E_ICE',
    (j) => {
      j.ice = [{ glass: 'A', countdown: 0 }];
    },
  ],
  [
    'ice countdown 16',
    'E_ICE',
    (j) => {
      j.ice = [{ glass: 'A', countdown: 16 }];
    },
  ],
];

describe('compileLevel: validation errors', () => {
  it.each(MUTATIONS)('%s -> %s', (_name, code, mutate) => {
    const json = levelJson('w1-08');
    mutate(json);
    expect(levelErrorCode(() => compileLevel(json))).toBe(code);
  });

  it('accepts the unmodified fixture', () => {
    expect(levelErrorCode(() => compileLevel(levelJson('w1-08')))).toBeUndefined();
  });
});
