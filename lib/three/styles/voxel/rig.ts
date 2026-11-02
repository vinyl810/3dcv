import * as THREE from 'three';
import { Grid, meshGrid } from './vox';
import { drawHead, drawTorso, figureLayout, type FigureColors, type FigureSpec, type FigureY } from './figure';

/**
 * Jointed voxel humanoid. Every body part is its own small voxel mesh whose
 * pivot sits ON the anatomical joint, nested so rotations propagate:
 *
 *   root ─ hips ─┬─ torso ─┬─ head ─ eyes
 *                │         ├─ upperArm[L/R] ─ forearm ─ hand
 *                ├─ thigh[L/R] ─ shin ─ foot
 *
 * Seamless joints: adjacent parts SHARE the joint voxel row (e.g. thigh and
 * shin both contain the knee row) and the pivot is the centre of that shared
 * row. Bending rotates both copies about their common centre, so their union
 * always covers the joint (no wedge gaps). Overlapping limb voxels use zero
 * colour jitter + no AO so the coincident faces are identical (no z-fight).
 *
 * Sign conventions (local, figure faces +Z):
 *   knee bend  = shin.rotation.x  > 0  (foot swings back)       [0, 2.4]
 *   hip flex   = thigh.rotation.x < 0  (knee comes forward)     [-1.7, 0.5]
 *   elbow bend = forearm.rotation.x < 0 (hand comes forward)    [-2.5, 0]
 *   shoulder abduction: rotation.z = side * a  (a > 0 = out/up)
 *   arm index 0 = character's right (−x), 1 = left (+x); side = −1 / +1.
 */

export interface Limb3 { a: THREE.Group; b: THREE.Group; c: THREE.Group; side: -1 | 1 }

export interface Rig {
  root: THREE.Group;
  hips: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  eyes: THREE.Group;
  arms: [Limb3, Limb3]; // a = upperArm, b = forearm, c = hand
  legs: [Limb3, Limb3]; // a = thigh, b = shin, c = foot
  /** hips rest y (local units) */
  hipsY: number;
  /** thigh + shin length in local units (pivot to pivot) */
  legLen: [number, number];
  /** voxel size */
  s: number;
  L: FigureY;
}

export interface RigOptions {
  /** extra torso painting (pockets, badges, hood…) — figure frame coords */
  torsoDetail?: (g: Grid, L: FigureY) => void;
  sleeve?: number;
  cuff?: number;
  toe?: number;
  cap?: number;
  skinGlow?: number;
}

export const KNEE: [number, number] = [0, 2.4];
export const HIPF: [number, number] = [-1.7, 0.5];
export const ELBOW: [number, number] = [-2.5, 0];
const cl = (v: number, r: [number, number]) => Math.min(r[1], Math.max(r[0], v));
export const setKnee = (l: Limb3, v: number) => { l.b.rotation.x = cl(v, KNEE); };
export const setHip = (l: Limb3, v: number) => { l.a.rotation.x = cl(v, HIPF); };
export const setElbow = (l: Limb3, v: number) => { l.b.rotation.x = cl(v, ELBOW); };

/**
 * Build a rig at figure-frame origin (feet centre, shoe row = y 0). `spec.x/y/z`
 * place the root (voxel units, already multiplied by `s`).
 */
