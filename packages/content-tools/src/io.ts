import { mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** Reads and parses a JSON file. Throws Error(`${path}: ${reason}`) on read or parse failure. */
export function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** Canonical content formatting: JSON.stringify(value, null, 2) + '\n'. Creates parent folders. */
export function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  // Written aside and renamed, so a tool reading the file at the same moment never sees half of it.
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(temporary, path);
}

/** True when the text is exactly the canonical formatting of its own JSON value. */
export function isCanonical(text: string): boolean {
  try {
    return text === `${JSON.stringify(JSON.parse(text), null, 2)}\n`;
  } catch {
    return false;
  }
}

/** Every .json file under `dir`, recursively, as sorted absolute paths. [] if `dir` is missing. */
export function listJsonFiles(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) files.push(...listJsonFiles(path));
    else if (entry.endsWith('.json')) files.push(path);
  }
  return files.sort();
}
