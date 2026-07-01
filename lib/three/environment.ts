import * as THREE from 'three';
import { P, color, mat, emit, glass, box, cyl, cone, sphere, dome, voxel, pivot, osc, TAU, GRADIENT } from './kit';
import { type Mark, MARK_COLORS } from '../marks-types';

export interface EnvPart {
  group: THREE.Group;
  update: (t: number, dt: number) => void;
}

/* ==================================================== TIME OF DAY ===== */
// The scene tracks the real clock in Korea (KST = UTC+9, no DST): the key light
// orbits (shadows sweep + stretch) and the whole sky/ambient palette shifts
// through night → dawn → bright noon → golden → dusk. The keyframes below are
// interpolated continuously and re-applied every frame, so leaving the page open
// slowly transitions with the actual time.

export interface TodState {
  skyTop: number; skyMid: number; skyBot: number; skyGlow: number;
  keyX: number; keyY: number; keyZ: number; keyCol: number; keyI: number;
  ambCol: number; ambI: number;
  hemiSky: number; hemiGnd: number; hemiI: number;
  rimCol: number; rimI: number;
  shadowI: number; star: number; cloud: number; moon: number;
}
interface TodKey extends TodState { h: number }

/** Current time in Korea as a 0–24 float (UTC+9, no DST — viewer TZ-independent). */
export function kstHour(): number {
  const d = new Date();
  return (d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600 + 9) % 24;
}

// h = KST hour. keyX/Y/Z = key-light position (sun/moon direction → shadows).
const TOD_KEYS: TodKey[] = [
  { h: 2.0, skyTop: 0x0a1024, skyMid: 0x121a36, skyBot: 0x1e2444, skyGlow: 0x2a2a52,
    keyX: -40, keyY: 34, keyZ: -34, keyCol: 0xaebfe6, keyI: 0.4,
    ambCol: 0x1a2038, ambI: 0.55, hemiSky: 0x24304e, hemiGnd: 0x161e2c, hemiI: 0.35,
    rimCol: 0x4a5578, rimI: 0.45, shadowI: 0.5, star: 1.0, cloud: 0x2a3350, moon: 1.0 },
  { h: 5.5, skyTop: 0x1c2a52, skyMid: 0x35406a, skyBot: 0x574f74, skyGlow: 0x8a6478,
    keyX: 52, keyY: 9, keyZ: 12, keyCol: 0x9aa2cc, keyI: 0.55,
    ambCol: 0x2b3048, ambI: 0.62, hemiSky: 0x3a4668, hemiGnd: 0x2a3440, hemiI: 0.4,
    rimCol: 0xb87a80, rimI: 0.5, shadowI: 0.6, star: 0.5, cloud: 0x4a4668, moon: 0.5 },
  { h: 7.0, skyTop: 0x40548c, skyMid: 0x7a6e96, skyBot: 0xd89a92, skyGlow: 0xffb474,
    keyX: 56, keyY: 12, keyZ: 8, keyCol: 0xffca88, keyI: 1.15,
    ambCol: 0x3d4258, ambI: 0.72, hemiSky: 0x6a7a9c, hemiGnd: 0x3d5a48, hemiI: 0.45,
    rimCol: 0xffae76, rimI: 0.6, shadowI: 0.82, star: 0.1, cloud: 0xd9a9a0, moon: 0.08 },
  { h: 12.0, skyTop: 0x3f82cf, skyMid: 0x69a6db, skyBot: 0xbadcf0, skyGlow: 0xe8f4ff,
    keyX: 8, keyY: 58, keyZ: 16, keyCol: 0xfff3df, keyI: 1.55,
    ambCol: 0x93b2d2, ambI: 0.9, hemiSky: 0xa2caf0, hemiGnd: 0x5a9670, hemiI: 0.6,
    rimCol: 0xbadcf0, rimI: 0.3, shadowI: 0.7, star: 0.0, cloud: 0xdff0ff, moon: 0.0 },
  { h: 15.5, skyTop: 0x4a6ea8, skyMid: 0x8a86a8, skyBot: 0xd8b0a0, skyGlow: 0xffcf9a,
    keyX: -20, keyY: 40, keyZ: 6, keyCol: 0xffe6c0, keyI: 1.4,
    ambCol: 0x6a6a80, ambI: 0.84, hemiSky: 0x8a9ab0, hemiGnd: 0x5a8060, hemiI: 0.55,
    rimCol: 0xffb488, rimI: 0.5, shadowI: 0.78, star: 0.0, cloud: 0xe8cbb0, moon: 0.0 },
  { h: 18.5, skyTop: 0x3a3a68, skyMid: 0x86577e, skyBot: 0xe0847a, skyGlow: 0xff965a,
    keyX: -54, keyY: 12, keyZ: -6, keyCol: 0xffb070, keyI: 1.2,
    ambCol: 0x4a3a52, ambI: 0.72, hemiSky: 0x7a5a78, hemiGnd: 0x4a5a48, hemiI: 0.45,
    rimCol: 0xff8a6a, rimI: 0.7, shadowI: 0.85, star: 0.08, cloud: 0xe0907e, moon: 0.06 },
  { h: 20.5, skyTop: 0x252c4a, skyMid: 0x3d3a68, skyBot: 0x584a70, skyGlow: 0xc97c84,
    keyX: 30, keyY: 34, keyZ: 26, keyCol: 0xf4dcb4, keyI: 1.25,
    ambCol: 0x34384f, ambI: 0.85, hemiSky: 0x4a5a78, hemiGnd: 0x356a54, hemiI: 0.45,
    rimCol: 0xc2727a, rimI: 0.7, shadowI: 0.75, star: 0.55, cloud: 0x3a3358, moon: 0.45 },
];

