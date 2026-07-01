import * as THREE from 'three';

/**
 * Shared pixel-art toolkit. EVERY model is built from these helpers so the
 * whole diorama stays visually consistent: one material type (MeshToonMaterial,
 * flat-shaded, banded), one palette, snapped voxel geometry.
 */

// ---- single source of truth palette (sRGB hex) ----
// Refined "Muted Twilight" dusk palette — a cohesive teal-to-indigo world with
// a warm rose horizon and a single jewel-toned accent set.
export const P = {
  abyss: 0x11131f,
  dusk: 0x272445,
  horizon: 0xc2727a,
  oceanTeal: 0x256f80,
  surfCyan: 0x62cdd6,
  foam: 0xeef4f1,
  sand: 0xd9b489,
  grass: 0x5a9670,
  moss: 0x356a54,
  earth: 0x6e4d39,
  amber: 0xf0b266,
  gold: 0xe4bd60,
  magenta: 0xcf6f97,
  synapse: 0x9483d6,
  signalRed: 0xdf6b54,
  slate: 0x3a4254,
  skin: 0xdfa67e,
  hair: 0x3a2a20,
} as const;

export type PaletteName = keyof typeof P;

export function color(hex: number): THREE.Color {
  return new THREE.Color().setHex(hex, THREE.SRGBColorSpace);
}

// ---- banded toon gradient: forces lighting into a few discrete steps ----
function makeToonGradient(steps = 4): THREE.DataTexture {
  const data = new Uint8Array(steps);
  for (let i = 0; i < steps; i++) data[i] = Math.round((i / (steps - 1)) * 255);
  const tex = new THREE.DataTexture(data, steps, 1, THREE.RedFormat);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}
export const GRADIENT = makeToonGradient(4);

// ---- material caches (keyed so identical looks share one material) ----
const litCache = new Map<number, THREE.MeshToonMaterial>();
const emitCache = new Map<string, THREE.MeshToonMaterial>();
const glassCache = new Map<string, THREE.MeshToonMaterial>();

/** Standard lit, flat-shaded toon material for a palette color. */
export function mat(hex: number): THREE.MeshToonMaterial {
  let m = litCache.get(hex);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color: color(hex), gradientMap: GRADIENT });
    (m as THREE.Material as { flatShading?: boolean }).flatShading = true;
    litCache.set(hex, m);
  }
  return m;
}

/** Self-illuminating material — reads as "glowing" in pixel art (no bloom needed). */
export function emit(hex: number, intensity = 1): THREE.MeshToonMaterial {
  const key = `${hex}:${intensity}`;
  let m = emitCache.get(key);
  if (!m) {
    m = new THREE.MeshToonMaterial({
      color: color(hex),
      gradientMap: GRADIENT,
      emissive: color(hex),
      emissiveIntensity: intensity,
    });
    emitCache.set(key, m);
  }
  return m;
}

/** Translucent colored "glass" (domes, holograms, screens). */
export function glass(hex: number, opacity = 0.3, glow = 0.25): THREE.MeshToonMaterial {
  const key = `${hex}:${opacity}:${glow}`;
  let m = glassCache.get(key);
  if (!m) {
    m = new THREE.MeshToonMaterial({
      color: color(hex),
      gradientMap: GRADIENT,
      emissive: color(hex),
      emissiveIntensity: glow,
      transparent: true,
      opacity,
      depthWrite: false,
    });
    glassCache.set(key, m);
  }
  return m;
}

// ---- shared geometry primitives ----
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);

export interface MeshOpts {
  rot?: [number, number, number];
  mat?: THREE.Material; // override material entirely
  emissive?: number; // emissive intensity -> uses emit()
  opacity?: number; // <1 -> uses glass()
  name?: string;
}

function applyOpts(mesh: THREE.Mesh, opts?: MeshOpts) {
  if (opts?.rot) mesh.rotation.set(opts.rot[0], opts.rot[1], opts.rot[2]);
  if (opts?.name) mesh.name = opts.name;
}

function chooseMat(hex: number, opts?: MeshOpts): THREE.Material {
  if (opts?.mat) return opts.mat;
  if (opts?.opacity !== undefined && opts.opacity < 1) return glass(hex, opts.opacity);
  if (opts?.emissive !== undefined) return emit(hex, opts.emissive);
  return mat(hex);
}

/** Axis-aligned box. Returns the mesh so callers can animate it. */
export function box(
  parent: THREE.Object3D,
  hex: number,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  opts?: MeshOpts,
): THREE.Mesh {
  const m = new THREE.Mesh(UNIT_BOX, chooseMat(hex, opts));
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  applyOpts(m, opts);
  parent.add(m);
  return m;
}

