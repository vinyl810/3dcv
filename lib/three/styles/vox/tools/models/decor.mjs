// Island decor props. Writes three files:
//   decor.vox    — authored props laid out side by side (one named part each)
//   cc0trees.vox — two CC0 trees by padadu (itch.io "Voxel Pack 02 - Nature",
//                  CC0 1.0), recoloured into our palette by a lighting-band pass
//   bird.vox     — a tiny bird (body + two wing parts) for the flock
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Assembly, Grid, hash, readVoxGrid } from '../voxlib.mjs';
import { C, G } from '../palette.mjs';

export const name = 'decor';
const here = dirname(fileURLToPath(import.meta.url));

// Sun-ish light direction for baked colour bands (up, a little toward camera).
const L = (() => { const v = [0.35, 1, 0.5]; const n = Math.hypot(...v); return v.map((a) => a / n); })();

/** Pick a ramp colour from a fake-lit value: v = dot(normalised offset, L) (+ noise). */
function lit(ramp, lo, hi, x, y, z, cx, cy, cz, rx, ry, rz, noise = 0.18, seed = 0) {
  const v = ((x - cx) / rx) * L[0] + ((y - cy) / ry) * L[1] + ((z - cz) / rz) * L[2] + (hash(x, y, z, seed) - 0.5) * noise;
  const f = Math.max(0, Math.min(0.999, (v + 0.95) / 1.9));
  return ramp[lo + Math.floor(f * (hi - lo + 1))];
}

// ------------------------------------------------------------- authored ---
function treeRound(g, ox, oz, ramp, seed) {
  const cx = ox + 7, cz = oz + 7;
  // trunk + root flare
  g.box(cx - 1, 0, cz - 1, cx + 1, 9, cz + 1, (x, y, z) => (x === cx - 1 || z === cz - 1 ? C.wood[2] : C.wood[3]));
  g.box(cx - 2, 0, cz, cx + 2, 0, cz, C.wood[2]);
  g.box(cx, 0, cz - 2, cx, 0, cz + 2, C.wood[2]);
  g.set(cx + 2, 6, cz, C.wood[3]); g.set(cx + 3, 7, cz, C.wood[3]); // little branch
  // canopy: main blob + crown + side puffs
  const puffs = [[0, 12, 0, 6.6, 4.8, 6.6], [1, 16, -1, 4.8, 3.6, 4.8], [-4, 11, 2, 3.4, 3, 3.4], [4, 11, 3, 3.2, 2.8, 3.2], [2, 13, -4, 3.4, 3, 3]];
  for (const [dx, cy, dz, rx, ry, rz] of puffs)
    g.ellipsoid(cx + dx, cy, cz + dz, rx, ry, rz, (x, y, z) => lit(ramp, 1, 6, x, y, z, cx, 13, cz, 7, 6, 7, 0.22, seed));
  return g;
}

function pine(g, ox, oz) {
  const cx = ox + 6, cz = oz + 6;
  g.box(cx - 1, 0, cz - 1, cx, 5, cz, (x, y, z) => (x === cx - 1 ? C.wood[2] : C.wood[3]));
  const tiers = [[4, 9, 6], [8, 13, 4.8], [12, 17, 3.6], [16, 20, 2.3]];
  for (const [y0, y1, r0] of tiers)
    for (let y = y0; y <= y1; y++) {
      const r = r0 * (1 - (y - y0) / (y1 - y0 + 1.2)) + 0.6;
      g.cylY(cx - 0.5, cz - 0.5, y, y, r, (x, yy, z) => lit(C.leaf, 0, 5, x, yy, z, cx - 0.5, 12, cz - 0.5, 6, 9, 6, 0.2, 5));
    }
  g.set(cx - 1, 21, cz - 1, C.leaf[5]);
  return g;
}

