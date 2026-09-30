import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAudioEngine } from './engine';

let contexts = 0;
let state = 'suspended';

class FakeParam {
  value = 0;
  setValueAtTime() {}
  linearRampToValueAtTime() {}
  exponentialRampToValueAtTime() {}
  setTargetAtTime() {}
}
class FakeNode {
  gain = new FakeParam();
  frequency = new FakeParam();
  threshold = new FakeParam();
  ratio = new FakeParam();
  playbackRate = new FakeParam();
  type = '';
  buffer: unknown = null;
  connect() {}
  disconnect() {}
  start() {}
  stop() {}
}
class FakeAudioContext {
  currentTime = 0;
  sampleRate = 44100;
  destination = new FakeNode();
  onstatechange: (() => void) | null = null;
  constructor() {
    contexts++;
  }
  get state() {
    return state;
  }
  resume() {
    state = 'running';
    this.onstatechange?.();
    return Promise.resolve();
  }
  createGain = () => new FakeNode();
  createOscillator = () => new FakeNode();
  createBufferSource = () => new FakeNode();
  createDynamicsCompressor = () => new FakeNode();
  createBuffer = () => ({});
  decodeAudioData = () => Promise.reject(new Error('no audio'));
}

beforeEach(() => {
  contexts = 0;
  state = 'suspended';
  vi.stubGlobal('AudioContext', FakeAudioContext);
  vi.stubGlobal('fetch', () => Promise.resolve(new Response('nope', { status: 404 })));
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('audio engine', () => {
  it('creates no AudioContext before unlock (FR-14)', () => {
    const engine = createAudioEngine({ enabled: true });
    expect(engine.status).toBe('locked');
    engine.ring(440);
    engine.sfx('tap');
    expect(contexts).toBe(0);
  });

  it('unlock creates exactly one context and reports running', async () => {
    const engine = createAudioEngine({ enabled: true });
    const seen: string[] = [];
    engine.onStatusChange((status) => seen.push(status));
    await engine.unlock();
    await engine.unlock();
    expect(contexts).toBe(1);
    expect(engine.status).toBe('running');
    expect(seen).toEqual(['running']);
  });

  it('never creates a context when sound is off', async () => {
    const engine = createAudioEngine({ enabled: false });
    await engine.unlock();
    expect(contexts).toBe(0);
    expect(engine.status).toBe('off');
    engine.setEnabled(true);
    expect(engine.status).toBe('locked');
    engine.setEnabled(false);
    expect(engine.status).toBe('off');
  });

  it('a phrase fires onNote on schedule and resolves even with sound off', async () => {
    const engine = createAudioEngine({ enabled: false });
    const notes: number[] = [];
    const playback = engine.playPhrase([440, 494, 523], [1, 1, 2], 120, (i) => notes.push(i));
    await vi.advanceTimersByTimeAsync(60);
    expect(notes).toEqual([0]);
    await vi.advanceTimersByTimeAsync(500);
    expect(notes).toEqual([0, 1]);
    await vi.advanceTimersByTimeAsync(600);
    expect(notes).toEqual([0, 1, 2]);
    await vi.advanceTimersByTimeAsync(1100);
    await expect(playback.done).resolves.toBeUndefined();
  });

  it('stop cancels pending notes and resolves done', async () => {
    const engine = createAudioEngine({ enabled: false });
    const notes: number[] = [];
    const playback = engine.playPhrase([440, 494], [1, 1], 60, (i) => notes.push(i));
    await vi.advanceTimersByTimeAsync(60);
    playback.stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(notes).toEqual([0]);
    await expect(playback.done).resolves.toBeUndefined();
  });
});
