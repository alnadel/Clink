import { Workbox } from 'workbox-window';

/**
 * Registers the service worker in production builds. A new version installs silently and is announced with
 * a toast; it never reloads the page in the middle of a level (docs/architecture/07 §1).
 */
export function registerServiceWorker(onUpdated: () => void): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const wb = new Workbox('/sw.js');
  wb.addEventListener('controlling', (event) => {
    if (event.isUpdate) onUpdated();
  });
  void wb.register().catch(() => {});
}

/**
 * Resolves once a service worker controls the page: at once when it already does or cannot (development,
 * unsupported browsers), otherwise on `controllerchange`, and in any case after `timeoutMs`. Downloads made
 * before that point are not in the worker's cache.
 */
export function whenControlled(timeoutMs = 30_000): Promise<void> {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator) || navigator.serviceWorker.controller)
    return Promise.resolve();
  return new Promise((resolve) => {
    const done = (): void => {
      clearTimeout(timer);
      navigator.serviceWorker.removeEventListener('controllerchange', done);
      resolve();
    };
    const timer = setTimeout(done, timeoutMs);
    navigator.serviceWorker.addEventListener('controllerchange', done);
  });
}
