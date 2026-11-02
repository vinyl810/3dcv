import * as THREE from 'three';
import { Mesher, clamp } from './rkit';

/**
 * A small hierarchical humanoid RIG for the refined style (grid units).
 *
 *   root (feet on y=0)
 *    └ hips ───────────── pelvis mesh + hip-joint caps
 *        ├ torso ──────── waist + chest mesh + shoulder caps (breathing scales the MESH only)
 *        │   ├ neck ───── neck + head (face/hair via callback)
 *        │   └ shoulder[L/R] ─ upper arm + elbow cap
 *        │        └ elbow ──── forearm + hand
 *        └ hip[L/R] ──── thigh + knee cap
 *             └ knee ──── shin
 *                  └ ankle ─ foot
 *
 * Every pivot sits at the real joint; every limb segment overlaps into a
 * rounded joint cap owned by the parent segment, so any bend reads as one
 * continuous limb (no gaps). Angles are set through helpers that clamp to
 * natural ranges: elbows bend forward only, knees backward only.
 *
 * Side index: 0 = the character's -x side, 1 = its +x side. Character faces +Z.
 */

export interface RigSpec {
  u: number;
  footH: number; footL: number; shin: number; thigh: number; legW: number; hipX: number;
  pelvis: [number, number, number]; // w, h, d (centred on the hip joint height)
  waist: [number, number, number]; chest: [number, number, number];
  upper: number; fore: number; armW: number; shoulderX: number; hand: number;
  neck: number;
  color: {
    shoe: number; pants: number; pantsDark: number;
    shirt: number; shirtDark: number; sleeve: number; skin: number; skinShade: number;
  };
  /** extra torso detail (local: torso pivot at waist bottom) */
  torsoDetail?: (T: Mesher) => void;
  /** build the head (local origin = head bottom) on H; may add pivots to `head` */
  head: (H: Mesher, head: THREE.Group) => void;
}

export interface Rig {
  root: THREE.Group;
  hips: THREE.Group;
  torso: THREE.Group;
  torsoMesh: THREE.Mesh;
  neck: THREE.Group;
  head: THREE.Group;
  shoulder: [THREE.Group, THREE.Group];
  elbow: [THREE.Group, THREE.Group];
  hip: [THREE.Group, THREE.Group];
  knee: [THREE.Group, THREE.Group];
  ankle: [THREE.Group, THREE.Group];
  /** rest height of the hips pivot (local units × u) */
  hipsY: number;
  /** leg segment length (thigh = shin) in local units × u */
  legLen: number;
  spec: RigSpec;
}

function grp(parent: THREE.Object3D, u: number, x: number, y: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x * u, y * u, z * u);
  parent.add(g);
  return g;
}

