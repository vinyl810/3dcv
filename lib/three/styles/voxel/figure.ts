import { Grid } from './vox';

/**
 * Shared voxel humanoid (hub Daewon + involvement volunteers). Natural-ish
 * proportions (head ≈ 1/4 of height), no boxes: legs are separated columns,
 * the torso is stacked ellipse slices tapering to the waist with rounded
 * shoulders, the head is an ellipsoid with a rounded hair shell. Each body
 * section is drawn into a caller-supplied grid so callers can split parts for
 * animation (torso / head / eyes / arms on their own pivots).
 */

export interface FigureSpec {
  x: number; y: number; z: number; // feet origin (y = shoe layer)
  legH: number; // leg rows above the shoe
  legW: 1 | 2; // leg column width
  torsoH: number; // torso rows (waist → shoulders)
  waist: number; // torso half-width (x radius) at the waist
  shoulder: number; // torso half-width at the chest
  depth: number; // torso z radius
  head: [number, number, number]; // head ellipsoid radii
  neck: number; // neck rows
}

export interface FigureColors {
  skin: number; shirt: number; shirtDark: number; pants: number; shoe: number;
  hair: number; hairLight: number; cheek: number; eye: number;
}

export interface FigureY {
  hip: number; // hip row
  torso0: number; // first torso row
  shoulder: number; // y of the TOP face of the torso (arm pivot height)
  head0: number; // first head row (head pivot)
  headC: number; // head centre
  eye: number; // eye row
  armX: number; // |x| of the arm column
  top: number; // highest hair row
}

export function figureLayout(f: FigureSpec): FigureY {
  const hip = f.y + f.legH + 1;
  const torso0 = hip + 1;
  const shoulder = torso0 + f.torsoH; // top face of the last torso row
  const head0 = shoulder + f.neck;
  const headC = head0 + f.head[1] - 0.5;
  return {
    hip, torso0, shoulder, head0, headC,
    eye: Math.round(headC - f.head[1] * 0.5),
    armX: Math.floor(f.shoulder) + 1,
    top: Math.ceil(headC + f.head[1] + 0.6),
  };
}

/** Shoes + separated legs + hip band (pants). */
export function drawLegs(g: Grid, f: FigureSpec, c: { pants: number; shoe: number; toe?: number }) {
  const { x, y, z } = f;
  const L = figureLayout(f);
  for (const sx of [-1, 1]) {
    const x0 = x + sx * 1, x1 = x + sx * f.legW;
    g.box(x0, y, z - 1, x1, y, z + 1, c.shoe);
    if (c.toe) g.box(x0, y, z + 1, x1, y, z + 1, c.toe);
    g.box(x0, y + 1, z - 1, x1, L.hip - 1, z, c.pants);
  }
  // hip band joins the legs under the torso
  g.box(x - f.legW, L.hip, z - 1, x + f.legW, L.hip, z, c.pants);
}

/** Tapered torso: ellipse slices, narrow waist → chest, rounded top row. */
export function drawTorso(g: Grid, f: FigureSpec, shirt: number, band: number) {
  const L = figureLayout(f);
  for (let r = 0; r < f.torsoH; r++) {
    const t = f.torsoH > 1 ? r / (f.torsoH - 1) : 1;
    const e = t * t * (3 - 2 * t);
    let rx = f.waist + (f.shoulder - f.waist) * Math.min(1, e * 1.25);
    let rz = f.depth * (0.85 + 0.15 * e);
    if (r === f.torsoH - 1) { rx -= 0.9; rz -= 0.3; } // rounded shoulders
    const y = L.torso0 + r;
    for (let dz = -Math.ceil(rz); dz <= Math.ceil(rz); dz++)
      for (let dx = -Math.ceil(rx); dx <= Math.ceil(rx); dx++)
        if ((dx / (rx + 0.35)) ** 2 + (dz / (rz + 0.35)) ** 2 <= 1) g.set(f.x + dx, y, f.z + dz, r === 0 ? band : shirt);
  }
}

/**
 * Ellipsoid head with a rounded hair shell + swept fringe. Eye cells are left
 * EMPTY in `g` and filled in `eyes` (so a blink scale reveals the skin voxel
 * recessed behind them instead of a hole). Returns the eye cell list.
 */
