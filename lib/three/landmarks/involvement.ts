import * as THREE from 'three';
import {
  P,
  box,
  voxel,
  cyl,
  sphere,
  pivot,
  mat,
  osc,
  makeSelectionClock,
  type BuiltModel,
} from '../kit';

export function buildInvolvement(): BuiltModel {
  const group = new THREE.Group();

  // ---- stage platform ----
  box(group, P.slate, 1.8, 0.18, 1.8, 0, 0.09, 0);
  // thin gold trim edge (four rails framing the top)
  const trimY = 0.185;
  box(group, P.gold, 1.8, 0.04, 0.08, 0, trimY, 0.88);
  box(group, P.gold, 1.8, 0.04, 0.08, 0, trimY, -0.88);
  box(group, P.gold, 0.08, 0.04, 1.8, 0.88, trimY, 0);
  box(group, P.gold, 0.08, 0.04, 1.8, -0.88, trimY, 0);

  // ---- amber spotlight ring on the stage edge (front) ----
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.32, 0.035, 8, 24),
    mat(P.amber).clone(),
  );
  const ringMat = ring.material as THREE.MeshToonMaterial;
  ringMat.emissive.setHex(P.amber);
  ringMat.emissiveIntensity = 0.9;
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, 0.2, 0.5);
  group.add(ring);

  // ---- podium / lectern at back-center ----
  const podium = pivot(group, 0, 0.18, -0.55);
  box(podium, P.earth, 0.45, 0.7, 0.4, 0, 0.35, 0);
  // slanted top
  box(podium, P.earth, 0.5, 0.06, 0.46, 0, 0.72, 0, { rot: [-0.32, 0, 0] });
  // cyan emissive note panel on the front
  const note = box(podium, P.surfCyan, 0.3, 0.22, 0.03, 0, 0.42, 0.21, {
    emissive: 0.7,
  });
  note.material = (note.material as THREE.MeshToonMaterial).clone();
  const noteMat = note.material as THREE.MeshToonMaterial;
  // tiny microphone leaning up
  cyl(podium, P.slate, 0.018, 0.018, 0.34, 0.12, 0.62, 0.18, 6, {
    rot: [0.25, 0, -0.18],
  });
  sphere(podium, P.slate, 0.05, 0.05, 0.78, 0.27, 6);

  // ---- banner on two thin poles behind the podium ----
  const banner = pivot(group, 0, 0.18, -0.86);
  box(banner, P.earth, 0.04, 1.1, 0.04, -0.62, 0.55, 0);
  box(banner, P.earth, 0.04, 1.1, 0.04, 0.62, 0.55, 0);
  // cloth split into 2 segments for the ripple
  const clothSeg: THREE.Mesh[] = [];
  const segW = 0.6;
  for (let i = 0; i < 2; i++) {
    const sx = (i === 0 ? -1 : 1) * (segW / 2);
    const seg = box(banner, P.magenta, segW, 0.5, 0.05, sx, 0.78, 0);
    clothSeg.push(seg);
  }
  // gold trim top + bottom of cloth
  box(banner, P.gold, 1.2, 0.05, 0.06, 0, 1.02, 0.005);
  box(banner, P.gold, 1.2, 0.05, 0.06, 0, 0.54, 0.005);
  // foam star voxels on the cloth (cloned mats so they can flare on select)
  const starDefs: [number, number, number, number, number][] = [
    [-0.32, 0.86, 0.04, 0.08, 0],
    [0.0, 0.72, 0.04, 0.1, 0],
    [0.34, 0.88, 0.04, 0.08, 0],
  ];
  const stars: { mesh: THREE.Mesh; mat: THREE.MeshToonMaterial; size: number }[] =
    [];
  for (const [sx, sy, sz, ssize] of starDefs) {
    const star = voxel(banner, P.foam, sx, sy, sz, ssize, { emissive: 0.3 });
    star.material = (star.material as THREE.MeshToonMaterial).clone();
    stars.push({
      mesh: star,
      mat: star.material as THREE.MeshToonMaterial,
      size: ssize,
    });
  }

  // ---- one-shot voxel sparks that burst from the banner on selection ----
  // Created ONCE here; animated via `sel` in update; invisible while idle.
  const sparkDefs: [number, number][] = [
    [-0.34, 0.42],
    [-0.16, 0.62],
    [0.0, 0.78],
    [0.18, 0.6],
    [0.34, 0.44],
  ];
  const sparks: {
    mesh: THREE.Mesh;
    mat: THREE.MeshToonMaterial;
    dx: number;
    dy: number;
  }[] = [];
  for (const [dx, dy] of sparkDefs) {
    // start clustered near the banner's star band; fly out + up on burst
    const s = voxel(banner, P.gold, dx * 0.3, 0.9, 0.06, 0.05, { emissive: 0.8 });
    s.material = (s.material as THREE.MeshToonMaterial).clone();
    s.visible = false;
    sparks.push({
      mesh: s,
      mat: s.material as THREE.MeshToonMaterial,
      dx,
      dy,
    });
  }

  // ---- 3 tiny pixel people (audience/mentees) in front of podium ----
  const shirtColors = [P.surfCyan, P.signalRed, P.grass];
  const people: { root: THREE.Group; baseY: number; phase: number }[] = [];
  for (let i = 0; i < 3; i++) {
    const px = (i - 1) * 0.42;
    const baseY = 0.18;
    const root = pivot(group, px, baseY, 0.35);

    // legs
    box(root, P.slate, 0.08, 0.18, 0.08, -0.07, 0.09, 0);
    box(root, P.slate, 0.08, 0.18, 0.08, 0.07, 0.09, 0);
    // torso
    box(root, shirtColors[i], 0.28, 0.34, 0.2, 0, 0.35, 0);
    // head
    box(root, P.skin, 0.26, 0.26, 0.26, 0, 0.65, 0);
    // hair cap
    box(root, P.hair, 0.28, 0.1, 0.28, 0, 0.76, 0);
    // eyes
    box(root, P.abyss, 0.04, 0.04, 0.02, -0.06, 0.66, 0.13);
    box(root, P.abyss, 0.04, 0.04, 0.02, 0.06, 0.66, 0.13);

    people.push({ root, baseY, phase: i * 1.4 });
  }

  // FRONT faces +Z; rotate to face camera corner
  group.rotation.y = Math.PI / 4;

  const RAISE_CYCLE = 5; // seconds between hops
  const RAISE_DUR = 0.3;

  // shared selection clock: -1 idle, else seconds since the tap (0 at click)
  const selClock = makeSelectionClock();

  return {
    group,
    update(t, hover, selected) {
      const sel = selClock(t, selected);
      // decaying envelopes driving the "spotlight on" beat
      const flash = sel >= 0 ? Math.exp(-sel * 4) : 0; // emissive pop
      const wobble = sel >= 0 ? Math.exp(-sel * 5) * Math.sin(sel * 22) : 0;
      // single hop arc for the people cheering
      const arc =
        sel >= 0
          ? Math.sin((Math.min(sel, 0.5) / 0.5) * Math.PI) * Math.exp(-sel * 1.5)
          : 0;

      // --- people sway/bob, staggered, with periodic raise hop ---
      for (let i = 0; i < people.length; i++) {
        const p = people[i];
        const bob = 0.04 * osc(t, 1.6, p.phase);
        // one person hops every RAISE_CYCLE; cycle through who via index
        let raise = 0;
        const slot = Math.floor(t / RAISE_CYCLE) % people.length;
        if (slot === i) {
          const local = t % RAISE_CYCLE;
          if (local < RAISE_DUR) {
            const u = local / RAISE_DUR;
            raise = 0.08 * Math.sin(u * Math.PI);
          }
        }
        // selection "cheer": each mentee hops + bounces, staggered by index
        const cheer = arc * 0.12 * (1 - i * 0.12);
        p.root.position.y = p.baseY + bob + raise + cheer;
        p.root.rotation.z =
          0.05 * osc(t, 2.2, p.phase) + wobble * 0.12 * (i % 2 === 0 ? 1 : -1);
      }

      // --- banner 2-segment ripple (+ a one-shot wave on select) ---
      for (let i = 0; i < clothSeg.length; i++) {
        const seg = clothSeg[i];
        seg.rotation.y = 0.18 * osc(t, 1.8, i * 1.6) + wobble * 0.22;
        seg.position.z =
          0.04 * osc(t, 1.8, i * 1.6 + 0.5) + arc * 0.06 * (i === 0 ? 1 : -1);
      }

      // --- foam stars flare + pop on select ---
      for (const st of stars) {
        st.mat.emissiveIntensity = 0.3 + flash * 1.1;
        const pop = 1 + arc * 0.5;
        st.mesh.scale.setScalar(st.size * pop); // box: set ABSOLUTE size
      }

      // --- cyan note panel shimmer (+ flash) ---
      noteMat.emissiveIntensity =
        0.55 + 0.35 * Math.abs(osc(t, 1.3)) + hover * 0.3 + flash * 0.8;

      // --- spotlight ring soft pulse (+ big flash, "spotlight on") ---
      ringMat.emissiveIntensity =
        0.7 + 0.3 * Math.abs(osc(t, 2.4)) + hover * 0.3 + flash * 1.6;

      // --- voxel spark burst: fly out + up, then fade back, on select ---
      if (sel >= 0) {
        const fade = Math.exp(-sel * 3); // 1 -> 0 over ~1s
        const fly = Math.sin(Math.min(sel, 0.6) / 0.6 * Math.PI); // 0 -> 1 -> 0
        for (const sp of sparks) {
          sp.mesh.visible = fade > 0.04;
          sp.mesh.position.set(
            sp.dx * 0.3 + sp.dx * fly * 0.6,
            0.9 + sp.dy * fly * 0.5 + arc * 0.1,
            0.06 + fly * 0.08,
          );
          sp.mesh.scale.setScalar(0.05 * (0.6 + fade)); // box: absolute size
          sp.mesh.rotation.z = sel * 6 * sp.dx;
          sp.mat.emissiveIntensity = 0.8 + fade * 1.0;
        }
      } else {
        for (const sp of sparks) sp.mesh.visible = false;
      }
    },
  };
}
