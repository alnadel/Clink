import type { ContentManifest, PackFile } from '@clink/rules';
import { describe, expect, it, vi } from 'vitest';
import w108 from '../../../../packages/rules/test/fixtures/levels/w1-08.json';
import { fxToolsJson, w108Json } from '../../test/fixtures';
import { loadContent } from './store';

const pack: PackFile = { schemaVersion: 1, id: 'w1', levels: [w108Json()] };
const manifest: ContentManifest = {
  schemaVersion: 1,
  builtAt: '2026-01-01T00:00:00Z',
  packs: [{ id: 'w1', file: 'w1.aaaaaaaa.json', hash: 'aaaaaaaa', levelIds: ['w1-08'] }],
  levelOrder: ['w1-08'],
  levelHashes: { 'w1-08': '00000000' },
  tunes: {},
  schedule: { schemaVersion: 1, launchDate: '2026-11-30', puzzles: [] },
  guides: { schemaVersion: 1, levels: {}, intros: { faucet: [], sink: [], ice: [] }, linkTutorial: [] },
};

function fakeFetch(overrides: Record<string, unknown> = {}) {
  const routes: Record<string, unknown> = {
    '/content/manifest.json': manifest,
    '/content/packs/w1.aaaaaaaa.json': pack,
    ...overrides,
  };
  return vi.fn(async (url: string | URL | Request) => {
    const body = routes[String(url)];
    return body === undefined
      ? new Response('nope', { status: 404 })
      : new Response(JSON.stringify(body), { status: 200 });
  }) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

describe('content store', () => {
  it('exposes the manifest and compiles levels', async () => {
    const store = await loadContent({ fetch: fakeFetch() });
    expect(store.manifest().levelOrder).toEqual(['w1-08']);
    expect((await store.level('w1-08')).par).toBe(w108.par);
    expect(await store.level('w1-08')).toBe(await store.level('w1-08'));
  });

  it('fetches a pack once for concurrent requests', async () => {
    const doFetch = fakeFetch();
    const store = await loadContent({ fetch: doFetch });
    await Promise.all([store.levelJson('w1-08'), store.levelJson('w1-08'), store.level('w1-08')]);
    const packRequests = doFetch.mock.calls.filter((call) => String(call[0]).includes('/packs/'));
    expect(packRequests).toHaveLength(1);
  });

  it('rejects an unknown level', async () => {
    const store = await loadContent({ fetch: fakeFetch() });
    await expect(store.levelJson('w9-99')).rejects.toThrow('unknown level w9-99');
  });

  it('rejects a missing manifest or wrong schema version', async () => {
    await expect(loadContent({ fetch: fakeFetch({ '/content/manifest.json': undefined }) })).rejects.toThrow(
      '404',
    );
    await expect(
      loadContent({ fetch: fakeFetch({ '/content/manifest.json': { ...manifest, schemaVersion: 2 } }) }),
    ).rejects.toThrow('schemaVersion');
  });

  it('warm() loads packs and never throws', async () => {
    const good = fakeFetch();
    await (await loadContent({ fetch: good })).warm();
    expect(good.mock.calls.some((call) => String(call[0]).includes('/packs/'))).toBe(true);
    const broken = fakeFetch({ '/content/packs/w1.aaaaaaaa.json': undefined });
    await expect((await loadContent({ fetch: broken })).warm()).resolves.toBeUndefined();
  });

  it('uses the given base URL', async () => {
    const doFetch = fakeFetch({ 'https://x.test/content/manifest.json': manifest });
    await loadContent({ fetch: doFetch, baseUrl: 'https://x.test' });
    expect(String(doFetch.mock.calls[0]?.[0])).toBe('https://x.test/content/manifest.json');
  });

  it('keeps fixtures importable', () => {
    expect(fxToolsJson().id).toBe('fx-tools');
  });
});
