import * as THREE from 'three';
import { GRADIENT, color } from '../../kit';
import { LANDMARK_LAYOUT, type StationId } from '../../layout';

/**
 * Voxel toolkit for the 'voxel' style. EVERYTHING in this style (landmarks,
 * decor, terrain, water) is authored as a 3D grid of palette indices and meshed
 * into exposed-face-only BufferGeometry with vertex colours + baked voxel AO.
 * One world-space voxel size (V) is used everywhere so the on-screen "pixel
 * resolution" of every object is identical after RenderPixelatedPass.
 */

/** World-space edge length of ONE voxel, for every model in this style. */
export const V = 0.125;

/** Must mirror PROP_SCALE in models.ts (landmark roots are scaled by it). */
const PROP_SCALE = 1.35;

/** Local voxel size for a landmark, compensating its root scale → on-screen = V. */
export function landmarkVoxel(id: StationId): number {
  const slot = LANDMARK_LAYOUT.find((L) => L.id === id);
  return V / ((slot?.scale ?? 1) * PROP_SCALE);
}

/* ------------------------------------------------------------ random ---- */

/** Deterministic hash → [0,1). */
export function hash3(x: number, y: number, z: number, salt = 0): number {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647 + salt * 974711) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Smooth value noise in 2D (cheap; used for organic edges / colour clumps). */
export function noise2(x: number, z: number, salt = 0): number {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const w = zf * zf * (3 - 2 * zf);
  const a = hash3(xi, 0, zi, salt);
  const b = hash3(xi + 1, 0, zi, salt);
  const c = hash3(xi, 0, zi + 1, salt);
  const d = hash3(xi + 1, 0, zi + 1, salt);
  return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
}

/* ------------------------------------------------------------ palette --- */

export interface PalEntry {
  hex: number;
  /** ± value jitter per voxel (0.04 ≈ ±4%). */
  jitter: number;
  /** Rendered in the emissive mesh. */
  glow: boolean;
}

/* ------------------------------------------------------------ grid ------ */

/**
 * Dense voxel grid over an inclusive integer box. Index 0 = empty. Each grid
 * carries its own small palette (index → colour). Out-of-bounds writes are
 * silently dropped so shape helpers can overshoot freely.
 */
export class Grid {
  readonly x0: number; readonly y0: number; readonly z0: number;
  readonly nx: number; readonly ny: number; readonly nz: number;
  readonly data: Uint8Array;
  readonly pal: PalEntry[] = [{ hex: 0, jitter: 0, glow: false }];

  constructor(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) {
    this.x0 = x0; this.y0 = y0; this.z0 = z0;
    this.nx = x1 - x0 + 1; this.ny = y1 - y0 + 1; this.nz = z1 - z0 + 1;
    this.data = new Uint8Array(this.nx * this.ny * this.nz);
  }

  /** Register a colour; returns its palette index (reuses identical entries). */
  c(hex: number, jitter = 0.035, glow = false): number {
    const i = this.pal.findIndex((p) => p.hex === hex && p.jitter === jitter && p.glow === glow);
    if (i > 0) return i;
    if (this.pal.length >= 255) throw new Error('voxel palette full');
    this.pal.push({ hex, jitter, glow });
    return this.pal.length - 1;
  }
  /** Glowing colour (goes into the emissive mesh). */
  g(hex: number, jitter = 0.02): number {
    return this.c(hex, jitter, true);
  }

