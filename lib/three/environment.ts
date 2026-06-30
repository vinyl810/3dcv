import * as THREE from 'three';
import { P, color, mat, emit, glass, box, cyl, cone, sphere, dome, voxel, pivot, osc, TAU, GRADIENT } from './kit';
import { type Mark, MARK_COLORS } from '../marks-types';

export interface EnvPart {
  group: THREE.Group;
  update: (t: number, dt: number) => void;
}

/* ============================================================= SKY ===== */

export function buildSky(): EnvPart {
  const group = new THREE.Group();

  // Vertical gradient dome (unlit shader — pure backdrop).
  const skyGeo = new THREE.SphereGeometry(140, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: color(0x252c4a) }, // lifted indigo zenith (brighter backdrop)
      mid: { value: color(0x3d3a68) }, // twilight indigo body
      bot: { value: color(0x584a70) }, // lighter dusky violet near the horizon
      glow: { value: color(0xc97c84) }, // warm rose glow band
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec3 vPos;
      uniform vec3 top; uniform vec3 mid; uniform vec3 bot; uniform vec3 glow;
      void main() {
        float h = normalize(vPos).y;
        // deep dusk base: keeps the whole backdrop dark + cohesive
        vec3 c = mix(bot, mid, smoothstep(-0.15, 0.18, h));
        c = mix(c, top, smoothstep(0.22, 0.85, h));
        // soft warm rose glow hugging the horizon line only (not a flat wall)
        float band = exp(-pow((h + 0.02) / 0.07, 2.0));
        c = mix(c, glow, band * 0.4);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  group.add(new THREE.Mesh(skyGeo, skyMat));

  // Moon-glow disc, back-left, motivates the rim light.
  const moon = new THREE.Mesh(
    new THREE.CircleGeometry(14, 24),
    new THREE.MeshBasicMaterial({
      color: color(P.horizon),
      transparent: true,
      opacity: 0.55,
    }),
  );
  moon.position.set(-70, 34, -60);
  moon.lookAt(0, 10, 0);
  group.add(moon);
  const moonCore = new THREE.Mesh(
    new THREE.CircleGeometry(8, 24),
    new THREE.MeshBasicMaterial({
      color: color(P.amber),
      transparent: true,
      opacity: 0.5,
    }),
  );
  moonCore.position.set(-69, 34, -59);
  moonCore.lookAt(0, 10, 0);
  group.add(moonCore);

  // Stars — static pixel points in the upper sky.
  const starCount = 220;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    // deterministic scatter (no Math.random — keep it reproducible)
    const a = i * 2.39996; // golden angle
    const y = 0.12 + (i / starCount) * 0.85;
    const r = Math.sqrt(1 - Math.min(1, y * y));
    starPos[i * 3] = Math.cos(a) * r * 120;
    starPos[i * 3 + 1] = y * 120;
    starPos[i * 3 + 2] = Math.sin(a) * r * 120;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({
      color: color(P.foam),
      size: 1.1,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.9,
    }),
  );
  group.add(stars);

  // Drifting clouds — flat slabs.
  const clouds: THREE.Mesh[] = [];
  const cloudData = [
    { x: -40, y: 26, z: -30, s: 1.4 },
    { x: 46, y: 32, z: -44, s: 1.0 },
    { x: 20, y: 22, z: -60, s: 1.7 },
  ];
  for (const c of cloudData) {
    const m = new THREE.Group();
    box(m, P.dusk, 10, 2.4, 4, 0, 0, 0);
    box(m, P.dusk, 6, 2.4, 4, -5, 1.2, 0);
    box(m, P.horizon, 7, 2, 4, 4, 1, 0);
    m.scale.setScalar(c.s);
    m.position.set(c.x, c.y, c.z);
    clouds.push(m as unknown as THREE.Mesh);
    group.add(m);
  }

  const starMat = stars.material as THREE.PointsMaterial;
  return {
    group,
    update: (t) => {
      starMat.opacity = 0.7 + 0.25 * osc(t, 4);
      for (let i = 0; i < clouds.length; i++) {
        const c = clouds[i];
        c.position.x += 0.012 * (i % 2 === 0 ? 1 : -1);
        if (c.position.x > 80) c.position.x = -80;
        if (c.position.x < -80) c.position.x = 80;
      }
    },
  };
}

/* ============================================================ OCEAN ===== */

