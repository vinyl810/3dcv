// Stylized "toon folk" humanoids: simple, iconic, world-matching figures
// (think Crossy Road / A Short Hike / Townscaper people). Same 15-bone rig
// contract as humanoid.mjs (hips, torso, head, upperArm/forearm/hand L+R,
// thigh/shin/foot L+R; joint-cap spheres centred on every pivot), but:
//   • head ≈ 1/3.2 of the height, soft rounded-box head + torso (superellipsoids)
//   • chunky capsule limbs, mitten hands, block shoes — no anatomy detail
//   • minimal face: two dark eyes (+1 highlight at res 2), blush, tiny mouth
//   • hand-placed 3-tone shading per material (lit top / base / shade); skin
//     only uses the 3 LIGHT warm shades so faces never go dark or muddy
//   • one signature detail each (hoodie + drawstrings, cap, ponytail)
// `res` = voxel density relative to landmarks (1 → 0.125, 2 → 0.0625).
import { C, G } from './palette.mjs';

function capsule(g, a, b, r0, r1, c) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const n = Math.max(2, Math.ceil(len * 3));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    g.sphere(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, r0 + (r1 - r0) * t, c);
  }
}
/** soft rounded box: |dx/rx|^n + |dy/ry|^n + |dz/rz|^n <= 1 */
function superEllipsoid(g, cx, cy, cz, rx, ry, rz, n, c) {
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
    for (let z = Math.floor(cz - rz - 1); z <= Math.ceil(cz + rz + 1); z++)
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const q = Math.abs((x - cx) / rx) ** n + Math.abs((y - cy) / ry) ** n + Math.abs((z - cz) / rz) ** n;
        if (q <= 1) g.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c);
      }
}
/** 3-tone shading from a ramp [shade, base, lit] by surface position. */
const tone3 = (ramp3, v) => (v > 0.45 ? ramp3[2] : v < -0.55 ? ramp3[0] : ramp3[1]);

const SKIN = [G.skinM, G.skin, G.skinL];

/**
 * opts: { cx, cz, y0 (fine coords; cx/cz should be k+0.5), s (1 = hub adult),
 *         res, shirt3, pants3, hair3 (3-index ramps: shade/base/lit), shoe,
 *         sig: 'hoodie' | 'cap' | 'ponytail', cap3 }
 */
