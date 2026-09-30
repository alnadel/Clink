import { type FlagValue, fnv1a32, type RemoteConfig } from '@clink/rules';
export function bucketOf(d: string, e: string): number {
  return fnv1a32(`${d}:${e}`) % 100;
}
export function assignVariant(b: number, w: Readonly<Record<string, number>>): string {
  let t = 0;
  const keys = Object.keys(w);
  for (const k of keys) {
    t += w[k] as number;
    if (b < t) return k;
  }
  return keys[0] as string;
}
export interface ResolvedFlags {
  assignments: Record<string, string>;
  flags: Record<string, FlagValue>;
}
export function resolveFlags(c: RemoteConfig, d: string): ResolvedFlags {
  const assignments: Record<string, string> = {};
  const flags: Record<string, FlagValue> = {};
  for (const [k, e] of Object.entries(c.experiments)) {
    const v = assignVariant(bucketOf(d, k), e.weights);
    assignments[k] = v;
    Object.assign(flags, e.variants[v] ?? {});
  }
  return { assignments, flags };
}