/** Animated sine-field water plane with foam-cyan crests via vertex colors. */
export function makeWater(
  w: number,
  d: number,
  segs = 28,
  y = 0,
): { mesh: THREE.Mesh; update: (t: number) => void } {
  const geo = new THREE.PlaneGeometry(w, d, segs, segs);
  geo.rotateX(-Math.PI / 2);
  const count = geo.attributes.position.count;
  const colors = new Float32Array(count * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.MeshToonMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.92,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.y = y;

  const pos = geo.attributes.position as THREE.BufferAttribute;
  const col = geo.attributes.color as THREE.BufferAttribute;
  const teal = color(P.oceanTeal);
  const cyan = color(P.surfCyan);
  const foam = color(P.foam);

  // Precompute two foam weights per vertex (Chebyshev distance to the square
  // island edge): a soft RING that hugs the shoreline (so foam never blobs
  // across the open sea), and an EDGE band over the last stretch before the
  // sea pours off the rim — that's where the calm water meets the waterfalls.
  const ring = new Float32Array(count);
  const edge = new Float32Array(count);
  const half = Math.min(w, d) / 2; // outer edge of the plane = the spill lip
  for (let i = 0; i < count; i++) {
    const sq = Math.max(Math.abs(pos.getX(i)), Math.abs(pos.getZ(i)));
    ring[i] = Math.exp(-Math.pow((sq - 9.0) / 0.9, 2));
    edge[i] = THREE.MathUtils.smoothstep(sq, half - 1.6, half - 0.05);
  }

  const update = (t: number) => {
    for (let i = 0; i < count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      // calm, fine ripples — low amplitude so crests never wash over the rim
      const h =
        Math.sin(x * 0.5 + t * 1.15) * 0.025 +
        Math.cos(z * 0.45 - t * 0.95) * 0.025 +
        Math.sin((x + z) * 0.22 + t * 0.55) * 0.014;
      pos.setY(i, h);
      const crest = THREE.MathUtils.clamp((h + 0.045) / 0.09, 0, 1);
      let r = teal.r + (cyan.r - teal.r) * crest;
      let g = teal.g + (cyan.g - teal.g) * crest;
      let b = teal.b + (cyan.b - teal.b) * crest;
      // foam brightens the shoreline ring (a little more on the crests)
      const fw = ring[i] * (0.5 + 0.4 * crest);
      r += (foam.r - r) * fw;
      g += (foam.g - g) * fw;
      b += (foam.b - b) * fw;
      // churning WHITE foam where the calm sea spills into the waterfalls
      const churn = 0.55 + 0.45 * Math.sin(x * 1.9 - z * 1.5 + t * 3.0);
      const ew = edge[i] * THREE.MathUtils.clamp(churn, 0, 1);
      r += (foam.r - r) * ew;
      g += (foam.g - g) * ew;
      b += (foam.b - b) * ew;
      col.setXYZ(i, r, g, b);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    geo.computeVertexNormals();
  };
  update(0);
  return { mesh, update };
}

export function buildOcean(): EnvPart {
  const group = new THREE.Group();

  // The surrounding sea the island sits in (lowered below the beach rim so its
  // calm ripples no longer wash up over the sand/earth edge).
  const sea = makeWater(22, 22, 36, -0.3);
  group.add(sea.mesh);

  // Four waterfalls spilling off the diamond edges into mist. Each fall's TOP
  // is tucked just below the sea surface (top at y=-0.42, under the wave troughs
  // at ~-0.36) so its hard top edge never pokes through the seam — the water
  // appears to pour straight out from under the foam.
  const falls: { mesh: THREE.Mesh }[] = [];
  const foam: { mat: THREE.MeshToonMaterial; base: number; phase: number }[] = [];
  const fallMat = () =>
    new THREE.MeshBasicMaterial({
      color: color(P.surfCyan),
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });
  const edges: [number, number, number][] = [
    [0, 0, 11],
    [0, 0, -11],
    [11, 0, 0],
    [-11, 0, 0],
  ];
  edges.forEach(([ex, , ez], ei) => {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(8, 6), fallMat());
    f.position.set(ex, -3.42, ez); // top now at y=-0.42, hidden under the foam
    if (ex !== 0) f.rotation.y = Math.PI / 2;
    falls.push({ mesh: f });
    group.add(f);

    // FOAM CREST — an irregular row of little froth chunks (varied size, height,
    // jitter and opacity) sitting over a thin continuous base, hiding the
    // sea→waterfall seam. The broken silhouette reads as churn, not a white bar.
    const alongX = ex === 0; // ±Z edges run along world X; ±X edges along world Z
    const HALF = 4.0;
    // a thin continuous base so the seam stays covered in the gaps between chunks
    const baseMat = glass(P.foam, 0.7, 0.12).clone();
    box(
      group, P.foam,
      alongX ? 8.0 : 0.55, 0.3, alongX ? 0.55 : 8.0,
      ex, -0.4, ez,
      { mat: baseMat },
    );
    foam.push({ mat: baseMat, base: 0.7, phase: ei * 0.9 });
    // frothy bumps on top — deterministic per (edge, k) so they stay put
    const N = 15;
    for (let k = 0; k < N; k++) {
      const r1 = rng(ei * 53 + k, 17);
      const r2 = rng(ei * 53 + k, 29);
      const r3 = rng(ei * 53 + k, 41);
      const a = (((k + 0.5) / N) * 2 - 1) * HALF + (r1 - 0.5) * 0.3; // along the edge
      const jit = (r3 - 0.5) * 0.55; // wobble across the rim
      const s = 0.3 + r1 * 0.5; // chunk size
      const h = 0.18 + r2 * 0.3; // chunk height
      const px = ex + (alongX ? a : jit);
      const pz = ez + (alongX ? jit : a);
      const py = -0.3 + h * 0.5 - 0.04 + (r2 - 0.5) * 0.06; // bumpy top, sat in the water
      const op = 0.5 + r1 * 0.45;
      const mat = glass(P.foam, op, 0.1 + r2 * 0.18).clone();
      box(group, P.foam, s, h, s, px, py, pz, { mat });
      foam.push({ mat, base: op, phase: ei * 1.7 + k * 0.6 });
    }

    // mist puff at the bottom
    const mist = box(group, P.foam, 7, 1.4, 1.4, ex, -6.2, ez, { opacity: 0.25 });
    if (ex !== 0) mist.rotation.y = Math.PI / 2;
  });

  return {
    group,
    update: (t) => {
      sea.update(t);
      for (let i = 0; i < falls.length; i++) {
        const m = falls[i].mesh.material as THREE.MeshBasicMaterial;
        m.opacity = 0.4 + 0.18 * osc(t, 0.6, i);
      }
      // flicker each froth chunk's opacity a touch so the foam keeps churning
      for (const fo of foam) {
        fo.mat.opacity = THREE.MathUtils.clamp(
          fo.base + 0.14 * Math.sin(t * 2.4 + fo.phase),
          0.2,
          1,
        );
      }
    },
  };
}

/* ============================================================ DECOR ===== */
// Non-landmark scenery: trees (3 species), bushes, flowers, mushrooms, rocks,
// crystals, lanterns, fireflies and birds. Everything is kept short — or, for
// the tall trees, restricted to the back/sides — so the decor enriches the
// island without ever occluding a landmark. All placement is deterministic
// (the rng below; never Math.random) so the diorama stays reproducible.

const GY = 0.5; // grass surface height (top of the grass slab)

/** Deterministic pseudo-random in [0,1) — keeps the scatter stable across loads. */
function rng(i: number, salt = 0): number {
  const v = Math.sin(i * 127.1 + salt * 311.7 + 7.13) * 43758.5453;
  return v - Math.floor(v);
}

/** Animatable (cloned) emissive material so we never mutate the shared cache. */
function glow(hex: number, intensity = 1): THREE.MeshToonMaterial {
  return emit(hex, intensity).clone();
}

function classicTree(g: THREE.Object3D, x: number, z: number, s = 1) {
  cyl(g, P.earth, 0.2 * s, 0.28 * s, 1.1 * s, x, GY + 0.55 * s, z, 6);
  cone(g, P.moss, 0.95 * s, 1.4 * s, x, GY + 1.5 * s, z, 7);
  cone(g, P.grass, 0.75 * s, 1.2 * s, x, GY + 2.2 * s, z, 7);
}

function pineTree(g: THREE.Object3D, x: number, z: number, s = 1) {
  cyl(g, P.earth, 0.16 * s, 0.22 * s, 0.9 * s, x, GY + 0.45 * s, z, 6);
  cone(g, P.moss, 0.8 * s, 1.15 * s, x, GY + 1.15 * s, z, 8);
  cone(g, P.moss, 0.62 * s, 1.05 * s, x, GY + 1.85 * s, z, 8);
  cone(g, P.grass, 0.42 * s, 0.95 * s, x, GY + 2.55 * s, z, 8);
}

function roundTree(g: THREE.Object3D, x: number, z: number, s = 1) {
  cyl(g, P.earth, 0.22 * s, 0.3 * s, 1.0 * s, x, GY + 0.5 * s, z, 6);
  sphere(g, P.moss, 0.95 * s, x, GY + 1.55 * s, z, 8);
  sphere(g, P.grass, 0.66 * s, x + 0.32 * s, GY + 1.85 * s, z - 0.2 * s, 8);
  sphere(g, P.moss, 0.58 * s, x - 0.34 * s, GY + 1.45 * s, z + 0.26 * s, 8);
}

function bush(g: THREE.Object3D, x: number, z: number, s = 1) {
  dome(g, P.moss, 0.55 * s, x, GY, z, 8);
  dome(g, P.grass, 0.42 * s, x + 0.3 * s, GY, z - 0.16 * s, 8);
  dome(g, P.moss, 0.36 * s, x - 0.28 * s, GY, z + 0.2 * s, 8);
}

function flowerPatch(g: THREE.Object3D, x: number, z: number, hex: number, seed: number) {
  for (let k = 0; k < 3; k++) {
    const sx = x + (rng(seed, k * 2 + 1) - 0.5) * 0.7;
    const sz = z + (rng(seed, k * 2 + 2) - 0.5) * 0.7;
    box(g, P.moss, 0.06, 0.42, 0.06, sx, GY + 0.21, sz);
    voxel(g, hex, sx, GY + 0.46, sz, 0.18);
    voxel(g, P.gold, sx, GY + 0.5, sz, 0.07);
  }
}

function mushroom(g: THREE.Object3D, x: number, z: number, capHex: number) {
  cyl(g, P.foam, 0.1, 0.13, 0.34, x, GY + 0.17, z, 6);
  dome(g, capHex, 0.28, x, GY + 0.34, z, 8);
  voxel(g, P.foam, x + 0.11, GY + 0.4, z, 0.05);
  voxel(g, P.foam, x - 0.09, GY + 0.38, z + 0.08, 0.045);
}

function rockCluster(g: THREE.Object3D, x: number, z: number, s: number, seed: number) {
  box(g, P.slate, 0.6 * s, 0.42 * s, 0.5 * s, x, GY + 0.21 * s, z, { rot: [0, rng(seed, 1) * TAU, 0] });
  box(g, P.earth, 0.4 * s, 0.3 * s, 0.45 * s, x + 0.3 * s, GY + 0.15 * s, z - 0.2 * s, { rot: [0, rng(seed, 2) * TAU, 0] });
  box(g, P.slate, 0.3 * s, 0.24 * s, 0.32 * s, x - 0.26 * s, GY + 0.12 * s, z + 0.22 * s);
}

/** Crystal shard cluster; returns its (cloned) emissive mat for a glow pulse. */
function crystalCluster(g: THREE.Object3D, x: number, z: number, hex: number): THREE.MeshToonMaterial {
  const m = glow(hex, 0.9);
  voxel(g, P.slate, x, GY + 0.06, z, 0.24);
  cone(g, hex, 0.13, 0.64, x, GY + 0.42, z, 5, { mat: m });
  cone(g, hex, 0.09, 0.44, x + 0.16, GY + 0.3, z + 0.06, 5, { mat: m });
  cone(g, hex, 0.08, 0.36, x - 0.14, GY + 0.26, z - 0.1, 5, { mat: m });
  return m;
}

/** Dusk lantern (slim post + glowing orb); returns its emissive mat for a flicker. */
function lantern(g: THREE.Object3D, x: number, z: number): THREE.MeshToonMaterial {
  const m = glow(P.amber, 1.1);
  box(g, P.slate, 0.1, 0.95, 0.1, x, GY + 0.47, z);
  box(g, P.slate, 0.26, 0.08, 0.26, x, GY + 0.98, z);
  voxel(g, P.amber, x, GY + 0.8, z, 0.2, { mat: m });
  box(g, P.slate, 0.05, 0.16, 0.05, x, GY + 1.06, z);
  return m;
}

/**
 * A flat, subdivided surface tile whose vertices are softly mottled between a
 * base color and a few close shades. Laid just above a big flat slab (grass /
 * sand), it gives the surface a dappled, hand-placed pixel-texture feel instead
 * of one dead-flat color — and the soft blotches survive the pixelation pass as
 * blocky patches. Deterministic (rng per vertex) and static (no animation).
 */
function mottledTop(
  parent: THREE.Object3D,
  size: number,
  y: number,
  baseHex: number,
  shades: number[],
  segs: number,
  amount: number,
  seed = 0,
): void {
  const geo = new THREE.PlaneGeometry(size, size, segs, segs);
  geo.rotateX(-Math.PI / 2);
  const count = geo.attributes.position.count;
  const colors = new Float32Array(count * 3);
  const base = color(baseHex);
  const sc = shades.map((h) => color(h));
  for (let i = 0; i < count; i++) {
    const s = sc[Math.floor(rng(i + seed * 911, 71) * sc.length) % sc.length];
    const k = amount * rng(i + seed * 911, 83); // how far this vertex tints
    colors[i * 3] = base.r + (s.r - base.r) * k;
    colors[i * 3 + 1] = base.g + (s.g - base.g) * k;
    colors[i * 3 + 2] = base.b + (s.b - base.b) * k;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: GRADIENT });
  (material as THREE.Material as { flatShading?: boolean }).flatShading = true;
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.y = y;
  parent.add(mesh);
}

