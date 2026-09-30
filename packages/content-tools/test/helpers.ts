import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeJson } from '../src/io';
import { CONTENT_DIR } from '../src/paths';

/**
 * A fresh temp copy of content/ that holds only BRD Appendix A (w1-08): the tests below change one thing
 * at a time and expect nothing else to be wrong, which must not depend on how much of the campaign
 * exists. Returns the copy's path.
 */
export function tempContent(): string {
  const dir = mkdtempSync(join(tmpdir(), 'clink-content-'));
  cpSync(CONTENT_DIR, dir, { recursive: true });
  for (const world of ['w2', 'w3']) rmSync(join(dir, 'levels', world), { recursive: true, force: true });
  rmSync(join(dir, 'daily'), { recursive: true, force: true });
  for (let n = 1; n <= 20; n++) {
    if (n !== 8) rmSync(join(dir, 'levels', 'w1', `w1-${String(n).padStart(2, '0')}.json`), { force: true });
  }
  writeJson(join(dir, 'schedule.json'), { schemaVersion: 1, launchDate: '2026-11-30', puzzles: [] });
  writeJson(join(dir, 'guides.json'), {
    schemaVersion: 1,
    levels: {},
    intros: { faucet: [], sink: [], ice: [] },
    linkTutorial: [],
  });
  return dir;
}

export function tempDir(): string {
  return mkdtempSync(join(tmpdir(), 'clink-tmp-'));
}
