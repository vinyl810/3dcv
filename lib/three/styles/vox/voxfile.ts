import * as THREE from 'three';
import { GRADIENT } from '../../kit';

/**
 * MagicaVoxel .vox (v150) runtime: parse → mesh → three.js objects.
 *
 * three's own VOXLoader only reads SIZE/XYZI/RGBA (one palette per LAST model,
 * no scene graph, no materials), so we parse the file ourselves to also get:
 *  - the scene graph (nTRN/nGRP/nSHP) → named PARTS placed where the author put
 *    them in MagicaVoxel (each part = its own mesh, so it can animate);
 *  - MATL materials → `_emit` voxels become glowing meshes, `_glass` translucent.
 *
 * Coordinates: MagicaVoxel is Z-up; we convert to three's Y-up with
 * three = (vx, vz, -vy) — so a model's MV "front" (-Y) faces three's +Z.
 *
 * Meshing: exposed faces only, one quad per visible voxel face, flat normals,
 * per-vertex palette colour × a soft corner ambient-occlusion term (the
 * MagicaVoxel look), on ONE shared MeshToonMaterial(vertexColors, GRADIENT).
 */

export interface VoxMatInfo {
  kind: 'emit' | 'glass';
  emit: number;
  alpha: number;
}

export interface VoxPart {
  name: string;
  /** Size in Y-up author space (w = x, h = y, d = z). */
  w: number;
  h: number;
  d: number;
  /** Author-space min corner of this part inside the assembly. */
  min: [number, number, number];
  /** Dense voxels, index x + w * (z + d * y); 0 = empty. */
  v: Uint8Array;
}

export interface VoxAsset {
  parts: VoxPart[];
  /** palette[i] = 0xRRGGBB for colour index i (1..255). */
  palette: Uint32Array;
  mats: Map<number, VoxMatInfo>;
  /** Occupied bounds of the whole assembly (author space, inclusive min / exclusive max). */
  bmin: [number, number, number];
  bmax: [number, number, number];
}

// ------------------------------------------------------------------ parse ---

