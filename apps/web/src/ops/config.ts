import type { RemoteConfig } from '@clink/rules';
import type { Store } from '../lib/store';
import type { KvBackend } from '../save/store';
import { reportError } from './errors';

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const isFlagValue = (value: unknown): boolean =>
  typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean';

/** Returns the value typed as RemoteConfig when every field has the right shape, else null. */
export function validateConfig(value: unknown): RemoteConfig | null {
  if (!isObject(value) || value.schemaVersion !== 1) return null;
  if (!isStringArray(value.disabledLevels)) return null;
  if (typeof value.refreshMinutes !== 'number' || !(value.refreshMinutes > 0)) return null;
  const overrides = value.dailyOverrides;
  if (!isObject(overrides) || !Object.values(overrides).every((id) => typeof id === 'string')) return null;
  const experiments = value.experiments;
  if (!isObject(experiments)) return null;
  for (const experiment of Object.values(experiments)) {
    if (!isObject(experiment) || !isObject(experiment.variants) || !isObject(experiment.weights)) return null;
    if (!Object.values(experiment.weights).every((weight) => typeof weight === 'number')) return null;
    for (const flags of Object.values(experiment.variants)) {
      if (!isObject(flags) || !Object.values(flags).every(isFlagValue)) return null;
    }
  }
  return value as unknown as RemoteConfig;
}

export interface ConfigDeps {
  fetch?: typeof fetch;
  backend: KvBackend;
  /** The config built into the app, used when nothing else works. */
  fallback: RemoteConfig;
}

/**
 * Loads /config.json (network first). Falls back to the last good copy in storage, then to the built-in
 * default, so a kill switch works without a deploy and a broken file never breaks the game (FR-38).
 */
export async function loadRemoteConfig(deps: ConfigDeps): Promise<RemoteConfig> {
  const doFetch = deps.fetch ?? fetch.bind(globalThis);
  try {
    const response = await doFetch('/config.json', { cache: 'no-store' });
    if (response.ok) {
      const valid = validateConfig(await response.json());
      if (valid) {
        void deps.backend.set('config', valid).catch(() => {});
        return valid;
      }
      reportError(new Error('remote config is invalid'));
    }
  } catch {
    // offline: fall through to the stored copy
  }
  const stored = validateConfig(await deps.backend.get('config').catch(() => undefined));
  return stored ?? deps.fallback;
}

/**
 * Refreshes the config every `refreshMinutes` and whenever the app becomes visible, so a disabled level
 * disappears within an hour (FR-38). Only updates the store when something changed. Returns a stop function.
 */
export function startConfigRefresh(store: Store<RemoteConfig>, deps: ConfigDeps): () => void {
  const refresh = async (): Promise<void> => {
    const next = await loadRemoteConfig(deps);
    if (JSON.stringify(next) !== JSON.stringify(store.get())) store.set(next);
  };
  const timer = setInterval(() => void refresh(), store.get().refreshMinutes * 60_000);
  const onVisible = (): void => {
    if (document.visibilityState === 'visible') void refresh();
  };
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
