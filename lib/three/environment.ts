import * as THREE from 'three';
import { P, color, emit, glass, box, cyl, cone, voxel, pivot, TAU } from './kit';
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
  /** Backdrop gradient, top of the viewport → bottom, + a horizon glow tint. */
  skyTop: number; skyMid: number; skyBot: number; skyGlow: number;
  /** Strength (0–1) of the low horizon glow (biased to the sun's screen side). */
  haze: number;
  keyX: number; keyY: number; keyZ: number; keyCol: number; keyI: number;
  ambCol: number; ambI: number;
  hemiSky: number; hemiGnd: number; hemiI: number;
  /** Cool "bounce" fill from the side opposite the key (hue-shifted shadow side). */
  rimCol: number; rimI: number;
  shadowI: number;
  /** Night factor 0–1: drives lanterns / emissives (models.ts) + celestials. */
  star: number;
  /** Cloud tint + cloud amount (screen-space pixel clouds in the sky shader). */
  cloud: number; cloudA: number;
  moon: number;
}
interface TodKey extends TodState { h: number }

/** Current time in Korea as a 0–24 float (UTC+9, no DST — viewer TZ-independent). */
export function kstHour(): number {
  const d = new Date();
  return (d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600 + 9) % 24;
}

// h = KST hour. keyX/Y/Z = key-light position (sun/moon direction → shadows).
// Value structure: the toon ramp (kit.ts GRADIENT) gives faces turned away from
// the key ~no key light, so each keyframe aims the key so that TOP faces read
// lightest, one visible side (+X or +Z) mid, the other dark. Fills are kept low
// and COOL (ambient/hemi/bounce) while the key is warm → hue-shifted shadows
// instead of brown mud. Moonlight comes from −Z (the moon sits top-right on
// screen) so the +X side catches it and +Z falls into blue shade.
const MOON = { keyX: 14, keyY: 40, keyZ: -36 };
const TOD_KEYS: TodKey[] = [
  // DEEP NIGHT — moody blue, readable; warm lantern pools carry the scene.
  { h: 1.5, skyTop: 0x0c1230, skyMid: 0x18224a, skyBot: 0x262c5c, skyGlow: 0x3c3a78, haze: 0.3,
    ...MOON, keyCol: 0xb8c6f0, keyI: 0.95,
    ambCol: 0x2c3460, ambI: 0.8, hemiSky: 0x4e5e94, hemiGnd: 0x222a44, hemiI: 0.75,
    rimCol: 0x5a68b0, rimI: 0.35, shadowI: 0.5, star: 1.0, cloud: 0x2a3462, cloudA: 0.35, moon: 1.0 },
  // PRE-DAWN — indigo lifting to violet at the bottom.
  { h: 4.6, skyTop: 0x141e48, skyMid: 0x2c3672, skyBot: 0x564a86, skyGlow: 0x9a6890, haze: 0.5,
    ...MOON, keyCol: 0xb0b8e8, keyI: 0.9,
    ambCol: 0x323a6a, ambI: 0.8, hemiSky: 0x56629a, hemiGnd: 0x2a3048, hemiI: 0.72,
    rimCol: 0x7a6ab0, rimI: 0.35, shadowI: 0.55, star: 0.8, cloud: 0x4a4478, cloudA: 0.45, moon: 0.8 },
  // DAWN — low warm sun from the east (+X), cool lavender fill.
  { h: 6.2, skyTop: 0x34488a, skyMid: 0x7c70aa, skyBot: 0xeea494, skyGlow: 0xffc488, haze: 0.85,
    keyX: 48, keyY: 17, keyZ: 30, keyCol: 0xffbe8c, keyI: 1.6,
    ambCol: 0x3c4274, ambI: 0.66, hemiSky: 0x7482bc, hemiGnd: 0x3a4658, hemiI: 0.68,
    rimCol: 0x6a76c8, rimI: 0.4, shadowI: 0.75, star: 0.15, cloud: 0xf6bcaa, cloudA: 0.75, moon: 0.1 },
  // MORNING — clean blue, warm-white sun from the east.
  { h: 8.6, skyTop: 0x2e6cc4, skyMid: 0x63a0de, skyBot: 0xb0d8f2, skyGlow: 0xfff0d6, haze: 0.4,
    keyX: 44, keyY: 42, keyZ: 26, keyCol: 0xffe8c8, keyI: 1.55,
    ambCol: 0x5e78b4, ambI: 0.5, hemiSky: 0x9cc4f0, hemiGnd: 0x4c7458, hemiI: 0.7,
    rimCol: 0x7896d8, rimI: 0.3, shadowI: 0.7, star: 0.0, cloud: 0xffffff, cloudA: 0.85, moon: 0.0 },
  // NOON — bright, saturated, high sun slightly south (+Z) and west of camera.
  { h: 12.5, skyTop: 0x2a6ad0, skyMid: 0x56a0ea, skyBot: 0xa4d8f6, skyGlow: 0xeaf8ff, haze: 0.3,
    keyX: -16, keyY: 58, keyZ: 30, keyCol: 0xfff6e8, keyI: 1.65,
    ambCol: 0x6a8cc8, ambI: 0.48, hemiSky: 0xa8d0f6, hemiGnd: 0x507c60, hemiI: 0.72,
    rimCol: 0x86a6e0, rimI: 0.3, shadowI: 0.65, star: 0.0, cloud: 0xffffff, cloudA: 0.9, moon: 0.0 },
  // AFTERNOON — still blue, sun swinging west, a first warm hint low down.
  { h: 15.5, skyTop: 0x2c62b8, skyMid: 0x6a9ad8, skyBot: 0xd0d8ea, skyGlow: 0xffdcae, haze: 0.4,
    keyX: -34, keyY: 44, keyZ: 32, keyCol: 0xffe6bc, keyI: 1.65,
    ambCol: 0x6474b4, ambI: 0.48, hemiSky: 0x98b6e8, hemiGnd: 0x56785a, hemiI: 0.68,
    rimCol: 0x8a8ad8, rimI: 0.32, shadowI: 0.72, star: 0.0, cloud: 0xfff4e6, cloudA: 0.8, moon: 0.0 },
  // GOLDEN HOUR — gold key, periwinkle shadows, peach horizon.
  { h: 17.3, skyTop: 0x34509e, skyMid: 0x8484c4, skyBot: 0xf4c4a0, skyGlow: 0xffb878, haze: 0.65,
    keyX: -40, keyY: 28, keyZ: 38, keyCol: 0xffc884, keyI: 1.8,
    ambCol: 0x5458a4, ambI: 0.56, hemiSky: 0x8c90d4, hemiGnd: 0x4a6458, hemiI: 0.68,
    rimCol: 0x7a7ae0, rimI: 0.42, shadowI: 0.8, star: 0.0, cloud: 0xffdcb8, cloudA: 0.8, moon: 0.0 },
  // SUNSET — low orange sun, violet sky, coral horizon; island stays colourful.
  { h: 18.7, skyTop: 0x2a306e, skyMid: 0x6c5498, skyBot: 0xf08c78, skyGlow: 0xffa45e, haze: 0.9,
    keyX: -38, keyY: 17, keyZ: 42, keyCol: 0xffa868, keyI: 1.75,
    ambCol: 0x4c4c98, ambI: 0.64, hemiSky: 0x7e78c8, hemiGnd: 0x3c4c5e, hemiI: 0.7,
    rimCol: 0x6c74d8, rimI: 0.48, shadowI: 0.82, star: 0.1, cloud: 0xffa08c, cloudA: 0.8, moon: 0.05 },
  // BLUE HOUR — sun gone, moon up; lanterns coming on.
  { h: 19.7, skyTop: 0x182052, skyMid: 0x343a7a, skyBot: 0x6c5690, skyGlow: 0xc4748a, haze: 0.6,
    ...MOON, keyCol: 0xc4c4f0, keyI: 0.95,
    ambCol: 0x363c74, ambI: 0.75, hemiSky: 0x5a66a8, hemiGnd: 0x283248, hemiI: 0.72,
    rimCol: 0x7464b8, rimI: 0.38, shadowI: 0.55, star: 0.6, cloud: 0x4c4480, cloudA: 0.5, moon: 0.6 },
  // EVENING NIGHT
  { h: 21.5, skyTop: 0x0f1638, skyMid: 0x1e2854, skyBot: 0x2e3466, skyGlow: 0x464282, haze: 0.35,
    ...MOON, keyCol: 0xbccaf0, keyI: 0.95,
    ambCol: 0x2e3662, ambI: 0.8, hemiSky: 0x4e6096, hemiGnd: 0x242c46, hemiI: 0.75,
    rimCol: 0x5a6ab0, rimI: 0.35, shadowI: 0.5, star: 1.0, cloud: 0x2c3664, cloudA: 0.38, moon: 1.0 },
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
  skyTop: 0, skyMid: 0, skyBot: 0, skyGlow: 0, haze: 0, keyX: 0, keyY: 0, keyZ: 0, keyCol: 0,
  keyI: 0, ambCol: 0, ambI: 0, hemiSky: 0, hemiGnd: 0, hemiI: 0, rimCol: 0, rimI: 0,
  shadowI: 0, star: 0, cloud: 0, cloudA: 0, moon: 0,
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
  f = f * f * (3 - 2 * f); // ease between keys (no visible kinks at keyframes)
  const o = _todOut;
  o.skyTop = _lh(a.skyTop, b.skyTop, f); o.skyMid = _lh(a.skyMid, b.skyMid, f);
  o.skyBot = _lh(a.skyBot, b.skyBot, f); o.skyGlow = _lh(a.skyGlow, b.skyGlow, f);
  o.haze = _lc(a.haze, b.haze, f);
  o.keyX = _lc(a.keyX, b.keyX, f); o.keyY = _lc(a.keyY, b.keyY, f); o.keyZ = _lc(a.keyZ, b.keyZ, f);
  o.keyCol = _lh(a.keyCol, b.keyCol, f); o.keyI = _lc(a.keyI, b.keyI, f);
  o.ambCol = _lh(a.ambCol, b.ambCol, f); o.ambI = _lc(a.ambI, b.ambI, f);
  o.hemiSky = _lh(a.hemiSky, b.hemiSky, f); o.hemiGnd = _lh(a.hemiGnd, b.hemiGnd, f);
  o.hemiI = _lc(a.hemiI, b.hemiI, f);
  o.rimCol = _lh(a.rimCol, b.rimCol, f); o.rimI = _lc(a.rimI, b.rimI, f);
  o.shadowI = _lc(a.shadowI, b.shadowI, f); o.star = _lc(a.star, b.star, f);
  o.cloud = _lh(a.cloud, b.cloud, f); o.cloudA = _lc(a.cloudA, b.cloudA, f);
  o.moon = _lc(a.moon, b.moon, f);
  return o;
}