const _lc = (a: number, b: number, f: number) => a + (b - a) * f;
const _ca = new THREE.Color();
const _cb = new THREE.Color();
function _lh(a: number, b: number, f: number): number {
  _ca.setHex(a, THREE.SRGBColorSpace);
  _cb.setHex(b, THREE.SRGBColorSpace);
  return _ca.lerp(_cb, f).getHex(THREE.SRGBColorSpace);
}
const _todOut: TodState = {
  skyTop: 0, skyMid: 0, skyBot: 0, skyGlow: 0, keyX: 0, keyY: 0, keyZ: 0, keyCol: 0,
  keyI: 0, ambCol: 0, ambI: 0, hemiSky: 0, hemiGnd: 0, hemiI: 0, rimCol: 0, rimI: 0,
  shadowI: 0, star: 0, cloud: 0, moon: 0,
};

/** Interpolated sky/light state for a KST hour (0–24). Reuses one object. */
export function todAt(hour: number): TodState {
  const n = TOD_KEYS.length;
  let a = TOD_KEYS[n - 1], b = TOD_KEYS[0], f = 0;
  for (let i = 0; i < n; i++) {
    const cur = TOD_KEYS[i], nxt = TOD_KEYS[(i + 1) % n];
    const h0 = cur.h;
    const h1 = i === n - 1 ? nxt.h + 24 : nxt.h;
    const hh = i === n - 1 && hour < TOD_KEYS[0].h ? hour + 24 : hour;
    if (hh >= h0 && hh < h1) { a = cur; b = nxt; f = (hh - h0) / (h1 - h0); break; }
  }
  const o = _todOut;
  o.skyTop = _lh(a.skyTop, b.skyTop, f); o.skyMid = _lh(a.skyMid, b.skyMid, f);
  o.skyBot = _lh(a.skyBot, b.skyBot, f); o.skyGlow = _lh(a.skyGlow, b.skyGlow, f);
  o.keyX = _lc(a.keyX, b.keyX, f); o.keyY = _lc(a.keyY, b.keyY, f); o.keyZ = _lc(a.keyZ, b.keyZ, f);
  o.keyCol = _lh(a.keyCol, b.keyCol, f); o.keyI = _lc(a.keyI, b.keyI, f);
  o.ambCol = _lh(a.ambCol, b.ambCol, f); o.ambI = _lc(a.ambI, b.ambI, f);
  o.hemiSky = _lh(a.hemiSky, b.hemiSky, f); o.hemiGnd = _lh(a.hemiGnd, b.hemiGnd, f);
  o.hemiI = _lc(a.hemiI, b.hemiI, f);
  o.rimCol = _lh(a.rimCol, b.rimCol, f); o.rimI = _lc(a.rimI, b.rimI, f);
  o.shadowI = _lc(a.shadowI, b.shadowI, f); o.star = _lc(a.star, b.star, f);
  o.cloud = _lh(a.cloud, b.cloud, f); o.moon = _lc(a.moon, b.moon, f);
  return o;
}

