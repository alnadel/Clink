/** A minimal observable value. Components read it with useStore(); do not add another state library. */
export interface Store<T> {
  get(): T;
  set(next: T): void;
  update(fn: (current: T) => T): void;
  subscribe(listener: (value: T) => void): () => void;
}

/** `onSet` runs after every set, so profile and progress stores can write through to IndexedDB. */
export function createStore<T>(initial: T, onSet?: (value: T) => void): Store<T> {
  let value = initial;
  const listeners = new Set<(value: T) => void>();
  const store: Store<T> = {
    get: () => value,
    set(next) {
      value = next;
      onSet?.(next);
      for (const listener of [...listeners]) listener(next);
    },
    update(fn) {
      store.set(fn(value));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return store;
}
