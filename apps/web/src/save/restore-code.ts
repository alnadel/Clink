/**
 * Restore code (FR-33): progress as a short text code, no server.
 * Exact bit layout: docs/architecture/08-save-daily-share.md §2.
 */
import { NotImplementedError } from '../lib/not-implemented';
import type { Settings } from './types';

export type StarSlot = 0 | 1 | 2 | 3;

/** Campaign slots in the code, in manifest.levelOrder order (w1-01 ... w3-20). */
export const RESTORE_LEVEL_SLOTS = 60;
/** Highest daily puzzle number a code can hold. */
export const RESTORE_MAX_DAILIES = 1023;

export interface RestoreData {
  /** Exactly RESTORE_LEVEL_SLOTS entries: 0 = unsolved, 1-3 = stars. */
  levelStars: StarSlot[];
  /** Index k - 1 = puzzle k: 0 = unsolved, 1-3 = stars. At most RESTORE_MAX_DAILIES entries. */
  dailyStars: StarSlot[];
  settings: Settings;
}

export type DecodeResult =
  | { ok: true; data: RestoreData }
  | { ok: false; error: 'format' | 'version' | 'checksum' };

/** Crockford base32, upper case, grouped in 4s with "-". */
export function encodeRestoreCode(data: RestoreData): string {
  throw new NotImplementedError(`encodeRestoreCode(${data.levelStars.length})`);
}

/** Accepts lower case, spaces, missing dashes, and O/I/L as 0/1/1. */
export function decodeRestoreCode(code: string): DecodeResult {
  throw new NotImplementedError(`decodeRestoreCode(${code})`);
}
