import * as THREE from 'three';
import { GRADIENT, color } from '../../kit';

export { color };
import { LANDMARK_LAYOUT, type StationId } from '../../layout';

/**
 * "Refined" style toolkit — same code-primitive approach as classic, but with
 * an art-directed palette and a consistent PIXEL GRAIN:
 *
 *  - Landmarks are designed in GRID UNITS where 1 unit = 0.1 world units at the
 *    landmark's final on-island scale (slot.scale × PROP_SCALE). Every part is a
 *    whole number of units, so all models share one pixel resolution.
 *  - Static parts are MERGED into one vertex-coloured mesh per (sub)assembly
 *    (one draw call), with art-directed face tints: tops are lifted toward a
 *    warm highlight, bottoms pushed toward a cool shade.
 *  - Glowing / animated-material parts stay separate meshes with CLONED
 *    materials (never mutate a shared cache).
 */

/** Must match models.ts PROP_SCALE. */
const PROP_SCALE = 1.35;
/** World size of one grid unit. */
export const WORLD_UNIT = 0.1;

/** Local size of one grid unit for a landmark slot. */
export function unitFor(id: StationId): number {
  const s = LANDMARK_LAYOUT.find((l) => l.id === id)?.scale ?? 1;
  return WORLD_UNIT / (PROP_SCALE * s);
}

// ------------------------------------------------------------- palette ----
// Harmonious with kit P (teal/indigo world, rose horizon) but lighter and more
// saturated on the landmarks so they pop off a mid-value ground.
export const RP = {
  // ground
  grass: 0x8cbf6a,
  grassLight: 0x9ccc75,
  grassDark: 0x79ad5e,
  grassSide: 0x5f9a58,
  path: 0xe6d3a0,
  pathEdge: 0xd2b984,
  sand: 0xf0d9a6,
  sandWet: 0xc9b27e,
  dirt: 0xa8744e,
  dirtDark: 0x8a5d43,
  rockWarm: 0x93746a,
  rockCool: 0x7a6f96,
  rockDeep: 0x5c5682,
  rockAbyss: 0x464368,
  // water
  water: 0x3fa9c0,
  waterDeep: 0x2f8aa8,
  waterLight: 0x72d3d8,
  foam: 0xf3fbf7,
  // materials
  stone: 0xf1e6cf,
  stoneShade: 0xd5c8b0,
  stoneDark: 0xb3a690,
  wood: 0xdca46a,
  woodLight: 0xeabb82,
  woodDark: 0xa86f47,
  woodDeep: 0x7d5038,
  metal: 0xd9dbe6,
  metalDark: 0x8d91a8,
  ink: 0x2d2b45,
  white: 0xfbf6ec,
  // accents
  teal: 0x4cc6c4,
  tealDark: 0x2f9aa0,
  coral: 0xf0785c,
  coralDark: 0xc95a48,
  gold: 0xf5c84e,
  goldDark: 0xd09a35,
  amber: 0xffb45a,
  violet: 0x9c86e6,
  violetDark: 0x6f5cc0,
  indigo: 0x464f93,
  pink: 0xee7fae,
  pinkDark: 0xc95b8b,
  blue: 0x5a9ee8,
  blueDark: 0x3d74c2,
  screen: 0x2a5f9e,
  red: 0xe25d52,
  // people
  skin: 0xf3bf95,
  skinShade: 0xdf9f78,
  hair: 0x4b3329,
  blush: 0xf29a8e,
  // foliage
  leaf: 0x4f9a5a,
  leafMid: 0x62b062,
  leafLight: 0x86c96c,
  trunk: 0x8a5a3c,
  // decor
  pebble: 0xb4b0c6,
  pebbleShade: 0x938fab,
} as const;

// --------------------------------------------------- shared materials ----
let vcMat: THREE.MeshToonMaterial | null = null;
/** The one material every merged, vertex-coloured mesh shares. */
export function vertexMat(): THREE.MeshToonMaterial {
  if (!vcMat) {
    vcMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: GRADIENT });
    (vcMat as THREE.Material as { flatShading?: boolean }).flatShading = true;
  }
  return vcMat;
}

/** A fresh (clone-safe) glowing material — safe to animate. */
export function glowMat(hex: number, intensity = 1): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({
    color: color(hex),
    gradientMap: GRADIENT,
    emissive: color(hex),
    emissiveIntensity: intensity,
  });
}

