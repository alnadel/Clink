import { CONTENT_DIR } from '../paths';
import { seedGuides, seedLevels, seedSchedule, seedTunes } from '../seed';

// Bootstraps the initial game content deterministically: `pnpm content:seed [w1 w2 w3 d ...]`.
// Existing level files are never overwritten. Designers then adjust levels by hand and re-prove them.
const only = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const step = process.argv.includes('--guides-only') ? 'guides' : 'all';

if (step === 'all') {
  seedTunes(CONTENT_DIR);
  seedLevels({
    contentDir: CONTENT_DIR,
    only: only.length > 0 ? only : undefined,
    log: (line) => console.log(line),
  });
  seedSchedule(CONTENT_DIR);
}
seedGuides(CONTENT_DIR);
console.log('content:seed: done');
