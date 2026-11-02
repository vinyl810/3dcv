// Involvement & Service — a little stage: planked deck with a red skirt and
// gold trim, a soft glowing spotlight disc, a podium with a cyan note panel and
// a round gooseneck mic, and a two-pole teal bunting banner with a mentoring
// emblem (two people holding hands + a heart; two cloth halves that ripple).
import { Assembly, hash } from '../voxlib.mjs';
import { C, G } from '../palette.mjs';

export const name = 'involvement';


export function build() {
  const A = new Assembly(32, 34, 30);
  const base = A.part('base');
  const X0 = 2, X1 = 29, Z0 = 0, Z1 = 23, TOP = 3;

  // ------------------------------------------------------------ stage ---
  base.box(X0, 0, Z0, X1, TOP - 1, Z1, (x, y, z) => {
    const edge = x === X0 || x === X1 || z === Z0 || z === Z1;
    if (!edge) return C.wood[2];
    if (y === TOP - 1) return C.gold[5]; // gold trim band under the lip
    return (x + (y === 0 ? 1 : 0)) % 3 === 0 ? C.red[2] : C.red[3]; // pleated skirt
  });
  base.box(X0, TOP, Z0, X1, TOP, Z1, (x, y, z) => {
    if (x === X0 || x === X1 || z === Z0 || z === Z1) return C.gold[6];
    if (z % 3 === 0) return C.wood[4];
    return hash(Math.floor((x + (z % 2) * 4) / 8), z, 0, 5) < 0.5 ? C.wood[5] : C.wood[6];
  });
  // front steps
  base.box(12, 0, Z1 + 1, 19, 1, Z1 + 2, (x, y) => (y === 1 ? C.wood[6] : C.wood[4]));
  base.box(12, 0, Z1 + 3, 19, 0, Z1 + 3, C.wood[5]);
  // grass tufts at the footing
  for (let i = 0; i < 30; i++) {
    if (hash(i, 2, 0, 8) < 0.4) continue;
    const side = i % 3;
    const a = Math.floor(hash(i, 1, 0, 8) * 28) + 2;
    const [x, z] = side === 0 ? [a, Z0 - 1] : side === 1 ? [X0 - 1, Math.min(Z1, a)] : [X1 + 1, Math.min(Z1, a)];
    base.set(x, 0, z, hash(i, 3, 0, 8) < 0.5 ? C.grass[4] : C.grass[5]);
    if (hash(i, 4, 0, 8) < 0.4) base.set(x, 1, z, C.grass[6]);
  }

  // ------------------------------------------- spotlight (soft filled disc) ---
  // a warm pool of light on the planks: bright core, softer rim (kept clear of
  // the mentees at x≈6.5 / 25.5)
  const ring = A.part('ring');
  const RX = 15.5, RZ = 18;
  for (let z = 13; z <= 24; z++)
    for (let x = 9; x <= 22; x++) {
      const r = Math.hypot((x - RX) / 1.0, (z - RZ) / 0.8);
      if (r < 3.0) ring.set(x, TOP + 1, z, G.hot);
      else if (r < 4.6) ring.set(x, TOP + 1, z, G.lamp);
    }

  // ------------------------------------------------------------ podium ---
  const P = TOP + 1;
  base.box(11, P, 8, 20, P, 13, C.wood[3]); // foot
  base.box(12, P + 1, 9, 19, P + 8, 12, (x, y, z) => (z === 12 ? C.wood[5] : C.wood[4]));
  base.box(12, P + 8, 12, 19, P + 8, 12, C.gold[5]);
  // cyan note panel on the front
  base.box(13, P + 2, 13, 18, P + 6, 13, C.teal[0]);
  base.box(14, P + 5, 13, 17, P + 5, 13, G.screen);
  base.box(14, P + 3, 13, 16, P + 3, 13, G.screenHi);
  base.box(12, P + 1, 13, 19, P + 1, 13, C.gold[5]);
  // slanted top
  base.box(11, P + 9, 8, 20, P + 9, 13, C.wood[6]);
  base.box(11, P + 10, 8, 20, P + 10, 10, C.wood[6]);
  base.box(13, P + 10, 11, 16, P + 10, 12, C.sand[6]); // notes on the desk
  // mic: base clamp, thin gooseneck stalk rising and arching toward the
  // speaker, a ROUND grille head with a light rim
  // (on the right corner of the desk, head at chest height — clear of the speaker's face)
  base.box(19, P + 10, 11, 20, P + 10, 12, C.rock[2]); // clamp on the desk
  for (const [x, y, z] of [[20, P + 11, 12], [20, P + 12, 12], [20, P + 13, 11], [20, P + 14, 11]]) base.set(x, y, z, C.rock[1]);
  base.ellipsoid(20, P + 15.5, 10.5, 1.3, 1.3, 1.3, (x, y, z) => (y >= P + 16 ? C.rock[5] : z >= 11 ? C.rock[4] : C.rock[3]));
  // speaker's step behind the podium
  base.box(12, P, 3, 19, P + 1, 7, C.wood[3]);

  // ------------------------------------------------------ banner poles ---
  for (const px of [3, 28]) {
    base.box(px, P, 1, px, 21, 1, C.rock[2]);
    base.box(px - 1, P, 0, px + 1, P, 2, C.rock[3]);
    base.box(px, 22, 1, px, 22, 1, C.gold[6]);
    base.set(px, 23, 1, C.gold[5]);
  }
  // cloth: a TEAL banner with a cream trim — clearly unlike the violet/gold
  // awards banner. ONE big service/mentoring icon: two white hands cupping a
  // pink heart, with a dark outline so it reads at default zoom.
  const BY0 = 9, BY1 = 21; // raised so the icon clears the people's heads
  const segs = [['clothL', 4, 15], ['clothR', 16, 27]];
  const half = (x) => A.parts.find((p) => p.name === (x <= 15 ? 'clothL' : 'clothR')).grid;
  for (const [nm, a, b] of segs) {
    const g = A.part(nm);
    g.box(a, BY0, 1, b, BY1, 1, (x, y) => (y === BY1 || y === BY0 ? C.sand[6] : C.teal[3]));
  }
  // icon sits on the RIGHT half, beside the speaker (who stands centre-stage)
  const ICON = [ // top → bottom, 10 wide (cols 18..27); hands wrap UP the heart's
    '..HH..HH..', // y 18     sides so they stay visible above the mentee's head
    '.HHHHHHHH.',
    'WHHHHHHHHW',
    'WWHHHHHHWW',
    '.WWHHHHWW.',
    '..WWHHWW..',
    '...WWWW...', // y 12
  ];
  const icon = new Map();
  ICON.forEach((row, r) => [...row].forEach((ch, k) => { if (ch !== '.') icon.set(`${18 + k},${18 - r}`, ch); }));
  for (const [key, ch] of icon) {
    const [x, y] = key.split(',').map(Number);
    half(x).set(x, y, 2, ch === 'W' ? C.sand[7] : y >= 18 ? C.pink[6] : G.pinkGlow);
  }
  // 1-voxel dark outline around the icon (on the cloth plane)
  for (const [key] of icon) {
    const [x, y] = key.split(',').map(Number);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (icon.has(`${nx},${ny}`) || nx < 4 || nx > 27 || ny <= BY0 || ny >= BY1) continue;
      half(nx).set(nx, ny, 2, C.teal[0]);
    }
  }

  // ------------------------------------------------------------ people ---
  // Three rigged people (two mentees at the front corners + the speaker on a
  // step behind the podium) live in ./chars.mjs.
  const pivots = { base: [16, 0, 14], ring: [RX + 0.5, TOP + 1, RZ + 0.5] };
  // (the three people live in their own file — see ./chars.mjs)

  pivots.clothL = [4, (BY0 + BY1) / 2, 1.5];
  pivots.clothR = [28, (BY0 + BY1) / 2, 1.5];
  return {
    assembly: A,
    origin: [16, 0, 12.5],
    pivots,
    glow: { [G.goldGlow]: 0.9, [G.screen]: 1.0, [G.screenHi]: 1.0, [G.lamp]: 0.55, [G.hot]: 0.5, [G.pinkGlow]: 0.85 },
  };
}

