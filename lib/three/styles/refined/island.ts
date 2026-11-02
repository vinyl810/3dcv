import * as THREE from 'three';
import { color } from '../../kit';
import { LANDMARK_LAYOUT, nearLandmark } from '../../layout';
import type { TodState } from '../../environment';
import type { IslandPart } from '../types';
import { Mesher, RP, glowMat, rng, vnoise, TAU, osc } from './rkit';
import {
  CELL, HALF_CELLS, GRASS_Y, SAND_Y, FLOOR_Y, RIM_Y, NOTCH_Y,
  cellMap, cellAt, cx, radial01, classify, seNorm, type Cell,
} from './shape';

/* ------------------------------------------------------------ TERRAIN ---- */

const _c = new THREE.Color();
function lin(hex: number, mul = 1): [number, number, number] {
  _c.setHex(hex, THREE.SRGBColorSpace);
  return [_c.r * mul, _c.g * mul, _c.b * mul];
}

function topY(t: Cell): number {
  switch (t) {
    case 'G': return GRASS_Y;
    case 'S': return SAND_Y;
    case 'W': return FLOOR_Y;
    case 'R': return RIM_Y;
    case 'N': return NOTCH_Y;
    default: return 0;
  }
}

/** Distance from p to segment a→b (xz). */
function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax, dz = bz - az;
  const L2 = dx * dx + dz * dz;
  const k = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L2));
  const qx = ax + dx * k - px, qz = az + dz * k - pz;
  return Math.sqrt(qx * qx + qz * qz);
}

/** Grass-top colour at a sub-cell (paths follow the hub→landmark cables). */
function grassColor(x: number, z: number, seed: number): number {
  // plaza ring around the hub deck
  const rh = Math.hypot(x, z);
  if (rh < 2.35) return rh > 2.1 ? RP.pathEdge : RP.path;
  for (const L of LANDMARK_LAYOUT) {
    if (L.id === 'about') continue;
    const d = segDist(x, z, 0, 0, L.pos[0], L.pos[1]);
    if (d < 0.36) return rng(seed, 3) < 0.12 ? RP.pathEdge : RP.path;
  }
  const n = vnoise(x * 0.42 + 3.1, z * 0.42 - 1.7, 11) + (rng(seed, 5) - 0.5) * 0.12;
  if (n < 0.36) return RP.grassDark;
  if (n > 0.64) return RP.grassLight;
  return RP.grass;
}

function sideColor(t: Cell, y: number, jit: number): number {
  if (t === 'G' && y > 0.28) return RP.grassSide;
  if (t === 'S' && y > -0.02) return RP.sand;
  if ((t === 'R' || t === 'N') && y > -0.12) return RP.pebble;
  if (y > -1.1 + jit) return RP.dirt;
  if (y > -2.6 + jit) return RP.rockWarm;
  if (y > -4.6 + jit) return RP.rockCool;
  return RP.rockDeep;
}

