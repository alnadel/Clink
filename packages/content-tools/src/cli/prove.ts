import { CONTENT_DIR } from '../paths';
import { formatProveResult, proveLevels } from '../prove';

const args = process.argv.slice(2);
const write = args.includes('--write');
const ids = args.filter((arg) => !arg.startsWith('--'));
const results = proveLevels({ contentDir: CONTENT_DIR, ids, write });
for (const result of results) console.log(formatProveResult(result));
if (results.some((result) => result.error)) process.exitCode = 1;
