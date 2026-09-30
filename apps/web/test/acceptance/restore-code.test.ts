// ACCEPTANCE TEST — owned by the architecture. Only remove `.skip`; never change expectations.
// Spec: docs/architecture/08-save-daily-share.md §2 (FR-33).
import { describe, expect, it } from 'vitest';
import {
  decodeRestoreCode,
  encodeRestoreCode,
  type RestoreData,
  type StarSlot,
} from '../../src/save/restore-code';
import { settings } from '../fixtures';

const empty: RestoreData = { levelStars: Array<StarSlot>(60).fill(0), dailyStars: [], settings: settings() };
const some: RestoreData = {
  levelStars: [3, 3, 2, 3, 1, 3, 3, 2, ...Array<StarSlot>(52).fill(0)],
  dailyStars: [0, 3, 2, 0, 1],
  settings: settings({
    sound: false,
    autoPlaySong: true,
    labels: 'solfege',
    reducedMotion: 'on',
    language: 'ar',
    vibration: false,
  }),
};
const full: RestoreData = {
  levelStars: Array<StarSlot>(60).fill(3),
  dailyStars: Array<StarSlot>(60).fill(3),
  settings: settings(),
};

const V_EMPTY = '2000-0000-0000-0000-0000-0000-0010-43SA';
const V_SOME = '3YVY-0000-0000-0000-0000-0000-00AE-2TBK-1T';
const V_FULL = '3ZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-Y3SZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZ0-48FY';

describe('restore code', () => {
  it('encodes to the exact golden strings', () => {
    expect(encodeRestoreCode(empty)).toBe(V_EMPTY);
    expect(encodeRestoreCode(some)).toBe(V_SOME);
    expect(encodeRestoreCode(full)).toBe(V_FULL);
  });

  it('decodes the golden strings back to the same data', () => {
    expect(decodeRestoreCode(V_EMPTY)).toEqual({ ok: true, data: empty });
    expect(decodeRestoreCode(V_SOME)).toEqual({ ok: true, data: some });
    expect(decodeRestoreCode(V_FULL)).toEqual({ ok: true, data: full });
  });

  it('is forgiving about how people type it', () => {
    const sloppy = ` ${V_SOME.toLowerCase().replaceAll('-', ' ')} `;
    expect(decodeRestoreCode(sloppy)).toEqual({ ok: true, data: some });
    // O is read as 0; I and L as 1.
    expect(decodeRestoreCode(V_EMPTY.replaceAll('0', 'O').replace('1', 'I'))).toEqual({
      ok: true,
      data: empty,
    });
  });

  it('rejects a changed character with a checksum error', () => {
    // Last char T (11010) -> R (11000): changes a checksum bit, keeps the zero padding bit.
    const tampered = '3YVY-0000-0000-0000-0000-0000-00AE-2TBK-1R';
    expect(decodeRestoreCode(tampered)).toEqual({ ok: false, error: 'checksum' });
    const tampered2 = V_SOME.replace('3YVY', '3YVZ');
    expect(decodeRestoreCode(tampered2)).toEqual({ ok: false, error: 'checksum' });
  });

  it('rejects an unknown version before checking the checksum', () => {
    expect(decodeRestoreCode(`4${V_EMPTY.slice(1)}`)).toEqual({ ok: false, error: 'version' });
  });

  it('rejects malformed input', () => {
    expect(decodeRestoreCode('')).toEqual({ ok: false, error: 'format' });
    expect(decodeRestoreCode('2000-0000')).toEqual({ ok: false, error: 'format' });
    expect(decodeRestoreCode(V_EMPTY.replace('43SA', '43SU'))).toEqual({ ok: false, error: 'format' }); // U is not Crockford
    expect(decodeRestoreCode(`${V_EMPTY}00`)).toEqual({ ok: false, error: 'format' }); // extra characters
    // Last char T (11010) -> V (11011): the padding bit must be 0.
    expect(decodeRestoreCode('3YVY-0000-0000-0000-0000-0000-00AE-2TBK-1V')).toEqual({
      ok: false,
      error: 'format',
    });
  });
});