/** A fresh translucent material (holograms, glass). */
export function glassMat(hex: number, opacity = 0.5, glow = 0.4): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({
    color: color(hex),
    gradientMap: GRADIENT,
    emissive: color(hex),
    emissiveIntensity: glow,
    transparent: true,
    opacity,
    depthWrite: false,
  });
}

// ------------------------------------------------------------- mesher ----
const BOX_T = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
const cylCache = new Map<number, THREE.BufferGeometry>();
function cylT(radial: number): THREE.BufferGeometry {
  let g = cylCache.get(radial);
  if (!g) {
    // unit cylinder (r=0.5, h=1), rotated so a flat side faces +Z for even counts
    g = new THREE.CylinderGeometry(0.5, 0.5, 1, radial, 1).toNonIndexed();
    g.rotateY(Math.PI / radial);
    g.deleteAttribute('uv');
    g.computeVertexNormals();
    cylCache.set(radial, g);
  }
  return g;
}

const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _v = new THREE.Vector3();
const _n3 = new THREE.Matrix3();
const _base = new THREE.Color();
const _top = new THREE.Color();
const _bot = new THREE.Color();
const WARM = color(0xfff3dc);
const COOL = color(0x3a3f6a);

export interface PartOpts {
  rx?: number;
  ry?: number;
  rz?: number;
  /** Colour override for the up-facing faces. */
  top?: number;
  /** Disable the top/bottom face tint. */
  flat?: boolean;
}

/**
 * Accumulates many boxes (in GRID UNITS) into ONE vertex-coloured mesh.
 * Coordinates are box CENTRES in units; the mesh is emitted in local space
 * (units × u).
 */
export class Mesher {
  private pos: number[] = [];
  private nor: number[] = [];
  private col: number[] = [];
  constructor(public u = 1) {}

  /** Box: size (w,h,d) + centre (x,y,z), all in grid units. */
  b(hex: number, w: number, h: number, d: number, x: number, y: number, z: number, o?: PartOpts): this {
    const u = this.u;
    _e.set(o?.rx ?? 0, o?.ry ?? 0, o?.rz ?? 0);
    _q.setFromEuler(_e);
    _m4.compose(_p.set(x * u, y * u, z * u), _q, _s.set(w * u, h * u, d * u));
    this.add(BOX_T, hex, _m4, o);
    return this;
  }

  /**
   * ROUNDED box (centre + size): vertical edges chamfered by `c` and inset
   * top/bottom caps, so it reads as a soft voxel blob (heads, torsos, hair)
   * instead of a hard cube. Same pixel grain, no facet stripes.
   */
  r(hex: number, w: number, h: number, d: number, x: number, y: number, z: number, c = 1, o?: PartOpts): this {
    const hc = h - 2 * c;
    this.b(hex, w, hc, d - 2 * c, x, y, z, o).b(hex, w - 2 * c, hc, d, x, y, z, o);
    this.b(hex, w - 2 * c, c, d - 2 * c, x, y + h / 2 - c / 2, z, o);
    this.b(hex, w - 2 * c, c, d - 2 * c, x, y - h / 2 + c / 2, z, o);
    return this;
  }

  /** Box by its MIN corner + size (handy for stacking): x0,y0,z0 → +w,+h,+d. */
  c(hex: number, x0: number, y0: number, z0: number, w: number, h: number, d: number, o?: PartOpts): this {
    return this.b(hex, w, h, d, x0 + w / 2, y0 + h / 2, z0 + d / 2, o);
  }

  /** Low-poly prism (radial 4–8): diameter, height, centre — grid units. */
  cyl(hex: number, dia: number, h: number, x: number, y: number, z: number, radial = 8, o?: PartOpts): this {
    const u = this.u;
    _e.set(o?.rx ?? 0, o?.ry ?? 0, o?.rz ?? 0);
    _q.setFromEuler(_e);
    _m4.compose(_p.set(x * u, y * u, z * u), _q, _s.set(dia * u, h * u, dia * u));
    this.add(cylT(radial), hex, _m4, o);
    return this;
  }

