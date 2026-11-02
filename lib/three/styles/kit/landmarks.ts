import * as THREE from 'three';
import {
  box, cyl, sphere, emit, glass, mat, color, osc, TAU, clamp, makeSelectionClock,
  type BuiltModel,
} from '../../kit';
import type { StationId } from '../../layout';
import { K } from './palette';
import { piece, character, makeHoverGlow, own, findNode } from './assets';
import { pixelText } from './text';
import { Poser, envelope, glance } from './pose';

/*
 * Each landmark is a small vignette composed from CC0 kit pieces (+ a few
 * custom primitives only where no asset exists: grad cap, KAIST letters,
 * monitor face, nameplate, trophy). Built facing +Z inside a ~2.2×2.2
 * footprint, ≤ ~3 tall, then turned π/4 toward the camera. Landmarks carry the
 * warm, saturated accents so they pop off the muted ground.
 */

type Update = (t: number, hover: number, sel: number) => void;

/** Shared tail: face the camera, hover glow, selection clock. */
function finish(group: THREE.Group, upd: Update, nightLight?: THREE.PointLight): BuiltModel {
  group.rotation.y = Math.PI / 4;
  const glow = makeHoverGlow(group);
  const clock = makeSelectionClock();
  return {
    group,
    nightLight,
    update: (t, hover, selected) => {
      glow(hover);
      upd(t, hover, clock(t, selected));
    },
  };
}

const burst = (sel: number, k = 4) => (sel < 0 ? 0 : Math.exp(-sel * k));
const hop = (sel: number, dur = 0.6) =>
  sel < 0 || sel > dur ? 0 : Math.sin((sel / dur) * Math.PI);

/**
 * Idle life layered on any clip: breathing (chest pitch), a slow weight shift
 * (hip roll, counter-rolled at the abdomen so the head stays over the feet) and
 * an occasional head turn. Small angles only (natural ranges).
 */
function idleLife(p: Poser, t: number, phase: number, chest = 'Chest'): void {
  const breath = Math.sin(((t + phase) / 3.6) * TAU);
  const shift = Math.sin(((t + phase) / 7.5) * TAU);
  p.turn('Hips', 0, 0, 1, 0.035 * shift);
  p.turn('Abdomen', 0, 0, 1, -0.025 * shift);
  p.turn(chest, 1, 0, 0, -0.03 * breath);
  const look = glance(t, 8.5, 0.5, phase * 3.1);
  p.turn('Neck', 0, 1, 0, look * 0.35);
  p.turn('Head', 0, 1, 0, look * 0.65);
}