/* =========================================================== ISLAND ===== */

export function buildIsland(): EnvPart {
  const group = new THREE.Group();

  // Beach rim (sand peeking out under the grass).
  box(group, P.sand, 17, 0.7, 17, 0, -0.35, 0);
  // Grass top slab.
  box(group, P.grass, 15.4, 1.0, 15.4, 0, 0.0, 0);
  // moss underside hint
  box(group, P.moss, 15.6, 0.3, 15.6, 0, -0.55, 0);

  // Dappled surface texture: softly mottle the big flat slabs so the grass and
  // beach read as hand-placed pixel texture instead of one flat fill.
  mottledTop(group, 15.4, GY + 0.01, P.grass, [0x73a986, 0x4c8161, P.moss], 24, 0.4, 1);
  mottledTop(group, 17, 0.012, P.sand, [0xe6c89c, 0xc8a276, 0xb98f63], 26, 0.36, 2);

  // Rock taper down to a point (sky-island silhouette).
  box(group, P.earth, 14, 1.4, 14, 0, -1.4, 0);
  box(group, P.earth, 11, 1.6, 11, 0, -2.9, 0);
  box(group, P.moss, 11.2, 0.3, 11.2, 0, -2.0, 0);
  box(group, P.earth, 7.5, 1.8, 7.5, 0, -4.6, 0);
  box(group, P.earth, 4, 1.8, 4, 0, -6.2, 0);
  cone(group, P.earth, 2.6, 3.2, 0, -8.4, 0, 6);

  // ---------------------------------------------------------------- DECOR
  // Keep-out volumes: the 8 landmark footprints (xz must match models.ts
  // LANDMARKS) plus a clearance radius. Decor is only placed where it's clear
  // of these (and, as we go, of each other) so nothing crowds a landmark.
  const blockers: [number, number, number][] = [
    [0, 0, 2.6], [0, -6, 2.2], [-6.5, 1, 2.2], [4.5, 2.5, 2.0],
    [-1, 5, 2.2], [-5, -4, 2.2], [3, -5.5, 2.2], [6, -1, 2.2],
  ];
  const blocked = (x: number, z: number, extra = 0) =>
    blockers.some(([bx, bz, r]) => (x - bx) ** 2 + (z - bz) ** 2 < (r + extra) ** 2);
  const onGrass = (x: number, z: number, m = 0.8) =>
    Math.abs(x) <= 7.0 - m && Math.abs(z) <= 7.0 - m;

  // Tall trees (3 species) frame the back/sides only — never the +x+z front
  // tip toward the camera, where they would loom over the scene.
  const trees: [number, number, number, 'classic' | 'pine' | 'round'][] = [
    [-7, -7, 1.15, 'pine'],
    [7, -7, 1.0, 'classic'],
    [-7, 7, 1.0, 'round'],
    [-7.2, -2, 0.9, 'classic'],
    [1.8, -7, 0.85, 'pine'],
    [-2.6, 7, 0.8, 'round'],
    [-7, 3.5, 0.75, 'pine'],
  ];
  for (const [x, z, s, kind] of trees) {
    if (kind === 'pine') pineTree(group, x, z, s);
    else if (kind === 'round') roundTree(group, x, z, s);
    else classicTree(group, x, z, s);
    blockers.push([x, z, 0.9 * s + 0.3]);
  }

  // Animated decor materials we'll pulse/flicker in update().
  const crystalMats: { mat: THREE.MeshToonMaterial; phase: number }[] = [];
  const lanternMats: { mat: THREE.MeshToonMaterial; phase: number }[] = [];

  // Slim dusk lanterns: light the front tip + a couple of inner paths.
  const lanternSpots: [number, number][] = [
    [6.4, 6.4], [3.2, 5.6], [5.6, 3.2], [-3.4, -1.6], [1.6, 2.2],
  ];
  lanternSpots.forEach(([x, z], i) => {
    if (blocked(x, z, 0.2) || !onGrass(x, z, 0.6)) return;
    lanternMats.push({ mat: lantern(group, x, z), phase: i * 0.37 });
    blockers.push([x, z, 0.6]);
  });

  // Deterministic scatter of LOW ground props into whatever gaps remain.
  const FLOWER = [P.magenta, P.amber, P.gold, P.synapse, P.signalRed];
  const CAP = [P.signalRed, P.magenta, P.amber];
  const GEM = [P.surfCyan, P.synapse, P.magenta];
  let idx = 0;
  for (let gx = -6.2; gx <= 6.2; gx += 1.7) {
    for (let gz = -6.2; gz <= 6.2; gz += 1.7) {
      idx++;
      const x = gx + (rng(idx, 1) - 0.5) * 1.25;
      const z = gz + (rng(idx, 2) - 0.5) * 1.25;
      if (!onGrass(x, z) || blocked(x, z, 0.2)) continue;
      if (rng(idx, 3) < 0.4) continue; // leave breathing room — keep it natural
      const pick = rng(idx, 4);
      if (pick < 0.3) {
        flowerPatch(group, x, z, FLOWER[idx % FLOWER.length], idx);
      } else if (pick < 0.48) {
        bush(group, x, z, 0.85 + rng(idx, 5) * 0.4);
      } else if (pick < 0.64) {
        rockCluster(group, x, z, 0.7 + rng(idx, 6) * 0.5, idx);
      } else if (pick < 0.8) {
        mushroom(group, x, z, CAP[idx % CAP.length]);
      } else if (pick < 0.92) {
        crystalMats.push({ mat: crystalCluster(group, x, z, GEM[idx % GEM.length]), phase: rng(idx, 7) });
      } else {
        voxel(group, P.moss, x, GY + 0.18, z, 0.34);
        voxel(group, P.grass, x + 0.2, GY + 0.22, z, 0.26);
      }
      blockers.push([x, z, 0.7]);
    }
  }

  // A few classic grass tufts (kept from before).
  const tufts: [number, number][] = [
    [3, 5], [-3, -4], [5, -2], [-5, 3], [2, -5], [-2, 6],
  ];
  for (const [x, z] of tufts) {
    if (blocked(x, z)) continue;
    voxel(group, P.moss, x, 0.7, z, 0.4);
    voxel(group, P.grass, x + 0.25, 0.8, z, 0.3);
  }

  // Micro grass blades — a sparse grain of tiny tufts that adds close-up
  // texture to the lawn without crowding the props (deterministic, subtle).
  for (let i = 0; i < 26; i++) {
    const x = (rng(i, 31) - 0.5) * 13.4;
    const z = (rng(i, 32) - 0.5) * 13.4;
    if (!onGrass(x, z, 0.4) || blocked(x, z, 0.1)) continue;
    const sh = rng(i, 33) < 0.5 ? P.moss : 0x4c8161;
    box(group, sh, 0.05, 0.13, 0.05, x, GY + 0.06, z, { rot: [0, 0, (rng(i, 34) - 0.5) * 0.5] });
    box(group, sh, 0.045, 0.1, 0.045, x + 0.08, GY + 0.05, z + 0.06, { rot: [0, 0, (rng(i, 35) - 0.5) * 0.5] });
  }

  // Pebbles + dirt flecks bedded into the beach ring (ground grain).
  for (let i = 0; i < 14; i++) {
    const edge = Math.floor(rng(i, 41) * 4);
    const along = (rng(i, 42) * 2 - 1) * 8.0;
    const d = 7.9 + rng(i, 43) * 0.45;
    const x = edge === 2 ? d : edge === 3 ? -d : along;
    const z = edge === 0 ? d : edge === 1 ? -d : along;
    const s = 0.16 + rng(i, 44) * 0.18;
    box(group, rng(i, 45) < 0.5 ? P.slate : P.earth, s, s * 0.55, s * 0.9, x, 0.06, z, {
      rot: [0, rng(i, 46) * TAU, 0],
    });
  }

  // Fireflies — drifting emissive motes that twinkle (dusk life over the grass).
  const fireflies: {
    mesh: THREE.Mesh; mat: THREE.MeshToonMaterial;
    cx: number; cz: number; cy: number; rx: number; rz: number;
    sx: number; sz: number; sy: number; phase: number; base: number;
  }[] = [];
  for (let i = 0; i < 14; i++) {
    const mat0 = glow(rng(i, 9) < 0.5 ? P.amber : P.gold, 1.3);
    const cx = (rng(i, 1) - 0.5) * 11;
    const cz = (rng(i, 2) - 0.5) * 11;
    const mesh = voxel(group, P.amber, cx, 1.6, cz, 0.12, { mat: mat0 });
    fireflies.push({
      mesh, mat: mat0, cx, cz,
      cy: 1.1 + rng(i, 3) * 1.6,
      rx: 0.8 + rng(i, 4) * 1.6, rz: 0.8 + rng(i, 5) * 1.6,
      sx: 0.2 + rng(i, 6) * 0.3, sz: 0.18 + rng(i, 7) * 0.3,
      sy: 0.3 + rng(i, 8) * 0.4, phase: rng(i, 0) * TAU, base: 1.0 + rng(i, 9) * 0.6,
    });
  }

  // Birds — small flapping voxel birds that wander high around the island.
  // Each bird carries its own phases/speeds so no two retrace the same path:
  // a slowly breathing orbit radius, layered out-of-phase altitude waves, and
  // a flap-then-glide envelope. Banking/pitch are derived per frame from a
  // finite-difference of the flight path (cheap, no stored prev-frame state).
  interface Bird {
    grp: THREE.Group; wl: THREE.Object3D; wr: THREE.Object3D;
    a: number; r: number; y: number; spd: number;
    // wandering orbit radius (slow secondary oscillation)
    rAmp: number; rSpd: number; rPh: number;
    // layered altitude waves (two out-of-phase, slow climbs/glides)
    yAmp1: number; ySpd1: number; yPh1: number;
    yAmp2: number; ySpd2: number; yPh2: number;
    // flap-then-glide envelope + flap timing
    flapSpd: number; envSpd: number; envPh: number; flapPh: number;
  }
  const birds: Bird[] = [];
  for (let i = 0; i < 3; i++) {
    const grp = new THREE.Group();
    // Birds fly high; their cast shadow lands far from them and reads as a
    // random dark gash on the lawn — opt them out of shadow casting.
    grp.userData.noShadow = true;
    box(grp, P.slate, 0.2, 0.13, 0.36, 0, 0, 0);
    box(grp, P.dusk, 0.15, 0.1, 0.12, 0, 0.02, 0.24); // head
    const wl = pivot(grp, 0, 0.05, 0);
    box(wl, P.slate, 0.5, 0.06, 0.22, -0.3, 0, 0);
    const wr = pivot(grp, 0, 0.05, 0);
    box(wr, P.slate, 0.5, 0.06, 0.22, 0.3, 0, 0);
    group.add(grp);
    birds.push({
      grp, wl, wr,
      a: i * 2.2, r: 9.5 + i * 0.8, y: 4.2 + i * 0.7, spd: 0.18 + i * 0.03,
      rAmp: 1.1 + rng(i, 11) * 0.9, rSpd: 0.05 + rng(i, 12) * 0.04, rPh: rng(i, 13) * TAU,
      yAmp1: 0.7 + rng(i, 14) * 0.5, ySpd1: 0.16 + rng(i, 15) * 0.08, yPh1: rng(i, 16) * TAU,
      yAmp2: 0.35 + rng(i, 17) * 0.3, ySpd2: 0.33 + rng(i, 18) * 0.12, yPh2: rng(i, 19) * TAU,
      flapSpd: 8 + rng(i, 20) * 2.5, envSpd: 0.55 + rng(i, 21) * 0.35, envPh: rng(i, 22) * TAU,
      flapPh: rng(i, 23) * TAU,
    });
  }
  // Sample a bird's world position at an arbitrary time (for the path itself
  // and for tiny finite-difference look-ahead used to derive bank + pitch).
  const birdPos = (b: Bird, time: number, out: THREE.Vector3) => {
    const a = b.a + time * b.spd;
    const r = b.r + Math.sin(time * b.rSpd + b.rPh) * b.rAmp;
    const y =
      b.y +
      Math.sin(time * b.ySpd1 + b.yPh1) * b.yAmp1 +
      Math.sin(time * b.ySpd2 + b.yPh2) * b.yAmp2;
    out.set(Math.cos(a) * r, y, Math.sin(a) * r);
    return out;
  };
  // Reusable scratch vectors for the per-frame path finite-difference — these
  // are allocated ONCE here, never inside the update loop.
  const bP0 = new THREE.Vector3();
  const bP1 = new THREE.Vector3();

  // Floating detached rock chunks (orbit slowly).
  const chunks: THREE.Mesh[] = [];
  const chunkData = [
    { a: 0, r: 13, y: -3, s: 1.2 },
    { a: 2.1, r: 14, y: -5, s: 0.8 },
    { a: 4.2, r: 12.5, y: -2, s: 1.0 },
  ];
  for (const c of chunkData) {
    const m = box(group, P.earth, 1.6 * c.s, 1.2 * c.s, 1.6 * c.s, 0, 0, 0);
    m.userData.orbit = c;
    chunks.push(m);
  }

  return {
    group,
    update: (t) => {
      for (const m of chunks) {
        const c = m.userData.orbit;
        const a = c.a + t * 0.05;
        m.position.set(Math.cos(a) * c.r, c.y + osc(t, 5, c.a) * 0.4, Math.sin(a) * c.r);
        m.rotation.y = a * 1.5;
      }
      // Crystals breathe a slow glow; lanterns flicker like a warm flame.
      for (const c of crystalMats) {
        c.mat.emissiveIntensity = 0.75 + 0.45 * (0.5 + 0.5 * osc(t, 2.2, c.phase * TAU));
      }
      for (const l of lanternMats) {
        l.mat.emissiveIntensity = 1.0 + 0.3 * osc(t, 1.4, l.phase * TAU) + 0.12 * osc(t, 0.27, l.phase);
      }
      // Fireflies drift in lazy lissajous loops and twinkle independently.
      for (const f of fireflies) {
        f.mesh.position.set(
          f.cx + Math.sin(t * f.sx + f.phase) * f.rx,
          f.cy + Math.sin(t * f.sy + f.phase * 1.7) * 0.5,
          f.cz + Math.cos(t * f.sz + f.phase) * f.rz,
        );
        f.mat.emissiveIntensity = f.base * (0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 3 + f.phase * 2)));
      }
      // Birds wander the island: bank into turns, climb & glide on layered
      // altitude waves, pitch with vertical velocity, and flap-then-glide.
      for (const b of birds) {
        // Sample the path now and a hair ahead — gives heading + vertical
        // velocity without storing any prev-frame state (eps in seconds).
        const eps = 0.05;
        birdPos(b, t, bP0);
        birdPos(b, t + eps, bP1);
        b.grp.position.copy(bP0);

        // Heading from horizontal velocity (atan2(dz, dx)); face along travel.
        const vx = bP1.x - bP0.x;
        const vz = bP1.z - bP0.z;
        const heading = Math.atan2(vz, vx);
        // Body's nose is local +z, so yaw = -heading + π/2 (matches the old
        // tangent facing, now driven by the actual wandering velocity).
        b.grp.rotation.y = -heading + Math.PI / 2;

        // Vertical velocity → gentle nose-up on climb, nose-down on descent.
        const vy = (bP1.y - bP0.y) / eps;
        b.grp.rotation.x = THREE.MathUtils.clamp(-vy * 0.5, -0.5, 0.5);

        // Bank: lean into the turn by the heading change rate. The orbit
        // sweeps one way, so sign is stable; scale by horizontal speed so
        // faster passes lean harder. Negative roll banks toward the center.
        const turn = -b.spd; // d(heading)/dt is ~ -spd for this CW-ish sweep
        const hSpeed = Math.hypot(vx, vz) / eps;
        b.grp.rotation.z = THREE.MathUtils.clamp(turn * hSpeed * 0.9, -0.6, 0.6);

        // Flap-then-glide: a slow envelope opens (flap hard) then closes
        // (glide). During glides hold the wings at a slight raised dihedral.
        const env = 0.5 + 0.5 * Math.sin(t * b.envSpd + b.envPh); // 0..1
        const flapAmp = 0.12 + env * env * 0.55; // mostly-glide between bursts
        const dihedral = 0.18 * (1 - env); // wings raised when gliding
        const flap = Math.sin(t * b.flapSpd + b.flapPh) * flapAmp;
        b.wl.rotation.z = flap + dihedral;
        b.wr.rotation.z = -flap - dihedral;
      }
    },
  };
}

