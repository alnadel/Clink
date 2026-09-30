import { cpSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CONTENT_DIR } from '../src/paths';

/** A fresh temp copy of the real content/ folder, safe to mutate. Returns the copy's path. */
export function tempContent(): string {
  const dir = mkdtempSync(join(tmpdir(), 'clink-content-'));
  cpSync(CONTENT_DIR, dir, { recursive: true });
  return dir;
}

export function tempDir(): string {
  return mkdtempSync(join(tmpdir(), 'clink-tmp-'));
}
