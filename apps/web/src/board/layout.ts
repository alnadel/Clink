/**
 * Pure board layout (FR-01, NFR-09 touch targets). No Pixi, no DOM: testable in Node.
 * Exact algorithm: docs/architecture/05-web-app.md §4.2.
 */
import type { Level } from '@clink/rules';
import { NotImplementedError } from '../lib/not-implemented';
import type { BoardLayout } from './types';

export function computeLayout(width: number, height: number, level: Level): BoardLayout {
  throw new NotImplementedError(`computeLayout(${width}, ${height}, ${level.id})`);
}