  private idx(x: number, y: number, z: number): number {
    const ix = x - this.x0, iy = y - this.y0, iz = z - this.z0;
    if (ix < 0 || iy < 0 || iz < 0 || ix >= this.nx || iy >= this.ny || iz >= this.nz) return -1;
    return (iy * this.nz + iz) * this.nx + ix;
  }
  get(x: number, y: number, z: number): number {
    const i = this.idx(x, y, z);
    return i < 0 ? 0 : this.data[i];
  }
  set(x: number, y: number, z: number, c: number): this {
    const i = this.idx(Math.round(x), Math.round(y), Math.round(z));
    if (i >= 0) this.data[i] = c;
    return this;
  }
  /** Set only if currently empty. */
  add(x: number, y: number, z: number, c: number): this {
    const i = this.idx(Math.round(x), Math.round(y), Math.round(z));
    if (i >= 0 && this.data[i] === 0) this.data[i] = c;
    return this;
  }
  /** Inclusive axis-aligned box (any corner order). */
  box(ax: number, ay: number, az: number, bx: number, by: number, bz: number, c: number): this {
    const [x0, x1] = ax < bx ? [ax, bx] : [bx, ax];
    const [y0, y1] = ay < by ? [ay, by] : [by, ay];
    const [z0, z1] = az < bz ? [az, bz] : [bz, az];
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++)
        for (let x = x0; x <= x1; x++) this.set(x, y, z, c);
    return this;
  }
  /** Hollow box shell (walls only) — handy for frames / crates. */
  frame(ax: number, ay: number, az: number, bx: number, by: number, bz: number, c: number): this {
    for (let y = ay; y <= by; y++)
      for (let z = az; z <= bz; z++)
        for (let x = ax; x <= bx; x++) {
          const edges = +(x === ax || x === bx) + +(y === ay || y === by) + +(z === az || z === bz);
          if (edges >= 2) this.set(x, y, z, c);
        }
    return this;
  }
  /** Filled ellipsoid centred at (cx,cy,cz) with radii (rx,ry,rz) in voxels. */
  ellipsoid(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, c: number,
    rough = 0, salt = 0): this {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++)
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2;
          const lim = 1 + (rough ? (hash3(x, y, z, salt) - 0.5) * rough : 0);
          if (d <= lim) this.set(x, y, z, c);
        }
    return this;
  }
  sphere(cx: number, cy: number, cz: number, r: number, c: number, rough = 0, salt = 0): this {
    return this.ellipsoid(cx, cy, cz, r, r, r, c, rough, salt);
  }
  /** Vertical cylinder (axis Y) from y0..y1 inclusive; radius may taper. */
  cyl(cx: number, cz: number, y0: number, y1: number, r0: number, c: number, r1 = r0): this {
    for (let y = y0; y <= y1; y++) {
      const f = y1 === y0 ? 0 : (y - y0) / (y1 - y0);
      const r = r0 + (r1 - r0) * f;
      for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++)
        for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
          if ((x - cx) ** 2 + (z - cz) ** 2 <= r * r + 0.25) this.set(x, y, z, c);
    }
    return this;
  }
  /** Disc in a horizontal plane (radius r, optional ring inner radius). */
  disc(cx: number, y: number, cz: number, r: number, c: number, inner = -1): this {
    for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const d = (x - cx) ** 2 + (z - cz) ** 2;
        if (d <= r * r + 0.25 && d > inner * inner + 0.25 * Math.sign(inner)) this.set(x, y, z, c);
      }
    return this;
  }
  /** 3D DDA line (one voxel thick), endpoints inclusive. */
  line(ax: number, ay: number, az: number, bx: number, by: number, bz: number, c: number): this {
    const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay), Math.abs(bz - az), 1);
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      this.set(ax + (bx - ax) * f, ay + (by - ay) * f, az + (bz - az) * f, c);
    }
    return this;
  }
  /** Mirror every voxel with x > 0 onto -x (or x < 0 onto +x with fromNeg). */
  mirrorX(fromNeg = false): this {
    for (let y = this.y0; y < this.y0 + this.ny; y++)
      for (let z = this.z0; z < this.z0 + this.nz; z++)
        for (let x = 1; x < this.x0 + this.nx; x++) {
          const src = fromNeg ? -x : x;
          const v = this.get(src, y, z);
          if (v) this.set(-src, y, z, v);
        }
    return this;
  }
  /** Replace colour a → b inside a box (for painting stripes / details). */
  paint(ax: number, ay: number, az: number, bx: number, by: number, bz: number, c: number, only = -1): this {
    for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++)
      for (let z = Math.min(az, bz); z <= Math.max(az, bz); z++)
        for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) {
          const v = this.get(x, y, z);
          if (v && (only < 0 || v === only)) this.set(x, y, z, c);
        }
    return this;
  }
  clear(ax: number, ay: number, az: number, bx: number, by: number, bz: number): this {
    return this.box(ax, ay, az, bx, by, bz, 0);
  }
  /** Highest solid y at column (x,z), or -Infinity. */
  top(x: number, z: number): number {
    for (let y = this.y0 + this.ny - 1; y >= this.y0; y--) if (this.get(x, y, z)) return y;
    return -Infinity;
  }
}

/* ------------------------------------------------------------ materials - */

let _lit: THREE.MeshToonMaterial | null = null;
/** Shared lit toon material (vertex colours). Never animate — it's shared. */
export function litMat(): THREE.MeshToonMaterial {
  if (!_lit) {
    _lit = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: GRADIENT });
    (_lit as THREE.Material as { flatShading?: boolean }).flatShading = true;
  }
  return _lit;
}

// Patch: emissive radiance is tinted by the vertex colour, so one emissive
// material serves every glow colour of a part (emissive = white × intensity).
const glowPatch = (shader: THREE.WebGLProgramParametersWithUniforms) => {
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <emissivemap_fragment>',
    '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance *= vColor.rgb;',
  );
};