export function buildRig(spec: FigureSpec, col: FigureColors, s: number, o: RigOptions = {}): Rig {
  const f: FigureSpec = { ...spec, x: 0, y: 0, z: 0 };
  const L = figureLayout(f);
  const H = L.top + 3;
  const G = () => new Grid(-12, 12, -2, H, -12, 12);

  const root = new THREE.Group();
  root.position.set(spec.x * s, spec.y * s, spec.z * s);

  // nest `child` (pivot pc) under `parent` (pivot pp); both in voxel coords
  const attach = (parent: THREE.Object3D, pp: number[], child: THREE.Group, pc: number[]) => {
    parent.add(child);
    child.position.set((pc[0] - pp[0]) * s, (pc[1] - pp[1]) * s, (pc[2] - pp[2]) * s);
  };
  const part = (g: Grid, pivot: [number, number, number], ao = 0, glow?: number) =>
    meshGrid(g, { size: s, pivot, ao, glow }).group;

  const hipY = L.hip; // hip row
  const kneeY = 1 + Math.floor(f.legH / 2);
  const lz = -0.5; // legs occupy z -1..0
  const lx = f.legW === 2 ? 1.5 : 1;

  /* ---- hips (root of the body) ---- */
  const hg = G();
  const pants = hg.c(col.pants, 0);
  hg.box(-f.legW, hipY, -1, f.legW, hipY, 0, pants);
  const P_HIPS: [number, number, number] = [0, hipY + 0.5, lz];
  const hips = part(hg, P_HIPS);
  root.add(hips);
  hips.position.set(P_HIPS[0] * s, P_HIPS[1] * s, P_HIPS[2] * s);

  /* ---- torso (shares the hip row) ---- */
  const tg = G();
  drawTorso(tg, f, tg.c(col.shirt, 0.02), tg.c(col.shirtDark, 0.02));
  tg.box(-f.legW, hipY, -1, f.legW, hipY, 0, tg.c(col.pants, 0));
  o.torsoDetail?.(tg, L);
  const P_TORSO: [number, number, number] = [0, hipY + 0.5, lz];
  const torso = part(tg, P_TORSO, 1);
  attach(hips, P_HIPS, torso, P_TORSO);

  /* ---- head (+ neck) on the torso ---- */
  const headG = G();
  const eyeG = G();
  drawHead(headG, eyeG, f, col, { cap: o.cap });
  const P_HEAD: [number, number, number] = [0, L.shoulder, 0];
  const head = part(headG, P_HEAD, 1, o.skinGlow ?? 0.22);
  attach(torso, P_TORSO, head, P_HEAD);
  const P_EYES: [number, number, number] = [0, L.eye + 1, 0];
  const eyes = part(eyeG, P_EYES);
  attach(head, P_HEAD, eyes, P_EYES);

  /* ---- arms: upperArm (shoulder) → forearm (elbow) → hand (wrist) ---- */
  const top = L.shoulder - 1; // top arm row
  const len = Math.max(4, Math.round(f.torsoH * 0.95));
  const elbowY = top - Math.floor(len / 2);
  const wristY = top - len + 1;
  const thick = f.legW === 2; // hub: 2-deep upper arm
  const arms = ([-1, 1] as const).map((side) => {
    const ax = side * L.armX;
    const sleeve = o.sleeve ?? col.shirt;
    // upper arm: elbow row … top, + a rounded shoulder cap tucked into the torso
    const ug = G();
    const sc = ug.c(sleeve, 0);
    for (let y = elbowY; y <= top; y++) {
      ug.set(ax, y, 0, sc);
      if (thick && y > elbowY) ug.set(ax, y, -1, sc);
    }
    ug.set(ax - side, top, 0, sc).set(ax - side, top - 1, 0, sc); // shoulder cap (overlaps torso)
    if (thick) ug.set(ax - side, top, -1, sc);
    const P_SH: [number, number, number] = [ax, top + 0.5, 0];
    const upper = part(ug, P_SH);
    upper.rotation.order = 'ZYX'; // flex (x) → twist (y) → abduct (z), arm-local first
    attach(torso, P_TORSO, upper, P_SH);
    // forearm: wrist row … elbow row (shares the elbow row)
    const fg = G();
    const fc = fg.c(sleeve, 0);
    const cuff = fg.c(o.cuff ?? sleeve, 0);
    for (let y = wristY; y <= elbowY; y++) fg.set(ax, y, 0, y === wristY ? cuff : fc);
    const P_EL: [number, number, number] = [ax, elbowY + 0.5, 0];
    const fore = part(fg, P_EL);
    attach(upper, P_SH, fore, P_EL);
    // hand: shares the wrist row, skin voxel below (+ a thumb nub forward)
    const handG = G();
    handG.set(ax, wristY, 0, handG.c(o.cuff ?? sleeve, 0));
    const sk = handG.c(col.skin, 0);
    handG.set(ax, wristY - 1, 0, sk);
    if (thick) handG.set(ax, wristY - 1, 1, sk);
    const P_WR: [number, number, number] = [ax, wristY + 0.5, 0];
    const hand = part(handG, P_WR);
    attach(fore, P_EL, hand, P_WR);
    return { a: upper, b: fore, c: hand, side };
  }) as [Limb3, Limb3];

  /* ---- legs: thigh (hip) → shin (knee) → foot (ankle) ---- */
  const legs = ([-1, 1] as const).map((side) => {
    const x0 = side * 1, x1 = side * f.legW;
    const tgg = G();
    const tp = tgg.c(col.pants, 0);
    tgg.box(x0, kneeY, -1, x1, hipY, 0, tp);
    const P_HIP: [number, number, number] = [side * lx, hipY + 0.5, lz];
    const thigh = part(tgg, P_HIP);
    attach(hips, P_HIPS, thigh, P_HIP);
    const sg = G();
    sg.box(x0, 1, -1, x1, kneeY, 0, sg.c(col.pants, 0));
    const P_KN: [number, number, number] = [side * lx, kneeY + 0.5, lz];
    const shin = part(sg, P_KN);
    attach(thigh, P_HIP, shin, P_KN);
    const fg = G();
    fg.box(x0, 1, -1, x1, 1, 0, fg.c(col.pants, 0)); // shared ankle row
    const shoe = fg.c(col.shoe, 0);
    fg.box(x0, 0, -1, x1, 0, 1, shoe);
    if (o.toe !== undefined) fg.box(x0, 0, 1, x1, 0, 1, fg.c(o.toe, 0));
    const P_AN: [number, number, number] = [side * lx, 1.5, lz];
    const foot = part(fg, P_AN);
    attach(shin, P_KN, foot, P_AN);
    return { a: thigh, b: shin, c: foot, side };
  }) as [Limb3, Limb3];

  return {
    root, hips, torso, head, eyes, arms, legs,
    hipsY: hips.position.y,
    legLen: [(hipY - kneeY) * s, (kneeY - 1) * s],
    s, L,
  };
}

