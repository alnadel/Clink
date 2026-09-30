import { describe, expect, it } from 'vitest';
import { createStore } from '../lib/store';
import { newProfile } from '../save/store';
import { createMemoryAdapter } from './adapters';
import { createAnalytics } from './analytics';
import {
  createAnalyticsErrorReporter,
  createErrorFilter,
  reportError,
  setCurrentLevelId,
  setErrorReporter,
} from './errors';

describe('createErrorFilter', () => {
  it('drops a repeat within 60 s and accepts it again after', () => {
    let clock = 0;
    const filter = createErrorFilter(() => clock);
    expect(filter.accept('boom', 'Error: boom\n at a')).toBe(true);
    clock = 59_000;
    expect(filter.accept('boom', 'Error: boom\n at a')).toBe(false);
    clock = 60_000;
    expect(filter.accept('boom', 'Error: boom\n at a')).toBe(true);
  });

  it('treats different messages as different errors', () => {
    const filter = createErrorFilter(() => 0);
    expect(filter.accept('a', 'x\n at 1')).toBe(true);
    expect(filter.accept('b', 'x\n at 1')).toBe(true);
  });

  it('accepts at most 20 errors per session', () => {
    const filter = createErrorFilter(() => 0);
    const results = Array.from({ length: 25 }, (_, i) => filter.accept(`e${i}`, `s\n at ${i}`));
    expect(results.filter(Boolean)).toHaveLength(20);
  });
});

describe('analytics error reporter', () => {
  function setup() {
    const adapter = createMemoryAdapter();
    const analytics = createAnalytics({
      adapter,
      profile: createStore(newProfile(new Date(0))),
      backend: { get: async () => undefined, set: async () => {}, del: async () => {} },
      appVersion: '1',
    });
    return { adapter, analytics };
  }

  it('sends an error event with truncated message and stack and the level id', async () => {
    const { adapter, analytics } = setup();
    const error = new Error('m'.repeat(600));
    error.stack = `Error\n${'s'.repeat(5000)}`;
    createAnalyticsErrorReporter(analytics).report(error, { levelId: 'w1-08' });
    await analytics.flush();
    const props = adapter.events()[0]?.props as { message: string; stack: string; level_id: string };
    expect(props.message).toHaveLength(500);
    expect(props.stack).toHaveLength(4000);
    expect(props.level_id).toBe('w1-08');
  });

  it('holds errors until a reporter exists, then delivers them with the current level id', async () => {
    const { adapter, analytics } = setup();
    setCurrentLevelId('w1-03');
    reportError(new Error('early failure'));
    setErrorReporter(createAnalyticsErrorReporter(analytics));
    await analytics.flush();
    expect(adapter.events()).toHaveLength(1);
    expect(adapter.events()[0]?.props).toMatchObject({ message: 'early failure', level_id: 'w1-03' });
    setCurrentLevelId(null);
  });
});
