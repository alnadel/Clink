import { createHintCore } from './hint-core';
import type { HintWorkerRequest, HintWorkerResponse } from './protocol';

// The web tsconfig uses DOM types, so type the worker scope by hand.
const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<HintWorkerRequest>) => void) | null;
  postMessage(message: HintWorkerResponse): void;
};

const core = createHintCore();
scope.onmessage = (event) => scope.postMessage(core.handle(event.data));
