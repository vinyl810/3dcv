import * as THREE from 'three';
import { color, emit, TAU } from '../../kit';
import { GRASS_TOP, nearLandmark } from '../../layout';
import type { TodState } from '../../environment';
import type { IslandPart } from '../types';
import { K } from './palette';
import { piece, StaticBatch, type AssetName } from './assets';
import {
  grassR, beachR, rimInR, rimOutR, notch, ringStrip, patchy, hash,
  SEA_Y, RIM_Y, type Row,
} from './terrain';

const GY = GRASS_TOP;

/* ------------------------------------------------------------- terrain */

function buildTerrain(): THREE.Group {
  const g = new THREE.Group();
  const xz = (a: number, r: number): [number, number] => [Math.cos(a) * r, Math.sin(a) * r];

  // 1. Flat grass cap (polar grid, y = 0.5 everywhere) with soft colour patches.
  const RINGS = 12;
  const capRows: Row[] = [];
  for (let k = 0; k <= RINGS; k++) {
    const f = k / RINGS;
    capRows.push({ r: (a) => grassR(a) * f, y: () => GY });
  }
  const cap = ringStrip(capRows, (k, i, a) => {
    const [x, z] = xz(a + Math.PI / 120, grassR(a) * (k + 0.5) / RINGS);
    return patchy(x, z, K.grass, K.grassLight, K.grassDark, 1.7);
  });
  g.add(cap);

  // 2. Grass lip → sandy beach sloping under the lagoon.
  const lip: Row[] = [
    { r: (a) => grassR(a), y: () => GY },
    { r: (a) => grassR(a) + 0.12, y: () => GY - 0.2 },
    { r: (a) => grassR(a) + 0.22, y: () => GY - 0.32 },
    { r: (a) => beachR(a) - 0.25, y: () => SEA_Y + 0.1 },
    { r: (a) => beachR(a) + 0.35, y: () => SEA_Y - 0.35 },
    { r: (a) => rimInR(a) + 0.1, y: () => SEA_Y - 0.55 },
  ];
  g.add(
    ringStrip(lip, (k, i) => {
      if (k === 0) return color(K.grassDark);
      if (k === 1) return color(hash(i, 3) < 0.5 ? K.sandDark : K.earth);
      if (k === 2) return color(hash(i, 4) < 0.18 ? K.sandDark : K.sand);
      if (k === 3) return color(K.sandDark);
      return color(K.seaDeep);
    }),
  );

  // 3. Rock rim around the lagoon (dips at the waterfall notches) + the
  //    floating-rock underside tapering to a point.
  const rimH = (a: number, i: number) =>
    RIM_Y + 0.12 * hash(i, 9) - (RIM_Y - SEA_Y + 0.14) * notch(a);
  const rows: Row[] = [
    { r: (a) => rimInR(a) + 0.1, y: () => SEA_Y - 0.55 },
    { r: (a) => rimInR(a), y: (a, i) => rimH(a, i) - 0.05 },
    { r: (a) => rimInR(a) + 0.2, y: rimH },
    { r: (a) => rimOutR(a) - 0.1, y: rimH },
    { r: (a) => rimOutR(a), y: (a, i) => rimH(a, i) - 0.22 },
  ];
  // underside: radius factor + depth per row (deterministic jitter per vertex)
  const under: [number, number][] = [
    [1.0, -0.75], [0.96, -1.5], [0.88, -2.5], [0.76, -3.6], [0.6, -4.9],
    [0.43, -6.2], [0.27, -7.4], [0.12, -8.6], [0.0, -9.6],
  ];
  for (let k = 0; k < under.length; k++) {
    const [f, y] = under[k];
    rows.push({
      r: (a, i) => (rimOutR(a) + 0.05) * f * (1 + (hash(i + k * 131, 5) - 0.5) * 0.12),
      y: (a, i) => y + (hash(i + k * 71, 6) - 0.5) * 0.35 * (k > 0 ? 1 : 0.3),
    });
  }
  const strata = [K.rock, K.earth, K.rock, K.rockDeep, K.rock, K.rockDeep, K.rockDeeper, K.rockDeeper, K.rockDeeper];
  g.add(
    ringStrip(rows, (k, i, a) => {
      if (k <= 3) {
        // rim: mossy top, stone faces
        if (k === 2) return color(hash(i, 8) < 0.55 ? K.moss : K.grassDark);
        return color(notch(a) > 0.2 ? K.rockDeep : hash(i, 7) < 0.3 ? K.stoneDark : K.rock);
      }
      if (k === 4) return color(hash(i, 2) < 0.35 ? K.moss : K.rock); // mossy overhang
      const s = strata[Math.min(strata.length - 1, k - 5)];
      return color(hash(i + k * 17, 1) < 0.12 ? K.rockDeep : s);
    }),
  );
  return g;
}

