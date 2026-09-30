import { parseNote } from '@clink/rules';
import { hzToCents, nearestSample, playbackRate, trimLeadingSilence } from './sample-math';

export interface Sampler {
  ring(hz: number, when: number, velocity: number, destination: AudioNode): void;
}

interface SampleManifest {
  schemaVersion: 1;
  samples: { file: string; note: string }[];
}

/**
 * Loads the recorded glass samples. Resolves null when the manifest lists none or any file fails,
 * so the caller falls back to the synth (DEC-4). Spec: docs/architecture/06 §3.
 */
export async function loadSampler(ctx: AudioContext, manifestUrl: string): Promise<Sampler | null> {
  try {
    const response = await fetch(manifestUrl);
    if (!response.ok) return null;
    const manifest = (await response.json()) as SampleManifest;
    if (manifest.samples.length === 0) return null;
    const base = manifestUrl.slice(0, manifestUrl.lastIndexOf('/') + 1);
    const loaded = await Promise.all(
      manifest.samples.map(async ({ file, note }) => {
        const data = await (await fetch(base + file)).arrayBuffer();
        return { buffer: trimBuffer(ctx, await ctx.decodeAudioData(data)), cents: parseNote(note) };
      }),
    );
    const cents = loaded.map((sample) => sample.cents);
    return {
      ring(hz, when, velocity, destination) {
        const target = hzToCents(hz);
        const sample = loaded[nearestSample(target, cents)];
        if (!sample) return;
        const source = ctx.createBufferSource();
        const gain = ctx.createGain();
        const rate = playbackRate(target, sample.cents);
        source.buffer = sample.buffer;
        source.playbackRate.value = rate;
        gain.gain.setValueAtTime(0, when);
        gain.gain.linearRampToValueAtTime(velocity * 0.9, when + 0.004);
        source.connect(gain);
        gain.connect(destination);
        source.start(when);
        source.stop(when + sample.buffer.duration / rate);
      },
    };
  } catch {
    return null;
  }
}

function trimBuffer(ctx: AudioContext, buffer: AudioBuffer): AudioBuffer {
  const start = trimLeadingSilence(buffer.getChannelData(0));
  if (start === 0) return buffer;
  const trimmed = ctx.createBuffer(buffer.numberOfChannels, buffer.length - start, buffer.sampleRate);
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    trimmed.copyToChannel(buffer.getChannelData(channel).subarray(start), channel);
  }
  return trimmed;
}
