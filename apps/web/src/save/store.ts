import { createStore, del, get, set } from 'idb-keyval';
import { formatLocalDate, localDateOf } from '../daily/dates';
import { type CurrentLevel, DEFAULT_SETTINGS, type Profile, type Progress, type SaveStore } from './types';

/** The few storage operations the game needs; tests use an in-memory Map instead of IndexedDB. */
export interface KvBackend {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
}

/** IndexedDB through idb-keyval. This is the only file that imports it. */
export function idbBackend(): KvBackend {
  const store = createStore('clink', 'kv');
  return {
    get: (key) => get(key, store),
    set: (key, value) => set(key, value, store),
    del: (key) => del(key, store),
  };
}

export function newProfile(now: Date = new Date()): Profile {
  return {
    schema: 1,
    deviceId: crypto.randomUUID(),
    createdAt: now.toISOString(),
    firstSessionDate: formatLocalDate(localDateOf(now)),
    source: null,
    tester: false,
    soundChoiceMade: false,
    settings: { ...DEFAULT_SETTINGS },
    seenGuides: [],
    levelAttempts: {},
    installPromptCount: 0,
    surveyAnswered: false,
    sessionCount: 0,
    lastActiveAt: now.getTime(),
    eventSeq: 0,
  };
}

/** Save store over a key-value backend (docs/architecture/08 §1). */
export function createSaveStore(backend: KvBackend = idbBackend()): SaveStore {
  let created = false;
  return {
    async loadProfile() {
      const stored = (await backend.get('profile')) as Profile | undefined;
      if (stored?.schema === 1) {
        created = false;
        return stored;
      }
      const profile = newProfile();
      await backend.set('profile', profile);
      created = true;
      return profile;
    },
    wasProfileCreated: () => created,
    saveProfile: (profile) => backend.set('profile', profile),
    async loadProgress() {
      const stored = (await backend.get('progress')) as Progress | undefined;
      return stored?.schema === 1 ? stored : { schema: 1, levels: {}, dailies: {} };
    },
    saveProgress: (progress) => backend.set('progress', progress),
    async loadCurrent() {
      const stored = (await backend.get('current')) as CurrentLevel | undefined;
      return stored?.schema === 1 ? stored : null;
    },
    async saveCurrent(current) {
      if (current === null) await backend.del('current');
      else await backend.set('current', current);
    },
    async requestPersistence() {
      try {
        return (await navigator.storage?.persist?.()) ?? false;
      } catch {
        return false;
      }
    },
  };
}
