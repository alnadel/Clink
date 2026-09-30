import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isCanonical, listJsonFiles, readJson, writeJson } from '../src/io';
import { loadContent } from '../src/load';
import { CONTENT_DIR } from '../src/paths';
import { tempContent, tempDir } from './helpers';

describe('io', () => {
  it('writeJson then readJson round-trips and writes canonical text', () => {
    const dir = tempDir();
    const file = join(dir, 'nested', 'a.json');
    writeJson(file, { b: [1, 2], a: 'x' });
    expect(readJson(file)).toEqual({ b: [1, 2], a: 'x' });
    expect(listJsonFiles(dir)).toEqual([file]);
  });

  it('isCanonical is true for written files and false for minified or invalid text', () => {
    expect(isCanonical(`${JSON.stringify({ a: 1 }, null, 2)}\n`)).toBe(true);
    expect(isCanonical('{"a":1}')).toBe(false);
    expect(isCanonical('not json')).toBe(false);
  });

  it('readJson names the file in its error', () => {
    const dir = tempDir();
    const file = join(dir, 'bad.json');
    writeFileSync(file, '{');
    expect(() => readJson(file)).toThrow(file);
  });

  it('listJsonFiles returns [] for a missing folder', () => {
    expect(listJsonFiles(join(tempDir(), 'nope'))).toEqual([]);
  });
});

describe('loadContent', () => {
  it('loads the real content folder without file errors', () => {
    const content = loadContent(CONTENT_DIR);
    expect(content.fileErrors).toEqual([]);
    expect(content.tunes?.tunes['mary-had-a-little-lamb']).toBeDefined();
    expect(content.levels.filter((l) => l.kind === 'campaign').map((l) => l.path.split('/').pop())).toContain(
      'w1-08.json',
    );
  });

  it('gives a parse error instead of throwing for a broken level file', () => {
    const dir = tempContent();
    writeFileSync(join(dir, 'levels', 'w1', 'w1-01.json'), '{ broken');
    const broken = loadContent(dir).levels.find((l) => l.path.endsWith('w1-01.json'));
    expect(broken?.json).toBeNull();
    expect(broken?.parseError).toBeTruthy();
  });

  it('reports a missing top-level file', () => {
    const dir = tempContent();
    rmSync(join(dir, 'tunes.json'));
    const content = loadContent(dir);
    expect(content.tunes).toBeNull();
    expect(content.fileErrors.map((e) => e.file)).toContain(join(dir, 'tunes.json'));
  });
});