/** 1×1×1-ish voxel cube at a position. */
export function voxel(
  parent: THREE.Object3D,
  hex: number,
  x: number,
  y: number,
  z: number,
  size = 1,
  opts?: MeshOpts,
): THREE.Mesh {
  return box(parent, hex, size, size, size, x, y, z, opts);
}

export function cyl(
  parent: THREE.Object3D,
  hex: number,
  rTop: number,
  rBot: number,
  h: number,
  x: number,
  y: number,
  z: number,
  radial = 10,
  opts?: MeshOpts,
): THREE.Mesh {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, radial);
  const m = new THREE.Mesh(g, chooseMat(hex, opts));
  m.position.set(x, y, z);
  applyOpts(m, opts);
  parent.add(m);
  return m;
}

export function cone(
  parent: THREE.Object3D,
  hex: number,
  r: number,
  h: number,
  x: number,
  y: number,
  z: number,
  radial = 8,
  opts?: MeshOpts,
): THREE.Mesh {
  const g = new THREE.ConeGeometry(r, h, radial);
  const m = new THREE.Mesh(g, chooseMat(hex, opts));
  m.position.set(x, y, z);
  applyOpts(m, opts);
  parent.add(m);
  return m;
}

export function sphere(
  parent: THREE.Object3D,
  hex: number,
  r: number,
  x: number,
  y: number,
  z: number,
  seg = 8,
  opts?: MeshOpts,
): THREE.Mesh {
  const g = new THREE.SphereGeometry(r, seg, Math.max(4, Math.floor(seg / 2)));
  const m = new THREE.Mesh(g, chooseMat(hex, opts));
  m.position.set(x, y, z);
  applyOpts(m, opts);
  parent.add(m);
  return m;
}

/** Upper hemisphere (dome). */
export function dome(
  parent: THREE.Object3D,
  hex: number,
  r: number,
  x: number,
  y: number,
  z: number,
  seg = 12,
  opts?: MeshOpts,
): THREE.Mesh {
  const g = new THREE.SphereGeometry(r, seg, seg, 0, Math.PI * 2, 0, Math.PI / 2);
  const m = new THREE.Mesh(g, chooseMat(hex, opts));
  m.position.set(x, y, z);
  applyOpts(m, opts);
  parent.add(m);
  return m;
}

/** A child group at a local offset — handy for animated sub-assemblies. */
export function pivot(
  parent: THREE.Object3D,
  x = 0,
  y = 0,
  z = 0,
): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

/** Convenience: smooth 0..1 ping-pong of a sine. */
export function osc(t: number, period: number, phase = 0): number {
  return Math.sin((t / period) * Math.PI * 2 + phase);
}

/**
 * Per-landmark selection clock. Call ONCE at build time to get a fn, then call
 * that fn each frame as `sel = clock(t, selected)`. It returns the SECONDS since
 * the landmark was last clicked/tapped (0 at the instant of selection), or -1
 * while not selected. This lets a builder drive a one-shot "tap" burst (decaying
 * envelope) plus an optional sustained selected state without tracking dt or
 * doing its own rising-edge detection. NOTE: drive bursts off `sel` (which
 * resets to 0 on each click) — never off the global `t` scaled by hover/sel, or
 * the animation phase jumps.
 *
 * Handy envelopes:
 *   const flash  = Math.exp(-sel * 4);                       // 1→0 decay (glow)
 *   const wobble = Math.exp(-sel * 5) * Math.sin(sel * 22);  // overshoot+settle
 *   const arc    = Math.sin(Math.min(sel, 0.5) / 0.5 * Math.PI) * Math.exp(-sel * 1.5); // a single hop
 */
export function makeSelectionClock(): (t: number, selected: boolean) => number {
  let startT = -1;
  let was = false;
  return (t, selected) => {
    if (selected && !was) startT = t; // rising edge = a fresh click/tap
    was = selected;
    return selected ? Math.max(0, t - startT) : -1;
  };
}

// ---- math helpers reused by builders ----
export const TAU = Math.PI * 2;
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/**
 * What every landmark builder returns. Build at LOCAL origin with the base at
 * y=0; the world places + scales it and handles hover lift. Orient display
 * faces toward the camera corner (+X+Z).
 */
export interface BuiltModel {
  group: THREE.Group;
  /** idle animation; t = elapsed seconds, hover = 0..1, selected = bool */
  update?: (t: number, hover: number, selected: boolean) => void;
  /** Optional point light that switches ON at night (intensity gated in models.ts). */
  nightLight?: THREE.PointLight;
}
