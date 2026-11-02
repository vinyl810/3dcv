import * as THREE from 'three';
import { makeSelectionClock, osc, type BuiltModel } from '../../kit';
import { C } from './palette';
import { Grid, meshGrid, landmarkVoxel, type VoxPart } from './vox';

/**
 * Voxel landmarks: education, publications, work, projects.
 * Conventions (see hub.ts): one Grid per animated part in a shared voxel frame,
 * pivots in voxel coords, front faces +Z, group turned π/4 to the camera.
 */

const grid = () => new Grid(-14, 14, -1, 34, -14, 14);

/** Mesh a part and parent it; child position = (pivot - parentPivot)·s. */
function attach(
  parent: THREE.Object3D, g: Grid, s: number, pivot: [number, number, number],
  parentPivot: [number, number, number] = [0, 0, 0], glow?: number,
): VoxPart {
  const p = meshGrid(g, { size: s, pivot, glow });
  p.group.position.set((pivot[0] - parentPivot[0]) * s, (pivot[1] - parentPivot[1]) * s, (pivot[2] - parentPivot[2]) * s);
  parent.add(p.group);
  return p;
}

/** A hard-cover book lying flat: coloured cover, paper page block on +x/+z. */
function book(g: Grid, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, cover: number, paper: number) {
  g.box(x0, y0, z0, x1, y1, z1, cover);
  if (y1 - y0 >= 2) {
    g.box(x0 + 1, y0 + 1, z1, x1, y1 - 1, z1, paper);
    g.box(x1, y0 + 1, z0 + 1, x1, y1 - 1, z1, paper);
  }
}

/* ================================================================ EDUCATION */

export function buildVoxelEducation(): BuiltModel {
  const s = landmarkVoxel('education');
  const group = new THREE.Group();

  // ---- static: stacked books + rolled diploma ----
  const b = grid();
  const paper = b.c(C.paper, 0.03);
  book(b, -8, 8, 0, 2, -7, 7, b.c(C.blue, 0.04), paper);
  book(b, -7, 7, 3, 5, -6, 5, b.c(C.red, 0.04), paper);
  book(b, -6, 7, 6, 7, -5, 6, b.c(C.green, 0.04), paper);
  // gold title stripes on the spines (-x side faces away; put on +z cover edge)
  const gold = b.c(C.gold, 0.03);
  b.box(-6, 1, 7, -3, 1, 7, gold).box(-5, 4, 5, -2, 4, 5, gold);
  // diploma scroll leaning at the front-right of the stack
  const ribbon = b.c(C.red, 0.03);
  b.box(4, 0, 9, 11, 1, 10, paper).box(7, 0, 9, 7, 2, 10, ribbon).set(7, 0, 11, ribbon).set(8, 0, 11, ribbon);
  group.add(meshGrid(b, { size: s }).group);

  // ---- cap (tossed on click) ----
  const capPivot: [number, number, number] = [0, 9, 0];
  const capRoot = new THREE.Group();
  capRoot.position.set(0, 9 * s, 0);
  group.add(capRoot);
  const c = grid();
  const navy = c.c(C.navy, 0.03);
  const ink = c.c(C.ink, 0.03);
  const band = c.c(C.blue, 0.03);
  const tg = c.c(C.gold, 0.03);
  c.box(-4, 8, -4, 4, 10, 4, navy);
  c.box(-4, 8, -4, 4, 8, 4, band); // KAIST-blue band
  c.box(-7, 11, -7, 7, 11, 7, ink); // the board
  c.frame(-7, 11, -7, 7, 11, 7, c.c(C.blue, 0.03)); // KAIST-blue rim
  c.set(0, 12, 0, tg);
  c.line(0, 12, 0, 6, 12, 6, tg); // cord across the board
  c.box(7, 7, 7, 7, 11, 7, tg).box(6, 5, 6, 8, 6, 8, tg); // tassel
  const cap = attach(capRoot, c, s, capPivot, capPivot);
  cap.group.position.set(0, 0, 0);

  // ---- orbiting sparkles (glow) ----
  const sp = grid();
  const sg = sp.g(C.gold);
  const sc = sp.g(C.cyan);
  sp.set(10, 14, 0, sg).set(10, 15, 0, sg).set(10, 13, 0, sg).set(9, 14, 0, sg).set(11, 14, 0, sg);
  sp.set(-9, 17, 4, sc).set(-3, 19, -9, sg);
  const spark = attach(group, sp, s, [0, 14, 0], [0, 0, 0], 1.1);

  group.rotation.y = Math.PI / 4;
  const clock = makeSelectionClock();
  const sm = spark.glowMat!;

  return {
    group,
    update(t, hover, selected) {
      const sel = clock(t, selected);
      // toss: up-and-down arc with one full flip
      const toss = sel >= 0 && sel < 1.1 ? Math.sin((sel / 1.1) * Math.PI) : 0;
      const flip = sel >= 0 && sel < 1.1 ? (sel / 1.1) * Math.PI * 2 : 0;
      capRoot.position.y = 9 * s + 0.03 * osc(t, 3) + toss * 1.6;
      capRoot.rotation.y = 0.18 * osc(t, 6) + flip;
      capRoot.rotation.z = 0.05 * osc(t, 4.2) + Math.sin(flip) * 0.25;
      spark.group.rotation.y = t * 0.6;
      sm.emissiveIntensity = 0.8 + 0.4 * osc(t, 1.3) + hover * 0.5 + (sel >= 0 ? Math.exp(-sel * 3) : 0);
    },
  };
}

