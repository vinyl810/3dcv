import * as THREE from 'three';
import {
  meshPart, parseVox, voxEmitMaterial, voxGlassMaterial, voxLitMaterial,
  type PartGeometry, type VoxAsset,
} from './voxfile';

/**
 * Asset registry for the MagicaVoxel style. `preloadVox()` fetches
 * /models/vox/manifest.json + every .vox it lists (in parallel) once; builders
 * then instantiate synchronously from the cache.
 */

export const VOX_BASE = '/models/vox/';

/** ONE on-screen voxel size (world units) for EVERY model in this style. */
export const VOXEL = 0.125;

/**
 * Characters are authored CHAR_RES× finer than landmarks (VOXEL / CHAR_RES =
 * 0.0625 world units), with deliberately simple stylized shapes. Must match
 * CHAR_RES in tools/models/chars.mjs.
 */
export const CHAR_RES = 2;

export type PivotSpec = [number, number, number] | 'center' | 'bottom' | 'top';

export interface ManifestEntry {
  file: string;
  /** Per-part pivot in author voxel coords (Y-up, assembly space). Default: part centre. */
  pivots?: Record<string, PivotSpec>;
  /** Per palette-index emissive intensity override. */
  glow?: Record<string, number>;
  /** Author-space point that becomes the local origin. Default: bbox centre x/z, min y. */
  origin?: [number, number, number];
  /** Terrain-style hollow shell meshing. */
  hollow?: boolean;
  ao?: number;
  /** Parts that must keep one quad per voxel face (e.g. per-face animated water). */
  noMerge?: string[];
}

interface Manifest { voxel: number; models: Record<string, ManifestEntry> }

const cache = new Map<string, { asset: VoxAsset; entry: ManifestEntry }>();
let loading: Promise<void> | null = null;

export function preloadVox(): Promise<void> {
  if (!loading) {
    loading = (async () => {
      const res = await fetch(`${VOX_BASE}manifest.json`);
      if (!res.ok) throw new Error(`vox manifest: HTTP ${res.status}`);
      const man = (await res.json()) as Manifest;
      await Promise.all(
        Object.entries(man.models).map(async ([key, entry]) => {
          const r = await fetch(VOX_BASE + entry.file);
          if (!r.ok) throw new Error(`${entry.file}: HTTP ${r.status}`);
          cache.set(key, { asset: parseVox(await r.arrayBuffer()), entry });
        }),
      );
    })();
    loading.catch(() => { loading = null; });
  }
  return loading;
}

export function voxAsset(key: string): { asset: VoxAsset; entry: ManifestEntry } {
  const a = cache.get(key);
  if (!a) throw new Error(`vox model "${key}" not preloaded`);
  return a;
}

function originOf(asset: VoxAsset, entry: ManifestEntry): [number, number, number] {
  if (entry.origin) return entry.origin;
  return [(asset.bmin[0] + asset.bmax[0]) / 2, asset.bmin[1], (asset.bmin[2] + asset.bmax[2]) / 2];
}

const DEFAULT_GLOW = 1.0;

export interface VoxInstance {
  group: THREE.Group;
  /** Pivot group per named part (position = pivot; animate rotation/position/scale). */
  parts: Record<string, THREE.Group>;
  /** Per-instance (cloned) emissive materials, per part. */
  emits: Record<string, THREE.MeshToonMaterial[]>;
  allEmit: THREE.MeshToonMaterial[];
  /** Base emissiveIntensity of each material (for pulses relative to rest). */
  baseGlow: Map<THREE.MeshToonMaterial, number>;
  glass: THREE.MeshToonMaterial[];
}

/** Geometry cache per (model, scale) so repeated instances share buffers. */
const geoCache = new Map<string, { name: string; pivot: [number, number, number]; geo: PartGeometry }[]>();

function partGeometries(key: string, scale: number) {
  const ck = `${key}@${scale.toFixed(5)}`;
  let g = geoCache.get(ck);
  if (!g) {
    const { asset, entry } = voxAsset(key);
    const org = originOf(asset, entry);
    g = asset.parts.map((p) => {
      const spec = entry.pivots?.[p.name] ?? 'center';
      let pv: [number, number, number];
      if (Array.isArray(spec)) pv = spec;
      else {
        const cx = p.min[0] + p.w / 2, cz = p.min[2] + p.d / 2;
        const y = spec === 'bottom' ? p.min[1] : spec === 'top' ? p.min[1] + p.h : p.min[1] + p.h / 2;
        pv = [cx, y, cz];
      }
      return {
        name: p.name,
        pivot: [(pv[0] - org[0]) * scale, (pv[1] - org[1]) * scale, (pv[2] - org[2]) * scale] as [number, number, number],
        geo: meshPart(p, asset, { scale, origin: pv, ao: entry.ao, hollow: entry.hollow, greedy: !entry.noMerge?.includes(p.name) }),
      };
    });
    geoCache.set(ck, g);
  }
  return g;
}

/**
 * Build a three.js object tree for a model. `scale` = local units per voxel
 * (pass VOXEL / rootScale for landmarks so every model shares one on-screen
 * voxel size).
 */
export function instantiate(key: string, scale: number): VoxInstance {
  const { asset, entry } = voxAsset(key);
  const group = new THREE.Group();
  group.name = `vox:${key}`;
  const parts: Record<string, THREE.Group> = {};
  const emits: Record<string, THREE.MeshToonMaterial[]> = {};
  const allEmit: THREE.MeshToonMaterial[] = [];
  const glass: THREE.MeshToonMaterial[] = [];
  const baseGlow = new Map<THREE.MeshToonMaterial, number>();
  for (const pg of partGeometries(key, scale)) {
    const pivot = new THREE.Group();
    pivot.name = pg.name;
    pivot.position.set(...pg.pivot);
    group.add(pivot);
    parts[pg.name] = pivot;
    emits[pg.name] = [];
    if (pg.geo.lit) pivot.add(new THREE.Mesh(pg.geo.lit, voxLitMaterial()));
    for (const [idx, geo] of pg.geo.emit) {
      const gi = entry.glow?.[String(idx)] ?? (asset.mats.get(idx)?.emit ?? 1) * DEFAULT_GLOW;
      const m = voxEmitMaterial(asset, idx, gi);
      baseGlow.set(m, gi);
      emits[pg.name].push(m);
      allEmit.push(m);
      pivot.add(new THREE.Mesh(geo, m));
    }
    for (const [idx, geo] of pg.geo.glass) {
      const m = voxGlassMaterial(asset, idx, asset.mats.get(idx)?.alpha ?? 0.45);
      glass.push(m);
      const mesh = new THREE.Mesh(geo, m);
      mesh.renderOrder = 2;
      pivot.add(mesh);
    }
  }
  return { group, parts, emits, allEmit, baseGlow, glass };
}

/** Raw per-part geometries (for static merging of decor). */
export function voxPartGeometries(key: string, scale: number) {
  return partGeometries(key, scale);
}
