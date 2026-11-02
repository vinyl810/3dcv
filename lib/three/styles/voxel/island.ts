import * as THREE from 'three';
import { color, osc, TAU } from '../../kit';
import type { TodState } from '../../environment';
import { LANDMARK_LAYOUT, nearLandmark } from '../../layout';
import type { IslandPart } from '../types';
import { C } from './palette';
import { Grid, V, hash3, noise2, meshGrid, glowMat } from './vox';
import { norm, rGrass, rSand, rRim, rOuter, fallAt, rockRadius } from './shape';

/**
 * Voxel terrain + decor. The whole static island (terrain, trees, bushes,
 * rocks, flowers, lantern posts) is stamped into ONE world-space grid and
 * meshed into a single lit mesh, so the island costs ~1 draw call. Animated
 * bits (lantern glass, crystals, fireflies, birds, floating chunks) are small
 * separate meshes.
 *
 * World voxel (i, j, k) occupies x∈[i-½,i+½]·V, y∈[j, j+1]·V, z∈[k-½,k+½]·V.
 * The grass top layer is j = 3 → its top face sits at exactly y = 0.5.
 */

const GJ = 3; // grass top voxel layer (top face = 0.5)
const BASE = GJ + 1; // first voxel above the grass

export function buildVoxelIsland(): IslandPart {
  const group = new THREE.Group();
  const R = 92;
  const g = new Grid(-R, R, -102, 34, -R, R);

  /* --------------------------------------------------------- palette ---- */
  const grass = [g.c(C.grassDark, 0), g.c(C.grass, 0), g.c(C.grassLight, 0)];
  const path = g.c(0xc9ad80, 0);
  const pathEdge = g.c(0xa99067, 0);
  const sand = g.c(C.sand, 0);
  const sandD = g.c(C.sandDark, 0);
  const floor = g.c(0x8f7a5c, 0);
  const rock = g.c(C.rock, 0);
  const rockD = g.c(C.rockDark, 0);
  const rockL = g.c(C.rockLight, 0);
  const dirt = g.c(C.dirt, 0);
  const dirtD = g.c(C.dirtDark, 0);
  const moss = g.c(C.moss, 0);
  const mossL = g.c(C.grassDark, 0);

  /* ----------------------------------------------- paths (hub → spokes) */
  const hub = LANDMARK_LAYOUT[0];
  const segs = LANDMARK_LAYOUT.filter((L) => L.id !== 'about').map((L) => [hub.pos[0], hub.pos[1], L.pos[0], L.pos[1]]);
  const pathDist = (x: number, z: number) => {
    let best = 1e9;
    for (const [ax, az, bx, bz] of segs) {
      const dx = bx - ax, dz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
      const d = Math.hypot(x - ax - dx * t, z - az - dz * t);
      if (d < best) best = d;
    }
    return best;
  };

  /* --------------------------------------------------------- terrain ---- */
  for (let k = -R; k <= R; k++) {
    for (let i = -R; i <= R; i++) {
      const x = i * V, z = k * V;
      const d = norm(x, z);
      const ro = rOuter(x, z);
      if (d >= ro + 0.05) continue;
      const rg = rGrass(x, z), rs = rSand(x, z), rr = rRim(x, z);
      const fall = fallAt(x, z) >= 0;

      // ---- surface layers ----
      let top: number;
      if (d < rg) {
        top = GJ;
        // clumped tonal variation (low-frequency), not per-voxel noise
        const n = noise2(x * 0.55, z * 0.55, 11) + (hash3(i, 0, k, 3) - 0.5) * 0.18;
        let c = n < 0.36 ? grass[0] : n > 0.66 ? grass[2] : grass[1];
        const pd = pathDist(x, z);
        if (pd < 0.2) c = path;
        else if (pd < 0.3 && hash3(i, 1, k, 5) < 0.55) c = pathEdge;
        g.set(i, GJ, k, c);
        g.box(i, -1, k, i, GJ - 1, k, dirt);
        g.set(i, GJ - 1, k, d > rg - 0.3 ? mossL : dirt); // grass edge shows 2 layers of green
      } else if (d < rs) {
        top = d < (rg + rs) / 2 ? 2 : 1;
        g.box(i, -1, k, i, top, k, sand);
        if (hash3(i, 2, k, 7) < 0.08) g.set(i, top, k, sandD);
      } else if (d < rr || fall) {
        top = -1; // moat floor (the water layer lives in ocean.ts at j = 0)
        g.set(i, -1, k, floor);
      } else {
        top = 1; // rock rim lip
        g.box(i, -1, k, i, 1, k, rock);
        const m = noise2(x * 0.9, z * 0.9, 21);
        if (m > 0.55) g.set(i, 1, k, m > 0.7 ? mossL : moss);
        if (hash3(i, 3, k, 9) < 0.04) g.set(i, 2, k, rockL); // pebbles
      }
      void top;

      // ---- floating rock below (stepped taper with per-band wobble) ----
      for (let j = -2; j >= -102; j--) {
        const depth = (-1 - j) * V;
        const band = Math.floor(j / 3);
        const kk = ro + 0.55 * (noise2(x * 0.5 + band * 3.1, z * 0.5, 31) - 0.5) - 0.15;
        if (d >= rockRadius(depth, kk)) break;
        // strata: rock near the top, earthy bands deeper
        const sb = Math.floor((j + noise2(x * 0.6, z * 0.6, 41) * 3) / 4);
        let c: number;
        if (j > -9) c = sb % 2 === 0 ? rock : rockD;
        else c = [dirt, rockD, dirtD, rock][((sb % 4) + 4) % 4];
        if (hash3(i, j, k, 13) < 0.05) c = rockL;
        g.set(i, j, k, c);
      }
    }
  }

  // Exposed ledge tops on the underside become moss; hanging moss strips drip
  // down the outer cliff from mossy rim patches.
  for (let k = -R; k <= R; k++)
    for (let i = -R; i <= R; i++)
      for (let j = -102; j <= -3; j++) {
        const v = g.get(i, j, k);
        if (!v || g.get(i, j + 1, k)) continue;
        g.set(i, j, k, hash3(i, j, k, 17) < 0.7 ? moss : mossL);
      }
  for (let k = -R; k <= R; k++)
    for (let i = -R; i <= R; i++) {
      const x = i * V, z = k * V;
      const top = g.get(i, 1, k);
      if (top !== moss && top !== mossL) continue;
      // outermost column? (an outward neighbour is empty at the lip)
      const outward = !g.get(i + Math.sign(i), 0, k) || !g.get(i, 0, k + Math.sign(k));
      if (!outward || hash3(i, 0, k, 23) > 0.45) continue;
      const len = 2 + Math.floor(hash3(i, 1, k, 29) * 9);
      for (let j = 0; j >= -len; j--) if (g.get(i, j, k)) g.set(i, j, k, j === -len ? mossL : moss);
      void x; void z;
    }

  /* --------------------------------------------------------- decor ------ */
  const glowG = new Grid(-70, 70, BASE, BASE + 14, -70, 70); // lantern glass
  const gemG = new Grid(-70, 70, BASE, BASE + 10, -70, 70); // crystals
  const amber = glowG.g(C.amber);
  const blockers: [number, number, number][] = [];
  const blocked = (x: number, z: number, r: number) =>
    nearLandmark(x, z, r) || blockers.some(([bx, bz, br]) => (x - bx) ** 2 + (z - bz) ** 2 < (br + r) ** 2) || pathDist(x, z) < 0.35 + r * 0.3;
  const onGrass = (x: number, z: number, m: number) => norm(x, z) < rGrass(x, z) - m;

  const trunk = g.c(C.woodDark, 0.05);
  const trunkL = g.c(C.wood, 0.05);
  const pine = g.c(C.pine, 0.05);
  const pineL = g.c(C.pineLight, 0.05);
  const leaf = g.c(C.leaf, 0.05);
  const leafL = g.c(C.leafLight, 0.05);
  const leafD = g.c(C.leafDark, 0.05);
  const slate = g.c(C.slate, 0.04);
  const stem = g.c(C.moss, 0.04);
  const white = g.c(C.white, 0.03);

  function pineTree(i: number, k: number, sc: number) {
    const h = Math.round(5 * sc);
    g.box(i - 1, BASE, k - 1, i, BASE + h, k, trunk);
    let y = BASE + h - 1;
    const tiers = [6, 5, 4, 3, 2].map((r) => Math.max(1, Math.round(r * sc)));
    for (let t = 0; t < tiers.length; t++) {
      const r = tiers[t];
      for (let dy = 0; dy < 3; dy++) {
        const rr = r - dy * 0.7;
        for (let dz = -Math.ceil(rr); dz <= Math.ceil(rr); dz++)
          for (let dx = -Math.ceil(rr); dx <= Math.ceil(rr); dx++) {
            if (Math.abs(dx + 0.5) + Math.abs(dz + 0.5) > rr * 1.25) continue;
            const edge = dy === 2 || hash3(i + dx, y + dy, k + dz, 31) < 0.15;
            g.set(i + dx, y + dy, k + dz, edge ? pineL : pine);
          }
      }
      y += 3;
    }
    g.set(i, y, k, pineL).set(i - 1, y, k, pineL);
  }
  function roundTree(i: number, k: number, sc: number) {
    const h = Math.round(7 * sc);
    g.box(i - 1, BASE, k - 1, i, BASE + h, k, trunk);
    g.set(i + 1, BASE, k, trunkL).set(i - 2, BASE, k - 1, trunkL); // roots
    const cy = BASE + h + Math.round(4 * sc);
    const r = 5.2 * sc;
    g.ellipsoid(i - 0.5, cy, k - 0.5, r, r * 0.85, r, leaf, 0.35, i * 7 + k);
    g.ellipsoid(i + 1.5, cy + 2, k - 1.5, r * 0.6, r * 0.55, r * 0.6, leafL, 0.3, k);
    // top-lit shading: upper exposed voxels lighter, underside darker
    for (let y = cy - Math.ceil(r); y <= cy + Math.ceil(r); y++)
      for (let z = k - 8; z <= k + 8; z++)
        for (let x = i - 8; x <= i + 8; x++) {
          const v = g.get(x, y, z);
          if (v !== leaf && v !== leafL) continue;
          if (!g.get(x, y + 1, z) && y > cy) g.set(x, y, z, leafL);
          else if (!g.get(x, y - 1, z)) g.set(x, y, z, leafD);
        }
    // a couple of fruit
    g.set(i + 3, cy, k + 3, g.c(C.red, 0.03)).set(i - 3, cy + 1, k + 2, g.c(C.red, 0.03));
  }
  function bush(i: number, k: number, sc: number, seed: number) {
    g.ellipsoid(i, BASE, k, 3 * sc, 2.4 * sc, 2.6 * sc, leafD, 0.4, seed);
    g.ellipsoid(i + 1, BASE + 1, k - 1, 2 * sc, 1.8 * sc, 2 * sc, leaf, 0.4, seed + 1);
    if (seed % 2 === 0) {
      const berry = g.c(seed % 4 === 0 ? C.pink : C.amber, 0.03);
      g.set(i + 2, BASE + 2, k + 1, berry).set(i - 1, BASE + 2, k + 2, berry);
    }
  }
  function boulder(i: number, k: number, sc: number, seed: number) {
    g.ellipsoid(i, BASE - 0.5, k, 2.6 * sc, 2.2 * sc, 2.2 * sc, rock, 0.5, seed);
    g.ellipsoid(i + 2, BASE - 0.5, k + 1, 1.5 * sc, 1.3 * sc, 1.5 * sc, rockD, 0.5, seed + 3);
    for (let z = k - 4; z <= k + 4; z++)
      for (let x = i - 4; x <= i + 4; x++) {
        const y = g.top(x, z);
        if (y >= BASE && g.get(x, y, z) === rock && hash3(x, y, z, seed) < 0.35) g.set(x, y, z, moss);
      }
  }
  function flowers(i: number, k: number, hex: number, seed: number) {
    const pet = g.c(hex, 0.04);
    const ctr = g.c(C.gold, 0.03);
    for (let n = 0; n < 4; n++) {
      const x = i + Math.round((hash3(seed, n, 1) - 0.5) * 6);
      const z = k + Math.round((hash3(seed, n, 2) - 0.5) * 6);
      const h = 1 + Math.floor(hash3(seed, n, 3) * 2);
      g.box(x, BASE, z, x, BASE + h - 1, z, stem);
      g.set(x, BASE + h, z, ctr).set(x + 1, BASE + h, z, pet).set(x - 1, BASE + h, z, pet)
        .set(x, BASE + h, z + 1, pet).set(x, BASE + h, z - 1, pet);
    }
  }
  function mushroom(i: number, k: number, hex: number) {
    const cap = g.c(hex, 0.04);
    g.box(i, BASE, k, i, BASE + 1, k, white);
    g.box(i - 1, BASE + 2, k - 1, i + 1, BASE + 2, k + 1, cap).set(i, BASE + 3, k, cap);
    g.set(i + 1, BASE + 2, k + 1, white);
    g.box(i + 3, BASE, k + 1, i + 3, BASE, k + 1, white).set(i + 3, BASE + 1, k + 1, cap);
  }
  function tuft(i: number, k: number, seed: number) {
    const c = hash3(seed, 0, 0) < 0.5 ? leafL : mossL;
    g.set(i, BASE, k, c).set(i + 1, BASE, k, c).set(i, BASE + 1, k, c).set(i - 1, BASE, k + 1, c);
  }
  const lanternLights: THREE.PointLight[] = [];
  function lantern(i: number, k: number, withLight: boolean) {
    g.box(i - 1, BASE, k - 1, i + 1, BASE, k + 1, slate);
    g.box(i, BASE + 1, k, i, BASE + 6, k, slate);
    g.box(i - 1, BASE + 7, k - 1, i + 1, BASE + 7, k + 1, slate);
    glowG.box(i - 1, BASE + 8, k - 1, i + 1, BASE + 9, k + 1, amber);
    g.box(i - 1, BASE + 10, k - 1, i + 1, BASE + 10, k + 1, slate);
    g.set(i, BASE + 11, k, slate);
    if (withLight) {
      const L = new THREE.PointLight(color(0xffca7a), 0, 7, 1.7);
      L.position.set(i * V, (BASE + 9) * V, k * V);
      L.userData.nightBase = 2.6;
      group.add(L);
      lanternLights.push(L);
    }
  }
  function crystal(i: number, k: number, hex: number) {
    const gem = gemG.g(hex, 0.05);
    g.box(i - 1, BASE, k - 1, i + 1, BASE, k + 1, rockD);
    gemG.box(i, BASE + 1, k, i, BASE + 5, k, gem).set(i + 1, BASE + 1, k, gem).set(i + 1, BASE + 2, k, gem);
    gemG.box(i - 1, BASE + 1, k + 1, i - 1, BASE + 3, k + 1, gem);
  }

  // Trees frame the back/sides (never the camera-facing +x+z tip).
  const trees: [number, number, number, 'pine' | 'round'][] = [
    [-6.5, -6.6, 1.15, 'pine'], [6.3, -6.5, 1.0, 'round'], [-6.6, 6.2, 1.0, 'round'],
    [-7.3, -1.9, 0.95, 'pine'], [1.6, -7.2, 0.9, 'pine'], [-3.2, 7.1, 0.85, 'round'],
    [-7.3, 3.7, 0.8, 'pine'], [-4.6, -7.2, 0.75, 'pine'], [7.2, -4.0, 0.8, 'pine'],
    [-2.6, -7.3, 0.7, 'round'], [7.3, -2.2, 0.65, 'round'], [-7.4, 5.0, 0.6, 'pine'],
  ];
  for (const [x, z, sc, kind] of trees) {
    if (!onGrass(x, z, 0.25) || nearLandmark(x, z, -0.3)) continue;
    const i = Math.round(x / V), k = Math.round(z / V);
    if (kind === 'pine') pineTree(i, k, sc); else roundTree(i, k, sc);
    blockers.push([x, z, 0.85 * sc]);
  }

  const lanternSpots: [number, number][] = [[6.3, 6.3], [2.9, 5.9], [5.9, 2.9], [-3.4, -1.8], [-3.3, 2.6]];
  for (const [x, z] of lanternSpots) {
    if (!onGrass(x, z, 0.4) || nearLandmark(x, z, 0.1)) continue;
    lantern(Math.round(x / V), Math.round(z / V), lanternLights.length < 3);
    blockers.push([x, z, 0.5]);
  }

  const FLOWER = [C.pink, C.amber, C.violet, C.white, C.coral];
  const CAP = [C.red, C.magenta, C.amber];
  const GEM = [C.cyan, C.violet, C.pink];
  let idx = 0;
  for (let gx = -6.6; gx <= 6.6; gx += 1.55) {
    for (let gz = -6.6; gz <= 6.6; gz += 1.55) {
      idx++;
      const x = gx + (hash3(idx, 1, 0) - 0.5) * 1.1;
      const z = gz + (hash3(idx, 2, 0) - 0.5) * 1.1;
      if (!onGrass(x, z, 0.45) || blocked(x, z, 0.35)) continue;
      if (hash3(idx, 3, 0) < 0.3) continue; // breathing room
      const i = Math.round(x / V), k = Math.round(z / V);
      const pick = hash3(idx, 4, 0);
      if (pick < 0.3) flowers(i, k, FLOWER[idx % FLOWER.length], idx);
      else if (pick < 0.5) bush(i, k, 0.9 + hash3(idx, 5, 0) * 0.4, idx);
      else if (pick < 0.64) boulder(i, k, 0.8 + hash3(idx, 6, 0) * 0.5, idx);
      else if (pick < 0.78) mushroom(i, k, CAP[idx % CAP.length]);
      else if (pick < 0.88) crystal(i, k, GEM[idx % GEM.length]);
      else tuft(i, k, idx);
      blockers.push([x, z, 0.55]);
    }
  }
  // sparse grass tufts as close-up grain
  for (let n = 0; n < 60; n++) {
    const x = (hash3(n, 7, 1) - 0.5) * 14.6;
    const z = (hash3(n, 7, 2) - 0.5) * 14.6;
    if (!onGrass(x, z, 0.2) || blocked(x, z, 0.05)) continue;
    tuft(Math.round(x / V), Math.round(z / V), n);
  }
  // pebbles on the beach
  for (let n = 0; n < 50; n++) {
    const a = hash3(n, 9, 1) * TAU;
    const x0 = Math.cos(a) * 9, z0 = Math.sin(a) * 9;
    // walk outward to the beach band
    const s = (rGrass(x0, z0) + rSand(x0, z0)) / 2 / norm(x0, z0);
    const i = Math.round((x0 * s) / V), k = Math.round((z0 * s) / V);
    const y = g.top(i, k);
    if (y < 1) continue;
    g.set(i, y + 1, k, hash3(n, 9, 2) < 0.5 ? rockL : sandD);
  }

  // The camera always looks from +X+Y+Z, so below the surface the -Y, -X and
  // -Z faces are never seen; they'd only feed the shadow map with shadows cast
  // onto empty sky. Dropping them cuts the terrain's triangles by ~1/3.
  const terrain = meshGrid(g, { faces: (_x, y, _z, f) => y > 1 || (f !== 3 && (y >= 0 || (f !== 1 && f !== 5))) });
  group.add(terrain.group);
  const lanternPart = meshGrid(glowG, { glow: 0.4 });
  group.add(lanternPart.group);
  const gemPart = meshGrid(gemG, { glow: 0.8 });
  group.add(gemPart.group);

  /* --------------------------------------------------------- fireflies -- */
  const ffG = new Grid(0, 0, 0, 0, 0, 0);
  ffG.set(0, 0, 0, ffG.g(C.gold));
  const ffGeo = meshGrid(ffG, { pivot: [0, 0.5, 0] }).glow!.geometry;
  const ffMat = glowMat(1.3);
  const FF = 16;
  const fireflies = new THREE.InstancedMesh(ffGeo, ffMat, FF);
  fireflies.userData.noShadow = true;
  fireflies.frustumCulled = false;
  const ffData: number[][] = [];
  for (let n = 0; n < FF; n++) {
    ffData.push([
      (hash3(n, 1, 77) - 0.5) * 11, (hash3(n, 2, 77) - 0.5) * 11, 1.1 + hash3(n, 3, 77) * 1.5,
      0.8 + hash3(n, 4, 77) * 1.5, 0.2 + hash3(n, 5, 77) * 0.3, hash3(n, 6, 77) * TAU,
    ]);
  }
  group.add(fireflies);

  /* --------------------------------------------------------- birds ------ */
  interface Bird { grp: THREE.Group; wl: THREE.Object3D; wr: THREE.Object3D; a: number; r: number; y: number; spd: number; ph: number }
  const birds: Bird[] = [];
  const bodyG = new Grid(-2, 2, -1, 1, -2, 3);
  const bc = bodyG.c(C.white, 0.02), bd = bodyG.c(C.slate, 0.02), bk = bodyG.c(C.amber, 0.02);
  bodyG.box(0, 0, -2, 0, 0, 2, bc).set(0, 1, 2, bc).set(0, 1, 3, bk).set(0, 0, -2, bd);
  const wingG = new Grid(0, 4, 0, 0, -1, 1);
  const wc = wingG.c(C.white, 0.02), wd = wingG.c(C.steel, 0.02);
  wingG.box(1, 0, -1, 3, 0, 1, wc).set(4, 0, 0, wd).set(4, 0, -1, wd);
  for (let n = 0; n < 3; n++) {
    const grp = new THREE.Group();
    grp.userData.noShadow = true;
    grp.add(meshGrid(bodyG).group);
    const wr = meshGrid(wingG, { pivot: [0.5, 0, 0] }).group;
    wr.position.set(0, 0.5 * V, 0);
    const wlInner = meshGrid(wingG, { pivot: [0.5, 0, 0] }).group;
    const wl = new THREE.Group();
    wl.scale.x = -1;
    wl.position.set(0, 0.5 * V, 0);
    wlInner.position.set(0, 0, 0);
    wl.add(wlInner);
    grp.add(wr, wl);
    group.add(grp);
    birds.push({ grp, wl: wlInner, wr, a: n * 2.2, r: 9.5 + n * 0.9, y: 4.2 + n * 0.7, spd: 0.17 + n * 0.03, ph: hash3(n, 0, 5) * TAU });
  }

  /* --------------------------------------------------------- chunks ----- */
  const chunks: { obj: THREE.Object3D; a: number; r: number; y: number }[] = [];
  [[0.3, 13.2, -3.2, 1.0], [2.4, 14, -5.2, 0.7], [4.4, 12.6, -1.6, 0.85]].forEach(([a, r, y, sc], n) => {
    const cg = new Grid(-8, 8, -10, 3, -8, 8);
    const rc = cg.c(C.rock, 0.05), rd = cg.c(C.dirt, 0.05), gc = cg.c(C.grass, 0.04);
    for (let j = 1; j >= -10; j--) {
      const rad = (5.5 * sc) * (1 - Math.max(0, -j) / (10 * sc + 0.01)) ** 0.9;
      for (let k = -8; k <= 8; k++)
        for (let i = -8; i <= 8; i++)
          if (i * i + k * k < rad * rad * (0.8 + hash3(i, j >> 1, k, n) * 0.4)) cg.set(i, j, k, j === 1 ? gc : j > -2 ? rd : rc);
    }
    const part = meshGrid(cg);
    group.add(part.group);
    chunks.push({ obj: part.group, a, r, y });
  });

  /* --------------------------------------------------------- animate ---- */
  const m4 = new THREE.Matrix4();
  let star = 0;
  const lanternMat = lanternPart.glowMat!;
  const gemMat = gemPart.glowMat!;

  return {
    group,
    nightLights: lanternLights,
    applyTod: (s: TodState) => { star = s.star; },
    update: (t) => {
      lanternMat.emissiveIntensity = (0.35 + 1.35 * star) * (1 + 0.07 * osc(t, 0.5) + 0.04 * osc(t, 0.17));
      gemMat.emissiveIntensity = 0.6 + 0.35 * (0.5 + 0.5 * osc(t, 2.4));
      for (let n = 0; n < FF; n++) {
        const [cx, cz, cy, rr, sp, ph] = ffData[n];
        const tw = 0.5 + 0.5 * Math.sin(t * 3 + ph * 2);
        const sc = 0.35 + 0.65 * tw * (0.4 + 0.6 * star);
        m4.makeScale(sc, sc, sc);
        m4.setPosition(cx + Math.sin(t * sp + ph) * rr, cy + Math.sin(t * sp * 1.6 + ph) * 0.4, cz + Math.cos(t * sp * 0.9 + ph) * rr);
        fireflies.setMatrixAt(n, m4);
      }
      fireflies.instanceMatrix.needsUpdate = true;
      for (const b of birds) {
        const a = b.a + t * b.spd;
        const r = b.r + Math.sin(t * 0.07 + b.ph) * 1.2;
        b.grp.position.set(Math.cos(a) * r, b.y + Math.sin(t * 0.2 + b.ph) * 0.8, Math.sin(a) * r);
        b.grp.rotation.y = -a; // nose (+z) along the CCW tangent
        b.grp.rotation.z = -0.25;
        const env = 0.5 + 0.5 * Math.sin(t * 0.6 + b.ph);
        const flap = Math.sin(t * 9 + b.ph) * (0.15 + env * env * 0.6) + 0.15 * (1 - env);
        b.wr.rotation.z = flap;
        b.wl.rotation.z = flap;
      }
      for (const c of chunks) {
        const a = c.a + t * 0.04;
        c.obj.position.set(Math.cos(a) * c.r, c.y + osc(t, 5, c.a) * 0.35, Math.sin(a) * c.r);
        c.obj.rotation.y = a * 1.3;
      }
    },
  };
}