/* ======================================================= motion helpers == */

export const smooth = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
const ease = smooth;

/** Reset every joint to the relaxed rest pose (arms hang, slight elbow bend). */
export function relax(r: Rig, t: number, phase: number) {
  r.hips.rotation.set(0, 0, 0);
  r.hips.position.y = r.hipsY;
  r.torso.rotation.set(0, 0, 0);
  r.torso.scale.y = 1 + 0.014 * Math.sin(t * 2.6 + phase); // breathing
  r.head.rotation.set(0, 0, 0);
  for (const a of r.arms) {
    a.a.rotation.set(0.04 * Math.sin(t * 1.3 + phase + a.side), 0, a.side * 0.07);
    a.b.rotation.set(-0.2 - 0.04 * Math.sin(t * 2.6 + phase), 0, 0);
    a.c.rotation.set(0, 0, 0);
  }
  for (const l of r.legs) {
    l.a.rotation.set(0, 0, 0);
    l.b.rotation.set(0, 0, 0);
    l.c.rotation.set(0, 0, 0);
  }
}

/**
 * Bend one leg by `a` (hip flex) with the knee at 2a (shin goes back by a), foot
 * kept level. Returns the vertical shortening of that leg (local units).
 */
export function bendLeg(r: Rig, l: Limb3, a: number): number {
  a = Math.max(0, a);
  setHip(l, -a);
  setKnee(l, 2 * a);
  l.c.rotation.x = -a;
  return (r.legLen[0] + r.legLen[1]) * (1 - Math.cos(a));
}

/** Both legs crouch by angle a; hips drop so the feet stay planted. */
export function crouch(r: Rig, a: number) {
  const d = Math.max(bendLeg(r, r.legs[0], a), bendLeg(r, r.legs[1], a));
  r.hips.position.y -= d;
  r.torso.rotation.x = 0.45 * a; // lean into it
  r.head.rotation.x = -0.25 * a; // keep eyes level-ish
}

/**
 * A full hop with anticipation, `u` = seconds since it started (−1/≥1.1 → no-op).
 * Crouch → push-off → airborne (tucked, arms up) → landing absorbed by knees.
 * Returns the arm-swing amount (−1 back … +1 up) for the caller to use.
 */
export function hop(r: Rig, u: number, height = 6): number {
  if (u < 0 || u > 1.1) return 0;
  let a = 0, lift = 0, swing = 0;
  if (u < 0.22) { const k = ease(u / 0.22); a = 0.55 * k; swing = -0.8 * k; } // anticipation
  else if (u < 0.32) { const k = ease((u - 0.22) / 0.1); a = 0.55 * (1 - k); swing = -0.8 + 1.8 * k; } // push
  else if (u < 0.72) { const k = (u - 0.32) / 0.4; lift = height * Math.sin(Math.PI * k); a = 0.12 * Math.sin(Math.PI * k); swing = 1 - 0.6 * k; } // air
  else { const k = (u - 0.72) / 0.38; a = 0.42 * Math.sin(Math.PI * Math.min(1, k)) * (1 - 0.3 * k); swing = 0.4 * (1 - k); } // land
  crouch(r, a);
  r.hips.position.y += lift * r.s;
  if (lift > 0) for (const l of r.legs) l.c.rotation.x += 0.35 * (lift / height); // toes point in the air
  return swing;
}
