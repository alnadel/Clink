import type { JSX } from 'preact';
import { createStore } from '../../lib/store';
import { useStore } from '../hooks/useStore';

const toast = createStore<string | null>(null);
let timer: ReturnType<typeof setTimeout> | undefined;

/** Shows a short message for 3 seconds. */
export function showToast(text: string): void {
  clearTimeout(timer);
  toast.set(text);
  timer = setTimeout(() => toast.set(null), 3000);
}

/** Renders the current toast. Mounted once in the app. */
export function ToastHost(): JSX.Element {
  const text = useStore(toast);
  return (
    <div class="toast-host" role="status" aria-live="polite">
      {text ? <div class="toast">{text}</div> : null}
    </div>
  );
}
