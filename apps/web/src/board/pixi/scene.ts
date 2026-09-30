import type { Level, Move, Pos, State, ToolName } from '@clink/rules';
import { Container, Graphics, Text } from 'pixi.js';
import { noteLabel, noteStyle } from '../../theme/notes';
import type { BoardLayout, BoardOptions, Rect } from '../types';
import { drawGlyph } from './glyphs';

const FONT = 'system-ui, -apple-system, sans-serif';
const ACCENT = '#38bdf8';
const LIFT = 10;
const ICE_SIZE = 26;

function label(text: string, size: number, fill = '#f8fafc'): Text {
  const node = new Text({ text, style: { fontFamily: FONT, fontSize: size, fontWeight: '700', fill } });
  node.anchor.set(0.5);
  return node;
}

/** A rounded outline that pulses. Its container sits at the rect's centre so it can scale in place. */
class Ring {
  readonly node = new Container();
  private readonly outline = new Graphics();
  private rect: Rect | null = null;

  constructor(private readonly color: string) {
    this.node.addChild(this.outline);
    this.node.visible = false;
  }

  set(rect: Rect | null): void {
    this.rect = rect;
    this.outline.clear();
    this.node.visible = rect !== null;
    if (!rect) return;
    this.node.position.set(rect.x + rect.width / 2, rect.y + rect.height / 2);
    this.outline
      .roundRect(-rect.width / 2 - 5, -rect.height / 2 - 5, rect.width + 10, rect.height + 10, 14)
      .stroke({ width: 4, color: this.color, alpha: 1 });
  }

  /** `phase` is 0..1 through the pulse. Reduced motion pulses opacity only. */
  pulse(phase: number, scaleAmount: number, reduced: boolean): void {
    if (!this.rect) return;
    const wave = 0.5 - 0.5 * Math.cos(phase * 2 * Math.PI);
    this.node.alpha = 0.55 + 0.45 * wave;
    this.node.scale.set(reduced ? 1 : 1 + scaleAmount * wave);
  }
}

interface GlassNode {
  container: Container;
  water: Graphics;
  current: Container;
  flash: Graphics;
  selectRing: Graphics;
  baseX: number;
  baseY: number;
  rimHeight: number;
}

interface IceNode {
  container: Container;
  text: Text;
  glass: number;
  slot: number;
  countdown: number;
  alpha: number;
  scale: number;
}

/** Everything the board draws. Positions come from the pure layout; rules never appear here. */
export class BoardScene {
  readonly root = new Container();
  private readonly staticLayer = new Container();
  private readonly glassLayer = new Container();
  private readonly overlay = new Container();
  private readonly hintGraphics = new Graphics();
  private readonly stream = new Graphics();
  private readonly cursor = new Graphics();
  private readonly glow = new Ring('#fde047');
  private readonly guide = new Ring(ACCENT);

  level!: Level;
  layout!: BoardLayout;
  private options!: BoardOptions;
  private glasses: GlassNode[] = [];
  private chips: { container: Container; halo: Graphics }[] = [];
  private tools: Partial<Record<ToolName, Container>> = {};
  private ice: IceNode[] = [];
  private waterDisplay: number[] = [];
  private ringPos: Pos[] = [];
  private found: boolean[] = [];

  constructor() {
    this.overlay.addChild(this.stream, this.hintGraphics, this.glow.node, this.guide.node);
    this.root.addChild(this.staticLayer, this.glassLayer, this.overlay);
  }

  build(
    level: Level,
    layout: BoardLayout,
    state: State,
    found: readonly boolean[],
    options: BoardOptions,
  ): void {
    this.level = level;
    this.layout = layout;
    this.options = options;
    for (const layer of [this.staticLayer, this.glassLayer]) {
      for (const child of layer.removeChildren()) child.destroy({ children: true });
    }
    this.glasses = [];
    this.chips = [];
    this.tools = {};
    this.ice = [];
    this.stream.clear();
    this.hintGraphics.clear();
    this.buildMelodyBar();
    this.buildTools();
    for (let i = 0; i < layout.glasses.length; i++) this.buildGlass(i);
    for (const cube of level.ice) this.buildIce(cube.index, cube.glass);
    this.setState(state);
    this.setFound(found);
  }

  // --- static parts -----------------------------------------------------------------------------