function buildTerrain(): THREE.Mesh {
  const map = cellMap();
  const n = HALF_CELLS * 2;
  const T: number[][] = [];
  const B: number[][] = [];
  for (let i = 0; i < n; i++) {
    T.push([]);
    B.push([]);
    for (let j = 0; j < n; j++) {
      const t = map[i][j];
      if (!t) { T[i].push(NaN); B[i].push(NaN); continue; }
      const x = cx(i), z = cx(j);
      const rn = radial01(x, z);
      let b = -(1.0 + 7.4 * Math.pow(1 - rn, 1.2)) + (vnoise(x * 0.55, z * 0.55, 7) - 0.5) * 1.6;
      b = Math.min(-0.75, Math.round(b * 2) / 2);
      T[i].push(topY(t));
      B[i].push(b);
    }
  }

  const m = new Mesher(1);
  const h = CELL / 2;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const t = map[i][j];
      if (!t) continue;
      const x = cx(i), z = cx(j);
      const top = T[i][j], bot = B[i][j];
      const seed = i * 131 + j * 7;
      const mul = 0.95 + rng(seed, 1) * 0.08;
      const jit = Math.round((rng(seed, 2) - 0.5) * 4) / 4;

      // ---- top face (2×2 sub-cells on grass + sand for a finer pixel grain)
      if (t === 'G' || t === 'S') {
        const q = CELL / 2;
        for (let a = 0; a < 2; a++) {
          for (let c2 = 0; c2 < 2; c2++) {
            const x0 = x - h + a * q, z0 = z - h + c2 * q;
            const sx = x0 + q / 2, sz = z0 + q / 2;
            const sseed = seed * 4 + a * 2 + c2;
            let hex: number;
            if (t === 'G') hex = grassColor(sx, sz, sseed);
            else hex = rng(sseed, 9) < 0.18 ? RP.sandWet : RP.sand;
            const [r, g, bb] = lin(hex, 0.97 + rng(sseed, 4) * 0.05);
            m.quad(x0, top, z0, x0, top, z0 + q, x0 + q, top, z0 + q, x0 + q, top, z0, 0, 1, 0, r, g, bb);
          }
        }
      } else {
        const hex = t === 'W' ? RP.waterDeep : t === 'N' ? RP.pebbleShade : RP.pebble;
        const [r, g, bb] = lin(hex, mul);
        m.quad(x - h, top, z - h, x - h, top, z + h, x + h, top, z + h, x + h, top, z - h, 0, 1, 0, r, g, bb);
      }

      // ---- underside (flat stepped terraces)
      {
        const [r, g, bb] = lin(RP.rockAbyss, mul);
        m.quad(x - h, bot, z - h, x + h, bot, z - h, x + h, bot, z + h, x - h, bot, z + h, 0, -1, 0, r, g, bb);
      }

      // ---- side faces: only the parts not hidden by the neighbour column
      const nbrs: [number, number, number, number][] = [
        [1, 0, 1, 0], [-1, 0, -1, 0], [0, 1, 0, 1], [0, -1, 0, -1],
      ];
      for (const [di, dj, nx, nz] of nbrs) {
        const tn = cellAt(map, i + di, j + dj);
        const nt = tn ? T[i + di][j + dj] : NaN;
        const nb = tn ? B[i + di][j + dj] : NaN;
        // exposed intervals of [bot, top] minus [nb, nt]
        const spans: [number, number][] = [];
        if (!tn || nt <= bot || nb >= top) spans.push([bot, top]);
        else {
          if (nt < top) spans.push([nt, top]);
          if (nb > bot) spans.push([bot, nb]);
        }
        const fx = x + nx * h, fz = z + nz * h;
        for (const [y0, y1] of spans) {
          // split at the colour band boundaries
          const cuts = [y1];
          const bands = [0.28, -0.02, -0.12, -1.1 + jit, -2.6 + jit, -4.6 + jit];
          for (const bnd of bands) if (bnd < y1 && bnd > y0) cuts.push(bnd);
          cuts.push(y0);
          cuts.sort((p, q2) => q2 - p);
          for (let k = 0; k < cuts.length - 1; k++) {
            const ya = cuts[k + 1], yb = cuts[k];
            if (yb - ya < 1e-4) continue;
            const [r, g, bb] = lin(sideColor(t, (ya + yb) / 2, jit), mul);
            if (nx !== 0) {
              m.quad(fx, ya, z - h, fx, ya, z + h, fx, yb, z + h, fx, yb, z - h, nx, 0, 0, r, g, bb);
            } else {
              m.quad(x - h, ya, fz, x + h, ya, fz, x + h, yb, fz, x - h, yb, fz, 0, 0, nz, r, g, bb);
            }
          }
        }
      }
    }
  }
  return m.build()!;
}

/* -------------------------------------------------------------- DECOR ---- */
// Decor is built in decimetre units (Mesher u = 0.1) and merged into ONE mesh.

