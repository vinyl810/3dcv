// Education — a cream stone plinth with a glowing KAIST plaque, a big navy
// mortarboard (gold trim + button) on top with a swinging gold tassel, and a
// rolled diploma resting against the plinth.
import { Assembly, hash } from '../voxlib.mjs';
import { C, G } from '../palette.mjs';

export const name = 'education';

const FONT = {
  K: ['1001', '1010', '1100', '1010', '1001'],
  A: ['0110', '1001', '1111', '1001', '1001'],
  I: ['1', '1', '1', '1', '1'],
  S: ['111', '100', '111', '001', '111'],
  T: ['111', '010', '010', '010', '010'],
};

export function build() {
  const A = new Assembly(34, 24, 24);

  // ---------------------------------------------------------------- base ---
  const base = A.part('base');
  // stone footing (1 high)
  base.box(0, 0, 5, 28, 0, 18, (x, y, z) => (hash(x, z, 1, 3) < 0.2 ? C.rock[6] : C.rock[5]));
  // low cream plinth (y 1..9) with a darker course + light cap rail
  base.box(2, 1, 7, 26, 9, 16, (x, y) => {
    if (y === 1) return C.sand[3];
    if (y === 9) return C.sand[6];
    return x === 2 || x === 26 ? C.sand[4] : C.sand[5];
  });
  for (const x of [2, 26]) base.box(x, 2, 16, x, 8, 17, C.sand[6]); // pilasters
  // plaque: gold frame, navy field, glowing letters (crisp 3x5)
  const pz = 17;
  base.box(3, 2, pz, 25, 8, pz, C.gold[4]);
  base.box(3, 8, pz, 25, 8, pz, C.gold[6]);
  base.box(4, 3, pz, 24, 7, pz, C.blue[1]);
  // K(4) A(4) I(1) S(3) T(3) + 1-voxel gaps = 19 wide, centred in the 21-wide field
  let lx = 5;
  for (const ch of 'KAIST') {
    FONT[ch].forEach((row, r) => [...row].forEach((b, k) => {
      if (b === '1') base.set(lx + k, 7 - r, pz + 1, G.goldGlow);
    }));
    lx += FONT[ch][0].length + 1;
  }
  // rolled diploma resting against the plinth's front-left (cream roll, red ribbon, gold seal)
  base.cylX(1.5, 20, 0, 8, 1.4, (x, y, z) => (x === 4 ? C.red[5] : x === 0 || x === 8 ? C.sand[4] : C.sand[7]));
  base.set(4, 1, 22, C.red[4]); base.set(4, 0, 22, C.red[4]); // ribbon tails
  base.set(5, 1, 22, G.goldGlow); // wax seal
  // grass tufts at the footing
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(hash(i, 1, 0, 51) * 34), z = Math.floor(hash(i, 2, 0, 51) * 24);
    if (x <= 28 && z >= 4 && z <= 22) continue;
    base.set(x, 0, z, hash(i, 3, 0, 51) < 0.5 ? C.grass[4] : C.grass[5]);
    if (hash(i, 4, 0, 51) < 0.4) base.set(x, 1, z, C.grass[6]);
  }

  // ----------------------------------------------------------------- cap ---
  // A clearly visible round skull cap with a lighter band, a smaller square
  // board on top (tilted toward the camera at runtime), a gold button and a
  // thin cord running to the FRONT edge where the tassel hangs over it.
  const cap = A.part('cap');
  const CY = 10; // plinth top
  cap.cylY(18.5, 11.5, CY, CY + 4, 4.6, (x, y) => (y === CY ? C.gold[5] : y === CY + 1 ? C.blue[3] : C.blue[2])); // skull + band
  const bx0 = 12, bx1 = 25, bz0 = 5, bz1 = 18, by = CY + 5;
  cap.box(bx0, by, bz0, bx1, by, bz1, C.body[7]); // board underside
  cap.box(bx0, by + 1, bz0, bx1, by + 1, bz1, (x, y, z) => {
    if (x === bx0 || x === bx1 || z === bz0 || z === bz1) return C.gold[5];
    return C.blue[2];
  });
  cap.box(18, by + 2, 11, 19, by + 2, 12, C.gold[6]); // button
  cap.set(18, by + 3, 11, C.gold[7]);
  for (let z = 13; z <= bz1 - 1; z++) cap.set(19 + Math.round(((z - 13) / (bz1 - 14)) * 5), by + 2, z, C.gold[6]); // cord → front-right corner

  // --------------------------------------------------------------- tassel ---
  const tassel = A.part('tassel');
  const TX = bx1, TZ = bz1 + 1; // hangs over the front edge at the right corner, beside KAIST
  tassel.box(TX, by - 3, TZ, TX, by + 2, TZ, C.gold[6]); // thin 1×1 cord over the front edge
  tassel.set(TX, by + 2, TZ - 1, C.gold[6]);
  tassel.box(TX, by - 4, TZ, TX, by - 4, TZ, C.gold[7]); // knot
  tassel.box(TX - 1, by - 7, TZ, TX + 1, by - 5, TZ, (x, y) => (y === by - 7 && x !== TX ? 0 : (x + y) % 2 ? C.gold[5] : C.gold[6])); // fringe
  return {
    assembly: A,
    origin: [16, 0, 12],
    pivots: {
      base: [16, 0, 12],
      cap: [19, CY, 12],
      tassel: [TX + 0.5, by + 2.5, TZ + 0.5],
    },
    glow: { [G.goldGlow]: 0.9 },
  };
}
