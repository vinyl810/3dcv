// Rigged humanoid generator shared by every character in the vox style.
//
// A humanoid = 15 named parts (bones), each its own MagicaVoxel object so it can
// rotate at its joint:
//   hips (root) ─ torso ─ head
//                    ├─ upperArmL ─ forearmL ─ handL      (L = +x side)
//                    └─ upperArmR ─ forearmR ─ handR      (R = −x side)
//        ├─ thighL ─ shinL ─ footL
//        └─ thighR ─ shinR ─ footR
// Every limb segment is a CAPSULE that starts with a rounded joint cap whose
// centre IS the pivot (shoulder/elbow/wrist/hip/knee/ankle). Rotating a sphere
// about its own centre leaves it in place, so bends never open a gap. The bind
// pose is a relaxed stance (arms hanging, legs straight); all poses are joint
// rotations applied at runtime (see ../rig.ts).
//
// RESOLUTION: characters are authored at `res`× the landmark voxel density
// (CHAR_RES in ../assets.ts, = 2). Pass coordinates in that finer grid; all
// body dimensions scale with s × res, and the face/hair/clothing switch to a
// detailed treatment once there are enough voxels to hold it.
//
// Shapes are sampled at integer cells; a cell (x,y,z) occupies [x,x+1] in mesh
// space, so the pivots we emit are the intended centres + 0.5.

import { hash } from './voxlib.mjs';
import { C, G } from './palette.mjs';

export const BONES = [
  'hips', 'torso', 'head',
  'upperArmL', 'forearmL', 'handL', 'upperArmR', 'forearmR', 'handR',
  'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR',
];

function capsule(g, a, b, r0, r1, c) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const n = Math.max(2, Math.ceil(len * 3));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    g.sphere(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, r0 + (r1 - r0) * t, c);
  }
}

// 5 hair shades, dark → light (ink, hairD, hair, hairL, warm sheen)
const HAIR5 = [C.body[7], G.hairD, G.hair, G.hairL, C.earth[3]];

/**
 * opts: { cx, cz (body axis; use k+0.5 for symmetric even widths), y0 (soles),
 *         s (1 = 30-unit hub adult, ~0.63 = small figure), res (voxel density, default 1),
 *         shirt, pants (ramps), shoe, hair: [base, light], style: 'short'|'long'|'tuft', hood }
 */
