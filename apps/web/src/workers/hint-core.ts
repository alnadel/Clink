import { compileLevel, explore, hint, type Level, type SolverGraph } from '@clink/rules';
import type { HintWorkerRequest, HintWorkerResponse } from './protocol';

/** The worker's logic, free of any worker API so it can be tested in Node. */
export function createHintCore(): { handle(request: HintWorkerRequest): HintWorkerResponse } {
  let loaded: { levelId: string; level: Level; graph: SolverGraph } | null = null;
  return {
    handle(request) {
      try {
        if (request.type === 'load') {
          const started = performance.now();
          const level = compileLevel(request.level);
          const graph = explore(level);
          loaded = { levelId: level.id, level, graph };
          return {
            type: 'loaded',
            requestId: request.requestId,
            levelId: level.id,
            reachable: graph.reachable,
            ms: performance.now() - started,
          };
        }
        if (!loaded || loaded.levelId !== request.levelId)
          throw new Error(`level ${request.levelId} is not loaded`);
        return {
          type: 'hint',
          requestId: request.requestId,
          levelId: request.levelId,
          hint: hint(loaded.level, loaded.graph, request.state),
        };
      } catch (error) {
        return {
          type: 'error',
          requestId: request.requestId,
          message: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}