  /** Merge an arbitrary non-indexed geometry with a full matrix (local units). */
  add(g: THREE.BufferGeometry, hex: number, m4: THREE.Matrix4, o?: PartOpts): void {
    _n3.getNormalMatrix(m4);
    const P = g.attributes.position as THREE.BufferAttribute;
    const N = g.attributes.normal as THREE.BufferAttribute;
    _base.setHex(hex, THREE.SRGBColorSpace);
    if (o?.top !== undefined) _top.setHex(o.top, THREE.SRGBColorSpace);
    else _top.copy(_base);
    if (!o?.flat) {
      // hue-preserving lift (multiplicative) + a whisper of warm light, so
      // dark tops (hair, wood) stay saturated instead of washing out grey
      _top.multiplyScalar(1.12).lerp(WARM, 0.05);
      _bot.copy(_base).multiplyScalar(0.8).lerp(COOL, 0.12);
    } else {
      _bot.copy(_base);
    }
    for (let i = 0; i < P.count; i++) {
      _v.fromBufferAttribute(P, i).applyMatrix4(m4);
      this.pos.push(_v.x, _v.y, _v.z);
      _v.fromBufferAttribute(N, i).applyMatrix3(_n3).normalize();
      this.nor.push(_v.x, _v.y, _v.z);
      const c = _v.y > 0.6 ? _top : _v.y < -0.6 ? _bot : _base;
      this.col.push(c.r, c.g, c.b);
    }
  }

  /** Raw coloured quad (already in local space, CCW seen from the normal). */
  quad(
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    cx: number, cy: number, cz: number,
    dx: number, dy: number, dz: number,
    nx: number, ny: number, nz: number,
    r: number, g: number, b: number,
  ): void {
    // auto-fix winding so the quad faces its normal (front-face culling)
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    const crx = uy * vz - uz * vy, cry = uz * vx - ux * vz, crz = ux * vy - uy * vx;
    if (crx * nx + cry * ny + crz * nz < 0) {
      this.pos.push(ax, ay, az, dx, dy, dz, cx, cy, cz, ax, ay, az, cx, cy, cz, bx, by, bz);
    } else {
      this.pos.push(ax, ay, az, bx, by, bz, cx, cy, cz, ax, ay, az, cx, cy, cz, dx, dy, dz);
    }
    for (let i = 0; i < 6; i++) {
      this.nor.push(nx, ny, nz);
      this.col.push(r, g, b);
    }
  }

  get empty(): boolean {
    return this.pos.length === 0;
  }

  /** Emit the merged mesh (or null if nothing was added) and reset. */
  build(material: THREE.Material = vertexMat()): THREE.Mesh | null {
    if (this.pos.length === 0) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    this.pos = [];
    this.nor = [];
    this.col = [];
    return new THREE.Mesh(geo, material);
  }

  /** build() + add to a parent. */
  to(parent: THREE.Object3D): THREE.Mesh | null {
    const m = this.build();
    if (m) parent.add(m);
    return m;
  }
}

/** A child pivot group positioned in grid units. */
export function piv(parent: THREE.Object3D, u: number, x = 0, y = 0, z = 0): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x * u, y * u, z * u);
  parent.add(g);
  return g;
}

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
/**
 * A single (non-merged) box in grid units with its OWN material (for glowing /
 * fading parts). NOTE: size is baked into mesh.scale (= w*u etc.) — animate
 * size with ABSOLUTE values.
 */
export function sbox(
  parent: THREE.Object3D, u: number, material: THREE.Material,
  w: number, h: number, d: number, x: number, y: number, z: number,
): THREE.Mesh {
  const m = new THREE.Mesh(UNIT_BOX, material);
  m.scale.set(w * u, h * u, d * u);
  m.position.set(x * u, y * u, z * u);
  parent.add(m);
  return m;
}

/** Deterministic hash noise in [0,1). */
export function rng(i: number, salt = 0): number {
  const v = Math.sin(i * 127.1 + salt * 311.7 + 7.13) * 43758.5453;
  return v - Math.floor(v);
}

/** Smooth 2D value noise in [0,1) (deterministic). */
export function vnoise(x: number, z: number, salt = 0): number {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const h = (a: number, b: number) => rng(a * 57 + b * 131, salt);
  const sx = xf * xf * (3 - 2 * xf);
  const sz = zf * zf * (3 - 2 * zf);
  const a = h(xi, zi) + (h(xi + 1, zi) - h(xi, zi)) * sx;
  const b = h(xi, zi + 1) + (h(xi + 1, zi + 1) - h(xi, zi + 1)) * sx;
  return a + (b - a) * sz;
}

export const TAU = Math.PI * 2;
export const osc = (t: number, period: number, phase = 0) => Math.sin((t / period) * TAU + phase);
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