const D = 10; // world → decimetre

function groundY(x: number, z: number): number {
  const t = classify(x, z);
  return t === 'S' ? SAND_Y : GRASS_Y;
}

function roundTree(m: Mesher, x: number, z: number, s: number) {
  const X = x * D, Z = z * D, y0 = groundY(x, z) * D;
  const k = (v: number) => Math.round(v * s);
  m.b(RP.trunk, 3, k(10), 3, X, y0 + k(10) / 2, Z);
  m.b(RP.trunk, 5, 1, 5, X, y0 + 0.5, Z); // root flare
  let y = y0 + k(9);
  m.b(RP.leaf, k(14), k(4), k(14), X, y + k(4) / 2, Z);
  y += k(4);
  m.b(RP.leafMid, k(18), k(6), k(12), X, y + k(6) / 2, Z);
  m.b(RP.leafMid, k(12), k(6), k(18), X, y + k(6) / 2, Z);
  y += k(6);
  m.b(RP.leafMid, k(14), k(4), k(14), X, y + k(4) / 2, Z, { top: RP.leafLight });
  y += k(4);
  m.b(RP.leafLight, k(8), k(2), k(8), X - 1, y + k(2) / 2, Z + 1);
}

function pineTree(m: Mesher, x: number, z: number, s: number) {
  const X = x * D, Z = z * D, y0 = groundY(x, z) * D;
  const k = (v: number) => Math.max(1, Math.round(v * s));
  const ry = Math.PI / 4; // diamond tiers read crisply from the iso camera
  m.b(RP.trunk, 3, k(8), 3, X, y0 + k(8) / 2, Z);
  let y = y0 + k(6);
  const tiers: [number, number, number][] = [
    [16, 5, RP.leaf], [12, 5, RP.leaf], [9, 5, RP.leafMid], [5, 4, RP.leafMid], [2, 3, RP.leafLight],
  ];
  for (const [w, hh, c] of tiers) {
    m.b(c, k(w), k(hh), k(w), X, y + k(hh) / 2, Z, { ry, top: c === RP.leaf ? RP.leafMid : RP.leafLight });
    y += k(hh) - 1;
  }
}

function bush(m: Mesher, x: number, z: number, s: number) {
  const X = x * D, Z = z * D, y0 = groundY(x, z) * D;
  const k = (v: number) => Math.max(1, Math.round(v * s));
  m.b(RP.leaf, k(10), k(4), k(8), X, y0 + k(4) / 2, Z);
  m.b(RP.leafMid, k(7), k(3), k(9), X + 1, y0 + k(4) + k(3) / 2 - 1, Z, { top: RP.leafLight });
  m.b(RP.leafMid, k(6), k(3), k(5), X - k(5), y0 + k(3) / 2, Z + k(3), { top: RP.leafLight });
}

function rocks(m: Mesher, x: number, z: number, s: number, seed: number) {
  const X = x * D, Z = z * D, y0 = groundY(x, z) * D;
  const k = (v: number) => Math.max(1, Math.round(v * s));
  const ry = rng(seed, 1) * 0.6;
  m.b(RP.pebble, k(8), k(5), k(7), X, y0 + k(5) / 2, Z, { ry });
  m.b(RP.pebbleShade, k(5), k(3), k(5), X + k(6), y0 + k(3) / 2, Z + k(2), { ry: ry + 0.4 });
  m.b(RP.pebble, k(3), k(2), k(3), X - k(4), y0 + 1, Z + k(5));
}

function flowers(m: Mesher, x: number, z: number, hex: number, seed: number) {
  const X = x * D, Z = z * D, y0 = groundY(x, z) * D;
  for (let i = 0; i < 4; i++) {
    const fx = X + Math.round((rng(seed, i * 2) - 0.5) * 9);
    const fz = Z + Math.round((rng(seed, i * 2 + 1) - 0.5) * 9);
    m.b(RP.leafMid, 3, 1, 3, fx, y0 + 0.5, fz);
    m.b(hex, 2, 2, 2, fx, y0 + 2, fz, { flat: true });
  }
}

