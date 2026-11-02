import * as THREE from 'three';
import { makeSelectionClock, type BuiltModel } from '../../../kit';
import { Mesher, RP, piv, sbox, glowMat, unitFor, osc, TAU } from '../rkit';

/**
 * Projects — a light-wood maker's workbench with a cream pegboard (chunky
 * wrench, hammer and amber set-square silhouettes). On the bench: a spinning
 * stepped-voxel globe, a pink/violet brain, an upright octagon gear and a
 * framed canvas with a glint sweep; a glowing amber idea bulb orbits above with
 * sparkles. Click: the screwdriver hops, the gear kicks, embers fly.
 * Grid units: 1 = 0.1 world.
 */
export function buildRefinedProjects(): BuiltModel {
  const u = unitFor('projects');
  const group = new THREE.Group();
  const M = new Mesher(u);

  // ---------------- workbench (top surface y = 12) ------------------------
  const S = 12;
  M.c(RP.woodLight, -12, 10, -5, 24, 2, 10); // top slab
  M.c(RP.wood, -11, 9, 4, 22, 1, 1); // front apron
  for (const x of [-12, 10]) for (const z of [-5, 3]) M.c(RP.wood, x, 0, z, 2, 10, 2); // legs
  M.c(RP.wood, -11, 3, -4, 22, 1, 8); // lower shelf
  M.c(RP.stoneShade, -9, 4, -3, 4, 3, 4).c(RP.stone, -4, 4, -3, 5, 2, 4); // crates on shelf
  M.c(RP.woodDark, 4, 4, -3, 6, 2, 3, { top: RP.wood }); // plank stack

  // ---------------- pegboard back panel -----------------------------------
  M.c(RP.wood, -14, 0, -8, 2, 27, 2).c(RP.wood, 12, 0, -8, 2, 27, 2); // posts
  M.c(RP.stone, -12, 12, -7, 24, 13, 1); // cream board y 12..25, front z -6
  M.c(RP.woodLight, -14, 25, -8, 28, 2, 3); // header beam
  // wrench (metal)
  M.c(RP.metal, -10, 14, -6, 4, 2, 1); // ring end
  M.c(RP.metal, -9, 16, -6, 2, 5, 1); // handle
  M.c(RP.metal, -10, 21, -6, 4, 1, 1); // head
  M.c(RP.metal, -10, 22, -6, 1, 2, 1).c(RP.metal, -7, 22, -6, 1, 2, 1); // jaws
  // hammer
  M.c(RP.woodDark, -2, 14, -6, 2, 8, 1, { top: RP.wood }); // handle
  M.c(RP.metalDark, -5, 21, -6, 8, 3, 1, { top: RP.metal }); // head
  // amber set-square (stepped triangle)
  for (let i = 0; i < 7; i++) M.c(RP.amber, 5, 14 + i, -6, 7 - i, 1, 1);
  M.c(RP.stone, 6, 15, -5.9, 2, 2, 1); // cut-out hole reads as board showing through
  // hook pegs
  for (const x of [-8.5, -0.5, 7.5]) M.c(RP.metalDark, x, 24, -6, 1, 1, 1);

  // static stands for the bench artifacts
  M.c(RP.woodDark, -11, S, -2, 4, 1, 4, { top: RP.wood }); // globe pedestal
  M.c(RP.metal, -9.5, S + 1, -0.5, 1, 2, 1); // globe stem
  M.c(RP.woodDark, 1, S, -1.5, 5, 1, 3, { top: RP.wood }); // gear foot
  M.c(RP.metalDark, 3, S + 1, -1, 1, 4.5, 1); // gear axle post
  M.c(RP.woodDark, 8, S, -3.5, 5, 1, 3, { top: RP.wood }); // canvas ledge
  M.to(group);

  // ---------------- 1) stepped voxel globe --------------------------------
  const GLOBE_Y = S + 3 + 2.5;
  const globe = piv(group, u, -9, GLOBE_Y, 0);
  const globeSpin = piv(globe, u, 0, 0, 0);
  const G = new Mesher(u);
  [3, 5, 5, 5, 3].forEach((w, i) => G.b(RP.teal, w, 1, w, 0, i - 2, 0));
  G.b(RP.leafMid, 2, 2, 1, 0.5, 0.5, 2.7).b(RP.leafMid, 1, 2, 2, -2.7, -0.5, -0.5);
  G.b(RP.leafMid, 2, 1, 1, -0.5, -1, -2.7).b(RP.white, 1, 1, 1, 0, 2.6, 0); // ice cap
  G.to(globeSpin);

  // ---------------- 2) brain cluster --------------------------------------
  const BRAIN_Y = S;
  const brain = piv(group, u, -3, BRAIN_Y, -1.5);
  const brainSpin = piv(brain, u, 0, 0, 0);
  const Br = new Mesher(u);
  Br.b(RP.pinkDark, 2, 1, 2, 0, 0.5, 0); // stem
  Br.b(RP.pink, 3, 4, 4, -1.5, 3, 0).b(RP.violet, 3, 4, 4, 1.5, 3, 0); // hemispheres
  Br.b(RP.pink, 2, 1, 3, -1.5, 5.5, 0).b(RP.violet, 2, 1, 3, 1.5, 5.5, 0); // crowns
  Br.b(RP.pinkDark, 1, 1, 1, -1.5, 3, 2.2).b(RP.violetDark, 1, 1, 1, 1.5, 2, 2.2); // folds
  Br.to(brainSpin);
  const neuronMat = glowMat(RP.white, 1);
  sbox(brainSpin, u, neuronMat, 2, 2, 2, 0.5, 8, 0.5);

  // ---------------- 3) upright octagon gear (spins about z) ----------------
  const GEAR_Y = S + 5.5;
  const gear = piv(group, u, 3.5, GEAR_Y, 1);
  const gearSpin = piv(gear, u, 0, 0, 0);
  const Ge = new Mesher(u);
  Ge.b(RP.metal, 4, 4, 2, 0, 0, 0).b(RP.metal, 4, 4, 2, 0, 0, 0, { rz: Math.PI / 4 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    Ge.b(RP.metal, 2, 2, 2, Math.cos(a) * 3, Math.sin(a) * 3, 0, { rz: a });
  }
  Ge.b(RP.goldDark, 2, 2, 2.6, 0, 0, 0); // hub
  Ge.to(gearSpin);

  // ---------------- 4) framed canvas card + glint --------------------------
  const CANVAS_Y = S + 1;
  const canvas = piv(group, u, 10.5, CANVAS_Y, -2);
  const canvasSpin = piv(canvas, u, 0, 0, 0);
  canvasSpin.rotation.x = -0.15;
  const Cv = new Mesher(u);
  Cv.c(RP.gold, -3, 0, -0.5, 6, 8, 1); // frame
  Cv.c(RP.white, -2, 1, 0.5, 4, 6, 0.4, { flat: true }); // canvas face
  Cv.c(RP.teal, -1.5, 4, 0.9, 2, 2, 0.3, { flat: true }); // motif
  Cv.c(RP.pink, 0, 1.5, 0.9, 1.5, 1.5, 0.3, { flat: true });
  Cv.to(canvasSpin);
  const glintMat = glowMat(0xfff1c8, 1);
  const glint = sbox(canvasSpin, u, glintMat, 1, 6, 0.3, -1.5, 4, 1.15);

  // ---------------- screwdriver (hops on click) ---------------------------
  const TOOL_Y = S + 1;
  const tool = piv(group, u, 1, TOOL_Y, 4);
  const Tl = new Mesher(u);
  Tl.b(RP.red, 4, 2, 2, -2, 0, 0).b(RP.metal, 4, 1, 1, 2, -0.5, 0);
  Tl.to(tool);

  // ---------------- floating idea bulb + sparkles -------------------------
  const ORBIT_Y = 24.5;
  const orbit = piv(group, u, 0, ORBIT_Y, 2);
  const bulbPiv = piv(orbit, u, 5, 0, 0);
  const bulbMat = glowMat(RP.amber, 1.2);
  const bulb = sbox(bulbPiv, u, bulbMat, 3, 3, 3, 0, 0.5, 0);
  const Bc = new Mesher(u);
  Bc.b(RP.metal, 2, 1, 2, 0, -1.5, 0); // screw cap
  Bc.to(bulbPiv);
  const sparkleBase: [number, number, number][] = [
    [-5, 0, 2],
    [4, 1.5, -4],
    [-2, 2.5, -3],
  ];
  const sparkles: { m: THREE.Mesh; mat: THREE.MeshToonMaterial }[] = [];
  for (const [x, y, z] of sparkleBase) {
    const mat = glowMat(0xfff1b8, 1);
    sparkles.push({ m: sbox(orbit, u, mat, 1, 1, 1, x, y, z), mat });
  }

  // ---------------- build-burst embers (hidden until click) ---------------
  const EO = { x: 1, y: S + 1, z: 1 };
  const emberAmber = glowMat(RP.amber, 1.4);
  const emberGold = glowMat(RP.gold, 1.4);
  const embers: { m: THREE.Mesh; dx: number; dy: number; dz: number; size: number }[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + 0.3;
    const len = Math.hypot(1, 1.4);
    const size = i % 2 ? 2 : 1.5;
    const m = sbox(group, u, i % 2 ? emberGold : emberAmber, size, size, size, EO.x, EO.y, EO.z);
    m.visible = false;
    embers.push({ m, dx: Math.cos(a) / len, dy: 1.4 / len, dz: Math.sin(a) / len, size });
  }

  group.rotation.y = Math.PI / 4;

  const selClock = makeSelectionClock();
  const bobbers = [
    { p: globe, baseY: GLOBE_Y, phase: 0 },
    { p: brain, baseY: BRAIN_Y, phase: 1.4 },
    { p: gear, baseY: GEAR_Y, phase: 2.6 },
    { p: canvas, baseY: CANVAS_Y, phase: 3.9 },
  ];

  return {
    group,
    update(t, hover, selected) {
      const sel = selClock(t, selected);
      const flash = sel >= 0 ? Math.exp(-sel * 4) : 0;
      const wobble = sel >= 0 ? Math.exp(-sel * 5) * Math.sin(sel * 22) : 0;
      const arc = sel >= 0 ? Math.sin((Math.min(sel, 0.5) / 0.5) * Math.PI) * Math.exp(-sel * 1.5) : 0;

      // staggered bob + gentle sway on every bench artifact
      for (let i = 0; i < bobbers.length; i++) {
        const b = bobbers[i];
        b.p.position.y = (b.baseY + 0.5 * osc(t, 2.4, b.phase)) * u;
        b.p.rotation.y = 0.4 * osc(t, 6, b.phase);
      }

      globeSpin.rotation.y = (t / 16) * TAU;
      brainSpin.rotation.y = (t / 9) * TAU;
      neuronMat.emissiveIntensity = 0.6 + 0.8 * Math.abs(osc(t, 1.6));
      gearSpin.rotation.z = -(t / 7) * TAU + wobble * 0.9;

      // canvas glint sweep left → right
      const g = (t * 0.5) % 1;
      glint.position.x = (-1.5 + g * 3) * u;
      glintMat.emissiveIntensity = 0.2 + 1.3 * Math.sin(g * Math.PI);

      // idea bulb orbits + pulses; pops on click (pivot scale = multiplier)
      orbit.rotation.y = (t / 12) * TAU;
      orbit.position.y = (ORBIT_Y + 0.6 * osc(t, 3.5)) * u;
      bulbMat.emissiveIntensity = 1.1 + 0.6 * Math.abs(osc(t, 2)) + 0.3 * hover + 2.4 * flash;
      bulbPiv.scale.setScalar(1 + 0.35 * flash);
      bulb.rotation.y = 0.3 * osc(t, 4);

      // sparkles drift up + twinkle (ABSOLUTE size on sbox scale)
      for (let i = 0; i < sparkles.length; i++) {
        const sp = sparkles[i];
        const ph = i * 2.1;
        const tw = Math.abs(osc(t, 1.1, ph));
        const drift = (t * 0.15 + i * 0.33) % 1;
        sp.m.position.y = (sparkleBase[i][1] + drift * 2) * u;
        const s = (0.8 + 0.6 * tw + 0.8 * flash) * u;
        sp.m.scale.set(s, s, s);
        sp.mat.emissiveIntensity = 0.4 + 1.2 * tw + 1.6 * flash;
      }

      if (sel >= 0) {
        tool.position.y = (TOOL_Y + 2.5 * arc) * u;
        tool.rotation.z = 0.5 * arc;
        gear.scale.setScalar(1 + 0.18 * Math.max(0, wobble));
        const on = flash > 0.02;
        const spread = sel * 7;
        for (let i = 0; i < embers.length; i++) {
          const e = embers[i];
          e.m.visible = on;
          if (!on) continue;
          e.m.position.set(
            (EO.x + e.dx * spread) * u,
            (EO.y + e.dy * spread - 5.4 * sel * sel) * u,
            (EO.z + e.dz * spread) * u,
          );
          const s = e.size * (0.4 + 1.3 * arc + 0.3 * flash) * u;
          e.m.scale.set(s, s, s);
          e.m.rotation.set(sel * 6, sel * 5 + i, sel * 4);
        }
        emberAmber.emissiveIntensity = 0.6 + 2 * flash;
        emberGold.emissiveIntensity = 0.6 + 2 * flash;
      } else {
        tool.position.y = TOOL_Y * u;
        tool.rotation.z = 0;
        gear.scale.setScalar(1);
        for (let i = 0; i < embers.length; i++) embers[i].m.visible = false;
      }
    },
  };
}
