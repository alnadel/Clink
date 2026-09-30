// ACCEPTANCE TEST — owned by the architecture. Only remove `.skip`; never change expectations.
// Spec: docs/architecture/05-web-app.md §4.2 (FR-01, NFR-09).
import { compileLevel, type LevelJson } from '@clink/rules';
import { describe, expect, it } from 'vitest';
import { computeLayout } from '../../src/board/layout';
import type { BoardLayout, Rect } from '../../src/board/types';
import { bigLevelJson, fxToolsJson, w108Json } from '../fixtures';

const bottom = (r: Rect) => r.y + r.height;
const right = (r: Rect) => r.x + r.width;
const inside = (r: Rect, outer: Rect) =>
  r.x >= outer.x - 1e-9 &&
  r.y >= outer.y - 1e-9 &&
  right(r) <= right(outer) + 1e-9 &&
  bottom(r) <= bottom(outer) + 1e-9;

function checkInvariants(layout: BoardLayout, json: LevelJson) {
  const screen: Rect = { x: 0, y: 0, width: layout.width, height: layout.height };
  expect(inside(layout.melodyBar, screen)).toBe(true);
  expect(layout.melodyNotes).toHaveLength(json.melody.notes.length);
  layout.melodyNotes.forEach((note, i) => {
    expect(inside(note, layout.melodyBar)).toBe(true);
    const next = layout.melodyNotes[i + 1];
    if (next) expect(right(note)).toBeLessThanOrEqual(next.x + 1e-9);
  });
  expect(layout.glasses).toHaveLength(json.glasses.length);
  layout.glasses.forEach((g, i) => {
    const capacity = json.glasses[i]?.capacity ?? 0;
    expect(g.index).toBe(i);
    expect(inside(g.body, screen)).toBe(true);
    expect(inside(g.hit, screen)).toBe(true);
    expect(g.hit.width).toBeGreaterThanOrEqual(44);
    expect(g.hit.height).toBeGreaterThanOrEqual(44);
    expect(inside(g.body, g.hit)).toBe(true);
    expect(g.body.y).toBeGreaterThanOrEqual(bottom(layout.melodyBar));
    expect(g.fillLineY).toHaveLength(capacity + 1);
    expect(g.fillLineY[0]).toBeCloseTo(bottom(g.body) - 6, 9);
    g.fillLineY.forEach((y, w) => {
      if (w > 0) expect(y).toBeCloseTo((g.fillLineY[w - 1] ?? 0) - layout.unit, 9);
      expect(y).toBeGreaterThan(g.body.y);
    });
    const next = layout.glasses[i + 1];
    if (next) expect(right(g.hit)).toBeLessThanOrEqual(next.hit.x + 1e-9);
    for (const tool of Object.values(layout.tools)) {
      if (tool) expect(tool.y).toBeGreaterThanOrEqual(bottom(g.body));
    }
  });
  expect(Boolean(layout.tools.faucet)).toBe(json.tools.includes('faucet'));
  expect(Boolean(layout.tools.sink)).toBe(json.tools.includes('sink'));
  for (const tool of Object.values(layout.tools)) {
    if (!tool) continue;
    expect(tool.width).toBeGreaterThanOrEqual(44);
    expect(tool.height).toBeGreaterThanOrEqual(44);
    expect(inside(tool, screen)).toBe(true);
  }
}

describe.skip('computeLayout', () => {
  it('w1-08 on a 360 x 560 board matches the formula exactly', () => {
    const layout = computeLayout(360, 560, compileLevel(w108Json()));
    expect(layout.width).toBe(360);
    expect(layout.height).toBe(560);
    expect(layout.unit).toBe(28);
    expect(layout.melodyBar).toEqual({ x: 16, y: 16, width: 328, height: 56 });
    expect(layout.tools).toEqual({});
    expect(layout.glasses.map((g) => g.body)).toEqual([
      { x: 60, y: 420, width: 72, height: 124 },
      { x: 144, y: 392, width: 72, height: 152 },
      { x: 228, y: 280, width: 72, height: 264 },
    ]);
    expect(layout.glasses[0]?.hit).toEqual({ x: 54, y: 96, width: 84, height: 448 });
    expect(layout.glasses[0]?.fillLineY).toEqual([538, 510, 482, 454, 426]);
  });

  it('places the faucet bottom-left and the sink bottom-right', () => {
    const layout = computeLayout(360, 560, compileLevel(fxToolsJson()));
    expect(layout.tools.faucet).toEqual({ x: 16, y: 480, width: 64, height: 64 });
    expect(layout.tools.sink).toEqual({ x: 280, y: 480, width: 64, height: 64 });
  });

  it.each([
    [360, 560],
    [320, 480],
    [390, 700],
    [1024, 700],
  ])('keeps every invariant at %i x %i', (width, height) => {
    for (const json of [w108Json(), fxToolsJson(), bigLevelJson()]) {
      checkInvariants(computeLayout(width, height, compileLevel(json)), json);
    }
  });
});
