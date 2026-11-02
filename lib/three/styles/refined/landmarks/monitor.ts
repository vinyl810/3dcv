import * as THREE from 'three';
import { makeSelectionClock, type BuiltModel } from '../../../kit';
import { Mesher, RP, piv, sbox, glowMat, unitFor, osc, TAU } from '../rkit';

/**
 * Work @ KOAST — oceanic 3D GIS digital twin. A chunky light-grey widescreen
 * monitor on a stone plinth: deep-blue screen with a spinning stepped-voxel
 * globe hologram (land voxels + data pins), a bar-chart panel and a sweeping
 * scanline; in front, a 6×3 voxel wave-field ripples in a stone pool.
 * Kept LOW (≤ 22 units) — it sits in front of the hub from the camera.
 * Grid units: 1 = 0.1 world.
 */
export function buildRefinedMonitor(): BuiltModel {
  const u = unitFor('work');
  const group = new THREE.Group();
  const M = new Mesher(u);

  // ---------------- plinth + wave pool ------------------------------------
  M.c(RP.stoneShade, -13, 0, -12, 26, 2, 25); // plinth (z -12..13)
  M.c(RP.stone, -12, 2, -11, 24, 1, 9); // monitor pad
  // pool rim (light stone) + deep water floor
  M.c(RP.stone, -13, 2, -1, 26, 2, 1).c(RP.stone, -13, 2, 12, 26, 2, 1);
  M.c(RP.stone, -13, 2, 0, 1, 2, 12).c(RP.stone, 12, 2, 0, 1, 2, 12);
  M.c(RP.waterDeep, -12, 2, 0, 24, 1, 12, { flat: true });

  // ---------------- stand + monitor body (front face at z = -4) -----------
  M.c(RP.metalDark, -5, 3, -10, 10, 1, 6); // foot
  M.c(RP.metal, -2, 4, -9, 4, 5, 3); // neck
  M.c(RP.metal, -12, 8, -7, 24, 13, 3); // bezel x -12..12, y 8..21
  M.c(RP.stoneShade, -7, 10, -9, 14, 9, 2); // back hump
  M.c(RP.metalDark, -12, 8, -4, 24, 1, 0.4, { flat: true }); // chin shadow line
  M.c(RP.teal, 9, 8.5, -4, 2, 1, 0.5, { flat: true }); // power LED
  M.to(group);

  const SCREEN_Y = 15; // screen spans y 10..20, x -11..11
  const SZ = -3.8; // screen face centre z
  const screenMat = glowMat(RP.screen, 0.8);
  sbox(group, u, screenMat, 22, 10, 0.4, 0, SCREEN_Y, SZ);

  // bar-chart / data panel on the right half of the screen (one glow mesh)
  const C = new Mesher(u);
  C.c(RP.waterLight, 3, 11, -3.6, 2, 3, 0.4);
  C.c(RP.waterLight, 6, 11, -3.6, 2, 5, 0.4);
  C.c(RP.waterLight, 9, 11, -3.6, 1, 4, 0.4);
  C.c(RP.waterLight, 3, 18, -3.6, 7, 1, 0.4); // title bar
  C.c(RP.waterLight, 3, 10.4, -3.6, 7, 0.6, 0.4); // axis
  const chart = C.build(glowMat(RP.waterLight, 0.6));
  if (chart) group.add(chart);

  // ---------------- stepped voxel globe hologram --------------------------
  const GX = -4, GY = 14, GZ = 3.5; // ring corners (r≈6.4) clear the screen
  const globe = piv(group, u, GX, GY, GZ);
  const widths = [3, 5, 7, 7, 7, 5, 3]; // slabs y = -3..3
  const B = new Mesher(u);
  widths.forEach((w, i) => B.b(RP.teal, w, 1, w, 0, i - 3, 0));
  const body = B.build(glowMat(RP.teal, 0.45));
  if (body) globe.add(body);
  // land voxels (protruding patches on the slab faces)
  const L = new Mesher(u);
  L.b(RP.leafLight, 3, 2, 1, 1, 0.5, 3.7);
  L.b(RP.leafLight, 1, 2, 3, -3.7, -1, 0.5);
  L.b(RP.leafLight, 2, 1, 1, -1, -2, 3.7);
  L.b(RP.leafLight, 2, 2, 1, 0.5, 1, -3.7);
  L.b(RP.leafLight, 1, 1, 2, 3.7, -1, -1);
  L.b(RP.leafLight, 2, 1, 2, 0, 3.6, 0); // ice-cap-ish top patch
  const land = L.build(glowMat(RP.leafLight, 0.4));
  if (land) globe.add(land);
  // equator ring + pin stems (white glow)
  const W = new Mesher(u);
  W.b(RP.white, 9, 1, 1, 0, 0, 4).b(RP.white, 9, 1, 1, 0, 0, -4);
  W.b(RP.white, 1, 1, 7, 4, 0, 0).b(RP.white, 1, 1, 7, -4, 0, 0);
  // pins: [x, surfaceY, z, stemH]
  const pinDefs: [number, number, number, number][] = [
    [-1, 3.5, 1, 1],
    [2, 2.5, -1, 2],
    [-1, 2.5, -2, 2],
    [3, 1.5, 2, 2],
  ];
  for (const [x, y, z, h] of pinDefs) W.b(RP.white, 1, h, 1, x, y + h / 2, z);
  const wire = W.build(glowMat(RP.white, 0.5));
  if (wire) globe.add(wire);
  const pins: { tip: THREE.Mesh; mat: THREE.MeshToonMaterial; baseY: number; phase: number }[] = [];
  pinDefs.forEach(([x, y, z, h], i) => {
    const mat = glowMat(0x9ff3f0, 1);
    const baseY = y + h + 1;
    pins.push({ tip: sbox(globe, u, mat, 2, 2, 2, x, baseY, z), mat, baseY, phase: (i / pinDefs.length) * TAU });
  });

  // ---------------- scanline ---------------------------------------------
  const scanMat = glowMat(0x9ff3f0, 1);
  const scan = sbox(group, u, scanMat, 22, 1, 0.4, 0, SCREEN_Y, -3.3);
  const SCAN_TOP = 19.5, SCAN_BOT = 10.5;

  // ---------------- 6×3 voxel wave-field ----------------------------------
  const waveTeal = glowMat(RP.teal, 0.4);
  const waveLight = glowMat(RP.waterLight, 0.4);
  const WAVE_Y = 4; // cell centre (floor top = 3, cell h = 2)
  const waves: { m: THREE.Mesh; phase: number; r: number }[] = [];
  for (let ix = 0; ix < 6; ix++) {
    for (let iz = 0; iz < 3; iz++) {
      const x = -10 + ix * 4;
      const z = 2 + iz * 4;
      const m = sbox(group, u, (ix + iz) % 2 === 0 ? waveTeal : waveLight, 3, 2, 3, x, WAVE_Y, z);
      waves.push({ m, phase: (ix + iz) * 0.55, r: Math.hypot(x, z - 6) });
    }
  }

  // ---------------- data-surge sparks (hidden until click) ----------------
  const sparkAnchor = piv(group, u, GX, GY, GZ);
  const sparkMat = glowMat(RP.white, 1);
  const SPARKS = 6;
  const sparks: { m: THREE.Mesh; dx: number; dy: number }[] = [];
  for (let i = 0; i < SPARKS; i++) {
    const a = (i / SPARKS) * TAU + 0.3;
    const m = sbox(sparkAnchor, u, sparkMat, 1.5, 1.5, 1.5, 0, 0, 0);
    m.visible = false;
    sparks.push({ m, dx: Math.cos(a), dy: Math.sin(a) });
  }

  group.rotation.y = Math.PI / 4;

  const selClock = makeSelectionClock();

  return {
    group,
    update(t, hover, selected) {
      const sel = selClock(t, selected);
      const flash = sel >= 0 ? Math.exp(-sel * 4) : 0;
      const wobble = sel >= 0 ? Math.exp(-sel * 5) * Math.sin(sel * 22) : 0;
      const ring = sel >= 0 ? Math.exp(-sel * 2.4) : 0;

      // wave height-field + radial surge crest travelling outward on click
      const amp = 0.8 + hover * 0.3;
      for (let i = 0; i < waves.length; i++) {
        const w = waves[i];
        let y = osc(t, 2, w.phase) * amp;
        if (sel >= 0) {
          const front = sel * 24 - w.r;
          y += Math.exp(-front * front * 0.03) * ring * 3;
        }
        w.m.position.y = (WAVE_Y + y) * u;
      }
      waveTeal.emissiveIntensity = 0.4 + flash * 0.8;
      waveLight.emissiveIntensity = 0.4 + flash * 0.8;

      // globe spin (+ kick on click)
      globe.rotation.y = (t / 20) * TAU + wobble * 1.6;

      // pins bob + chase blink
      for (let i = 0; i < pins.length; i++) {
        const p = pins[i];
        p.tip.position.y = (p.baseY + 0.5 * osc(t, 1.6, p.phase)) * u;
        p.mat.emissiveIntensity = 0.4 + 0.7 * Math.max(0, osc(t, 1.2, p.phase)) + flash * 1.6;
      }

      // scanline: sweep every 4 s; fast double-rip on click
      const fastOn = sel >= 0 && sel < 0.6;
      const sweep = fastOn ? (sel * 2) % 1 : (t % 4) / 4;
      scan.position.y = (SCAN_TOP + (SCAN_BOT - SCAN_TOP) * sweep) * u;
      scanMat.emissiveIntensity = 0.7 + 0.3 * Math.abs(osc(t, 0.4)) + flash * 0.8;

      screenMat.emissiveIntensity = 0.8 + hover * 0.25 + flash * 1.0;

      // sparks burst outward from the globe (ABSOLUTE size on sbox scale)
      const on = sel >= 0 && ring > 0.02;
      const reach = ring * 6;
      const s = on ? 1.5 * (0.9 + ring * 1.4) * u : 0;
      for (let i = 0; i < sparks.length; i++) {
        const sp = sparks[i];
        sp.m.visible = on;
        if (on) {
          sp.m.position.set(sp.dx * reach * u, sp.dy * reach * u, 0);
          sp.m.scale.set(s, s, s);
        }
      }
      sparkMat.emissiveIntensity = 0.5 + ring * 2;
    },
  };
}
