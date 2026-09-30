/**
 * A/B flags (FR-39). Spec: docs/architecture/09-ops.md §4.
 * bucket = fnv1a32(`${deviceId}:${experimentKey}`) % 100
 */
import type { FlagValue, RemoteConfig } from '@clink/rules';
import { NotImplementedError } from '../lib/not-implemented';

/** 0..99, stable per device and experiment. */
export function bucketOf(deviceId: string, experimentKey: string): number {
  throw new NotImplementedError(`bucketOf(${deviceId}, ${experimentKey})`);
}

/**
 * Walks `weights` in key order, adding each weight; returns the first variant whose running
 * total is greater than `bucket`. If the weights never exceed the bucket, returns the first key.
 */
export function assignVariant(bucket: number, weights: Readonly<Record<string, number>>): string {
  throw new NotImplementedError(`assignVariant(${bucket}, ${Object.keys(weights).length})`);
}

export interface ResolvedFlags {
  /** experiment key -> variant name (logged as session_start.ab_flags). */
  assignments: Record<string, string>;
  /** Merged flag values of every assigned variant, experiments in key order (later wins). */
  flags: Record<string, FlagValue>;
}

export function resolveFlags(config: RemoteConfig, deviceId: string): ResolvedFlags {
  throw new NotImplementedError(`resolveFlags(${config.schemaVersion}, ${deviceId})`);
}
