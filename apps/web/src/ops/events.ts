/**
 * CONTRACT FILE. The 17 analytics events (BRD "Analytics events and KPIs" + survey_answer).
 * Spec: docs/architecture/09-ops.md §1. Do not change in an implementation issue.
 * Property names are snake_case to match the BRD and the dashboards.
 */

export type Platform = 'ios' | 'android' | 'desktop' | 'other';
export type MoveType = 'pour' | 'faucet' | 'sink';

export interface AnalyticsEventMap {
  session_start: {
    platform: Platform;
    browser: string;
    /** display-mode: standalone (installed PWA). */
    installed: boolean;
    locale: string;
    sound_on: boolean;
    app_version: string;
    /** experiment key -> variant name. */
    ab_flags: Record<string, string>;
    source: string | null;
    tester: boolean;
    session_no: number;
    first_session: boolean;
  };
  ftue_step: { step: string };
  level_start: { level_id: string; world: number; attempt: number };
  move: {
    level_id: string;
    move_no: number;
    type: MoveType;
    /** Glass id letter ("A"), or null for faucet. */
    from: string | null;
    /** Glass id letter, or null for sink. */
    to: string | null;
    units: number;
  };
  hint_used: { level_id: string; move_no: number };
  level_tuned: {
    level_id: string;
    moves: number;
    par: number;
    hints: number;
    undos: number;
    restarts: number;
    seconds: number;
  };
  level_complete: { level_id: string; stars: 1 | 2 | 3; song: 'played' | 'auto' | 'skipped' };
  level_abandon: { level_id: string; moves: number; seconds: number };
  daily_start: { puzzle_no: number };
  daily_complete: { puzzle_no: number; moves: number; par: number };
  share_complete: { puzzle_no: number; method: 'share' | 'clipboard' };
  link_open: { puzzle_no: number; new_device: boolean };
  install: { platform: Platform };
  setting_change: { setting: string; value: string };
  audio_state: { state: string; sound_on: boolean };
  error: { message: string; stack: string; level_id: string | null };
  survey_answer: { answer: 'very' | 'somewhat' | 'not' | 'skip' };
}

export type EventName = keyof AnalyticsEventMap;

/** What is queued and sent. */
export interface EventEnvelope<N extends EventName = EventName> {
  name: N;
  props: AnalyticsEventMap[N];
  /** Epoch ms. */
  ts: number;
  /** Per-device monotonic sequence (Profile.eventSeq), for ordering. */
  seq: number;
  sessionId: string;
  deviceId: string;
  appVersion: string;
}

/** One vendor integration (console for development, GameAnalytics after DEC-7). */
export interface AnalyticsAdapter {
  readonly name: string;
  /** Sends a batch in order. Rejects on network failure (the batch is retried later). */
  send(batch: readonly EventEnvelope[]): Promise<void>;
}

export interface Analytics {
  track<N extends EventName>(name: N, props: AnalyticsEventMap[N]): void;
  /** Sends queued events now (called on pagehide and every 10 s). */
  flush(): Promise<void>;
}
