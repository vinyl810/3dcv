import { vnoise } from './rkit';

/**
 * Shared island footprint for the refined style (terrain + water use the same
 * cell map). A rounded super-ellipse plateau with a wobbly coastline:
 *
 *   G grass plateau (top 0.5) → S sand step (0.2) → W lagoon ring (floor -0.25,
 *   water 0.05) → R rock lip (0.25) with a few N notches where the lagoon spills
 *   over as waterfalls.
 *
 * The plateau always covers |x|,|z| <= 6.5 (+ every landmark footprint).
 */

export const CELL = 0.5;
export const HALF_CELLS = 23; // grid covers ±11.5
export const GRASS_Y = 0.5;
export const SAND_Y = 0.2;
export const FLOOR_Y = -0.25;
export const WATER_Y = 0.05;
export const RIM_Y = 0.3;
export const NOTCH_Y = -0.1;

export type Cell = 0 | 'G' | 'S' | 'W' | 'R' | 'N';

const EXP = 3.2;
const A = 8.5; // plateau super-ellipse radius
const SAND_W = 0.5;
const WATER_W = 1.25;
const RIM_W = 0.6;
export const OUTER = A + SAND_W + WATER_W + RIM_W;

export function seNorm(x: number, z: number): number {
  return Math.pow(Math.pow(Math.abs(x), EXP) + Math.pow(Math.abs(z), EXP), 1 / EXP);
}

/** Coastline wobble (smooth, wraps around the angle). */
function wobble(x: number, z: number): number {
  const a = Math.atan2(z, x);
  return (vnoise(Math.cos(a) * 2.2 + 9, Math.sin(a) * 2.2 + 9, 3) - 0.5) * 0.6;
}

/** Waterfall notches: a point on the coast + outward axis ('x' | 'z'). */
export interface Notch {
  axis: 'x' | 'z';
  /** coordinate along the edge (z for an +x face, x for a +z face) */
  along: number;
  width: number;
}
// Only the two camera-facing faces (+x, +z) — their falls are visible.
export const NOTCHES: Notch[] = [
  { axis: 'z', along: -5.5, width: 1.0 }, // +z face, toward the left corner
  { axis: 'z', along: 3.5, width: 1.0 }, // +z face, right of the front tip
  { axis: 'x', along: -5.0, width: 1.0 }, // +x face, toward the right corner
];

function inNotch(x: number, z: number): boolean {
  for (const n of NOTCHES) {
    const along = n.axis === 'z' ? x : z;
    const out = n.axis === 'z' ? z : x;
    if (out > 0 && Math.abs(along - n.along) < n.width / 2) return true;
  }
  return false;
}

/** Classify the point (x, z) (use a cell centre). */
export function classify(x: number, z: number): Cell {
  const r = seNorm(x, z) - wobble(x, z);
  if (r <= A) return 'G';
  if (r <= A + SAND_W) return 'S';
  if (r <= A + SAND_W + WATER_W) return 'W';
  if (r <= OUTER) return inNotch(x, z) ? 'N' : 'R';
  return 0;
}

/** Normalised radial position 0 (centre) .. 1 (outer rim). */
export function radial01(x: number, z: number): number {
  return Math.min(1, (seNorm(x, z) - wobble(x, z)) / OUTER);
}

let cache: Cell[][] | null = null;
/** Cell map indexed [i][j] for i,j in 0..2*HALF_CELLS-1 (x = (i-HALF+0.5)*CELL). */
export function cellMap(): Cell[][] {
  if (cache) return cache;
  const n = HALF_CELLS * 2;
  const m: Cell[][] = [];
  for (let i = 0; i < n; i++) {
    const row: Cell[] = [];
    for (let j = 0; j < n; j++) row.push(classify(cx(i), cx(j)));
    m.push(row);
  }
  cache = m;
  return m;
}

/** Cell index → centre coordinate. */
export function cx(i: number): number {
  return (i - HALF_CELLS + 0.5) * CELL;
}

export function cellAt(m: Cell[][], i: number, j: number): Cell {
  if (i < 0 || j < 0 || i >= m.length || j >= m.length) return 0;
  return m[i][j];
}