function bush(g, ox, oz, s, berries) {
  const cx = ox + 5, cz = oz + 5;
  g.ellipsoid(cx, 1.5, cz, 4.2 * s, 3 * s, 3.6 * s, (x, y, z) => lit(C.grass, 2, 6, x, y, z, cx, 1.5, cz, 4, 3, 4, 0.25, 7));
  g.ellipsoid(cx + 2 * s, 2.5, cz - 1, 2.6 * s, 2.4 * s, 2.4 * s, (x, y, z) => lit(C.grass, 2, 6, x, y, z, cx, 1.5, cz, 4, 3, 4, 0.25, 7));
  g.paint((x, y, z, c) => (y < 0 ? 0 : c));
  if (berries) for (let i = 0; i < 7; i++) {
    const x = cx + Math.round((hash(i, 1, 0, 8) - 0.5) * 7 * s), z = cz + Math.round((hash(i, 2, 0, 8) - 0.5) * 6 * s);
    for (let y = 6; y >= 0; y--) if (g.get(x, y, z)) { g.set(x, y + 1, z, i % 2 ? C.red[5] : C.pink[6]); break; }
  }
  return g;
}

function rock(g, ox, oz, w, h, d, mossy) {
  const x0 = ox + 1, z0 = oz + 1;
  g.box(x0, 0, z0, x0 + w - 1, h - 1, z0 + d - 1, (x, y, z) => lit(C.rock, 2, 6, x, y, z, x0 + w / 2, h / 2, z0 + d / 2, w / 2, h, d / 2, 0.15, 9));
  // bevel: knock off top corners/edges
  for (const x of [x0, x0 + w - 1]) for (const z of [z0, z0 + d - 1]) { g.set(x, h - 1, z, 0); if (h > 3) g.set(x, h - 2, z, 0); }
  g.box(x0 + 1, h, z0 + 1, x0 + w - 3, h, z0 + d - 2, (x, y, z) => lit(C.rock, 3, 7, x, y, z, x0 + w / 2, h / 2, z0 + d / 2, w / 2, h, d / 2, 0.15, 9));
  if (mossy) g.paint((x, y, z, c) => (y >= h - 1 && g.isTop(x, y, z) && hash(x, y, z, 12) < 0.55 ? (hash(x, z, 1, 13) < 0.5 ? C.grass[4] : C.grass[5]) : c));
  return g;
}

function flowers(g, ox, oz, ramp, seed) {
  const pts = [[1, 1], [3, 0], [2, 3], [4, 2], [0, 4], [4, 5], [2, 5]];
  pts.forEach(([dx, dz], i) => {
    const x = ox + dx + 1, z = oz + dz + 1;
    const h = 1 + Math.floor(hash(i, seed, 0, 14) * 2.2);
    g.box(x, 0, z, x, h - 1, z, C.grass[3]);
    if (i % 3 === 0) g.set(x + 1, 0, z, C.grass[4]); // leaf
    g.set(x, h, z, ramp[5]);
    if (i % 2 === 0) { g.set(x, h + 1, z, ramp[6]); }
    else g.set(x, h, z, C.gold[6]); // flower centre peeks
    if (i % 2 === 0) g.set(x + (i % 4 === 0 ? 1 : -1), h, z, ramp[4]);
  });
  return g;
}

function mushrooms(g, ox, oz) {
  const m = (x, z, h, r) => {
    g.box(x, 0, z, x, h - 1, z, C.sand[6]);
    g.cylY(x, z, h, h, r, C.red[4]);
    g.cylY(x, z, h + 1, h + 1, r - 0.8, C.red[5]);
    g.set(x + 1, h + 1, z, C.sand[7]); g.set(x - 1, h, z + 1, C.sand[7]);
  };
  m(ox + 2, oz + 2, 3, 2.2);
  m(ox + 5, oz + 4, 2, 1.5);
  return g;
}

function lantern(g, ox, oz) {
  const x = ox + 2, z = oz + 2;
  g.box(x - 1, 0, z - 1, x + 1, 0, z + 1, C.rock[3]);
  g.box(x, 1, z, x, 6, z, C.wood[2]);
  // head: 4 dark corner posts around a glowing core
  for (const dx of [-1, 1]) for (const dz of [-1, 1]) g.box(x + dx, 7, z + dz, x + dx, 9, z + dz, C.rock[1]);
  g.box(x - 1, 7, z, x + 1, 9, z, G.lamp);
  g.box(x, 7, z - 1, x, 9, z + 1, G.lamp);
  g.set(x, 8, z, G.hot);
  g.box(x - 1, 10, z - 1, x + 1, 10, z + 1, C.rock[1]);
  g.set(x, 11, z, C.rock[2]);
  return g;
}