export interface SkyPart extends EnvPart { applyTod: (s: TodState) => void }
export interface LightsPart { group: THREE.Group; applyTod: (s: TodState) => void }

/* ============================================================= SKY ===== */

export function buildSky(): SkyPart {
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

  // Moon-glow disc, back-left, motivates the rim light. Fades out by day.
  const moonMat = new THREE.MeshBasicMaterial({ color: color(P.horizon), transparent: true, opacity: 0.55 });
  const moon = new THREE.Mesh(new THREE.CircleGeometry(14, 24), moonMat);
  moon.position.set(-70, 34, -60);
  moon.lookAt(0, 10, 0);
  group.add(moon);
  const moonCoreMat = new THREE.MeshBasicMaterial({ color: color(P.amber), transparent: true, opacity: 0.5 });
  const moonCore = new THREE.Mesh(new THREE.CircleGeometry(8, 24), moonCoreMat);
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

  // Drifting clouds — flat slabs. Materials are cloned so they can be re-tinted
  // per time of day (light in daylight, rose at dusk, blue-grey at night).
  const clouds: THREE.Mesh[] = [];
  const cloudMats: THREE.MeshToonMaterial[] = [];
  const cloudData = [
    { x: -40, y: 26, z: -30, s: 1.4 },
    { x: 46, y: 32, z: -44, s: 1.0 },
    { x: 20, y: 22, z: -60, s: 1.7 },
  ];
  for (const c of cloudData) {
    const m = new THREE.Group();
    const mA = mat(P.dusk).clone();
    const mB = mat(P.dusk).clone();
    const mC = mat(P.horizon).clone();
    box(m, P.dusk, 10, 2.4, 4, 0, 0, 0, { mat: mA });
    box(m, P.dusk, 6, 2.4, 4, -5, 1.2, 0, { mat: mB });
    box(m, P.horizon, 7, 2, 4, 4, 1, 0, { mat: mC });
    cloudMats.push(mA, mB, mC);
    m.scale.setScalar(c.s);
    m.position.set(c.x, c.y, c.z);
    clouds.push(m as unknown as THREE.Mesh);
    group.add(m);
  }

  const starMat = stars.material as THREE.PointsMaterial;
  const su = skyMat.uniforms;
  let starDay = 1; // 0 by day, 1 at night — set by applyTod
  return {
    group,
    update: (t) => {
      starMat.opacity = (0.7 + 0.25 * osc(t, 4)) * starDay;
      for (let i = 0; i < clouds.length; i++) {
        const c = clouds[i];
        c.position.x += 0.012 * (i % 2 === 0 ? 1 : -1);
        if (c.position.x > 80) c.position.x = -80;
        if (c.position.x < -80) c.position.x = 80;
      }
    },
    applyTod: (s) => {
      su.top.value.setHex(s.skyTop, THREE.SRGBColorSpace);
      su.mid.value.setHex(s.skyMid, THREE.SRGBColorSpace);
      su.bot.value.setHex(s.skyBot, THREE.SRGBColorSpace);
      su.glow.value.setHex(s.skyGlow, THREE.SRGBColorSpace);
      moonMat.opacity = 0.6 * s.moon;
      moonCoreMat.opacity = 0.5 * s.moon;
      for (const m of cloudMats) m.color.setHex(s.cloud, THREE.SRGBColorSpace);
      starDay = s.star;
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
      // FLOWING water: waves TRAVEL outward toward the spill edges plus a
      // drifting diagonal swell, so the crest highlights scroll across the
      // surface — it reads as a moving current being drawn off the island,
      // not a still pond. (Amplitude stays low so nothing washes over the rim.)
      const rr = Math.sqrt(x * x + z * z);
      const h =
        Math.sin(rr * 0.5 - t * 1.7) * 0.03 +
        Math.sin((x * 0.6 + z * 0.35) - t * 1.25) * 0.022 +
        Math.cos((x * 0.35 - z * 0.7) - t * 1.0) * 0.018 +
        Math.sin((x + z) * 0.9 - t * 2.4) * 0.01;
      pos.setY(i, h);
      const crest = THREE.MathUtils.clamp((h + 0.05) / 0.1, 0, 1);
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
  const foam: {
    mesh: THREE.Mesh; mat: THREE.MeshToonMaterial; base: number; baseY: number;
    sx: number; sy: number; sz: number; phase: number; rate: number; chunk: boolean;
  }[] = [];
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
    const baseMat = glass(P.foam, 0.6, 0.1).clone();
    const baseMesh = box(
      group, P.foam,
      alongX ? 8.0 : 0.55, 0.3, alongX ? 0.55 : 8.0,
      ex, -0.4, ez,
      { mat: baseMat },
    );
    foam.push({ mesh: baseMesh, mat: baseMat, base: 0.6, baseY: -0.4, sx: 0, sy: 0, sz: 0, phase: ei * 0.9, rate: 0, chunk: false });
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
      const mat = glass(P.foam, op, 0.08 + r2 * 0.12).clone();
      const cm = box(group, P.foam, s, h, s, px, py, pz, { mat });
      foam.push({
        mesh: cm, mat, base: op, baseY: py, sx: s, sy: h, sz: s,
        phase: ei * 1.7 + k * 0.6 + r1 * TAU, rate: 0.28 + r2 * 0.4, chunk: true,
      });
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
      // Real churning foam: each froth chunk cycles small→full→gone on its own
      // offset loop (plus a bob), so the crest continuously bubbles up and
      // dissolves instead of sitting there like a frozen block of ice.
      for (const fo of foam) {
        if (fo.chunk) {
          const cyc = (t * fo.rate + fo.phase) % 1; // 0..1 birth→death loop
          const env = Math.sin(cyc * Math.PI); // 0→1→0
          const e = 0.14 + 0.86 * env; // scale envelope (never fully vanishes)
          fo.mesh.scale.set(fo.sx * e, fo.sy * e, fo.sz * e);
          fo.mesh.position.y =
            fo.baseY + Math.sin(t * 2.2 + fo.phase) * 0.05 + (env - 0.5) * 0.06;
          fo.mat.opacity = fo.base * (0.2 + 0.8 * env);
        } else {
          // continuous base strip: gentle shimmer only (keeps the seam covered)
          fo.mat.opacity = fo.base * (0.72 + 0.22 * Math.sin(t * 1.8 + fo.phase));
        }
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

export function buildLights(): LightsPart {
  const group = new THREE.Group();

  // Cool ambient — shadow sides read indigo, never black. (color/intensity are
  // driven by time of day via applyTod; these are just initial values.)
  const ambient = new THREE.AmbientLight(color(0x34384f), 0.85);
  group.add(ambient);

  // The "sun/moon": a directional key whose POSITION (and thus shadow
  // direction/length) is set from the KST clock by applyTod. Ortho shadow
  // frustum is roomy enough for the low-angle sunrise/sunset shadows that
  // stretch well past the island.
  const key = new THREE.DirectionalLight(color(0xf4dcb4), 1.25);
  key.position.set(30, 34, 26);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const sc = key.shadow.camera;
  sc.left = -18;
  sc.right = 18;
  sc.top = 18;
  sc.bottom = -18;
  sc.near = 20;
  sc.far = 110;
  sc.updateProjectionMatrix();
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.04;
  key.shadow.intensity = 0.75;
  group.add(key);

  // Cool sky fill from above grounds the palette.
  const hemi = new THREE.HemisphereLight(color(0x4a5a78), color(P.moss), 0.45);
  group.add(hemi);

  // Back rim for edge separation against the sky.
  const rim = new THREE.DirectionalLight(color(P.horizon), 0.7);
  rim.position.set(-26, 12, -30);
  group.add(rim);

  return {
    group,
    applyTod: (s) => {
      ambient.color.setHex(s.ambCol, THREE.SRGBColorSpace);
      ambient.intensity = s.ambI;
      key.position.set(s.keyX, s.keyY, s.keyZ);
      key.color.setHex(s.keyCol, THREE.SRGBColorSpace);
      key.intensity = s.keyI;
      key.shadow.intensity = s.shadowI;
      hemi.color.setHex(s.hemiSky, THREE.SRGBColorSpace);
      hemi.groundColor.setHex(s.hemiGnd, THREE.SRGBColorSpace);
      hemi.intensity = s.hemiI;
      rim.color.setHex(s.rimCol, THREE.SRGBColorSpace);
      rim.intensity = s.rimI;
    },
  };
}
