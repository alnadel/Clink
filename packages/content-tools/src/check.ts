import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import {
  applyMove,
  compileLevel,
  explore,
  initialState,
  isTuned,
  LevelError,
  type LevelJson,
  parseNote,
  type ScaleKind,
  solutionPath,
} from '@clink/rules';
import { isCanonical } from './io';
import { type LevelFile, type LoadedContent, loadContent } from './load';
import { REPO_ROOT } from './paths';

export interface Finding {
  severity: 'error' | 'warn';
  code: string;
  file: string;
  message: string;
}

export interface CheckReport {
  levelsChecked: number;
  findings: Finding[];
}

export interface CheckOptions {
  contentDir: string;
  /** Stricter checks for a release build: rights cleared and all 60 campaign levels present. */
  release?: boolean;
  /** Where the English strings live (guide text keys are checked against it). */
  i18nFile?: string;
}

const AUDIO_LOW = 4800; // C3
const AUDIO_HIGH = 8100; // A5
const SCALE_KINDS: Record<string, ScaleKind> = {
  '0,200,400,700,900': 'major-pentatonic',
  '0,200,400,500,700,900,1100': 'major',
};

/** Checks every content file. Errors fail the build; warnings do not. Spec: docs/architecture/03 §3. */
export function checkContent(options: CheckOptions): CheckReport {
  const release = options.release ?? false;
  const content = loadContent(options.contentDir);
  const findings: Finding[] = [];
  const add: Add = (severity, code, file, message) => {
    findings.push({ severity, code, file, message });
    return undefined;
  };

  for (const error of content.fileErrors) add('error', 'E_FILE', error.file, error.message);

  const ids = { campaign: new Set<string>(), daily: new Set<string>() };
  for (const level of content.levels) {
    const id = (level.json as { id?: unknown } | null)?.id;
    if (typeof id === 'string') ids[level.kind].add(id);
    checkLevel(level, content, release, add);
  }

  checkWholeContent(content, ids, release, options.i18nFile, add);
  return { levelsChecked: content.levels.length, findings };
}

type Add = (severity: Finding['severity'], code: string, file: string, message: string) => undefined;

function checkLevel(file: LevelFile, content: LoadedContent, release: boolean, add: Add): undefined {
  const { path } = file;
  const error = (code: string, message: string): undefined => add('error', code, path, message);
  if (!isCanonical(file.text))
    add('warn', 'W_FORMAT', path, 'file is not canonically formatted (2-space JSON + newline)');
  if (file.parseError !== null) return error('E_JSON', file.parseError);
  const json = file.json as LevelJson;

  // E_ID
  const idProblem = checkId(file, json);
  if (idProblem) return error('E_ID', idProblem);

  // compileLevel
  let level: ReturnType<typeof compileLevel>;
  try {
    level = compileLevel(json);
  } catch (e) {
    if (e instanceof LevelError) return error(e.code, e.message);
    throw e;
  }

  if (json.tools.length > 0 && json.world < 2)
    return error('E_TOOLS_WORLD', 'faucet and sink start in World 2');
  if (json.ice.length > 0 && json.world !== 3) return error('E_ICE_WORLD', 'ice starts in World 3');
  const [low, high] = json.scale.range;
  if (parseNote(low) < AUDIO_LOW || parseNote(high) > AUDIO_HIGH) {
    return error('E_AUDIO_RANGE', 'scale range must lie within C3..A5 (the glass instrument range)');
  }
  const tune = content.tunes?.tunes[json.melody.tuneId];
  if (!tune) return error('E_TUNE', `unknown tuneId ${json.melody.tuneId}`);
  if (tune.title !== json.melody.title) {
    return error('E_TUNE', `melody.title "${json.melody.title}" differs from tunes.json "${tune.title}"`);
  }
  if (isTuned(level, initialState(level)))
    return error('E_TUNED_AT_START', 'the level is already solved at the start');

  const graph = explore(level);
  if (graph.truncated) return error('E_TOO_MANY_STATES', 'more than 100,000 reachable states');
  if (graph.par === null) return error('E_UNSOLVABLE', 'no tuned state is reachable');
  if (json.par !== graph.par)
    return error('E_PAR', `par is ${json.par} in the file but the solver found ${graph.par}`);
  if (json.optimalSolutions !== graph.optimalSolutions) {
    return error(
      'E_OPTIMAL',
      `optimalSolutions is ${json.optimalSolutions} in the file but the solver found ${graph.optimalSolutions}`,
    );
  }
  // FR-04: replaying the solution tunes on exactly the last move.
  let state = initialState(level);
  const path_ = solutionPath(level, graph);
  const replayOk = path_.every((move, i) => {
    if (isTuned(level, state)) return false;
    const result = applyMove(level, state, move);
    if (!result.ok) return false;
    state = result.state;
    return isTuned(level, state) === (i === path_.length - 1);
  });
  if (!replayOk) return error('E_REPLAY', 'replaying the solver path does not tune on exactly the last move');
  if (release && tune.rights !== 'cleared') {
    return error('E_RIGHTS', `tune ${json.melody.tuneId} has rights "${tune.rights}", not "cleared"`);
  }

  if (file.kind === 'campaign') warnWorldLimits(path, json, content, add);
  return undefined;
}

function checkId(file: LevelFile, json: LevelJson): string | null {
  const id = (json as { id?: unknown }).id;
  if (typeof id !== 'string') return 'id must be a string';
  if (basename(file.path) !== `${id}.json`) return `file name must be ${id}.json`;
  if (file.kind === 'daily') {
    if (!/^d\d{3}$/.test(id)) return 'daily ids look like d001';
    return null;
  }
  const match = /^w([1-3])-\d{2}$/.exec(id);
  if (!match) return 'campaign ids look like w1-08';
  const world = Number(match[1]);
  if (basename(dirname(file.path)) !== `w${world}`) return `level ${id} must sit in levels/w${world}/`;
  if (json.world !== world) return `world is ${json.world} but the id says ${world}`;
  return null;
}

