import type { Store } from '../lib/store';
import type { KvBackend } from '../save/store';
import type { Profile } from '../save/types';
import type { Analytics, AnalyticsAdapter, AnalyticsEventMap, EventEnvelope, EventName } from './events';

const MAX_QUEUE = 500;
const BATCH_SIZE = 50;
const TOUCH_INTERVAL_MS = 60_000;

export type SessionStartProps = Omit<AnalyticsEventMap['session_start'], 'session_no' | 'first_session'>;

export interface AnalyticsService extends Analytics {
  /** Loads events queued by an earlier visit. */
  init(): Promise<void>;
  /** Starts a session: new id, session count, and the session_start event. */
  startSession(props: SessionStartProps): void;
  /** Records user activity (throttled to one write a minute) for the 30-minute session timeout. */
  touch(): void;
  /** Events waiting to be sent. */
  pending(): number;
}

export interface AnalyticsDeps {
  adapter: AnalyticsAdapter;
  profile: Store<Profile>;
  backend: KvBackend;
  appVersion: string;
  now?: () => number;
  newId?: () => string;
}

/**
 * Typed events, batched and sent in order with a random anonymous device id (FR-36). Events are
 * queued in IndexedDB so they survive offline use and closed tabs. Spec: docs/architecture/09 §1.
 */
export function createAnalytics(deps: AnalyticsDeps): AnalyticsService {
  const now = deps.now ?? Date.now;
  const newId = deps.newId ?? (() => crypto.randomUUID());
  let queue: EventEnvelope[] = [];
  let sessionId = '';
  let flushing: Promise<void> | null = null;
  let lastTouchWrite = 0;

  // Events tracked in the same turn share one write of the queue.
  let persistQueued = false;
  const persist = (): void => {
    if (persistQueued) return;
    persistQueued = true;
    queueMicrotask(() => {
      persistQueued = false;
      void deps.backend.set('events', queue).catch(() => {});
    });
  };

  const doFlush = async (): Promise<void> => {
    while (queue.length > 0) {
      const batch = queue.slice(0, BATCH_SIZE);
      try {
        await deps.adapter.send(batch);
      } catch {
        return; // keep the events and retry on the next flush
      }
      const sent = new Set(batch.map((event) => event.seq));
      queue = queue.filter((event) => !sent.has(event.seq));
      persist();
    }
  };

  const service: AnalyticsService = {
    async init() {
      const stored = (await deps.backend.get('events').catch(() => undefined)) as EventEnvelope[] | undefined;
      if (Array.isArray(stored)) queue = [...stored, ...queue].sort((a, b) => a.seq - b.seq);
    },

    track<N extends EventName>(name: N, props: AnalyticsEventMap[N]): void {
      const profile = deps.profile.get();
      const seq = profile.eventSeq + 1;
      deps.profile.set({ ...profile, eventSeq: seq });
      const envelope: EventEnvelope<N> = {
        name,
        props,
        ts: now(),
        seq,
        sessionId,
        deviceId: profile.deviceId,
        appVersion: deps.appVersion,
      };
      queue.push(envelope as EventEnvelope);
      if (queue.length > MAX_QUEUE) queue = queue.slice(queue.length - MAX_QUEUE);
      persist();
    },

    flush() {
      flushing ??= doFlush().finally(() => {
        flushing = null;
      });
      return flushing;
    },

    startSession(props) {
      sessionId = newId();
      const sessionNo = deps.profile.get().sessionCount + 1;
      deps.profile.update((p) => ({ ...p, sessionCount: sessionNo, lastActiveAt: now() }));
      service.track('session_start', { ...props, session_no: sessionNo, first_session: sessionNo === 1 });
    },

    touch() {
      const current = now();
      if (current - lastTouchWrite < TOUCH_INTERVAL_MS) return;
      lastTouchWrite = current;
      deps.profile.update((p) => ({ ...p, lastActiveAt: current }));
    },

    pending: () => queue.length,
  };
  return service;
}