/** Stone post lantern; returns its glow mesh material + a night light. */
function lantern(
  m: Mesher, g: THREE.Group, x: number, z: number,
): { mat: THREE.MeshToonMaterial; light: THREE.PointLight } {
  const X = x * D, Z = z * D, y0 = groundY(x, z) * D;
  m.b(RP.stoneShade, 5, 2, 5, X, y0 + 1, Z);
  m.b(RP.woodDark, 2, 7, 2, X, y0 + 5.5, Z);
  m.b(RP.woodDeep, 5, 1, 5, X, y0 + 9.5, Z);
  for (const [ox, oz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) m.b(RP.woodDeep, 1, 4, 1, X + ox, y0 + 12, Z + oz);
  m.b(RP.woodDeep, 6, 1, 6, X, y0 + 14.5, Z);
  m.b(RP.woodDeep, 4, 1, 4, X, y0 + 15.5, Z);
  m.b(RP.gold, 1, 1, 1, X, y0 + 16.5, Z, { flat: true });
  const mat = glowMat(RP.amber, 0.4);
  const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), mat);
  bulb.position.set(x, (y0 + 12) / D, z);
  g.add(bulb);
  const light = new THREE.PointLight(color(0xffc27a), 0, 6.5, 1.6);
  light.position.set(x, (y0 + 12) / D, z);
  light.userData.nightBase = 2.4;
  g.add(light);
  return { mat, light };
}

/** A small grass-capped floating islet (merged, orbits slowly). */
function islet(s: number, seed: number): THREE.Mesh {
  const m = new Mesher(0.1);
  const k = (v: number) => Math.max(1, Math.round(v * s));
  m.b(RP.grassSide, k(14), k(2), k(12), 0, 0, 0, { top: RP.grass });
  m.b(RP.dirt, k(12), k(3), k(10), 0, -k(2) - 0.5, 0);
  m.b(RP.rockWarm, k(8), k(3), k(7), 1, -k(5) - 0.5, 0);
  m.b(RP.rockCool, k(4), k(3), k(4), 0, -k(8) - 0.5, 1);
  if (rng(seed, 1) > 0.4) {
    m.b(RP.trunk, 2, k(5), 2, 2, k(3) + 1, -1);
    m.b(RP.leafMid, k(7), k(4), k(7), 2, k(7) + 1, -1, { top: RP.leafLight });
  } else {
    m.b(RP.pebble, k(4), k(3), k(4), -3, k(2), 2);
  }
  return m.build()!;
}

