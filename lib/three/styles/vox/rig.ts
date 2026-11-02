import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { VoxInstance } from './assets';

/**
 * Runtime skeleton for the humanoids authored by tools/toonfolk.mjs.
 *
 * instantiate() creates every part as a flat pivot group at its joint. buildRig
 * re-parents them into a real hierarchy (keeping world positions), so rotating
 * a shoulder carries the forearm + hand, bending the hips carries the torso,
 * etc. Poses are plain joint rotations, clamped to anatomical ranges:
 *   knees bend backward only, elbows forward only, no hyper-extension.
 * Convention: character faces +Z; L = +X side. thigh.x < 0 lifts the knee
 * forward; shin.x > 0 bends the knee; forearm.x < 0 bends the elbow; upperArm.z
 * > 0 raises the L arm sideways (mirror for R); upperArm.x < 0 swings it forward.
 */

export const PARENT: Record<string, string> = {
  torso: 'hips', head: 'torso',
  upperArmL: 'torso', forearmL: 'upperArmL', handL: 'forearmL',
  upperArmR: 'torso', forearmR: 'upperArmR', handR: 'forearmR',
  thighL: 'hips', shinL: 'thighL', footL: 'shinL',
  thighR: 'hips', shinR: 'thighR', footR: 'shinR',
};
export const BONES = ['hips', ...Object.keys(PARENT)] as const;
export type Bone = (typeof BONES)[number];

/** Joint limits [min, max] per bone per axis (radians). */
const LIMITS: Partial<Record<Bone, { x?: [number, number]; y?: [number, number]; z?: [number, number] }>> = {
  shinL: { x: [0, 2.5], y: [0, 0], z: [0, 0] },
  shinR: { x: [0, 2.5], y: [0, 0], z: [0, 0] },
  forearmL: { x: [-2.7, 0], y: [-1.2, 1.2], z: [-0.6, 0.6] },
  forearmR: { x: [-2.7, 0], y: [-1.2, 1.2], z: [-0.6, 0.6] },
  thighL: { x: [-2.0, 0.6], y: [-0.5, 0.5], z: [-0.2, 0.7] },
  thighR: { x: [-2.0, 0.6], y: [-0.5, 0.5], z: [-0.7, 0.2] },
  upperArmL: { x: [-3.0, 1.0], y: [-1.5, 1.5], z: [-0.4, 2.9] },
  upperArmR: { x: [-3.0, 1.0], y: [-1.5, 1.5], z: [-2.9, 0.4] },
  head: { x: [-0.6, 0.5], y: [-1.0, 1.0], z: [-0.4, 0.4] },
  torso: { x: [-0.4, 0.6], y: [-0.6, 0.6], z: [-0.3, 0.3] },
  handL: { x: [-1.2, 1.2], y: [-0.5, 0.5], z: [-0.6, 0.6] },
  handR: { x: [-1.2, 1.2], y: [-0.5, 0.5], z: [-0.6, 0.6] },
  footL: { x: [-0.9, 0.9], y: [0, 0], z: [-0.3, 0.3] },
  footR: { x: [-0.9, 0.9], y: [0, 0], z: [-0.3, 0.3] },
};

export interface Rig {
  bones: Record<Bone, THREE.Object3D>;
  /** hips rest position (local units). */
  hipsRest: THREE.Vector3;
  /** Lengths (local units) used for leg IK. */
  thighLen: number;
  shinLen: number;
  /** one voxel in local units */
  v: number;
}

/**
 * Turn a humanoid's 15 part-pivots into ONE rigidly-skinned mesh: each part's
 * voxels are weighted 100% to its bone, bones are nested per PARENT, so the
 * whole character is a single draw call per pass while every joint still
 * rotates independently (and rotations propagate down the chain). Non-lit
 * extras on a part (emissive bits) are simply re-parented to the bone.
 */
export function buildRig(inst: VoxInstance, prefix: string, voxel: number): Rig {
  const bones = {} as Record<Bone, THREE.Object3D>;
  const boneList: THREE.Bone[] = [];
  const geos: THREE.BufferGeometry[] = [];
  const abs = new Map<Bone, THREE.Vector3>();
  const extras: [Bone, THREE.Object3D][] = [];
  let litMat: THREE.Material | null = null;
  BONES.forEach((b, bi) => {
    const pivot = inst.parts[prefix + b];
    if (!pivot) throw new Error(`rig: missing part ${prefix}${b}`);
    abs.set(b, pivot.position.clone());
    const bone = new THREE.Bone();
    bone.name = prefix + b;
    bone.position.copy(pivot.position);
    bones[b] = bone;
    boneList.push(bone);
    for (const child of [...pivot.children]) {
      const mesh = child as THREE.Mesh;
      const mat = mesh.material as THREE.MeshToonMaterial;
      if (mesh.isMesh && !mat.transparent && mat.emissive.r + mat.emissive.g + mat.emissive.b === 0) {
        litMat = mat;
        const g = mesh.geometry.clone();
        g.translate(pivot.position.x, pivot.position.y, pivot.position.z);
        const n = g.attributes.position.count;
        const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
        for (let k = 0; k < n; k++) { si[k * 4] = bi; sw[k * 4] = 1; }
        g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
        g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
        geos.push(g);
      } else {
        extras.push([b, child]);
      }
    }
    pivot.removeFromParent();
    delete inst.parts[prefix + b];
  });
  // nest bones (positions relative to the parent, from the ORIGINAL absolute pivots)
  for (const b of BONES) {
    if (b === 'hips') continue;
    const p = PARENT[b] as Bone;
    bones[b].position.copy(abs.get(b)!).sub(abs.get(p)!);
    bones[p].add(bones[b]);
  }
  for (const [b, child] of extras) bones[b].add(child);
  const geo = mergeGeometries(geos)!;
  geos.forEach((g) => g.dispose());
  const skinned = new THREE.SkinnedMesh(geo, litMat!);
  skinned.name = `${prefix}body`;
  skinned.frustumCulled = false;
  skinned.add(bones.hips);
  inst.group.add(skinned);
  skinned.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(boneList);
  skinned.bind(skeleton);
  skeleton.update();
  return {
    bones,
    hipsRest: bones.hips.position.clone(),
    thighLen: Math.abs(bones.shinL.position.y),
    shinLen: Math.abs(bones.footL.position.y),
    v: voxel,
  };
}