export function buildRig(parent: THREE.Object3D, s: RigSpec, x = 0, y = 0, z = 0): Rig {
  const u = s.u;
  const C = s.color;
  const root = grp(parent, u, x, y, z);
  const hipJ = s.footH + s.shin + s.thigh; // hip-joint height
  const hips = grp(root, u, 0, hipJ, 0);

  // ---- pelvis + hip caps
  const Pm = new Mesher(u);
  const [pw, ph, pd] = s.pelvis;
  Pm.r(C.pants, pw, ph, pd, 0, ph / 2 - s.legW * 0.45, 0, Math.min(1, ph / 3));
  for (const sx of [-s.hipX, s.hipX]) Pm.r(C.pants, s.legW + 0.2, s.legW + 0.2, s.legW + 0.2, sx, 0, 0, s.legW * 0.25);
  Pm.to(hips);

  // ---- torso (pivot at the waist bottom = top of the pelvis)
  const waistY = ph - s.legW * 0.45 - 0.3;
  const torso = grp(hips, u, 0, waistY, 0);
  const T = new Mesher(u);
  const [ww, wh, wd] = s.waist;
  const [cw, ch, cd] = s.chest;
  T.r(C.shirt, ww, wh + 0.4, wd, 0, wh / 2 - 0.2, 0, Math.min(1, ww / 7));
  T.b(C.shirtDark, ww, Math.max(0.5, wh * 0.15), wd, 0, Math.max(0.25, wh * 0.075), 0); // waistband
  T.r(C.shirt, cw, ch, cd, 0, wh + ch / 2, 0, Math.min(1.2, cw / 8));
  const chestTop = wh + ch;
  const shY = chestTop - s.armW * 0.55;
  for (const sx of [-s.shoulderX, s.shoulderX]) {
    T.r(C.shirt, s.armW + 0.5, s.armW + 0.5, s.armW + 0.5, sx, shY, 0, (s.armW + 0.5) * 0.25); // shoulder cap
  }
  s.torsoDetail?.(T);
  const torsoMesh = T.build()!;
  torso.add(torsoMesh);

  // ---- neck + head
  const neck = grp(torso, u, 0, chestTop - 0.2, 0);
  const H = new Mesher(u);
  H.b(C.skinShade, s.legW * 0.8, s.neck + 0.6, s.legW * 0.8, 0, s.neck / 2, 0);
  const head = grp(neck, u, 0, s.neck, 0);
  // the head's own mesher (origin = head bottom)
  const HM = new Mesher(u);
  s.head(HM, head);
  H.to(neck);
  HM.to(head);

  // ---- arms
  const shoulder: THREE.Group[] = [];
  const elbow: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const sh = grp(torso, u, side * s.shoulderX, shY, 0);
    sh.rotation.order = 'XZY'; // twist (long axis) → abduct → flex
    const U = new Mesher(u);
    U.r(C.shirt, s.armW, s.upper + s.armW * 0.5, s.armW, 0, -s.upper / 2, 0, s.armW * 0.22);
    U.r(C.shirt, s.armW * 0.98, s.armW * 0.98, s.armW * 0.98, 0, -s.upper, 0, s.armW * 0.28); // elbow cap
    U.to(sh);
    const el = grp(sh, u, 0, -s.upper, 0);
    const Fm = new Mesher(u);
    const fw = s.armW * 0.86;
    Fm.r(C.sleeve, fw, s.fore + fw * 0.5, fw, 0, -s.fore / 2 + fw * 0.15, 0, fw * 0.22);
    Fm.r(C.skin, s.hand, s.hand * 1.15, s.hand * 0.9, 0, -s.fore - s.hand * 0.4, 0, s.hand * 0.25); // hand
    Fm.to(el);
    shoulder.push(sh);
    elbow.push(el);
  }

  // ---- legs
  const hip: THREE.Group[] = [];
  const knee: THREE.Group[] = [];
  const ankle: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const hp = grp(hips, u, side * s.hipX, 0, 0);
    const Th = new Mesher(u);
    Th.r(C.pants, s.legW, s.thigh + s.legW * 0.4, s.legW, 0, -s.thigh / 2, 0, s.legW * 0.2);
    Th.r(C.pants, s.legW * 0.96, s.legW * 0.96, s.legW * 0.96, 0, -s.thigh, 0, s.legW * 0.28); // knee cap
    Th.to(hp);
    const kn = grp(hp, u, 0, -s.thigh, 0);
    const Sh = new Mesher(u);
    const sw = s.legW * 0.86;
    Sh.r(C.pantsDark, sw, s.shin + sw * 0.4, sw, 0, -s.shin / 2 + sw * 0.1, 0, sw * 0.2);
    Sh.to(kn);
    const an = grp(kn, u, 0, -s.shin, 0);
    const Ft = new Mesher(u);
    Ft.r(C.shoe, s.legW + 0.3, s.footH, s.footL, 0, -s.footH / 2 + 0.05, s.footL / 2 - s.legW * 0.45, s.footH * 0.3);
    Ft.to(an);
    hip.push(hp);
    knee.push(kn);
    ankle.push(an);
  }

  return {
    root, hips, torso, torsoMesh, neck, head,
    shoulder: shoulder as [THREE.Group, THREE.Group],
    elbow: elbow as [THREE.Group, THREE.Group],
    hip: hip as [THREE.Group, THREE.Group],
    knee: knee as [THREE.Group, THREE.Group],
    ankle: ankle as [THREE.Group, THREE.Group],
    hipsY: hipJ * u,
    legLen: s.thigh * u,
    spec: s,
  };
}

