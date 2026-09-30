import { describe, expect, it } from 'vitest';
import { createStore } from '../lib/store';
import { type KvBackend, newProfile } from '../save/store';
import { createMemoryAdapter } from './adapters';
import { createAnalytics, type SessionStartProps } from './analytics';
import { browserOf, platformOf, shouldStartSession } from './session';

function backend(): KvBackend & { map: Map<string, unknown> } {
  const map = new Map<string, unknown>();
  return {
    map,
    get: async (key) => map.get(key),
    set: async (key, value) => {
      map.set(key, structuredClone(value));
    },
    del: async (key) => {
      map.delete(key);
    },
  };
}

function setup(now = () => 1_000) {
  const adapter = createMemoryAdapter();
  const kv = backend();
  const profile = createStore(newProfile(new Date(0)));
  let id = 0;
  const analytics = createAnalytics({
    adapter,
    profile,
    backend: kv,
    appVersion: '1.2.3',
    now,
    newId: () => `session-${++id}`,
  });
  return { adapter, kv, profile, analytics };
}

const SESSION: SessionStartProps = {
  platform: 'android',
  browser: 'chrome',
  installed: false,
  locale: 'en',
  sound_on: true,
  app_version: '1.2.3',
  ab_flags: {},
  source: null,
  tester: false,
};

describe('analytics queue', () => {
  it('sends tracked events in order in one batch with full envelopes', async () => {
    const { adapter, analytics, profile } = setup();
    analytics.startSession(SESSION);
    analytics.track('level_start', { level_id: 'w1-08', world: 1, attempt: 1 });
    analytics.track('hint_used', { level_id: 'w1-08', move_no: 0 });
    await analytics.flush();
    expect(adapter.batches).toHaveLength(1);
    const events = adapter.events();
    expect(events.map((e) => e.name)).toEqual(['session_start', 'level_start', 'hint_used']);
    expect(events.map((e) => e.seq)).toEqual([1, 2, 3]);
    expect(events[1]).toMatchObject({
      sessionId: 'session-1',
      deviceId: profile.get().deviceId,
      appVersion: '1.2.3',
      ts: 1_000,
    });
    expect(analytics.pending()).toBe(0);
  });

  it('keeps events when the adapter fails, and sends them on the next flush', async () => {
    const { adapter, analytics } = setup();
    analytics.track('ftue_step', { step: 'a' });
    adapter.failNext(1);
    await analytics.flush();
    expect(analytics.pending()).toBe(1);
    await analytics.flush();
    expect(analytics.pending()).toBe(0);
    expect(adapter.events().map((e) => e.name)).toEqual(['ftue_step']);
  });

  it('sends large queues in batches of at most 50', async () => {
    const { adapter, analytics } = setup();
    for (let i = 0; i < 120; i++) analytics.track('ftue_step', { step: String(i) });
    await analytics.flush();
    expect(adapter.batches.map((b) => b.length)).toEqual([50, 50, 20]);
  });

  it('keeps at most 500 events, dropping the oldest', () => {
    const { analytics } = setup();
    for (let i = 0; i < 600; i++) analytics.track('ftue_step', { step: String(i) });
    expect(analytics.pending()).toBe(500);
  });

  it('persists the queue and a later visit sends it', async () => {
    const first = setup();
    first.analytics.track('ftue_step', { step: 'left-behind' });
    await Promise.resolve();
    const adapter = createMemoryAdapter();
    const second = createAnalytics({
      adapter,
      profile: first.profile,
      backend: first.kv,
      appVersion: '1.2.3',
    });
    await second.init();
    await second.flush();
    expect(adapter.events().map((e) => (e.props as { step: string }).step)).toEqual(['left-behind']);
  });
});

describe('sessions', () => {
  it('startSession counts sessions and marks only the first as first_session', () => {
    const { analytics, profile, adapter } = setup();
    analytics.startSession(SESSION);
    analytics.startSession(SESSION);
    expect(profile.get().sessionCount).toBe(2);
    void analytics.flush();
    return analytics.flush().then(() => {
      const starts = adapter.events().filter((e) => e.name === 'session_start');
      expect(starts.map((e) => (e.props as { first_session: boolean }).first_session)).toEqual([true, false]);
      expect(starts.map((e) => e.sessionId)).toEqual(['session-1', 'session-2']);
    });
  });

  it('touch is throttled to one write a minute', () => {
    let clock = 100_000;
    const { analytics, profile } = setup(() => clock);
    analytics.touch();
    expect(profile.get().lastActiveAt).toBe(100_000);
    clock = 130_000;
    analytics.touch();
    expect(profile.get().lastActiveAt).toBe(100_000);
    clock = 161_000;
    analytics.touch();
    expect(profile.get().lastActiveAt).toBe(161_000);
  });

  it('a session times out at exactly 30 minutes', () => {
    expect(shouldStartSession(0, 29 * 60_000)).toBe(false);
    expect(shouldStartSession(0, 30 * 60_000)).toBe(true);
  });
});

describe('platform and browser detection', () => {
  const IPHONE =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) AppleWebKit/605.1.15 Version/16.4 Mobile/15E148 Safari/604.1';
  const ANDROID =
    'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36';
  const SAMSUNG =
    'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 SamsungBrowser/23.0 Chrome/115.0 Mobile Safari/537.36';
  const EDGE =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36 Edg/120.0';
  const FIREFOX = 'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0';

  it('detects platforms', () => {
    expect(platformOf(IPHONE)).toBe('ios');
    expect(platformOf(ANDROID)).toBe('android');
    expect(platformOf(EDGE)).toBe('desktop');
    expect(platformOf('Mozilla/5.0 (Macintosh; Intel Mac OS X)', 5)).toBe('ios');
    expect(platformOf('Mozilla/5.0 (Macintosh; Intel Mac OS X)', 0)).toBe('desktop');
    expect(platformOf('curl/8')).toBe('other');
  });

  it('detects browsers, checking the specific ones first', () => {
    expect(browserOf(IPHONE)).toBe('safari');
    expect(browserOf(ANDROID)).toBe('chrome');
    expect(browserOf(SAMSUNG)).toBe('samsung');
    expect(browserOf(EDGE)).toBe('edge');
    expect(browserOf(FIREFOX)).toBe('firefox');
  });
});