export type Pose = Partial<Record<Bone, [number, number, number]>> & {
  /** hips offset in VOXELS (x sideways, y up, z forward). */
  lift?: [number, number, number];
  /** torso breathing scale (1 = rest). */
  breath?: number;
};

const clamp = (v: number, r?: [number, number]) => (r ? Math.min(r[1], Math.max(r[0], v)) : v);

/** Apply a pose (unspecified bones go back to rest). No allocations. */
export function applyPose(rig: Rig, p: Pose): void {
  for (const b of BONES) {
    const r = p[b];
    const o = rig.bones[b];
    const lim = LIMITS[b];
    if (r) o.rotation.set(clamp(r[0], lim?.x), clamp(r[1], lim?.y), clamp(r[2], lim?.z));
    else o.rotation.set(0, 0, 0);
  }
  const l = p.lift;
  rig.bones.hips.position.set(
    rig.hipsRest.x + (l ? l[0] * rig.v : 0),
    rig.hipsRest.y + (l ? l[1] * rig.v : 0),
    rig.hipsRest.z + (l ? l[2] * rig.v : 0),
  );
  rig.bones.torso.scale.set(1, p.breath ?? 1, 1);
}

/**
 * Bend one leg by `knee` radians with the foot kept under the hip and flat:
 * thigh forward by knee/2, shin back by knee, foot level. Returns how much the
 * hip drops (local units) so a two-legged crouch can lower the hips exactly.
 */
function set3(pose: Pose, key: string, a: number, b: number, c: number): void {
  const rec = pose as Record<string, [number, number, number] | undefined>;
  const v = rec[key];
  if (v) { v[0] = a; v[1] = b; v[2] = c; } else rec[key] = [a, b, c];
}

export function legBend(pose: Pose, rig: Rig, side: 'L' | 'R', knee: number, splay = 0): number {
  const k = Math.max(0, knee);
  set3(pose, 'thigh' + side, -k / 2, 0, splay);
  set3(pose, 'shin' + side, k, 0, 0);
  set3(pose, 'foot' + side, -k / 2, 0, 0);
  return (rig.thighLen + rig.shinLen) * (1 - Math.cos(k / 2));
}

/** Two-leg crouch: bends both knees and lowers the hips so the feet stay planted. */
export function crouch(pose: Pose, rig: Rig, knee: number, extraLift = 0): void {
  const drop = legBend(pose, rig, 'L', knee);
  legBend(pose, rig, 'R', knee);
  if (!pose.lift) pose.lift = [0, 0, 0];
  pose.lift[1] += -drop / rig.v + extraLift;
  // lean the torso forward a little to keep balance over the feet
  if (!pose.torso) pose.torso = [0, 0, 0];
  pose.torso[0] += knee * 0.3;
}

// ---- easing ----
export const easeInOut = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
export const easeOut = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - (1 - t) * (1 - t));
export const easeIn = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t);
/** 0→1→0 bump over [a, b] with smooth ends. */
export function bump(t: number, a: number, b: number): number {
  if (t <= a || t >= b) return 0;
  return Math.sin(((t - a) / (b - a)) * Math.PI);
}
/** Smooth periodic "occasionally" envelope: ~0 most of the period, eases to 1 for `dur` s. */
export function every(t: number, period: number, dur: number, phase = 0): number {
  const c = (((t + phase) % period) + period) % period;
  if (c > dur) return 0;
  return Math.sin((c / dur) * Math.PI) ** 2;
}

/**
 * Hop timeline driven by seconds-since-click `sel` (≥0). Returns
 * { knee, lift (voxels), arms (0..1 raise) }: anticipation crouch → jump → land
 * with the knees absorbing → recover.
 */
export function hopCurve(sel: number, height = 6): { knee: number; lift: number; air: number } {
  if (sel < 0) return { knee: 0, lift: 0, air: 0 };
  const T_CROUCH = 0.24, T_AIR = 0.42, T_LAND = 0.3;
  if (sel < T_CROUCH) return { knee: 1.35 * easeOut(sel / T_CROUCH), lift: 0, air: 0 };
  const a = sel - T_CROUCH;
  if (a < T_AIR) {
    const u = a / T_AIR;
    // push off: knees extend fast, tuck slightly at the apex
    const knee = u < 0.2 ? 1.35 * (1 - easeOut(u / 0.2)) : 0.35 * Math.sin(((u - 0.2) / 0.8) * Math.PI);
    return { knee, lift: height * 4 * u * (1 - u), air: Math.sin(u * Math.PI) };
  }
  const l = a - T_AIR;
  if (l < T_LAND) return { knee: 0.9 * Math.sin((l / T_LAND) * Math.PI) ** 0.7 * (1 - l / T_LAND * 0.3), lift: 0, air: 0 };
  return { knee: 0, lift: 0, air: 0 };
}
