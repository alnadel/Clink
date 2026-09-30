import { join } from 'node:path';
import type { WorldNumber } from '@clink/rules';
import { runA2Check } from '../a2';
import { generate } from '../generate';
import { writeJson } from '../io';
import { CANDIDATES_DIR, CONTENT_DIR } from '../paths';

function flag(name: string, fallback?: string): string {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (value !== undefined) return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`missing --${name}`);
}

try {
  if (process.argv.includes('--a2')) {
    const rows = runA2Check({ contentDir: CONTENT_DIR, seed: Number(flag('seed', '1')) });
    console.log('world  band    candidates  status');
    for (const row of rows) {
      const status = row.candidates >= 3 ? 'ok' : 'FAIL';
      console.log(
        `${String(row.world).padEnd(6)} ${row.band.padEnd(7)} ${String(row.candidates).padEnd(11)} ${status}`,
      );
    }
    if (rows.length === 0 || rows.some((row) => row.candidates < 3)) process.exitCode = 1;
  } else {
    const tune = flag('tune');
    const world = Number(flag('world')) as WorldNumber;
    const band = flag('band');
    const candidates = generate({
      contentDir: CONTENT_DIR,
      tune,
      phrase: flag('phrase'),
      world,
      band,
      count: Number(flag('count', '20')),
      seed: Number(flag('seed', '1')),
      attempts: Number(flag('attempts', '20000')),
    });
    console.log('file                          glasses  par  reachable  optimal  backward');
    candidates.forEach((candidate, i) => {
      const name = `w${world}-${band}-${String(i + 1).padStart(2, '0')}.json`;
      writeJson(join(CANDIDATES_DIR, tune, name), candidate.level);
      const row = [
        name.padEnd(29),
        String(candidate.level.glasses.length).padEnd(8),
        String(candidate.par).padEnd(4),
      ];
      console.log(
        `${row.join(' ')} ${String(candidate.reachable).padEnd(10)} ${String(candidate.optimalSolutions).padEnd(8)} ${candidate.backwardSteps}`,
      );
    });
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
