import * as THREE from 'three';
import { makeSelectionClock, type BuiltModel } from '../../../kit';
import { Mesher, RP, piv, sbox, glowMat, unitFor, osc } from '../rkit';
import { buildRig, setArm, setLeg, hopCurve, ease, type Rig } from '../rig';

/**
 * Involvement & Service — a light-wood mentoring stage with stone front
 * steps: a lectern with a glowing teal note panel and microphone, a pink
 * two-segment banner (gold trims, white pixel stars) on posts with little
 * stage lamps, a glowing amber spotlight disc and three chunky pixel mentees
 * facing the camera. Click: mentees cheer, banner waves, stars flare, sparks.
 * Grid units: 1 = 0.1 world.
 */
export function buildRefinedInvolvement(): BuiltModel {
  const u = unitFor('involvement');
  const group = new THREE.Group();
  const M = new Mesher(u);

  // ---------------- stage (top y = 3) -------------------------------------
  const F = 3;
  M.c(RP.stoneShade, -13, 0, -12, 26, 2, 23); // skirt z -12..11
  for (let x = -13; x < 13; x += 4) {
    const w = Math.min(4, 13 - x);
    M.c(((x + 13) / 4) % 2 === 0 ? RP.woodLight : RP.wood, x, 2, -12, w, 1, 23);
  }
  M.c(RP.pink, -13, 0.6, 11, 26, 1, 0.4, { flat: true }); // pink skirt band
  M.c(RP.stone, -5, 0, 11, 10, 2, 1).c(RP.stone, -5, 0, 12, 10, 1, 2); // front steps

  // ---------------- lectern (back centre, front face z = -5) ---------------
  M.c(RP.woodLight, -3, F, -9, 6, 8, 4); // body
  M.c(RP.wood, -4, F, -10, 8, 1, 6); // foot
  M.b(RP.wood, 7, 1, 5, 0, F + 8.5, -7, { rx: -0.3, top: RP.woodLight }); // slanted top
  // microphone: tilted stem + chunky head
  M.b(RP.metalDark, 1, 4, 1, 2, F + 11, -5.8, { rx: 0.3 });
  M.b(RP.ink, 2, 2, 2, 2, F + 13.5, -5, { rx: 0.3 });

  // ---------------- banner posts + trims + lamp housings -------------------
  const BZ = -11; // banner plane
  M.c(RP.wood, -12, F, BZ - 1, 2, 22, 2).c(RP.wood, 10, F, BZ - 1, 2, 22, 2); // posts y 3..25
  M.c(RP.gold, -10, 24, BZ - 1, 20, 1, 2); // top trim (cloth hangs below)
  M.c(RP.gold, -10, 13, BZ - 1, 20, 1, 2); // bottom trim
  M.c(RP.metalDark, -12.5, 25, BZ - 1.5, 3, 2, 3, { top: RP.metal }); // lamp housings
  M.c(RP.metalDark, 9.5, 25, BZ - 1.5, 3, 2, 3, { top: RP.metal });
  M.to(group);

  const lampMat = glowMat(RP.amber, 0.9);
  sbox(group, u, lampMat, 2, 1, 1, -11, 25.5, BZ + 1.5);
  sbox(group, u, lampMat, 2, 1, 1, 11, 25.5, BZ + 1.5);

  const noteMat = glowMat(RP.teal, 0.7);
  sbox(group, u, noteMat, 4, 3, 0.4, 0, F + 5, -4.8);

  // ---------------- banner cloth: 2 rippling segments + stars --------------
  const CLOTH_Y = 19; // cloth y 14..24
  const segs: THREE.Group[] = [];
  const starDefs: [number, number, number][] = [
    // [segment, localX, localY]
    [0, -1.5, 1.5],
    [1, -4, -1.5], // near the seam
    [1, 2, 2],
  ];
  const stars: THREE.Group[] = [];
  const starMat = glowMat(RP.white, 0.3);
  for (let i = 0; i < 2; i++) {
    const seg = piv(group, u, i === 0 ? -5 : 5, CLOTH_Y, BZ);
    const C = new Mesher(u);
    C.b(RP.pink, 10, 10, 1, 0, 0, 0);
    C.b(RP.pinkDark, 10, 1, 1.1, 0, -4.5, 0, { flat: true }); // hem shadow
    C.to(seg);
    segs.push(seg);
  }
  for (const [si, x, y] of starDefs) {
    const sp = piv(segs[si], u, x, y, 0.9);
    const S = new Mesher(u);
    S.b(RP.white, 3, 1, 0.6, 0, 0, 0).b(RP.white, 1, 3, 0.6, 0, 0, 0); // pixel plus-star
    const m = S.build(starMat);
    if (m) sp.add(m);
    stars.push(sp);
  }

  // ---------------- spotlight disc (stepped octagon, glowing) --------------
  const SPOT_Z = 5;
  const D = new Mesher(u);
  D.b(RP.amber, 12, 0.4, 6, 0, F + 0.2, SPOT_Z).b(RP.amber, 6, 0.4, 12, 0, F + 0.2, SPOT_Z);
  D.b(RP.amber, 10, 0.4, 10, 0, F + 0.2, SPOT_Z);
  const ringMat = glowMat(RP.amber, 0.8);
  const disc = D.build(ringMat);
  if (disc) group.add(disc);

  // ---------------- 3 chunky pixel mentees --------------------------------
  const shirts = [RP.blue, RP.coral, RP.leafMid];
  const hairs = [RP.hair, 0x7a4a2e, RP.hair];
  const sleeves = [RP.blueDark, RP.coralDark, 0x4f9a4f]; // long sleeves read against the light stage
  const spots: [number, number][] = [
    [-8, 3],
    [0, 6],
    [8, 3],
  ];
  const BASE_Y = F + 0.4;
  // Each mentee is a hierarchical rig (../rig.ts): hips → torso → neck/head,
  // shoulder → elbow → hand, hip → knee → ankle/foot, rounded joint caps.
  const people: { rig: Rig; phase: number }[] = [];
  for (let i = 0; i < 3; i++) {
    const hair = hairs[i];
    const rig = buildRig(group, {
      u,
      footH: 0.8, footL: 2.2, shin: 3, thigh: 3, legW: 1.5, hipX: 0.85,
      pelvis: [3.8, 1.6, 2.2], waist: [3.4, 2, 2.2], chest: [4.6, 3, 2.6],
      upper: 2.6, fore: 2.2, armW: 1.2, shoulderX: 2.6, hand: 1.0, neck: 0.8,
      color: {
        shoe: RP.ink, pants: RP.indigo, pantsDark: 0x3c4482,
        shirt: shirts[i], shirtDark: shirts[i], sleeve: sleeves[i], skin: RP.skin, skinShade: RP.skinShade,
      },
      head: (H) => {
        H.r(RP.skin, 3.4, 4, 3.2, 0, 2, 0, 0.6); // head
        H.r(hair, 3.8, 1.8, 3.6, 0, 3.6, -0.1, 0.6); // rounded hair cap
        H.r(hair, 3.6, 2.6, 1, 0, 2.1, -1.5, 0.3); // back hair
        H.b(RP.ink, 0.6, 0.8, 0.3, -0.7, 2.1, 1.65, { flat: true }).b(RP.ink, 0.6, 0.8, 0.3, 0.7, 2.1, 1.65, { flat: true });
        H.b(RP.blush, 0.6, 0.4, 0.3, -1.2, 1.3, 1.62, { flat: true }).b(RP.blush, 0.6, 0.4, 0.3, 1.2, 1.3, 1.62, { flat: true });
      },
    }, spots[i][0], BASE_Y, spots[i][1]);
    people.push({ rig, phase: i * 1.4 });
  }

  // ---------------- celebration sparks (hidden until click) ----------------
  const sparkMat = glowMat(RP.gold, 0.8);
  const sparkDefs: [number, number][] = [
    [-0.34, 0.42],
    [-0.16, 0.62],
    [0, 0.78],
    [0.18, 0.6],
    [0.34, 0.44],
  ];
  const sparks: { m: THREE.Mesh; dx: number; dy: number }[] = [];
  for (const [dx, dy] of sparkDefs) {
    const m = sbox(group, u, sparkMat, 1.5, 1.5, 1.5, dx * 10, CLOTH_Y, BZ + 2);
    m.visible = false;
    sparks.push({ m, dx, dy });
  }

  group.rotation.y = Math.PI / 4;

  const selClock = makeSelectionClock();
  const RAISE_CYCLE = 5;
  const hop = { crouch: 0, lift: 0, air: 0 };
  const LEG = people[0].rig.legLen;

  return {
    group,
    update(t, hover, selected) {
      const sel = selClock(t, selected);
      const flash = sel >= 0 ? Math.exp(-sel * 4) : 0;
      const wobble = sel >= 0 ? Math.exp(-sel * 5) * Math.sin(sel * 22) : 0;
      const arc = sel >= 0 ? Math.sin((Math.min(sel, 0.5) / 0.5) * Math.PI) * Math.exp(-sel * 1.5) : 0;

      // ---- mentees: idle breathing / weight shift / look-around, a round of
      // applause every RAISE_CYCLE (one mentee at a time), and on click a
      // staggered crouch→jump→land, arms-up cheer, then alternating steps.
      const slot = Math.floor(t / RAISE_CYCLE) % people.length;
      const local = t % RAISE_CYCLE;
      for (let i = 0; i < people.length; i++) {
        const { rig, phase } = people[i];
        const br = 0.5 + 0.5 * osc(t, 3.1, phase);
        rig.torsoMesh.scale.set(1 + 0.015 * br, 1, 1 + 0.03 * br);
        const w = osc(t, 6.5, phase * 2);
        rig.hips.rotation.z = 0.04 * w;
        rig.torso.rotation.z = -0.035 * w;

        // click timeline (staggered per mentee)
        const s2 = sel >= 0 ? sel - i * 0.12 : -1;
        hopCurve(s2, hop);
        const cheer = s2 >= 0 ? ease(s2 / 0.25) * (1 - ease((s2 - 2.3) / 0.4)) : 0;
        const stepEnv = s2 >= 0.95 ? ease((s2 - 0.95) / 0.2) * (1 - ease((s2 - 2.3) / 0.3)) : 0;
        const stepPh = Math.sin((s2 - 0.95) * Math.PI * 2 * 1.8);

        // legs: weight shift + crouch/jump + alternating knee lifts
        const c = hop.crouch;
        for (const sd of [0, 1] as const) {
          const relax = Math.max(0, sd === 0 ? w : -w) * 0.18;
          const lift = stepEnv * Math.max(0, sd === 0 ? stepPh : -stepPh) * 0.55;
          setLeg(rig, sd, relax * 0.5 + c + lift, relax + 2 * c + lift * 1.7);
          rig.hip[sd].rotation.z = -rig.hips.rotation.z;
        }
        const bounce = stepEnv * Math.abs(stepPh) * 0.35;
        rig.hips.position.y = rig.hipsY - 2 * LEG * (1 - Math.cos(c)) + (hop.lift * 2.6 + bounce) * u;
        rig.torso.rotation.x = 0.2 * c + 0.01 * br;

        // head: look around a little, tip up when cheering
        rig.neck.rotation.y = 0.25 * osc(t, 8, phase * 3) * (1 - cheer);
        rig.neck.rotation.x = -0.2 * cheer - 0.1 * c;

        // arms: relaxed → clapping → cheering
        const clap = slot === i && local < 1.8 && sel < 0 ? ease(local / 0.3) * (1 - ease((local - 1.45) / 0.35)) : 0;
        const clapPh = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 3);
        const twist = -(0.5 + 0.55 * clapPh); // forearms swing in → hands meet
        for (const sd of [0, 1] as const) {
          const pump = 0.25 * Math.sin(s2 * Math.PI * 2 * 2 + sd * Math.PI);
          const rf = 0.04, ra = 0.1, rt = 0, rb = 0.25 + 0.05 * br; // relaxed
          let f = rf + (1.0 - rf) * clap, ab = ra + (0.05 - ra) * clap;
          let tw = rt + twist * clap, bd = rb + (1.75 - rb) * clap;
          f += (0.25 - f) * cheer;
          ab += (2.35 - ab) * cheer;
          // twist + elbow bend LEAD the shoulder (both on the way up and down),
          // so the forearms fold upward early and the arms never pass a T-pose
          const lead = Math.min(1, cheer * 3);
          tw += (1.5 - tw) * lead;
          bd += (0.6 + pump * cheer - bd) * lead;
          bd += Math.sin(cheer * Math.PI) * 1.1;
          setArm(rig, sd, f, ab, tw, bd);
        }
      }

      // banner ripple (+ one-shot wave)
      for (let i = 0; i < segs.length; i++) {
        const seg = segs[i];
        seg.rotation.y = 0.12 * osc(t, 1.8, i * 1.6) + wobble * 0.18;
        seg.position.z = (BZ + 0.4 * osc(t, 1.8, i * 1.6 + 0.5) + arc * 0.6 * (i === 0 ? 1 : -1)) * u;
      }

      // stars flare + pop (pivot scale = pure multiplier on merged geometry)
      starMat.emissiveIntensity = 0.3 + hover * 0.2 + flash * 1.1;
      const pop = 1 + arc * 0.5;
      for (let i = 0; i < stars.length; i++) stars[i].scale.setScalar(pop);

      noteMat.emissiveIntensity = 0.55 + 0.35 * Math.abs(osc(t, 1.3)) + hover * 0.3 + flash * 0.8;

      const spot = 0.7 + 0.3 * Math.abs(osc(t, 2.4)) + hover * 0.3 + flash * 1.6;
      ringMat.emissiveIntensity = spot;
      lampMat.emissiveIntensity = 0.6 + 0.4 * spot;

      // spark burst from the banner (ABSOLUTE size on sbox scale)
      if (sel >= 0) {
        const fade = Math.exp(-sel * 3);
        const fly = Math.sin((Math.min(sel, 0.6) / 0.6) * Math.PI);
        const on = fade > 0.04;
        const s = 1.5 * (0.6 + fade) * u;
        for (let i = 0; i < sparks.length; i++) {
          const sp = sparks[i];
          sp.m.visible = on;
          if (!on) continue;
          sp.m.position.set(
            (sp.dx * 10 + sp.dx * fly * 14) * u,
            (CLOTH_Y + sp.dy * fly * 7 + arc * 1.2) * u,
            (BZ + 2 + fly * 3) * u,
          );
          sp.m.scale.set(s, s, s);
          sp.m.rotation.z = sel * 6 * sp.dx;
        }
        sparkMat.emissiveIntensity = 0.8 + fade;
      } else {
        for (let i = 0; i < sparks.length; i++) sparks[i].m.visible = false;
      }
    },
  };
}
