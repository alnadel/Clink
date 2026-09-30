/**
 * CONTRACT FILE. Everything stored on the device (IndexedDB via idb-keyval).
 * Spec: docs/architecture/08-save-daily-share.md §1. Do not change in an implementation issue.
 * Changing a shape later requires bumping `schema` and adding a migration.
 */
import type { Move } from '@clink/rules';
import type { NoteLabelMode } from '../board/types';

/** "YYYY-MM-DD" in the player's local time zone. */
export type LocalDateString = string;

export type LanguageSetting = 'system' | 'en' | 'ar';
export type ReducedMotionSetting = 'system' | 'on' | 'off';

export interface Settings {
  sound: boolean;
  autoPlaySong: boolean;
  labels: NoteLabelMode;
  reducedMotion: ReducedMotionSetting;
  language: LanguageSetting;
  vibration: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  autoPlaySong: false,
  labels: 'none',
  reducedMotion: 'system',
  language: 'system',
  vibration: true,
};

/** IndexedDB key "profile". */
export interface Profile {
  schema: 1;
  /** crypto.randomUUID(), created on first launch, never changes, never leaves analytics. */
  deviceId: string;
  createdAt: string;
  firstSessionDate: LocalDateString;
  /** First-touch acquisition source from ?src= (null if none). */
  source: string | null;
  /** Set by ?tester=1 on any visit; excluded from KPI cohorts. */
  tester: boolean;
  /** False until the first-launch "Play with sound" / "Play muted" choice (FR-14). */
  soundChoiceMade: boolean;
  settings: Settings;
  /** Guide scripts and intros already completed (FR-26, FR-27), e.g. "level:w1-01", "intro:ice", "linkTutorial". */
  seenGuides: string[];
  /** Level id -> attempts started on this device (level_start.attempt). */
  levelAttempts: Record<string, number>;
  /** FR-34: at most 2. */
  installPromptCount: number;
  surveyAnswered: boolean;
  sessionCount: number;
  /** Epoch ms of the last user activity (session timeout = 30 min). */
  lastActiveAt: number;
  /** Monotonic counter for analytics envelopes. */
  eventSeq: number;
}

export interface LevelProgress {
  stars: 1 | 2 | 3;
  bestMoves: number;
  solvedAt: string;
}

export interface DailyProgress {
  moves: number;
  par: number;
  stars: 1 | 2 | 3;
}

/** IndexedDB key "progress". */
export interface Progress {
  schema: 1;
  /** Campaign levels solved at least once, by level id. Best result kept. */
  levels: Record<string, LevelProgress>;
  /** Daily puzzles solved, by puzzle number (as a string key). */
  dailies: Record<string, DailyProgress>;
}

/** IndexedDB key "current": the level in progress, saved after every move (FR-32). */
export interface CurrentLevel {
  schema: 1;
  kind: 'campaign' | 'daily';
  levelId: string;
  /** Daily puzzle number, or null for campaign levels. */
  puzzleNo: number | null;
  /** manifest.levelHashes[levelId] when started; a different hash on resume discards this record. */
  levelHash: string;
  moves: Move[];
  hinted: boolean;
  hints: number;
  undos: number;
  restarts: number;
  /** Time spent in the level so far (foreground only), for level_tuned.seconds. */
  elapsedMs: number;
  /** level_start.attempt: 1 on the first open of this level on this device. */
  attempt: number;
}

export interface SaveStore {
  /** Returns the stored profile, or creates, stores and returns a new one. */
  loadProfile(): Promise<Profile>;
  /** True if the last loadProfile() created the profile (a new device: link_open.new_device, FR-23). */
  wasProfileCreated(): boolean;
  saveProfile(profile: Profile): Promise<void>;
  /** Returns stored progress or an empty Progress. */
  loadProgress(): Promise<Progress>;
  saveProgress(progress: Progress): Promise<void>;
  loadCurrent(): Promise<CurrentLevel | null>;
  /** null deletes the record. */
  saveCurrent(current: CurrentLevel | null): Promise<void>;
  /** Calls navigator.storage.persist() once (NFR-08). Resolves to the browser's answer. */
  requestPersistence(): Promise<boolean>;
}