/** A FRESH emissive material (animate its emissiveIntensity freely). */
export function glowMat(intensity = 0.9): THREE.MeshToonMaterial {
  const m = new THREE.MeshToonMaterial({
    vertexColors: true,
    gradientMap: GRADIENT,
    emissive: 0xffffff,
    emissiveIntensity: intensity,
  });
  (m as THREE.Material as { flatShading?: boolean }).flatShading = true;
  m.onBeforeCompile = glowPatch;
  m.customProgramCacheKey = () => 'vox-glow';
  return m;
}

/* ------------------------------------------------------------ mesher ---- */

// 6 face directions: normal, and the 4 corner offsets (u,v ∈ {0,1}) as unit
// cube corners, CCW seen from outside.
const FACES: { n: [number, number, number]; c: [number, number, number][]; shade: number }[] = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], shade: 1 },
  { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], shade: 1 },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1 },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 1 },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: 1 },
  { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], shade: 1 },
];
const AO_CURVE = [0.62, 0.76, 0.89, 1.0];

export interface MeshOptions {
  /** Local edge length of a voxel (default V). */
  size?: number;
  /** Voxel-space pivot; it becomes the group origin (group.position = pivot·size). */
  pivot?: [number, number, number];
  /** Glow mesh emissive intensity. */
  glow?: number;
  /** Ambient-occlusion strength 0..1 (default 1). */
  ao?: number;
  /** Skip -Y faces (things only ever seen from above, e.g. water). */
  noBottom?: boolean;
  /** Extra world-space offset added to every vertex (after pivot). */
  offset?: [number, number, number];
  /** Keep a face? f: 0 +X, 1 -X, 2 +Y, 3 -Y, 4 +Z, 5 -Z (after occlusion culling). */
  faces?: (x: number, y: number, z: number, f: number) => boolean;
  /** Add an `aCell` vec3 attribute = the voxel's integer coords (shader animation). */
  cellAttr?: boolean;
}

export interface VoxPart {
  group: THREE.Group;
  lit: THREE.Mesh | null;
  glow: THREE.Mesh | null;
  glowMat: THREE.MeshToonMaterial | null;
}

const _c = new THREE.Color();

/** Build lit + glow geometries for a grid. Voxel (x,y,z) occupies
 *  [x-½,x+½]·s × [y,y+1]·s × [z-½,z+½]·s so odd-width models centre on 0 and
 *  y=0 is the base. */
