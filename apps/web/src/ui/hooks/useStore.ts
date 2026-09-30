import { useEffect, useState } from 'preact/hooks';
import type { Store } from '../../lib/store';

/** Re-renders the component whenever the store changes. Accepts null (e.g. before a controller exists). */
export function useStore<T>(store: Store<T>): T;
export function useStore<T>(store: Store<T> | null): T | null;
export function useStore<T>(store: Store<T> | null): T | null {
  const [value, setValue] = useState<T | null>(store ? store.get() : null);
  useEffect(() => {
    if (!store) {
      setValue(null);
      return;
    }
    setValue(store.get());
    return store.subscribe(setValue);
  }, [store]);
  return value;
}
