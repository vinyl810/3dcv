import * as THREE from 'three';
import { findNode, type KitCharacter } from './assets';

/**
 * Procedural bone layer applied ON TOP of the AnimationMixer pose each frame
 * (after mixer.update). Works in world space from the bones' actual positions,
 * so it doesn't depend on each rig's local bone-axis conventions:
 *  - aim(): rotate a bone so the bone→child segment points along a direction
 *    given in the CHARACTER's local frame (+Z forward, +Y up, +X = its left),
 *    blended by a weight.
 *  - turn(): extra rotation of a bone about a character-local axis.
 * All temporaries are preallocated (no per-frame allocation).
 */

const _p = new THREE.Vector3();
const _c = new THREE.Vector3();
const _cur = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _ax = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _bw = new THREE.Quaternion();
const _pw = new THREE.Quaternion();
const _tgt = new THREE.Quaternion();
const _char = new THREE.Quaternion();

export class Poser {
  readonly ok: boolean;
  private bones = new Map<string, THREE.Object3D>();
  private rest = new Map<THREE.Object3D, THREE.Quaternion>();

  constructor(readonly ch: KitCharacter, names: string[]) {
    let ok = true;
    for (const n of names) {
      const b = findNode(ch.rig, n);
      if (b) {
        this.bones.set(n, b);
        this.rest.set(b, b.quaternion.clone());
      } else ok = false;
    }
    this.ok = ok;
  }

  bone(n: string): THREE.Object3D | undefined {
    return this.bones.get(n);
  }

  /**
   * Call once per frame BEFORE the mixer update: restores managed bones to rest
   * so bones the clip doesn't key never accumulate our additive offsets.
   */
  reset(): void {
    for (const [b, q] of this.rest) b.quaternion.copy(q);
  }

  /** Call once per frame after the mixer update, before aim/turn. */
  begin(): void {
    this.ch.group.updateWorldMatrix(true, true);
    this.ch.group.getWorldQuaternion(_char);
  }

  /**
   * Point segment bone→child along (dx,dy,dz) in character space, weight w.
   */
  aim(boneName: string, childName: string, dx: number, dy: number, dz: number, w: number): void {
    if (w <= 0.001) return;
    const b = this.bones.get(boneName);
    const c = this.bones.get(childName);
    if (!b || !c || !b.parent) return;
    b.getWorldPosition(_p);
    c.getWorldPosition(_c);
    _cur.subVectors(_c, _p);
    if (_cur.lengthSq() < 1e-12) return;
    _cur.normalize();
    _dir.set(dx, dy, dz).normalize().applyQuaternion(_char);
    _q.setFromUnitVectors(_cur, _dir);
    b.getWorldQuaternion(_bw);
    _tgt.copy(_q).multiply(_bw); // desired world rotation
    b.parent.getWorldQuaternion(_pw);
    _tgt.premultiply(_pw.invert()); // → parent-local
    b.quaternion.slerp(_tgt, Math.min(1, w));
    b.updateMatrixWorld(true);
  }

  /** Rotate a bone by `angle` about a character-space axis (ax,ay,az). */
  turn(boneName: string, ax: number, ay: number, az: number, angle: number): void {
    if (Math.abs(angle) < 1e-5) return;
    const b = this.bones.get(boneName);
    if (!b || !b.parent) return;
    _ax.set(ax, ay, az).normalize().applyQuaternion(_char);
    b.parent.getWorldQuaternion(_pw);
    _ax.applyQuaternion(_pw.invert()); // axis in parent-local space
    _q.setFromAxisAngle(_ax, angle);
    b.quaternion.premultiply(_q);
    b.updateMatrixWorld(true);
  }
}

/** Smooth 0→1→0 envelope: rise over `a`, hold until `h`, fall over `r` (seconds). */
export function envelope(s: number, a: number, h: number, r: number): number {
  if (s < 0) return 0;
  const ss = (x: number) => x * x * (3 - 2 * x);
  if (s < a) return ss(s / a);
  if (s < h) return 1;
  if (s < h + r) return 1 - ss((s - h) / r);
  return 0;
}

/**
 * Occasional head turn: mostly 0, every `period` s eases to ±amp, holds, eases
 * back. Deterministic function of absolute t (rate never depends on hover).
 */
export function glance(t: number, period: number, amp: number, phase = 0): number {
  const k = Math.floor((t + phase) / period);
  const s = (t + phase) - k * period;
  const side = (k * 7919) % 3 === 0 ? -1 : 1;
  return side * amp * envelope(s, 0.7, 2.2, 0.8);
}