/* ==================================================== VISITOR MARKS ===== */
// Fireflies that visitors plant (persisted in Postgres). Each mark = a small
// dim ground glow + a faint short stem + a little bobbing "mote" in the
// visitor's chosen color. They're kept SUBTLE on purpose — they should dust the
// island like real fireflies, not tower over it. The visitor finds their OWN
// trace not by brightness but by a "you-are-here" pin + an on-demand locator
// ping (see setMine / ping). Size & float-height are randomised per mark so the
// swarm never looks uniform. Drawn on the default layer (not raycast) so they
// never interfere with landmark hover/click picking.

export interface VisitorMarks {
  group: THREE.Group;
  update: (t: number) => void;
  /** Add any marks not already shown (idempotent by id). */
  sync: (marks: Mark[]) => void;
  /** Flag which mark ids belong to THIS visitor (adds a persistent pin). */
  setMine: (ids: number[]) => void;
  /** Briefly fire a locator (expanding ring + tall beam) on the visitor's own fireflies. */
  ping: () => void;
}

interface MineDecor {
  pin: THREE.Mesh;
  pinMat: THREE.MeshToonMaterial;
  ring: THREE.Mesh;
  ringMat: THREE.MeshToonMaterial;
  loc: THREE.Mesh;
  locMat: THREE.MeshToonMaterial;
}

