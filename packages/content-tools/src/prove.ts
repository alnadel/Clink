import { basename } from 'node:path';
import { compileLevel, type LevelJson, solve } from '@clink/rules';
import { writeJson } from './io';
import { loadContent } from './load';

export interface ProveResult {
  id: string;
  file: string;
  reachable: number;
  par: number | null;
  optimalSolutions: number;
  filePar: number | null;
  fileOptimal: number | null;
  /** True when the solver's par or optimal count differs from the file. */
  changed: boolean;
  error: string | null;
}

export interface ProveOptions {
  contentDir: string;
  /** Empty = every level file (campaign and daily). */
  ids: string[];
  /** Rewrite `par` and `optimalSolutions` in the files. Never changes any other field. */
  write: boolean;
}

/** Proves levels with the solver and optionally writes the result. Spec: docs/architecture/03 §4. */
export function proveLevels(options: ProveOptions): ProveResult[] {
  const results: ProveResult[] = [];
  for (const file of loadContent(options.contentDir).levels) {
    const id = basename(file.path, '.json');
    if (options.ids.length > 0 && !options.ids.includes(id)) continue;
    const base = { id, file: file.path, reachable: 0, par: null, optimalSolutions: 0 };
    if (file.parseError !== null || file.json === null) {
      results.push({
        ...base,
        filePar: null,
        fileOptimal: null,
        changed: false,
        error: file.parseError ?? 'no JSON',
      });
      continue;
    }
    const json = file.json as LevelJson;
    const filePar = typeof json.par === 'number' ? json.par : null;
    const fileOptimal = typeof json.optimalSolutions === 'number' ? json.optimalSolutions : null;
    try {
      const summary = solve(compileLevel(json));
      if (summary.truncated) throw new Error('more than 100,000 reachable states');
      if (summary.par === null) throw new Error('unsolvable');
      const changed = summary.par !== filePar || summary.optimalSolutions !== fileOptimal;
      results.push({
        ...base,
        reachable: summary.reachable,
        par: summary.par,
        optimalSolutions: summary.optimalSolutions,
        filePar,
        fileOptimal,
        changed,
        error: null,
      });
      if (options.write && changed) {
        writeJson(file.path, { ...json, par: summary.par, optimalSolutions: summary.optimalSolutions });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ ...base, filePar, fileOptimal, changed: false, error: message });
    }
  }
  return results;
}

/** One CLI line per level, as in the spec. */
export function formatProveResult(result: ProveResult): string {
  if (result.error) return `${result.id}  ERROR ${result.error}`;
  const status = result.changed ? 'CHANGED' : 'ok';
  return `${result.id}  reachable=${result.reachable}  par=${result.par}  optimal=${result.optimalSolutions}   (file: par=${result.filePar} optimal=${result.fileOptimal})  ${status}`;
}
