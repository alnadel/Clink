import type { Platform } from './events';

/** A session starts on launch, or when the app returns after 30 minutes of inactivity (D27). */
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

export function shouldStartSession(lastActiveAt: number, now: number): boolean {
  return now - lastActiveAt >= SESSION_TIMEOUT_MS;
}

export function platformOf(userAgent: string, maxTouchPoints = 0): Platform {
  if (/iPhone|iPad|iPod/.test(userAgent)) return 'ios';
  if (/Macintosh/.test(userAgent) && maxTouchPoints > 1) return 'ios'; // iPadOS reports as a Mac
  if (/Android/.test(userAgent)) return 'android';
  if (/Windows|Macintosh|X11|CrOS|Linux/.test(userAgent)) return 'desktop';
  return 'other';
}

/** A short browser name for analytics. Order matters: many browsers include "Chrome" or "Safari". */
export function browserOf(userAgent: string): string {
  if (/Edg\//.test(userAgent)) return 'edge';
  if (/SamsungBrowser/.test(userAgent)) return 'samsung';
  if (/Firefox|FxiOS/.test(userAgent)) return 'firefox';
  if (/CriOS|Chrome/.test(userAgent)) return 'chrome';
  if (/Safari/.test(userAgent)) return 'safari';
  return 'other';
}
