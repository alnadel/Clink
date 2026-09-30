import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { LevelJson } from '@clink/rules';
import { describe, expect, it } from 'vitest';
import { readJson, writeJson } from '../src/io';
import { formatProveResult, proveLevels } from '../src/prove';
import { tempContent } from './helpers';

const W108 = 'levels/w1/w1-08.json';

describe('proveLevels', () => {
  it('proves w1-08 as Appendix A says: 18 states, par 5, one solution, unchanged', () => {
    const [result] = proveLevels({ contentDir: tempContent(), ids: ['w1-08'], write: false });
    expect(result).toMatchObject({
      id: 'w1-08',
      reachable: 18,
      par: 5,
      optimalSolutions: 1,
      changed: false,
      error: null,
    });
    expect(formatProveResult(result as NonNullable<typeof result>)).toBe(
      'w1-08  reachable=18  par=5  optimal=1   (file: par=5 optimal=1)  ok',
    );
  });

  it('with write, restores a wrong par and touches nothing else', () => {
    const dir = tempContent();
    const original = readFileSync(join(dir, W108), 'utf8');
    const level = readJson(join(dir, W108)) as LevelJson;
    level.par = 9;
    level.optimalSolutions = 4;
    writeJson(join(dir, W108), level);

    const [dry] = proveLevels({ contentDir: dir, ids: [], write: false });
    expect(dry?.changed).toBe(true);
    expect(readJson(join(dir, W108))).toMatchObject({ par: 9 });

    proveLevels({ contentDir: dir, ids: [], write: true });
    expect(readFileSync(join(dir, W108), 'utf8')).toBe(original);
  });

  it('reports an error for an unsolvable level and does not write it', () => {
    const dir = tempContent();
    const level = readJson(join(dir, W108)) as LevelJson;
    level.melody.notes = ['A5', 'G5', 'A5'];
    level.melody.beats = [1, 1, 2];
    level.par = 3;
    writeJson(join(dir, W108), level);
    const [result] = proveLevels({ contentDir: dir, ids: [], write: true });
    expect(result?.error).toBe('unsolvable');
    expect(readJson(join(dir, W108))).toMatchObject({ par: 3 });
  });
});
