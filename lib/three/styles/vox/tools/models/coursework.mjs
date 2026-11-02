// Coursework — an open-front wooden bookshelf on a stone footing: three rows
// of colourful spines of varied heights, one book laid flat per row, a glowing
// FEATURED spine per row (its own part → hops out on click), a gold label
// plaque + potted plant on the crown.
import { Assembly, hash } from '../voxlib.mjs';
import { C, G } from '../palette.mjs';

export const name = 'coursework';

export function build() {
  const A = new Assembly(30, 40, 26);
  const base = A.part('base');

  // ---------------------------------------------------------- footing ---
  base.box(2, 0, 4, 27, 0, 21, (x, y, z) => (hash(x, z, 0, 3) < 0.3 ? C.rock[3] : C.rock[4]));
  base.box(3, 1, 5, 26, 1, 20, (x, y, z) => (hash(x, z, 1, 3) < 0.25 ? C.rock[5] : C.rock[6]));
  // grass tufts hugging the footing
  for (let i = 0; i < 26; i++) {
    const side = i % 4;
    const a = 4 + Math.floor(hash(i, 1, 0, 8) * 22);
    if (hash(i, 2, 0, 8) < 0.35) continue;
    const [x, z] = side === 0 ? [a, 3] : side === 1 ? [a, 22] : side === 2 ? [1, Math.min(21, a)] : [28, Math.min(21, a)];
    base.set(x, 0, z, hash(i, 3, 0, 8) < 0.5 ? C.grass[4] : C.grass[5]);
    if (hash(i, 4, 0, 8) < 0.4) base.set(x, 1, z, C.grass[6]);
  }

  // ------------------------------------------------------------ frame ---
  const X0 = 4, X1 = 25, Z0 = 7, Z1 = 16, Y0 = 2;
  const wood = (x, y, z) => (z === Z1 ? C.wood[5] : C.wood[4]);
  base.box(X0, Y0, Z0, X0 + 1, 29, Z1, wood); // left side (2 thick)
  base.box(X1 - 1, Y0, Z0, X1, 29, Z1, wood); // right side
  base.box(X0, Y0, Z0, X1, 29, Z0, C.wood[2]); // back
  base.box(X0 + 2, Y0 + 2, Z0 + 1, X1 - 2, 27, Z0 + 1, C.wood[1]); // dark inner back
  const boards = [Y0, 11, 19, 27];
  for (const by of boards) {
    const t = by === Y0 ? 1 : 0;
    base.box(X0, by, Z0, X1, by + t, Z1, (x, y, z) => (z === Z1 ? C.wood[6] : y === by + t ? C.wood[5] : C.wood[4]));
  }
  // crown: overhanging top slab with a light top + dark under-lip
  base.box(X0 - 1, 28, Z0 - 1, X1 + 1, 29, Z1 + 1, (x, y, z) => (y === 29 ? C.wood[6] : C.wood[3]));
  base.box(X0 - 1, 29, Z1 + 1, X1 + 1, 29, Z1 + 1, C.wood[7]); // bright front edge
  // kick plate
  base.box(X0, Y0, Z1 + 1, X1, Y0, Z1 + 1, C.wood[3]);

  // ------------------------------------------------------------ books ---
  const ramps = [C.blue, C.red, C.gold, C.teal, C.pink, C.violet, C.leaf, C.sand];
  void hash;
  const rows = [
    { y: Y0 + 2, h: 8 }, // y 4..10
    { y: 12, h: 7 }, // y 12..18
    { y: 20, h: 7 }, // y 20..26
  ];
  const featured = [];
  const featGlow = [G.goldGlow, G.screen, G.pinkGlow];
  const featRamp = [C.gold, C.teal, C.pink];
  // books come in SETS: runs of 2–4 same-colour spines (same height), so each
  // row reads as a few chunky colour blocks rather than per-voxel noise.
  const sets = [ // [ramp, count, width] — 13 columns per row before the flat book
    [[C.blue, 2, 2], [C.sand, 2, 1], [null], [C.teal, 3, 1]],
    [[C.gold, 2, 2], [null], [C.pink, 2, 2], [C.leaf, 1, 1]],
    [[C.red, 3, 1], [C.teal, 2, 2], [null], [C.violet, 2, 1]],
  ];
  rows.forEach((row, ri) => {
    let x = X0 + 2;
    sets[ri].forEach(([ramp, n, w], si) => {
      if (!ramp) {
        // featured spine: wide, its whole face glows
        const g = A.part(`feat${ri}`);
        const fr = featRamp[ri];
        const hgt = row.h - 1;
        const zf = Z1 - 1;
        g.box(x, row.y, Z0 + 3, x + 2, row.y + hgt - 1, zf, (xx, yy, zz) => (yy === row.y + hgt - 1 ? fr[6] : zz === zf ? fr[5] : fr[4]));
        g.box(x, row.y + 1, zf, x + 2, row.y + hgt - 2, zf, featGlow[ri]);
        g.box(x, row.y + hgt - 3, zf, x + 2, row.y + hgt - 3, zf, fr[2]);
        featured.push({ x: x + 1.5, y: row.y, z: zf });
        x += 4;
        return;
      }
      const hgt = Math.min(row.h - 1, 4 + Math.floor(hash(si, ri, 1, 11) * (row.h - 4)));
      for (let b = 0; b < n; b++) {
        const zf = Z1 - 1 - (b % 2 === 1 && n > 2 ? 0 : 0);
        const hh = hgt - (b === n - 1 && hash(si, b, ri, 3) < 0.5 ? 1 : 0);
        base.box(x, row.y, Z0 + 3, x + w - 1, row.y + hh - 1, zf, (xx, yy, zz) =>
          yy === row.y + hh - 1 ? ramp[6] : zz === zf ? (b % 2 ? ramp[4] : ramp[5]) : ramp[3]);
        base.box(x, row.y + hh - 2, zf, x + w - 1, row.y + hh - 2, zf, C.gold[6]); // gilt band
        if (w >= 2 && hh >= 5) base.box(x, row.y + 1, zf, x + w - 1, row.y + 2, zf, ramp[1]); // title label
        else if (hh >= 5 && b % 2 === 0) base.set(x, row.y + 2, zf, C.sand[6]); // small title mark
        x += w;
      }
    });
    // one book laid flat at the row end: cover · cream page block · cover, the
    // page edges showing on the camera-facing front (+z) and side (+x); plus a
    // thinner one stacked on top (except the middle row)
    const fr = ramps[(ri * 3 + 5) % ramps.length];
    const flat = (x0, x1, z0, z1, y, rp) => {
      base.box(x0, y, z0, x1, y + 2, z1, rp[4]); // covers (top + bottom + spine)
      base.box(x0, y + 2, z0, x1, y + 2, z1, rp[5]); // lighter top cover
      base.box(x0 + 1, y + 1, z0 + 1, x1, y + 1, z1, C.sand[5]); // page block (shows on +x / +z)
      base.box(x0 + 1, y + 1, z1, x1, y + 1, z1, C.sand[6]); // front page edge highlight
    };
    flat(X1 - 6, X1 - 2, Z0 + 4, Z1 - 1, row.y, fr);
    if (ri !== 1 && row.y + 5 < (ri === 0 ? 11 : 27)) flat(X1 - 5, X1 - 3, Z0 + 5, Z1 - 2, row.y + 3, ramps[(ri + 2) % 8]);
  });

  // ------------------------------------------------ crown: plaque + plant ---
  // gold-framed label plaque standing on the crown
  base.box(8, 30, 11, 16, 34, 12, C.gold[4]);
  base.box(9, 31, 12, 15, 33, 12, C.sand[6]);
  base.box(10, 33, 13, 14, 33, 13, C.wood[2]); // "title" line
  base.box(10, 31, 13, 13, 31, 13, C.blue[3]);
  base.set(15, 34, 12, C.gold[6]); base.set(8, 34, 12, C.gold[6]);
  // potted plant (sways — own part)
  base.box(19, 30, 9, 22, 32, 12, (x, y) => (y === 32 ? C.red[5] : C.red[4]));
  base.box(20, 32, 10, 21, 32, 11, C.earth[2]);
  const plant = A.part('plant');
  plant.box(20, 33, 10, 21, 34, 11, C.leaf[4]);
  plant.ellipsoid(20.5, 36, 10.5, 2.4, 1.8, 2.4, (x, y) => (y >= 37 ? C.leaf[7] : y >= 36 ? C.leaf[6] : C.leaf[5]));
  plant.set(18, 35, 10, C.leaf[5]); plant.set(23, 35, 11, C.leaf[5]);
  plant.set(21, 38, 10, C.pink[6]); // a tiny bloom

  const pivots = { base: [15, 0, 12], plant: [21, 33, 11] };
  featured.forEach((f, i) => { pivots[`feat${i}`] = [f.x, f.y, f.z]; });
  return {
    assembly: A,
    origin: [15, 0, 13],
    pivots,
    glow: { [G.goldGlow]: 0.9, [G.screen]: 0.9, [G.pinkGlow]: 0.9 },
  };
}
