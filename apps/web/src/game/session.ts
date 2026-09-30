/**
 * The game session (rules 6, 7, 8, 11, 13). Pure: no DOM, audio, storage or analytics.
 * Exact behaviour (tap table, effect order): docs/architecture/05-web-app.md §3.
 */
import type { Level } from '@clink/rules';
import { NotImplementedError } from '../lib/not-implemented';
import type { GameSession, GameSessionOptions } from './types';

export function createGameSession(level: Level, options?: GameSessionOptions): GameSession {
  throw new NotImplementedError(`createGameSession(${level.id}, ${options?.resumeMoves?.length})`);
}
