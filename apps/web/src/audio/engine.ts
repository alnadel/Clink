import { applyIosAudioSession } from './ios';
import { loadSampler, type Sampler } from './sampler';
import { phraseDuration, phraseTimes } from './schedule';
import { createSfx, type Sfx } from './sfx';
import { playSynthGlass } from './synth';
import type { AudioEngine, AudioStatus, PhrasePlayback, SfxName } from './types';

const MAX_VOICES = 12;
const PHRASE_LEAD_SECONDS = 0.05;

interface Voice {
  bus: GainNode;
  endsAt: number;
}

export interface AudioEngineOptions {
  enabled: boolean;
}

/**
 * The audio engine: gesture-gated unlock, glass voices, phrase playback on the audio clock, effects
 * and iOS handling. Spec: docs/architecture/06-audio.md. No AudioContext exists before unlock() (FR-14).
 */
export function createAudioEngine(options: AudioEngineOptions): AudioEngine {
  let enabled = options.enabled;
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let sampler: Sampler | null = null;
  let sfx: Sfx | null = null;
  let needsResume = false;
  let voices: Voice[] = [];
  const listeners = new Set<(status: AudioStatus) => void>();

  const computeStatus = (): AudioStatus => {
    if (!enabled) return 'off';
    if (!ctx) return 'locked';
    const state = ctx.state as string;
    if (state === 'running') return 'running';
    return state === 'interrupted' ? 'interrupted' : 'suspended';
  };
  let lastStatus = computeStatus();
  const emit = () => {
    const status = computeStatus();
    if (status === lastStatus) return;
    lastStatus = status;
    for (const listener of [...listeners]) listener(status);
  };

  const isRunning = () => enabled && ctx !== null && ctx.state === 'running';

  const startVoice = (hz: number, when: number, velocity: number): Voice | null => {
    if (!ctx || !master || !isRunning()) return null;
    const bus = ctx.createGain();
    bus.connect(master);
    if (sampler) sampler.ring(hz, when, velocity, bus);
    else playSynthGlass(ctx, bus, hz, when, velocity);
    const voice = { bus, endsAt: when + 2.6 };
    const now = ctx.currentTime;
    voices = voices.filter((v) => v.endsAt > now);
    voices.push(voice);
    while (voices.length > MAX_VOICES) fadeOut(voices.shift());
    return voice;
  };

  const fadeOut = (voice: Voice | undefined) => {
    if (!voice || !ctx) return;
    voice.bus.gain.setTargetAtTime(0, ctx.currentTime, 0.01);
    setTimeout(() => voice.bus.disconnect(), 200);
  };

  const recover = () => {
    if (needsResume && enabled && ctx) void ctx.resume().then(emit, emit);
  };
  if (typeof document !== 'undefined') {
    document.addEventListener('pointerdown', recover, { capture: true });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && ctx && ctx.state !== 'running') needsResume = true;
    });
  }

  return {
    get status() {
      return computeStatus();
    },

    unlock() {
      if (!enabled) return Promise.resolve();
      if (!ctx) {
        // Everything up to resume() must stay synchronous so iOS keeps the user gesture.
        ctx = new AudioContext({ latencyHint: 'interactive' });
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -12;
        compressor.ratio.value = 4;
        master = ctx.createGain();
        master.gain.value = 0.8;
        master.connect(compressor);
        compressor.connect(ctx.destination);
        ctx.onstatechange = () => {
          if (ctx && ctx.state !== 'running') needsResume = true;
          emit();
        };
        applyIosAudioSession();
        sfx = createSfx(ctx, master);
      }
      const context = ctx;
      const resumed = context.resume();
      needsResume = false;
      return resumed.then(async () => {
        const warm = context.createBufferSource();
        warm.buffer = context.createBuffer(1, 1, context.sampleRate);
        warm.connect(context.destination);
        warm.start();
        emit();
        if (!sampler) sampler = await loadSampler(context, '/audio/glass/manifest.json');
        await sfx?.load();
      });
    },

    setEnabled(next) {
      enabled = next;
      if (!next) {
        for (const voice of voices) fadeOut(voice);
        voices = [];
      }
      emit();
    },

    ring(hz, when, velocity = 1) {
      if (!ctx) return;
      startVoice(hz, when ?? ctx.currentTime, velocity);
    },

    playPhrase(hz, beats, bpm, onNote): PhrasePlayback {
      const offsets = phraseTimes(beats, bpm, 0);
      const total = phraseDuration(beats, bpm);
      const timers: ReturnType<typeof setTimeout>[] = [];
      const phraseVoices: Voice[] = [];
      let finish: () => void = () => {};
      let finished = false;
      const done = new Promise<void>((resolve) => {
        finish = () => {
          if (finished) return;
          finished = true;
          resolve();
        };
      });

      const startAt = ctx ? ctx.currentTime + PHRASE_LEAD_SECONDS : 0;
      hz.forEach((frequency, i) => {
        const offset = offsets[i] ?? 0;
        const voice = startVoice(frequency, startAt + offset, 0.9);
        if (voice) phraseVoices.push(voice);
        // The visual song runs on timers, so it also works with sound off (R1, D25).
        timers.push(setTimeout(() => onNote?.(i), (PHRASE_LEAD_SECONDS + offset) * 1000));
      });
      timers.push(setTimeout(finish, (PHRASE_LEAD_SECONDS + total) * 1000));

      return {
        done,
        stop() {
          for (const timer of timers) clearTimeout(timer);
          for (const voice of phraseVoices) fadeOut(voice);
          finish();
        },
      };
    },

    sfx(name: SfxName) {
      if (isRunning()) sfx?.play(name);
    },

    now: () => ctx?.currentTime ?? 0,

    onStatusChange(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
