import { describe, expect, it, vi } from 'vitest';
import { createHttpAdapter } from './adapters';
import type { EventEnvelope } from './events';

const event = { seq: 1, name: 'session_start', props: {} } as unknown as EventEnvelope;

describe('createHttpAdapter', () => {
  it('posts the batch as JSON', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    await createHttpAdapter('https://collect.example/e', fetchImpl).send([event]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://collect.example/e');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ events: [event] });
  });

  it('rejects on a server error so the batch is retried', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 503 }));
    await expect(createHttpAdapter('https://collect.example/e', fetchImpl).send([event])).rejects.toThrow(
      '503',
    );
  });

  it('rejects when the network is down', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('offline');
    });
    await expect(createHttpAdapter('https://collect.example/e', fetchImpl).send([event])).rejects.toThrow(
      'offline',
    );
  });
});
