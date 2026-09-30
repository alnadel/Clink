import type { RemoteConfig } from '@clink/rules';
import { describe, expect, it } from 'vitest';
import defaultConfig from '../../../../content/config.json';
import type { KvBackend } from '../save/store';
import { loadRemoteConfig, validateConfig } from './config';

const fallback = defaultConfig as unknown as RemoteConfig;

function memory(): KvBackend {
  const map = new Map<string, unknown>();
  return {
    get: async (key) => map.get(key),
    set: async (key, value) => {
      map.set(key, structuredClone(value));
    },
    del: async (key) => {
      map.delete(key);
    },
  };
}

const respond = (body: unknown, status = 200) =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
const offline = (async () => {
  throw new TypeError('network');
}) as unknown as typeof fetch;

describe('validateConfig', () => {
  it('accepts the shipped config', () => {
    expect(validateConfig(defaultConfig)).not.toBeNull();
  });

  it.each([
    ['a wrong schemaVersion', { ...fallback, schemaVersion: 2 }],
    ['a non-array disabledLevels', { ...fallback, disabledLevels: 'w1-01' }],
    ['a zero refresh interval', { ...fallback, refreshMinutes: 0 }],
    ['non-string overrides', { ...fallback, dailyOverrides: { '1': 5 } }],
    ['non-numeric weights', { ...fallback, experiments: { x: { variants: {}, weights: { a: 'no' } } } }],
    [
      'a nested flag object',
      { ...fallback, experiments: { x: { variants: { a: { f: {} } }, weights: { a: 100 } } } },
    ],
    ['null', null],
  ])('rejects %s', (_name, value) => {
    expect(validateConfig(value)).toBeNull();
  });
});

describe('loadRemoteConfig', () => {
  it('uses the network copy and stores it', async () => {
    const backend = memory();
    const remote = { ...fallback, disabledLevels: ['w1-08'] };
    const config = await loadRemoteConfig({ fetch: respond(remote), backend, fallback });
    expect(config.disabledLevels).toEqual(['w1-08']);
    await Promise.resolve();
    expect(await backend.get('config')).toEqual(remote);
  });

  it('falls back to the stored copy when offline, then to the built-in default', async () => {
    const backend = memory();
    await backend.set('config', { ...fallback, disabledLevels: ['stored'] });
    expect((await loadRemoteConfig({ fetch: offline, backend, fallback })).disabledLevels).toEqual([
      'stored',
    ]);
    expect(await loadRemoteConfig({ fetch: offline, backend: memory(), fallback })).toEqual(fallback);
  });

  it('ignores an invalid network config', async () => {
    const config = await loadRemoteConfig({
      fetch: respond({ nonsense: true }),
      backend: memory(),
      fallback,
    });
    expect(config).toEqual(fallback);
  });

  it('ignores a failing response', async () => {
    expect(await loadRemoteConfig({ fetch: respond({}, 500), backend: memory(), fallback })).toEqual(
      fallback,
    );
  });
});