export function drawHead(g: Grid, eyes: Grid, f: FigureSpec, c: FigureColors, opts: { cap?: number } = {}) {
  const L = figureLayout(f);
  const [rx, ry, rz] = f.head;
  const cx = f.x, cy = L.headC, cz = f.z;
  // skin is a faint 'glow' voxel so faces (vertical, camera-facing) don't sink
  // into the toon ramp's dark band — callers mesh heads with glow ≈ 0.2.
  const skin = g.g(c.skin, 0.02);
  const hair = g.c(c.hair, 0.05);
  const hairL = g.c(c.hairLight, 0.04);
  const cheek = g.c(c.cheek, 0.02);
  const neck = skin;
  for (let n = 0; n < f.neck; n++) g.set(cx, L.shoulder + n, cz, neck);
  g.ellipsoid(cx, cy, cz, rx, ry, rz, skin);
  // hair shell: slightly larger ellipsoid shifted up/back, kept off the face
  // (shifted back so the crown never overhangs the face from the camera's view)
  const hy = cy + 0.5, hz = cz - 0.9;
  const hrx = rx + 0.55, hry = ry + 0.4, hrz = rz + 0.4;
  for (let y = Math.floor(hy - hry); y <= Math.ceil(hy + hry); y++)
    for (let z = Math.floor(hz - hrz); z <= Math.ceil(hz + hrz); z++)
      for (let x = Math.floor(cx - hrx); x <= Math.ceil(cx + hrx); x++) {
        if (((x - cx) / hrx) ** 2 + ((y - hy) / hry) ** 2 + ((z - hz) / hrz) ** 2 > 1) continue;
        const crown = y >= L.eye + 3;
        const back = z <= cz - 1;
        const side = Math.abs(x - cx) >= rx - 0.2 && y >= cy - 0.3 && z <= cz + rz * 0.5;
        if (crown || back || side) g.set(x, y, z, y >= cy + ry * 0.9 && z >= cz - 1 ? hairL : hair);
      }
  // frontmost solid cell at (x, y)
  const front = (x: number, y: number) => {
    for (let z = cz + Math.ceil(rz) + 2; z >= cz; z--) if (g.get(x, y, z)) return z;
    return cz;
  };
  // swept fringe across the brow (left-heavy) — sits ON the face
  const brow = L.eye + 2; // fringe row (just above the eyes)
  for (let x = cx - Math.floor(rx); x <= cx + 1; x++) g.set(x, brow, front(x, brow) + (x <= cx - 1 ? 1 : 0), hair);
  if (opts.cap !== undefined) {
    // baseball cap: repaint the crown of the hair shell + a brim over the fringe
    const cap = g.c(opts.cap, 0.03);
    const y0 = L.eye + 3;
    for (let y = y0; y <= Math.ceil(hy + hry) + 1; y++)
      for (let z = cz - 6; z <= cz + 6; z++)
        for (let x = cx - 6; x <= cx + 6; x++) {
          const v = g.get(x, y, z);
          if (v === hair || v === hairL) g.set(x, y, z, cap);
        }
    for (let x = cx - 2; x <= cx + 2; x++) g.set(x, y0, front(x, y0) + 1, cap);
  }
  // cheeks + eyes (eye cells moved into the `eyes` grid)
  const eye = eyes.c(c.eye, 0);
  const ex = 1; // eyes either side of a 1-voxel bridge
  for (const sx of [-1, 1]) {
    const x = cx + sx * ex;
    for (const y of [L.eye, L.eye + 1]) {
      const z = front(x, y);
      g.set(x, y, z, 0);
      eyes.set(x, y, z, eye);
    }
    const chx = cx + sx * (ex + 1);
    g.set(chx, L.eye - 1, front(chx, L.eye - 1), cheek);
  }
}

/** One arm column at side sx: 'down' (hanging) or 'up' (raised, cheering). */
export function drawArm(g: Grid, f: FigureSpec, sx: -1 | 1, pose: 'down' | 'up', c: { sleeve: number; cuff: number; skin: number }) {
  const L = figureLayout(f);
  const ax = f.x + sx * L.armX;
  const top = L.shoulder - 1;
  const len = Math.max(3, Math.round(f.torsoH * 0.95));
  if (pose === 'down') {
    for (let k = 0; k < len; k++) {
      const y = top - k;
      const upper = k < len / 2;
      // slight taper: upper arm 2 deep, forearm 1 deep (only for chunkier figures)
      if (upper && f.legW === 2) g.box(ax, y, f.z - 1, ax, y, f.z, c.sleeve);
      else g.set(ax, y, f.z, k === len - 1 ? c.cuff : c.sleeve);
    }
    g.set(ax, top - len, f.z, c.skin);
  } else {
    for (let k = 0; k < len; k++) g.set(ax + sx * Math.floor((k + 1) / 3), top + k, f.z, k === len - 1 ? c.cuff : c.sleeve);
    g.set(ax + sx * Math.floor((len + 1) / 3), top + len, f.z, c.skin);
  }
}