/* ================================================================ ABOUT */
function about(): BuiltModel {
  const g = new THREE.Group();
  // raised round deck = the island's focal stage
  const DECK = 0.36;
  cyl(g, K.woodDark, 1.06, 1.12, DECK - 0.08, 0, (DECK - 0.08) / 2, 0, 16);
  cyl(g, K.wood, 1.08, 1.08, 0.08, 0, DECK - 0.04, 0, 16);
  piece('furniture/rugRound', { w: 1.5, y: DECK }, g);
  // little stone steps toward the camera
  box(g, K.stone, 0.62, 0.12, 0.26, 0, 0.06, 1.18);
  box(g, K.stoneDark, 0.5, 0.2, 0.18, 0, 0.1, 1.02);

  // Daewon (Quaternius hoodie character, natural proportions) idling, waves on tap
  const me = character('people/hoodie', {
    h: 1.95, y: DECK + 0.01, z: 0.0, head: 1.35,
    colors: {
      Purple: 0x2c6a76, // teal hoodie
      LightBlue: 0x343c52, // dark shorts
      White: K.cream,
      Hair: 0x231d2b,
      Eyebrows: 0x231d2b,
      Eye: 0x3b2f3d,
      Skin: 0xe4ad8c,
    },
  }, g);
  me.loop('Idle');

  // Procedural bone layer on top of the clip: idle life + the left arm
  // cradling the tablet (elbow bent ~90°, forearm forward).
  const pose = new Poser(me, [
    'Hips', 'Abdomen', 'Chest', 'Neck', 'Head',
    'UpperArm.L', 'LowerArm.L', 'Wrist.L', 'UpperArm.R', 'LowerArm.R', 'Wrist.R',
  ]);
  const holdTablet = (w: number) => {
    // upper arm hangs slightly forward, elbow bent ~95°, forearm across the waist
    pose.aim('UpperArm.L', 'LowerArm.L', 0.2, -1, 0.22, w);
    pose.aim('LowerArm.L', 'Wrist.L', -0.45, 0.35, 1, w);
  };
  // free arm: relaxed (soft elbow) while idling; released to the Wave clip
  let relaxW = 1;
  let lastT = 0;
  const relaxArm = (w: number) => {
    pose.aim('UpperArm.R', 'LowerArm.R', -0.2, -1, 0.05, w * 0.6);
    pose.aim('LowerArm.R', 'Wrist.R', -0.08, -1, 0.42, w * 0.8);
  };
  const tab = new THREE.Group();
  {
    me.update(0); // evaluate the Idle pose (not the bind T-pose) first
    pose.begin();
    holdTablet(1);
    const wrist = pose.bone('Wrist.L');
    g.updateWorldMatrix(true, true);
    if (wrist) {
      const wp = wrist.getWorldPosition(new THREE.Vector3());
      // resting on the palm, a little in front of the wrist, screen tilted up
      // the hand cups the tablet's lower outer corner; screen tilted up to read
      tab.position.set(wp.x - 0.17, wp.y + 0.13, wp.z - 0.05);
      tab.rotation.set(-0.85, 0.3, 0);
      g.add(tab);
      wrist.attach(tab); // parented to the hand bone (follows every motion)
    } else {
      tab.position.set(0.32, DECK + 0.95, 0.36);
      g.add(tab);
    }
  }
  box(tab, K.metalDark, 0.34, 0.24, 0.035, 0, 0, 0);
  const tabMat = own(emit(K.cyan, 0.7));
  box(tab, K.cyan, 0.29, 0.19, 0.01, 0, 0, 0.02, { mat: tabMat });
  const waveMat = own(emit(K.foam, 1.2));
  for (let i = 0; i < 5; i++) {
    box(tab, K.foam, 0.045, 0.03, 0.012, -0.1 + i * 0.05, Math.sin(i * 1.3) * 0.05, 0.03, { mat: waveMat });
  }

  // floating holo nameplate
  const plate = new THREE.Group();
  plate.position.set(0, 2.72, -0.6);
  g.add(plate);
  box(plate, K.screen, 2.3, 0.5, 0.05, 0, 0, 0, { mat: glass(K.screen, 0.6, 0.2) });
  box(plate, K.cyan, 2.38, 0.04, 0.06, 0, 0.27, 0, { mat: emit(K.cyan, 0.8) });
  box(plate, K.cyan, 2.38, 0.04, 0.06, 0, -0.27, 0, { mat: emit(K.cyan, 0.8) });
  const nameMat = own(emit(K.amber, 1.0));
  const name = pixelText('@vinyl810', 0.056, nameMat, 0.04);
  name.position.set(0, -0.14, 0.04);
  plate.add(name);
  plate.userData.noShadow = true;

  // deck lamp (night light) + potted plant
  piece('furniture/lampRoundFloor', { h: 1.35, x: -0.72, y: DECK, z: -0.42, ry: 0.4 }, g);
  const bulbMat = own(emit(K.amber, 0.3));
  box(g, K.amber, 0.16, 0.12, 0.16, -0.66, DECK + 1.16, -0.42, { mat: bulbMat });
  const lamp = new THREE.PointLight(color(0xffca7a), 0, 5, 1.6);
  lamp.position.set(-0.6, DECK + 1.1, -0.3);
  lamp.userData.nightBase = 2.2;
  g.add(lamp);
  piece('furniture/pottedPlant', { h: 0.7, x: 0.72, y: DECK, z: -0.5 }, g);
  piece('furniture/books', { s: 2.2, x: -0.62, y: DECK, z: 0.45, ry: 0.5 }, g);

  return finish(g, (t, hover, sel) => {
    pose.reset();
    me.update(t);
    pose.begin();
    idleLife(pose, t, 0);
    holdTablet(1);
    const dt = clamp(t - lastT, 0, 0.1);
    lastT = t;
    // Wave (procedural, free right arm — the pack's Wave clip uses the tablet
    // arm): shoulder raises the upper arm out/up, elbow bent ~70°, forearm
    // swings side to side; eases in/out around the relaxed idle arm.
    const ww = envelope(sel, 0.25, 1.9, 0.4);
    relaxW += ((ww > 0 ? 0 : 1) - relaxW) * Math.min(1, dt * 8);
    relaxArm(relaxW);
    if (ww > 0) {
      const swing = Math.sin(Math.max(0, sel - 0.2) * 11) * 0.45;
      pose.aim('UpperArm.R', 'LowerArm.R', -0.75, 0.5, 0.3, ww);
      pose.aim('LowerArm.R', 'Wrist.R', -0.15 + swing, 1, 0.2, ww);
      pose.turn('Head', 0, 1, 0, 0.12 * ww); // glance toward the waving hand
    }
    tabMat.emissiveIntensity = 0.6 + 0.4 * hover + burst(sel) * 1.5;
    waveMat.emissiveIntensity = 1 + 0.5 * osc(t, 1.4);
    plate.position.y = 2.72 + osc(t, 4) * 0.06 + hop(sel) * 0.25;
    nameMat.emissiveIntensity = 0.9 + 0.5 * hover + burst(sel, 3) * 1.5;
    bulbMat.emissiveIntensity = 0.3 + lamp.intensity * 0.6;
  }, lamp);
}