export function parseVox(buf: ArrayBuffer): VoxAsset {
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);
  const id4 = (o: number) => String.fromCharCode(u8[o], u8[o + 1], u8[o + 2], u8[o + 3]);
  if (id4(0) !== 'VOX ') throw new Error('not a .vox file');

  let p = 0;
  const i32 = () => { const v = dv.getInt32(p, true); p += 4; return v; };
  const str = () => {
    const n = i32();
    let s = '';
    for (let k = 0; k < n; k++) s += String.fromCharCode(u8[p + k]);
    p += n;
    return s;
  };
  const dict = () => {
    const n = i32();
    const o: Record<string, string> = {};
    for (let k = 0; k < n; k++) { const key = str(); o[key] = str(); }
    return o;
  };

  const models: { sx: number; sy: number; sz: number; data: Uint8Array }[] = [];
  let pendingSize: [number, number, number] | null = null;
  const palette = new Uint32Array(256);
  let hasPalette = false;
  const mats = new Map<number, VoxMatInfo>();
  type TrnNode = { kind: 'trn'; child: number; name: string; t: [number, number, number] };
  type GrpNode = { kind: 'grp'; children: number[] };
  type ShpNode = { kind: 'shp'; model: number };
  const nodes = new Map<number, TrnNode | GrpNode | ShpNode>();

  // MAIN header at 8: id, contentSize, childrenSize → children start at 20.
  let o = 20;
  while (o + 12 <= buf.byteLength) {
    const id = id4(o);
    const size = dv.getInt32(o + 4, true);
    const kids = dv.getInt32(o + 8, true);
    p = o + 12;
    if (id === 'SIZE') {
      pendingSize = [i32(), i32(), i32()];
    } else if (id === 'XYZI' && pendingSize) {
      const n = i32();
      models.push({ sx: pendingSize[0], sy: pendingSize[1], sz: pendingSize[2], data: u8.subarray(p, p + n * 4) });
      pendingSize = null;
    } else if (id === 'RGBA') {
      for (let k = 0; k < 255; k++) {
        const q = p + k * 4;
        palette[k + 1] = (u8[q] << 16) | (u8[q + 1] << 8) | u8[q + 2];
      }
      hasPalette = true;
    } else if (id === 'MATL') {
      const mid = i32();
      const d = dict();
      if (d._type === '_emit') mats.set(mid, { kind: 'emit', emit: parseFloat(d._emit ?? '1') || 1, alpha: 1 });
      else if (d._type === '_glass') {
        const tr = parseFloat(d._trans ?? d._alpha ?? '0.5');
        mats.set(mid, { kind: 'glass', emit: 0, alpha: THREE.MathUtils.clamp(1 - tr, 0.15, 0.9) });
      }
    } else if (id === 'nTRN') {
      const nid = i32();
      const attr = dict();
      const child = i32();
      i32(); // reserved
      i32(); // layer
      const nf = i32();
      let t: [number, number, number] = [0, 0, 0];
      for (let f = 0; f < nf; f++) {
        const fr = dict();
        if (f === 0 && fr._t) {
          const a = fr._t.split(/\s+/).map(Number);
          t = [a[0] || 0, a[1] || 0, a[2] || 0];
        }
      }
      nodes.set(nid, { kind: 'trn', child, name: attr._name ?? '', t });
    } else if (id === 'nGRP') {
      const nid = i32();
      dict();
      const n = i32();
      const children: number[] = [];
      for (let k = 0; k < n; k++) children.push(i32());
      nodes.set(nid, { kind: 'grp', children });
    } else if (id === 'nSHP') {
      const nid = i32();
      dict();
      i32(); // numModels (we use the first)
      nodes.set(nid, { kind: 'shp', model: i32() });
    }
    o += 12 + size + kids;
  }
  if (!hasPalette) throw new Error('.vox without RGBA palette is not supported here');

  // Resolve each model's placement + name from the scene graph.
  const place = new Map<number, { t: [number, number, number]; name: string }>();
  const walk = (nid: number, t: [number, number, number], name: string) => {
    const n = nodes.get(nid);
    if (!n) return;
    if (n.kind === 'trn') {
      walk(n.child, [t[0] + n.t[0], t[1] + n.t[1], t[2] + n.t[2]], n.name || name);
    } else if (n.kind === 'grp') {
      for (const c of n.children) walk(c, t, name);
    } else if (!place.has(n.model)) {
      place.set(n.model, { t, name });
    }
  };
  if (nodes.has(0)) walk(0, [0, 0, 0], '');

  const parts: VoxPart[] = [];
  const bmin: [number, number, number] = [Infinity, Infinity, Infinity];
  const bmax: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  models.forEach((m, i) => {
    const pl = place.get(i) ?? { t: [Math.floor(m.sx / 2), Math.floor(m.sy / 2), Math.floor(m.sz / 2)] as [number, number, number], name: '' };
    const w = m.sx, h = m.sz, d = m.sy;
    const min: [number, number, number] = [
      pl.t[0] - Math.floor(m.sx / 2),
      pl.t[2] - Math.floor(m.sz / 2),
      -(pl.t[1] - Math.floor(m.sy / 2) + m.sy - 1),
    ];
    const v = new Uint8Array(w * h * d);
    for (let k = 0; k < m.data.length; k += 4) {
      const lx = m.data[k], ly = m.data[k + 1], lz = m.data[k + 2], c = m.data[k + 3];
      v[lx + w * ((d - 1 - ly) + d * lz)] = c;
    }
    parts.push({ name: pl.name || `part${i}`, w, h, d, min, v });
    for (let a = 0; a < 3; a++) {
      bmin[a] = Math.min(bmin[a], min[a]);
      bmax[a] = Math.max(bmax[a], min[a] + [w, h, d][a]);
    }
  });
  return { parts, palette, mats, bmin, bmax };
}

// ------------------------------------------------------------------- mesh ---

/** Per-direction face setup: normal, the in-plane u/v axes, and CCW corners. */
interface FaceDir { n: [number, number, number]; axis: number; u: number; v: number; corners: [number, number][] }
const FACE_DIRS: FaceDir[] = (() => {
  const dirs: FaceDir[] = [];
  for (let axis = 0; axis < 3; axis++) {
    for (const s of [1, -1]) {
      const n: [number, number, number] = [0, 0, 0];
      n[axis] = s;
      const u = (axis + 1) % 3, v = (axis + 2) % 3;
      // corners in (u, v) unit square; flip winding so it is CCW seen from +n
      let corners: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];
      // cross(U, V) points along +axis (cyclic order) → CCW for s>0; reverse for s<0
      if (s < 0) corners = [[0, 0], [0, 1], [1, 1], [1, 0]];
      dirs.push({ n, axis, u, v, corners });
    }
  }
  return dirs;
})();

export interface MeshOptions {
  /** World units per voxel. */
  scale: number;
  /** Author-space point that maps to the local origin (in voxel units). */
  origin: [number, number, number];
  /** Corner ambient occlusion strength 0..1 (0 = off). */
  ao?: number;
  /**
   * Only draw faces that border the OUTSIDE (flood-filled from the bounds) —
   * lets big terrain be stored as a thin hollow shell without interior faces.
   */
  hollow?: boolean;
  /** Merge coplanar same-colour, flat-AO faces into big quads (default true). */
  greedy?: boolean;
}

