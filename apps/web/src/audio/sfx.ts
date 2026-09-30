import type { SfxName } from './types';

/** Effects live in /audio/sfx/<name>.mp3. A missing file is a silent no-op, logged once in development. */
export interface Sfx {
  load(): Promise<void>;
  play(name: SfxName): void;
}

const GAINS: Partial<Record<SfxName, number>> = { pour: 0.5, faucet: 0.5, drain: 0.5 };

export function createSfx(ctx: AudioContext, destination: AudioNode): Sfx {
  const buffers = new Map<SfxName, AudioBuffer>();
  const names: SfxName[] = [
    'pour',
    'faucet',
    'drain',
    'ice-clink',
    'melt',
    'found',
    'flourish',
    'tap',
    'refuse',
  ];
  return {
    async load() {
      await Promise.all(
        names.map(async (name) => {
          try {
            const response = await fetch(`/audio/sfx/${name}.mp3`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            buffers.set(name, await ctx.decodeAudioData(await response.arrayBuffer()));
          } catch {
            if (import.meta.env?.DEV) console.info(`sfx ${name} is not available`);
          }
        }),
      );
    },
    play(name) {
      const buffer = buffers.get(name);
      if (!buffer) return;
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      gain.gain.value = GAINS[name] ?? 0.8;
      source.buffer = buffer;
      source.connect(gain);
      gain.connect(destination);
      source.start();
    },
  };
}
