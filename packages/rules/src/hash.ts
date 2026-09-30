/**
 * FNV-1a 32-bit hash. Used for pack and level hashes, restore-code checksums and A/B bucketing.
 * Spec: docs/architecture/02-rules-engine.md §8. Returns an unsigned 32-bit integer.
 */
export function fnv1a32Bytes(bytes: Uint8Array): number {
  let hash = 0x811c9dc5;
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 0x01000193) >>> 0;
  return hash;
}

/** fnv1a32Bytes over the UTF-8 encoding of `text`. */
export function fnv1a32(text: string): number {
  return fnv1a32Bytes(new TextEncoder().encode(text));
}

/** 8 lowercase hex characters, zero-padded: hex8(255) === "000000ff". */
export function hex8(value: number): string {
  return (value >>> 0).toString(16).padStart(8, '0');
}