interface Beacon {
  id: number;
  g: THREE.Group;
  gem: THREE.Mesh;
  gemMat: THREE.MeshToonMaterial;
  stemMat: THREE.MeshToonMaterial;
  gemBaseY: number;
  size: number;
  bobAmp: number;
  phase: number;
  baseGlow: number;
  hex: number;
  decor?: MineDecor;
}

export function buildVisitorMarks(initial: Mark[]): VisitorMarks {
  const group = new THREE.Group();
  const seen = new Set<number>();
  const mine = new Set<number>();
  const beacons: Beacon[] = [];
  const CAP = 200; // hard ceiling on rendered fireflies (drop oldest beyond this)

  // ping envelope: -1 idle · -2 "arm for next frame" · else absolute start time
  let pingT0 = -1;
  const PING_DUR = 2.8;
  const easeOut = (u: number) => 1 - (1 - u) * (1 - u);

  // The "this one is yours" decoration, built once and lazily (only for marks
  // that are actually mine). A downward pin floats over the mote at all times;
  // the ground ring + tall beam stay dark until a locator ping fires.
  function ensureDecor(b: Beacon): MineDecor {
    if (b.decor) return b.decor;
    const pinMat = glow(P.foam, 1.2);
    const pin = cone(b.g, P.foam, 0.055, 0.13, 0, b.gemBaseY + b.size + 0.16, 0, 6, { mat: pinMat });
    pin.rotation.x = Math.PI; // apex points DOWN at the mote
    const ringMat = glass(b.hex, 0.0, 0.8).clone();
    const ring = cyl(b.g, b.hex, 0.18, 0.18, 0.015, 0, 0.02, 0, 20, { mat: ringMat });
    const locMat = glass(b.hex, 0.0, 0.7).clone();
    const loc = box(b.g, b.hex, 0.12, 3.6, 0.12, 0, 1.8, 0, { mat: locMat });
    pin.visible = ring.visible = loc.visible = false;
    b.decor = { pin, pinMat, ring, ringMat, loc, locMat };
    return b.decor;
  }

  function showMine(b: Beacon, on: boolean) {
    if (!on && !b.decor) return; // nothing built yet → nothing to hide
    const d = ensureDecor(b);
    d.pin.visible = on;
    d.ring.visible = on; // a faint persistent ring; it brightens during a ping
    if (!on) d.loc.visible = false;
  }

  function add(m: Mark) {
    if (seen.has(m.id)) return;
    seen.add(m.id);
    const hex = MARK_COLORS[m.color] ?? MARK_COLORS[0];
    const i = seen.size;

    // deterministic per-mark variation (stable across reloads)
    const r1 = rng(m.id, 11);
    const r2 = rng(m.id, 23);
    const r3 = rng(m.id, 37);
    const size = 0.085 + r1 * 0.055; // 0.085–0.14 mote
    const gemBaseY = 0.5 + r2 * 0.7; // floats 0.5–1.2 above the grass
    const bobAmp = 0.05 + r3 * 0.06; // gentle individual drift
    const baseGlow = 0.7 + r1 * 0.3; // 0.7–1.0 glow

    const g = pivot(group, m.x, GY, m.z);

    // a small, dim glow where the firefly is "planted"
    cyl(g, hex, 0.09, 0.09, 0.02, 0, 0.012, 0, 14, { emissive: 0.45 });

    // a faint, short stem of light up to the mote (cloned so it can breathe)
    const stemMat = glass(hex, 0.1, 0.3).clone();
    box(g, hex, 0.045, gemBaseY, 0.045, 0, gemBaseY / 2 + 0.01, 0, { mat: stemMat });

    // the firefly mote — a small glowing diamond that bobs & pulses
    const gemMat = glow(hex, baseGlow);
    const gem = voxel(g, hex, 0, gemBaseY, 0, size, { mat: gemMat });
    gem.rotation.y = Math.PI / 4; // diamond silhouette

    const b: Beacon = {
      id: m.id, g, gem, gemMat, stemMat, gemBaseY, size, bobAmp,
      phase: (i * 1.371) % TAU, baseGlow, hex,
    };
    beacons.push(b);
    if (mine.has(m.id)) showMine(b, true);

    if (beacons.length > CAP) {
      const old = beacons.shift();
      if (old) group.remove(old.g);
    }
  }

  for (const m of initial) add(m);

  return {
    group,
    update: (t) => {
      if (pingT0 === -2) pingT0 = t;
      let pe = 0; // ping envelope, eases 1 → 0 over PING_DUR
      if (pingT0 >= 0) {
        const u = (t - pingT0) / PING_DUR;
        if (u >= 1) pingT0 = -1;
        else pe = 1 - u;
      }
      for (const b of beacons) {
        const y = b.gemBaseY + Math.sin(t * 1.5 + b.phase) * b.bobAmp;
        b.gem.position.y = y;
        b.gem.rotation.y = Math.PI / 4 + t * 0.6;
        const pulse = 0.5 + 0.5 * Math.sin(t * 2.0 + b.phase);
        b.gemMat.emissiveIntensity = b.baseGlow * (0.78 + 0.32 * pulse);
        b.stemMat.opacity = 0.07 + 0.05 * pulse;

        const d = b.decor;
        if (d && mine.has(b.id)) {
          // pin bobs over the mote and hops up while a ping is live
          d.pin.position.y = y + b.size + 0.16 + 0.45 * easeOut(pe);
          d.pinMat.emissiveIntensity = 1.0 + 0.9 * pe;
          // ground ring: faint normally, expands & brightens on a ping
          const rs = 1 + 3.2 * easeOut(pe);
          d.ring.scale.set(rs, 1, rs);
          d.ringMat.opacity = 0.18 + 0.55 * pe;
          // tall locator beam: only while a ping is live
          d.loc.visible = pe > 0.001;
          d.locMat.opacity = 0.55 * pe;
        }
      }
    },
    sync: (marks) => {
      for (const m of marks) add(m);
    },
    setMine: (ids) => {
      mine.clear();
      for (const id of ids) mine.add(id);
      for (const b of beacons) showMine(b, mine.has(b.id));
    },
    ping: () => {
      pingT0 = -2; // start (or restart) on the next update frame
    },
  };
}

