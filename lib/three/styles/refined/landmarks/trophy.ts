import * as THREE from 'three';
import { makeSelectionClock, type BuiltModel } from '../../../kit';
import { Mesher, RP, piv, sbox, glowMat, unitFor, osc, TAU } from '../rkit';

/** 3×5 pixel digits (rows top → bottom). */
const DIGITS: Record<string, string[]> = {
  '1': ['.X.', 'XX.', '.X.', '.X.', 'XXX'],
  '2': ['XXX', '..X', 'XXX', 'X..', 'XXX'],
  '3': ['XXX', '..X', '.XX', '..X', 'XXX'],
};

/**
 * Awards — a cream 1-2-3 winner's podium with coloured top bands and pixel
 * numerals, a chunky stepped gold trophy slowly spinning on the centre block,
 * a pink banner with twinkling white stars behind, and two floating medals.
 * Confetti bursts every 9s; a click pops victory stars from the cup.
 * Grid units: 1 = 0.1 world.
 */
export function buildRefinedTrophy(): BuiltModel {
  const u = unitFor('awards');
  const group = new THREE.Group();

  // ---------------- static: podium, numerals, banner, resting confetti -----
  const M = new Mesher(u);
  M.c(RP.stoneShade, -14, 0, -7, 28, 1, 14, { top: RP.stone }); // ground slab
  const PODS = [
    { x0: -13, w: 8, top: 11, band: RP.teal, n: '2' },
    { x0: -5, w: 10, top: 14, band: RP.gold, n: '1' },
    { x0: 5, w: 8, top: 9, band: RP.coral, n: '3' },
  ];
  for (const p of PODS) {
    M.c(RP.stone, p.x0, 1, -6, p.w, p.top - 2, 12);
    M.c(p.band, p.x0, p.top - 1, -6, p.w, 1, 12); // coloured top band
    const g = DIGITS[p.n];
    const sx = p.x0 + p.w / 2 - 1.5;
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 3; c++) {
        if (g[r][c] === 'X') M.c(p.band, sx + c, p.top - 3 - r, 6, 1, 1, 0.5);
      }
    }
  }
  const CENTER_TOP = 14;
  /** Podium surface height under local (x, z). */
  const floorAt = (x: number, z: number) =>
    Math.abs(z) > 6 || Math.abs(x) > 13 ? 1 : x < -5 ? 11 : x < 5 ? CENTER_TOP : 9;

  // banner on two posts behind the podium
  M.c(RP.wood, -9.5, 1, -10, 1, 20, 1).c(RP.wood, 8.5, 1, -10, 1, 20, 1);
  M.c(RP.gold, -10, 21, -10.5, 2, 1, 2).c(RP.gold, 8, 21, -10.5, 2, 1, 2);
  M.c(RP.goldDark, -8.5, 20, -10, 17, 1, 1, { top: RP.gold }); // hanging rod
  M.c(RP.pink, -8, 12, -10, 16, 8, 1);
  M.c(RP.pinkDark, -8, 12, -10, 16, 1, 1); // hem
  M.c(RP.pink, -8, 10, -10, 4, 2, 1).c(RP.pink, 4, 10, -10, 4, 2, 1); // swallow-tail tabs
  M.c(RP.pinkDark, -8, 10, -10, 4, 1, 1).c(RP.pinkDark, 4, 10, -10, 4, 1, 1);

  // resting confetti — ON the podium surfaces
  const REST: [number, number, number][] = [
    [-11, 3, RP.gold], [-8, -2, RP.teal], [8, 2, RP.gold],
    [11, -3, RP.teal], [3.5, 4.5, RP.gold], [-4, -4.5, RP.teal],
  ];
  REST.forEach(([x, z, c], i) => {
    M.b(c, 1, 1, 1, x, floorAt(x, z) + 0.5, z, { ry: i * 0.7 });
  });
  M.to(group);

  // ---------------- banner stars (twinkle) ---------------------------------
  const starMat = glowMat(RP.white, 0.6);
  const STAR_POS: [number, number][] = [[-5.5, 17.5], [-3, 14.5], [0, 18], [3, 14.5], [5.5, 17.5]];
  const bannerStars = STAR_POS.map(([x, y], i) => {
    const s = sbox(group, u, starMat, 2, 2, 0.6, x, y, -8.7);
    s.rotation.z = Math.PI / 4 + i * 0.3;
    return s;
  });

  // ---------------- trophy (spins on the centre block) ---------------------
  const trophy = piv(group, u, 0, CENTER_TOP, 0);
  const TB = new Mesher(u);
  TB.c(RP.goldDark, -3, 0, -3, 6, 1, 6, { top: RP.gold });
  TB.c(RP.gold, -2, 1, -2, 4, 1, 4);
  TB.c(RP.goldDark, -1, 2, -1, 2, 2, 2);
  TB.c(RP.goldDark, -3, 8.5, -3, 6, 0.6, 6); // shadowed cup interior
  TB.b(RP.white, 2, 2, 0.5, 0, 7.5, 4.25, { rz: Math.PI / 4, flat: true }); // star emblem
  TB.to(trophy);
  const cupMat = glowMat(RP.gold, 0.3);
  const CP = new Mesher(u);
  CP.c(RP.gold, -2, 4, -2, 4, 1, 4);
  CP.c(RP.gold, -3, 5, -3, 6, 1, 6);
  CP.c(RP.gold, -4, 6, -4, 8, 3, 8);
  CP.c(RP.gold, -4, 9, -4, 8, 1, 1).c(RP.gold, -4, 9, 3, 8, 1, 1); // rim ring
  CP.c(RP.gold, -4, 9, -3, 1, 1, 6).c(RP.gold, 3, 9, -3, 1, 1, 6);
  for (const s of [-1, 1]) {
    // C-shaped handles
    CP.c(RP.gold, s > 0 ? 4 : -6, 8, -1, 2, 1, 2);
    CP.c(RP.gold, s > 0 ? 5 : -6, 5, -1, 1, 3, 2);
    CP.c(RP.gold, s > 0 ? 3 : -5, 5, -1, 2, 1, 2);
  }
  const cup = CP.build(cupMat);
  if (cup) trophy.add(cup);
  const CUP_TOP = CENTER_TOP + 10;

  // ---------------- floating medals ----------------------------------------
  const MEDAL_Y = 19;
  const medals = [-1, 1].map((side) => {
    const m = piv(group, u, side * 9.5, MEDAL_Y, 3);
    const MM = new Mesher(u);
    MM.c(RP.red, -1, 2, -0.5, 2, 5, 1);
    MM.c(RP.white, -0.5, 2, 0.5, 1, 5, 0.4, { flat: true }); // ribbon stripe
    MM.c(RP.gold, -2, -1, -0.5, 4, 2, 1);
    MM.c(RP.gold, -1, -2, -0.5, 2, 4, 1);
    MM.c(RP.gold, -1.5, -1.5, -0.5, 3, 3, 1);
    MM.c(RP.amber, -1, -1, 0.5, 2, 2, 0.4);
    MM.to(m);
    return m;
  });

  // ---------------- confetti burst pool (hidden) ---------------------------
  const BURST_N = 10;
  const BURST_Y = CENTER_TOP + 0.5;
  const confA = glowMat(RP.gold, 0.4);
  const confB = glowMat(RP.teal, 0.4);
  const burst: THREE.Mesh[] = [];
  for (let i = 0; i < BURST_N; i++) {
    const a = (i / BURST_N) * TAU;
    const v = sbox(group, u, i % 2 === 0 ? confA : confB, 1, 1, 1, Math.cos(a) * 3, BURST_Y, Math.sin(a) * 3);
    v.visible = false;
    burst.push(v);
  }

  // ---------------- victory stars (hidden, click) --------------------------
  const SEL_N = 7;
  const selStars: THREE.Mesh[] = [];
  const selStarMats: THREE.MeshToonMaterial[] = [];
  for (let i = 0; i < SEL_N; i++) {
    const sm = glowMat(i % 2 === 0 ? RP.gold : RP.white, 1);
    sm.transparent = true;
    const s = sbox(group, u, sm, 2, 2, 2, 0, CUP_TOP, 0);
    s.visible = false;
    selStars.push(s);
    selStarMats.push(sm);
  }

  group.rotation.y = Math.PI / 4;

  const selClock = makeSelectionClock();

  return {
    group,
    update(t, hover, selected) {
      const sel = selClock(t, selected);
      const flash = sel >= 0 ? Math.exp(-sel * 4) : 0;

      // trophy slow spin + gleam as the cup faces the camera
      trophy.rotation.y = (t / 12) * TAU;
      const facing = Math.max(0, Math.cos(trophy.rotation.y));
      const pulse = 0.25 + 0.75 * facing * facing + 0.15 * Math.abs(osc(t, 1.5)) + hover * 0.25;
      cupMat.emissiveIntensity = pulse * (1 + flash * 1.6);

      // click: victory hop + springy wobble
      if (sel >= 0) {
        const arc = Math.sin((Math.min(sel, 0.5) / 0.5) * Math.PI) * Math.exp(-sel * 1.5);
        const wobble = Math.exp(-sel * 5) * Math.sin(sel * 22);
        trophy.position.y = (CENTER_TOP + arc * 2.5) * u;
        trophy.scale.setScalar(1 + wobble * 0.07);

        const fade = Math.exp(-sel * 2.2);
        for (let i = 0; i < SEL_N; i++) {
          const s = selStars[i];
          s.visible = fade > 0.02;
          const a = (i / SEL_N) * TAU;
          const spread = 2.5 + Math.min(sel, 1) * 6;
          s.position.set(Math.cos(a) * spread * u, (CUP_TOP + arc * 6 + sel * 2) * u, Math.sin(a) * spread * u);
          s.rotation.set(sel * 7 + a, sel * 6, sel * 5);
          const pop = (0.6 + 0.6 * fade) * (i % 2 === 0 ? 1 : 0.8);
          s.scale.setScalar(2 * pop * u); // absolute size
          selStarMats[i].opacity = fade;
          selStarMats[i].emissiveIntensity = 0.8 + flash * 1.5;
        }
      } else {
        trophy.position.y = CENTER_TOP * u;
        trophy.scale.setScalar(1);
        for (const s of selStars) s.visible = false;
      }

      // medals bob + twist
      for (let i = 0; i < medals.length; i++) {
        const ph = i * Math.PI;
        medals[i].position.y = (MEDAL_Y + osc(t, 2.4, ph)) * u;
        medals[i].rotation.y = osc(t, 3, ph) * 0.5;
      }

      // banner stars twinkle (absolute size)
      for (let i = 0; i < bannerStars.length; i++) {
        const sc = 0.85 + 0.35 * Math.abs(osc(t, 1.2, i * 1.3));
        bannerStars[i].scale.set(2 * sc * u, 2 * sc * u, 0.6 * u);
      }

      // confetti burst every 9s — lands on whichever podium step is below
      const local = t % 9;
      const dur = 1.4;
      if (local < dur) {
        const phase = local / dur;
        const y = BURST_Y + 11.6 * local - 9 * local * local;
        for (let i = 0; i < BURST_N; i++) {
          const v = burst[i];
          v.visible = true;
          const ang = (i / BURST_N) * TAU;
          const spread = 3 + phase * 8;
          const x = Math.cos(ang) * spread;
          const z = Math.sin(ang) * spread;
          v.position.set(x * u, Math.max(floorAt(x, z) + 0.5, y) * u, z * u);
          v.rotation.set(local * 6 + ang, local * 5, local * 4);
        }
      } else {
        for (const v of burst) v.visible = false;
      }
    },
  };
}