/* ============================================================ EDUCATION */
function education(): BuiltModel {
  const g = new THREE.Group();
  // stone pedestal (kit statue block) + plinth with KAIST letters
  piece('nature/statue_column', { h: 0.95, sx: 1.9, sz: 1.9, z: -0.35 }, g);
  box(g, K.stone, 0.66, 0.08, 0.66, 0, 0.99, -0.35);
  const capBaseY = 1.03;
  box(g, K.woodDark, 2.1, 0.16, 0.4, 0, 0.08, 0.68);
  box(g, K.wood, 2.14, 0.05, 0.44, 0, 0.18, 0.68);
  const kaist = pixelText('KAIST', 0.085, mat(0x3f7fe6), 0.14);
  kaist.position.set(0, 0.2, 0.66);
  g.add(kaist);

  // graduation cap (custom — no kit asset), floating + spinning
  const cap = new THREE.Group();
  cap.position.set(0, capBaseY + 0.55, -0.35);
  g.add(cap);
  const NAVY = 0x2c315c;
  cyl(cap, NAVY, 0.3, 0.33, 0.24, 0, 0, 0, 10);
  box(cap, NAVY, 0.9, 0.06, 0.9, 0, 0.14, 0, { rot: [0, Math.PI / 4, 0] });
  box(cap, K.gold, 0.08, 0.05, 0.08, 0, 0.19, 0);
  const tassel = new THREE.Group();
  tassel.position.set(0, 0.19, 0);
  cap.add(tassel);
  box(tassel, K.gold, 0.4, 0.025, 0.025, 0.2, 0, 0);
  box(tassel, K.gold, 0.05, 0.26, 0.05, 0.4, -0.13, 0);
  box(tassel, K.amber, 0.08, 0.08, 0.08, 0.4, -0.28, 0);
  const halo = sphere(g, K.gold, 0.35, 0, capBaseY + 0.08, -0.35, 8, { mat: glass(K.gold, 0.2, 0.5) });
  halo.scale.set(1.2, 0.2, 1.2);
  halo.userData.noShadow = true;

  // books + diploma scroll
  piece('furniture/books', { s: 2.8, x: -0.72, y: 0, z: -0.25, ry: 0.3 }, g);
  const scroll = new THREE.Group();
  scroll.position.set(0.72, 0.1, -0.15);
  scroll.rotation.y = 0.5;
  g.add(scroll);
  cyl(scroll, K.cream, 0.09, 0.09, 0.6, 0, 0, 0, 8, { rot: [0, 0, Math.PI / 2] });
  cyl(scroll, K.red, 0.1, 0.1, 0.07, 0, 0, 0, 8, { rot: [0, 0, Math.PI / 2] });
  piece('furniture/plantSmall1', { h: 0.45, x: 0.8, z: -0.75 }, g);

  return finish(g, (t, hover, sel) => {
    const toss = hop(sel, 0.9);
    cap.position.y = capBaseY + 0.55 + osc(t, 3.5) * 0.07 + toss * 0.9;
    cap.rotation.y = t * 0.6 + burst(sel, 1.5) * 6;
    cap.rotation.z = osc(t, 4.2) * 0.06 + toss * 0.4;
    tassel.rotation.y = osc(t, 2.1) * 0.25;
    halo.scale.set(1.3 + 0.3 * hover, 0.25, 1.3 + 0.3 * hover);
  });
}