  private buildMelodyBar(): void {
    const { melodyBar, melodyNotes } = this.layout;
    const bar = new Graphics();
    bar
      .roundRect(melodyBar.x, melodyBar.y, melodyBar.width, melodyBar.height, 14)
      .fill({ color: '#ffffff', alpha: 0.1 });
    this.staticLayer.addChild(bar);
    melodyNotes.forEach((rect, i) => {
      const pos = this.level.positions[this.level.melody.notes[i] ?? 0];
      if (!pos) return;
      const style = noteStyle(pos.pitchClass, pos.octave);
      const text = noteLabel(pos, this.options.labels);
      const container = new Container();
      container.position.set(rect.x + rect.width / 2, rect.y + rect.height / 2);
      const halo = new Graphics();
      halo.circle(0, 0, 21).fill({ color: '#ffffff', alpha: 0.2 });
      const glyph = new Graphics();
      drawGlyph(glyph, style.glyph, 20, style.color, style.hollow, style.octaveDots);
      if (text) {
        glyph.y = -7;
        const caption = label(text, 11);
        caption.y = 14;
        container.addChild(halo, glyph, caption);
      } else {
        container.addChild(halo, glyph);
      }
      this.staticLayer.addChild(container);
      this.chips.push({ container, halo });
    });
    this.cursor.clear();
    this.staticLayer.addChild(this.cursor);
  }

  private buildTools(): void {
    const specs: [ToolName, Rect | undefined][] = [
      ['faucet', this.layout.tools.faucet],
      ['sink', this.layout.tools.sink],
    ];
    for (const [tool, rect] of specs) {
      if (!rect) continue;
      const container = new Container();
      container.position.set(rect.x, rect.y);
      const g = new Graphics();
      g.roundRect(0, 0, rect.width, rect.height, 16).fill({ color: '#ffffff', alpha: 0.12 });
      if (tool === 'faucet') {
        // A tap: pipe, spout and a drop.
        g.rect(rect.width * 0.2, rect.height * 0.25, rect.width * 0.6, rect.height * 0.14).fill('#cbd5e1');
        g.rect(rect.width * 0.62, rect.height * 0.25, rect.width * 0.14, rect.height * 0.3).fill('#cbd5e1');
        g.circle(rect.width * 0.69, rect.height * 0.72, rect.width * 0.08).fill(ACCENT);
      } else {
        // A basin with a drain.
        g.roundRect(rect.width * 0.18, rect.height * 0.3, rect.width * 0.64, rect.height * 0.36, 8).fill(
          '#cbd5e1',
        );
        g.circle(rect.width * 0.5, rect.height * 0.48, rect.width * 0.07).fill('#334155');
        g.rect(rect.width * 0.46, rect.height * 0.66, rect.width * 0.08, rect.height * 0.16).fill('#cbd5e1');
      }
      container.addChild(g);
      this.staticLayer.addChild(container);
      this.tools[tool] = container;
    }
  }

  private buildGlass(index: number): void {
    const glass = this.level.glasses[index];
    const spec = this.layout.glasses[index];
    if (!glass || !spec) return;
    const { body } = spec;
    const container = new Container();
    const baseX = body.x + body.width / 2;
    const baseY = body.y + body.height;
    container.position.set(baseX, baseY);

    const outline = new Graphics();
    outline
      .roundRect(-body.width / 2, -body.height, body.width, body.height, 6)
      .fill({ color: '#ffffff', alpha: 0.08 })
      .stroke({ width: 3, color: '#ffffff', alpha: 0.9 });
    const water = new Graphics();

    const marks = new Container();
    const targets = new Set(this.level.targets);
    for (let w = 0; w <= glass.capacity; w++) {
      const pos = this.level.positions[glass.emptyPos - w];
      const y = (spec.fillLineY[w] ?? baseY) - baseY;
      if (!pos) continue;
      const style = noteStyle(pos.pitchClass, pos.octave);
      const isTarget = targets.has(pos.pos);
      const mark = new Graphics();
      const size = isTarget ? 14 : 9;
      drawGlyph(
        mark,
        style.glyph,
        size,
        style.color,
        style.hollow,
        isTarget ? style.octaveDots : 0,
        isTarget ? 1 : 0.45,
      );
      if (isTarget) mark.circle(0, 0, size * 0.85).stroke({ width: 1.5, color: '#ffffff', alpha: 0.8 });
      mark.position.set(-body.width / 2 + 12, y);
      marks.addChild(mark);
      const text = isTarget ? noteLabel(pos, this.options.labels) : '';
      if (text) {
        const caption = label(text, 10);
        caption.position.set(-body.width / 2 + 30, y);
        marks.addChild(caption);
      }
    }

    const current = new Container();
    current.position.set(0, -body.height - 14);
    const flash = new Graphics();
    flash
      .roundRect(-body.width / 2, -body.height, body.width, body.height, 6)
      .stroke({ width: 4, color: '#f87171' });
    flash.alpha = 0;
    const selectRing = new Graphics();
    selectRing
      .roundRect(-body.width / 2 - 4, -body.height - 4, body.width + 8, body.height + 8, 10)
      .stroke({ width: 5, color: ACCENT });
    selectRing.alpha = 0;

    container.addChild(water, outline, marks, current, flash, selectRing);
    this.glassLayer.addChild(container);
    this.glasses[index] = {
      container,
      water,
      current,
      flash,
      selectRing,
      baseX,
      baseY,
      rimHeight: body.height,
    };
  }

