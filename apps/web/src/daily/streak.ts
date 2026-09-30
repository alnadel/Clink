export function currentStreak(solved: ReadonlySet<number>, today: number): number {
  let n = solved.has(today) ? today : today - 1;
  let c = 0;
  while (solved.has(n)) {
    c++;
    n--;
  }
  return c;
}
