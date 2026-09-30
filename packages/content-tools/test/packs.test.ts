import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fnv1a32, hex8, type LevelJson } from '@clink/rules';
import { describe, expect, it } from 'vitest';
import { readJson, writeJson } from '../src/io';
import { buildPacks } from '../src/packs';
import { tempContent, tempDir } from './helpers';

const NOW = new Date('2026-11-01T00:00:00Z');

function build(contentDir = tempContent(), outDir = join(tempDir(), 'content')) {
  return { manifest: buildPacks({ contentDir, outDir, now: NOW }), outDir, contentDir };
}

describe('buildPacks', () => {
  it('builds a manifest and a hashed pack whose text hashes to its file name', () => {
    const { manifest, outDir } = build();
    expect(manifest.levelOrder).toContain('w1-08');
    const w1 = manifest.packs.find((pack) => pack.id === 'w1');
    expect(w1?.file).toMatch(/^w1\.[0-9a-f]{8}\.json$/);
    const text = readFileSync(join(outDir, 'packs', w1?.file ?? ''), 'utf8');
    expect(`w1.${hex8(fnv1a32(text))}.json`).toBe(w1?.file);
    expect(w1?.hash).toBe(hex8(fnv1a32(text)));
    expect(manifest.builtAt).toBe(NOW.toISOString());
    expect(manifest.tunes['mary-had-a-little-lamb']).toEqual({
      title: 'Mary Had a Little Lamb',
      origin: expect.any(String),
    });
    expect(readJson(join(outDir, 'manifest.json'))).toEqual(manifest);
  });

  it('level hashes are hashes of each level JSON', () => {
    const { manifest, contentDir } = build();
    const level = readJson(join(contentDir, 'levels/w1/w1-08.json')) as LevelJson;
    expect(manifest.levelHashes['w1-08']).toBe(hex8(fnv1a32(JSON.stringify(level))));
  });

  it('is byte-identical when built twice with the same clock', () => {
    const contentDir = tempContent();
    const a = build(contentDir);
    const b = build(contentDir);
    expect(readFileSync(join(a.outDir, 'manifest.json'), 'utf8')).toBe(
      readFileSync(join(b.outDir, 'manifest.json'), 'utf8'),
    );
    expect(readdirSync(join(a.outDir, 'packs'))).toEqual(readdirSync(join(b.outDir, 'packs')));
  });

  it('refuses to build broken content and writes nothing', () => {
    const contentDir = tempContent();
    const level = readJson(join(contentDir, 'levels/w1/w1-08.json')) as LevelJson;
    level.par = 9;
    writeJson(join(contentDir, 'levels/w1/w1-08.json'), level);
    const outDir = join(tempDir(), 'content');
    expect(() => buildPacks({ contentDir, outDir, now: NOW })).toThrow(/E_PAR/);
    expect(existsSync(outDir)).toBe(false);
  });

  it('removes stale files and copies config when asked', () => {
    const contentDir = tempContent();
    const outDir = join(tempDir(), 'content');
    buildPacks({ contentDir, outDir, now: NOW });
    writeJson(join(outDir, 'packs', 'stale.json'), {});
    const configOut = join(tempDir(), 'config.json');
    buildPacks({ contentDir, outDir, configOut, now: NOW });
    expect(existsSync(join(outDir, 'packs', 'stale.json'))).toBe(false);
    expect(readJson(configOut)).toEqual(readJson(join(contentDir, 'config.json')));
  });
});
