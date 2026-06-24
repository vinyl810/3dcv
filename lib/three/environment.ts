import * as THREE from 'three';
import { P, color, mat, emit, box, cyl, cone, sphere, dome, voxel, pivot, osc, TAU } from './kit';
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
      top: { value: color(P.abyss) }, // deep top
      mid: { value: color(P.dusk) }, // indigo body
      bot: { value: color(0x3b2f4a) }, // deep dusky plum near the horizon
      glow: { value: color(P.horizon) }, // warm rose glow band
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
  const base = new Float32Array(count);
  for (let i = 0; i < count; i++) base[i] = 0;
  const teal = color(P.oceanTeal);
  const cyan = color(P.surfCyan);

  const update = (t: number) => {
    for (let i = 0; i < count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h =
        Math.sin(x * 0.6 + t * 1.6) * 0.12 +
        Math.cos(z * 0.5 - t * 1.2) * 0.12 +
        Math.sin((x + z) * 0.3 + t * 0.8) * 0.06;
      pos.setY(i, h);
      const crest = THREE.MathUtils.clamp((h + 0.18) / 0.36, 0, 1);
      const r = teal.r + (cyan.r - teal.r) * crest * crest;
      const g = teal.g + (cyan.g - teal.g) * crest * crest;
      const b = teal.b + (cyan.b - teal.b) * crest * crest;
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

  // The surrounding sea the island sits in.
  const sea = makeWater(22, 22, 30, -0.15);
  group.add(sea.mesh);

  // Four waterfalls spilling off the diamond edges into mist.
  const falls: { mesh: THREE.Mesh; matMap: THREE.Texture }[] = [];
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
  for (const [ex, , ez] of edges) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(8, 6), fallMat());
    f.position.set(ex, -3, ez);
    if (ex !== 0) f.rotation.y = Math.PI / 2;
    falls.push({ mesh: f, matMap: f.material as unknown as THREE.Texture });
    group.add(f);
    // mist puff at the bottom
    const mist = box(group, P.foam, 7, 1.4, 1.4, ex, -6.2, ez, { opacity: 0.25 });
    if (ex !== 0) mist.rotation.y = Math.PI / 2;
  }

  return {
    group,
    update: (t) => {
      sea.update(t);
      for (let i = 0; i < falls.length; i++) {
        const m = falls[i].mesh.material as THREE.MeshBasicMaterial;
        m.opacity = 0.4 + 0.18 * osc(t, 0.6, i);
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

/* =========================================================== ISLAND ===== */

export function buildIsland(): EnvPart {
  const group = new THREE.Group();

  // Beach rim (sand peeking out under the grass).
  box(group, P.sand, 17, 0.7, 17, 0, -0.35, 0);
  // Grass top slab.
  box(group, P.grass, 15.4, 1.0, 15.4, 0, 0.0, 0);
  // moss underside hint
  box(group, P.moss, 15.6, 0.3, 15.6, 0, -0.55, 0);

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

  // Birds — small flapping voxel birds that orbit high around the island.
  const birds: { grp: THREE.Group; wl: THREE.Object3D; wr: THREE.Object3D; a: number; r: number; y: number; spd: number }[] = [];
  for (let i = 0; i < 3; i++) {
    const grp = new THREE.Group();
    box(grp, P.slate, 0.2, 0.13, 0.36, 0, 0, 0);
    box(grp, P.dusk, 0.15, 0.1, 0.12, 0, 0.02, 0.24); // head
    const wl = pivot(grp, 0, 0.05, 0);
    box(wl, P.slate, 0.5, 0.06, 0.22, -0.3, 0, 0);
    const wr = pivot(grp, 0, 0.05, 0);
    box(wr, P.slate, 0.5, 0.06, 0.22, 0.3, 0, 0);
    group.add(grp);
    birds.push({ grp, wl, wr, a: i * 2.2, r: 9.5 + i * 0.8, y: 4.2 + i * 0.7, spd: 0.18 + i * 0.03 });
  }

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
      // Birds circle the island, flapping (wings pivot at the body center).
      for (const b of birds) {
        const a = b.a + t * b.spd;
        b.grp.position.set(Math.cos(a) * b.r, b.y + Math.sin(t * 0.6 + b.a) * 0.5, Math.sin(a) * b.r);
        b.grp.rotation.y = -a + Math.PI / 2;
        const flap = Math.sin(t * 9 + b.a) * 0.6;
        b.wl.rotation.z = flap;
        b.wr.rotation.z = -flap;
      }
    },
  };
}

/* ==================================================== VISITOR MARKS ===== */
// Fireflies that visitors plant (persisted in Postgres). Each mark = a small
// ground glint + a floating mote that drifts and twinkles. As visitors leave
// traces the island glows brighter. These live on the default layer (drawn,
// not raycast) so they never interfere with landmark hover/click picking.

export interface VisitorMarks {
  group: THREE.Group;
  update: (t: number) => void;
  /** Add any marks not already shown (idempotent by id). */
  sync: (marks: Mark[]) => void;
}

export function buildVisitorMarks(initial: Mark[]): VisitorMarks {
  const group = new THREE.Group();
  const seen = new Set<number>();
  const motes: {
    mesh: THREE.Mesh; mat: THREE.MeshToonMaterial;
    cx: number; cz: number; cy: number; rx: number; rz: number;
    sx: number; sz: number; phase: number;
  }[] = [];
  const CAP = 220; // hard ceiling on rendered motes (drop oldest beyond this)

  function add(m: Mark) {
    if (seen.has(m.id)) return;
    seen.add(m.id);
    const hex = MARK_COLORS[m.color] ?? MARK_COLORS[0];
    // ground glint — static, shared emissive (never mutated → safe to share)
    voxel(group, hex, m.x, GY + 0.05, m.z, 0.12, { mat: emit(hex, 0.5) });
    // floating mote — cloned material so it twinkles independently
    const mat0 = glow(hex, 1.2);
    const i = seen.size;
    const cy = 0.95 + (i % 5) * 0.12;
    const mesh = voxel(group, hex, m.x, cy, m.z, 0.16, { mat: mat0 });
    motes.push({
      mesh, mat: mat0, cx: m.x, cz: m.z, cy,
      rx: 0.18 + (i % 3) * 0.06, rz: 0.16 + (i % 4) * 0.05,
      sx: 0.6 + (i % 5) * 0.13, sz: 0.5 + (i % 3) * 0.14,
      phase: (i * 1.371) % TAU,
    });
    if (motes.length > CAP) {
      const old = motes.shift();
      if (old) group.remove(old.mesh);
    }
  }

  for (const m of initial) add(m);

  return {
    group,
    update: (t) => {
      for (const f of motes) {
        f.mesh.position.set(
          f.cx + Math.sin(t * f.sx + f.phase) * f.rx,
          f.cy + Math.sin(t * f.sx * 0.7 + f.phase * 1.7) * 0.14,
          f.cz + Math.cos(t * f.sz + f.phase) * f.rz,
        );
        f.mat.emissiveIntensity = 0.55 + 0.55 * (0.5 + 0.5 * Math.sin(t * 2.4 + f.phase));
      }
    },
    sync: (marks) => {
      for (const m of marks) add(m);
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