function streetLamp(g, ox, oz) {
  const x = ox + 2, z = oz + 2;
  g.box(x - 1, 0, z - 1, x + 1, 1, z + 1, C.rock[2]);
  g.box(x, 2, z, x, 22, z, C.rock[2]);
  g.box(x - 1, 9, z - 1, x + 1, 9, z + 1, C.rock[4]); // collar
  g.box(x, 23, z, x, 23, z + 4, C.rock[2]); // arm toward +z
  g.box(x, 22, z + 4, x, 22, z + 4, C.rock[2]);
  // hanging lamp
  g.box(x - 1, 21, z + 3, x + 1, 21, z + 5, C.rock[1]); // cap
  g.box(x - 1, 18, z + 3, x + 1, 20, z + 5, G.lamp);
  g.set(x, 19, z + 4, G.hot);
  for (const dx of [-1, 1]) for (const dz of [3, 5]) g.box(x + dx, 18, z + dz, x + dx, 20, z + dz, C.rock[1]);
  g.box(x, 17, z + 4, x, 17, z + 4, C.rock[1]);
  return g;
}

function tuft(g, ox, oz, seed) {
  const pts = [[0, 0, 2], [1, 1, 1], [2, 0, 1], [1, -1, 2], [3, 1, 1]];
  pts.forEach(([dx, dz, h], i) => {
    if (hash(i, seed, 0, 17) < 0.2) return;
    g.box(ox + 1 + dx, 0, oz + 2 + dz, ox + 1 + dx, h - 1, oz + 2 + dz, h > 1 ? C.grass[5] : C.grass[4]);
    if (h > 1) g.set(ox + 1 + dx, h - 1, oz + 2 + dz, C.grass[6]);
  });
  return g;
}

function islet(g, ox, oz, r, depth, seed) {
  const cx = ox + r + 1, cz = oz + r + 1;
  for (let k = 0; k <= depth; k++) {
    const rr = (r + 0.4) * (1 - Math.pow(k / (depth + 1), 1.2)) + (hash(k, seed, 0, 18) - 0.5) * 0.8;
    const y = depth - k;
    g.cylY(cx, cz, y, y, Math.max(0.6, rr), (x, yy, z) => {
      if (k === 0) return hash(x, z, 0, seed) < 0.7 ? C.grass[4] : C.grass[5];
      if (k === 1) return C.earth[4];
      return k < depth * 0.5 ? (hash(x, yy, z, 19) < 0.5 ? C.earth[3] : C.earth[2]) : C.rock[2];
    });
  }
  // little tuft on top
  g.set(cx, depth + 1, cz, C.grass[5]); g.set(cx + 1, depth + 1, cz - 1, C.grass[6]);
  return g;
}

function sign(g, ox, oz) {
  const x = ox + 3, z = oz + 2;
  g.box(x, 0, z, x, 8, z, C.wood[3]);
  g.box(x - 3, 6, z + 1, x + 3, 7, z + 1, C.wood[5]); // board pointing right (arrow)
  g.set(x + 4, 6, z + 1, C.wood[5]); g.set(x + 4, 7, z + 1, C.wood[5]);
  g.box(x - 2, 6, z + 2, x + 2, 6, z + 2, C.wood[6]);
  g.box(x - 4, 3, z + 1, x + 2, 4, z + 1, C.wood[4]); // second board pointing left
  g.set(x - 4, 3, z + 1, 0); g.set(x - 5, 3, z + 1, C.wood[4]); g.set(x - 5, 4, z + 1, 0);
  return g;
}

