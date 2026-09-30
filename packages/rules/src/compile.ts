import { NotImplementedError } from './errors';
import type { Level, LevelJson } from './types';

/**
 * Validates a level file and resolves every note to a scale position.
 * Throws LevelError with the first failing code, checked in the order of the spec.
 * Does NOT check par, optimalSolutions, world constraints or solvability (the CI checker does).
 * Spec: docs/architecture/02-rules-engine.md §3.
 */
export function compileLevel(json: LevelJson): Level {
  throw new NotImplementedError(`compileLevel(${json.id})`);
}
