import type { Level } from '@clink/rules';
import type { BoardLayout, GlassLayout, Rect } from './types';
export function computeLayout(W: number, H: number, level: Level): BoardLayout {
  const P = 16,
    GAP = 12,
    BAR_H = 56,
    NOTE_H = 44,
    NG = 6,
    TOOL = 64,
    LABEL = 20,
    RIM = 12,
    BOT = 6;
  const melodyBar = { x: P, y: P, width: W - 2 * P, height: BAR_H };
  const n = level.melody.notes.length;
  const noteW = Math.min(48, Math.floor((melodyBar.width - (n - 1) * NG) / n));
  const total = n * noteW + (n - 1) * NG;
  const melodyNotes: Rect[] = [];
  for (let i = 0; i < n; i++)
    melodyNotes.push({
      x: melodyBar.x + (melodyBar.width - total) / 2 + i * (noteW + NG),
      y: melodyBar.y + (BAR_H - NOTE_H) / 2,
      width: noteW,
      height: NOTE_H,
    });
  const has = level.tools.faucet || level.tools.sink;
  const toolY = H - P - TOOL;
  const tools: BoardLayout['tools'] = {};
  if (level.tools.faucet) tools.faucet = { x: P, y: toolY, width: TOOL, height: TOOL };
  if (level.tools.sink) tools.sink = { x: W - P - TOOL, y: toolY, width: TOOL, height: TOOL };
  const areaTop = melodyBar.y + BAR_H + 24;
  const areaBottom = has ? toolY - 16 : H - P;
  const g = level.glasses.length;
  const gw = Math.min(72, Math.floor((W - 2 * P - (g - 1) * GAP) / g));
  const rowW = g * gw + (g - 1) * GAP;
  const x0 = (W - rowW) / 2;
  const maxCap = Math.max(...level.glasses.map((x) => x.capacity));
  const unit = Math.max(6, Math.min(28, Math.floor((areaBottom - areaTop - LABEL - RIM) / maxCap)));
  const glasses: GlassLayout[] = level.glasses.map((gl, i) => {
    const h = gl.capacity * unit + RIM;
    const body = { x: x0 + i * (gw + GAP), y: areaBottom - h, width: gw, height: h };
    const fillLineY: number[] = [];
    for (let w = 0; w <= gl.capacity; w++) fillLineY.push(areaBottom - BOT - w * unit);
    return {
      index: i,
      body,
      hit: { x: body.x - GAP / 2, y: areaTop, width: gw + GAP, height: areaBottom - areaTop },
      fillLineY,
    };
  });
  return { width: W, height: H, unit, melodyBar, melodyNotes, glasses, tools };
}
