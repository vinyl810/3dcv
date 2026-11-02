// All characters (hub Daewon + the 3 involvement people), kept apart from the
// landmark modules so landmark edits never touch character code.
// Variants (picked at runtime by ?char=a|b|cur, see ../../chars.ts):
//   cur → about_char / involvement_people (semi-realistic, CHAR_RES 2)
//   a   → about_char_a / involvement_people_a (stylized toon folk, landmark grain 0.125)
//   b   → about_char_b / involvement_people_b (stylized toon folk, 0.0625 grain)
import { Assembly } from '../voxlib.mjs';
import { C, G } from '../palette.mjs';
import { addHumanoid } from '../humanoid.mjs';
import { addToonFolk } from '../toonfolk.mjs';

export const name = 'chars';
export const CHAR_RES = 2;

function buildChar() {
  const A = new Assembly(88, 84, 80);
  const k = CHAR_RES;
  const hum = addHumanoid(A, '', {
    cx: 19.5 * k + 0.5, cz: 18.5 * k + 0.5, y0: 4 * k, s: 1, res: k,
    shirt: C.teal, pants: C.blue, style: 'short',
  });
  return { name: 'about_char', assembly: A, origin: [20 * k, 0, 19 * k], pivots: hum.pivots, meta: { res: [k, k, k] } };
}

function buildPeople() {
  const k = CHAR_RES, P = 4; // P = stage top + 1 (coarse)
  const A = new Assembly(72, 64, 60);
  const people = [
    { cx: 6.5, cz: 18.5, lift: 0, shirt: C.blue, pants: C.earth, style: 'short' },
    { cx: 25.5, cz: 18.5, lift: 0, shirt: C.teal, pants: C.blue, style: 'long',
      hair5: [C.body[7], G.hairD, G.hairD, G.hair, G.hairL] },
    { cx: 15.5, cz: 5.5, lift: 2, shirt: C.red, pants: C.rock, style: 'tuft',
      hair5: [C.earth[0], C.earth[1], C.earth[2], C.earth[3], C.earth[4]] },
  ];
  const pivots = {};
  people.forEach((o, i) => {
    const h = addHumanoid(A, `p${i}_`, {
      cx: o.cx * k + 0.5, cz: o.cz * k + 0.5, y0: (P + o.lift) * k, s: 0.63, res: k,
      shirt: o.shirt, pants: o.pants, hair5: o.hair5, style: o.style, hood: false,
    });
    Object.assign(pivots, h.pivots);
  });
  return { name: 'involvement_people', assembly: A, origin: [16 * k, 0, 12.5 * k], pivots };
}


// ---- stylized variants -----------------------------------------------------
const r3 = (ramp, i) => [ramp[i - 1], ramp[i], ramp[i + 1]];
const HAIR3 = [G.hairD, G.hair, G.hairL];
/** coarse sample centre c → fine sample centre at density res */
const F = (c, res) => c * res + (res - 1) / 2;

function buildToonHub(res, nm) {
  const A = new Assembly(44 * res, 40 * res, 38 * res);
  const h = addToonFolk(A, '', {
    cx: F(19.5, res), cz: F(18.5, res), y0: 4 * res, s: 1, res,
    shirt3: r3(C.teal, 3), pants3: r3(C.blue, 3), hair3: HAIR3, sig: 'hoodie',
  });
  return { name: nm, assembly: A, origin: [20 * res, 0, 19 * res], pivots: h.pivots, ao: 0.1 };
}

function buildToonPeople(res, nm) {
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
  return { name: nm, assembly: A, origin: [16 * res, 0, 12.5 * res], pivots, ao: 0.1 };
}

export function buildAll() {
  return [
    buildChar(), buildPeople(),
    buildToonHub(1, 'about_char_a'), buildToonPeople(1, 'involvement_people_a'),
    buildToonHub(2, 'about_char_b'), buildToonPeople(2, 'involvement_people_b'),
  ];
}
