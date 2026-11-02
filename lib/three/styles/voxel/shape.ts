import { V, noise2 } from './vox';

/**
 * Plan-view shape of the voxel island, shared by the terrain (island.ts) and
 * the water ring / waterfalls (ocean.ts) so they always agree. All radii are in
 * WORLD units, measured with a rounded-square (superellipse) norm so the island
 * keeps the classic diamond-on-screen silhouette but with an irregular edge.
 *
 *   grass plateau  (top y = 0.5, flat over |x|,|z| <= 6.5 guaranteed)
 *   sand beach     (two steps down)
 *   water moat     (ring of voxel water, held by…)
 *   rock rim lip   (notched where the waterfalls spill)
 *   floating rock  (tapers to a point below)
 */

const P_NORM = 5;
export function norm(x: number, z: number): number {
  return (Math.abs(x) ** P_NORM + Math.abs(z) ** P_NORM) ** (1 / P_NORM);
}

/** Smooth edge wobble in [-1, 1] (low frequency → organic, not noisy). */
function wob(x: number, z: number, salt: number, freq = 0.42): number {
  return (noise2(x * freq + 50, z * freq + 50, salt) - 0.5) * 2;
}

export const rGrass = (x: number, z: number) => 7.95 + 0.38 * wob(x, z, 1);
export const rSand = (x: number, z: number) => rGrass(x, z) + 0.62 + 0.22 * wob(x, z, 2, 0.8);
export const rRim = (x: number, z: number) => 10.05 + 0.45 * wob(x, z, 3, 0.35);
export const rOuter = (x: number, z: number) => rRim(x, z) + 0.42 + 0.2 * wob(x, z, 4, 0.9);

/** Waterfall spill points: polar angle (rad) + half-width of the notch (world). */
export const FALLS: { a: number; half: number }[] = [
  { a: 0.18, half: 0.5 }, // +X side (screen bottom-right)
  { a: Math.PI / 2 + 0.42, half: 0.44 }, // +Z side (screen bottom-left)
  { a: Math.PI + 0.62, half: 0.4 }, // back (-X) — peeks past the top-left
];

/** Index of the fall whose notch contains (x,z) (by arc distance), else -1. */
export function fallAt(x: number, z: number): number {
  const a = Math.atan2(z, x);
  const d = Math.hypot(x, z);
  for (let i = 0; i < FALLS.length; i++) {
    let da = a - FALLS[i].a;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    if (Math.abs(da) * d < FALLS[i].half) return i;
  }
  return -1;
}

/**
 * Radius (world) of the floating rock at a depth below the surface (world,
 * positive downward). Near-vertical cliff for the first ~1.3 units, then a
 * stepped, concave taper to a point at ~12.5. `k` = the column's outer radius.
 */
export function rockRadius(depth: number, k: number): number {
  if (depth < 1.3) return k - depth * 0.12;
  const f = (depth - 1.3) / 11.2;
  if (f >= 1) return 0;
  return (k - 0.16) * Math.pow(1 - f, 1.35);
}

/** World-voxel helpers. */
export const toW = (i: number) => i * V;
export const toI = (w: number) => Math.round(w / V);
