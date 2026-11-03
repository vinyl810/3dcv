// All characters — the hub Daewon + the 3 involvement people — as stylized
// "toon folk" (../toonfolk.mjs), authored at CHAR_RES× the landmark density
// (0.0625 world units per voxel; must match CHAR_RES in ../../assets.ts).
// Kept apart from the landmark modules so landmark edits never touch them.
// Character coordinates are CHAR_RES × the parent landmark's, so they drop
// straight into the landmark's rotated group at runtime.
import { Assembly } from '../voxlib.mjs';
import { C, G } from '../palette.mjs';
import { addToonFolk } from '../toonfolk.mjs';

export const name = 'chars';
export const CHAR_RES = 2;

const r3 = (ramp, i) => [ramp[i - 1], ramp[i], ramp[i + 1]];
const HAIR3 = [G.hairD, G.hair, G.hairL];
/** coarse sample centre c → fine sample centre at density res */
const F = (c, res) => c * res + (res - 1) / 2;

function buildHub(res = CHAR_RES) {
  const A = new Assembly(44 * res, 40 * res, 38 * res);
  const h = addToonFolk(A, '', {
    cx: F(19.5, res), cz: F(18.5, res), y0: 4 * res, s: 1, res,
    shirt3: r3(C.rock, 3), pants3: r3(C.blue, 3), hair3: HAIR3, sig: 'hoodie', // slightly dark grey hoodie
  });
  return { name: 'about_char', assembly: A, origin: [20 * res, 0, 19 * res], pivots: h.pivots, ao: 0.1 };
}

function buildPeople(res = CHAR_RES) {
  const A = new Assembly(36 * res, 32 * res, 30 * res);
  const P = 4;
  const people = [
    { cx: 6.5, cz: 18.5, lift: 0, shirt3: r3(C.blue, 4), pants3: r3(C.earth, 4), hair3: HAIR3, sig: 'cap', cap3: r3(C.red, 4) },
    { cx: 25.5, cz: 18.5, lift: 0, shirt3: r3(C.teal, 4), pants3: r3(C.blue, 2), hair3: [G.hairD, G.hair, G.hairL], sig: 'ponytail' },
    { cx: 15.5, cz: 5.5, lift: 2, shirt3: r3(C.red, 4), pants3: r3(C.rock, 2), hair3: r3(C.earth, 3), sig: 'none' },
  ];
  const pivots = {};
  people.forEach((o, i) => {
    const h = addToonFolk(A, `p${i}_`, { ...o, cx: F(o.cx, res), cz: F(o.cz, res), y0: (P + o.lift) * res, s: 0.68, res });
    Object.assign(pivots, h.pivots);
  });
  return { name: 'involvement_people', assembly: A, origin: [16 * res, 0, 12.5 * res], pivots, ao: 0.1 };
}

export function buildAll() {
  return [buildHub(), buildPeople()];
}
