/** "w2-05" becomes "2-5", the way a player reads a level; anything else is shown as it is. */
export function levelLabel(levelId: string): string {
  const match = /^w(\d+)-(\d+)$/.exec(levelId);
  return match ? `${Number(match[1])}-${Number(match[2])}` : levelId;
}
