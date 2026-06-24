import * as THREE from 'three';
import { P, box, voxel, cyl, cone, sphere, pivot, osc, TAU, makeSelectionClock, type BuiltModel } from '../kit';

export function buildTrophy(): BuiltModel {
  const group = new THREE.Group();

  // ---- 2-step podium ----
  box(group, P.foam, 1.4, 0.4, 1.0, 0, 0.2, 0); // lower
  box(group, P.sand, 1.0, 0.4, 0.8, 0, 0.6, 0); // upper
  const podiumTopY = 0.8;

  // ---- banner behind ----
  const bannerStars: THREE.Mesh[] = [];
  const banner = pivot(group, 0, podiumTopY + 0.9, -0.45);
  box(banner, P.magenta, 1.3, 0.9, 0.08, 0, 0, 0);
  const starPos: [number, number][] = [
    [-0.42, 0.22], [0.0, 0.3], [0.42, 0.18],
    [-0.25, -0.15], [0.28, -0.2],
  ];
  starPos.forEach(([sx, sy], i) => {
    const s = voxel(banner, P.foam, sx, sy, 0.06, 0.12, { rot: [0, 0, TAU * (i / 8)] });
    bannerStars.push(s);
  });

  // ---- golden trophy (rotates on y) ----
  const trophy = pivot(group, 0, podiumTopY, 0.05);
  // square base
  box(trophy, P.gold, 0.4, 0.12, 0.4, 0, 0.06, 0);
  // stem
  cyl(trophy, P.gold, 0.08, 0.08, 0.3, 0, 0.27, 0, 10);
  // cup = inverted cone (point down)
  const cup = cone(trophy, P.gold, 0.4, 0.6, 0, 0.72, 0, 12, { rot: [Math.PI, 0, 0] });
  const cupMat = (cup.material as THREE.MeshToonMaterial).clone();
  cupMat.emissive = new THREE.Color().setHex(P.gold, THREE.SRGBColorSpace);
  cup.material = cupMat;
  // two C-curve handles (angled boxes) on each side
  box(trophy, P.gold, 0.06, 0.28, 0.06, -0.42, 0.78, 0, { rot: [0, 0, 0.5] });
  box(trophy, P.gold, 0.18, 0.06, 0.06, -0.5, 0.92, 0);
  box(trophy, P.gold, 0.06, 0.28, 0.06, 0.42, 0.78, 0, { rot: [0, 0, -0.5] });
  box(trophy, P.gold, 0.18, 0.06, 0.06, 0.5, 0.92, 0);

  // ---- 2 floating medals (ribbon + disc) ----
  const medals: THREE.Group[] = [];
  [-1, 1].forEach((side) => {
    const m = pivot(group, side * 0.95, podiumTopY + 0.55, 0.2);
    box(m, P.signalRed, 0.1, 0.4, 0.04, 0, 0.25, 0); // ribbon
    cyl(m, P.gold, 0.25, 0.25, 0.05, 0, 0, 0, 12, { rot: [Math.PI / 2, 0, 0] }); // disc
    voxel(m, P.amber, 0, 0, 0.04, 0.12); // disc center
    medals.push(m);
  });

  // ---- resting confetti on podium top ----
  const restConfetti: [number, number, number, number][] = [
    [-0.35, podiumTopY + 0.85, 0.28, P.gold],
    [0.3, podiumTopY + 0.85, -0.2, P.surfCyan],
    [0.42, podiumTopY + 0.85, 0.3, P.gold],
    [-0.2, podiumTopY + 0.85, -0.3, P.surfCyan],
  ];
  restConfetti.forEach(([cx, cy, cz, c]) => voxel(group, c, cx, cy, cz, 0.07));

  // ---- confetti burst pool ----
  const burst: THREE.Mesh[] = [];
  const burstBase: number[] = [];
  const BURST_N = 10;
  for (let i = 0; i < BURST_N; i++) {
    const c = i % 2 === 0 ? P.gold : P.surfCyan;
    const ang = (i / BURST_N) * TAU;
    const bx = Math.cos(ang) * 0.4;
    const bz = Math.sin(ang) * 0.4;
    const v = voxel(group, c, bx, podiumTopY + 0.82, bz, 0.06);
    burst.push(v);
    burstBase.push(podiumTopY + 0.82);
    v.visible = false;
  }

  // ---- selection victory burst: voxel stars that rise from the cup ----
  const selClock = makeSelectionClock();
  const cupTopY = podiumTopY + 1.02; // ~rim of the cup in trophy-local -> world
  const selStars: THREE.Mesh[] = [];
  const selStarMats: THREE.MeshToonMaterial[] = [];
  const SEL_N = 7;
  for (let i = 0; i < SEL_N; i++) {
    const c = i % 2 === 0 ? P.gold : P.foam;
    // emissive voxel star so it reads as a sparkle pop; clone so we can fade it
    const s = voxel(group, c, 0, cupTopY, 0.05, 0.08, { emissive: 1 });
    const sm = (s.material as THREE.MeshToonMaterial).clone();
    sm.transparent = true;
    s.material = sm;
    s.visible = false;
    selStars.push(s);
    selStarMats.push(sm);
  }

  group.rotation.y = Math.PI / 4;

  function update(t: number, hover: number, selected: boolean) {
    const sel = selClock(t, selected);
    // steady animation rate — hover only affects lift/scale

    // trophy slow spin (360 / 12s)
    trophy.rotation.y = (t / 12) * TAU;

    // gold flare pulse as cup faces camera-ish; combine spin facing with idle pulse
    const facing = Math.max(0, Math.cos(trophy.rotation.y - Math.PI / 4));
    const pulse = 0.25 + 0.85 * facing * facing + 0.15 * Math.abs(osc(t, 1.5));
    // on click: a bright gleam flash on the cup that decays back to idle
    const flash = sel >= 0 ? Math.exp(-sel * 4) : 0;
    cupMat.emissiveIntensity = pulse * (1 + flash * 1.6);

    // on click: trophy gives a victory hop + springy wobble, then settles
    if (sel >= 0) {
      const arc = Math.sin(Math.min(sel, 0.5) / 0.5 * Math.PI) * Math.exp(-sel * 1.5);
      const wobble = Math.exp(-sel * 5) * Math.sin(sel * 22);
      trophy.position.y = podiumTopY + arc * 0.18;
      trophy.scale.setScalar(1 + wobble * 0.07);
    } else {
      trophy.position.y = podiumTopY;
      trophy.scale.setScalar(1);
    }

    // on click: voxel victory stars erupt from the cup, rise, spin and fade
    if (sel >= 0) {
      const arc = Math.sin(Math.min(sel, 0.5) / 0.5 * Math.PI) * Math.exp(-sel * 1.5);
      const fade = Math.exp(-sel * 2.2);
      selStars.forEach((s, i) => {
        s.visible = fade > 0.02;
        const a = (i / SEL_N) * TAU;
        const spread = 0.18 + Math.min(sel, 1) * 0.45;
        s.position.x = Math.cos(a) * spread;
        s.position.z = 0.05 + Math.sin(a) * spread;
        s.position.y = cupTopY + arc * 0.7 + sel * 0.25;
        s.rotation.set(sel * 7 + a, sel * 6, sel * 5);
        const pop = (0.6 + 0.6 * fade) * (i % 2 === 0 ? 1 : 0.8);
        s.scale.setScalar(0.08 * pop);
        selStarMats[i].opacity = fade;
        selStarMats[i].emissiveIntensity = 0.8 + flash * 1.5;
      });
    } else {
      selStars.forEach((s) => { s.visible = false; });
    }

    // medals bob + twist
    medals.forEach((m, i) => {
      const ph = i * Math.PI;
      m.position.y = (podiumTopY + 0.55) + osc(t, 2.4, ph) * 0.08;
      m.rotation.y = osc(t, 3, ph) * 0.5;
    });

    // banner stars twinkle (voxel() baked size 0.12 into scale -> scale around it)
    bannerStars.forEach((s, i) => {
      const sc = 0.85 + 0.35 * Math.abs(osc(t, 1.2, i * 1.3));
      s.scale.setScalar(0.12 * sc);
    });

    // confetti burst every ~9s
    const cycle = 9;
    const local = t % cycle;
    const dur = 1.4;
    if (local < dur) {
      const phase = local / dur; // 0..1
      burst.forEach((v, i) => {
        v.visible = true;
        const ph = (i / BURST_N);
        // pop up ~0.5 then gravity fall
        const up = 0.5;
        const vy = up / (dur * 0.4);
        const y = burstBase[i] + vy * local - 0.5 * 1.4 * local * local;
        v.position.y = Math.max(burstBase[i], y);
        const spread = 0.4 + phase * 0.6;
        const ang = ph * TAU;
        v.position.x = Math.cos(ang) * spread;
        v.position.z = Math.sin(ang) * spread;
        v.rotation.set(local * 6 + ph * TAU, local * 5, local * 4);
      });
    } else {
      burst.forEach((v) => { v.visible = false; });
    }
  }

  return { group, update };
}
