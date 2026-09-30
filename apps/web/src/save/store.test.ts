import { describe, expect, it } from 'vitest';
import { createSaveStore, type KvBackend } from './store';
import { type CurrentLevel, DEFAULT_SETTINGS } from './types';

function memoryBackend(): KvBackend {
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

describe('save store', () => {
  it('creates a full default profile once, then loads the same one', async () => {
    const backend = memoryBackend();
    const first = createSaveStore(backend);
    const profile = await first.loadProfile();
    expect(first.wasProfileCreated()).toBe(true);
    expect(profile).toMatchObject({
      schema: 1,
      source: null,
      tester: false,
      soundChoiceMade: false,
      settings: DEFAULT_SETTINGS,
      seenGuides: [],
      levelAttempts: {},
      installPromptCount: 0,
      surveyAnswered: false,
      sessionCount: 0,
      eventSeq: 0,
    });
    expect(profile.deviceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(profile.firstSessionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const second = createSaveStore(backend);
    expect((await second.loadProfile()).deviceId).toBe(profile.deviceId);
    expect(second.wasProfileCreated()).toBe(false);
  });

  it('progress starts empty and round-trips', async () => {
    const save = createSaveStore(memoryBackend());
    expect(await save.loadProgress()).toEqual({ schema: 1, levels: {}, dailies: {} });
    const progress = {
      schema: 1 as const,
      levels: { 'w1-01': { stars: 3 as const, bestMoves: 2, solvedAt: 'x' } },
      dailies: {},
    };
    await save.saveProgress(progress);
    expect(await save.loadProgress()).toEqual(progress);
  });

  it('saves and clears the level in progress', async () => {
    const save = createSaveStore(memoryBackend());
    const current: CurrentLevel = {
      schema: 1,
      kind: 'campaign',
      levelId: 'w1-08',
      puzzleNo: null,
      levelHash: 'abcd1234',
      moves: [{ type: 'pour', from: 2, to: 1 }],
      hinted: false,
      hints: 0,
      undos: 0,
      restarts: 0,
      elapsedMs: 1000,
      attempt: 1,
    };
    expect(await save.loadCurrent()).toBeNull();
    await save.saveCurrent(current);
    expect(await save.loadCurrent()).toEqual(current);
    await save.saveCurrent(null);
    expect(await save.loadCurrent()).toBeNull();
  });

  it('requestPersistence is false when the browser has no storage manager', async () => {
    expect(await createSaveStore(memoryBackend()).requestPersistence()).toBe(false);
  });
});
