import * as THREE from 'three';
import { buildSky, buildIsland, buildOcean, buildLights, buildVisitorMarks } from './environment';
import { P, color, emit, TAU } from './kit';
import type { Mark } from '../marks-types';
import { buildHub } from './landmarks/hub';
import { buildEducation } from './landmarks/education';
import { buildPublications } from './landmarks/publications';
import { buildMonitor } from './landmarks/monitor';
import { buildProjects } from './landmarks/projects';
import { buildCoursework } from './landmarks/coursework';
import { buildTrophy } from './landmarks/trophy';
import { buildInvolvement } from './landmarks/involvement';
import type { BuiltModel } from './kit';

export interface InteractiveObject {
  root: THREE.Object3D;
  stationId: string;
  label: string;
  update: (t: number, hover: number, selected: boolean) => void;
}

export interface World {
  interactives: InteractiveObject[];
  /** Stable invisible hit-volumes for hover/click picking (on render layer 1). */
  proxies: THREE.Object3D[];
  /** Add visitor marks (fireflies) not already shown — idempotent by id. */
  syncMarks: (marks: Mark[]) => void;
  /** Flag which mark ids belong to THIS visitor (adds a "you-are-here" pin). */
  setMineMarks: (ids: number[]) => void;
  /** Fire a one-shot locator on the visitor's own fireflies. */
  pingMine: () => void;
  update: (t: number, dt: number) => void;
  dispose: () => void;
}

/** Top of the grass slab — every landmark base rests here. */
const GRASS_TOP = 0.5;

/**
 * Global multiplier on every landmark's size. The island/base stays the same;
 * bumping this makes the props bigger so they read well when the whole scene is
 * shrunk (small screens / zoomed out). Tune to taste.
 */
const PROP_SCALE = 1.35;

/**
 * Hit-proxy sizing — tweak to taste. Proxies are tight ORIENTED boxes that hug
 * each model's silhouette; smaller padding means less chance of a proxy covering
 * a landmark behind it (which would block its hover/click).
 */
const PROXY_PAD = 0.08; // horizontal margin on each side (world units)
const PROXY_TOP = 0.12; // headroom above the model (the lift doesn't need covering)
const PROXY_BOTTOM = 0.05; // skirt below the base

interface Placement {
  id: string;
  label: string;
  build: () => BuiltModel;
  pos: [number, number]; // x, z on the grass
  scale: number;
}

// stationId must match lib/cv-data.ts station ids. Order = CV / dot-nav order.
const LANDMARKS: Placement[] = [
  { id: 'about', label: 'About · @vinyl810', build: buildHub, pos: [0, 0], scale: 1 },
  { id: 'education', label: 'Education', build: buildEducation, pos: [0, -6], scale: 1 },
  { id: 'publications', label: 'Publications', build: buildPublications, pos: [-6.5, 1], scale: 0.95 },
  { id: 'work', label: 'Work · KOAST', build: buildMonitor, pos: [4.5, 2.5], scale: 0.78 },
  { id: 'projects', label: 'Projects', build: buildProjects, pos: [-1, 5], scale: 1 },
  { id: 'coursework', label: 'Coursework', build: buildCoursework, pos: [-5, -4], scale: 1 },
  { id: 'awards', label: 'Awards & Honors', build: buildTrophy, pos: [3, -5.5], scale: 1 },
  { id: 'involvement', label: 'Involvement & Service', build: buildInvolvement, pos: [6, -1], scale: 1 },
];

/** Glowing data-cable spokes from the hub to each landmark. */
function buildCables(): { group: THREE.Group; update: (t: number) => void } {
  const group = new THREE.Group();
  const y = GRASS_TOP + 0.06;

  LANDMARKS.forEach((L) => {
    if (L.id === 'about') return; // hub is the origin
    const target = new THREE.Vector3(L.pos[0], y, L.pos[1]);
    const len = target.length();
    // thin emissive line lying on the grass
    const line = new THREE.Mesh(
      new THREE.BoxGeometry(len, 0.05, 0.12),
      emit(P.surfCyan, 0.5),
    );
    line.position.copy(target.clone().multiplyScalar(0.5));
    line.rotation.y = -Math.atan2(target.z, target.x);
    group.add(line);
  });

  return {
    group,
    update: (_t: number) => {
      // Energy dots removed; cyan cable lines are static. No-op kept so the
      // world update loop's `cables.update(t)` call stays valid.
    },
  };
}

