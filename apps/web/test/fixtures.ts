/** Shared fixtures for web acceptance tests. Owned by the architecture. */
import type { LevelJson } from '@clink/rules';
import fxTools from '../../../packages/rules/test/fixtures/levels/fx-tools.json';
import w108 from '../../../packages/rules/test/fixtures/levels/w1-08.json';
import moveCases from '../../../packages/rules/test/fixtures/move-cases.json';
import { DEFAULT_SETTINGS, type Settings } from '../src/save/types';

export function w108Json(): LevelJson {
  return JSON.parse(JSON.stringify(w108)) as LevelJson;
}

export function fxToolsJson(): LevelJson {
  return JSON.parse(JSON.stringify(fxTools)) as LevelJson;
}

/** A worst-case level for layout: 5 glasses of 12, an 8-note phrase, faucet and sink. */
export function bigLevelJson(): LevelJson {
  const json = w108Json();
  json.id = 'layout-5x12';
  json.world = 2;
  json.glasses = ['A', 'B', 'C', 'D', 'E'].map((id) => ({ id, capacity: 12, emptyNote: 'A5', water: 6 }));
  json.melody.notes = ['C4', 'D4', 'E4', 'G4', 'A4', 'G4', 'E4', 'D4'];
  json.melody.beats = [1, 1, 1, 1, 1, 1, 1, 1];
  json.tools = ['faucet', 'sink'];
  return json;
}

/** Expected events of pouring C into B at the start of w1-08 (Appendix A move 1). */
export const APPENDIX_A_MOVE_1 = (moveCases as { expected: { events: unknown[] } }[])[0]?.expected.events;

export function settings(overrides: Partial<Settings> = {}): Settings {
  return { ...DEFAULT_SETTINGS, ...overrides };
}
