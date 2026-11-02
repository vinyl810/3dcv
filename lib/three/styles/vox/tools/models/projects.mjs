// Projects — an HCI / vision maker's workbench: a little camera on a tripod
// (vision), a folded research brain, a spinning gear on a mount, a small
// UI-wireframe screen, a blueprint, a screwdriver, and a floating idea bulb
// circled by sparkles.
import { Assembly, hash } from '../voxlib.mjs';
import { C, G } from '../palette.mjs';

export const name = 'projects';

export function build() {
  const A = new Assembly(28, 34, 28);
  const TOP = 10; // bench-top surface layer (items sit on y = TOP + 1)

  // ---------------------------------------------------------------- base ---
  const base = A.part('base');
  // planked pallet footing
  base.box(1, 0, 6, 26, 0, 21, (x, y, z) => ((x + 1) % 5 === 0 ? C.wood[2] : z % 2 ? C.wood[3] : C.wood[4]));
  // grass tufts around the pallet
  for (let i = 0; i < 50; i++) {
    const side = i % 4;
    const a = Math.floor(hash(i, 1, 0, 7) * 26);
    const x = side === 0 ? 0 : side === 1 ? 27 : 1 + a;
    const z = side === 2 ? 5 : side === 3 ? 22 : 6 + Math.min(a, 15);
    if (hash(i, 2, 0, 7) < 0.5) continue;
    base.set(x, 0, z, hash(i, 3, 0, 7) < 0.5 ? C.grass[4] : C.grass[5]);
    if (hash(i, 4, 0, 7) < 0.3) base.set(x, 1, z, C.grass[6]);
  }
  // legs
  for (const [lx, lz] of [[2, 8], [24, 8], [2, 18], [24, 18]]) base.box(lx, 1, lz, lx + 1, TOP - 2, lz + 1, (x) => (x === lx ? C.wood[3] : C.wood[2]));
  // lower shelf (empty — anything on it hid behind the apron)
  base.box(2, 3, 9, 25, 3, 18, (x, y, z) => (z === 18 ? C.wood[5] : C.wood[4]));
  // bench top (thick, warm, bright top face) with a darker front apron
  base.box(1, TOP - 1, 7, 26, TOP, 20, (x, y, z) => {
    if (y === TOP) return z === 20 || x === 1 || x === 26 ? C.wood[5] : (Math.floor(z / 3) % 2 ? C.wood[6] : C.wood[7]);
    return C.wood[3];
  });
  base.box(1, TOP - 1, 20, 26, TOP - 1, 20, C.wood[2]);

  const S = TOP + 1; // surface
  // blueprint sheet
  base.box(9, S, 15, 16, S, 19, (x, z) => C.blue[5]);
  base.box(10, S, 16, 15, S, 16, C.blue[7]); base.box(10, S, 18, 13, S, 18, C.blue[7]);
  base.set(15, S, 18, C.blue[7]);
  // screwdriver (front-left)
  base.box(2, S, 18, 5, S, 19, (x) => (x === 2 ? C.red[3] : C.red[5]));
  base.box(6, S, 18, 9, S, 18, C.rock[6]);
  base.set(10, S, 18, C.rock[4]);
  // camera tripod (back-left): three splayed legs up to a head plate
  for (const [lx, lz] of [[3, 9], [8, 9], [5, 14]])
    for (let k = 0; k <= 4; k++) {
      const t = k / 4;
      base.set(Math.round(lx + (5.5 - lx) * t), S + k, Math.round(lz + (11 - lz) * t), C.rock[2]);
    }
  base.box(4, S + 5, 10, 7, S + 5, 12, C.rock[3]);
  // brain dish
  base.cylY(12.5, 11.5, S, S, 3.2, C.teal[4]);
  base.cylY(12.5, 11.5, S, S, 2.2, C.teal[5]);
  // gear mount (back-right)
  base.box(19, S, 9, 23, S + 1, 11, (x, y) => (y === S + 1 ? C.rock[4] : C.rock[3]));
  base.box(21, S + 2, 10, 22, S + 5, 10, C.rock[3]);
  // UI-wireframe screen (front-right, a small monitor on a foot): white page,
  // blue header bar, an image box, text lines and a button — "an interface"
  base.box(20, S, 14, 23, S, 15, C.rock[2]); // foot
  base.box(21, S + 1, 15, 22, S + 1, 15, C.rock[2]); // neck
  base.box(17, S + 2, 16, 26, S + 9, 16, C.rock[1]); // bezel
  base.box(18, S + 3, 17, 25, S + 8, 17, C.sand[7]); // white page
  base.box(18, S + 8, 17, 25, S + 8, 17, C.blue[4]); // header bar
  base.set(19, S + 8, 18, C.sand[7]); base.set(24, S + 8, 18, C.red[5]); // logo + close dot
  base.box(18, S + 4, 17, 20, S + 6, 17, C.blue[6]); // image placeholder
  base.set(18, S + 4, 18, C.blue[3]); base.set(19, S + 5, 18, C.blue[3]); base.set(20, S + 6, 18, C.blue[3]); // its "X" stroke
  for (const y of [S + 6, S + 5]) base.box(22, y, 18, y === S + 6 ? 25 : 24, y, 18, C.rock[3]); // text lines
  base.box(22, S + 3, 18, 24, S + 3, 18, G.screen); // glowing button

  // ------------------------------------------------------------- parts ---
  // vision: a chunky camera on the tripod, lens toward the viewer
  const KX = 5.5, KY = S + 8, KZ = 11.5;
  const camera = A.part('camera');
  camera.box(2, S + 6, 9, 9, S + 10, 13, (x, y, z) => (y === S + 10 ? C.rock[3] : z === 13 ? C.rock[2] : C.rock[1]));
  camera.box(3, S + 11, 10, 5, S + 11, 12, C.rock[2]); // viewfinder hump
  camera.box(7, S + 11, 11, 8, S + 11, 11, C.red[4]); // shutter button
  camera.cylZ(KX, KY, 14, 15, 2.2, (x, y, z) => (z === 15 ? C.rock[5] : C.rock[4])); // lens barrel
  camera.cylZ(KX, KY, 16, 16, 1.4, (x, y) => (x <= KX && y > KY ? C.blue[6] : C.blue[2])); // glass + glare
  camera.set(Math.round(KX - 1), Math.round(KY + 1), 16, C.sand[7]); // catch-light
  camera.set(8, S + 9, 14, G.pinkGlow); // REC light

  const BX = 12.5, BY = S + 3, BZ = 11.5;
  const brain = A.part('brain');
  brain.ellipsoid(BX, BY, BZ, 4.8, 3.1, 3.8, (x, y, z) => {
    const dx = x + 0.5 - (BX + 0.5);
    if (Math.abs(dx) < 0.75 && y >= BY - 1) return 0; // deep central cleft
    if (Math.abs(dx) < 1.4) return C.pink[2]; // cleft walls in shadow
    // gyri: wavy grooves running front-to-back on each hemisphere
    const groove = Math.sin(z * 1.5 + Math.sin(x * 1.2 + y * 0.7) * 1.8) > 0.45;
    if (groove) return C.pink[2];
    return y >= BY + 1 ? C.pink[6] : C.pink[5];
  });
  for (const [x, y, z] of [[10, 15, 14], [15, 15, 13], [11, 16, 10], [14, 16, 12], [13, 14, 14]]) {
    // drop each glint onto the brain surface (topmost filled voxel in that column ≤ y)
    let yy = y;
    while (yy > S && !brain.get(x, yy, z)) yy--;
    brain.set(x, yy, z, (x + z) % 2 ? G.violetGlow : G.pinkGlow);
  }

  const QX = 21.5, QY = S + 9.5, QZ = 10;
  const gear = A.part('gear');
  for (let y = Math.floor(QY - 6); y <= QY + 6; y++)
    for (let x = Math.floor(QX - 6); x <= QX + 6; x++) {
      const dx = x - QX, dy = y - QY, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      const tooth = Math.cos(a * 8) > 0.35;
      if (r <= 1.2) gear.box(x, y, QZ - 1, x, y, QZ + 1, C.gold[5]);
      else if (r <= 3.8 || (tooth && r <= 5.2)) gear.box(x, y, QZ, x, y, QZ + 1, r > 3.2 ? C.rock[7] : C.rock[6]);
      else if (r <= 4.0) gear.box(x, y, QZ, x, y, QZ + 1, C.rock[5]);
    }
  // cut-outs
  for (const [ax, ay] of [[2.2, 0], [-2.2, 0], [0, 2.2], [0, -2.2]]) gear.box(QX + ax, QY + ay, QZ, QX + ax, QY + ay, QZ + 1, 0);

  // floating idea bulb
  const LX = 15.5, LY = S + 17, LZ = 14;
  const bulb = A.part('bulb');
  bulb.sphere(LX, LY, LZ, 2.6, (x, y, z) => (y >= LY + 1 && x <= LX && z >= LZ ? G.hot : G.lamp));
  bulb.box(LX - 1, LY - 4, LZ - 1, LX + 1, LY - 3, LZ + 1, (x, y) => (y === LY - 3 ? C.rock[6] : C.rock[4]));
  bulb.set(LX, LY - 5, LZ, C.rock[3]);

  const sparkPos = [[LX - 5, LY + 2, LZ], [LX + 5, LY + 1, LZ], [LX, LY + 5, LZ - 1], [LX + 1, LY - 2, LZ + 4]];
  sparkPos.forEach(([x, y, z], i) => {
    const sp = A.part(`spark${i}`);
    const c = i % 2 ? G.goldGlow : G.screenHi;
    sp.set(x, y, z, c); sp.set(x + 1, y, z, c); sp.set(x - 1, y, z, c); sp.set(x, y + 1, z, c); sp.set(x, y - 1, z, c);
  });

  return {
    assembly: A,
    origin: [14, 0, 14],
    pivots: {
      base: [14, 0, 14],
      camera: [KX + 0.5, S + 6, KZ + 0.5],
      brain: [BX + 0.5, S, BZ + 0.5],
      gear: [QX + 0.5, QY + 0.5, QZ + 1],
      bulb: [LX + 0.5, LY + 0.5, LZ + 0.5],
      ...Object.fromEntries(sparkPos.map(([x, y, z], i) => [`spark${i}`, [x + 0.5, y + 0.5, z + 0.5]])),
    },
    glow: { [G.lamp]: 1.1, [G.hot]: 1.2, [G.violetGlow]: 1.0, [G.screen]: 0.9, [G.pinkGlow]: 1.2 },
    meta: { bulb: [LX + 0.5, LY + 0.5, LZ + 0.5] },
  };
}
