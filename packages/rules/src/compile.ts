import { LevelError } from './errors';
import { parseNote } from './notes';
import type { Glass, IceCube, Level, LevelJson, Pos, ScalePosition } from './types';

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const isInteger = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);

function schemaError(message: string): never {
  throw new LevelError('E_SCHEMA', message);
}

/** Step 1: the JS types and simple values (spec §3). */
function checkSchema(json: LevelJson): void {
  const j = json as unknown as Record<string, unknown>;
  if (j.schemaVersion !== 1) schemaError('schemaVersion must be 1');
  if (typeof j.id !== 'string' || j.id === '') schemaError('id must be a non-empty string');
  if (j.world !== 1 && j.world !== 2 && j.world !== 3) schemaError('world must be 1, 2 or 3');
  const { scale, melody } = json;
  if (!scale || typeof scale.tonicHz !== 'number' || !Array.isArray(scale.stepsCents))
    schemaError('bad scale');
  if (!Array.isArray(scale.range) || scale.range.length !== 2) schemaError('bad scale range');
  if (!melody || !Array.isArray(melody.notes) || !Array.isArray(melody.beats)) schemaError('bad melody');
  if (typeof melody.bpm !== 'number') schemaError('bad bpm');
  if (!Array.isArray(json.glasses) || !Array.isArray(json.tools) || !Array.isArray(json.ice)) {
    schemaError('glasses, tools and ice must be arrays');
  }
  if (melody.bpm < 40 || melody.bpm > 240) schemaError('bpm must be 40..240');
  if (melody.beats.length !== melody.notes.length) schemaError('beats and notes differ in length');
  if (melody.beats.some((beat) => !(beat > 0))) schemaError('every beat must be > 0');
  const toolsOk = json.tools.every((tool) => tool === 'faucet' || tool === 'sink');
  if (!toolsOk || new Set(json.tools).size !== json.tools.length) schemaError('bad tools');
}

/**
 * Validates a level file and resolves every note to a scale position. Throws LevelError with the
 * first failing code, in the order of the spec. Does NOT check par, optimalSolutions, world
 * constraints or solvability (the CI checker does). Spec: docs/architecture/02-rules-engine.md §3.
 */
export function compileLevel(json: LevelJson): Level {
  checkSchema(json);

  // Step 2: the scale.
  const { scale } = json;
  const low = parseNote(scale.range[0]);
  const high = parseNote(scale.range[1]);
  const steps = scale.stepsCents;
  if (!(scale.tonicHz > 0)) throw new LevelError('E_RANGE', 'tonicHz must be > 0');
  const stepsBad =
    steps.length === 0 ||
    steps[0] !== 0 ||
    steps.some((step, i) => step >= 1200 || (i > 0 && step <= (steps[i - 1] ?? 0)));
  if (stepsBad)
    throw new LevelError('E_RANGE', 'stepsCents must start at 0 and strictly increase below 1200');
  if (low >= high) throw new LevelError('E_RANGE', 'range must ascend');

  const tonicCents = Math.round(69 + 12 * Math.log2(scale.tonicHz / 440)) * 100;
  const cents: number[] = [];
  for (let octave = -11; octave <= 11; octave++) {
    for (const step of steps) {
      const c = tonicCents + 1200 * octave + step;
      if (c >= low && c <= high) cents.push(c);
    }
  }
  cents.sort((a, b) => a - b);
  if (cents[0] !== low || cents[cents.length - 1] !== high) {
    throw new LevelError('E_RANGE', 'a range endpoint is not on the scale');
  }
  const positions: ScalePosition[] = cents.map((c, pos) => {
    const midi = Math.round(c / 100);
    const pitchClass = midi % 12;
    const octave = Math.floor(midi / 12) - 1;
    return {
      pos,
      cents: c,
      hz: scale.tonicHz * 2 ** ((c - tonicCents) / 1200),
      name: `${SHARP_NAMES[pitchClass]}${octave}`,
      pitchClass,
      octave,
    };
  });
  const positionOf = (name: string): Pos => {
    const pos = cents.indexOf(parseNote(name));
    if (pos < 0) throw new LevelError('E_OFF_SCALE', `${name} is not on the scale`);
    return pos;
  };

  // Steps 3 and 4: glasses.
  if (json.glasses.length < 2 || json.glasses.length > 5) {
    throw new LevelError('E_GLASS_COUNT', 'a level needs 2 to 5 glasses');
  }
  const seenIds = new Set<string>();
  const glasses: Glass[] = json.glasses.map((glass, index) => {
    if (typeof glass.id !== 'string' || glass.id === '' || seenIds.has(glass.id)) {
      throw new LevelError('E_GLASS', 'glass ids must be unique and non-empty');
    }
    seenIds.add(glass.id);
    if (!isInteger(glass.capacity) || glass.capacity < 2 || glass.capacity > 12) {
      throw new LevelError('E_GLASS', `glass ${glass.id}: capacity must be an integer 2..12`);
    }
    if (!isInteger(glass.water) || glass.water < 0 || glass.water > glass.capacity) {
      throw new LevelError('E_GLASS', `glass ${glass.id}: water must be an integer 0..capacity`);
    }
    const emptyPos = positionOf(glass.emptyNote);
    if (emptyPos - glass.capacity < 0) {
      throw new LevelError('E_FILL_RANGE', `glass ${glass.id}: lowest fill line is below the range`);
    }
    return { id: glass.id, index, capacity: glass.capacity, emptyPos, startWater: glass.water };
  });

  // Step 5: the melody.
  const notes = json.melody.notes.map(positionOf);
  const targets: Pos[] = [];
  for (const note of notes) if (!targets.includes(note)) targets.push(note);
  if (
    notes.length < 3 ||
    notes.length > 8 ||
    targets.length < 1 ||
    targets.length > 5 ||
    targets.length > glasses.length
  ) {
    throw new LevelError('E_PHRASE', 'phrase must have 3..8 notes and 1..5 targets, at most one per glass');
  }

  // Step 6: ice.
  if (json.ice.length > 3) throw new LevelError('E_ICE', 'at most 3 ice cubes');
  const ice: IceCube[] = json.ice.map((cube, index) => {
    const glass = glasses.findIndex((g) => g.id === cube.glass);
    if (glass < 0) throw new LevelError('E_ICE', `unknown glass ${cube.glass}`);
    if (!isInteger(cube.countdown) || cube.countdown < 1 || cube.countdown > 15) {
      throw new LevelError('E_ICE', 'countdown must be an integer 1..15');
    }
    return { index, glass, startCountdown: cube.countdown };
  });

  return {
    id: json.id,
    world: json.world,
    source: json,
    positions,
    glasses,
    ice,
    tools: { faucet: json.tools.includes('faucet'), sink: json.tools.includes('sink') },
    melody: {
      tuneId: json.melody.tuneId,
      title: json.melody.title,
      notes,
      beats: [...json.melody.beats],
      bpm: json.melody.bpm,
      targetIndex: notes.map((note) => targets.indexOf(note)),
    },
    targets,
    par: json.par,
    optimalSolutions: json.optimalSolutions,
  };
}
