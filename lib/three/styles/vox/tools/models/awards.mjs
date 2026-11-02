// Awards & Honors — a cream 2-step podium with a red sash, a big golden cup
// (slow spin), a violet banner with glowing gold stars behind, two floating
// medals and a confetti burst cluster (hidden until clicked).
import { Assembly, hash } from '../voxlib.mjs';
import { C, G } from '../palette.mjs';

export const name = 'awards';

const STAR = ['00100', '01110', '11111', '01110', '01010'];

export function build() {
  const A = new Assembly(32, 34, 30);
  const CX = 15.5;

  // ---------------------------------------------------------------- base ---
  const base = A.part('base');
  // 3-step podium: 2 (left) · 1 (centre, tallest) · 3 (right), numbered fronts
  const NUM = {
    1: ['010', '110', '010', '010', '111'],
    2: ['111', '001', '111', '100', '111'],
    3: ['111', '001', '011', '001', '111'],
  };
  const steps = [[2, 10, 7, 2], [11, 20, 10, 1], [21, 29, 6, 3]]; // x0, x1, top y, place
  const ZF = 22; // front face
  for (const [x0, x1, top, n] of steps) {
    base.box(x0, 0, 8, x1, top, ZF, (x, y, z) => {
      if (y === top) return x === x0 || x === x1 || z === 8 || z === ZF ? C.gold[5] : C.sand[7];
      if (y === 0) return C.sand[3];
      return x === x0 || x === x1 ? C.sand[4] : C.sand[5];
    });
    // big navy numeral on the front face
    const cxn = Math.floor((x0 + x1) / 2) - 1, y0n = Math.max(1, Math.floor((top - 4) / 2));
    NUM[n].forEach((row, r) => [...row].forEach((b, k) => b === '1' && base.set(cxn + k, y0n + 4 - r, ZF + 1, C.blue[1])));
    // …and inlaid flat on the step top (visible from the high camera), reading toward the front
    // (step 1's top numeral sits at the front edge, clear of the cup's plinth)
    const zt = n === 1 ? ZF - 4 : 15;
    NUM[n].forEach((row, r) => [...row].forEach((b, k) => b === '1' && base.set(cxn + k, top, zt + r, C.blue[1])));
  }
  // banner poles + cloth behind
  for (const x of [6, 25]) {
    base.box(x, 0, 5, x, 23, 5, C.wood[2]);
    base.box(x, 24, 5, x, 24, 5, C.gold[6]);
  }
  base.box(7, 15, 5, 24, 22, 5, (x, y) => {
    if (y === 22) return C.gold[5];
    if (y === 15) return C.violet[2];
    return C.violet[4];
  });
  // notched (swallow-tail) bottom edge
  for (let x = 7; x <= 24; x++) if ((x - 7) % 4 === 1 || (x - 7) % 4 === 2) base.set(x, 14, 5, C.violet[3]);
  // stars on the banner (gold glow)
  for (const sx of [8, 19]) {
    STAR.forEach((row, r) => [...row].forEach((b, k) => b === '1' && base.set(sx + k, 20 - r, 6, G.goldGlow)));
  }
  // grass tufts
  for (let i = 0; i < 28; i++) {
    const x = Math.floor(hash(i, 1, 0, 61) * 32), z = Math.floor(hash(i, 2, 0, 61) * 30);
    if (x >= 1 && x <= 30 && z >= 3 && z <= 25) continue;
    base.set(x, 0, z, hash(i, 3, 0, 61) < 0.5 ? C.grass[4] : C.grass[5]);
    if (hash(i, 4, 0, 61) < 0.4) base.set(x, 1, z, C.grass[6]);
  }

  // ----------------------------------------------------------------- cup ---
  const cup = A.part('cup');
  const Y0 = 11; // on top of step 1
  const CZ = 15;
  cup.box(12, Y0, 12, 19, Y0 + 1, 17, (x, y) => (y === Y0 ? C.wood[2] : C.wood[3])); // plinth block
  cup.box(13, Y0 + 2, 13, 18, Y0 + 2, 17, C.gold[3]);
  cup.box(14, Y0 + 3, 14, 17, Y0 + 5, 16, C.gold[4]); // stem
  cup.box(13, Y0 + 6, 13, 18, Y0 + 6, 17, C.gold[4]);
  // bowl: widening rings, hollow at the top
  const radii = [2.6, 3.4, 4.0, 4.4, 4.6, 4.7, 4.7];
  radii.forEach((r, i) => {
    const y = Y0 + 7 + i;
    const top = i === radii.length - 1;
    cup.cylY(CX, CZ, y, y, r, (x, yy, z) => {
      const rr = Math.hypot(x - CX, z - CZ);
      if (top && rr < r - 1.3) return 0;
      if (top) return C.gold[7];
      return z - CZ > 1.5 ? C.gold[6] : x - CX > 1.5 ? C.gold[5] : C.gold[4];
    });
  });
  // dark inside the bowl
  cup.cylY(CX, CZ, Y0 + 12, Y0 + 12, 3.2, C.gold[2]);
  // handles
  for (const s of [-1, 1]) {
    const hx = s < 0 ? 9 : 22;
    cup.box(hx, Y0 + 9, 15, hx, Y0 + 12, 15, C.gold[5]);
    cup.box(hx - s, Y0 + 12, 15, hx - s, Y0 + 12, 15, C.gold[5]);
    cup.box(hx - s, Y0 + 8, 15, hx - s, Y0 + 8, 15, C.gold[5]);
  }
  // glinting star emblem on the bowl front
  cup.set(15, Y0 + 10, 19, G.hot);
  cup.set(16, Y0 + 10, 19, G.hot);
  cup.set(15, Y0 + 11, 19, G.goldGlow);
  cup.set(16, Y0 + 9, 19, G.goldGlow);

  // -------------------------------------------------------------- medals ---
  const medal = (nm, mx, my, mz, ribbon, face) => {
    const p = A.part(nm);
    // V-ribbon above the disc
    for (let k = 0; k < 4; k++) { p.set(mx - 1 - (k > 1 ? 1 : 0), my + 3 + k, mz, ribbon); p.set(mx + 1 + (k > 1 ? 1 : 0), my + 3 + k, mz, ribbon); }
    p.set(mx, my + 3, mz, ribbon);
    // thick gold disc with a bright rim + embossed star
    p.cylZ(mx, my, mz - 1, mz, 2.8, (x, y, z) => (Math.hypot(x - mx, y - my) > 2.0 ? C.gold[6] : z === mz ? face : C.gold[4]));
    for (const [dx, dy] of [[0, 1], [-1, 0], [0, 0], [1, 0], [0, -1]]) p.set(mx + dx, my + dy, mz + 1, G.goldGlow);
    return [mx, my, mz];
  };
  // hung at the back, against the violet banner (gold on violet), above steps 2 + 3
  const m1 = medal('medal1', 7, 16, 9, C.blue[4], C.gold[5]);
  const m2 = medal('medal2', 24, 15, 9, C.red[4], C.gold[4]);

  // ------------------------------------------------------------ confetti ---
  const conf = A.part('confetti');
  const cols = [C.pink[5], C.teal[5], C.gold[6], C.blue[5], C.red[5], C.violet[5]];
  for (let i = 0; i < 22; i++) {
    const a = hash(i, 1, 0, 71) * Math.PI * 2;
    const r = 2 + hash(i, 2, 0, 71) * 7;
    conf.set(CX + Math.cos(a) * r, Y0 + 15 + hash(i, 3, 0, 71) * 6, CZ + Math.sin(a) * r, cols[i % cols.length]);
  }

  return {
    assembly: A,
    origin: [16, 0, 15],
    pivots: {
      base: [16, 0, 15],
      cup: [CX + 0.5, Y0, CZ + 0.5],
      medal1: [m1[0] + 0.5, m1[1] + 6.5, m1[2] + 0.5],
      medal2: [m2[0] + 0.5, m2[1] + 6.5, m2[2] + 0.5],
      confetti: [CX + 0.5, Y0 + 14, CZ + 0.5],
    },
    glow: { [G.goldGlow]: 0.9, [G.hot]: 1.0 },
  };
}