// ------------------------------------------------------------ posing -----

/**
 * Arm pose for one side (radians):
 *   flex  > 0 swings the upper arm FORWARD
 *   abd   > 0 raises it OUT to the side (π/2 = horizontal, ~2.6 = overhead)
 *   twist > 0 = external rotation (forward elbow bend then points outward/up)
 *   bend  ≥ 0 elbow flexion (forearm forward only), clamped to [0, 2.5]
 */
export function setArm(r: Rig, side: 0 | 1, flex: number, abd: number, twist: number, bend: number): void {
  const sg = side === 0 ? -1 : 1;
  const sh = r.shoulder[side];
  sh.rotation.x = -clamp(flex, -0.8, 2.9);
  sh.rotation.z = sg * clamp(abd, -0.15, 2.9);
  sh.rotation.y = sg * clamp(twist, -1.7, 1.7);
  r.elbow[side].rotation.x = -clamp(bend, 0, 2.5);
}

/**
 * Leg pose for one side: hip flexion `a` (thigh forward, may be slightly
 * negative) and knee flexion `k` (shin backward only, clamped [0, 2.4]).
 * The foot is kept level with the ground (ankle compensates).
 */
export function setLeg(r: Rig, side: 0 | 1, a: number, k: number, toe = 0): void {
  const kk = clamp(k, 0, 2.4);
  r.hip[side].rotation.x = -clamp(a, -0.5, 2.0);
  r.knee[side].rotation.x = kk;
  r.ankle[side].rotation.x = clamp(a, -0.5, 2.0) - kk + toe;
}

/**
 * Symmetric squat with feet planted: thighs flex by `a`, knees by 2a, and the
 * hips drop by exactly 2L(1−cos a) so the feet stay put. Returns the drop
 * (local units × u) — ADD it (negative) to the hips' y yourself, together
 * with any jump lift.
 */
export function squat(r: Rig, a: number): number {
  const aa = clamp(a, 0, 1.1);
  setLeg(r, 0, aa, 2 * aa);
  setLeg(r, 1, aa, 2 * aa);
  return -2 * r.legLen * (1 - Math.cos(aa));
}

/** smoothstep on [0,1] */
export const ease = (x: number) => {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * One anticipation → jump → landing cycle driven by `s` seconds since start.
 * Returns { crouch (hip-flex angle for squat), lift (0..1 of the jump height),
 * air (0..1 how airborne — for arm swing/tuck) } and is all-zero after ~1s.
 */
export function hopCurve(s: number, out: { crouch: number; lift: number; air: number }) {
  out.crouch = 0; out.lift = 0; out.air = 0;
  if (s < 0) return out;
  if (s < 0.2) {
    out.crouch = 0.55 * ease(s / 0.2); // anticipation: knees + hips bend
  } else if (s < 0.55) {
    const p = (s - 0.2) / 0.35;
    out.crouch = 0.55 * (1 - ease(p * 3)); // push off: legs extend fast
    out.lift = Math.sin(p * Math.PI); // ballistic arc
    out.air = Math.sin(p * Math.PI);
    out.crouch += 0.18 * out.air; // slight tuck in the air
  } else if (s < 1.0) {
    const p = (s - 0.55) / 0.45;
    out.crouch = 0.48 * Math.sin(p * Math.PI) * (1 - 0.3 * p); // landing absorb
  }
  return out;
}
