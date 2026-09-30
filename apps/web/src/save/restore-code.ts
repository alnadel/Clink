import { fnv1a32Bytes } from '@clink/rules';
import type { Progress, Settings } from './types';
export type StarSlot = 0 | 1 | 2 | 3;
export const RESTORE_LEVEL_SLOTS = 60;
export const RESTORE_MAX_DAILIES = 1023;
export interface RestoreData {
  levelStars: StarSlot[];
  dailyStars: StarSlot[];
  settings: Settings;
}
export type DecodeResult =
  | { ok: true; data: RestoreData }
  | { ok: false; error: 'format' | 'version' | 'checksum' };
const A = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const LAB = ['none', 'letters', 'solfege'] as const;
const LANG = ['system', 'en', 'ar'] as const;
const RM = ['system', 'on', 'off'] as const;
function bytesOf(bits: number[]): Uint8Array {
  const out = new Uint8Array(Math.ceil(bits.length / 8));
  bits.forEach((b, i) => {
    if (b) out[i >> 3] = (out[i >> 3] as number) | (0x80 >> (i & 7));
  });
  return out;
}
export function encodeRestoreCode(data: RestoreData): string {
  const bits: number[] = [];
  const put = (v: number, n: number) => {
    for (let i = n - 1; i >= 0; i--) bits.push((v >> i) & 1);
  };
  put(1, 4);
  for (const s of data.levelStars) put(s, 2);
  put(data.dailyStars.length, 10);
  for (const s of data.dailyStars) put(s, 2);
  const st = data.settings;
  put(st.sound ? 1 : 0, 1);
  put(st.autoPlaySong ? 1 : 0, 1);
  put(LAB.indexOf(st.labels), 2);
  put(LANG.indexOf(st.language), 2);
  put(RM.indexOf(st.reducedMotion), 2);
  put(st.vibration ? 1 : 0, 1);
  put(fnv1a32Bytes(bytesOf(bits)) & 0xffff, 16);
  while (bits.length % 5) bits.push(0);
  let s = '';
  for (let i = 0; i < bits.length; i += 5) {
    let v = 0;
    for (let j = 0; j < 5; j++) v = v * 2 + (bits[i + j] as number);
    s += A[v];
  }
  return (s.match(/.{1,4}/g) ?? []).join('-');
}
export function decodeRestoreCode(code: string): DecodeResult {
  const clean = code.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  if (!clean) return { ok: false, error: 'format' };
  const bits: number[] = [];
  for (const ch of clean) {
    const v = A.indexOf(ch);
    if (v < 0) return { ok: false, error: 'format' };
    for (let j = 4; j >= 0; j--) bits.push((v >> j) & 1);
  }
  let p = 0;
  const take = (n: number) => {
    if (p + n > bits.length) throw new Error('short');
    let v = 0;
    for (let i = 0; i < n; i++) v = v * 2 + (bits[p++] as number);
    return v;
  };
  try {
    if (take(4) !== 1) return { ok: false, error: 'version' };
    const levelStars: StarSlot[] = [];
    for (let i = 0; i < 60; i++) levelStars.push(take(2) as StarSlot);
    const n = take(10);
    const dailyStars: StarSlot[] = [];
    for (let i = 0; i < n; i++) dailyStars.push(take(2) as StarSlot);
    const sound = take(1) === 1;
    const autoPlaySong = take(1) === 1;
    const labels = LAB[take(2)];
    const language = LANG[take(2)];
    const reducedMotion = RM[take(2)];
    const vibration = take(1) === 1;
    const payloadLen = p;
    const sum = take(16);
    const rest = bits.slice(p);
    if (rest.length >= 5 || rest.some((b) => b)) return { ok: false, error: 'format' };
    if (!labels || !language || !reducedMotion) return { ok: false, error: 'format' };
    if ((fnv1a32Bytes(bytesOf(bits.slice(0, payloadLen))) & 0xffff) !== sum)
      return { ok: false, error: 'checksum' };
    return {
      ok: true,
      data: {
        levelStars,
        dailyStars,
        settings: { sound, autoPlaySong, labels, reducedMotion, language, vibration },
      },
    };
  } catch {
    return { ok: false, error: 'format' };
  }
}

/** Builds the data a restore code carries: stars per campaign level slot and per daily puzzle. */
export function progressToRestoreData(
  progress: Progress,
  levelOrder: readonly string[],
  settings: Settings,
): RestoreData {
  const levelStars: StarSlot[] = Array.from({ length: RESTORE_LEVEL_SLOTS }, (_, slot) => {
    const id = levelOrder[slot];
    return (id !== undefined ? (progress.levels[id]?.stars ?? 0) : 0) as StarSlot;
  });
  const highest = Math.min(
    RESTORE_MAX_DAILIES,
    Math.max(0, ...Object.keys(progress.dailies).map((key) => Number(key))),
  );
  const dailyStars: StarSlot[] = Array.from(
    { length: highest },
    (_, i) => (progress.dailies[String(i + 1)]?.stars ?? 0) as StarSlot,
  );
  return { levelStars, dailyStars, settings };
}

/**
 * Merges restored data into existing progress (D22): the best stars win per level and daily.
 * Restored dailies have no move counts (moves 0, par 0); existing dailies keep theirs.
 */
export function mergeRestoreData(
  progress: Progress,
  data: RestoreData,
  levelOrder: readonly string[],
  now: string = new Date().toISOString(),
): Progress {
  const levels = { ...progress.levels };
  data.levelStars.forEach((stars, slot) => {
    const id = levelOrder[slot];
    if (id === undefined || stars === 0) return;
    const existing = levels[id];
    if (!existing || existing.stars < stars) {
      levels[id] = { stars, bestMoves: existing?.bestMoves ?? 0, solvedAt: existing?.solvedAt ?? now };
    }
  });
  const dailies = { ...progress.dailies };
  data.dailyStars.forEach((stars, i) => {
    if (stars === 0) return;
    const key = String(i + 1);
    const existing = dailies[key];
    if (!existing) dailies[key] = { moves: 0, par: 0, stars };
    else if (existing.stars < stars) dailies[key] = { ...existing, stars };
  });
  return { ...progress, levels, dailies };
}