/* ========================================================= PUBLICATIONS */
function publications(): BuiltModel {
  const g = new THREE.Group();
  // lectern (custom wood) with an open book
  const lect = new THREE.Group();
  lect.position.set(0, 0, 0.1);
  g.add(lect);
  box(lect, K.woodDark, 0.6, 0.08, 0.5, 0, 0.04, 0);
  box(lect, K.wood, 0.18, 0.95, 0.18, 0, 0.5, 0);
  const top = new THREE.Group();
  top.position.set(0, 1.0, 0);
  top.rotation.x = 0.42;
  lect.add(top);
  box(top, K.woodDark, 0.78, 0.07, 0.56, 0, 0, 0);
  box(top, K.woodDark, 0.78, 0.06, 0.05, 0, 0.05, 0.27);
  box(top, K.cream, 0.34, 0.03, 0.42, -0.18, 0.05, 0, { rot: [0, 0, 0.08] });
  box(top, K.cream, 0.34, 0.03, 0.42, 0.18, 0.05, 0, { rot: [0, 0, -0.08] });
  box(top, K.red, 0.03, 0.03, 0.44, 0, 0.04, 0);

  // stacks of journals + a side table
  piece('furniture/sideTable', { w: 0.9, x: -0.55, z: -0.6, ry: 0 }, g);
  piece('furniture/books', { s: 2.6, x: -0.7, y: 0.4, z: -0.62 }, g);
  piece('furniture/books', { s: 2.6, x: -0.4, y: 0.4, z: -0.6, ry: 1.2 }, g);
  piece('furniture/books', { s: 3.0, x: 0.75, y: 0, z: 0.35, ry: 0.4 }, g);
  piece('furniture/books', { s: 3.0, x: 0.72, y: 0.27, z: 0.38, ry: -0.3 }, g);
  piece('furniture/books', { s: 3.0, x: 0.76, y: 0.54, z: 0.36, ry: 0.9 }, g);
  piece('furniture/cardboardBoxOpen', { w: 0.55, x: 0.65, z: -0.55, ry: -0.3 }, g);

  // floating papers spiralling up from the lectern
  const papers: THREE.Mesh[] = [];
  const pMat = mat(K.cream);
  const papersGroup = new THREE.Group();
  papersGroup.userData.noShadow = true;
  g.add(papersGroup);
  for (let i = 0; i < 6; i++) {
    const p = box(papersGroup, K.cream, 0.24, 0.015, 0.32, 0, 0, 0, { mat: pMat });
    papers.push(p);
  }
  const inkMat = own(emit(K.gold, 0.9));
  const stars: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) stars.push(box(papersGroup, K.gold, 0.08, 0.08, 0.08, 0, 0, 0, { mat: inkMat }));

  return finish(g, (t, hover, sel) => {
    const b = burst(sel, 2.5);
    for (let i = 0; i < papers.length; i++) {
      const ph = (t * 0.12 + i / papers.length) % 1;
      const a = ph * TAU * 1.2 + i;
      const r = 0.45 + ph * 0.35 + b * 0.6;
      const p = papers[i];
      p.position.set(Math.cos(a) * r, 1.25 + ph * 1.3, 0.1 + Math.sin(a) * r);
      p.rotation.set(0.4 * Math.sin(t * 1.3 + i), a, 0.3 * Math.cos(t * 1.1 + i));
      const s = Math.sin(ph * Math.PI);
      p.scale.set(0.24 * s, 0.015, 0.32 * s);
    }
    for (let i = 0; i < stars.length; i++) {
      const a = t * 0.8 + (i * TAU) / 3;
      stars[i].position.set(Math.cos(a) * 0.35, 1.55 + osc(t, 2, i) * 0.1, 0.1 + Math.sin(a) * 0.35);
      stars[i].rotation.set(t, t * 1.3, 0);
    }
    inkMat.emissiveIntensity = 0.8 + 0.6 * hover + b * 2;
  });
}

/* ================================================================= WORK */
function work(): BuiltModel {
  const g = new THREE.Group();
  piece('furniture/desk', { w: 1.9, z: -0.3 }, g);
  const DESK_Y = 0.38 * (1.9 / 0.73);
  piece('furniture/computerKeyboard', { s: 2.4, y: DESK_Y, z: 0.0 }, g);
  piece('furniture/chairDesk', { s: 2.2, x: 0.15, z: 0.75, ry: Math.PI + 0.3 }, g);

  // big ocean-data monitor (custom face on a kit-style stand)
  const mon = new THREE.Group();
  mon.position.set(0, DESK_Y, -0.45);
  g.add(mon);
  box(mon, K.metalDark, 0.12, 0.35, 0.1, 0, 0.17, 0);
  box(mon, K.metalDark, 0.5, 0.05, 0.3, 0, 0.025, 0);
  box(mon, K.metalDark, 1.6, 1.0, 0.1, 0, 0.85, 0);
  const scrMat = own(emit(K.screen, 0.9));
  box(mon, K.screen, 1.46, 0.86, 0.02, 0, 0.85, 0.055, { mat: scrMat });
  // wave bars (sea-state chart) + a sun/satellite dot
  const barMat = own(emit(K.cyan, 1.1));
  const bars: THREE.Mesh[] = [];
  const NB = 12;
  for (let i = 0; i < NB; i++) {
    bars.push(box(mon, K.cyan, 0.08, 0.3, 0.02, -0.62 + i * 0.113, 0.6, 0.07, { mat: barMat }));
  }
  const dotMat = own(emit(K.amber, 1.4));
  const dot = box(mon, K.amber, 0.1, 0.1, 0.02, 0.5, 1.12, 0.07, { mat: dotMat });
  const lineMat = own(emit(K.foam, 0.8));
  box(mon, K.foam, 1.3, 0.02, 0.02, 0, 0.47, 0.07, { mat: lineMat });

  // buoy bobbing in a little water tub
  piece('nature/pot_large', { w: 0.75, x: 0.88, z: 0.55 }, g);
  cyl(g, K.cyan, 0.3, 0.3, 0.03, 0.88, 0.2, 0.55, 12, { mat: emit(K.sea, 0.25) });
  const buoy = new THREE.Group();
  buoy.position.set(0.88, 0.2, 0.55);
  g.add(buoy);
  cyl(buoy, K.red, 0.12, 0.16, 0.16, 0, 0.08, 0, 8);
  cyl(buoy, K.cream, 0.08, 0.12, 0.12, 0, 0.22, 0, 8);
  cyl(buoy, K.metalDark, 0.02, 0.02, 0.2, 0, 0.38, 0, 5);
  const blinkMat = own(emit(K.amber, 1.2));
  box(buoy, K.amber, 0.07, 0.07, 0.07, 0, 0.5, 0, { mat: blinkMat });
  piece('furniture/plantSmall1', { h: 0.4, x: -0.7, y: DESK_Y, z: -0.2 }, g);

  return finish(g, (t, hover, sel) => {
    const b = burst(sel, 1.8);
    for (let i = 0; i < NB; i++) {
      const h = 0.18 + 0.14 * (0.5 + 0.5 * Math.sin(t * 1.6 + i * 0.7)) + b * 0.25 * Math.abs(Math.sin(i * 1.7 + sel * 6));
      bars[i].scale.y = h; // box() bakes size into scale → absolute
      bars[i].position.y = 0.48 + h / 2;
    }
    dot.position.x = -0.55 + ((t * 0.08) % 1) * 1.1;
    scrMat.emissiveIntensity = 0.8 + 0.4 * hover + b;
    barMat.emissiveIntensity = 1.0 + 0.5 * hover;
    buoy.position.y = 0.2 + osc(t, 2.4) * 0.03;
    buoy.rotation.z = osc(t, 3.1) * 0.12;
    blinkMat.emissiveIntensity = (Math.sin(t * 3) > 0.6 ? 2.2 : 0.4) + b * 2;
  });
}

