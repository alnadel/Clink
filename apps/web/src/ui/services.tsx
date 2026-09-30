import type { RemoteConfig } from '@clink/rules';
import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { AudioEngine } from '../audio/types';
import type { ContentStore } from '../content/store';
import type { I18n } from '../i18n/types';
import type { Store } from '../lib/store';
import type { Analytics } from '../ops/events';
import type { ResolvedFlags } from '../ops/flags';
import type { Haptics } from '../platform/haptics';
import type { Profile, Progress, SaveStore } from '../save/types';
import type { HintClient } from '../workers/hint-client';
import { useStore } from './hooks/useStore';

/** Everything the screens need, built once in main.tsx (docs/architecture/05 §2.2). */
export interface Services {
  save: SaveStore;
  audio: AudioEngine;
  analytics: Analytics;
  /** A store so changing the language re-renders without a reload. */
  i18n: Store<I18n>;
  content: ContentStore;
  hints: HintClient;
  config: Store<RemoteConfig>;
  flags: Store<ResolvedFlags>;
  profile: Store<Profile>;
  progress: Store<Progress>;
  haptics: Haptics;
}

export const ServicesContext = createContext<Services | null>(null);

export function useServices(): Services {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('useServices outside a ServicesContext');
  return services;
}

/** The current translator; re-renders when the language changes. */
export function useT(): I18n['t'] {
  return useStore(useServices().i18n).t;
}