export interface SkyPart extends EnvPart { applyTod: (s: TodState) => void }
export interface LightsPart { group: THREE.Group; applyTod: (s: TodState) => void }

/* ============================================================= SKY ===== */
// The camera looks DOWN at the island, so a world-space sky dome only ever
// showed its below-horizon colour (one flat wall). Instead the dome is shaded in
// SCREEN space: a top→bottom gradient of the TOD colours, quantised into bands
// with 4×4 Bayer dithering (computed on the low-res pixel-pass buffer, so each
// dither cell is one chunky pixel), a low horizon glow on the sun's side, soft
// pixel clouds, and — at night — stars + the moon. Everything celestial lives in
// this one shader (no meshes), so the pixel pass's edge detection can never draw
// an outline around a faded-out moon/halo. The moon is placed in CSS pixels,
// clear of the top-left title and the top-right button (desktop + mobile).

export function buildSky(): SkyPart {
  const group = new THREE.Group();

  const skyGeo = new THREE.SphereGeometry(140, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: color(0x0f1638) },
      mid: { value: color(0x1e2854) },
      bot: { value: color(0x2e3466) },
      glow: { value: color(0x464282) },
      cloudCol: { value: color(0x2c3664) },
      haze: { value: 0.3 },
      sunX: { value: 0 },
      starVis: { value: 1 },
      cloudAmt: { value: 0.4 },
      time: { value: 0 },
      view: { value: new THREE.Vector2(1440, 900) },
      moonPos: { value: new THREE.Vector2(1160, 150) },
      moonR: { value: 40 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vScr;
      void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        vScr = gl_Position.xy / gl_Position.w; // ortho → affine, exact per pixel
      }`,
    fragmentShader: /* glsl */ `
      varying vec2 vScr;
      uniform vec3 top; uniform vec3 mid; uniform vec3 bot; uniform vec3 glow; uniform vec3 cloudCol;
      uniform float haze; uniform float sunX; uniform float starVis; uniform float cloudAmt; uniform float time;
      uniform vec2 view; uniform vec2 moonPos; uniform float moonR;

      float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
      float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vnoise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }

      void main() {
        vec2 uv = vScr * 0.5 + 0.5;               // 0..1, y up
        vec2 px = vec2(uv.x, 1.0 - uv.y) * view;  // CSS px from the top-left
        float d = bayer4(gl_FragCoord.xy);        // one cell = one pixel-art block

        // banded, dithered vertical gradient (top → mid → bottom)
        const float B = 11.0;
        float yq = floor(uv.y * B + d) / B;
        vec3 c = mix(bot, mid, smoothstep(0.0, 0.6, yq));
        c = mix(c, top, smoothstep(0.5, 1.0, yq));

        // low horizon glow, strongest on the sun's side of the screen
        float side = clamp(1.0 - abs(uv.x - (0.5 + 0.42 * sunX)) * 1.3, 0.0, 1.0);
        float g = (1.0 - smoothstep(0.0, 0.5, uv.y)) * (0.45 + 0.55 * side) * haze;
        g = floor(g * 5.0 + d) / 5.0;
        c = mix(c, glow, g * 0.85);

        // soft pixel clouds (two drifting decks, kept out of the title band)
        vec2 q = vec2(px.x / 230.0 + time * 0.012, px.y / 46.0);
        float n = vnoise(q) * 0.6 + vnoise(q * 2.1 + 7.3) * 0.3 + vnoise(q * 4.3 + 3.1) * 0.1;
        float deck = smoothstep(0.02, 0.18, uv.y) * (1.0 - smoothstep(0.34, 0.5, uv.y))
                   + 0.6 * smoothstep(0.52, 0.6, uv.y) * (1.0 - smoothstep(0.68, 0.78, uv.y));
        float cd = smoothstep(0.5, 0.72, n) * deck;
        cd = floor(cd * 3.0 + d) / 3.0;
        float under = smoothstep(0.5, 0.7, vnoise(q + vec2(0.0, 0.35)) * 0.6 + vnoise((q + vec2(0.0, 0.35)) * 2.1 + 7.3) * 0.3);
        vec3 cc = mix(cloudCol, mix(cloudCol, c, 0.45), step(under + 0.08, n) * 0.8);
        c = mix(c, cc, cd * cloudAmt);

        // night: stars (one block each) + the moon, faded by starVis
        if (starVis > 0.001) {
          vec2 cell = floor(gl_FragCoord.xy);
          float h = hash(cell);
          float title = step(px.x, 480.0) * step(px.y, 125.0);
          float sky = smoothstep(0.35, 0.6, uv.y) * (1.0 - title);
          float tw = 0.55 + 0.45 * sin(time * (1.5 + 2.0 * fract(h * 91.0)) + h * 60.0);
          float st = step(0.9935, h) * sky * tw;
          vec2 mp = px - moonPos;
          float dm = length(mp);
          st *= step(moonR * 1.9, dm);
          c = mix(c, vec3(1.0, 0.97, 0.88), st * starVis);

          // halo: two dithered rings fading out from the disc
          float hv = 1.0 - clamp((dm - moonR) / (moonR * 0.85), 0.0, 1.0);
          hv = floor(hv * 3.0 + d) / 3.0;
          c = mix(c, vec3(0.55, 0.6, 0.78), hv * 0.22 * starVis * step(moonR, dm));
          if (dm < moonR) {
            vec2 m = mp / moonR;
            float maria = step(length(m - vec2(-0.32, -0.25)), 0.26) + step(length(m - vec2(0.3, 0.14)), 0.17)
                        + step(length(m - vec2(0.08, -0.48)), 0.11) + step(length(m - vec2(-0.12, 0.42)), 0.1);
            vec3 mc = mix(vec3(0.86, 0.88, 0.92), vec3(0.62, 0.65, 0.74), min(maria, 1.0));
            // terminator shade on the lower-left limb
            mc = mix(mc, vec3(0.6, 0.64, 0.76), step(0.55, dot(m, vec2(-0.6, 0.8))) * 0.7);
            c = mix(c, mc, starVis);
          }
        }
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const dome = new THREE.Mesh(skyGeo, skyMat);
  dome.frustumCulled = false;
  group.add(dome);

  const su = skyMat.uniforms;
  return {
    group,
    update: (t) => {
      su.time.value = t;
      // Screen-space celestial placement (CSS px) — clear of the top-left title
      // (~460×110) and the top-right link button on desktop and mobile.
      const w = window.innerWidth, h = window.innerHeight;
      su.view.value.set(w, h);
      if (w <= 640) {
        su.moonPos.value.set(w * 0.77, 178);
        su.moonR.value = 25;
      } else {
        su.moonPos.value.set(w - Math.max(250, w * 0.19), 150);
        su.moonR.value = 40;
      }
    },
    applyTod: (s) => {
      su.top.value.setHex(s.skyTop, THREE.SRGBColorSpace);
      su.mid.value.setHex(s.skyMid, THREE.SRGBColorSpace);
      su.bot.value.setHex(s.skyBot, THREE.SRGBColorSpace);
      su.glow.value.setHex(s.skyGlow, THREE.SRGBColorSpace);
      su.cloudCol.value.setHex(s.cloud, THREE.SRGBColorSpace);
      su.haze.value = s.haze;
      su.cloudAmt.value = s.cloudA;
      // which screen side the sun is on: camera-right is world (1,0,-1)/√2
      const kx = s.keyX - s.keyZ;
      su.sunX.value = Math.max(-1, Math.min(1, kx / 50));
      // celestials only once it's meaningfully night, then fade in
      const v = Math.min(1, Math.max(0, (s.star - 0.3) / 0.4));
      su.starVis.value = v * v * (3 - 2 * v);
    },
  };
}

/* ========================================================== HELPERS ===== */

const GY = 0.5; // grass surface height (top of the grass slab)

/** Deterministic pseudo-random in [0,1) — keeps scatter stable across loads. */
function rng(i: number, salt = 0): number {
  const v = Math.sin(i * 127.1 + salt * 311.7 + 7.13) * 43758.5453;
  return v - Math.floor(v);
}

/** Animatable (cloned) emissive material so we never mutate the shared cache. */
function glow(hex: number, intensity = 1): THREE.MeshToonMaterial {
  return emit(hex, intensity).clone();
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

  // Cool bounce fill opposite the key (repositioned by applyTod).
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
      // cool bounce from the side opposite the key (low, so it tints the dark
      // side faces + cast shadows rather than lifting everything)
      rim.position.set(-s.keyX, 14, -s.keyZ);
    },
  };
}