  private buildIce(index: number, glass: number): void {
    const cube = this.level.ice[index];
    if (!cube) return;
    const slot = this.level.ice.filter((c) => c.glass === glass && c.index < index).length;
    const container = new Container();
    const g = new Graphics();
    g.roundRect(-ICE_SIZE / 2, -ICE_SIZE / 2, ICE_SIZE, ICE_SIZE, 6).fill({ color: '#e0f2fe', alpha: 0.75 });
    g.roundRect(-ICE_SIZE / 2, -ICE_SIZE / 2, ICE_SIZE, ICE_SIZE, 6).stroke({ width: 2, color: '#7dd3fc' });
    const text = label(String(cube.startCountdown), 14, '#0c4a6e');
    container.addChild(g, text);
    this.glassLayer.addChild(container);
    this.ice[index] = { container, text, glass, slot, countdown: cube.startCountdown, alpha: 1, scale: 1 };
  }

  // --- state ------------------------------------------------------------------------------------

  /** Shows an exact board state instantly. */
  setState(state: State): void {
    this.waterDisplay = [...state.water];
    this.ringPos = this.level.glasses.map((g, i) => g.emptyPos - (state.water[i] ?? 0));
    this.level.glasses.forEach((_, i) => {
      this.drawWater(i);
      this.drawCurrentNote(i);
    });
    this.level.ice.forEach((_, i) => {
      const node = this.ice[i];
      if (node) {
        node.countdown = state.ice[i] ?? 0;
        node.alpha = 1;
        node.scale = 1;
      }
      this.placeIce(i);
    });
  }

  setWater(glass: number, units: number): void {
    this.waterDisplay[glass] = units;
    this.drawWater(glass);
    this.level.ice.forEach((cube) => {
      if (cube.glass === glass) this.placeIce(cube.index);
    });
  }

  setRingPos(glass: number, pos: Pos): void {
    this.ringPos[glass] = pos;
    this.drawCurrentNote(glass);
  }

  setIce(index: number, countdown: number, alpha: number, scale: number): void {
    const node = this.ice[index];
    if (!node) return;
    node.countdown = countdown;
    node.alpha = alpha;
    node.scale = scale;
    this.placeIce(index);
  }

  private drawWater(index: number): void {
    const node = this.glasses[index];
    const spec = this.layout.glasses[index];
    if (!node || !spec) return;
    node.water.clear();
    const units = Math.max(0, this.waterDisplay[index] ?? 0);
    if (units <= 0) return;
    const pos = this.level.positions[this.ringPos[index] ?? 0];
    const color = pos ? noteStyle(pos.pitchClass, pos.octave).color : ACCENT;
    const floor = (spec.fillLineY[0] ?? node.baseY) - node.baseY;
    const height = units * this.layout.unit;
    node.water
      .rect(-spec.body.width / 2 + 4, floor - height, spec.body.width - 8, height)
      .fill({ color, alpha: 0.85 });
  }

  private drawCurrentNote(index: number): void {
    const node = this.glasses[index];
    if (!node) return;
    for (const child of node.current.removeChildren()) child.destroy({ children: true });
    const pos = this.level.positions[this.ringPos[index] ?? 0];
    if (!pos) return;
    const style = noteStyle(pos.pitchClass, pos.octave);
    const glyph = new Graphics();
    drawGlyph(glyph, style.glyph, 20, style.color, style.hollow, style.octaveDots);
    node.current.addChild(glyph);
    const text = noteLabel(pos, this.options.labels);
    if (text) {
      glyph.y = -6;
      const caption = label(text, 11);
      caption.y = 14;
      node.current.addChild(caption);
    }
  }

  private placeIce(index: number): void {
    const node = this.ice[index];
    const glass = node && this.glasses[node.glass];
    const spec = node && this.layout.glasses[node.glass];
    if (!node || !glass || !spec) return;
    const count = this.level.ice.filter((c) => c.glass === node.glass).length;
    const surface =
      (spec.fillLineY[0] ?? glass.baseY) - (this.waterDisplay[node.glass] ?? 0) * this.layout.unit;
    // fillLineY is in page coordinates, and ice lives in the page-coordinate glass layer.
    const lift = glass.container.y - glass.baseY;
    node.container.position.set(
      glass.baseX + (node.slot - (count - 1) / 2) * (ICE_SIZE + 4),
      surface - ICE_SIZE / 2 - 2 + lift,
    );
    node.text.text = String(node.countdown);
    node.container.visible = node.countdown > 0 || node.alpha > 0;
    node.container.alpha = node.alpha;
    node.container.scale.set(node.scale);
  }