export function buildRefinedIsland(): IslandPart {
  const group = new THREE.Group();
  group.add(buildTerrain());

  const deco = new Mesher(0.1);
  const lights = new THREE.Group();
  group.add(lights);

  const ok = (x: number, z: number, extra: number) =>
    !nearLandmark(x, z, extra) && seNorm(x, z) < 8.6;

  // Trees: clustered on the back/sides only (never the camera-facing tip).
  const trees: [number, number, 'round' | 'pine', number][] = [
    [-7.5, -1.9, 'round', 1.0],
    [-6.9, -3.6, 'pine', 0.85],
    [-5.5, -6.7, 'pine', 1.1],
    [-2.7, -7.2, 'round', 0.9],
    [6.5, -5.6, 'pine', 1.0],
    [7.6, -3.5, 'round', 0.75],
    [-5.5, 5.6, 'round', 1.0],
    [-6.9, 4.0, 'pine', 0.85],
  ];
  for (const [x, z, kind, s] of trees) {
    if (!ok(x, z, 0.2)) continue;
    if (kind === 'pine') pineTree(deco, x, z, s);
    else roundTree(deco, x, z, s);
  }
  // Low decor: bushes / rocks / flowers, clustered with negative space.
  const bushes: [number, number, number][] = [
    [-3.9, 7.0, 1.0], [-4.5, 6.4, 0.7], [2.6, 7.4, 0.9], [7.4, 3.7, 0.9],
    [-4.4, -1.1, 0.8], [1.7, -3.1, 0.75], [-6.2, -2.6, 0.7], [5.4, -6.7, 0.8],
  ];
  for (const [x, z, s] of bushes) if (ok(x, z, 0.1)) bush(deco, x, z, s);
  const rockSpots: [number, number, number][] = [
    [6.9, 5.2, 1.0], [5.3, 6.9, 0.7], [-8.2, 0.0, 0.8], [8.3, 0.6, 0.9], [0.8, -8.3, 0.8],
    [-1.6, 8.4, 0.9], [7.0, -6.3, 0.6], [-7.6, -5.0, 0.7],
  ];
  rockSpots.forEach(([x, z, s], i) => { if (!nearLandmark(x, z, 0.1)) rocks(deco, x, z, s, i + 3); });
  const flowerSpots: [number, number, number][] = [
    [-6.6, -1.0, RP.pink], [-4.6, 5.0, RP.gold], [6.0, -4.9, RP.violet], [-2.0, -6.6, RP.coral],
    [3.4, 7.0, RP.pink], [7.3, 2.7, RP.gold],
  ];
  flowerSpots.forEach(([x, z, c], i) => { if (ok(x, z, 0)) flowers(deco, x, z, c, i * 13 + 5); });

  // Four post lanterns (the island's night lights; ≤4).
  const lanternMats: { mat: THREE.MeshToonMaterial; phase: number }[] = [];
  const nightLights: THREE.PointLight[] = [];
  const lanternSpots: [number, number][] = [[2.8, -2.4], [-3.0, 2.3], [2.1, 3.5], [6.2, 6.0]];
  lanternSpots.forEach(([x, z], i) => {
    const l = lantern(deco, lights, x, z);
    lanternMats.push({ mat: l.mat, phase: i * 1.7 });
    nightLights.push(l.light);
  });

  deco.to(group);

  // Fireflies — ONE instanced mesh, twinkle by size (no per-mote materials).
  const FF = 10;
  const ffMat = glowMat(RP.gold, 1.4);
  const ff = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), ffMat, FF);
  ff.userData.noShadow = true;
  ff.frustumCulled = false;
  group.add(ff);
  const ffData = Array.from({ length: FF }, (_, i) => ({
    cx: (rng(i, 1) - 0.5) * 12, cz: (rng(i, 2) - 0.5) * 12, cy: 1.2 + rng(i, 3) * 1.4,
    rx: 0.8 + rng(i, 4) * 1.4, rz: 0.8 + rng(i, 5) * 1.4,
    sx: 0.2 + rng(i, 6) * 0.3, sz: 0.18 + rng(i, 7) * 0.3, sy: 0.3 + rng(i, 8) * 0.4,
    ph: rng(i, 0) * TAU,
  }));
  const dummy = new THREE.Object3D();

  // Birds — white gulls wandering high around the island.
  interface Bird {
    grp: THREE.Group; wl: THREE.Object3D; wr: THREE.Object3D;
    a: number; r: number; y: number; spd: number; ph: number; flap: number;
  }
  const birds: Bird[] = [];
  for (let i = 0; i < 3; i++) {
    const grp = new THREE.Group();
    grp.userData.noShadow = true;
    const bm = new Mesher(0.1);
    bm.b(RP.white, 2, 1.5, 4, 0, 0, 0).b(RP.white, 1.5, 1.5, 1.5, 0, 0.5, 2.5).b(RP.gold, 1, 0.6, 1, 0, 0.3, 3.6, { flat: true });
    bm.to(grp);
    const wl = new THREE.Group();
    wl.position.set(-0.1, 0.05, 0);
    const wlm = new Mesher(0.1);
    wlm.b(RP.white, 4, 0.6, 2, -2, 0, 0).b(RP.ink, 1.5, 0.6, 2, -4.5, 0, 0);
    wlm.to(wl);
    const wr = new THREE.Group();
    wr.position.set(0.1, 0.05, 0);
    const wrm = new Mesher(0.1);
    wrm.b(RP.white, 4, 0.6, 2, 2, 0, 0).b(RP.ink, 1.5, 0.6, 2, 4.5, 0, 0);
    wrm.to(wr);
    grp.add(wl, wr);
    group.add(grp);
    birds.push({
      grp, wl, wr, a: i * 2.2, r: 9.5 + i * 0.9, y: 4.4 + i * 0.6,
      spd: 0.17 + i * 0.035, ph: rng(i, 21) * TAU, flap: 7 + rng(i, 22) * 2,
    });
  }
  const bP0 = new THREE.Vector3();
  const bP1 = new THREE.Vector3();
  const birdPos = (b: Bird, t: number, out: THREE.Vector3) => {
    const a = b.a + t * b.spd;
    const r = b.r + Math.sin(t * 0.07 + b.ph) * 1.2;
    out.set(Math.cos(a) * r, b.y + Math.sin(t * 0.2 + b.ph) * 0.8, Math.sin(a) * r);
    return out;
  };

  // Floating islets orbiting below the rim.
  const islets = [
    { m: islet(1.6, 1), a: 0.6, r: 13.2, y: -2.6 },
    { m: islet(1.1, 2), a: 2.9, r: 13.8, y: -4.2 },
    { m: islet(1.3, 3), a: 4.6, r: 12.8, y: -1.6 },
  ];
  for (const it of islets) group.add(it.m);

  const applyTod = (s: TodState) => {
    for (const l of lanternMats) l.mat.userData.night = s.star;
  };

  return {
    group,
    nightLights,
    applyTod,
    update: (t) => {
      for (const l of lanternMats) {
        const night = (l.mat.userData.night as number) ?? 0;
        l.mat.emissiveIntensity =
          (0.35 + 1.5 * night) * (1 + 0.1 * osc(t, 1.3, l.phase) + 0.05 * osc(t, 0.29, l.phase));
      }
      for (let i = 0; i < FF; i++) {
        const f = ffData[i];
        dummy.position.set(
          f.cx + Math.sin(t * f.sx + f.ph) * f.rx,
          f.cy + Math.sin(t * f.sy + f.ph * 1.7) * 0.5,
          f.cz + Math.cos(t * f.sz + f.ph) * f.rz,
        );
        dummy.scale.setScalar(0.06 + 0.07 * (0.5 + 0.5 * Math.sin(t * 3 + f.ph * 2)));
        dummy.updateMatrix();
        ff.setMatrixAt(i, dummy.matrix);
      }
      ff.instanceMatrix.needsUpdate = true;
      for (const b of birds) {
        birdPos(b, t, bP0);
        birdPos(b, t + 0.05, bP1);
        b.grp.position.copy(bP0);
        b.grp.rotation.y = -Math.atan2(bP1.z - bP0.z, bP1.x - bP0.x) + Math.PI / 2;
        b.grp.rotation.z = -0.25;
        const env = 0.5 + 0.5 * Math.sin(t * 0.6 + b.ph);
        const flap = Math.sin(t * b.flap + b.ph) * (0.1 + env * env * 0.55);
        b.wl.rotation.z = flap + 0.15 * (1 - env);
        b.wr.rotation.z = -flap - 0.15 * (1 - env);
      }
      for (const it of islets) {
        const a = it.a + t * 0.045;
        it.m.position.set(Math.cos(a) * it.r, it.y + osc(t, 6, it.a) * 0.35, Math.sin(a) * it.r);
        it.m.rotation.y = a * 1.3;
      }
    },
  };
}
