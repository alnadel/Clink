import type { Graphics } from 'pixi.js';
import type { GlyphShape } from '../../theme/notes';

function regular(sides: number, radius: number, rotation: number): number[] {
  const points: number[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = rotation + (i * 2 * Math.PI) / sides;
    points.push(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  return points;
}

function star(radius: number): number[] {
  const points: number[] = [];
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? radius * 1.1 : radius * 0.5;
    points.push(Math.cos(angle) * r, Math.sin(angle) * r);
  }
  return points;
}

/** The polygon of a glyph centred on (0, 0). Circles have no polygon. */
export function glyphPoints(shape: Exclude<GlyphShape, 'circle'>, radius: number): number[] {
  switch (shape) {
    case 'triangle':
      return regular(3, radius * 1.15, -Math.PI / 2);
    case 'square': {
      const s = radius * 0.9;
      return [-s, -s, s, -s, s, s, -s, s];
    }
    case 'pentagon':
      return regular(5, radius, -Math.PI / 2);
    case 'diamond':
      return [0, -radius * 1.15, radius * 0.85, 0, 0, radius * 1.15, -radius * 0.85, 0];
    case 'star':
      return star(radius);
    case 'hexagon':
      return regular(6, radius, 0);
  }
}

/**
 * Draws a note glyph centred on (0, 0): solid or hollow, with octave dots above (positive) or below
 * (negative). Colour and shape together identify a note without relying on colour (FR-29).
 */
export function drawGlyph(
  g: Graphics,
  shape: GlyphShape,
  size: number,
  color: string,
  hollow: boolean,
  octaveDots: number,
  alpha = 1,
): void {
  const radius = size / 2;
  if (shape === 'circle') g.circle(0, 0, radius);
  else g.poly(glyphPoints(shape, radius));
  if (hollow) g.stroke({ width: Math.max(2, size * 0.16), color, alpha });
  else g.fill({ color, alpha });

  const dotRadius = Math.max(1.5, size * 0.09);
  const direction = octaveDots > 0 ? -1 : 1;
  for (let i = 0; i < Math.abs(octaveDots); i++) {
    g.circle(0, direction * (radius + dotRadius + 2 + i * (dotRadius * 2 + 2)), dotRadius);
    g.fill({ color, alpha });
  }
}
