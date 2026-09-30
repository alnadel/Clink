/**
 * CONTRACT FILE. Audio engine: glass instrument, phrase playback and effects.
 * Spec: docs/architecture/06-audio.md. Do not change in an implementation issue.
 */

/**
 * off: player chose muted, or sound toggled off.
 * locked: sound is on but no user gesture has unlocked audio yet.
 * running: audible.
 * suspended / interrupted: the OS or browser paused audio (call, Siri, tab hidden).
 */
export type AudioStatus = 'off' | 'locked' | 'running' | 'suspended' | 'interrupted';

export type SfxName =
  | 'pour'
  | 'faucet'
  | 'drain'
  | 'ice-clink'
  | 'melt'
  | 'found'
  | 'flourish'
  | 'tap'
  | 'refuse';

export interface PhrasePlayback {
  stop(): void;
  /** Resolves when the last note has finished or stop() was called. */
  readonly done: Promise<void>;
}

export interface AudioEngine {
  readonly status: AudioStatus;
  /**
   * Must be called synchronously inside a user gesture handler (pointerdown/click).
   * Creates or resumes the AudioContext and applies the iOS audio session handling (NFR-05).
   * No AudioContext may exist before the first call (FR-14).
   */
  unlock(): Promise<void>;
  /** Sound on/off (settings). Off stops everything and sets status to 'off'. */
  setEnabled(enabled: boolean): void;
  /** Rings a glass at `hz`. `when` is AudioContext time (default: now). No-op unless running. */
  ring(hz: number, when?: number, velocity?: number): void;
  /** Plays a phrase at its tempo; onNote(i) fires as note i starts (for the melody bar cursor). */
  playPhrase(
    hz: readonly number[],
    beats: readonly number[],
    bpm: number,
    onNote?: (index: number) => void,
  ): PhrasePlayback;
  sfx(name: SfxName): void;
  /** Current AudioContext time in seconds, or 0 before unlock. */
  now(): number;
  /** Subscribe to status changes (for the audio_state event). Returns an unsubscribe function. */
  onStatusChange(listener: (status: AudioStatus) => void): () => void;
}
