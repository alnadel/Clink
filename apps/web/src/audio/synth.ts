/** Struck-glass partials: frequency ratio, peak gain and decay to silence (docs/architecture/06 §4). */
const PARTIALS: readonly { ratio: number; peak: number; decay: number }[] = [
  { ratio: 1, peak: 1.0, decay: 2.5 },
  { ratio: 2.32, peak: 0.4, decay: 1.2 },
  { ratio: 4.25, peak: 0.2, decay: 0.6 },
  { ratio: 6.63, peak: 0.08, decay: 0.35 },
];

/** A synthesized struck-glass note. The 4 ms attack prevents clicks (FR-10). */
export function playSynthGlass(
  ctx: BaseAudioContext,
  destination: AudioNode,
  hz: number,
  when: number,
  velocity: number,
): void {
  for (const { ratio, peak, decay } of PARTIALS) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = hz * ratio;
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(peak * velocity * 0.3, when + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + decay);
    osc.connect(gain);
    gain.connect(destination);
    osc.start(when);
    osc.stop(when + decay + 0.05);
  }
}
