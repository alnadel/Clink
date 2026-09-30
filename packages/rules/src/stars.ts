import { DEFAULT_TWO_STAR_FACTOR } from './types';

/**
 * Stars for a solve (rule 14): 3 at par, 2 within ceil(twoStarFactor * par), else 1; a hint caps at 2.
 * The epsilon matters: 2.2 * 25 === 55.00000000000001 in JavaScript.
 */
export function starsFor(
  moves: number,
  par: number,
  hinted: boolean,
  twoStarFactor: number = DEFAULT_TWO_STAR_FACTOR,
): 1 | 2 | 3 {
  const stars = moves <= par ? 3 : moves <= Math.ceil(twoStarFactor * par - 1e-9) ? 2 : 1;
  return hinted && stars === 3 ? 2 : stars;
}
