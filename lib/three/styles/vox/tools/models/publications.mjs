// Publications — a wooden writing lectern (the desk part tilts toward the
// viewer at runtime) holding an open journal with text lines, an inkpot with a
// white quill, a stack of journals at its foot, and a floating paper page (title
// bar + text lines) that turns slowly above it.
import { Assembly, hash } from '../voxlib.mjs';
import { C, G } from '../palette.mjs';

export const name = 'publications';

export function build() {
  const A = new Assembly(32, 35, 31);
  const CX = 14.5, CZ = 14;

  // ---------------------------------------------------------------- base ---
  const base = A.part('base');
  // round wooden foot plate on a stone ring
  base.cylY(CX, CZ, 0, 0, 9.5, (x, y, z) => (hash(x, z, 0, 81) < 0.25 ? C.rock[4] : C.rock[5]));
  base.cylY(CX, CZ, 1, 1, 7.5, (x, y, z) => (Math.hypot(x - CX, z - CZ) > 6.6 ? C.wood[3] : C.wood[5]));
  // column + gold band
  base.box(12, 2, 12, 17, 12, 16, (x, y, z) => {
    if (y === 7 || y === 8) return C.gold[5];
    if (y === 2) return C.wood[2];
    return z === 16 ? C.wood[5] : C.wood[4];
  });
  base.box(11, 11, 11, 18, 12, 17, C.wood[3]); // head block under the desk
  // a small stack of bound journals at the front of the foot (in clear view):
  // coloured covers, cream page edges toward the camera, gold spine bands
  const stack = [[C.red[4], C.red[3], 10, 19], [C.blue[5], C.blue[3], 11, 18], [C.teal[5], C.teal[3], 10, 18]];
  stack.forEach(([top, side, x0, x1], i) => {
    const y = 1 + i * 2;
    base.box(x0, y, 23, x1, y + 1, 27, (x, yy, z) => (yy === y + 1 ? top : side));
    base.box(x0, y, 27, x1 - 1, y + 1, 27, (x, yy) => (yy === y ? C.sand[5] : C.sand[7])); // page edges (front)
    base.set(x1, y + 1, 25, C.gold[5]); // spine band (right)
  });
  // grass tufts
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(hash(i, 1, 0, 82) * 31), z = Math.floor(hash(i, 2, 0, 82) * 29);
    if (Math.hypot(x - CX, z - CZ) < 10.6 || (x >= 8 && x <= 21 && z >= 21)) continue;
    base.set(x, 0, z, hash(i, 3, 0, 82) < 0.5 ? C.grass[4] : C.grass[5]);
    if (hash(i, 4, 0, 82) < 0.4) base.set(x, 1, z, C.grass[6]);
  }

  // ----------------------------------------------------------------- desk ---
  const desk = A.part('desk');
  const DY = 13;
  desk.box(4, DY, 5, 25, DY + 1, 21, (x, y, z) => (y === DY + 1 ? (z % 4 === 0 ? C.wood[5] : C.wood[6]) : C.wood[3]));
  desk.box(4, DY + 2, 21, 25, DY + 2, 22, C.wood[4]); // front lip that holds the book
  desk.box(4, DY, 22, 25, DY + 1, 22, C.wood[3]);
  // OPEN journal (~60% of the old one): teal cover peeking out, two cream pages
  // dipping to a central gutter, thin separated dark text lines on each page
  const jy = DY + 2, jx0 = 7, jx1 = 19, jz0 = 9, jz1 = 18;
  desk.box(jx0, jy, jz0, jx1, jy, jz1, C.teal[3]); // cover
  const gx = 13; // gutter column
  desk.box(jx0 + 1, jy + 1, jz0 + 1, jx1 - 1, jy + 1, jz1 - 1, C.sand[6]); // page block
  for (let x = jx0 + 1; x <= jx1 - 1; x++) if (x !== gx) desk.box(x, jy + 2, jz0 + 1, x, jy + 2, jz1 - 1, C.sand[7]); // raised pages
  desk.box(gx, jy + 1, jz0 + 1, gx, jy + 1, jz1 - 1, C.sand[4]); // gutter shadow
  for (const [xa, xb] of [[jx0 + 2, gx - 2], [gx + 2, jx1 - 2]])
    for (let z = jz0 + 2; z <= jz1 - 2; z += 2) {
      const len = (xb - xa) - ((z * 7 + xa) % 3 === 0 ? 1 : 0);
      desk.box(xa, jy + 2, z, xa + len, jy + 2, z, C.rock[2]); // text line INSET in the page, 1-voxel gaps
    }
  desk.box(jx0, jy + 1, jz1, jx1, jy + 1, jz1, C.teal[2]); // cover edge at the front
  // inkpot on a little wooden coaster: dark glass body, light rim, ink well
  desk.box(20, jy, 13, 24, jy, 17, C.wood[6]);
  desk.box(21, jy + 1, 14, 23, jy + 3, 16, C.body[7]);
  desk.box(21, jy + 4, 14, 23, jy + 4, 16, C.rock[6]); // light rim
  desk.set(22, jy + 4, 15, C.blue[1]); // ink
  // long white quill leaning out of the pot: dark nib, pale shaft, white vane
  const q = [[22, 5, 15], [22, 6, 15], [23, 7, 14], [23, 8, 14], [24, 9, 13], [24, 10, 13], [25, 11, 12], [25, 12, 12], [26, 13, 11]];
  q.forEach(([x, y, z], i) => {
    desk.set(x, jy + y, z, i === 0 ? C.rock[2] : C.sand[6]);
    if (i >= 2) { desk.set(x + 1, jy + y, z, C.sand[7]); desk.set(x - 1, jy + y, z, i % 2 ? C.sand[7] : C.rock[6]); }
  });

  // ----------------------------------------------------------------- page ---
  const page = A.part('page');
  const PZ = 14, px0 = 9, px1 = 20, py0 = 21, py1 = 34;
  page.box(px0, py0, PZ, px1, py1, PZ, G.hot); // white paper (softly self-lit so it never goes grey)
  page.box(px0, py0, PZ - 1, px1, py1, PZ - 1, C.sand[5]); // back side
  page.set(px1, py1, PZ, 0); page.set(px1, py1, PZ - 1, 0); // dog-ear corner
  page.box(px0 + 1, py1 - 2, PZ, px1 - 1, py1 - 1, PZ, C.blue[2]); // title bar (inset, flush with the paper)
  const lines = [10, 8, 10, 9, 6, 10, 7];
  lines.forEach((w, i) => page.box(px0 + 1, py1 - 4 - i * 2, PZ, px0 + w, py1 - 4 - i * 2, PZ, C.rock[2])); // text lines flush (no top faces closing the gaps)
  page.box(px1 - 3, py0 + 1, PZ, px1 - 1, py0 + 1, PZ, C.gold[5]); // DOI tag

  return {
    assembly: A,
    origin: [15, 0, 14],
    pivots: {
      base: [15, 0, 14],
      desk: [15, DY, 13.5],
      page: [15, 28, 14.5],
    },
    glow: { [G.hot]: 0.55 },
  };
}
