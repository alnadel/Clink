import { useEffect, useState } from 'preact/hooks';
import type { Store } from '../../lib/store';

/** Re-renders the component whenever the store changes. */
export function useStore<T>(store: Store<T>): T {
  const [value, setValue] = useState(store.get());
  useEffect(() => {
    setValue(store.get());
    return store.subscribe(setValue);
  }, [store]);
  return value;
}
