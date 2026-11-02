import * as THREE from 'three';
import { makeSelectionClock, type BuiltModel } from '../../../kit';
import { Mesher, RP, piv, sbox, glowMat, glassMat, unitFor, osc, clamp, color } from '../rkit';
import { buildRig, setArm, setLeg, hopCurve, ease } from '../rig';

/**
 * About — Daewon on an octagonal plank deck: a chibi character (big readable
 * head, browline glasses, light teal hoodie) holding a glowing tablet and
 * waving, with a floating @vinyl810 holo sign and a warm deck lantern.
 * Grid units: 1 = 0.1 world.
 */
export function buildRefinedHub(): BuiltModel {
  const u = unitFor('about');
  const group = new THREE.Group();
  const M = new Mesher(u);
  const eyes: THREE.Group[] = [];

  // ---------------- deck: stone octagon + wood planks + front step ---------
  M.c(RP.stoneShade, -15, 0, -10, 30, 3, 20).c(RP.stoneShade, -10, 0, -15, 20, 3, 30);
  for (let x = -14; x < 14; x += 4) {
    const half = Math.abs(x + 2) <= 9 ? 14 : 9;
    const col = ((x + 14) / 4) % 2 === 0 ? RP.woodLight : RP.wood;
    M.c(col, x, 3, -half, 4, 2, half * 2);
  }
  M.c(RP.stone, -5, 0, 15, 10, 2, 3); // front step
  const F = 5; // feet height
  M.to(group);

  // ---------------- character: hierarchical rig (see ../rig.ts) -----------
  // Natural proportions (head ~1/4.7 of ~33 units), rounded segments that
  // overlap into rounded joint caps so every bend stays continuous.
  const HOOD = RP.teal;
  const HOOD_D = RP.tealDark;
  const rig = buildRig(group, {
    u,
    footH: 1.5, footL: 4.4, shin: 5.5, thigh: 5.5, legW: 2.8, hipX: 1.6,
    pelvis: [7.2, 3, 4.4], waist: [6.6, 4, 4.3], chest: [9, 5.5, 5],
    upper: 5, fore: 4.3, armW: 2.4, shoulderX: 5.0, hand: 1.9, neck: 1.4,
    color: {
      shoe: RP.white, pants: 0x4a6aa8, pantsDark: 0x3d5a93,
      shirt: HOOD, shirtDark: HOOD_D, sleeve: HOOD, skin: RP.skin, skinShade: RP.skinShade,
    },
    torsoDetail: (T) => {
      T.b(HOOD_D, 4, 1.5, 0.5, 0, 2.2, 2.2); // pouch pocket
      T.b(RP.white, 0.6, 5, 0.4, 0, 6.6, 2.6); // zipper
      T.b(RP.white, 0.6, 2, 0.4, -1.2, 8, 2.6).b(RP.white, 0.6, 2, 0.4, 1.2, 8, 2.6); // drawstrings
      T.r(HOOD, 6, 2.2, 2.4, 0, 9.3, -2.2, 0.5); // hood bunched behind the neck
    },
    head: (H, head) => {
      H.r(RP.skin, 6.4, 7, 6, 0, 3.5, 0, 1); // skull/face
      H.b(RP.skin, 4.4, 1, 4, 0, 0.3, 0.4); // softer jaw/chin
      H.r(RP.hair, 7.2, 3.4, 6.8, 0, 6.5, -0.2, 1.1); // rounded cap
      H.b(RP.hair, 5.6, 1, 4.4, 0, 6.4, -0.2).b(RP.hair, 4, 1, 6, 0, 6.4, -0.2); // fill the cap shoulders
      H.r(RP.hair, 6.8, 4.5, 2, 0, 4, -2.7, 0.6); // back of the hair
      H.b(RP.hair, 0.8, 2.5, 3.5, -3.2, 4.6, -0.8).b(RP.hair, 0.8, 2.5, 3.5, 3.2, 4.6, -0.8); // sideburns
      H.b(RP.hair, 5.6, 1, 0.8, -0.3, 5.4, 2.9); // fringe swept left
      H.b(RP.hair, 2, 0.6, 0.8, -2, 4.7, 2.9);
      // browline glasses: dark top rims + bridge + temples
      H.b(RP.ink, 2.2, 0.6, 0.4, -1.4, 4.6, 3.1).b(RP.ink, 2.2, 0.6, 0.4, 1.4, 4.6, 3.1);
      H.b(RP.ink, 0.6, 0.4, 0.4, 0, 4.4, 3.1);
      H.b(RP.ink, 0.4, 0.5, 3.5, -3.2, 4.4, 1.2).b(RP.ink, 0.4, 0.5, 3.5, 3.2, 4.4, 1.2);
      H.b(RP.blush, 1, 0.5, 0.3, -2.1, 2.3, 3.05, { flat: true }).b(RP.blush, 1, 0.5, 0.3, 2.1, 2.3, 3.05, { flat: true });
      H.b(RP.coralDark, 1.6, 0.5, 0.3, 0, 1.6, 3.05, { flat: true });
      for (const ex of [-1.4, 1.4]) {
        const e = piv(head, u, ex, 3.6, 3.05);
        const E = new Mesher(u);
        E.b(RP.ink, 1, 1.4, 0.4, 0, 0, 0, { flat: true }).b(RP.white, 0.5, 0.5, 0.3, 0.25, 0.35, 0.15, { flat: true });
        E.to(e);
        eyes.push(e);
      }
    },
  }, 0, F, 0);

  // Rest pose. The TABLET is parented to the left forearm (elbow pivot) so it
  // is genuinely held; its placement is solved once in the rest pose.
  const TAB_ARM = { flex: 0.2, abd: 0.12, twist: -0.25, bend: 1.35 };
  setArm(rig, 0, TAB_ARM.flex, TAB_ARM.abd, TAB_ARM.twist, TAB_ARM.bend);
  setArm(rig, 1, 0.05, 0.12, 0, 0.25);
  group.updateMatrixWorld(true);
  const tablet = new THREE.Group();
  {
    const hand = new THREE.Vector3(0, (-rig.spec.fore - 1) * u, 0);
    rig.elbow[0].localToWorld(hand);
    group.worldToLocal(hand); // hand in builder space
    const want = new THREE.Object3D();
    want.position.set(hand.x + 1.2 * u, hand.y + 1.4 * u, hand.z + 1.2 * u);
    want.rotation.set(-1.15, 0, 0.25);
    want.updateMatrix();
    const elbowInGroup = new THREE.Matrix4()
      .copy(group.matrixWorld).invert().multiply(rig.elbow[0].matrixWorld);
    const local = elbowInGroup.invert().multiply(want.matrix);
    local.decompose(tablet.position, tablet.quaternion, tablet.scale);
    rig.elbow[0].add(tablet);
  }
  const TB = new Mesher(u);
  TB.r(RP.ink, 5, 6, 0.8, 0, 0, 0, 0.3);
  TB.to(tablet);
  const screenMat = glowMat(RP.tealDark, 0.6);
  sbox(tablet, u, screenMat, 4, 5, 0.4, 0, 0, 0.35);
  const waveCells: THREE.Mesh[] = [];
  const waveMats: THREE.MeshToonMaterial[] = [];
  const waveBase = [-1.4, -1.4, -0.1, -0.1];
  for (let i = 0; i < 4; i++) {
    const m = glowMat(i % 2 === 0 ? RP.waterLight : RP.white, 0.9);
    waveMats.push(m);
    waveCells.push(sbox(tablet, u, m, 1.2, 1, 0.4, i % 2 === 0 ? -0.9 : 0.9, waveBase[i], 0.6));
  }
  const nAMat = glowMat(RP.violet, 1);
  const nBMat = glowMat(RP.pink, 1);
  sbox(tablet, u, nAMat, 1.2, 1.2, 0.4, -0.9, 1.5, 0.6);
  sbox(tablet, u, nBMat, 1.2, 1.2, 0.4, 0.9, 1.5, 0.6);

  // ---------------- floating holo sign @vinyl810 ---------------------------
  const HOLO_Y = F + 15;
  const holo = piv(group, u, 10, HOLO_Y, 6);
  holo.rotation.y = -0.35;
  const panelMat = glassMat(RP.teal, 0.55, 0.5);
  sbox(holo, u, panelMat, 10, 5, 0.6, 0, 0, 0);
  const textMat = glowMat(RP.white, 1);
  // "@" glyph (3×3 ring) + name bars
  const at: [number, number][] = [[-4, 1], [-3, 1], [-2, 1], [-4, 0], [-2, 0], [-4, -1], [-3, -1], [-2, -1]];
  const G = new Mesher(u);
  for (const [x, y] of at) G.b(RP.white, 1, 1, 0.4, x, y, 0.5);
  G.b(RP.white, 5, 1, 0.4, 1.5, 1, 0.5).b(RP.white, 3, 1, 0.4, 0.5, -1, 0.5);
  holo.add(G.build(textMat)!);
  // little stand pin under the sign
  sbox(holo, u, glassMat(RP.teal, 0.35, 0.4), 1, 4, 0.6, 0, -4.5, 0);

  // ---------------- deck lantern (real night light) ------------------------
  const LX = -10.5, LZ = 7.5;
  const L = new Mesher(u);
  L.c(RP.woodDeep, LX - 1.5, 5, LZ - 1.5, 3, 1, 3);
  L.c(RP.ink, LX - 0.5, 6, LZ - 0.5, 1, 10, 1);
  L.c(RP.woodDeep, LX - 2, 16, LZ - 2, 4, 1, 4, { top: RP.coral });
  L.c(RP.woodDeep, LX - 1, 17, LZ - 1, 2, 1, 2, { top: RP.coral });
  L.to(group);
  const bulbMat = glowMat(RP.amber, 1.2);
  sbox(group, u, bulbMat, 3, 3, 3, LX, 14.5, LZ);
  const deckLight = new THREE.PointLight(color(0xffca7a), 0, 4.5, 1.8);
  deckLight.position.set(LX * u, 14.5 * u, LZ * u);
  deckLight.userData.nightBase = 2.0;
  group.add(deckLight);

  group.rotation.y = Math.PI / 4;

  const selClock = makeSelectionClock();
  const holoBaseY = HOLO_Y * u;
  const BLINK = 5.5;
  const hop = { crouch: 0, lift: 0, air: 0 };
  const JUMP = 3.5 * u;
  const LEG = rig.legLen;

  return {
    group,
    nightLight: deckLight,
    update(t, hover, selected) {
      const sel = selClock(t, selected);
      const flash = sel >= 0 ? Math.exp(-sel * 4) : 0;
      const wobble = sel >= 0 ? Math.exp(-sel * 5) * Math.sin(sel * 22) : 0;
      const greet = sel >= 0 ? Math.sin((Math.min(sel, 0.55) / 0.55) * Math.PI) * Math.exp(-sel * 2) : 0;
      hopCurve(sel, hop);

      // ---- breathing (chest mesh only -> no joint offsets) + weight shift
      const br = 0.5 + 0.5 * osc(t, 3.4);
      rig.torsoMesh.scale.set(1 + 0.014 * br, 1, 1 + 0.03 * br);
      const w = osc(t, 7.5); // -1..1 weight from one leg to the other
      rig.hips.rotation.z = 0.035 * w;
      rig.torso.rotation.z = -0.03 * w;
      rig.torso.rotation.x = 0.015 * br + 0.18 * hop.crouch; // lean into the crouch
      for (const sd of [0, 1] as const) {
        const relax = Math.max(0, sd === 0 ? w : -w) * 0.16; // unweighted knee softens
        const c = hop.crouch;
        setLeg(rig, sd, relax * 0.5 + c, relax + 2 * c);
        rig.hip[sd].rotation.z = -rig.hips.rotation.z;
      }
      rig.hips.position.y =
        rig.hipsY - 2 * LEG * (1 - Math.cos(hop.crouch)) - 0.01 * Math.abs(w) + hop.lift * JUMP;

      // ---- head: occasional look-around, nod + friendly tilt on click
      const lk = t % 9;
      const look = lk > 2.5 && lk < 5.5 ? ease((lk - 2.5) / 0.5) * (1 - ease((lk - 5) / 0.5)) : 0;
      const nod = sel >= 0 ? Math.sin(sel * 9) * Math.exp(-sel * 3.4) : 0;
      rig.neck.rotation.y = 0.32 * look * Math.sin(Math.floor(t / 9) * 2.1 + 1);
      rig.neck.rotation.x = greet * 0.18 + nod * 0.1 - 0.12 * hop.crouch + 0.02 * br;
      rig.neck.rotation.z = greet * 0.12;
      const sy = t % BLINK < 0.12 ? 0.15 : 1;
      eyes[0].scale.y = sy;
      eyes[1].scale.y = sy;

      // ---- tablet arm: held with a bent elbow, tiny breathing drift
      setArm(rig, 0, TAB_ARM.flex + 0.02 * br + 0.25 * hop.air, TAB_ARM.abd + 0.15 * hop.air,
        TAB_ARM.twist, TAB_ARM.bend - 0.05 * br);

      // ---- wave arm: shoulder raises, elbow bends up, forearm swings
      const lp = t % 6;
      let we = lp < 2.4 ? ease(lp / 0.45) * (1 - ease((lp - 1.95) / 0.45)) : 0;
      if (sel >= 0) we = Math.max(we, ease(sel / 0.3) * (1 - ease((sel - 1.8) / 0.5)));
      const swing = Math.sin(t * Math.PI * 2 * 1.6) * (0.35 + 0.15 * (sel >= 0 ? Math.exp(-sel) : 0));
      const relaxBend = 0.22 + 0.04 * br;
      setArm(rig, 1,
        0.05 + 0.2 * we,
        0.12 + (1.35 - 0.12) * we + 0.2 * hop.air * (1 - we),
        1.5 * we,
        relaxBend + (1.45 + swing - relaxBend) * we);

      for (let i = 0; i < 4; i++) {
        waveMats[i].emissiveIntensity = 0.5 + 0.7 * (0.5 + 0.5 * osc(t, 1.4, i * 0.9));
        waveCells[i].position.y = (waveBase[i] + 0.4 * osc(t, 1.2, i)) * u;
      }
      nAMat.emissiveIntensity = 0.5 + 0.8 * Math.abs(osc(t, 1.1));
      nBMat.emissiveIntensity = 0.5 + 0.8 * Math.abs(osc(t, 1.1, 1.6));
      screenMat.emissiveIntensity = 0.55 + 0.15 * osc(t, 2) + hover * 0.25 + greet * 0.7;

      holo.position.y = holoBaseY + 0.05 * osc(t, 3) + greet * 0.1;
      panelMat.opacity = clamp(0.45 + 0.15 * (0.5 + 0.5 * osc(t, 2.5)) + hover * 0.1 + flash * 0.4, 0, 1);
      const pop = 1 + greet * 0.16 + wobble * 0.08;
      holo.scale.set(pop, pop, 1);

      bulbMat.emissiveIntensity = 1.2 * (1 + 0.08 * osc(t, 0.4) * (0.6 + 0.4 * osc(t, 0.13))) + flash * 0.9;
    },
  };
}
