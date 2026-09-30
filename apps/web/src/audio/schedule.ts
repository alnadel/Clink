/**
 * Start time of each phrase note: `t0` plus the beats before it, at 60 / bpm seconds per beat (FR-12).
 * phraseTimes([1, 1, 2], 120, 10) -> [10, 10.5, 11]
 */
export function phraseTimes(beats: readonly number[], bpm: number, t0: number): number[] {
  const secondsPerBeat = 60 / bpm;
  const times: number[] = [];
  let elapsed = 0;
  for (const beat of beats) {
    times.push(t0 + elapsed * secondsPerBeat);
    elapsed += beat;
  }
  return times;
}

/** Total length of a phrase in seconds. */
export function phraseDuration(beats: readonly number[], bpm: number): number {
  return (beats.reduce((sum, beat) => sum + beat, 0) * 60) / bpm;
}
