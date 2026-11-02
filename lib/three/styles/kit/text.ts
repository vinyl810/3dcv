import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Tiny blocky pixel font → ONE merged mesh (one draw call per label). Each lit
 * glyph cell is a little cube, so letters stay crisp through the pixel pass.
 */
const GLYPHS: Record<string, string[]> = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  K: ['#..#', '#.#.', '##..', '#.#.', '#..#'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  N: ['#..#', '##.#', '#.##', '#..#', '#..#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  L: ['#..', '#..', '#..', '#..', '###'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '2': ['##.', '..#', '.#.', '#..', '###'],
  '3': ['##.', '..#', '.#.', '..#', '##.'],
  '@': ['.##.', '#..#', '#.##', '#...', '.###'],
  ' ': ['..', '..', '..', '..', '..'],
};

/**
 * Build a pixel-text mesh centred on x, base at y=0, front face toward +Z.
 * `px` = cell size, `depth` = extrusion.
 */
export function pixelText(
  text: string,
  px: number,
  material: THREE.Material,
  depth = px,
): THREE.Mesh {
  const geos: THREE.BufferGeometry[] = [];
  const glyphs = [...text.toUpperCase()].map((ch) => GLYPHS[ch] ?? GLYPHS[' ']);
  const total = glyphs.reduce((w, g) => w + g[0].length + 1, -1);
  let cx = -total / 2;
  for (const g of glyphs) {
    const w = g[0].length;
    for (let row = 0; row < 5; row++) {
      for (let c = 0; c < w; c++) {
        if (g[row][c] !== '#') continue;
        const b = new THREE.BoxGeometry(px, px, depth);
        b.translate((cx + c + 0.5) * px, (4 - row + 0.5) * px, 0);
        geos.push(b);
      }
    }
    cx += w + 1;
  }
  const merged = mergeGeometries(geos, false)!;
  for (const g of geos) g.dispose();
  return new THREE.Mesh(merged, material);
}

/** Width of a pixel-text label in world units. */
export function pixelTextWidth(text: string, px: number): number {
  const glyphs = [...text.toUpperCase()].map((ch) => GLYPHS[ch] ?? GLYPHS[' ']);
  return glyphs.reduce((w, g) => w + g[0].length + 1, -1) * px;
}
