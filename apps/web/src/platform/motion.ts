import type { ReducedMotionSetting } from '../save/types';

/** Whether to use fades instead of movement (FR-30): the setting, or the OS preference for `system`. */
export function resolveReducedMotion(setting: ReducedMotionSetting, systemPrefersReduced: boolean): boolean {
  if (setting === 'on') return true;
  if (setting === 'off') return false;
  return systemPrefersReduced;
}

const QUERY = '(prefers-reduced-motion: reduce)';

/** The current OS preference. */
export function systemPrefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia(QUERY).matches;
}

/** Calls `onChange` whenever the OS preference changes. Returns an unsubscribe function. */
export function watchReducedMotion(onChange: () => void): () => void {
  if (typeof matchMedia !== 'function') return () => {};
  const query = matchMedia(QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}