/* ============================================================= PUBLICATIONS */

export function buildVoxelPublications(): BuiltModel {
  const s = landmarkVoxel('publications');
  const group = new THREE.Group();

  // ---- static: lectern base + column + paper stack ----
  const b = grid();
  const wd = b.c(C.woodDark, 0.04);
  const w = b.c(C.wood, 0.05);
  const wl = b.c(C.woodLight, 0.05);
  const paper = b.c(C.paper, 0.03);
  const shade = b.c(C.paperShade, 0.03);
  b.box(-6, 0, -5, 6, 1, 5, wd);
  b.box(-3, 2, -3, 3, 12, 2, w);
  b.box(-3, 2, 3, 3, 12, 3, wl); // front panel
  b.box(-1, 5, 3, 1, 9, 3, b.c(C.gold, 0.03)); // brass plate
  // stack of manuscripts at the foot (+x front)
  for (let i = 0; i < 6; i++) b.box(7, i, 2, 11, i, 7, i % 2 ? shade : paper);
  b.box(7, 6, 2, 11, 6, 7, b.c(C.red, 0.03)); // top cover
  group.add(meshGrid(b, { size: s }).group);

  // ---- tilted desk with the open book ----
  const dPivot: [number, number, number] = [0, 13, 0];
  const d = grid();
  const dw = d.c(C.wood, 0.05);
  const pp = d.c(C.paper, 0.03);
  const ps = d.c(C.paperShade, 0.03);
  const ink = d.c(C.steel, 0.02);
  d.box(-7, 13, -5, 7, 14, 5, dw);
  d.box(-7, 15, 5, 7, 15, 5, dw); // lip
  d.box(-6, 15, -4, -1, 15, 4, pp).box(1, 15, -4, 6, 15, 4, pp);
  d.box(0, 15, -4, 0, 15, 4, ps); // spine gutter
  for (let z = -2; z <= 2; z += 2) {
    d.box(-5, 15, z, -2 - (z === 2 ? 1 : 0), 15, z, ink);
    d.box(2, 15, z, 5 - (z === 0 ? 2 : 0), 15, z, ink);
  }
  d.set(0, 16, 4, d.c(C.red, 0.03)).set(0, 16, 3, d.c(C.red, 0.03)); // bookmark ribbon
  const desk = attach(group, d, s, dPivot);
  desk.group.rotation.x = 0.32;
  // little ink pot + quill
  const q = grid();
  q.box(8, 0, -3, 9, 1, -2, q.c(C.ink, 0.02));
  q.line(8, 2, -2, 10, 7, -4, q.c(C.white, 0.02));
  q.set(10, 8, -4, q.c(C.pink, 0.02));
  attach(group, q, s, [0, 0, 0]);

  // ---- floating paper sheets ----
  const sheets: { g: THREE.Group; bx: number; by: number; bz: number; ph: number; ox: number; oz: number }[] = [];
  const spots: [number, number, number, number, number][] = [
    [-7, 22, -2, -1.0, 0.2], [0, 25, -6, 0, -1], [7, 21, 0, 1.0, 0.3],
  ];
  spots.forEach(([x, y, z, ox, oz], i) => {
    const g = grid();
    const sp = g.c(C.paper, 0.03);
    const sl = g.g(i === 1 ? C.cyan : C.gold);
    g.box(x - 2, y, z - 3, x + 2, y, z + 3, sp);
    g.box(x - 1, y + 1, z - 2, x + 1, y + 1, z - 2, sl);
    g.box(x - 1, y + 1, z, x + 1, y + 1, z, sl);
    const part = attach(group, g, s, [x, y, z], [0, 0, 0], 0.7);
    sheets.push({ g: part.group, bx: x * s, by: y * s, bz: z * s, ph: i * 2.1, ox, oz });
  });

  group.rotation.y = Math.PI / 4;
  const clock = makeSelectionClock();
  const glowMats = sheets.map((sh) => (sh.g.children[sh.g.children.length - 1] as THREE.Mesh).material as THREE.MeshToonMaterial);

  return {
    group,
    update(t, hover, selected) {
      const sel = clock(t, selected);
      const fan = sel >= 0 ? Math.sin(Math.min(sel, 0.6) / 0.6 * Math.PI * 0.5) * Math.exp(-Math.max(0, sel - 0.6) * 1.2) : 0;
      for (let i = 0; i < sheets.length; i++) {
        const sh = sheets[i];
        sh.g.position.set(
          sh.bx + sh.ox * fan * 0.6,
          sh.by + 0.08 * osc(t, 2.6, sh.ph) + fan * 0.25,
          sh.bz + sh.oz * fan * 0.6 + 0.04 * osc(t, 3.4, sh.ph),
        );
        sh.g.rotation.z = 0.18 * osc(t, 3.1, sh.ph) + fan * sh.ox * 0.5;
        sh.g.rotation.x = 0.12 * osc(t, 2.3, sh.ph + 1);
        sh.g.rotation.y = 0.2 * osc(t, 5, sh.ph) + fan * 1.2;
        glowMats[i].emissiveIntensity = 0.6 + hover * 0.5 + fan * 0.6;
      }
      desk.group.rotation.x = 0.32 + (sel >= 0 ? Math.exp(-sel * 5) * Math.sin(sel * 20) * 0.08 : 0);
    },
  };
}