/* ============================================================= PROJECTS */
function projects(): BuiltModel {
  const g = new THREE.Group();
  piece('furniture/table', { w: 1.9, z: -0.15 }, g);
  const TOP = 0.33 * (1.9 / 0.84);
  const laptop = piece('furniture/laptop', { s: 1.5, x: -0.2, y: TOP, z: -0.05 }, g);
  const glowMat = own(emit(K.cyan, 0.8));
  // the laptop's lid → find it via its bbox and lay a glowing screen on it
  {
    const bb = new THREE.Box3().setFromObject(laptop);
    const lid = box(g, K.cyan, (bb.max.x - bb.min.x) * 0.78, 0.4, 0.012, (bb.min.x + bb.max.x) / 2, TOP + 0.3, bb.min.z + 0.06, { mat: glowMat });
    lid.rotation.x = -0.12;
  }
  piece('furniture/radio', { s: 1.5, x: 0.6, y: TOP, z: -0.3, ry: -0.4 }, g);
  piece('furniture/cardboardBoxClosed', { w: 0.5, x: 0.78, z: 0.62, ry: 0.4 }, g);
  piece('furniture/cardboardBoxOpen', { w: 0.55, x: 0.25, z: 0.75, ry: -0.2 }, g);
  piece('furniture/stoolBar', { s: 1.8, x: -0.55, z: 0.62, ry: 0.6 }, g);

  // big amber gear on a post (custom — no kit gear)
  const gear = new THREE.Group();
  gear.position.set(-0.98, 1.35, -0.6);
  g.add(gear);
  box(g, K.metalDark, 0.1, 1.35, 0.1, -0.98, 0.675, -0.68);
  const spin = new THREE.Group();
  gear.add(spin);
  const gearMat = own(mat(K.amber));
  cyl(spin, K.amber, 0.3, 0.3, 0.1, 0, 0, 0, 12, { mat: gearMat, rot: [Math.PI / 2, 0, 0] });
  cyl(spin, K.metalDark, 0.09, 0.09, 0.14, 0, 0, 0, 8, { rot: [Math.PI / 2, 0, 0] });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    box(spin, K.amber, 0.13, 0.13, 0.1, Math.cos(a) * 0.34, Math.sin(a) * 0.34, 0, { mat: gearMat, rot: [0, 0, a] });
  }

  // sparkles over the laptop (idea!)
  const sparkMat = own(emit(K.gold, 1.4));
  const sparks: THREE.Mesh[] = [];
  const sp = new THREE.Group();
  sp.userData.noShadow = true;
  g.add(sp);
  for (let i = 0; i < 4; i++) sparks.push(box(sp, K.gold, 0.08, 0.08, 0.08, 0, 0, 0, { mat: sparkMat }));

  let ang = 0;
  let lastT = 0;
  return finish(g, (t, hover, sel) => {
    const b = burst(sel, 1.2);
    const dt = clamp(t - lastT, 0, 0.1);
    lastT = t;
    ang += dt * (0.8 + b * 8);
    spin.rotation.z = ang;
    gearMat.emissive.setHex(K.amber).multiplyScalar(b * 0.5);
    glowMat.emissiveIntensity = 0.7 + 0.5 * hover + b * 1.5;
    for (let i = 0; i < sparks.length; i++) {
      const ph = (t * 0.5 + i / sparks.length) % 1;
      const s = Math.sin(ph * Math.PI) * (1 + b);
      sparks[i].position.set(-0.2 + Math.sin(i * 2.3) * 0.35, TOP + 0.6 + ph * 0.7, -0.15 + Math.cos(i * 1.7) * 0.2);
      sparks[i].scale.setScalar(0.08 * s);
      sparks[i].rotation.set(t * 2, t, 0);
    }
  });
}