export function addToonFolk(A, pre, o) {
  const res = o.res ?? 1;
  const s = (o.s ?? 1) * res;
  const { cx, cz, y0 } = o;
  const R = (v, min = 0.9) => Math.max(min, v * s);
  const Y = (v) => y0 + v * s;
  const shirt3 = o.shirt3, pants3 = o.pants3, hair3 = o.hair3;
  const P = (n) => A.part(pre + n);
  const pv = {};
  const pivot = (n, x, y, z) => { pv[pre + n] = [x + 0.5, y + 0.5, z + 0.5]; };
  const frontZ = (g, x, y) => { for (let z = Math.ceil(cz + 10 * s); z >= 0; z--) if (g.get(x, y, z)) return z; return -1; };
  const onFront = (g, x, y, c, out = 0) => { const z = frontZ(g, x, y); if (z >= 0) g.set(x, y, z + out, c); };

  // joints (units of the 26-tall hub body)
  const J = {
    ankleY: Y(1.9), kneeY: Y(4.9), hipY: Y(8.3), waistY: Y(9.4),
    shoulderY: Y(15.4), elbowY: Y(12.6), wristY: Y(10.0), neckY: Y(16.6), headY: Y(20.5),
  };
  const hipX = 2.5 * s, shX = 4.6 * s;
  // light-ish shading value from a local offset (up + toward camera)
  const lv = (dy, ry, dz, rz) => (dy / ry) * 0.8 + (dz / rz) * 0.45;

  // ---------------------------------------------------------------- legs ---
  for (const [side, sx] of [['L', 1], ['R', -1]]) {
    const x = cx + sx * hipX;
    const thigh = P('thigh' + side), shin = P('shin' + side), foot = P('foot' + side);
    const pc = (xx, yy, zz) => tone3(pants3, lv(0, 1, zz - cz, R(1.6)));
    capsule(thigh, [x, J.hipY, cz], [x, J.kneeY, cz], R(1.45), R(1.4), pc);
    pivot('thigh' + side, x, J.hipY, cz);
    shin.sphere(x, J.kneeY, cz, R(1.4), pc);
    capsule(shin, [x, J.kneeY, cz], [x, J.ankleY, cz], R(1.4), R(1.3), pc);
    pivot('shin' + side, x, J.kneeY, cz);
    // chunky block shoe with a white sole
    foot.sphere(x, J.ankleY, cz, R(1.3), o.shoe ?? C.rock[2]);
    superEllipsoid(foot, x, Y(0.9), cz + 0.5 * s, R(1.75), R(1.0), R(2.4), 3, (xx, yy, zz) =>
      (yy <= Math.floor(y0) + Math.max(0, res - 1) ? C.sand[6] : yy >= Y(1.4) ? (o.shoeLit ?? C.rock[3]) : (o.shoe ?? C.rock[2])));
    pivot('foot' + side, x, J.ankleY, cz);
  }

  // ---------------------------------------------------------------- hips ---
  const hips = P('hips');
  superEllipsoid(hips, cx, J.hipY + 0.4 * s, cz, R(3.5), R(1.6), R(2.5), 3, (x, y, z) => tone3(pants3, lv(y - J.hipY, R(1.6), z - cz, R(2.5)) + 0.2));
  pivot('hips', cx, J.hipY, cz);

  // --------------------------------------------------------------- torso ---
  const torso = P('torso');
  const tcy = (J.waistY + J.shoulderY + 1.2 * s) / 2, tRy = (J.shoulderY + 1.2 * s - J.waistY + 1) / 2;
  superEllipsoid(torso, cx, tcy, cz, R(3.9), tRy, R(2.6), 3.2, (x, y, z) => {
    if (y <= J.waistY) return shirt3[0]; // hem band
    return tone3(shirt3, lv(y - tcy, tRy, z - cz, R(2.6)));
  });
  if (o.sig === 'hoodie') {
    superEllipsoid(torso, cx, J.shoulderY + 1.2 * s, cz - 1.6 * s, R(3.0), R(1.2), R(1.3), 2.5, shirt3[0]); // hood roll
    for (const sx of [-1, 1]) { // two drawstrings
      const x = Math.round(cx + sx * 1.0 * s - (sx > 0 ? 1 : 0));
      for (let y = Math.round(J.shoulderY - 2.4 * s); y <= Math.round(J.shoulderY + 0.4 * s); y++) onFront(torso, x, y, C.sand[7], 1);
    }
  }
  pivot('torso', cx, J.waistY, cz);

  // ---------------------------------------------------------------- arms ---
  for (const [side, sx] of [['L', 1], ['R', -1]]) {
    const x = cx + sx * shX;
    const ua = P('upperArm' + side), fa = P('forearm' + side), hand = P('hand' + side);
    const sc = (xx, yy, zz) => tone3(shirt3, lv(0, 1, zz - cz, R(1.4)) + 0.15);
    capsule(ua, [x, J.shoulderY, cz], [x, J.elbowY, cz], R(1.45), R(1.35), sc);
    pivot('upperArm' + side, x, J.shoulderY, cz);
    fa.sphere(x, J.elbowY, cz, R(1.35), sc);
    capsule(fa, [x, J.elbowY, cz], [x, J.wristY + 0.4 * s, cz], R(1.35), R(1.25), sc);
    pivot('forearm' + side, x, J.elbowY, cz);
    hand.sphere(x, J.wristY - 0.5 * s, cz, R(1.35), (xx, yy, zz) => (zz > cz + 0.5 ? SKIN[2] : SKIN[1])); // mitten
    pivot('hand' + side, x, J.wristY, cz);
  }

  // ---------------------------------------------------------------- head ---
  const head = P('head');
  const HY = J.headY, hrx = R(4.0), hry = R(3.7), hrz = R(3.7);
  head.cylY(cx, cz, Math.floor(J.neckY - 1.2 * s), Math.ceil(HY - hry + 1), R(1.3), SKIN[0]); // short neck into the torso
  superEllipsoid(head, cx, HY, cz, hrx, hry, hrz, 2.6, (x, y, z) => (z >= cz + hrz * 0.55 || y > HY + hry * 0.4 ? SKIN[2] : SKIN[1]));
  // hair: a slightly larger rounded cap over the top / back / sides, blocky fringe
  const hairTop = (y) => y > HY + hry * 0.55;
  superEllipsoid(head, cx, HY + 0.35 * s, cz - 0.35 * s, hrx + 0.55 * s, hry + 0.45 * s, hrz + 0.6 * s, 2.6, (x, y, z) => {
    const faceZone = z > cz + hrz * 0.15 && y < HY + hry * 0.38; // keep the face open
    const sideZone = y < HY - hry * 0.25 && z > cz - hrz * 0.35; // nothing down the cheeks
    if (faceZone || sideZone) return head.get(x, y, z) || 0;
    return hairTop(y) ? hair3[2] : y < HY ? hair3[0] : hair3[1];
  });
  // blocky fringe: one row across the forehead with a chunky side part
  const fy = Math.round(HY + hry * 0.38);
  for (let x = Math.round(cx - hrx + 1); x <= Math.round(cx + hrx - 1); x++) {
    onFront(head, x, fy, hair3[1], 1);
    if (s >= 1.2 && x < cx - 0.5 * s) onFront(head, x, fy - 1, hair3[1], 1); // swept to one side
  }
  // face: two dark eyes, blush, tiny mouth
  const ey = Math.round(HY - 0.15 * hry);
  const eo = Math.max(1, Math.round(1.6 * s)); // eye offset from centre
  const L = (i) => Math.round(cx - 0.5 - i), Rr = (i) => Math.round(cx + 0.5 + i);
  const big = res >= 2;
  for (const side of [L, Rr]) {
    for (let w = 0; w < (big ? 2 : 1); w++) for (let h = 0; h < 2; h++) onFront(head, side(eo + w - (big ? 1 : 0)), ey - h, G.ink);
    if (big) onFront(head, side(eo), ey, C.sand[7]); // tiny highlight
    const small = s < 1.2;
    for (let w = 0; w < (big ? 2 : 1); w++) onFront(head, side(eo + 1 + w), small ? ey - 1 : ey - 2 - (big ? 1 : 0), C.pink[6]); // blush
  }
  for (const side of [L, Rr]) onFront(head, side(0), ey - (big ? 4 : s < 1.2 ? 2 : 3), C.red[3]); // small mouth
  if (o.sig === 'cap') { // baseball cap: dome + forward brim
    superEllipsoid(head, cx, HY + hry * 0.55, cz - 0.2 * s, hrx + 0.7 * s, hry * 0.5, hrz + 0.7 * s, 2.4, (x, y, z) => (y > HY + hry * 0.9 ? o.cap3[2] : o.cap3[1]));
    head.box(Math.round(cx - hrx * 0.7), Math.round(HY + hry * 0.45), Math.round(cz + hrz), Math.round(cx + hrx * 0.7) - 1, Math.round(HY + hry * 0.45), Math.round(cz + hrz + 2 * s), o.cap3[0]);
  }
  if (o.sig === 'ponytail')
    capsule(head, [cx, HY + 0.6 * s, cz - hrz - 0.4 * s], [cx, HY - 2.6 * s, cz - hrz - 1.4 * s], R(1.3), R(0.9), (x, y) => (y > HY ? hair3[1] : hair3[0]));
  pivot('head', cx, J.neckY, cz);

  return { pivots: pv, joints: J };
}
