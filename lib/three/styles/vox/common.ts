import * as THREE from 'three';
import { LANDMARK_LAYOUT, type StationId } from '../../layout';
import { VOXEL, instantiate, voxAsset, type VoxInstance } from './assets';
import { charVariant } from './chars';

/** Mirrors PROP_SCALE in lib/three/models.ts (landmark roots are scaled by slot.scale × this). */
export const PROP_SCALE = 1.35;

/** Local units per voxel for a landmark so it renders at exactly VOXEL world units. */
export function landmarkVoxel(id: StationId): number {
  const slot = LANDMARK_LAYOUT.find((s) => s.id === id)!;
  return VOXEL / (slot.scale * PROP_SCALE);
}

/** Instantiate a landmark model facing the camera (front +Z → rotation π/4). */
export function landmarkModel(id: StationId, key: string = id): VoxInstance & { s: number } {
  const s = landmarkVoxel(id);
  const inst = instantiate(key, s);
  inst.group.rotation.y = Math.PI / 4;
  return { ...inst, s };
}

/** Manifest `meta` point (author voxel coords) → model-local position. */
export function metaPoint(key: string, metaKey: string, s: number): THREE.Vector3 {
  const { asset, entry } = voxAsset(key);
  const m = (entry as unknown as { meta?: Record<string, [number, number, number]> }).meta?.[metaKey];
  if (!m) return new THREE.Vector3();
  const org = entry.origin ?? [(asset.bmin[0] + asset.bmax[0]) / 2, asset.bmin[1], (asset.bmin[2] + asset.bmax[2]) / 2];
  return new THREE.Vector3((m[0] - org[0]) * s, (m[1] - org[1]) * s, (m[2] - org[2]) * s);
}

/** Set every emissive material to base × k (k = 1 → rest). */
export function glowAll(inst: VoxInstance, k: number, mats: THREE.MeshToonMaterial[] = inst.allEmit): void {
  for (const m of mats) m.emissiveIntensity = (inst.baseGlow.get(m) ?? 1) * k;
}

export const TAU = Math.PI * 2;

/**
 * Slide a landmark model sideways ON SCREEN within its slot (world units;
 * + = screen-right). Used to un-stack landmarks whose fixed slots line up one
 * behind the other from the camera (e.g. awards in front of education).
 */
export function nudgeOnScreen(group: THREE.Object3D, id: StationId, worldUnits: number): void {
  // The model group is turned π/4, so its LOCAL +x points exactly screen-right.
  // Shift the children (not the group) so models.ts' oriented hit-proxy, which
  // measures the unrotated group, follows the visual.
  const slot = LANDMARK_LAYOUT.find((s) => s.id === id)!;
  const k = worldUnits / (slot.scale * PROP_SCALE);
  for (const c of group.children) c.position.x += k;
}

/**
 * Instantiate a character model (the variant picked by ?char, see ./chars.ts)
 * inside a landmark's rotated group. Character files are authored at `res`×
 * the landmark density with coordinates = res × the landmark's, so they land
 * exactly in place at landmarkVoxel / res per voxel.
 */
export function characterModel(parent: { group: THREE.Group; s: number }, baseKey: string): VoxInstance {
  const v = charVariant();
  const inst = instantiate(baseKey + v.suffix, parent.s / v.res);
  parent.group.add(inst.group);
  return inst;
}
