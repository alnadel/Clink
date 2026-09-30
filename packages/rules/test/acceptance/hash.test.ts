// ACCEPTANCE TEST — owned by the architecture. Only remove `.skip`; never change expectations.
import { describe, expect, it } from 'vitest';
import { fnv1a32, fnv1a32Bytes, hex8 } from '../../src';

describe('fnv1a32', () => {
  it.each([
    ['', 2166136261],
    ['a', 3826002220],
    ['clink', 1014479434],
    ['Clink #42', 569760641],
    ['00000000-0000-4000-8000-000000000000:stars', 1751711374],
    ['💧', 714205779], // UTF-8, not UTF-16
  ])('%j -> %i', (text, expected) => {
    expect(fnv1a32(text)).toBe(expected);
  });

  it('hashes raw bytes the same way', () => {
    expect(fnv1a32Bytes(new Uint8Array([0x61]))).toBe(3826002220);
    expect(fnv1a32Bytes(new Uint8Array([]))).toBe(2166136261);
  });

  it('hex8 pads to 8 lowercase hex characters', () => {
    expect(hex8(255)).toBe('000000ff');
    expect(hex8(3826002220)).toBe('e40c292c');
    expect(hex8(0)).toBe('00000000');
  });
});
