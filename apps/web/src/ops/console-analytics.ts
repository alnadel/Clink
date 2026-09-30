import type { Analytics } from './events';

/** A temporary Analytics that logs in development and does nothing in production. */
export function createConsoleAnalytics(): Analytics {
  return {
    track(name, props) {
      if (import.meta.env.DEV) console.debug('[analytics]', name, props);
    },
    async flush() {},
  };
}
