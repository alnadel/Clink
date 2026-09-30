import type { Hint, LevelJson, State } from '@clink/rules';
import type { HintWorkerRequest, HintWorkerResponse } from './protocol';

export interface HintClient {
  load(level: LevelJson): Promise<void>;
  hint(levelId: string, state: State): Promise<Hint>;
  dispose(): void;
}

type Pending = { resolve: (response: HintWorkerResponse) => void; reject: (error: Error) => void };

/** Talks to the hint worker. A hint requested while a load is pending waits for the load. */
export function createHintClient(): HintClient {
  const worker = new Worker(new URL('./hint.worker.ts', import.meta.url), { type: 'module' });
  const pending = new Map<number, Pending>();
  let nextId = 1;
  let loading: Promise<void> = Promise.resolve();

  worker.onmessage = (event: MessageEvent<HintWorkerResponse>) => {
    const response = event.data;
    const entry = pending.get(response.requestId);
    if (!entry) return;
    pending.delete(response.requestId);
    if (response.type === 'error') entry.reject(new Error(response.message));
    else entry.resolve(response);
  };

  const request = (message: DistributiveOmit<HintWorkerRequest, 'requestId'>): Promise<HintWorkerResponse> =>
    new Promise((resolve, reject) => {
      const requestId = nextId++;
      pending.set(requestId, { resolve, reject });
      worker.postMessage({ ...message, requestId } as HintWorkerRequest);
    });

  return {
    load(level) {
      loading = request({ type: 'load', level }).then(() => undefined);
      return loading;
    },
    async hint(levelId, state) {
      await loading.catch(() => undefined);
      const response = await request({ type: 'hint', levelId, state });
      if (response.type !== 'hint') throw new Error('unexpected worker response');
      return response.hint;
    },
    dispose() {
      worker.terminate();
      for (const entry of pending.values()) entry.reject(new Error('hint client disposed'));
      pending.clear();
    },
  };
}

type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