function buildDecor() {
  const A = new Assembly(200, 30, 20);
  const spots = [];
  let ox = 0;
  const add = (pname, w, fn) => { const g = A.part(pname); fn(g, ox, 2); spots.push(pname); ox += w + 2; };
  add('tree_round', 15, (g, x, z) => treeRound(g, x, z, C.leaf, 3));
  add('tree_blossom', 15, (g, x, z) => treeRound(g, x, z, C.pink, 4));
  add('pine', 12, (g, x, z) => pine(g, x, z));
  add('bush', 10, (g, x, z) => bush(g, x, z, 1, false));
  add('bush_berry', 9, (g, x, z) => bush(g, x, z, 0.8, true));
  add('rock_big', 9, (g, x, z) => rock(g, x, z, 7, 4, 6, true));
  add('rock_small', 6, (g, x, z) => rock(g, x, z, 4, 3, 4, false));
  add('flowers_pink', 7, (g, x, z) => flowers(g, x, z, C.pink, 1));
  add('flowers_gold', 7, (g, x, z) => flowers(g, x, z, C.gold, 2));
  add('flowers_violet', 7, (g, x, z) => flowers(g, x, z, C.violet, 3));
  add('mushrooms', 7, (g, x, z) => mushrooms(g, x, z));
  add('lantern', 5, (g, x, z) => lantern(g, x, z));
  add('streetlamp', 5, (g, x, z) => streetLamp(g, x, z));
  add('tuft', 5, (g, x, z) => tuft(g, x, z, 1));
  add('sign', 9, (g, x, z) => sign(g, x, z));
  add('islet_a', 10, (g, x, z) => islet(g, x, z, 4, 7, 1));
  add('islet_b', 8, (g, x, z) => islet(g, x, z, 3, 5, 2));
  const pivots = Object.fromEntries(spots.map((s) => [s, 'bottom']));
  return { name: 'decor', assembly: A, pivots, glow: { [G.lamp]: 0.6, [G.hot]: 0.8 } };
}

// ------------------------------------------------------- CC0 recolour ---
function recolourTree(src, trunkMaxW, ramp, lo, hi, seed) {
  const g = readVoxGrid(src);
  // trunk = rows below the first row wider than trunkMaxW voxels
  let canopyY = 0;
  for (let y = 0; y < g.h; y++) {
    let x0 = 1e9, x1 = -1;
    for (let z = 0; z < g.d; z++) for (let x = 0; x < g.w; x++) if (g.get(x, y, z)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
    if (x1 - x0 + 1 > trunkMaxW) { canopyY = y; break; }
  }
  let cx = 0, cy = 0, cz = 0, n = 0;
  g.paint((x, y, z, c) => { if (y >= canopyY) { cx += x; cy += y; cz += z; n++; } return c; });
  cx /= n; cy /= n; cz /= n;
  const rx = g.w / 2, ry = (g.h - canopyY) / 2, rz = g.d / 2;
  g.paint((x, y, z) => {
    if (y < canopyY) return lit(C.wood, 2, 4, x, y, z, cx, cy, cz, 2, 8, 2, 0.1, seed);
    return lit(ramp, lo, hi, x, y, z, cx, cy, cz, rx, ry, rz, 0.24, seed);
  });
  return g;
}

function buildCC0() {
  const A = new Assembly(80, 40, 40);
  const oak = recolourTree(join(here, '../cc0/padadu_huge_tree_32.vox'), 5, C.leaf, 1, 7, 21);
  const pn = recolourTree(join(here, '../cc0/padadu_tree1_32.vox'), 4, C.grass, 0, 5, 22);
  A.part('oak').stamp(oak, 0, 0, 2);
  A.part('pine_tall').stamp(pn, 40, 0, 2);
  return { name: 'cc0trees', assembly: A, hollow: true, pivots: { oak: 'bottom', pine_tall: 'bottom' } };
}

// ---------------------------------------------------------------- bird ---
function buildBird() {
  const A = new Assembly(9, 5, 7);
  const b = A.part('body');
  b.box(3, 1, 1, 5, 2, 5, (x, y, z) => (y === 2 ? C.sand[6] : C.sand[4]));
  b.box(4, 3, 4, 4, 3, 5, C.sand[6]); // head
  b.set(4, 3, 6, C.gold[5]); // beak
  b.set(4, 1, 0, C.rock[3]); // tail
  const wl = A.part('wingL');
  wl.box(0, 2, 2, 2, 2, 4, (x) => (x === 0 ? C.rock[4] : C.sand[5]));
  const wr = A.part('wingR');
  wr.box(6, 2, 2, 8, 2, 4, (x) => (x === 8 ? C.rock[4] : C.sand[5]));
  return { name: 'bird', assembly: A, origin: [4.5, 2, 3.5], pivots: { body: [4.5, 2, 3.5], wingL: [3, 2.5, 3.5], wingR: [6, 2.5, 3.5] } };
}

export function buildAll() {
  return [buildDecor(), buildCC0(), buildBird()];
}
export function build() { return buildDecor(); }
// silence unused-import lint in editors
void Grid;
