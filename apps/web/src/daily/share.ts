/**
 * Spoiler-free share card text (FR-22). Exact format: docs/architecture/08-save-daily-share.md §4.
 *
 *   Clink #42 ⭐⭐
 *   💧💧💧💧💧💧 6/5
 *   https://clink.example/d/42?src=share
 */
import { NotImplementedError } from '../lib/not-implemented';
import type { ShareCardInput } from './types';

export function shareText(input: ShareCardInput): string {
  throw new NotImplementedError(`shareText(${input.puzzleNo})`);
}

/** The link on its own: `${origin}/d/${puzzleNo}?src=share`. */
export function shareUrl(origin: string, puzzleNo: number): string {
  throw new NotImplementedError(`shareUrl(${origin}, ${puzzleNo})`);
}
