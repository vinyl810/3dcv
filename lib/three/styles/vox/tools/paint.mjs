// Shared "painted voxel" pass for landmarks and characters, so they match the
// hand-shaded island/decor. Works purely by shifting each voxel along ITS OWN
// palette ramp (palette.mjs rows are dark→light, hue-shifted), so colours stay
// in the palette and materials keep their identity:
//   • fake light  — per-part gradient (up, +x, +z front) → ±1 step
//   • exposure    — lit top edges +1 (rim), undersides −1
//   • material    — wood grain stripes, cloth folds, metallic gold rims/streaks,
//                   hair strands, light grit on stone/earth/sand
//   • details     — voxels with ≤1 same-colour neighbour (eyes, letters, trims,
//                   drawstrings, blush…) keep their exact colour: no speckle.
// Emissive / glass / ink never change.
import { hash } from './voxlib.mjs';
import { C, G } from './palette.mjs';

const RAMPS = new Map(); // index → { ramp: number[], k, kind }
const reg = (ramp, kind) => ramp.forEach((idx, k) => RAMPS.set(idx, { ramp, k, kind }));
reg(C.grass, 'grit'); reg(C.leaf, 'grit'); reg(C.earth, 'grit'); reg(C.rock, 'stone');
reg(C.sand, 'stone'); reg(C.wood, 'wood'); reg(C.water, 'plain');
for (const r of [C.blue, C.red, C.pink, C.violet, C.teal]) reg(r, 'cloth');
reg(C.gold, 'metal');
reg([G.hairD, G.hair, G.hairL], 'hair');
reg([G.skinS, G.skinM, G.skin, G.skinL], 'skin');

const N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

/** Paint one Grid in place. */
export function paintGrid(g, seed = 0, name = '') {
  // fabric folds only on soft parts; hard surfaces in cloth colours (monitor
  // bezels, book covers, caps) get light + rims only
  const soft = /torso|arm|thigh|shin|hips|cloth|banner|flag/i.test(name);
  // bounds of this part
  let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1, y1 = -1, z1 = -1;
  g.paint((x, y, z, c) => {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); z0 = Math.min(z0, z);
    x1 = Math.max(x1, x); y1 = Math.max(y1, y); z1 = Math.max(z1, z);
    return c;
  });
  if (x1 < 0) return;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2;
  const rx = Math.max(1, (x1 - x0) / 2), ry = Math.max(1, (y1 - y0) / 2), rz = Math.max(1, (z1 - z0) / 2);
  const orig = new Uint8Array(g.v); // shade from the ORIGINAL colours
  const at = (x, y, z) => (g.inside(x, y, z) ? orig[g.idx(x, y, z)] : 0);
  g.paint((x, y, z, c) => {
    const info0 = RAMPS.get(c);
    if (!info0) return c;
    const info = info0.kind === 'cloth' && !soft ? { ...info0, kind: 'plain' } : info0;
    let same = 0;
    for (const [dx, dy, dz] of N6) if (at(x + dx, y + dy, z + dz) === c) same++;
    if (same <= 1) return c; // detail voxel: keep exact
    const up = !at(x, y + 1, z), down = !at(x, y - 1, z);
    const side = !at(x + 1, y, z) || !at(x - 1, y, z) || !at(x, y, z + 1) || !at(x, y, z - 1);
    // fake light: up + a little toward the camera corner (+x, +z)
    const v = ((y - cy) / ry) * 0.6 + ((x - cx) / rx) * 0.25 + ((z - cz) / rz) * 0.35;
    let s = v > 0.42 ? 1 : v < -0.5 ? -1 : 0;
    if (up && side) s += 1; // lit rim along top edges
    if (down && !up) s -= 1; // undersides / creases
    const h = hash(x, y, z, 91 + seed);
    switch (info.kind) {
      case 'wood': // grain: runs of darker voxels along the plank, rare knots
        if (hash(y, z, 0, 92 + seed) < 0.3 || hash(x >> 2, y, z, 93 + seed) < 0.06) s -= 1;
        break;
      case 'cloth': { // soft vertical folds
        const f = Math.sin(x * 1.25 + z * 0.9 + seed * 0.7);
        if (f < -0.72) s -= 1; else if (f > 0.86 && !up) s += 1;
        break;
      }
      case 'metal': // bright rims + a diagonal specular streak
        if (up && side) s += 1;
        if ((x + y + z) % 6 === 0) s += 1;
        if (down) s -= 1;
        break;
      case 'hair': // strand streaks + sheen on top
        if (hash(x, z, 0, 94 + seed) < 0.3) s -= 1;
        if (up) s += 1;
        break;
      case 'stone': case 'grit':
        if (h < 0.12) s -= 1; else if (h > 0.9) s += 1;
        break;
      case 'skin': // smooth: light gradient only
        s = Math.max(-1, Math.min(1, s));
        break;
      default:
    }
    s = Math.max(-2, Math.min(2, s));
    return info.ramp[Math.max(0, Math.min(info.ramp.length - 1, info.k + s))];
  });
}

/** Paint every part of an Assembly (each part shaded from its own bounds). */
export function paintAssembly(asm, seed = 0) {
  asm.parts.forEach((p, i) => paintGrid(p.grid, seed + i * 13, p.name));
}