export interface PartGeometry {
  lit: THREE.BufferGeometry | null;
  emit: Map<number, THREE.BufferGeometry>;
  glass: Map<number, THREE.BufferGeometry>;
}

class GeoBuilder {
  pos: number[] = [];
  nor: number[] = [];
  col: number[] = [];
  idx: number[] = [];
  build(): THREE.BufferGeometry | null {
    if (!this.idx.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }
}

const _c = new THREE.Color();

export function meshPart(part: VoxPart, asset: VoxAsset, opts: MeshOptions): PartGeometry {
  const { w, h, d, v } = part;
  const ao = opts.ao ?? 0.32;
  const S = opts.scale;
  const at = (x: number, y: number, z: number) =>
    x < 0 || y < 0 || z < 0 || x >= w || y >= h || z >= d ? 0 : v[x + w * (z + d * y)];
  const isGlass = (c: number) => asset.mats.get(c)?.kind === 'glass';
  const solid = (c: number) => c !== 0 && !isGlass(c);

  // Outside flood fill (hollow mode).
  let outside: Uint8Array | null = null;
  if (opts.hollow) {
    outside = new Uint8Array(w * h * d);
    const q = new Int32Array(w * h * d);
    let qh = 0, qt = 0;
    const push = (x: number, y: number, z: number) => {
      const i = x + w * (z + d * y);
      if (outside![i] || v[i]) return;
      outside![i] = 1;
      q[qt++] = i;
    };
    for (let y = 0; y < h; y++) for (let z = 0; z < d; z++) { push(0, y, z); push(w - 1, y, z); }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { push(x, y, 0); push(x, y, d - 1); }
    for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) { push(x, 0, z); push(x, h - 1, z); }
    while (qh < qt) {
      const i = q[qh++];
      const x = i % w, z = Math.floor(i / w) % d, y = Math.floor(i / (w * d));
      if (x > 0) push(x - 1, y, z); if (x < w - 1) push(x + 1, y, z);
      if (y > 0) push(x, y - 1, z); if (y < h - 1) push(x, y + 1, z);
      if (z > 0) push(x, y, z - 1); if (z < d - 1) push(x, y, z + 1);
    }
  }

  const lit = new GeoBuilder();
  const emitB = new Map<number, GeoBuilder>();
  const glassB = new Map<number, GeoBuilder>();
  const ox = part.min[0] - opts.origin[0];
  const oy = part.min[1] - opts.origin[1];
  const oz = part.min[2] - opts.origin[2];
  const dims = [w, h, d];
  const greedy = opts.greedy !== false;
  const pv = [0, 0, 0];
  const builderFor = (c: number): GeoBuilder => {
    const mi = asset.mats.get(c);
    if (!mi) return lit;
    const map = mi.kind === 'emit' ? emitB : glassB;
    let b = map.get(c);
    if (!b) { b = new GeoBuilder(); map.set(c, b); }
    return b;
  };
  const aoTmp = [1, 1, 1, 1];
  const q3 = [0, 0, 0];
  /** Emit one quad covering cells [i0, i0+du) × [j0, j0+dv) of slice s. */
  const emitQuad = (f: FaceDir, s: number, i0: number, j0: number, du: number, dv: number, c: number, aoV: ArrayLike<number>) => {
    const gb = builderFor(c);
    const hex = asset.palette[c];
    _c.setRGB(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255, THREE.SRGBColorSpace);
    const base = gb.pos.length / 3;
    for (let k = 0; k < 4; k++) {
      const [cu, cv] = f.corners[k];
      q3[f.axis] = s + (f.n[f.axis] > 0 ? 1 : 0);
      q3[f.u] = i0 + cu * du;
      q3[f.v] = j0 + cv * dv;
      gb.pos.push((q3[0] + ox) * S, (q3[1] + oy) * S, (q3[2] + oz) * S);
      gb.nor.push(f.n[0], f.n[1], f.n[2]);
      gb.col.push(_c.r * aoV[k], _c.g * aoV[k], _c.b * aoV[k]);
    }
    // split along the diagonal that keeps AO gradients symmetric
    if (aoV[0] + aoV[2] >= aoV[1] + aoV[3]) gb.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    else gb.idx.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
  };

