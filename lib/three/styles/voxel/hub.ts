import * as THREE from 'three';
import { color, makeSelectionClock, osc, clamp, type BuiltModel } from '../../kit';
import { C } from './palette';
import { Grid, meshGrid, landmarkVoxel } from './vox';
import { type FigureSpec } from './figure';
import { buildRig, relax, bendLeg, hop, setElbow, smooth } from './rig';

/** Daewon: natural-ish proportions (head ≈ 1/4 of height), rounded forms. */
const FIG: FigureSpec = {
  x: 0, y: 4, z: 0, legH: 9, legW: 2, torsoH: 8, waist: 2.1, shoulder: 3.3, depth: 1.4,
  head: [3.1, 3.2, 3.0], neck: 1,
};

/**
 * About — chibi voxel Daewon standing on a round plank deck, waving with one
 * hand and holding a glowing tablet (wave + neuron motif) in the other, beside
 * a floating "@" holo-sign and a warm deck lamp (real night light).
 * Front faces +Z; group turned π/4 toward the camera.
 */
export function buildVoxelHub(): BuiltModel {
  const s = landmarkVoxel('about');
  const group = new THREE.Group();
  const G = () => new Grid(-16, 16, -1, 34, -16, 16);

  /* ---------------- static base: deck + legs + lamp post ---------------- */
  const b = G();
  const plank = b.c(C.plank, 0.05);
  const plankL = b.c(C.woodLight, 0.05);
  const woodD = b.c(C.woodDark, 0.04);
  const wood = b.c(C.wood, 0.05);
  const mossC = b.c(C.moss, 0.06);
  const stone = b.c(C.rock, 0.06);
  const R = 12;
  // stone footing ring, then wooden drum, then plank top with alternating boards
  b.cyl(0, 0, 0, 0, R - 1, stone);
  b.cyl(0, 0, 1, 2, R, wood);
  for (let z = -R; z <= R; z++) {
    const board = Math.floor((z + 100) / 2) % 2 === 0 ? plank : plankL;
    for (let x = -R; x <= R; x++) {
      if (x * x + z * z <= R * R + 0.25) b.set(x, 3, z, board);
    }
  }
  // dark plank seams on the side + moss creeping on the footing
  for (let a = 0; a < 64; a++) {
    const ang = (a / 64) * Math.PI * 2;
    const x = Math.round(Math.cos(ang) * R), z = Math.round(Math.sin(ang) * R);
    if (a % 4 === 0) b.set(x, 1, z, woodD).set(x, 2, z, woodD);
    if ((a * 7) % 5 === 0) b.set(Math.round(Math.cos(ang) * (R - 1)), 0, Math.round(Math.sin(ang) * (R - 1)), mossC);
  }
  // front steps (+Z)
  b.box(-2, 0, R + 1, 2, 1, R + 1, wood).box(-2, 0, R + 2, 2, 0, R + 2, plankL);

  // lamp post (back-left of the deck)
  const LX = -9, LZ = 6;
  const slate = b.c(C.slate, 0.04);
  b.box(LX - 1, 4, LZ - 1, LX + 1, 4, LZ + 1, slate);
  b.box(LX, 5, LZ, LX, 15, LZ, slate);
  b.box(LX - 1, 16, LZ - 1, LX + 1, 16, LZ + 1, slate); // cap
  b.box(LX - 1, 12, LZ - 1, LX + 1, 12, LZ + 1, slate); // base of lantern
  // potted sprout on the deck (right-back)
  const pot = b.c(C.coral, 0.05);
  const leaf = b.c(C.leafLight, 0.06);
  b.box(7, 4, -7, 9, 5, -5, pot).set(8, 6, -6, leaf).set(8, 7, -6, leaf).set(7, 7, -6, leaf).set(9, 8, -6, leaf).set(8, 8, -5, leaf);
  group.add(meshGrid(b, { size: s }).group);

  // lantern glass (glow) as its own part → flicker
  const lg = G();
  const amber = lg.g(C.amber);
  lg.box(LX - 1, 13, LZ - 1, LX + 1, 15, LZ + 1, amber);
  const lantern = meshGrid(lg, { size: s, glow: 1.2 });
  group.add(lantern.group);

  /* ---------------- Daewon: jointed rig ---------------- */
  const rig = buildRig(FIG, {
    skin: C.skin, shirt: C.hoodie, shirtDark: C.hoodieDark, pants: C.jeans, shoe: C.shoe,
    hair: C.hair, hairLight: 0x5a3b2c, cheek: C.pink, eye: C.ink,
  }, s, {
    cuff: C.hoodieDark,
    toe: C.white,
    torsoDetail: (t, TL) => {
      const hoodD = t.c(C.hoodieDark, 0.02);
      const tw = t.c(C.white, 0.02);
      const front = (x: number, y: number) => { for (let z = 4; z >= 0; z--) if (t.get(x, y, z)) return z; return 0; };
      for (let x = -1; x <= 1; x++) for (const y of [TL.torso0 + 1, TL.torso0 + 2]) t.set(x, y, front(x, y), hoodD); // pocket
      for (const x of [-1, 1]) for (const y of [TL.torso0 + 4, TL.torso0 + 5]) t.set(x, y, front(x, y), tw); // drawstrings
      t.box(-2, TL.shoulder - 2, -2, 2, TL.shoulder - 1, -2, hoodD).box(-1, TL.shoulder, -2, 1, TL.shoulder, -1, hoodD); // hood
    },
  });
  group.add(rig.root);

  // tablet held in the right hand (arm 0, −x side). It lives under the hand
  // and is counter-rotated each frame so it stays upright, facing the viewer.
  const tabG = new Grid(-2, 8, -4, 6, -2, 4);
  const bez = tabG.c(C.ink, 0.02);
  tabG.box(-2, -1, 1, 2, 3, 1, bez); // small tablet, centred on the hand
  const tablet = new THREE.Group();
  tablet.add(meshGrid(tabG, { size: s }).group);
  rig.arms[0].c.add(tablet);
  tablet.position.set(0, -1 * s, 0); // the hand voxel (grip point), one row below the wrist pivot
  const frames: THREE.Object3D[] = [];
  for (let f = 0; f < 3; f++) {
    const sg = new Grid(-2, 8, -4, 6, -2, 4);
    const scr = sg.g(0x1f6f86);
    const wave = sg.g(C.cyan);
    const node = sg.g(C.pink);
    sg.box(-1, 0, 2, 1, 2, 2, scr);
    for (let x = -1; x <= 1; x++) {
      const y = 1 + Math.round(Math.sin((x + f * 1.6) * 1.4) * 0.9);
      sg.set(x, clamp(y, 0, 2), 2, wave);
    }
    sg.set(f === 1 ? 0 : 1, 2, 2, node);
    const part = meshGrid(sg, { size: s, glow: 0.9 });
    part.group.visible = f === 0;
    tablet.add(part.group);
    frames.push(part.group);
  }
  const screenMats = frames.map((fg) => (fg.children[0] as THREE.Mesh).material as THREE.MeshToonMaterial);

  /* ---------------- floating "@" holo-sign ---------------- */
  const n = G();
  const frame = n.c(C.navy, 0.03);
  const glyph = n.g(C.cyan);
  const NX = 10, NY = 22, NZ = -3;
  n.box(NX - 5, NY - 5, NZ, NX + 5, NY + 4, NZ, frame);
  const AT = [
    '.#####.',
    '#.....#',
    '#.###.#',
    '#.#.#.#',
    '#.####.',
    '#......',
    '.#####.',
  ];
  AT.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) if (row[c] === '#') n.set(NX - 3 + c, NY + 3 - r, NZ + 1, glyph);
  });
  n.box(NX, NY - 10, NZ, NX, NY - 6, NZ, frame); // little stand-off stalk (floats above deck)
  const sign = meshGrid(n, { size: s, pivot: [NX, NY, NZ], glow: 1.0 });
  group.add(sign.group);

  /* ---------------- night light ---------------- */
  const deckLight = new THREE.PointLight(color(0xffca7a), 0, 5, 1.8);
  deckLight.position.set(LX * s, 14 * s, LZ * s);
  deckLight.userData.nightBase = 2.2;
  group.add(deckLight);

  group.rotation.y = Math.PI / 4;

  const clock = makeSelectionClock();
  const signY = sign.group.position.y;
  const lanternMat = lantern.glowMat!;
  const signMat = sign.glowMat!;
  const [tabArm, waveArm] = rig.arms;

  return {
    group,
    nightLight: deckLight,
    update(time, hover, selected) {
      const sel = clock(time, selected);
      const flash = sel >= 0 ? Math.exp(-sel * 4) : 0;
      const greet = sel >= 0 ? Math.sin(Math.min(sel, 0.55) / 0.55 * Math.PI) * Math.exp(-sel * 2) : 0;

      relax(rig, time, 0);
      // idle weight shift: hips tilt over the standing leg, the other knee softens
      const ws = Math.sin(time * 0.7);
      rig.hips.rotation.z = 0.03 * ws;
      for (const l of rig.legs) l.a.rotation.z = -0.03 * ws;
      bendLeg(rig, ws > 0 ? rig.legs[0] : rig.legs[1], 0.09 * Math.abs(ws));
      // occasional look-around + small nod
      const hp = time % 9;
      rig.head.rotation.y = hp < 2.6 ? 0.42 * Math.sin(Math.PI * hp / 2.6) ** 2 : 0;
      rig.head.rotation.x = -0.04 + 0.05 * Math.sin(time * 0.8) ** 2;
      rig.head.rotation.z = 0.03 * Math.sin(time * 0.5);

      // tablet arm: upper arm slightly forward, elbow bent ~85°, wrist up
      tabArm.a.rotation.set(-0.12 + 0.02 * Math.sin(time * 1.3), 0, -0.2);
      setElbow(tabArm, -1.3 + 0.04 * Math.sin(time * 1.7));
      tabArm.c.rotation.x = 0.1;

      // click: anticipation-crouch hop, then a greeting wave
      let swing = 0;
      if (sel >= 0) {
        swing = hop(rig, sel, 7);
        const n = Math.sin(sel * 9) * Math.exp(-sel * 3.4);
        rig.head.rotation.x += greet * 0.07 + n * 0.05;
      }
      // wave: every ~7 s idle, and after the hop on click
      let wu = -1;
      const lp = time % 7;
      if (lp < 2.4) wu = lp;
      if (sel >= 0.8 && sel < 3.2) wu = sel - 0.8;
      if (wu >= 0) {
        const D = 2.4;
        const raise = smooth(wu / 0.4) * smooth((D - wu) / 0.45);
        // shoulder: abduct + externally rotate so the elbow bends UP (wave plane)
        waveArm.a.rotation.set(-0.1 * raise, 1.45 * raise, 0.07 + 1.75 * raise);
        setElbow(waveArm, -(0.2 + 1.05 * raise) + raise * 0.42 * Math.sin(wu * Math.PI * 2 * 2.2));
        waveArm.c.rotation.x = -0.25 * raise * Math.sin(wu * Math.PI * 2 * 2.2 + 0.6);
      } else if (swing !== 0) {
        waveArm.a.rotation.x = -1.1 * swing;
        setElbow(waveArm, -0.25 - 0.4 * Math.abs(swing));
      }

      // blink
      rig.eyes.scale.y = time % 5.5 < 0.12 ? 0.15 : 1;

      // keep the tablet upright + facing the viewer whatever the arm does
      tablet.rotation.x = -(rig.hips.rotation.x + rig.torso.rotation.x + tabArm.a.rotation.x + tabArm.b.rotation.x + tabArm.c.rotation.x);
      tablet.rotation.z = -(tabArm.a.rotation.z + rig.hips.rotation.z);

      // tablet screen: flip wave frames (constant rate), glow with hover/greet
      const fi = Math.floor(time * 4) % 3;
      for (let i = 0; i < 3; i++) frames[i].visible = i === fi;
      for (const m of screenMats) m.emissiveIntensity = 0.75 + hover * 0.3 + greet * 0.6;

      // holo-sign bob + pop
      sign.group.position.y = signY + 0.06 * osc(time, 3) + greet * 0.1;
      sign.group.rotation.y = 0.15 * osc(time, 7);
      signMat.emissiveIntensity = 0.9 + 0.25 * osc(time, 2.5) + hover * 0.4 + flash * 0.8;

      lanternMat.emissiveIntensity = 1.1 * (1 + 0.08 * osc(time, 0.4)) + flash * 0.8;
    },
  };
}