function warnWorldLimits(path: string, json: LevelJson, content: LoadedContent, add: Add): void {
  const rules = content.bands?.worlds[String(json.world) as '1' | '2' | '3'];
  if (!rules) return;
  const within = (value: number, [lo, hi]: [number, number]) => value >= lo && value <= hi;
  if (!within(json.glasses.length, rules.glasses)) {
    add(
      'warn',
      'W_WORLD_GLASSES',
      path,
      `${json.glasses.length} glasses; world ${json.world} expects ${rules.glasses.join('-')}`,
    );
  }
  if (!within(json.melody.notes.length, rules.phraseNotes)) {
    add(
      'warn',
      'W_WORLD_PHRASE',
      path,
      `${json.melody.notes.length} notes; world ${json.world} expects ${rules.phraseNotes.join('-')}`,
    );
  }
  const kind = SCALE_KINDS[json.scale.stepsCents.join(',')];
  if (!kind || !rules.scales.includes(kind)) {
    add('warn', 'W_WORLD_SCALE', path, `scale ${kind ?? 'custom'} is not expected in world ${json.world}`);
  }
  if (!within(json.par, rules.par)) {
    add('warn', 'W_WORLD_PAR', path, `par ${json.par}; world ${json.world} expects ${rules.par.join('-')}`);
  }
}

function checkWholeContent(
  content: LoadedContent,
  ids: { campaign: Set<string>; daily: Set<string> },
  release: boolean,
  i18nFile: string | undefined,
  add: Add,
): void {
  const dir = content.contentDir;

  // E_MISSING: all 60 campaign levels.
  const missing: string[] = [];
  for (let world = 1; world <= 3; world++) {
    for (let n = 1; n <= 20; n++) {
      const id = `w${world}-${String(n).padStart(2, '0')}`;
      if (!ids.campaign.has(id)) missing.push(id);
    }
  }
  if (missing.length > 0) {
    add(
      release ? 'error' : 'warn',
      'E_MISSING',
      join(dir, 'levels'),
      `${missing.length} campaign levels missing (first: ${missing[0]})`,
    );
  }

  // E_SCHEDULE
  if (content.schedule) {
    const { launchDate, puzzles } = content.schedule;
    const file = join(dir, 'schedule.json');
    if (!isRealDate(launchDate))
      add('error', 'E_SCHEDULE', file, `launchDate "${launchDate}" is not a valid YYYY-MM-DD date`);
    for (const id of puzzles) {
      if (!ids.daily.has(id))
        add('error', 'E_SCHEDULE', file, `schedule names ${id}, which has no daily file`);
    }
  }

  // E_GUIDE
  if (content.guides) {
    const file = join(dir, 'guides.json');
    const strings = readStrings(i18nFile ?? resolve(REPO_ROOT, 'apps/web/src/i18n/en.json'));
    const steps = [
      ...Object.values(content.guides.levels).flat(),
      ...Object.values(content.guides.intros).flat(),
    ];
    for (const key of Object.keys(content.guides.levels)) {
      const levelId = key.split(':')[0] ?? key;
      if (!ids.campaign.has(levelId)) add('error', 'E_GUIDE', file, `guide for unknown level ${key}`);
    }
    for (const id of content.guides.linkTutorial) {
      if (!ids.campaign.has(id)) add('error', 'E_GUIDE', file, `linkTutorial names unknown level ${id}`);
    }
    for (const step of steps) {
      if (step.textKey !== null && !(step.textKey in strings)) {
        add('error', 'E_GUIDE', file, `guide step ${step.id} uses missing text key ${step.textKey}`);
      }
    }
  }

  // E_CONFIG
  if (content.config) {
    const file = join(dir, 'config.json');
    for (const id of content.config.disabledLevels) {
      if (!ids.campaign.has(id) && !ids.daily.has(id))
        add('error', 'E_CONFIG', file, `disabledLevels names unknown level ${id}`);
    }
    for (const [n, id] of Object.entries(content.config.dailyOverrides)) {
      if (!ids.daily.has(id)) add('error', 'E_CONFIG', file, `dailyOverrides ${n} names unknown daily ${id}`);
    }
    for (const [name, experiment] of Object.entries(content.config.experiments)) {
      const total = Object.values(experiment.weights).reduce((sum, w) => sum + w, 0);
      if (total !== 100)
        add('error', 'E_CONFIG', file, `experiment ${name}: weights sum to ${total}, not 100`);
      for (const variant of Object.keys(experiment.weights)) {
        if (!(variant in experiment.variants)) {
          add('error', 'E_CONFIG', file, `experiment ${name}: weight for unknown variant ${variant}`);
        }
      }
    }
  }
}

function isRealDate(text: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function readStrings(file: string): Record<string, string> {
  if (!existsSync(file)) return {};
  return JSON.parse(readFileSync(file, 'utf8')) as Record<string, string>;
}

/** Formats a finding for the CLI: `ERROR E_PAR content/levels/w1/w1-08.json: message`. */
export function formatFinding(finding: Finding, root: string): string {
  const label = finding.severity === 'error' ? 'ERROR' : 'WARN ';
  const file = finding.file.startsWith(root) ? finding.file.slice(root.length + 1) : finding.file;
  return `${label} ${finding.code} ${file}: ${finding.message}`;
}