export function addHumanoid(A, pre, o) {
  const res = o.res ?? 1;
  const s = (o.s ?? 1) * res;
  const fine = s >= 1.2; // enough voxels for the detailed face/clothes
  const { cx, cz, y0 } = o;
  const shirt = o.shirt ?? C.teal, pants = o.pants ?? C.blue;
  const [hairC, hairL] = o.hair ?? [G.hair, G.hairL];
  const R = (v, min = 0.88) => Math.max(min, v * s);
  const Y = (v) => y0 + v * s;
  const front = (z, r) => z >= cz + r - 0.9;
  const H5 = o.hair5 ?? HAIR5;
  const hoodie = o.hood !== false && (o.s ?? 1) > 0.8;

  const hipX = Math.max(1.1, 1.55 * s), shX = 4.7 * s;
  const J = {
    ankleY: Y(2.2), kneeY: Y(7.2), hipY: Y(11.8), waistY: Y(13.0),
    shoulderY: Y(18.6), elbowY: Y(14.8), wristY: Y(11.2), neckY: Y(20.2), headY: Y(24.6),
  };
  const P = (n) => A.part(pre + n);
  const pv = {};
  const pivot = (n, x, y, z) => { pv[pre + n] = [x + 0.5, y + 0.5, z + 0.5]; };
  /** frontmost filled z of column (x,y) in grid g */
  const frontZ = (g, x, y) => { for (let z = Math.ceil(cz + 12 * s); z >= 0; z--) if (g.get(x, y, z)) return z; return -1; };
  const onFront = (g, x, y, c, out = 0) => { const z = frontZ(g, x, y); if (z >= 0) g.set(x, y, z + out, c); };

  // ---------------------------------------------------------------- legs ---
  for (const [side, sx] of [['L', 1], ['R', -1]]) {
    const x = cx + sx * hipX;
    const thigh = P('thigh' + side), shin = P('shin' + side), foot = P('foot' + side);
    const pc = (xx, zz, r) => {
      if (fine && Math.abs(xx - (x + sx * r * 0.85)) < 0.6) return pants[4]; // outer seam stitch
      return front(zz, r) ? pants[3] : pants[2];
    };
    capsule(thigh, [x, J.hipY, cz], [x, J.kneeY, cz], R(1.45), R(1.25), (xx, yy, zz) => pc(xx, zz, R(1.4)));
    pivot('thigh' + side, x, J.hipY, cz);
    shin.sphere(x, J.kneeY, cz, R(1.28), (xx, yy, zz) => pc(xx, zz, R(1.28))); // knee cap
    capsule(shin, [x, J.kneeY, cz], [x, J.ankleY + 0.6 * s, cz], R(1.2), R(1.15), (xx, yy, zz) => pc(xx, zz, R(1.15)));
    if (fine) shin.cylY(x, cz, Math.round(J.ankleY + 0.4 * s), Math.round(J.ankleY + 0.9 * s), R(1.3), pants[1]); // rolled hem
    pivot('shin' + side, x, J.kneeY, cz);
    // foot: ankle cap + rounded shoe (dark upper, white sole, toe cap, laces)
    foot.sphere(x, J.ankleY, cz, R(1.0), o.shoe ?? C.rock[1]);
    const soleTop = Math.floor(Y(0.5)), top = Math.floor(Y(1.7));
    for (let yy = Math.floor(y0); yy <= top; yy++)
      foot.cylY(x, cz + R(0.7, 0.4), yy, yy, R(1.25) - (yy === top ? 0.35 : 0), (xx, y2, zz) => {
        if (y2 <= soleTop) return C.sand[6]; // sole
        if (fine && zz >= cz + R(1.9) + R(0.7, 0.4) - 1.2 && y2 === soleTop + 1) return C.sand[5]; // toe cap
        return o.shoe ?? C.rock[1];
      }, R(1.9));
    if (fine) for (let k = 0; k < 2; k++) onFront(foot, Math.round(x - 0.5) + (k ? 1 : 0), top, C.sand[7], 0); // laces
    pivot('foot' + side, x, J.ankleY, cz);
  }

  // ---------------------------------------------------------------- hips ---
  const hips = P('hips');
  hips.ellipsoid(cx, J.hipY + 0.3 * s, cz, R(3.0), R(1.8), R(2.2), (x, y, z) =>
    (y >= J.hipY + 1.1 * s ? (fine && Math.abs(x - cx) < 0.6 ? C.gold[5] : C.rock[1]) : front(z, R(2.2)) ? pants[3] : pants[2]));
  pivot('hips', cx, J.hipY, cz);

  // --------------------------------------------------------------- torso ---
  const torso = P('torso');
  const rowOf = (y) => {
    const t = (y - J.waistY) / (J.shoulderY - J.waistY); // 0 waist → 1 shoulders
    const rx = R(t < 0.7 ? 3.0 + 1.0 * Math.sin((Math.max(0, t) / 0.7) * Math.PI / 2) : 4.0 - 3.2 * ((t - 0.7) / 0.6) ** 1.6, 0.8);
    const rz = R(t < 0.7 ? 2.2 + 0.4 * Math.max(0, t) / 0.7 : 2.6 - 2.2 * (t - 0.7) ** 1.5, 0.8);
    return [rx, rz];
  };
  const hem0 = Math.floor(J.waistY - 1);
  for (let y = hem0; y <= Math.ceil(J.shoulderY + 1.8 * s); y++) {
    const [rx, rz] = rowOf(y);
    if (rx <= 0.5 || rz <= 0.5) continue;
    torso.cylY(cx, cz, y, y, rx, (x, yy, z) => {
      if (yy <= hem0 + (fine ? 1 : 0)) return shirt[2]; // ribbed hem band
      if (fine && Math.abs(Math.abs(x - cx) - (rx - 0.5)) < 0.6 && z < cz + rz - 1) return shirt[2]; // side seams
      if (front(z, rz)) return shirt[4];
      return Math.abs(x - cx) > rx - 0.9 ? shirt[2] : shirt[3];
    }, rz);
  }
  for (const sx of [1, -1]) torso.sphere(cx + sx * (shX - 0.8 * s), J.shoulderY + 0.2 * s, cz, R(1.3), shirt[3]); // deltoids
  if (hoodie) {
    // hood bunched behind the neck (a soft roll)
    torso.ellipsoid(cx, J.shoulderY + 1.2 * s, cz - 1.5 * s, R(2.9), R(1.1), R(1.2), shirt[2]);
    if (fine) torso.ellipsoid(cx, J.shoulderY + 1.5 * s, cz - 1.2 * s, R(2.0), R(0.6), R(0.6), shirt[1]); // hood opening shadow
    // drawstrings with aglets
    for (const sx of [-1, 1]) {
      const x = Math.round(cx + sx * 1.1 * s - 0.5 * (sx > 0 ? 1 : 0));
      const yTop = Math.round(J.shoulderY + 0.6 * s), yBot = Math.round(J.shoulderY - 2.6 * s);
      for (let y = yBot; y <= yTop; y++) onFront(torso, x, y, C.sand[6], 1);
      onFront(torso, x, yBot - 1, C.rock[5], 1);
    }
    // kangaroo pocket: seam outline + slightly darker pouch
    const py0 = Math.round(J.waistY + 0.3 * s), py1 = Math.round(J.waistY + 2.6 * s);
    const pw = Math.round(2.3 * s);
    for (let y = py0; y <= py1; y++)
      for (let x = Math.round(cx - pw); x <= Math.round(cx + pw) - 1; x++) {
        const edge = y === py1 || x === Math.round(cx - pw) || x === Math.round(cx + pw) - 1;
        if (fine) onFront(torso, x, y, edge ? shirt[2] : shirt[3]);
        else if (y === py1) onFront(torso, x, y, shirt[2], 1);
      }
  }
  pivot('torso', cx, J.waistY, cz);

  // ---------------------------------------------------------------- arms ---
  for (const [side, sx] of [['L', 1], ['R', -1]]) {
    const x = cx + sx * shX;
    const ua = P('upperArm' + side), fa = P('forearm' + side), hand = P('hand' + side);
    capsule(ua, [x, J.shoulderY, cz], [x + sx * 0.3 * s, J.elbowY, cz], R(1.2), R(1.05), (xx, yy, zz) => (front(zz, R(1.1)) ? shirt[4] : shirt[3]));
    pivot('upperArm' + side, x, J.shoulderY, cz);
    const ex = x + sx * 0.3 * s;
    fa.sphere(ex, J.elbowY, cz, R(1.1), shirt[3]); // elbow cap
    capsule(fa, [ex, J.elbowY, cz], [ex, J.wristY + 0.6 * s, cz], R(1.0), R(0.9), (xx, yy, zz) => (front(zz, R(0.95)) ? shirt[4] : shirt[3]));
    for (let k = 0; k < (fine ? 2 : 1); k++) fa.cylY(ex, cz, Math.round(J.wristY + 0.6 * s) - k, Math.round(J.wristY + 0.6 * s) - k, R(1.05), shirt[2]); // ribbed cuff
    pivot('forearm' + side, ex, J.elbowY, cz);
    hand.sphere(ex, J.wristY, cz, R(0.85), G.skinM); // wrist
    hand.ellipsoid(ex, J.wristY - 1.0 * s, cz + 0.2, R(1.05), R(1.2), R(1.0), (xx, yy, zz) => (zz > cz + 0.4 ? G.skin : G.skinM));
    if (fine) hand.ellipsoid(ex - sx * 0.2 * s, J.wristY - 0.9 * s, cz + 1.0 * s, R(0.45), R(0.6), R(0.45), G.skin); // thumb
    pivot('hand' + side, ex, J.wristY, cz);
  }

  // ---------------------------------------------------------------- head ---
  const head = P('head');
  head.cylY(cx, cz, Math.floor(J.neckY - 0.8 * s), Math.ceil(J.headY - 2.5 * s), R(1.0), G.skinM); // neck (overlaps torso)
  const HY = J.headY;
  const hrx = R(3.5, 2.8), hry = R(3.3, 2.5), hrz = R(3.3, 2.4);
  // skull: slightly narrower jaw (taper below the cheeks)
  head.ellipsoid(cx, HY, cz, hrx, hry, hrz, (x, y, z) => {
    const jaw = y < HY - 0.35 * hry && Math.abs(x - cx) > hrx * (0.62 + 0.38 * (y - (HY - hry)) / (0.65 * hry));
    if (fine && jaw) return 0;
    return z >= cz + hrz - 1.3 ? G.skin : G.skinM;
  });
  // ears
  for (const sx of [-1, 1]) head.ellipsoid(cx + sx * (hrx - 0.15), HY - 0.15 * hry, cz, Math.max(0.9, 0.35 * s), Math.max(0.9, 0.6 * s), Math.max(0.9, 0.4 * s), (x, y, z) => (Math.abs(x - cx) > hrx + 0.3 ? G.skinM : G.skinS));
  // hair cap (no curtain: below the brow, hair only behind the ears)
  const shade = (x, y, z) => {
    // 5-step hand shading: lighter up + toward the camera, darker underneath / back; strands
    const v = (y - HY) / hry * 0.8 + (z - cz) / hrz * 0.35 + (x - cx) / hrx * 0.15;
    const strand = hash(Math.round(x), Math.round(z), 0, 17) < 0.28 ? -1 : 0;
    const i = Math.max(0, Math.min(4, Math.round(1.8 + v * 1.6) + strand));
    return fine ? H5[i] : (y >= HY + hry - 0.4 && hash(x, z, 2, 7) < 0.3 ? hairL : hairC);
  };
  head.ellipsoid(cx, HY + 0.7 * s, cz - 0.3, hrx + 0.5, hry + 0.15, hrz + 0.5, (x, y, z) => {
    const face = z >= cz - 0.5 && y <= HY + (fine ? 0.5 * hry : 1) && Math.abs(x - cx) < hrx + 0.1;
    if (face) return head.get(x, y, z) || 0;
    if (y < HY && z > cz - 1.2) return head.get(x, y, z) || 0;
    return (shade(x, y, z));
  });
  const fy = Math.round(HY - (fine ? 0.12 * hry : 0)); // eye line
  const L = (i) => Math.round(cx - 0.5 - i), Rr = (i) => Math.round(cx + 0.5 + i);
  const put = (x, y, c) => onFront(head, x, y, c, 0);
  if (fine) {
    const big = hrx >= 5.5;
    // swept fringe: strands of varying length falling onto the forehead
    const browY = fy + (big ? 3 : 2);
    const fTop = browY + 2; // fringe ends just above the brows
    for (let x = Math.round(cx - hrx + 1); x <= Math.round(cx + hrx - 1); x++) {
      const outer = Math.abs(x + 0.5 - cx) > hrx * 0.55;
      const len = 1 + (hash(x, 3, 0, 23) < 0.5 ? 1 : 0) + (outer ? 1 : 0);
      for (let k = 0; k < len; k++) put(x, fTop - k + 1, H5[k === len - 1 ? 1 : 2]);
    }
    // sideburns
    for (const sx of [-1, 1]) for (let k = 0; k < (big ? 3 : 2); k++) put(sx < 0 ? L(Math.floor(hrx) - 1) : Rr(Math.floor(hrx) - 1), fy + 1 - k, (H5[1]));
    // eyes: 2 wide × (3 big | 2 small), dark iris with a catch-light, white sclera hint
    const eyeI = big ? [2, 3] : [1, 2], eh = big ? 3 : 2;
    for (const side of [L, Rr]) {
      for (const i of eyeI) for (let k = 0; k < eh; k++) put(side(i), fy + 1 - k, G.ink);
      put(side(eyeI[1]), fy + 1, C.sand[7]); // catch-light (upper-outer)
      if (big) put(side(eyeI[0]), fy - 1, C.blue[2]); // iris tint at the bottom-inner
    }
    // brows
    for (const side of [L, Rr]) for (const i of (big ? [2, 3] : [1, 2])) put(side(i), browY, H5[2]); // soft brows over the eyes
    // nose hint (one shade darker, centre)
    put(L(0), fy - (big ? 2 : 1), G.skinS); put(Rr(0), fy - (big ? 2 : 1), G.skinS);
    // cheeks
    for (const side of [L, Rr]) for (const i of (big ? [3, 4] : [2])) put(side(i), fy - (big ? 2 : 1), C.pink[6]);
    // smiling mouth
    const my = fy - 3;
    for (const side of [L, Rr]) { put(side(0), my, C.red[3]); if (big) { put(side(1), my, C.red[3]); put(side(2), my + 1, C.red[3]); } }
  } else {
    const exL = Math.round(cx - 1.5), exR = Math.round(cx + 1.5);
    for (const ex of [exL, exR]) { put(ex, fy, G.ink); put(ex, fy - 1, G.ink); }
    if (s > 0.8) put(exL, fy, C.sand[7]);
    put(exL - 1, fy - 2, C.pink[6]); put(exR + 1, fy - 2, C.pink[6]);
    put(Math.round(cx - 0.5), fy - 2, C.red[3]); put(Math.round(cx + 0.5), fy - 2, C.red[3]);
  }
  if (o.style === 'tuft' || o.style === 'short') { // cowlick
    head.set(Math.round(cx), Math.round(HY + hry + 0.9 * s), Math.floor(cz), (H5[2]));
    if (fine) head.set(Math.round(cx) + 1, Math.round(HY + hry + 0.9 * s) + 1, Math.floor(cz) - 1, (H5[3]));
  }
  if (o.style === 'long') // ponytail at the back
    for (let y = Math.floor(HY - hry - 0.5); y <= Math.floor(HY + 0.5); y++) head.cylY(cx, cz - hrz - 0.4, y, y, R(0.9), y < HY - 1 ? (H5[3]) : (H5[2]), R(0.9));
  pivot('head', cx, J.neckY, cz);

  return { pivots: pv, joints: J, shoulderX: shX, hipX };
}