/* =========================================================== LIGHTS ===== */

export function buildLights(): THREE.Group {
  const group = new THREE.Group();

  // Cool dusk ambient — shadow sides read indigo, never black.
  const ambient = new THREE.AmbientLight(color(0x34384f), 0.85);
  group.add(ambient);

  // Soft warm-white key from the camera side (+x+y+z) lights front faces.
  // (A warm WHITE, not saturated amber — so whites stay white, not yellow.)
  const key = new THREE.DirectionalLight(color(0xf4dcb4), 1.25);
  key.position.set(30, 34, 26);
  // Cast subtle shadows. Ortho frustum hugs the island; soft + half-strength
  // (plus the strong dusk ambient) keeps them gentle, not heavy.
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const sc = key.shadow.camera;
  sc.left = -13;
  sc.right = 13;
  sc.top = 13;
  sc.bottom = -13;
  sc.near = 30;
  sc.far = 80;
  sc.updateProjectionMatrix();
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.04;
  key.shadow.intensity = 0.85; // clearly visible (0.5 read too faint to notice)
  group.add(key);

  // Cool sky fill from above grounds the palette.
  const hemi = new THREE.HemisphereLight(color(0x4a5a78), color(P.moss), 0.45);
  group.add(hemi);

  // Horizon-rose back rim for edge separation against the dusk sky.
  const rim = new THREE.DirectionalLight(color(P.horizon), 0.7);
  rim.position.set(-26, 12, -30);
  group.add(rim);

  return group;
}