/* ===================================================================== WORK */

export function buildVoxelWork(): BuiltModel {
  const s = landmarkVoxel('work');
  const group = new THREE.Group();

  // ---- static: base, stand, bezel, sea gauge pole ----
  const b = grid();
  const slate = b.c(C.slate, 0.04);
  const navy = b.c(C.navy, 0.03);
  const steel = b.c(C.steel, 0.04);
  b.box(-6, 0, -4, 6, 0, 4, slate);
  b.box(-5, 1, -3, 5, 1, 3, steel);
  b.box(-1, 2, -1, 1, 7, 0, slate);
  b.box(-10, 8, -2, 10, 21, 0, navy); // chunky bezel
  b.box(-10, 8, -2, 10, 8, 0, slate);
  b.set(9, 9, 1, b.g(C.green)); // power LED
  // pool + buoy mount at the front-left
  const water = b.c(C.water, 0.05);
  const rim = b.c(C.rock, 0.05);
  b.cyl(-8, 7, 0, 0, 4, rim);
  b.cyl(-8, 7, 1, 1, 3, water);
  // gauge pole with red/white depth marks
  for (let y = 1; y <= 12; y++) b.set(-12, y, 4, y % 2 ? b.c(C.white, 0.02) : b.c(C.red, 0.03));
  b.set(-12, 13, 4, b.g(C.amber));
  group.add(meshGrid(b, { size: s }).group);

  // ---- screen content frames (glow): globe over a voxel wave-field ----
  const frames: THREE.Object3D[] = [];
  const mats: THREE.MeshToonMaterial[] = [];
  for (let f = 0; f < 4; f++) {
    const g = grid();
    const bg = g.g(0x164f64);
    const sea = g.g(0x2aa4b8);
    const crest = g.g(C.cyan);
    const globe = g.g(0x3f8fd8);
    const land = g.g(C.green);
    const bar = g.g(C.amber);
    g.box(-9, 9, 1, 9, 20, 1, bg);
    // wave-field: columns of sea with a moving crest
    for (let x = -9; x <= 9; x++) {
      const h = 11 + Math.round(1.2 + Math.sin(x * 0.7 + f * (Math.PI / 2)) * 1.2);
      g.box(x, 9, 1, x, h - 1, 1, sea);
      g.set(x, h, 1, crest);
    }
    // globe (disc) with a rotating continent
    for (let y = -3; y <= 3; y++)
      for (let x = -3; x <= 3; x++) if (x * x + y * y <= 10) g.set(x - 3, 17 + y, 1, globe);
    const lx = ((f * 2) % 7) - 3;
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1], [0, -1], [-1, 1]]) {
      const x = lx + dx;
      if (x >= -3 && x <= 3 && x * x + (dy + 1) ** 2 <= 10) g.set(x - 3, 18 + dy, 1, land);
    }
    // little bar chart (right)
    for (let k = 0; k < 4; k++) g.box(3 + k * 2, 15, 1, 3 + k * 2, 15 + ((k * 3 + f) % 4) + 1, 1, bar);
    const part = attach(group, g, s, [0, 0, 0], [0, 0, 0], 0.85);
    part.group.visible = f === 0;
    frames.push(part.group);
    mats.push(part.glowMat!);
  }

  // ---- data spike bars (click burst), scale from screen top ----
  const sp = grid();
  const sc = sp.g(C.cyan);
  const sa = sp.g(C.amber);
  for (let k = -3; k <= 3; k++) sp.box(k * 3, 22, -1, k * 3, 22 + (4 - Math.abs(k)), -1, k % 2 ? sa : sc);
  const spike = attach(group, sp, s, [0, 22, -1], [0, 0, 0], 1.2);
  spike.group.visible = false;

  // ---- bobbing buoy ----
  const by = grid();
  const red = by.c(C.red, 0.03);
  const wh = by.c(C.white, 0.02);
  by.box(-9, 1, 6, -7, 3, 8, red).box(-9, 2, 6, -7, 2, 8, wh).box(-8, 4, 7, -8, 6, 7, by.c(C.slate, 0.03));
  by.set(-8, 7, 7, by.g(C.amber));
  const buoy = attach(group, by, s, [-8, 1, 7], [0, 0, 0], 1.0);

  group.rotation.y = Math.PI / 4;
  const clock = makeSelectionClock();

  return {
    group,
    update(t, hover, selected) {
      const sel = clock(t, selected);
      const fi = Math.floor(t * 3) % 4;
      for (let i = 0; i < 4; i++) frames[i].visible = i === fi;
      const flash = sel >= 0 ? Math.exp(-sel * 3) : 0;
      for (const m of mats) m.emissiveIntensity = 0.8 + hover * 0.35 + flash * 0.6;
      const up = sel >= 0 && sel < 1.6 ? Math.sin(Math.min(sel / 0.25, 1) * Math.PI * 0.5) * Math.exp(-sel * 1.6) : 0;
      spike.group.visible = up > 0.03;
      spike.group.scale.y = Math.max(0.01, up * 1.4);
      buoy.group.position.y = 1 * s + 0.03 * osc(t, 2.2);
      buoy.group.rotation.z = 0.12 * osc(t, 2.9);
      buoy.group.rotation.x = 0.08 * osc(t, 3.7, 1);
      buoy.glowMat!.emissiveIntensity = t % 2 < 0.25 ? 1.6 : 0.5;
    },
  };
}