function buildGeo(grid: Grid, wantGlow: boolean, o: Required<Pick<MeshOptions, 'size' | 'pivot' | 'ao' | 'noBottom' | 'offset'>> & Pick<MeshOptions, 'faces' | 'cellAttr'>): THREE.BufferGeometry | null {
  const { nx, ny, nz, x0, y0, z0, data, pal } = grid;
  const s = o.size;
  const [px, py, pz] = o.pivot;
  const [ox, oy, oz] = o.offset;
  // palette colours in linear space + cool-shift target for dark jitter
  const base = pal.map((p) => color(p.hex));
  const cool = color(0x2a3a6a);
  const pos: number[] = [];
  const col: number[] = [];
  const nrm: number[] = [];
  const idx: number[] = [];
  const cell: number[] = [];
  const solid = (x: number, y: number, z: number) => grid.get(x, y, z) !== 0;
  const aoTmp = [3, 3, 3, 3];
  const mk = () => ({ vi: -1, x: 0, y: 0, z: 0, r: 0, g: 0, b: 0 });
  const last = FACES.map(mk);
  const lastX = [0, 1].map(() => Array.from({ length: nx }, mk));

  for (let iy = 0; iy < ny; iy++)
    for (let iz = 0; iz < nz; iz++)
      for (let ix = 0; ix < nx; ix++) {
        const v = data[(iy * nz + iz) * nx + ix];
        if (!v) continue;
        const pe = pal[v];
        if (pe.glow !== wantGlow) continue;
        const x = ix + x0, y = iy + y0, z = iz + z0;
        // per-voxel colour: value jitter, darker → cooler (hand-made voxel feel)
        const j = (hash3(x, y, z, v) - 0.5) * 2 * pe.jitter;
        _c.copy(base[v]);
        if (j < 0) _c.lerp(cool, -j * 0.6);
        _c.multiplyScalar(1 + j);
        for (let f = 0; f < 6; f++) {
          const F = FACES[f];
          const [nx_, ny_, nz_] = F.n;
          if (o.noBottom && ny_ < 0) continue;
          if (solid(x + nx_, y + ny_, z + nz_)) continue;
          if (o.faces && !o.faces(x, y, z, f)) continue;
          // AO per corner: sample the 3 voxels touching it in the face's outer plane
          let flat = true;
          for (let c = 0; c < 4; c++) {
            const [cx, cy, cz] = F.c[c];
            let a = 3;
            if (o.ao > 0 && !wantGlow) {
              const dx = cx * 2 - 1, dy = cy * 2 - 1, dz = cz * 2 - 1;
              const bx = x + nx_, by = y + ny_, bz = z + nz_;
              // two tangent axes = the axes where the normal is 0
              const t1x = nx_ !== 0 ? 0 : dx, t1y = nx_ !== 0 ? dy : 0;
              const t2y = nz_ !== 0 ? dy : 0, t2z = nz_ !== 0 ? 0 : dz;
              const s1 = solid(bx + t1x, by + t1y, bz) ? 1 : 0;
              const s2 = solid(bx, by + t2y, bz + t2z) ? 1 : 0;
              const sc = solid(bx + t1x, by + t1y + t2y, bz + t2z) ? 1 : 0;
              a = s1 && s2 ? 0 : 3 - (s1 + s2 + sc);
            }
            aoTmp[c] = a;
            if (a !== 3) flat = false;
          }
          // Greedy run-merge along +x: a flat face with the same colour as the
          // face emitted just before it (at x-1, same row) stretches that quad.
          // ±X faces run along +z instead (one tracker per x column).
          const L = f > 1 ? last[f] : lastX[f][ix];
          const canMerge = flat && !o.cellAttr;
          if (canMerge && L.vi >= 0 && L.y === y && L.r === _c.r && L.g === _c.g && L.b === _c.b &&
            (f > 1 ? L.x === x - 1 && L.z === z : L.z === z - 1 && L.x === x)) {
            if (f > 1) { for (let c = 0; c < 4; c++) if (F.c[c][0] === 1) pos[(L.vi + c) * 3] += s; }
            else { for (let c = 0; c < 4; c++) if (F.c[c][2] === 1) pos[(L.vi + c) * 3 + 2] += s; }
            L.x = x; L.z = z;
            continue;
          }
          if (o.cellAttr) cell.push(x, y, z, x, y, z, x, y, z, x, y, z);
          const vi = pos.length / 3;
          for (let c = 0; c < 4; c++) {
            const [cx, cy, cz] = F.c[c];
            const k = 1 - (1 - AO_CURVE[aoTmp[c]]) * o.ao;
            pos.push(
              (x - 0.5 + cx - px) * s + ox,
              (y + cy - py) * s + oy,
              (z - 0.5 + cz - pz) * s + oz,
            );
            nrm.push(nx_, ny_, nz_);
            col.push(_c.r * k, _c.g * k, _c.b * k);
          }
          if (canMerge) { L.vi = vi; L.x = x; L.y = y; L.z = z; L.r = _c.r; L.g = _c.g; L.b = _c.b; }
          else L.vi = -1;
          // flip the quad diagonal so AO interpolates without the classic artefact
          if (aoTmp[0] + aoTmp[2] < aoTmp[1] + aoTmp[3]) idx.push(vi + 1, vi + 2, vi + 3, vi + 1, vi + 3, vi);
          else idx.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
        }
      }
  if (!idx.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  if (o.cellAttr) geo.setAttribute('aCell', new THREE.Float32BufferAttribute(cell, 3));
  geo.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Mesh a grid into a group with (up to) two meshes: lit + glow. Use one grid
 * per ANIMATED part; set `pivot` (voxel coords) to the joint it rotates about.
 */
export function meshGrid(grid: Grid, opts: MeshOptions = {}): VoxPart {
  const o = {
    size: opts.size ?? V,
    pivot: opts.pivot ?? [0, 0, 0] as [number, number, number],
    ao: opts.ao ?? 1,
    noBottom: opts.noBottom ?? false,
    offset: opts.offset ?? [0, 0, 0] as [number, number, number],
    faces: opts.faces,
    cellAttr: opts.cellAttr,
  };
  const group = new THREE.Group();
  group.position.set(o.pivot[0] * o.size, o.pivot[1] * o.size, o.pivot[2] * o.size);
  const lg = buildGeo(grid, false, o);
  const gg = buildGeo(grid, true, o);
  let lit: THREE.Mesh | null = null;
  let glow: THREE.Mesh | null = null;
  let gm: THREE.MeshToonMaterial | null = null;
  if (lg) { lit = new THREE.Mesh(lg, litMat()); group.add(lit); }
  if (gg) { gm = glowMat(opts.glow ?? 0.9); glow = new THREE.Mesh(gg, gm); group.add(glow); }
  return { group, lit, glow, glowMat: gm };
}

/** Convenience: a fresh grid sized for a landmark part (±r wide, 0..h tall). */
export function partGrid(r: number, h: number, below = 0): Grid {
  return new Grid(-r, r, -below, h, -r, r);
}