  for (const f of FACE_DIRS) {
    const nu = dims[f.u], nv = dims[f.v];
    const key = new Int32Array(nu * nv);
    const aoM = new Float32Array(nu * nv * 4);
    const col = new Uint8Array(nu * nv);
    for (let s = 0; s < dims[f.axis]; s++) {
      key.fill(-1);
      // 1) visibility + AO per cell of this slice
      for (let j = 0; j < nv; j++)
        for (let i = 0; i < nu; i++) {
          pv[f.axis] = s; pv[f.u] = i; pv[f.v] = j;
          const x = pv[0], y = pv[1], z = pv[2];
          const c = v[x + w * (z + d * y)];
          if (!c) continue;
          const mi = asset.mats.get(c);
          const glass = mi?.kind === 'glass';
          const nx = x + f.n[0], ny = y + f.n[1], nz = z + f.n[2];
          const nb = at(nx, ny, nz);
          if (glass ? nb !== 0 : solid(nb)) continue;
          if (outside && !glass) {
            const inB = nx >= 0 && ny >= 0 && nz >= 0 && nx < w && ny < h && nz < d;
            if (inB && !nb && !outside[nx + w * (nz + d * ny)]) continue;
          }
          let occSig = 0;
          let uniform = true;
          for (let k = 0; k < 4; k++) {
            aoTmp[k] = 1;
            if (ao > 0 && !mi) {
              const [cu, cv] = f.corners[k];
              const du = cu ? 1 : -1, dvv = cv ? 1 : -1;
              const a = [nx, ny, nz], b = [nx, ny, nz], cc = [nx, ny, nz];
              a[f.u] += du; b[f.v] += dvv; cc[f.u] += du; cc[f.v] += dvv;
              const s1 = solid(at(a[0], a[1], a[2])) ? 1 : 0;
              const s2 = solid(at(b[0], b[1], b[2])) ? 1 : 0;
              const s3 = solid(at(cc[0], cc[1], cc[2])) ? 1 : 0;
              const occ = s1 && s2 ? 3 : s1 + s2 + s3;
              aoTmp[k] = 1 - ao * (occ / 3);
              if (k === 0) occSig = occ; else if (occ !== occSig) uniform = false;
            }
          }
          const m = i + nu * j;
          col[m] = c;
          for (let k = 0; k < 4; k++) aoM[m * 4 + k] = aoTmp[k];
          key[m] = greedy && uniform ? c * 4 + occSig : -2;
        }
      // 2) greedy rectangles of identical (colour, flat-AO) faces
      for (let j = 0; j < nv; j++)
        for (let i = 0; i < nu; i++) {
          const m = i + nu * j;
          const k0 = key[m];
          if (k0 === -1) continue;
          if (k0 === -2) {
            emitQuad(f, s, i, j, 1, 1, col[m], aoM.subarray(m * 4, m * 4 + 4));
            key[m] = -1;
            continue;
          }
          let du = 1;
          while (i + du < nu && key[m + du] === k0) du++;
          let dv = 1;
          grow: while (j + dv < nv) {
            for (let e = 0; e < du; e++) if (key[m + e + nu * dv] !== k0) break grow;
            dv++;
          }
          emitQuad(f, s, i, j, du, dv, col[m], aoM.subarray(m * 4, m * 4 + 4));
          for (let b2 = 0; b2 < dv; b2++) for (let e = 0; e < du; e++) key[m + e + nu * b2] = -1;
        }
    }
  }

  const emit = new Map<number, THREE.BufferGeometry>();
  for (const [k, b] of emitB) { const g = b.build(); if (g) emit.set(k, g); }
  const glass = new Map<number, THREE.BufferGeometry>();
  for (const [k, b] of glassB) { const g = b.build(); if (g) glass.set(k, g); }
  return { lit: lit.build(), emit, glass };
}

// -------------------------------------------------------------- materials ---

let _litMat: THREE.MeshToonMaterial | null = null;
/** THE shared lit material for every vox mesh (never animate it). */
export function voxLitMaterial(): THREE.MeshToonMaterial {
  if (!_litMat) {
    _litMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: GRADIENT });
    (_litMat as THREE.Material as { flatShading?: boolean }).flatShading = true;
  }
  return _litMat;
}

export function paletteColor(asset: VoxAsset, idx: number): THREE.Color {
  const hex = asset.palette[idx];
  return new THREE.Color().setRGB(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255, THREE.SRGBColorSpace);
}

/** Fresh (per-instance, animatable) emissive material for a palette index. */
export function voxEmitMaterial(asset: VoxAsset, idx: number, intensity: number): THREE.MeshToonMaterial {
  const col = paletteColor(asset, idx);
  return new THREE.MeshToonMaterial({ color: col, emissive: col, emissiveIntensity: intensity, gradientMap: GRADIENT });
}

export function voxGlassMaterial(asset: VoxAsset, idx: number, alpha: number): THREE.MeshToonMaterial {
  const col = paletteColor(asset, idx);
  return new THREE.MeshToonMaterial({
    color: col, emissive: col, emissiveIntensity: 0.35, gradientMap: GRADIENT,
    transparent: true, opacity: alpha, depthWrite: false,
  });
}
