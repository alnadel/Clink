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
