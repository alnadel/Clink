import { NotImplementedError } from './errors';
import { DEFAULT_TWO_STAR_FACTOR } from './types';

/**
 * Stars for a solve (rule 14):
 *   3 if moves <= par
 *   2 if moves <= Math.ceil(twoStarFactor * par - 1e-9)   (the epsilon matters: 2.2 * 25 = 55.00000000000001)
 *   1 otherwise
 * If hinted, the result is capped at 2.
 */
export function starsFor(
  moves: number,
  par: number,
  hinted: boolean,
  twoStarFactor: number = DEFAULT_TWO_STAR_FACTOR,
): 1 | 2 | 3 {
  throw new NotImplementedError(`starsFor(${moves}, ${par}, ${hinted}, ${twoStarFactor})`);
}
