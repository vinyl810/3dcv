import * as THREE from 'three';
import {
  P,
  box,
  voxel,
  cyl,
  dome,
  pivot,
  osc,
  TAU,
  makeSelectionClock,
  type BuiltModel,
} from '../kit';

/**
 * Work @ KOAST — Oceanic 3D GIS Digital Twin.
 * A widescreen monitor displaying a low-poly digital-twin globe over a
 * voxel ocean wave-field, with a jutting OpenLayers-style 2D map tab.
 */
export function buildMonitor(): BuiltModel {
  const group = new THREE.Group();

  // ---- base + stand ----
  box(group, P.earth, 1.3, 0.16, 0.8, 0, 0.08, 0); // base plate
  cyl(group, P.slate, 0.16, 0.22, 0.9, 0, 0.16 + 0.45, 0, 12); // stand column

  // ---- monitor body (bezel) ----
  // screen center height; build front facing +Z, rotate whole group at end.
  const screenY = 0.16 + 0.9 + 0.95;
  box(group, P.slate, 3.0, 1.8, 0.18, 0, screenY, 0); // bezel

  // emissive teal screen face (sits just in front of bezel, +Z)
  const screenFace = box(group, P.oceanTeal, 2.7, 1.55, 0.04, 0, screenY, 0.11, {
    emissive: 0.8,
  });
  // clone the shared/cached material so the selection surge can brighten it
  screenFace.material = (screenFace.material as THREE.MeshToonMaterial).clone();

  // ---- on-screen content lives in a group anchored at the screen plane ----
  const screen = pivot(group, 0, screenY, 0.14);

  // mini digital-twin globe (rotates on y)
  const globe = pivot(screen, -0.15, 0.12, 0.06);
  dome(globe, P.oceanTeal, 0.55, 0, 0, 0, 14, { emissive: 0.3 });
  // landmass blobs (deterministic positions on the dome surface)
  const landSpots: [number, number, number][] = [
    [0.18, 0.34, 0.36],
    [-0.3, 0.18, 0.3],
    [0.05, 0.46, -0.18],
    [-0.12, 0.2, -0.4],
    [0.34, 0.12, -0.22],
  ];
  for (const [lx, ly, lz] of landSpots) {
    voxel(globe, P.grass, lx, ly, lz, 0.16, { emissive: 0.25 });
  }

  // 3 latitude bands — thin flat cylinders (disc rings) stacked on the dome.
  const bandData: [number, number][] = [
    [0.46, 0.1], // [radius, y]
    [0.52, 0.26],
    [0.4, 0.42],
  ];
  for (const [r, by] of bandData) {
    cyl(globe, P.surfCyan, r, r, 0.025, 0, by, 0, 12, { emissive: 0.5 });
  }

  // 3-4 floating data pins (thin cylinder stems with glowing tips)
  const pinBases: [number, number, number][] = [
    [0.2, 0.4, 0.3],
    [-0.28, 0.32, 0.18],
    [0.06, 0.5, -0.14],
    [-0.1, 0.3, -0.32],
  ];
  const pins: { stem: THREE.Group; tip: THREE.Mesh; phase: number }[] = [];
  pinBases.forEach(([px, py, pz], i) => {
    const stem = pivot(globe, px, py, pz);
    cyl(stem, P.foam, 0.018, 0.018, 0.22, 0, 0.11, 0, 6);
    const tip = voxel(stem, P.surfCyan, 0, 0.24, 0, 0.07, { emissive: 1 });
    tip.material = (tip.material as THREE.MeshToonMaterial).clone();
    pins.push({ stem, tip, phase: (i / pinBases.length) * TAU });
  });

  // ---- 6x4 voxel ocean wave-field, in FRONT of the screen, lower area ----
  const waveField = pivot(group, 0, 0.16 + 0.9 + 0.18, 0.6);
  const waves: { mesh: THREE.Mesh; phase: number; radius: number }[] = [];
  const cols = 6;
  const rows = 4;
  const cell = 0.18;
  for (let ix = 0; ix < cols; ix++) {
    for (let iz = 0; iz < rows; iz++) {
      const wx = (ix - (cols - 1) / 2) * cell;
      const wz = (iz - (rows - 1) / 2) * cell;
      const hex = (ix + iz) % 2 === 0 ? P.oceanTeal : P.surfCyan;
      const m = voxel(waveField, hex, wx, 0, wz, 0.14, { emissive: 0.35 });
      // distance from field center drives the radial surge ripple delay
      waves.push({ mesh: m, phase: (ix + iz) * 0.55, radius: Math.hypot(wx, wz) });
    }
  }

  // ---- OpenLayers-style 2D map tab jutting from lower-left ----
  const mapTab = pivot(group, -1.35, 0.16 + 0.9 + 0.55, 0.35);
  mapTab.rotation.x = -0.35;
  box(mapTab, P.foam, 0.7, 0.5, 0.03, 0, 0, 0, { emissive: 0.2 });
  // grid lines
  for (let gx = -2; gx <= 2; gx++) {
    box(mapTab, P.surfCyan, 0.012, 0.5, 0.04, gx * 0.14, 0, 0.005, { emissive: 0.6 });
  }
  for (let gy = -1; gy <= 1; gy++) {
    box(mapTab, P.surfCyan, 0.7, 0.012, 0.04, 0, gy * 0.16, 0.005, { emissive: 0.6 });
  }

  // ---- sweeping scanline (thin bright cyan box) ----
  const scanline = box(group, P.surfCyan, 2.7, 0.05, 0.05, 0, screenY, 0.13, {
    emissive: 1,
  });
  scanline.material = (scanline.material as THREE.MeshToonMaterial).clone();
  const screenTop = screenY + 0.7;
  const screenBot = screenY - 0.7;

  // ---- selection "data surge" burst ----
  const selClock = makeSelectionClock();

  // a chunky ring of voxel "data sparks" that pop outward from the globe on tap.
  // built ONCE, anchored at the globe center, invisible at idle.
  const sparkAnchor = pivot(screen, -0.15, 0.12, 0.06);
  const SPARK_COUNT = 8;
  const sparks: { mesh: THREE.Mesh; dir: THREE.Vector3 }[] = [];
  for (let i = 0; i < SPARK_COUNT; i++) {
    const a = (i / SPARK_COUNT) * TAU;
    const hex = i % 2 === 0 ? P.surfCyan : P.foam;
    const m = voxel(sparkAnchor, hex, 0, 0, 0, 0.06, { emissive: 1 });
    m.material = (m.material as THREE.MeshToonMaterial).clone();
    m.visible = false;
    sparks.push({
      mesh: m,
      dir: new THREE.Vector3(Math.cos(a), Math.sin(a), 0),
    });
  }

  // build front-facing +Z, orient toward camera corner
  group.rotation.y = Math.PI / 4;

  function update(t: number, hover: number, selected: boolean) {
    // hover affects only lift/scale, never the animation rate

    // selection "data surge": sel = seconds since the tap (0 at click), -1 idle.
    const sel = selClock(t, selected);
    // one-shot envelopes off `sel` (reset to 0 on each fresh click)
    const flash = sel >= 0 ? Math.exp(-sel * 4) : 0; // 1→0 glow boost
    const wobble = sel >= 0 ? Math.exp(-sel * 5) * Math.sin(sel * 22) : 0; // spin kick
    // expanding radial ring front (peaks ~0.45s, gone by ~1.3s)
    const ring = sel >= 0 ? Math.exp(-sel * 2.4) : 0;

    // wave height-field: amplitude ~0.06, period 2s, phase by x+z
    // + radial surge ripple that ripples outward from center on selection
    for (const w of waves) {
      let y = osc(t, 2, w.phase) * 0.06;
      if (sel >= 0) {
        // a crest travels outward: front position = sel scaled, narrow band
        const front = sel * 1.6 - w.radius;
        y += Math.exp(-front * front * 9) * ring * 0.18;
      }
      w.mesh.position.y = y;
    }

    // globe slow spin: 360 / 20s  (+ a quick fast-spin kick on selection)
    globe.rotation.y = (t / 20) * TAU + wobble * 1.6;

    // pins bob + staggered chase blink on tips (+ all tips flash bright on tap)
    pins.forEach((p) => {
      const bob = osc(t, 1.6, p.phase) * 0.04;
      p.tip.position.y = 0.24 + bob;
      const tipMat = p.tip.material as THREE.MeshToonMaterial;
      tipMat.emissiveIntensity =
        0.4 + 0.6 * Math.max(0, osc(t, 1.2, p.phase)) + flash * 1.6;
    });

    // scanline sweep top->bottom every 4s; on selection it rips a fast double-sweep
    const fast = sel >= 0 && sel < 0.6 ? (sel * 2) % 1 : 0; // two extra rips in 0.6s
    const sweep = sel >= 0 && sel < 0.6 ? fast : (t % 4) / 4; // 0..1
    scanline.position.y = screenTop + (screenBot - screenTop) * sweep;
    const sMat = scanline.material as THREE.MeshToonMaterial;
    sMat.emissiveIntensity = 0.7 + 0.3 * Math.abs(osc(t, 0.4)) + flash * 0.8;

    // screen face brightens briefly on the surge, then settles to base 0.8
    const faceMat = screenFace.material as THREE.MeshToonMaterial;
    faceMat.emissiveIntensity = 0.8 + flash * 1.0;

    // voxel data sparks burst outward from the globe center, then fade.
    // NOTE: voxel() baked size 0.06 into scale — set ABSOLUTE world size here.
    if (sel >= 0) {
      const reach = ring * 0.55; // outward travel distance
      const on = ring > 0.02;
      const sizeAbs = on ? 0.06 * (0.9 + ring * 1.4) : 0; // chunky pop, settles to 0
      for (const s of sparks) {
        s.mesh.visible = on;
        s.mesh.position.set(s.dir.x * reach, s.dir.y * reach, s.dir.z * reach);
        s.mesh.scale.setScalar(sizeAbs);
        (s.mesh.material as THREE.MeshToonMaterial).emissiveIntensity = ring * 2;
      }
    } else {
      for (const s of sparks) s.mesh.visible = false;
    }
  }

  return { group, update };
}