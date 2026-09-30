import { describe, expect, it, vi } from 'vitest';
import { createStore } from './store';

describe('createStore', () => {
  it('get, set and update', () => {
    const store = createStore(1);
    store.set(2);
    store.update((n) => n + 3);
    expect(store.get()).toBe(5);
  });

  it('notifies subscribers until they unsubscribe', () => {
    const store = createStore('a');
    const listener = vi.fn();
    const off = store.subscribe(listener);
    store.set('b');
    off();
    store.set('c');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('b');
  });

  it('calls onSet with every new value', () => {
    const onSet = vi.fn();
    const store = createStore<number>(0, onSet);
    store.set(1);
    store.update((n) => n + 1);
    expect(onSet.mock.calls).toEqual([[1], [2]]);
  });
});