/* ================================================================= PROJECTS */

export function buildVoxelProjects(): BuiltModel {
  const s = landmarkVoxel('projects');
  const group = new THREE.Group();

  // ---- static: workbench, laptop base, tools ----
  const b = grid();
  const wd = b.c(C.woodDark, 0.04);
  const w = b.c(C.wood, 0.05);
  const pl = b.c(C.plank, 0.05);
  const steel = b.c(C.steel, 0.04);
  const slate = b.c(C.slate, 0.04);
  for (const [x, z] of [[-10, -5], [10, -5], [-10, 5], [10, 5]]) b.box(x, 0, z, x, 7, z, wd);
  b.box(-10, 2, -5, 10, 2, 5, w); // lower shelf
  b.box(-11, 8, -6, 11, 9, 6, w);
  for (let x = -11; x <= 11; x++) if (x % 3 === 0) b.box(x, 9, -6, x, 9, 6, pl); // plank stripes
  // crates on the shelf
  b.box(-8, 3, -3, -4, 6, 2, b.c(C.woodLight, 0.05)).frame(-8, 3, -3, -4, 6, 2, wd);
  b.box(4, 3, -2, 7, 4, 2, b.c(C.blue, 0.04));
  // laptop base
  b.box(-6, 10, -1, 0, 10, 4, slate);
  b.box(-5, 10, 4, -1, 10, 4, b.c(C.ink, 0.02));
  // hammer + wrench on the bench
  b.box(2, 10, 3, 8, 10, 3, b.c(C.woodLight, 0.04)).box(8, 10, 2, 9, 11, 4, steel);
  b.box(3, 10, -4, 7, 10, -4, steel).box(2, 10, -5, 2, 10, -3, steel).box(8, 10, -5, 8, 10, -3, steel);
  // gear stand (right end)
  b.box(9, 10, -3, 11, 10, -1, slate).box(10, 11, -2, 10, 13, -2, slate);
  group.add(meshGrid(b, { size: s }).group);

  // ---- laptop screen (lit lid + glow code frames) ----
  const lidPivot: [number, number, number] = [-3, 11, -1.5];
  const lid = new THREE.Group();
  lid.position.set(-3 * s, 11 * s, -1.5 * s);
  lid.rotation.x = -0.2;
  group.add(lid);
  const lg = grid();
  lg.box(-6, 11, -2, 0, 16, -2, lg.c(C.slate, 0.03));
  attach(lid, lg, s, lidPivot, lidPivot);
  const codeFrames: THREE.Object3D[] = [];
  const codeMats: THREE.MeshToonMaterial[] = [];
  for (let f = 0; f < 3; f++) {
    const g = grid();
    const bg = g.g(0x1d3550);
    const cols = [g.g(C.cyan), g.g(C.pink), g.g(C.gold)];
    g.box(-5, 12, -1, -1, 15, -1, bg);
    for (let r = 0; r < 4; r++) {
      const len = 1 + ((r * 3 + f * 2) % 4);
      const indent = (r + f) % 2;
      g.box(-5 + indent, 15 - r, -1, Math.min(-1, -5 + indent + len - 1), 15 - r, -1, cols[(r + f) % 3]);
    }
    const part = attach(lid, g, s, lidPivot, lidPivot, 0.9);
    part.group.visible = f === 0;
    codeFrames.push(part.group);
    codeMats.push(part.glowMat!);
  }

  // ---- spinning gear (vertical, faces +Z) ----
  const gp: [number, number, number] = [10, 16, -2];
  const gg = grid();
  const gc = gg.c(C.gold, 0.04);
  const gd = gg.c(C.goldDark, 0.04);
  for (let y = -6; y <= 6; y++)
    for (let x = -6; x <= 6; x++) {
      const r = Math.hypot(x, y);
      const a = Math.atan2(y, x);
      const tooth = Math.cos(a * 8) > 0.35;
      if ((r >= 2.2 && r <= 4.3) || (r > 4.3 && r <= 5.6 && tooth)) gg.set(10 + x, 16 + y, -2, r < 3 ? gd : gc);
    }
  gg.set(10, 16, -2, gd);
  const gear = attach(group, gg, s, gp);

  // ---- little robot buddy ----
  const rp: [number, number, number] = [-8, 10, 3];
  const rg = grid();
  const rb = rg.c(C.steel, 0.04);
  const rd = rg.c(C.slate, 0.03);
  rg.box(-9, 10, 2, -7, 10, 4, rd).box(-10, 11, 2, -6, 13, 4, rb); // feet + body
  rg.box(-10, 14, 2, -6, 16, 4, rb); // head
  rg.set(-9, 15, 5, rg.g(C.cyan)).set(-7, 15, 5, rg.g(C.cyan)); // eyes
  rg.set(-8, 17, 3, rd).set(-8, 18, 3, rg.g(C.red)); // antenna
  rg.set(-11, 12, 3, rd).set(-5, 12, 3, rd); // arms
  const robot = attach(group, rg, s, rp, [0, 0, 0], 1.0);

  // ---- sparks (click burst) ----
  const sk = grid();
  const sa = sk.g(C.amber);
  const sy = sk.g(C.gold);
  const sparkPts: [number, number, number][] = [[3, 2, 0], [-2, 3, 1], [1, 4, -2], [-3, 1, -1], [2, 1, 2], [0, 5, 1], [-1, 2, 3]];
  sparkPts.forEach(([x, y, z], i) => sk.set(10 + x, 16 + y, -1 + z, i % 2 ? sa : sy));
  const sparks = attach(group, sk, s, gp, [0, 0, 0], 1.6);
  sparks.group.visible = false;

  group.rotation.y = Math.PI / 4;
  const clock = makeSelectionClock();
  let gearAngle = 0;
  let lastT = -1;

  return {
    group,
    update(t, hover, selected) {
      const sel = clock(t, selected);
      const dt = lastT < 0 ? 0 : Math.min(0.1, t - lastT);
      lastT = t;
      const burst = sel >= 0 ? Math.exp(-sel * 2.2) : 0;
      gearAngle -= dt * (0.8 + burst * 9);
      gear.group.rotation.z = gearAngle;
      const fi = Math.floor(t * 2.5) % 3;
      for (let i = 0; i < 3; i++) codeFrames[i].visible = i === fi;
      for (const m of codeMats) m.emissiveIntensity = 0.85 + hover * 0.35 + burst * 0.5;
      // robot: idle bob + hop on click
      const hop = sel >= 0 && sel < 0.6 ? Math.sin((sel / 0.6) * Math.PI) : 0;
      robot.group.position.y = 10 * s + Math.abs(osc(t, 1.4)) * 0.04 + hop * 0.35;
      robot.group.rotation.y = 0.35 * osc(t, 5);
      // sparks fly outward from the gear
      const sp = sel >= 0 && sel < 0.9 ? sel / 0.9 : -1;
      sparks.group.visible = sp >= 0;
      if (sp >= 0) {
        sparks.group.scale.setScalar(0.4 + sp * 1.8);
        sparks.glowMat!.emissiveIntensity = 1.8 * (1 - sp);
      }
    },
  };
}