export function buildWorld(scene: THREE.Scene, initialMarks: Mark[] = []): World {
  scene.add(buildLights());

  const sky = buildSky();
  scene.add(sky.group);

  // Everything that "floats" bobs together so landmarks stay attached.
  const floating = new THREE.Group();
  scene.add(floating);

  const island = buildIsland();
  floating.add(island.group);
  const ocean = buildOcean();
  floating.add(ocean.group);
  const cables = buildCables();
  floating.add(cables.group);
  const marks = buildVisitorMarks(initialMarks);
  floating.add(marks.group);

  const interactives: InteractiveObject[] = [];
  // Stable, invisible hit proxies. Hover/click target these steady volumes
  // instead of the animated geometry (which flickers as parts move under the
  // cursor). A proxy is a sibling of its `root` under `floating`, so it bobs
  // with the island but does NOT move with the per-landmark animation or the
  // hover lift — keeping the hit target rock-steady. Proxies are on render
  // layer 1: the (layer-0) camera never draws them, the raycaster tests layer 1.
  const proxies: THREE.Object3D[] = [];
  const proxyMat = new THREE.MeshBasicMaterial();
  const box3 = new THREE.Box3();

  for (const L of LANDMARKS) {
    const built = L.build();
    const sc = L.scale * PROP_SCALE; // final world scale for this landmark

    // Measure the model's TIGHT local footprint with its facing rotation
    // removed. The proxy is then an ORIENTED box that hugs the silhouette — an
    // axis-aligned box of a 45°-rotated model would balloon into its empty
    // corners and end up covering the landmarks behind it.
    const facing = built.group.rotation.y;
    built.group.rotation.y = 0;
    built.group.updateWorldMatrix(true, true);
    box3.setFromObject(built.group);
    built.group.rotation.y = facing;

    const root = new THREE.Group();
    root.position.set(L.pos[0], GRASS_TOP, L.pos[1]);
    root.scale.setScalar(sc);
    root.userData.stationId = L.id;
    root.add(built.group);
    floating.add(root);

    interactives.push({
      root,
      stationId: L.id,
      label: L.label,
      update: (t, hover, selected) => {
        built.update?.(t, hover, selected);
        root.position.y = GRASS_TOP + 0.3 * hover;
        root.scale.setScalar(sc * (1 + 0.08 * hover));
      },
    });

    // Oriented hit proxy: the tight local box, scaled + rotated to match the
    // model, sitting beside `root` under `floating` (so it bobs with the island
    // but never moves with the per-landmark animation or the hover lift).
    const s = sc;
    const cos = Math.cos(facing);
    const sin = Math.sin(facing);
    const cx = ((box3.min.x + box3.max.x) / 2) * s;
    const cy = ((box3.min.y + box3.max.y) / 2) * s;
    const cz = ((box3.min.z + box3.max.z) / 2) * s;
    const proxy = new THREE.Mesh(
      new THREE.BoxGeometry(
        (box3.max.x - box3.min.x) * s + PROXY_PAD * 2,
        (box3.max.y - box3.min.y) * s + PROXY_TOP + PROXY_BOTTOM,
        (box3.max.z - box3.min.z) * s + PROXY_PAD * 2,
      ),
      proxyMat,
    );
    proxy.position.set(
      L.pos[0] + cx * cos + cz * sin,
      GRASS_TOP + cy + (PROXY_TOP - PROXY_BOTTOM) / 2,
      L.pos[1] - cx * sin + cz * cos,
    );
    proxy.rotation.y = facing;
    proxy.layers.set(1);
    proxy.userData.stationId = L.id;
    floating.add(proxy);
    proxies.push(proxy);
  }

  const update = (t: number, dt: number) => {
    sky.update(t, dt);
    island.update(t, dt);
    ocean.update(t, dt);
    cables.update(t);
    marks.update(t);
    // Subtle floating motion for the whole island.
    floating.position.y = Math.sin((t / 6) * TAU) * 0.15;
    floating.rotation.y = Math.sin((t / 8) * TAU) * 0.026; // ~1.5°
  };

  const dispose = () => {
    for (const p of proxies) (p as THREE.Mesh).geometry.dispose();
    proxyMat.dispose();
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      const geo = mesh.geometry as THREE.BufferGeometry | undefined;
      // Box geometries are the shared UNIT_BOX — never dispose it.
      if (geo && geo.type !== 'BoxGeometry') geo.dispose();
    });
    scene.clear();
  };

  return {
    interactives,
    proxies,
    syncMarks: marks.sync,
    setMineMarks: marks.setMine,
    pingMine: marks.ping,
    update,
    dispose,
  };
}

// Re-export so engine.ts can import the types from one place.
export type { BuiltModel };
void color; // keep color import available to landmark-adjacent tooling
