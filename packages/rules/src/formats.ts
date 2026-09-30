/**
 * CONTRACT FILE. Formats of every JSON file in content/ and of the generated files the
 * web app downloads from /content/ and /config.json.
 * Spec: docs/architecture/03-content-pipeline.md. Do not change in an implementation issue.
 */
import type { LevelJson, ScaleJson, ToolName } from './types';

// ---------------------------------------------------------------------------
// content/tunes.json (hand-edited)
// ---------------------------------------------------------------------------

export type RightsStatus = 'pending' | 'cleared' | 'rejected';

/** One transcription of a tune's phrase in one scale and key. Levels copy it into `melody`. */
export interface TunePhraseJson {
  /** Unique within the tune, e.g. "a" or "a-pentatonic". */
  id: string;
  scale: ScaleJson;
  notes: string[];
  beats: number[];
  bpm: number;
}

export interface TuneJson {
  title: string;
  /** Songbook origin line, e.g. "American nursery rhyme, 1830". */
  origin: string;
  /** Only "cleared" tunes may ship after Gate 3 (checked by levels:check --release). */
  rights: RightsStatus;
  phrases: TunePhraseJson[];
}

export interface TunesFile {
  schemaVersion: 1;
  /** Keyed by tuneId, kebab-case, e.g. "mary-had-a-little-lamb". */
  tunes: Record<string, TuneJson>;
}

// ---------------------------------------------------------------------------
// content/bands.json (hand-edited): world constraints and difficulty bands
// ---------------------------------------------------------------------------

/** "major-pentatonic" = stepsCents [0,200,400,700,900]; "major" = [0,200,400,500,700,900,1100]. */
export type ScaleKind = 'major-pentatonic' | 'major';

export interface BandJson {
  /** e.g. "easy", "medium", "hard". */
  id: string;
  /** Inclusive par range for the band. */
  par: [number, number];
}

export interface WorldRulesJson {
  glasses: [number, number];
  phraseNotes: [number, number];
  scales: ScaleKind[];
  par: [number, number];
  /** Tools the generator may add in this world. Empty = none. */
  tools: ToolName[];
  /** Ice cubes the generator adds: [min, max]. [0, 0] = no ice. */
  ice: [number, number];
  bands: BandJson[];
}

export interface BandsFile {
  schemaVersion: 1;
  worlds: Record<'1' | '2' | '3', WorldRulesJson>;
}

// ---------------------------------------------------------------------------
// content/schedule.json (hand-edited): the daily puzzle order
// ---------------------------------------------------------------------------

export interface ScheduleFile {
  schemaVersion: 1;
  /** Local calendar date of puzzle #1, "YYYY-MM-DD". */
  launchDate: string;
  /** Daily level ids in order: puzzle #n is puzzles[n - 1]. */
  puzzles: string[];
}

// ---------------------------------------------------------------------------
// content/guides.json (hand-edited): onboarding (FR-26), intros (FR-27), link tutorial (FR-23)
// ---------------------------------------------------------------------------

/** What completes a guide step. Optional fields narrow the match. */
export type GuideTrigger =
  | { on: 'ring'; glass?: number }
  | { on: 'pour'; from?: number; to?: number }
  | { on: 'tool'; tool?: ToolName }
  | { on: 'found'; target?: number }
  | { on: 'tuned' }
  | { on: 'melody' }
  | { on: 'tap' };

export interface GuideStep {
  /** Unique within its script; sent as ftue_step.step as "<script>:<id>". */
  id: string;
  /** i18n key of the one short line of text; null = no text. */
  textKey: string | null;
  /** What pulses. */
  highlight?: { glass?: number; melody?: boolean; tool?: ToolName };
  /** While this step is active, only these inputs are accepted. Omitted = everything allowed. */
  allow?: { glasses?: number[]; melody?: boolean; tools?: ToolName[]; undo?: boolean; hint?: boolean };
  until: GuideTrigger;
}

export interface GuidesFile {
  schemaVersion: 1;
  /** Guided levels, keyed by level id (levels 1-3). */
  levels: Record<string, GuideStep[]>;
  /** Shown the first time a level containing that mechanic opens (FR-27). */
  intros: Record<'faucet' | 'sink' | 'ice', GuideStep[]>;
  /** Level ids played, in order, before a new device's first daily from a shared link (FR-23). */
  linkTutorial: string[];
}

// ---------------------------------------------------------------------------
// content/config.json -> served as /config.json (remote config, FR-38, FR-39)
// ---------------------------------------------------------------------------

export type FlagValue = number | string | boolean;

export interface ExperimentJson {
  /** Variant name -> flag values, e.g. { "control": { "twoStarFactor": 1.5 } }. */
  variants: Record<string, Record<string, FlagValue>>;
  /** Variant name -> weight. Weights sum to 100. Order of keys defines bucket ranges. */
  weights: Record<string, number>;
}

export interface RemoteConfig {
  schemaVersion: 1;
  /** Level ids to hide and skip in unlock order. */
  disabledLevels: string[];
  /** Puzzle number (as a string) -> daily level id, overriding schedule.json. */
  dailyOverrides: Record<string, string>;
  experiments: Record<string, ExperimentJson>;
  /** Minutes between config refreshes while the app is open (30). */
  refreshMinutes: number;
}

// ---------------------------------------------------------------------------
// Generated by `pnpm packs:build` into apps/web/public/content/ (never hand-edited)
// ---------------------------------------------------------------------------

export type PackId = 'w1' | 'w2' | 'w3' | 'daily';

export interface PackRef {
  id: PackId;
  /** File name under /content/packs/, e.g. "w1.3f9a1c2b.json". */
  file: string;
  /** fnv1a32 of the pack file's text, 8 lowercase hex chars. */
  hash: string;
  levelIds: string[];
}

export interface PackFile {
  schemaVersion: 1;
  id: PackId;
  levels: LevelJson[];
}

export interface ContentManifest {
  schemaVersion: 1;
  /** ISO timestamp of the build. */
  builtAt: string;
  packs: PackRef[];
  /** Campaign order: "w1-01" ... "w3-20". */
  levelOrder: string[];
  /** Level id -> fnv1a32(JSON.stringify(levelJson)), 8 hex chars. Used to invalidate saves. */
  levelHashes: Record<string, string>;
  /** Songbook data (no phrases, no rights). */
  tunes: Record<string, { title: string; origin: string }>;
  schedule: ScheduleFile;
  guides: GuidesFile;
}
