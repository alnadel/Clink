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

/**
 * Posts each batch as JSON to a collector the team runs (`{ "events": [...] }`), so analytics work without
 * choosing a vendor SDK (DEC-7). A non-2xx answer rejects, so the batch stays queued and is retried.
 */
export function createHttpAdapter(url: string, fetchImpl: typeof fetch = fetch): AnalyticsAdapter {
  return {
    name: 'http',
    async send(batch) {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ events: batch }),
        keepalive: true,
      });
      if (!response.ok) throw new Error(`analytics collector answered ${response.status}`);
    },
  };
}
