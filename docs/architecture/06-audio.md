# 06 · Audio (`apps/web/src/audio`)

Contract: `audio/types.ts` (`AudioEngine`). Requirements: FR-10 to FR-14, NFR-04 (100 ms or
less from tap to sound), NFR-05 (iOS), R1, R2.

## 1. Files

```
audio/
  types.ts        contract
  engine.ts       createAudioEngine(settings): AudioEngine; owns the AudioContext and status
  ios.ts          audio-session handling and the silent-loop fallback (§5)
  sampler.ts      glass voice from recorded samples (§3)
  synth.ts        glass voice synthesis fallback (§4)
  sfx.ts          effect loading and playback (§6)
  schedule.ts     pure: phraseTimes(beats, bpm, t0) → start times (§7), unit tested
public/audio/
  glass/manifest.json, glass/*.mp3
  sfx/<name>.mp3
  silence.mp3     0.5 s of silence (§5)
```

## 2. Engine rules

- **No `AudioContext` before `unlock()`,** and `unlock()` is only called synchronously
  inside a user-gesture handler (FR-14). The first unlock does this:
  `ctx = new AudioContext({ latencyHint: 'interactive' })`; then the iOS handling (§5);
  then `await ctx.resume()`; then it plays a 1-sample silent buffer to warm the output.
- **Graph:** voices → `masterGain` (0.8) → `DynamicsCompressorNode` (threshold −12 dB,
  ratio 4) → `ctx.destination`.
- **Status:**
  - `'off'` when `settings.sound` is false;
  - `'locked'` before the first unlock;
  - otherwise it maps from `ctx.state`: `running` → `'running'`, `suspended` →
    `'suspended'`, `interrupted` (Safari) → `'interrupted'`.
  - Every change notifies the listeners. The ops layer turns that into `audio_state`
    (09 §1).
- **Recovery (R2):**
  - On `visibilitychange` to visible, and on `ctx` `statechange` to a non-running state,
    set a flag.
  - The next `pointerdown` anywhere (one capture listener on `document`) calls `unlock()`
    again.
- **Timing:** every sound is scheduled on `ctx.currentTime`, never with `setTimeout`.
  UI callbacks such as `onNote` may use `setTimeout` to line up with audio times.
- **When not running,** `ring`, `sfx` and `playPhrase` are silent no-ops. `playPhrase` still
  calls `onNote` on schedule (using `performance.now()`) and resolves `done`, so the visual
  song works with sound off (R1, D25).
- **Voice limit:** at most 12 sounding voices. The oldest is faded out over 30 ms.

## 3. Sampler (recorded glass, DEC-4)

`public/audio/glass/manifest.json`:

```json
{ "schemaVersion": 1, "samples": [ { "file": "glass-c3.mp3", "note": "C3" }, { "file": "glass-g3.mp3", "note": "G3" } ] }
```

- **Load:** after unlock, fetch and `decodeAudioData` every sample. **Trim** leading silence
  after decode by dropping samples before the first one with |amplitude| > 0.001. MP3
  encoders add about 26 ms of padding, which counts against NFR-04.
- **`ring(hz, when, velocity = 1)`:**
  - `targetCents = 1200 * log2(hz / 440) + 6900`;
  - pick the sample whose note (via `parseNote`) is nearest in cents;
  - `source.playbackRate.value = 2 ** ((targetCents - sampleCents) / 1200)`;
  - gain envelope: 0 at `when`, linear ramp to `velocity * 0.9` by `when + 0.004`; the sample
    decays by itself;
  - stop at `when + buffer.duration / playbackRate`.
- **Until the recordings arrive,** or if loading fails, the engine uses the synth (§4). The
  sound designer's sign-off (FR-10) happens on the sampler.

## 4. Synth fallback (`synth.ts`)

A struck-glass tone from four sine partials:

| Partial | Frequency | Peak gain | Decay to silence |
|---|---|---|---|
| 1 | hz × 1 | 1.0 | 2.5 s |
| 2 | hz × 2.32 | 0.4 | 1.2 s |
| 3 | hz × 4.25 | 0.2 | 0.6 s |
| 4 | hz × 6.63 | 0.08 | 0.35 s |

For each partial:
- `OscillatorNode` (sine) → `GainNode`;
- gain: `setValueAtTime(0, when)`, then `linearRampToValueAtTime(peak * velocity * 0.3,
  when + 0.004)`, then `exponentialRampToValueAtTime(0.0001, when + decay)`;
- `osc.stop(when + decay + 0.05)`.

The 4 ms attack prevents clicks (FR-10: "without clicks").

## 5. iOS audio (NFR-05)

Called inside `unlock()`, before `ctx.resume()`:

```ts
const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
if (session) {
  session.type = 'playback';              // Safari 16.4+: plays even with the ringer switch on silent
} else if (isIOS()) {
  // Fallback: a looping silent <audio> element, started inside the gesture.
  silentEl ??= Object.assign(document.createElement('audio'), { src: '/audio/silence.mp3', loop: true });
  silentEl.setAttribute('playsinline', '');
  void silentEl.play().catch(() => {});
}
```

`isIOS()`: `/iPad|iPhone|iPod/.test(navigator.userAgent)`, or `navigator.platform ===
'MacIntel' && navigator.maxTouchPoints > 1`.

Verify on the iPhone 8 reference device: ringer switch on silent, after a phone call, after
Siri, and after locking and unlocking the phone. Record the results in the device matrix.

## 6. Effects (`sfx.ts`)

The names are in `SfxName`. Files are `public/audio/sfx/<name>.mp3`, loaded after unlock. A
missing file makes that effect a silent no-op, logged once in development. `pour`, `faucet`
and `drain` play once at the start of a move, at 0.5 gain. `found` plays when a target is
gained, and `flourish` on the solve.

## 7. Phrase scheduling (`schedule.ts`, FR-12)

```ts
// Start time of each note: t0 plus the sum of the earlier beats, times 60 / bpm.
function phraseTimes(beats: readonly number[], bpm: number, t0: number): number[]
// e.g. phraseTimes([1, 1, 2], 120, 10) → [10, 10.5, 11]
```

`playPhrase` uses `t0 = ctx.currentTime + 0.05`. Each note rings at its time (velocity 0.9).
`onNote(i)` fires via `setTimeout((times[i] - ctx.currentTime) * 1000)`. `done` resolves after
the last note's beat length, and `stop()` cancels the pending timeouts and silences the
voices.

## 8. Latency checklist (NFR-04)

- Sound starts on `pointerdown`, not `click`.
- Buffers are decoded before they are needed.
- Encoder padding is trimmed.
- `latencyHint: 'interactive'`.
- No work between the tap and `ring()`: the session is synchronous and cheap, and the board
  animation starts after the ring.
- Measure with a 240 fps slow-motion recording on each reference phone. The median must be
  100 ms or less.