/* =========================================================== COURSEWORK */
function coursework(): BuiltModel {
  const g = new THREE.Group();
  piece('furniture/bookcaseOpen', { w: 0.85, x: -0.43, z: -0.45 }, g);
  piece('furniture/bookcaseOpen', { w: 0.85, x: 0.43, z: -0.45 }, g);
  // colourful book spines on the shelves (custom, merged per material)
  const spines = [K.red, K.blue, K.gold, K.purple, K.plant, K.pink, K.cream, K.amber];
  const shelfY = [0.05, 0.47, 0.88, 1.29];
  const books = new THREE.Group();
  g.add(books);
  let n = 0;
  const pull: THREE.Object3D[] = [];
  for (let s = 0; s < shelfY.length; s++) {
    let x = -0.78;
    while (x < 0.74) {
      n++;
      const w = 0.07 + ((n * 37) % 5) * 0.012;
      const h = 0.26 + ((n * 53) % 4) * 0.03;
      if ((n * 29) % 11 === 0) { x += 0.12; continue; }
      if (Math.abs(x) < 0.06) { x += 0.08; continue; } // middle uprights
      const b = box(books, spines[(n * 7) % spines.length], w * 0.9, h, 0.3, x + w / 2, shelfY[s] + h / 2 + 0.02, -0.55);
      if (s === 2 && pull.length < 1 && x > 0.1) pull.push(b);
      x += w;
    }
  }
  piece('furniture/stoolBar', { s: 1.9, x: 0.6, z: 0.45, ry: 0.3 }, g);
  piece('furniture/books', { s: 2.8, x: 0.62, y: 0.82, z: 0.42 }, g);
  piece('furniture/pottedPlant', { h: 0.8, x: -0.75, z: 0.45 }, g);
  piece('furniture/books', { s: 2.8, x: -0.15, z: 0.4, ry: 0.7 }, g);
  piece('furniture/books', { s: 2.8, x: -0.12, y: 0.27, z: 0.42, ry: 0.2 }, g);
  const pz = pull[0]?.position.z ?? 0;

  return finish(g, (t, _hover, sel) => {
    const b = pull[0];
    if (b) {
      const out = hop(sel, 1.4);
      b.position.z = pz + out * 0.28 + Math.max(0, osc(t, 5)) * 0.03;
    }
  });
}

/* =============================================================== AWARDS */
function awards(): BuiltModel {
  const g = new THREE.Group();
  // three-tier podium (custom blocks — kit has none) with medal-coloured tops
  const TOP1 = 0.78;
  const tiers: [number, number, number, number, string][] = [
    [0, TOP1, 0.72, K.gold, '1'],
    [-0.7, 0.52, 0.64, K.metal, '2'],
    [0.7, 0.36, 0.64, K.amber, '3'],
  ];
  for (const [x, h, w, top, label] of tiers) {
    box(g, K.cream, w, h - 0.06, w, x, (h - 0.06) / 2, 0);
    box(g, top, w + 0.04, 0.06, w + 0.04, x, h - 0.03, 0);
    box(g, K.stoneDark, w + 0.06, 0.05, w + 0.06, x, 0.025, 0);
    const num = pixelText(label, 0.06, mat(K.red), 0.03);
    num.position.set(x, h / 2 - 0.2, w / 2 + 0.005);
    g.add(num);
  }

  // gold trophy cup (custom lathe)
  const cup = new THREE.Group();
  cup.position.set(0, TOP1, 0);
  cup.scale.setScalar(1.45);
  g.add(cup);
  const goldMat = own(mat(K.gold));
  box(cup, K.woodDark, 0.34, 0.1, 0.34, 0, 0.05, 0);
  cyl(cup, K.gold, 0.06, 0.06, 0.2, 0, 0.2, 0, 8, { mat: goldMat });
  const prof = [
    new THREE.Vector2(0.0, 0.0), new THREE.Vector2(0.1, 0.02), new THREE.Vector2(0.2, 0.14),
    new THREE.Vector2(0.24, 0.32), new THREE.Vector2(0.25, 0.42), new THREE.Vector2(0.22, 0.44),
  ];
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(prof, 10), goldMat);
  bowl.position.y = 0.28;
  cup.add(bowl);
  box(cup, K.gold, 0.06, 0.2, 0.06, -0.28, 0.5, 0, { mat: goldMat });
  box(cup, K.gold, 0.06, 0.2, 0.06, 0.28, 0.5, 0, { mat: goldMat });
  box(cup, K.gold, 0.08, 0.06, 0.06, -0.25, 0.6, 0, { mat: goldMat });
  box(cup, K.gold, 0.08, 0.06, 0.06, 0.25, 0.6, 0, { mat: goldMat });
  const starMat = own(emit(K.amber, 1.3));
  const star = box(cup, K.amber, 0.14, 0.14, 0.04, 0, 0.92, 0, { mat: starMat, rot: [0, 0, Math.PI / 4] });

  // red carpet + laurel-ish bushes framing the podium
  box(g, K.red, 0.6, 0.03, 0.9, 0, 0.015, 0.75);
  box(g, K.redDark, 0.66, 0.02, 0.94, 0, 0.008, 0.75);
  piece('nature/plant_bushDetailed', { s: 1.4, x: -1.0, z: -0.45 }, g);
  piece('nature/plant_bushDetailed', { s: 1.2, x: 1.0, z: -0.45 }, g);
  piece('nature/flower_yellowA', { s: 1.8, x: -0.55, z: 0.75 }, g);
  piece('nature/flower_redA', { s: 1.8, x: 0.55, z: 0.8 }, g);

  // confetti burst
  const conf = new THREE.Group();
  conf.userData.noShadow = true;
  g.add(conf);
  const confetti: { m: THREE.Mesh; vx: number; vy: number; vz: number }[] = [];
  const CC = [K.red, K.gold, K.cyan, K.pink, K.purple];
  for (let i = 0; i < 16; i++) {
    const m = box(conf, CC[i % CC.length], 0.06, 0.06, 0.02, 0, 0, 0);
    m.visible = false;
    const a = (i / 16) * TAU;
    confetti.push({ m, vx: Math.cos(a) * (0.6 + (i % 3) * 0.3), vy: 2.2 + (i % 4) * 0.4, vz: Math.sin(a) * (0.6 + (i % 3) * 0.3) });
  }

  return finish(g, (t, hover, sel) => {
    cup.rotation.y = t * 0.5;
    cup.position.y = TOP1 + hop(sel, 0.5) * 0.25;
    star.rotation.y = t * 2;
    starMat.emissiveIntensity = 1.0 + 0.8 * hover + burst(sel) * 2;
    goldMat.emissive.setHex(K.gold).multiplyScalar(0.08 + 0.2 * hover + burst(sel, 3) * 0.5);
    const on = sel >= 0 && sel < 1.6;
    for (const c of confetti) {
      c.m.visible = on;
      if (!on) continue;
      c.m.position.set(c.vx * sel, TOP1 + 1.0 + c.vy * sel - 2.6 * sel * sel, c.vz * sel);
      c.m.rotation.set(sel * 9 + c.vx, sel * 7, 0);
    }
  });
}

