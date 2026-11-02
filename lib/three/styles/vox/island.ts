import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { IslandPart } from '../types';
import { GRASS_TOP, nearLandmark } from '../../layout';
import { VOXEL, instantiate, voxAsset, voxPartGeometries } from './assets';
import { voxEmitMaterial, voxLitMaterial } from './voxfile';

/**
 * Terrain (island.vox minus its lagoon `water` part, which the ocean owns) and
 * all decor. Static props from decor.vox / cc0trees.vox are MERGED into one lit
 * mesh (+ one mesh per glow colour) → a handful of draw calls for the whole
 * garden. Animated extras: floating islets, a small flock, fireflies.
 */

type Spot = [model: string, part: string, x: number, z: number, rot?: number, y?: number];

// Hand-placed (deterministic) — tall things at the back/sides, low things in front.
const SPOTS: Spot[] = [
  // trees
  ['cc0trees', 'oak', -6.5, 5.2, 1],
  ['cc0trees', 'pine_tall', -7.1, -1.5, 0], // back-left; the right corner stays low so awards' step 3 shows
  ['decor', 'bush', 6.4, -6.2, 0],
  ['decor', 'pine', -6.2, -7.1, 1],
  ['decor', 'tree_round', -3.4, 6.9, 0],
  ['decor', 'tree_round', -2.6, -7.2, 2],
  ['decor', 'tree_blossom', -4.4, -7.1, 1], // moved: it hid the awards podium's step 3
  ['decor', 'bush', 7.1, -3.6, 1],
  ['decor', 'bush', 1.2, 7.2, 3],
  // lamps (the street lamp + lanterns are real night lights)
  // lamps kept clear of the landmarks' camera-facing fronts (work chart, projects bulb)
  ['decor', 'streetlamp', -7.2, -5.0, 0], // tall: back-left edge, behind everything
  ['decor', 'lantern', 6.4, 6.4, 0], // short: front corner, too low to cover the work chart
  ['decor', 'lantern', -3.8, -0.9, 0],
  ['decor', 'lantern', 1.8, -2.9, 0],
  // shrubs, rocks, flowers, mushrooms
  ['decor', 'bush', -4.4, 3.3, 0],
  ['decor', 'bush_berry', 3.6, 6.6, 1],
  ['decor', 'bush_berry', -1.4, -3.4, 2],
  ['decor', 'bush', 4.6, -7.2, 0],
  ['decor', 'rock_big', 5.5, -3.6, 1],
  ['decor', 'rock_small', -2.9, -4.9, 0],
  ['decor', 'rock_big', -6.6, 6.9, 2],
  ['decor', 'rock_small', 2.6, 4.6, 3],
  ['decor', 'flowers_pink', -3.0, -1.4, 0],
  ['decor', 'flowers_gold', 4.8, 5.4, 1],
  ['decor', 'flowers_violet', 0.7, -3.3, 2],
  ['decor', 'flowers_pink', 7.1, -5.6, 0],
  ['decor', 'flowers_gold', -6.9, 3.2, 3],
  ['decor', 'flowers_violet', -0.4, 7.2, 0],
  ['decor', 'mushrooms', 5.2, 7.0, 1],
  ['decor', 'sign', 1.9, 3.1, 0],
  // beach pebbles (beach top is world y 0.0)
  ['decor', 'rock_small', 7.95, -1.2, 1, 0.0],
  ['decor', 'rock_small', -1.5, 7.95, 0, 0.0],
  ['decor', 'rock_small', -7.9, -4.6, 2, 0.0],
];

/** Lantern/lamp spots that also get a real PointLight (≤ 4 total). */
const LIGHTS: { x: number; z: number; y: number; base: number; dist: number }[] = [
  { x: -7.2, z: -5.0 + 4 * VOXEL, y: GRASS_TOP + 19.5 * VOXEL, base: 3.4, dist: 9 },
  { x: 6.4, z: 6.4, y: GRASS_TOP + 8.5 * VOXEL, base: 2.4, dist: 6 },
  { x: -3.8, z: -0.9, y: GRASS_TOP + 8.5 * VOXEL, base: 2.2, dist: 5.5 },
  { x: 1.8, z: -2.9, y: GRASS_TOP + 8.5 * VOXEL, base: 2.0, dist: 5 },
];

