import * as THREE from 'three';
import { GRADIENT, color } from '../../kit';

/**
 * Organic island outline shared by the island (grass/beach/rim/underside) and
 * the ocean (lagoon ring + waterfalls). Everything is a deterministic function
 * of the polar angle θ (x = r·cosθ, z = r·sinθ).
 */

export const NA = 120; // angular resolution of every ring mesh

/** Chebyshev square the flat grass must always cover (|x|,|z| <= 6.9). */
const SQUARE = 6.95;

function lobes(a: number): number {
  return (
    0.42 * Math.sin(3 * a + 0.7) +
    0.28 * Math.sin(5 * a + 2.1) +
    0.16 * Math.sin(8 * a + 0.3) +
    0.1 * Math.sin(13 * a + 1.3)
  );
}

/** Radius of the grass edge at angle a. Always contains the |x|,|z|<=6.95 square. */
export function grassR(a: number): number {
  const c = Math.abs(Math.cos(a));
  const s = Math.abs(Math.sin(a));
  const sq = SQUARE / Math.max(c, s); // square boundary
  const n = 3.2; // superellipse power → soft rounded-square
  const se = 8.25 / Math.pow(Math.pow(c, n) + Math.pow(s, n), 1 / n);
  return Math.max(sq + 0.25, se + lobes(a));
}

/** Beach (sand) outer edge, where it dips under the water. */
export const beachR = (a: number) => grassR(a) + 0.95;

/** Lagoon width (water between the beach and the rock rim). */
export const LAGOON = 1.7;
export const rimInR = (a: number) => grassR(a) + LAGOON + 0.4 * Math.sin(4 * a + 1.1) * 0.5;
export const rimOutR = (a: number) => rimInR(a) + 0.55;

/** Sea surface height. */
export const SEA_Y = -0.08;
/** Rim top height. */
export const RIM_Y = 0.16;

/** Waterfall notches in the rim: centre angle + half-width (radians). */
export const FALLS: { a: number; half: number }[] = [
  { a: 0.1, half: 0.085 },
  { a: 1.28, half: 0.075 },
  { a: 2.75, half: 0.07 },
  { a: 4.75, half: 0.08 },
];

/** 0..1 how much angle a lies inside a waterfall notch (1 = centre). */
export function notch(a: number): number {
  let best = 0;
  for (const f of FALLS) {
    let d = Math.abs(((a - f.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    d /= f.half * 1.6;
    if (d < 1) best = Math.max(best, 1 - d * d);
  }
  return best;
}

export function hash(i: number, salt = 0): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export interface Row {
  r: (a: number, i: number) => number;
  y: (a: number, i: number) => number;
}

/**
 * Build a non-indexed ring strip mesh between consecutive rows (each row is a
 * closed loop of NA points). `faceCol(k, i)` gives the flat colour of the quad
 * between row k and k+1 at angular step i — per-face colours keep it crisp in
 * the pixel pass.
 */
export function ringStrip(
  rows: Row[],
  faceCol: (k: number, i: number, a: number) => THREE.Color,
  opts: { side?: THREE.Side; na?: number } = {},
): THREE.Mesh {
  const na = opts.na ?? NA;
  const pts: THREE.Vector3[][] = rows.map((row) => {
    const out: THREE.Vector3[] = [];
    for (let i = 0; i < na; i++) {
      const a = (i / na) * Math.PI * 2;
      const r = row.r(a, i);
      out.push(new THREE.Vector3(Math.cos(a) * r, row.y(a, i), Math.sin(a) * r));
    }
    return out;
  });
  const pos: number[] = [];
  const col: number[] = [];
  const push = (v: THREE.Vector3, c: THREE.Color) => {
    pos.push(v.x, v.y, v.z);
    col.push(c.r, c.g, c.b);
  };
  for (let k = 0; k < rows.length - 1; k++) {
    for (let i = 0; i < na; i++) {
      const j = (i + 1) % na;
      const a0 = pts[k][i], a1 = pts[k][j], b0 = pts[k + 1][i], b1 = pts[k + 1][j];
      const c = faceCol(k, i, (i / na) * Math.PI * 2);
      // winding so faces point outward/up for rows going outward/downward
      push(a0, c); push(a1, c); push(b0, c);
      push(a1, c); push(b1, c); push(b0, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: GRADIENT, side: opts.side ?? THREE.FrontSide });
  (m as THREE.Material as { flatShading?: boolean }).flatShading = true;
  return new THREE.Mesh(geo, m);
}

const _c = new THREE.Color();
/** Pick between a few shades with a smooth low-frequency field (patches, not noise). */
export function patchy(x: number, z: number, base: number, light: number, dark: number, seed = 0): THREE.Color {
  const f =
    Math.sin(x * 0.55 + seed) * Math.cos(z * 0.48 - seed * 0.7) +
    0.6 * Math.sin((x + z) * 0.9 + seed * 1.3) * Math.sin((x - z) * 0.7);
  if (f > 0.75) return _c.copy(color(light));
  if (f < -0.8) return _c.copy(color(dark));
  return _c.copy(color(base));
}
