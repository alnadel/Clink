import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { LevelJson } from '@clink/rules';
import { describe, expect, it } from 'vitest';
import { type CheckReport, checkContent } from '../src/check';
import { readJson, writeJson } from '../src/io';
import { tempContent } from './helpers';

const W108 = 'levels/w1/w1-08.json';

function codes(report: CheckReport, severity?: 'error' | 'warn'): string[] {
  return report.findings.filter((f) => !severity || f.severity === severity).map((f) => f.code);
}

/** Mutates w1-08 in a temp copy of the content and returns the resulting report. */
function withLevel(mutate: (level: LevelJson) => void, release = false): CheckReport {
  const dir = tempContent();
  const level = readJson(join(dir, W108)) as LevelJson;
  mutate(level);
  writeJson(join(dir, W108), level);
  return checkContent({ contentDir: dir, release });
}

describe('checkContent: the real content', () => {
  it('has no errors, only the expected warnings', () => {
    const report = checkContent({ contentDir: tempContent() });
    expect(codes(report, 'error')).toEqual([]);
    expect(codes(report, 'warn').sort()).toEqual(['E_MISSING', 'W_WORLD_PHRASE']);
    expect(report.levelsChecked).toBeGreaterThanOrEqual(1);
  });

  it('with --release, missing levels and pending rights are errors', () => {
    const report = checkContent({ contentDir: tempContent(), release: true });
    expect(codes(report, 'error').sort()).toEqual(['E_MISSING', 'E_RIGHTS']);
  });
});

describe('checkContent: level errors', () => {
  it('E_PAR', () =>
    expect(
      codes(
        withLevel((l) => {
          l.par = 9;
        }),
        'error',
      ),
    ).toEqual(['E_PAR']));
  it('E_OPTIMAL', () =>
    expect(
      codes(
        withLevel((l) => {
          l.optimalSolutions = 4;
        }),
        'error',
      ),
    ).toEqual(['E_OPTIMAL']));
  it('a compile error keeps its own code', () => {
    expect(
      codes(
        withLevel((l) => {
          l.glasses[0] = { id: 'A', capacity: 4, emptyNote: 'F4', water: 0 };
        }),
        'error',
      ),
    ).toEqual(['E_OFF_SCALE']);
  });
  it('E_TOOLS_WORLD', () =>
    expect(
      codes(
        withLevel((l) => {
          l.tools = ['sink'];
        }),
        'error',
      ),
    ).toEqual(['E_TOOLS_WORLD']));
  it('E_ICE_WORLD', () => {
    const dir = tempContent();
    const level = readJson(join(dir, W108)) as LevelJson;
    level.id = 'w2-01';
    level.world = 2;
    level.ice = [{ glass: 'A', countdown: 2 }];
    writeJson(join(dir, 'levels/w2/w2-01.json'), level);
    expect(codes(checkContent({ contentDir: dir }), 'error')).toEqual(['E_ICE_WORLD']);
  });
  it('E_TUNE for an unknown tuneId', () =>
    expect(
      codes(
        withLevel((l) => {
          l.melody.tuneId = 'nope';
        }),
        'error',
      ),
    ).toEqual(['E_TUNE']));
  it('E_TUNE for a title that differs from tunes.json', () =>
    expect(
      codes(
        withLevel((l) => {
          l.melody.title = 'Other';
        }),
        'error',
      ),
    ).toEqual(['E_TUNE']));
  it('E_TUNED_AT_START', () => {
    const report = withLevel((l) => {
      l.glasses[0] = { id: 'A', capacity: 4, emptyNote: 'G4', water: 1 };
      l.glasses[1] = { id: 'B', capacity: 5, emptyNote: 'C5', water: 5 };
      l.glasses[2] = { id: 'C', capacity: 9, emptyNote: 'A4', water: 3 };
    });
    expect(codes(report, 'error')).toEqual(['E_TUNED_AT_START']);
  });
  it('E_UNSOLVABLE', () => {
    const report = withLevel((l) => {
      l.melody.notes = ['A5', 'G5', 'A5'];
      l.melody.beats = [1, 1, 2];
    });
    expect(codes(report, 'error')).toEqual(['E_UNSOLVABLE']);
  });
  it('E_AUDIO_RANGE', () => {
    const report = withLevel((l) => {
      l.scale.range = ['C3', 'C6'];
    });
    expect(codes(report, 'error')).toEqual(['E_AUDIO_RANGE']);
  });
  it('E_JSON', () => {
    const dir = tempContent();
    writeFileSync(join(dir, W108), '{ nope');
    expect(codes(checkContent({ contentDir: dir }), 'error')).toEqual(['E_JSON']);
  });
  it('E_ID for a file name that differs from the id', () => {
    const dir = tempContent();
    cpSync(join(dir, W108), join(dir, 'levels/w1/w1-09.json'));
    expect(codes(checkContent({ contentDir: dir }), 'error')).toEqual(['E_ID']);
  });
  it('E_ID for a level in the wrong world folder', () => {
    const dir = tempContent();
    const level = readJson(join(dir, W108)) as LevelJson;
    level.id = 'w2-01';
    level.world = 2;
    mkdirSync(join(dir, 'levels/w1'), { recursive: true });
    writeJson(join(dir, 'levels/w1/w2-01.json'), level);
    expect(codes(checkContent({ contentDir: dir }), 'error')).toContain('E_ID');
  });
  it('W_FORMAT for a non-canonical file', () => {
    const dir = tempContent();
    writeFileSync(join(dir, W108), JSON.stringify(readJson(join(dir, W108))));
    expect(codes(checkContent({ contentDir: dir }), 'warn')).toContain('W_FORMAT');
  });
});