function rng(i: number, salt = 0): number {
  const v = Math.sin(i * 127.1 + salt * 311.7 + 7.13) * 43758.5453;
  return v - Math.floor(v);
}

export function buildVoxIsland(): IslandPart {
  const group = new THREE.Group();
  const terrain = instantiate('island', VOXEL);
  terrain.parts.water?.removeFromParent();
  group.add(terrain.group);
  const crystalMats = terrain.allEmit;

  // ------------------------------------------------- merged static decor ---
  const spots: Spot[] = [...SPOTS];
  // scatter grass tufts into the open lawn (deterministic, clear of landmarks)
  for (let i = 0, n = 0; i < 160 && n < 34; i++) {
    const x = (rng(i, 1) - 0.5) * 13.6, z = (rng(i, 2) - 0.5) * 13.6;
    if (nearLandmark(x, z, 0.25)) continue;
    if (spots.some((s) => (s[2] - x) ** 2 + (s[3] - z) ** 2 < 0.7)) continue;
    spots.push(['decor', 'tuft', x, z, Math.floor(rng(i, 3) * 4)]);
    n++;
  }
  const litGeos: THREE.BufferGeometry[] = [];
  const emitGeos = new Map<string, { model: string; idx: number; geos: THREE.BufferGeometry[] }>();
  const m4 = new THREE.Matrix4();
  for (const [model, part, x, z, rot = 0, y = GRASS_TOP] of spots) {
    const pg = voxPartGeometries(model, VOXEL).find((p) => p.name === part);
    if (!pg) continue;
    // snap to the voxel grid so props line up with the terrain voxels
    const sx = Math.round(x / VOXEL) * VOXEL, sz = Math.round(z / VOXEL) * VOXEL;
    m4.makeRotationY((rot * Math.PI) / 2).setPosition(sx, y, sz);
    if (pg.geo.lit) litGeos.push(pg.geo.lit.clone().applyMatrix4(m4));
    for (const [idx, g] of pg.geo.emit) {
      const k = `${model}:${idx}`;
      if (!emitGeos.has(k)) emitGeos.set(k, { model, idx, geos: [] });
      emitGeos.get(k)!.geos.push(g.clone().applyMatrix4(m4));
    }
  }
  const decor = new THREE.Mesh(mergeGeometries(litGeos), voxLitMaterial());
  decor.name = 'vox-decor';
  group.add(decor);
  litGeos.forEach((g) => g.dispose());
  const bulbMats: THREE.MeshToonMaterial[] = [];
  for (const { model, idx, geos } of emitGeos.values()) {
    const mat = voxEmitMaterial(voxAsset(model).asset, idx, 0.5);
    bulbMats.push(mat);
    group.add(new THREE.Mesh(mergeGeometries(geos), mat));
    geos.forEach((g) => g.dispose());
  }

  // ---------------------------------------------------------- night lights ---
  const nightLights: THREE.PointLight[] = LIGHTS.map((L) => {
    const light = new THREE.PointLight(new THREE.Color().setHex(0xffcf8a, THREE.SRGBColorSpace), 0, L.dist, 1.6);
    light.position.set(Math.round(L.x / VOXEL) * VOXEL, L.y, Math.round(L.z / VOXEL) * VOXEL);
    light.userData.nightBase = L.base;
    group.add(light);
    return light;
  });

  // ------------------------------------------------------- floating islets ---
  const islets: { obj: THREE.Object3D; y: number; phase: number }[] = [];
  const isletSpots: [string, number, number, number][] = [
    ['islet_a', 11.2, -3.6, -1.2], ['islet_b', -3.2, 11.0, -2.4], ['islet_b', -10.6, -8.4, 1.4], ['islet_a', 7.8, -10.4, 2.2],
  ];
  isletSpots.forEach(([part, x, z, y], i) => {
    const pg = voxPartGeometries('decor', VOXEL).find((p) => p.name === part)!;
    const mesh = new THREE.Mesh(pg.geo.lit!, voxLitMaterial());
    mesh.position.set(x, y, z);
    mesh.rotation.y = i * 1.3;
    group.add(mesh);
    islets.push({ obj: mesh, y, phase: i * 1.7 });
  });

  // ------------------------------------------------------------------ birds ---
  const birds: { g: THREE.Group; wl: THREE.Object3D; wr: THREE.Object3D; r: number; y: number; spd: number; ph: number }[] = [];
  for (let i = 0; i < 4; i++) {
    const b = instantiate('bird', VOXEL);
    b.group.userData.noShadow = true;
    group.add(b.group);
    birds.push({
      g: b.group, wl: b.parts.wingL, wr: b.parts.wingR,
      r: 7.5 + rng(i, 61) * 4, y: 4.2 + rng(i, 62) * 2.2, spd: (0.16 + rng(i, 63) * 0.08) * (i % 2 ? 1 : -1), ph: rng(i, 64) * 6.28,
    });
  }

  // -------------------------------------------------------------- fireflies ---
  const FN = 18;
  const flyMat = new THREE.MeshToonMaterial({
    color: new THREE.Color().setHex(0xffe08a, THREE.SRGBColorSpace),
    emissive: new THREE.Color().setHex(0xffd060, THREE.SRGBColorSpace), emissiveIntensity: 1.4,
  });
  const flies = new THREE.InstancedMesh(new THREE.BoxGeometry(VOXEL * 0.8, VOXEL * 0.8, VOXEL * 0.8), flyMat, FN);
  flies.userData.noShadow = true;
  group.add(flies);
  const fly = Array.from({ length: FN }, (_, i) => ({
    cx: (rng(i, 71) - 0.5) * 11, cz: (rng(i, 72) - 0.5) * 11, cy: 1.0 + rng(i, 73) * 1.6,
    rx: 0.6 + rng(i, 74) * 1.2, rz: 0.6 + rng(i, 75) * 1.2, ph: rng(i, 76) * 6.28, sp: 0.25 + rng(i, 77) * 0.3,
  }));
  const dummy = new THREE.Object3D();
  let night = 0;

  return {
    group,
    nightLights,
    applyTod: (s) => {
      night = s.star;
      for (const m of bulbMats) m.emissiveIntensity = 0.45 + 1.5 * s.star;
      for (const m of crystalMats) m.emissiveIntensity = 0.7 + 0.8 * s.star;
    },
    update: (t) => {
      for (const it of islets) {
        it.obj.position.y = it.y + Math.sin(t * 0.6 + it.phase) * 0.25;
      }
      for (const b of birds) {
        const a = b.ph + t * b.spd;
        b.g.position.set(Math.cos(a) * b.r, b.y + Math.sin(t * 0.7 + b.ph) * 0.4, Math.sin(a) * b.r);
        b.g.rotation.y = -a + (b.spd > 0 ? 0 : Math.PI);
        const flap = Math.sin(t * 9 + b.ph) * (0.5 + 0.5 * Math.max(0, Math.sin(t * 0.8 + b.ph)));
        b.wl.rotation.z = flap * 0.8;
        b.wr.rotation.z = -flap * 0.8;
      }
      const vis = 0.35 + 0.65 * night;
      for (let i = 0; i < FN; i++) {
        const f = fly[i];
        const tw = 0.5 + 0.5 * Math.sin(t * 2.3 + f.ph * 3);
        dummy.position.set(
          f.cx + Math.sin(t * f.sp + f.ph) * f.rx,
          f.cy + Math.sin(t * f.sp * 1.7 + f.ph) * 0.35,
          f.cz + Math.cos(t * f.sp * 0.8 + f.ph) * f.rz,
        );
        dummy.scale.setScalar(Math.max(0.001, vis * (0.5 + 0.5 * tw)));
        dummy.updateMatrix();
        flies.setMatrixAt(i, dummy.matrix);
      }
      flies.instanceMatrix.needsUpdate = true;
    },
  };
}
