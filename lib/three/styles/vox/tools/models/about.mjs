// About / Contact — chibi Daewon on a raised two-tier hub dais (stone footing +
// planked top), waving, holding a tablet (wave + neuron motif), with a warm
// deck lamp, a potted plant, a book stack and a floating holo ID badge.
// Parts: deck (static) · body · head · armR (wave) · armL (+tablet) · plate.
import { Assembly, hash } from '../voxlib.mjs';
import { C, G } from '../palette.mjs';

export const name = 'about';

export function build() {
  const A = new Assembly(44, 40, 38);
  const CX = 19.5, CZ = 18.5; // dais centre (cell-centred → origin at 20,_,19)

  // ---------------------------------------------------------------- dais ---
  const deck = A.part('deck');
  deck.cylY(CX, CZ, 0, 1, 13.5, (x, y, z) => {
    const r = hash(x, y, z, 3);
    if (y === 1) return r < 0.25 ? C.rock[6] : C.rock[5];
    return r < 0.3 ? C.rock[3] : C.rock[4];
  });
  deck.cylY(CX, CZ, 2, 3, 11.4, (x, y, z) => {
    const rr = Math.hypot(x - CX, z - CZ);
    if (y < 3) return rr > 10.6 ? C.wood[3] : C.wood[2];
    if (rr > 10.4) return C.wood[4]; // trim ring
    const row = Math.floor((z + 1) / 3);
    if ((z + 1) % 3 === 0) return C.wood[4]; // plank seam
    if ((x + row * 5) % 11 === 0) return C.wood[4];
    return row % 2 ? C.wood[6] : C.wood[5];
  });
  // front step up onto the planks
  deck.box(16, 2, 29, 23, 2, 31, (x, y, z) => (z === 31 ? C.wood[5] : C.wood[6]));
  // grass tufts hugging the footing
  for (let a = 0; a < 44; a++) {
    const t = (a / 44) * Math.PI * 2;
    if (hash(a, 1, 1, 4) < 0.45) continue;
    const x = Math.round(CX + Math.cos(t) * 14.1), z = Math.round(CZ + Math.sin(t) * 14.1);
    deck.set(x, 0, z, hash(a, 2, 2, 4) < 0.5 ? C.grass[4] : C.grass[5]);
    if (hash(a, 3, 3, 4) < 0.4) deck.set(x, 1, z, C.grass[6]);
  }
  const D = 4; // dais top (standing height)
  // deck lamp (front-right, on the stone ring; short so it never covers the
  // KAIST plaque behind) — its night light falls on the face
  const LX = 30, LZ = 25, LB = 2;
  deck.box(LX - 1, LB, LZ - 1, LX + 1, LB, LZ + 1, C.rock[2]);
  deck.box(LX, LB + 1, LZ, LX, LB + 8, LZ, C.rock[2]);
  deck.box(LX - 1, LB + 9, LZ - 1, LX + 1, LB + 9, LZ + 1, C.rock[1]);
  deck.box(LX - 1, LB + 10, LZ - 1, LX + 1, LB + 12, LZ + 1, G.lamp);
  deck.set(LX, LB + 11, LZ + 1, G.hot);
  deck.box(LX - 2, LB + 13, LZ - 2, LX + 2, LB + 13, LZ + 2, C.rock[1]);
  deck.set(LX, LB + 14, LZ, C.rock[2]);
  // potted plant (back-right, well away from the tablet hand)
  deck.box(26, D, 12, 28, D + 2, 14, C.red[3]);
  deck.box(26, D + 2, 12, 28, D + 2, 14, C.red[4]);
  deck.box(27, D + 3, 13, 27, D + 4, 13, C.leaf[4]);
  deck.ellipsoid(27, D + 5.5, 13, 2, 1.6, 2, (x, y) => (y >= D + 6 ? C.leaf[6] : C.leaf[5]));
  // coffee mug (back-left) — the researcher's fuel (books live in coursework/publications)
  deck.cylY(11, 13, D, D + 3, 1.6, (x, y) => (y === D + 3 ? C.sand[6] : C.sand[5]));
  deck.cylY(11, 13, D + 3, D + 3, 0.8, C.earth[1]); // coffee
  deck.box(13, D + 1, 13, 13, D + 2, 13, C.sand[5]); // handle
  deck.set(11, D + 1, 15, C.red[4]); // logo dot

  // ------------------------------------------------------------- character ---
  // Fully rigged humanoid (15 bones, see ../humanoid.mjs) + a tablet part that
  // the runtime parents to the right hand.
  // (the character lives in its own file — see ./chars.mjs)
  const tab = A.part('tablet');
  const tx0 = 2, tx1 = 7, ty0 = 26, ty1 = 30, tz = 34; // authored off to the side; placed at runtime
  tab.box(tx0, ty0, tz - 1, tx1, ty1, tz, C.rock[1]);
  tab.box(tx0 + 1, ty0 + 1, tz, tx1 - 1, ty1 - 1, tz, C.teal[0]);
  const wave = [0, 1, 1, 0];
  for (let i = 0; i < 4; i++) tab.set(tx0 + 1 + i, ty0 + 1 + wave[i], tz, G.screen); // signal wave
  tab.set(tx1 - 1, ty1 - 1, tz, G.pinkGlow); // neuron
  tab.set(tx1 - 2, ty1 - 1, tz, G.violetGlow);

  // -------------------------------------------- floating holo ID badge ---
  const plate = A.part('plate');
  const px0 = 29, px1 = 40, py0 = 22, py1 = 30, pz = 13;
  plate.box(px0, py0, pz, px1, py1, pz, G.holo);
  plate.frame(px0, py0, pz, px1, py1, pz, G.screen);
  const at = ['01110', '10001', '10111', '10101', '10111', '10000', '01110'];
  at.forEach((row, r) => [...row].forEach((b, k) => b === '1' && plate.set(px0 + 1 + k, py1 - 1 - r, pz, G.screenHi)));
  plate.box(px0 + 7, py1 - 2, pz, px1 - 1, py1 - 2, pz, G.screenHi);
  plate.box(px0 + 7, py1 - 4, pz, px1 - 2, py1 - 4, pz, G.screen);
  plate.box(px0 + 7, py1 - 6, pz, px1 - 1, py1 - 6, pz, G.pinkGlow);

  return {
    assembly: A,
    origin: [20, 0, 19],
    pivots: {
      deck: [20, 0, 19],
      tablet: [tx1 + 1, (ty0 + ty1 + 1) / 2, tz],
      plate: [34.5, 26, 13.5],
    },
    glow: { [G.lamp]: 1.0, [G.screen]: 1.1, [G.pinkGlow]: 1.0 },
    meta: { lamp: [LX - 1.5, LB + 11.5, LZ + 0.5] },
  };
}

