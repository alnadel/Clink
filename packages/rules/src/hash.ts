import { NotImplementedError } from './errors';

/**
 * FNV-1a 32-bit hash. Used for pack and level hashes (content pipeline), restore-code
 * checksums and A/B bucketing. Spec: docs/architecture/02-rules-engine.md §8.
 *
 *   hash = 0x811c9dc5
 *   for each byte b: hash = Math.imul(hash ^ b, 0x01000193) >>> 0
 *
 * Returns an unsigned 32-bit integer.
 */
export function fnv1a32Bytes(bytes: Uint8Array): number {
  throw new NotImplementedError(`fnv1a32Bytes(${bytes.length})`);
}

/** fnv1a32Bytes over the UTF-8 encoding of `text` (use `new TextEncoder().encode(text)`). */
export function fnv1a32(text: string): number {
  throw new NotImplementedError(`fnv1a32(${text})`);
}

/** 8 lowercase hex characters, zero-padded: hex8(255) === "000000ff". */
export function hex8(value: number): string {
  throw new NotImplementedError(`hex8(${value})`);
}