  setFound(found: readonly boolean[]): void {
    this.found = [...found];
    this.level.melody.targetIndex.forEach((target, i) => {
      const chip = this.chips[i];
      if (!chip) return;
      const isFound = this.found[target] === true;
      chip.container.alpha = isFound ? 1 : 0.35;
      chip.halo.visible = isFound;
    });
  }

  setCursor(noteIndex: number | null): void {
    this.cursor.clear();
    if (noteIndex === null) return;
    const rect = this.layout.melodyNotes[noteIndex];
    if (!rect) return;
    this.cursor.roundRect(rect.x, rect.y + rect.height - 4, rect.width, 4, 2).fill({ color: ACCENT });
  }

  // --- per-glass visuals -----------------------------------------------------------------------

  setSelected(selected: number | null, reducedMotion: boolean): void {
    this.glasses.forEach((node, i) => {
      const on = i === selected;
      node.container.y = node.baseY - (on && !reducedMotion ? LIFT : 0);
      node.selectRing.alpha = on && reducedMotion ? 1 : 0;
    });
    for (const cube of this.level.ice) this.placeIce(cube.index);
  }

  setShake(glass: number, offsetX: number): void {
    const node = this.glasses[glass];
    if (node) node.container.x = node.baseX + offsetX;
  }

  setFlash(glass: number, alpha: number): void {
    const node = this.glasses[glass];
    if (node) node.flash.alpha = alpha;
  }

  setTilt(glass: number, radians: number): void {
    const node = this.glasses[glass];
    if (node) node.container.rotation = radians;
  }

  /** A thin stream of water between two glasses (skipped in low-effects mode). */
  setStream(from: number | null, to: number | null, color: string | null): void {
    this.stream.clear();
    if (color === null || to === null) return;
    const target = this.layout.glasses[to];
    const source = from === null ? null : this.layout.glasses[from];
    if (!target) return;
    const top = Math.min(source?.body.y ?? target.body.y, target.body.y) - 12;
    const surface = (target.fillLineY[0] ?? 0) - (this.waterDisplay[to] ?? 0) * this.layout.unit;
    const x = target.body.x + target.body.width / 2;
    this.stream.rect(x - 2, top, 4, Math.max(0, surface - top)).fill({ color, alpha: 0.8 });
  }

  glassColor(index: number): string {
    const pos = this.level.positions[this.ringPos[index] ?? 0];
    return pos ? noteStyle(pos.pitchClass, pos.octave).color : ACCENT;
  }

  // --- overlays ---------------------------------------------------------------------------------

  setHint(move: Move | null): void {
    const g = this.hintGraphics;
    g.clear();
    if (!move) return;
    const mark = (rect: Rect) =>
      g
        .roundRect(rect.x - 4, rect.y - 4, rect.width + 8, rect.height + 8, 12)
        .stroke({ width: 4, color: ACCENT });
    if (move.type === 'pour') {
      const a = this.layout.glasses[move.from]?.body;
      const b = this.layout.glasses[move.to]?.body;
      if (!a || !b) return;
      const ay = a.y - 30;
      const by = b.y - 30;
      const ax = a.x + a.width / 2;
      const bx = b.x + b.width / 2;
      const dir = bx > ax ? 1 : -1;
      g.moveTo(ax, ay).lineTo(bx, by).stroke({ width: 5, color: ACCENT });
      g.poly([bx, by, bx - dir * 14, by - 9, bx - dir * 14, by + 9]).fill({ color: ACCENT });
    } else {
      const body = this.layout.glasses[move.glass]?.body;
      const tool = this.layout.tools[move.type];
      if (body) mark(body);
      if (tool) mark(tool);
    }
  }

  setGlowRect(glass: number | null): void {
    this.glow.set(glass === null ? null : (this.layout.glasses[glass]?.body ?? null));
  }

  setGuideTarget(target: { glass?: number; melody?: boolean; tool?: ToolName } | null): void {
    let rect: Rect | null = null;
    if (target?.glass !== undefined) rect = this.layout.glasses[target.glass]?.body ?? null;
    else if (target?.melody) rect = this.layout.melodyBar;
    else if (target?.tool) rect = this.layout.tools[target.tool] ?? null;
    this.guide.set(rect);
  }

  setLocked(locked: boolean): void {
    for (const tool of Object.values(this.tools)) tool.alpha = locked ? 0.4 : 1;
  }

  /** Called every frame. `glowPeriod` is seconds per beat, or null when nothing glows. */
  pulse(nowMs: number, glowPeriod: number | null, reducedMotion: boolean): void {
    if (glowPeriod !== null) this.glow.pulse((nowMs / 1000 / glowPeriod) % 1, 0.06, reducedMotion);
    this.guide.pulse((nowMs / 1000) % 1, 0.04, reducedMotion);
  }
}