/* ========================================================== INVOLVEMENT */
function involvement(): BuiltModel {
  const g = new THREE.Group();
  piece('town/stall-red', { w: 1.6, z: -0.35 }, g);
  piece('town/banner-green', { h: 1.3, x: 0.98, z: 0.0, ry: Math.PI }, g);
  box(g, K.woodDark, 0.06, 1.5, 0.06, 1.0, 0.75, 0.1);
  // volunteers (Quaternius people, re-dressed per instance)
  const a = character('people/casual', {
    h: 1.3, x: -0.45, z: 0.6, ry: 0.3, head: 1.3,
    colors: { LightBrown: 0xe8c35a, White: K.cream, LightBlue: 0x3d4f7a, Red_Dark: K.red, Hair: 0x4a3226, Eyebrows: 0x4a3226, Skin: 0xe0a985, Skin_Darker: 0xc58d6c, Eye: 0x15131c },
  }, g);
  const b = character('people/man', {
    h: 1.25, x: 0.45, z: 0.62, ry: -0.35, head: 1.3,
    colors: { Shirt: 0xcf6f97, Pants: 0x34405a, Hair: 0x231d2b, Skin: 0xd59a76, Socks: K.cream, Eyes: 0x15131c },
  }, g);
  const c = character('people/casual', {
    h: 1.15, x: 0.3, z: 0.1, ry: -0.2, head: 1.3,
    colors: { LightBrown: 0x6fb38a, White: K.cream, LightBlue: 0x2f3a52, Red_Dark: K.cream, Hair: 0x1e1a24, Eyebrows: 0x1e1a24, Skin: 0xb8805c, Skin_Darker: 0x9c6a4c, Eye: 0x15131c },
  }, g);
  a.loop('Idle');
  b.loop('Man_Idle');
  c.loop('Interact');
  // per-side bone names (prebuilt → no per-frame string allocation)
  const SIDES = [1, -1].map((sd) => {
    const L = sd > 0 ? 'L' : 'R';
    return {
      sd, ua: `UpperArm.${L}`, la: `LowerArm.${L}`, wr: `Wrist.${L}`,
      ul: `UpperLeg.${L}`, ll: `LowerLeg.${L}`, ft: `Foot.${L}`,
    };
  });
  const ARM = ['UpperArm.L', 'LowerArm.L', 'Wrist.L', 'UpperArm.R', 'LowerArm.R', 'Wrist.R'];
  const LEG = ['UpperLeg.L', 'LowerLeg.L', 'Foot.L', 'UpperLeg.R', 'LowerLeg.R', 'Foot.R'];
  const pa = new Poser(a, ['Hips', 'Abdomen', 'Chest', 'Neck', 'Head', ...ARM, ...LEG]);
  const pb = new Poser(b, ['Hips', 'Abdomen', 'Torso', 'Neck', 'Head']);
  const pc = new Poser(c, ['Hips', 'Abdomen', 'Chest', 'Neck', 'Head']);
  const aBaseY = a.group.position.y;

  /**
   * Procedural cheer-hop (no clip in the pack): anticipation crouch (hip/knee
   * bend, arms swing back) → push-off → airborne with both arms up, elbows
   * bent → landing absorb → arms pump, then ease back to the Idle clip.
   */
  const cheerHop = (sel: number) => {
    if (sel < 0 || sel > 2.3) {
      a.group.position.y = aBaseY;
      return;
    }
    const crouch = Math.max(envelope(sel, 0.2, 0.22, 0.1), 0.7 * envelope(sel - 0.68, 0.06, 0.08, 0.28));
    const air = sel > 0.3 && sel < 0.68 ? Math.sin(((sel - 0.3) / 0.38) * Math.PI) : 0;
    // arms travel down → forward → overhead (elbows bent), never sideways
    // through a locked T: u is the path parameter, weight ramps in near "down".
    const u = envelope(sel - 0.2, 0.3, 1.5, 0.5);
    const w = Math.min(1, u * 3);
    a.group.position.y = aBaseY + air * 0.3 - crouch * 0.12;
    pa.begin();
    // legs: hip + knee flexion (knee forward), feet stay under the body
    for (const S of SIDES) {
      pa.aim(S.ul, S.ll, 0.06 * S.sd, -1, 0.8 * crouch + 0.15 * air, crouch + air * 0.6);
      pa.aim(S.ll, S.ft, 0.02 * S.sd, -1, -0.75 * crouch + 0.25 * air, crouch + air * 0.6);
    }
    pa.turn('Chest', 1, 0, 0, 0.28 * crouch - 0.08 * u); // lean in to load, open chest on the cheer
    const pump = sel > 0.8 ? Math.sin((sel - 0.8) * 11) * 0.3 * u : 0;
    const k1 = Math.min(1, u * 2); // down → front
    const k2 = Math.max(0, u * 2 - 1); // front → up
    for (const S of SIDES) {
      if (w <= 0.001) break;
      // upper arm: down(0.12,-1,0.2) → front(0.3,0,1) → up(0.6,0.85,0.15)
      const ux = 0.12 + 0.18 * k1 + 0.3 * k2;
      const uy = -1 + k1 + (0.85 + pump * 0.3) * k2;
      const uz = 0.2 + 0.8 * k1 - 0.85 * k2;
      pa.aim(S.ua, S.la, ux * S.sd, uy, uz, w);
      // forearm leads the upper arm (bent elbow): down → front-up → up/in
      const fx = 0.05 - 0.05 * k1 - 0.2 * k2;
      const fy = -1 + 1.5 * k1 + 0.5 * k2;
      const fz = 0.35 + 0.65 * k1 - (0.65 + pump) * k2;
      pa.aim(S.la, S.wr, fx * S.sd, fy, fz, w);
    }
  };
  piece('furniture/cardboardBoxClosed', { w: 0.42, x: -0.95, z: 0.25, ry: 0.3 }, g);
  piece('furniture/cardboardBoxClosed', { w: 0.36, x: -0.92, y: 0.4, z: 0.25, ry: -0.2 }, g);
  const heart = new THREE.Group();
  heart.position.set(0, 2.15, -0.3);
  heart.userData.noShadow = true;
  g.add(heart);
  const hMat = own(emit(K.pink, 1.0));
  for (const [x, y] of [[-0.08, 0.06], [0.08, 0.06], [0, -0.04], [-0.12, 0.12], [0.12, 0.12], [-0.04, 0.12], [0.04, 0.12], [0, 0.02]] as const) {
    box(heart, K.pink, 0.09, 0.09, 0.06, x, y, 0, { mat: hMat });
  }
  let was = false;
  return finish(g, (t, hover, sel) => {
    pa.reset();
    pb.reset();
    pc.reset();
    a.update(t);
    b.update(t);
    c.update(t);
    if (sel >= 0 && !was) {
      b.once('Man_Clapping'); // clip: forearms meet in front
      c.once('Wave'); // clip: shoulder raise + elbow bend + forearm swing
    }
    was = sel >= 0;
    a.group.position.y = aBaseY;
    pa.begin();
    idleLife(pa, t, 1.3);
    cheerHop(sel);
    pb.begin();
    idleLife(pb, t, 4.1, 'Torso');
    pc.begin();
    idleLife(pc, t, 2.6);
    heart.position.y = 2.15 + osc(t, 2.6) * 0.06 + hop(sel, 0.7) * 0.3;
    heart.rotation.y = t * 0.8;
    const s = 1 + 0.12 * hover + burst(sel, 3) * 0.5;
    heart.scale.setScalar(s);
    hMat.emissiveIntensity = 0.9 + 0.6 * hover;
  });
}

export const kitLandmarks: Record<StationId, () => BuiltModel> = {
  about,
  education,
  publications,
  work,
  projects,
  coursework,
  awards,
  involvement,
};

