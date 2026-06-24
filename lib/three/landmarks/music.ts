import * as THREE from 'three';
import { P, box, voxel, cyl, sphere, dome, pivot, mat, osc, TAU, lerp, clamp, type BuiltModel } from '../kit';

export function buildMusic(): BuiltModel {
  const group = new THREE.Group();

  // ---- grassy mound base ----
  dome(group, P.grass, 0.7, 0, 0, 0, 12);
  // a couple of darker moss tufts for texture
  voxel(group, P.moss, 0.32, 0.36, 0.2, 0.12);
  voxel(group, P.moss, -0.28, 0.34, -0.18, 0.1);

  // ---- phone-as-stage: leaning back ~15deg, front faces +Z ----
  const phone = pivot(group, 0, 0.42, 0.0);
  phone.rotation.x = -0.26; // ~15deg lean back

  // bezel
  box(phone, P.slate, 0.7, 1.3, 0.08, 0, 0.45, 0, { name: 'bezel' });
  // screen face (slightly proud on +Z)
  box(phone, P.foam, 0.58, 1.12, 0.02, 0, 0.45, 0.05);

  // 3 thin staff lines across the screen
  const staffY = [0.18, 0.45, 0.72];
  for (let i = 0; i < staffY.length; i++) {
    box(phone, P.slate, 0.5, 0.018, 0.01, 0, staffY[i], 0.07);
  }

  // 2 gold note-heads that hop along the staff
  const noteHeads: THREE.Mesh[] = [];
  const noteBaseX = [-0.18, -0.02];
  const noteBaseY = [0.18, 0.45];
  for (let i = 0; i < 2; i++) {
    const nh = box(phone, P.gold, 0.075, 0.06, 0.02, noteBaseX[i], noteBaseY[i], 0.075);
    noteHeads.push(nh);
  }

  // ---- expanding "sound" ring emitter (lives in world group, in front of phone) ----
  const ring = cyl(group, P.surfCyan, 0.26, 0.26, 0.02, 0, 0.55, 0.42, 12, { opacity: 0.5 });
  ring.rotation.x = Math.PI / 2;
  ring.scale.set(0.4, 0.4, 1);
  const ringMat = (ring.material as THREE.MeshToonMaterial).clone();
  ring.material = ringMat;

  // ---- 3 note-flowers: earth stems + emissive eighth-note glyphs ----
  const flowerSpec: { x: number; z: number; h: number; hex: number; phase: number }[] = [
    { x: 0.62, z: 0.45, h: 0.95, hex: P.amber, phase: 0 },
    { x: -0.66, z: 0.35, h: 1.15, hex: P.surfCyan, phase: (TAU / 3) },
    { x: 0.15, z: -0.6, h: 0.8, hex: P.magenta, phase: (2 * TAU / 3) },
  ];
  const glyphs: { pivot: THREE.Group; baseY: number; phase: number }[] = [];
  for (let i = 0; i < flowerSpec.length; i++) {
    const f = flowerSpec[i];
    // thin earth stem
    box(group, P.earth, 0.04, f.h, 0.04, f.x, f.h / 2 + 0.12, f.z);
    // floating glyph sub-assembly
    const gp = pivot(group, f.x, f.h + 0.12, f.z);
    // note head (sphere) + thin stem (box) to read as an eighth note
    sphere(gp, f.hex, 0.12, 0, 0, 0, 8, { emissive: 1 });
    box(gp, f.hex, 0.025, 0.26, 0.025, 0.1, 0.16, 0, { emissive: 0.9 });
    // little flag
    box(gp, f.hex, 0.08, 0.03, 0.02, 0.14, 0.27, 0, { emissive: 0.9 });
    glyphs.push({ pivot: gp, baseY: f.h + 0.12, phase: f.phase });
  }

  // ---- tiny xylophone at the base: 4 colored bars ----
  const barColors = [P.signalRed, P.amber, P.grass, P.surfCyan];
  const bars: THREE.Mesh[] = [];
  const barMats: THREE.MeshToonMaterial[] = [];
  const xylo = pivot(group, 0.0, 0.06, 0.62);
  xylo.rotation.x = -0.12;
  // two side rails
  box(xylo, P.earth, 0.72, 0.04, 0.06, 0, 0, 0.16);
  box(xylo, P.earth, 0.72, 0.04, 0.06, 0, 0, -0.16);
  for (let i = 0; i < 4; i++) {
    const x = lerp(-0.26, 0.26, i / 3);
    const len = lerp(0.34, 0.24, i / 3); // descending bar length
    const b = box(xylo, barColors[i], 0.13, 0.045, len, x, 0.03, 0, { emissive: 0.0 });
    const bm = (b.material as THREE.MeshToonMaterial).clone();
    b.material = bm;
    bars.push(b);
    barMats.push(bm);
  }

  // build front faces +Z, then rotate to camera corner
  group.rotation.y = Math.PI / 4;

  return {
    group,
    update(t, hover) {
      const boost = 1; // steady animation rate (hover no longer scales time)

      // floating glyphs: staggered bob + slow y-spin
      for (let i = 0; i < glyphs.length; i++) {
        const g = glyphs[i];
        g.pivot.position.y = g.baseY + osc(t * boost, 2, g.phase) * 0.12;
        g.pivot.rotation.y = t * 0.6 * boost + g.phase;
      }

      // screen note-heads hop along staff left->right in 4s loop
      const loop = (t % 4) / 4; // 0..1
      for (let i = 0; i < noteHeads.length; i++) {
        const local = clamp(loop * 2 - i * 0.15, 0, 1);
        noteHeads[i].position.x = lerp(-0.2, 0.2, local);
        // hop arc
        noteHeads[i].position.y = noteBaseY[i] + Math.abs(osc(t * boost, 0.5, i)) * 0.05;
      }

      // sound ring: expand + fade every 5s
      const phase = (t % 5) / 5; // 0..1
      if (phase < 0.7) {
        const e = phase / 0.7; // 0..1
        const s = lerp(0.4, 2.2, e);
        ring.scale.set(s, s, 1);
        ringMat.opacity = (1 - e) * 0.55;
        ring.visible = true;
      } else {
        ring.visible = false;
      }

      // xylophone do-re-mi flash sequence
      const step = Math.floor((t * 2) % 4); // bar index cycling
      for (let i = 0; i < barMats.length; i++) {
        const active = i === step;
        const target = active ? 0.4 + 0.4 * Math.abs(osc(t, 0.25)) : 0.0;
        barMats[i].emissiveIntensity = lerp(barMats[i].emissiveIntensity, target, 0.4);
        barMats[i].emissive.copy(barMats[i].color);
      }
    },
  };
}