/* --------------------------------------------------------------- decor */

interface Spot { x: number; z: number; r: number }

export function buildKitIsland(): IslandPart {
  const group = new THREE.Group();
  group.add(buildTerrain());

  const batch = new StaticBatch();
  const taken: Spot[] = [];
  const free = (x: number, z: number, r: number, lm = 0.15) => {
    if (nearLandmark(x, z, lm)) return false;
    const a = Math.atan2(z, x);
    if (Math.hypot(x, z) > grassR(a) - r - 0.15) return false;
    return !taken.some((s) => (s.x - x) ** 2 + (s.z - z) ** 2 < (s.r + r) ** 2);
  };
  const put = (name: AssetName, x: number, z: number, s: number, ry: number, r: number) => {
    batch.add(piece(name, { x, y: GY, z, s, ry }));
    taken.push({ x, z, r });
  };

  // ---- trees: frame the back + sides (camera looks from +X+Z), never the front tip
  const trees: [AssetName, number, number, number][] = [
    ['nature/tree_pineRoundA', -7.3, -6.6, 2.1],
    ['nature/tree_default', -5.0, -7.9, 1.75],
    ['nature/tree_oak', 6.6, -6.9, 1.9],
    ['nature/tree_pineRoundC', -8.0, -3.6, 1.9],
    ['nature/tree_fat', -7.6, 3.6, 1.8],
    ['nature/tree_detailed', -4.4, 7.4, 1.85],
    ['nature/tree_pineSmallA', 1.4, -8.0, 1.9],
    ['nature/tree_cone', -8.3, -0.9, 1.6],
    ['nature/tree_oak', 8.3, -3.6, 1.6],
    ['nature/tree_pineSmallA', -2.4, -8.4, 1.5],
    ['nature/tree_default', -6.2, 6.0, 1.4],
  ];
  trees.forEach(([n, x, z, s], i) => {
    if (!free(x, z, 0.5, 0)) return;
    put(n, x, z, s, hash(i, 11) * TAU, 0.55 * s * 0.6);
  });

  // ---- lanterns (real night lights on three of them)
  const nightLights: THREE.PointLight[] = [];
  const bulbs: THREE.MeshToonMaterial[] = [];
  const lanternSpots: [number, number][] = [[6.9, 5.4], [-3.3, -1.8], [2.6, -2.9], [4.4, 6.9]];
  lanternSpots.forEach(([x, z]) => {
    if (!free(x, z, 0.3, 0.05)) return;
    put('town/lantern', x, z, 1.15, Math.PI / 4, 0.4);
    const bulbMat = emit(K.amber, 0.4).clone();
    const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.14), bulbMat);
    bulb.position.set(x, GY + 1.39, z);
    group.add(bulb);
    bulbs.push(bulbMat);
    if (nightLights.length < 3) {
      const L = new THREE.PointLight(color(0xffc978), 0, 7.5, 1.6);
      L.position.set(x, GY + 1.35, z);
      L.userData.nightBase = 2.4;
      group.add(L);
      nightLights.push(L);
    }
  });

  // ---- a few hand-placed vignettes on the open lawn
  put('nature/log_stack', -2.9, 2.0, 1.4, 0.4, 0.5);
  put('nature/stump_round', -3.6, 2.6, 1.6, 0, 0.3);
  put('nature/campfire_stones', 3.0, -2.4, 1.2, 0, 0.4);
  put('nature/stone_tallA', 7.4, 3.3, 1.0, 0.6, 0.55);
  put('nature/stone_tallB', -1.8, -8.6, 0.9, 1.2, 0.5);
  put('nature/statue_obelisk', -3.2, -3.5, 1.1, 0.3, 0.3);
  put('town/rock-wide', 8.2, 0.6, 0.55, 1.0, 0.4);
  put('nature/pot_large', 1.9, 7.3, 1.2, 0, 0.35);

  // fence runs at the back edge
  for (let i = 0; i < 3; i++) put('nature/fence_simple', -2.3 + i * 1.0, -7.0, 1.0, 0, 0.3);

  // ---- deterministic scatter: bushes, flowers, grass, mushrooms, rocks
  const FILL: [AssetName, number, number][] = [
    ['nature/plant_bushDetailed', 1.5, 0.35],
    ['nature/plant_bushLarge', 1.6, 0.3],
    ['nature/plant_bush', 1.5, 0.3],
    ['nature/plant_bushSmall', 1.5, 0.28],
    ['nature/flower_yellowA', 1.6, 0.18],
    ['nature/flower_redA', 1.6, 0.18],
    ['nature/flower_purpleA', 1.6, 0.18],
    ['nature/flower_purpleB', 1.6, 0.18],
    ['nature/grass_large', 1.5, 0.2],
    ['nature/grass', 1.5, 0.2],
    ['nature/grass', 1.4, 0.2],
    ['nature/mushroom_redGroup', 1.4, 0.2],
    ['nature/mushroom_tanGroup', 1.4, 0.2],
    ['nature/stone_smallC', 1.4, 0.28],
    ['nature/plant_bushDetailed', 1.3, 0.3],
  ];
  let n = 0;
  for (let i = 0; i < 260 && n < 70; i++) {
    const a = hash(i, 21) * TAU;
    const rr = Math.sqrt(hash(i, 22)) * (grassR(a) - 0.4);
    const x = Math.cos(a) * rr;
    const z = Math.sin(a) * rr;
    const [name, s, r] = FILL[Math.floor(hash(i, 23) * FILL.length)];
    if (!free(x, z, r)) continue;
    put(name, x, z, s * (0.85 + hash(i, 24) * 0.35), hash(i, 25) * TAU, r);
    n++;
    // flowers come in little clusters
    if (name.includes('flower') || name.includes('grass')) {
      for (let k = 0; k < 2; k++) {
        const x2 = x + (hash(i * 3 + k, 26) - 0.5) * 0.8;
        const z2 = z + (hash(i * 3 + k, 27) - 0.5) * 0.8;
        if (free(x2, z2, 0.12)) put(name, x2, z2, s * 0.85, hash(i + k, 28) * TAU, 0.12);
      }
    }
  }

  // ---- beach: pebbles + lily pads in the lagoon
  for (let i = 0; i < 18; i++) {
    const a = hash(i, 31) * TAU;
    const r = grassR(a) + 0.45 + hash(i, 32) * 0.3;
    batch.add(piece(hash(i, 33) < 0.5 ? 'nature/stone_smallC' : 'nature/stone_smallA', {
      x: Math.cos(a) * r, y: SEA_Y + 0.05, z: Math.sin(a) * r, s: 0.9 + hash(i, 34), ry: hash(i, 35) * TAU,
    }));
  }
  for (let i = 0; i < 9; i++) {
    const a = hash(i, 41) * TAU;
    if (notch(a) > 0) continue;
    const r = (beachR(a) + rimInR(a)) / 2 + (hash(i, 42) - 0.5) * 0.4;
    batch.add(piece('nature/lily_large', {
      x: Math.cos(a) * r, y: SEA_Y - 0.02, z: Math.sin(a) * r, s: 1.6, ry: hash(i, 43) * TAU,
    }));
  }
  // rim boulders (break up the ring)
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU + hash(i, 51) * 0.3;
    if (notch(a) > 0) continue;
    const r = (rimInR(a) + rimOutR(a)) / 2;
    batch.add(piece(hash(i, 52) < 0.5 ? 'nature/stone_smallA' : 'nature/stone_smallC', {
      x: Math.cos(a) * r, y: RIM_Y - 0.03, z: Math.sin(a) * r, s: 1.0 + hash(i, 53) * 0.8, ry: hash(i, 54) * TAU,
    }));
  }
  // hanging moss under the grassy overhang
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * TAU + hash(i, 61) * 0.1;
    if (notch(a) > 0) continue;
    const r = rimOutR(a) - 0.02;
    const m = piece('nature/hanging_moss', { raw: true, s: 1.4 + hash(i, 62), x: Math.cos(a) * r, y: -1.15, z: Math.sin(a) * r });
    m.rotation.y = -a + Math.PI / 2;
    batch.add(m);
  }

  group.add(batch.build());

  // ---- floating rock chunks drifting under the island (animated)
  const chunks: { o: THREE.Object3D; y: number; ph: number }[] = [];
  const chunkSpots: [number, number, number, number][] = [
    [11.8, -4.0, -2.2, 0.9], [-6.0, 11.2, -3.4, 0.7], [9.0, 9.0, -6.8, 0.55], [-11.5, -3.0, -5.2, 0.6],
  ];
  chunkSpots.forEach(([x, z, y, s], i) => {
    const c = new THREE.Group();
    const rock = piece('nature/stone_tallB', { s, sy: -0.9 });
    rock.position.y = 0.05;
    c.add(rock);
    c.add(piece('nature/plant_bushSmall', { s: s * 2.2, y: 0.02 }));
    c.position.set(x, y, z);
    c.rotation.y = hash(i, 71) * TAU;
    c.userData.noShadow = true;
    group.add(c);
    chunks.push({ o: c, y, ph: hash(i, 72) * TAU });
  });

  // ---- fireflies (one instanced draw) — mostly out at dusk / night
  const FF = 18;
  const ffMat = emit(K.gold, 1.4).clone();
  const ff = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), ffMat, FF);
  ff.userData.noShadow = true;
  ff.frustumCulled = false;
  group.add(ff);
  const ffData = Array.from({ length: FF }, (_, i) => ({
    cx: (hash(i, 81) - 0.5) * 12, cz: (hash(i, 82) - 0.5) * 12, cy: GY + 0.8 + hash(i, 83) * 1.4,
    rx: 0.6 + hash(i, 84) * 1.4, sp: 0.15 + hash(i, 85) * 0.25, ph: hash(i, 86) * TAU,
  }));
  const dummy = new THREE.Object3D();
  let star = 0;

  const applyTod = (s: TodState) => {
    star = s.star;
    for (const b of bulbs) b.emissiveIntensity = 0.35 + 1.9 * s.star;
  };

  return {
    group,
    nightLights,
    applyTod,
    update: (t) => {
      for (const c of chunks) {
        c.o.position.y = c.y + Math.sin(t * 0.6 + c.ph) * 0.18;
        c.o.rotation.y += 0.0015;
      }
      const vis = 0.35 + 0.65 * star;
      for (let i = 0; i < FF; i++) {
        const d = ffData[i];
        const a = t * d.sp + d.ph;
        const tw = 0.5 + 0.5 * Math.sin(t * 3.1 + d.ph * 3);
        dummy.position.set(d.cx + Math.cos(a) * d.rx, d.cy + Math.sin(a * 1.7) * 0.3, d.cz + Math.sin(a) * d.rx);
        dummy.scale.setScalar(vis * (0.4 + 0.6 * tw));
        dummy.updateMatrix();
        ff.setMatrixAt(i, dummy.matrix);
      }
      ff.instanceMatrix.needsUpdate = true;
    },
  };
}
