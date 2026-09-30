import { checkContent, formatFinding } from '../check';
import { CONTENT_DIR, REPO_ROOT } from '../paths';

const release = process.argv.includes('--release');
const report = checkContent({ contentDir: CONTENT_DIR, release });
for (const finding of report.findings) console.log(formatFinding(finding, REPO_ROOT));
const errors = report.findings.filter((f) => f.severity === 'error').length;
const warnings = report.findings.length - errors;
console.log(`levels:check: ${report.levelsChecked} levels, ${errors} errors, ${warnings} warnings`);
if (errors > 0) process.exitCode = 1;