describe('checkContent: whole-content errors', () => {
  it('E_CONFIG for weights that do not sum to 100', () => {
    const dir = tempContent();
    const config = readJson(join(dir, 'config.json')) as {
      experiments: Record<string, { weights: Record<string, number> }>;
    };
    for (const experiment of Object.values(config.experiments)) experiment.weights = { control: 90 };
    writeJson(join(dir, 'config.json'), config);
    expect(codes(checkContent({ contentDir: dir }), 'error')).toEqual(['E_CONFIG']);
  });

  it('E_SCHEDULE for a schedule naming a missing daily', () => {
    const dir = tempContent();
    const schedule = readJson(join(dir, 'schedule.json')) as { puzzles: string[] };
    schedule.puzzles = ['d001'];
    writeJson(join(dir, 'schedule.json'), schedule);
    expect(codes(checkContent({ contentDir: dir }), 'error')).toEqual(['E_SCHEDULE']);
  });

  it('E_SCHEDULE for an impossible launch date', () => {
    const dir = tempContent();
    const schedule = readJson(join(dir, 'schedule.json')) as { launchDate: string };
    schedule.launchDate = '2026-02-30';
    writeJson(join(dir, 'schedule.json'), schedule);
    expect(codes(checkContent({ contentDir: dir }), 'error')).toEqual(['E_SCHEDULE']);
  });

  it('E_FILE for a missing top-level file', () => {
    const dir = tempContent();
    writeFileSync(join(dir, 'bands.json'), '{');
    expect(codes(checkContent({ contentDir: dir }), 'error')).toContain('E_FILE');
  });

  it('E_GUIDE for a step whose text key does not exist', () => {
    const dir = tempContent();
    const guides = readJson(join(dir, 'guides.json')) as { levels: Record<string, unknown[]> };
    guides.levels['w1-08'] = [{ id: 's1', textKey: 'guide.missing', until: { on: 'tap' } }];
    writeJson(join(dir, 'guides.json'), guides);
    const i18nFile = join(dir, 'en.json');
    writeJson(i18nFile, {});
    expect(codes(checkContent({ contentDir: dir, i18nFile }), 'error')).toEqual(['E_GUIDE']);
  });
});
