/**
 * CONTRACT FILE. Owned by the architecture (docs/architecture/02-rules-engine.md §3).
 * Do not change the codes in an implementation issue.
 */

export type LevelErrorCode =
  /** Wrong schemaVersion, missing or wrongly typed field, bad world/bpm/beats/tools/id. */
  | 'E_SCHEMA'
  /** A note string does not match /^[A-G][#b]?[0-9]$/. */
  | 'E_NOTE_NAME'
  /** Bad scale: tonicHz <= 0, bad stepsCents, range not ascending, or an endpoint off the scale. */
  | 'E_RANGE'
  /** An emptyNote or melody note is not a scale position inside the range. */
  | 'E_OFF_SCALE'
  /** Fewer than 2 or more than 5 glasses. */
  | 'E_GLASS_COUNT'
  /** Bad glass: empty or duplicate id, capacity not an integer 2..12, water not an integer 0..capacity. */
  | 'E_GLASS'
  /** A glass's lowest fill line (emptyPos - capacity) is below the range. */
  | 'E_FILL_RANGE'
  /** Phrase not 3..8 notes, targets not 1..5, or more targets than glasses. */
  | 'E_PHRASE'
  /** More than 3 cubes, unknown glass id, or countdown not an integer 1..15. */
  | 'E_ICE';

export class LevelError extends Error {
  readonly code: LevelErrorCode;

  constructor(code: LevelErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.name = 'LevelError';
    this.code = code;
  }
}

/** Thrown by stubs that an issue has not implemented yet. Remove the throw when implementing. */
export class NotImplementedError extends Error {
  constructor(what: string) {
    super(`Not implemented: ${what}`);
    this.name = 'NotImplementedError';
  }
}
