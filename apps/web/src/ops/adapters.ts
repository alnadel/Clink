import type { AnalyticsAdapter, EventEnvelope } from './events';

/** Logs every batch (development). */
export function createConsoleAdapter(): AnalyticsAdapter {
  return {
    name: 'console',
    async send(batch) {
      for (const event of batch) console.debug('[analytics]', event.seq, event.name, event.props);
    },
  };
}

/** Drops everything (testers in production, and production until a vendor adapter exists). */
export function createNullAdapter(): AnalyticsAdapter {
  return { name: 'null', async send() {} };
}

/** Records batches in memory, for tests. `failNext(n)` makes the next n sends fail. */
export interface MemoryAdapter extends AnalyticsAdapter {
  readonly batches: EventEnvelope[][];
  events(): EventEnvelope[];
  failNext(count: number): void;
}

export function createMemoryAdapter(): MemoryAdapter {
  const batches: EventEnvelope[][] = [];
  let failures = 0;
  return {
    name: 'memory',
    batches,
    events: () => batches.flat(),
    failNext(count) {
      failures = count;
    },
    async send(batch) {
      if (failures > 0) {
        failures--;
        throw new Error('network down');
      }
      batches.push([...batch]);
    },
  };
}
