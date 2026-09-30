/** Index of the sample whose pitch is nearest `targetCents`. Ties go to the lower index. */
export function nearestSample(targetCents: number, sampleCents: readonly number[]): number {
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  sampleCents.forEach((cents, i) => {
    const distance = Math.abs(cents - targetCents);
    if (distance < bestDistance) {
      best = i;
      bestDistance = distance;
    }
  });
  return best;
}

/** Playback rate that shifts a sample recorded at `sampleCents` to `targetCents`. */
export function playbackRate(targetCents: number, sampleCents: number): number {
  return 2 ** ((targetCents - sampleCents) / 1200);
}

/** Cents of a frequency on the MIDI-cents scale used by the rules engine (A4 = 6900). */
export function hzToCents(hz: number): number {
  return 1200 * Math.log2(hz / 440) + 6900;
}

/**
 * First index whose absolute amplitude exceeds `threshold`. MP3 encoders add about 26 ms of
 * padding, which counts against the 100 ms latency budget (NFR-04).
 */
export function trimLeadingSilence(channelData: Float32Array, threshold = 0.001): number {
  for (let i = 0; i < channelData.length; i++) {
    if (Math.abs(channelData[i] ?? 0) > threshold) return i;
  }
  return 0;
}
