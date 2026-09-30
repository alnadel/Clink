/**
 * "w2-05" becomes "2-5", the way a player reads a level; anything else is shown as it is. In a right-to-left
 * sentence the number is set apart as its own left-to-right run, or "1-12" would be drawn as "12-1".
 */
export function levelLabel(levelId: string, rightToLeft = false): string {
  const match = /^w(\d+)-(\d+)$/.exec(levelId);
  const label = match ? `${Number(match[1])}-${Number(match[2])}` : levelId;
  return rightToLeft ? `⁦${label}⁩` : label;
}
