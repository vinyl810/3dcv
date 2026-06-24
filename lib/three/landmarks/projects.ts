import * as THREE from 'three';
import {
  P,
  box,
  voxel,
  cyl,
  sphere,
  dome,
  pivot,
  osc,
  TAU,
  makeSelectionClock,
  type BuiltModel,
} from '../kit';

export function buildProjects(): BuiltModel {
  const group = new THREE.Group();

  // ---- bench top + legs (earth) with sand surface plate ----
  const topY = 0.78;
  box(group, P.earth, 2.0, 0.18, 1.0, 0, topY, 0); // desk slab
  box(group, P.sand, 1.92, 0.05, 0.92, 0, topY + 0.115, 0); // sand top plate

  const legX = 0.86;
  const legZ = 0.4;
  const legH = topY - 0.09;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      box(group, P.earth, 0.14, legH, 0.14, sx * legX, legH / 2, sz * legZ);
    }
  }

  const surf = topY + 0.16; // resting surface for artifacts

  // ===================================================================
  // 1) DIGITAL-TWIN GLOBE — oceanTeal dome + surfCyan rings + grass land
  // ===================================================================
  const globe = pivot(group, -0.7, surf, 0.05);
  const globeSpin = pivot(globe, 0, 0, 0);
  dome(globeSpin, P.oceanTeal, 0.22, 0, 0, 0, 12);
  sphere(globeSpin, P.oceanTeal, 0.215, 0, 0, 0, 10); // lower half hint
  // thin ring bands
  for (const ry of [0.07, -0.04]) {
    cyl(globeSpin, P.surfCyan, 0.225, 0.225, 0.012, 0, ry, 0, 14, {
      emissive: 0.4,
    });
  }
  // landmass voxels
  voxel(globeSpin, P.grass, 0.08, 0.06, 0.14, 0.1);
  voxel(globeSpin, P.grass, -0.05, 0.1, 0.13, 0.07);

  // ===================================================================
  // 2) BRAIN / RESEARCH BLOB — magenta/synapse voxels + foam neuron
  // ===================================================================
  const brain = pivot(group, -0.18, surf + 0.02, -0.12);
  const brainSpin = pivot(brain, 0, 0, 0);
  const blobs: [number, number, number, number, number][] = [
    [0.0, 0.04, 0.0, 0.14, P.magenta],
    [0.1, 0.08, 0.04, 0.12, P.synapse],
    [-0.08, 0.07, -0.03, 0.12, P.magenta],
    [0.03, 0.13, -0.05, 0.11, P.synapse],
  ];
  for (const [x, y, z, s, hex] of blobs) {
    voxel(brainSpin, hex, x, y, z, s, { rot: [0.2, 0.4, 0.1] });
  }
  const neuron = sphere(brainSpin, P.foam, 0.045, 0.05, 0.2, 0.04, 8, {
    emissive: 1,
  });
  neuron.material = (neuron.material as THREE.MeshToonMaterial).clone();

  // ===================================================================
  // 3) GEAR / COG — slate cylinder + 6 teeth boxes
  // ===================================================================
  const gear = pivot(group, 0.32, surf + 0.05, 0.18);
  const gearSpin = pivot(gear, 0, 0, 0);
  cyl(gearSpin, P.slate, 0.18, 0.18, 0.1, 0, 0, 0, 14);
  cyl(gearSpin, P.dusk, 0.07, 0.07, 0.12, 0, 0, 0, 10); // hub
  const teeth = 6;
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * TAU;
    const r = 0.2;
    box(
      gearSpin,
      P.slate,
      0.08,
      0.1,
      0.06,
      Math.cos(a) * r,
      0,
      Math.sin(a) * r,
      { rot: [0, -a, 0] },
    );
  }

  // ===================================================================
  // 4) CANVAS / CARD — foam panel framed in gold + tiny motif
  // ===================================================================
  const canvas = pivot(group, 0.78, surf + 0.18, -0.05);
  const canvasSpin = pivot(canvas, 0, 0, 0);
  // gold frame (slightly larger backing)
  box(canvasSpin, P.gold, 0.34, 0.4, 0.025, 0, 0, 0);
  // foam face (front = +Z)
  box(canvasSpin, P.foam, 0.3, 0.36, 0.03, 0, 0, 0.005);
  // motif
  box(canvasSpin, P.surfCyan, 0.12, 0.12, 0.012, -0.05, 0.05, 0.022, {
    emissive: 0.4,
  });
  box(canvasSpin, P.magenta, 0.1, 0.08, 0.012, 0.06, -0.06, 0.022, {
    emissive: 0.3,
  });
  // glint sweep bar (animated)
  const glint = box(canvasSpin, P.surfCyan, 0.04, 0.4, 0.014, -0.15, 0, 0.03, {
    emissive: 1.2,
  });
  glint.material = (glint.material as THREE.MeshToonMaterial).clone();

  // ===================================================================
  // SCREWDRIVER lying on the bench — signalRed handle + slate tip
  // ===================================================================
  const tool = pivot(group, 0.1, surf - 0.06, 0.42);
  cyl(tool, P.signalRed, 0.05, 0.05, 0.26, -0.13, 0, 0, 8, {
    rot: [0, 0, Math.PI / 2],
  });
  cyl(tool, P.slate, 0.018, 0.022, 0.22, 0.11, 0, 0, 6, {
    rot: [0, 0, Math.PI / 2],
  });

  // ===================================================================
  // FLOATING AMBER SPARK / IDEA BULB + surfCyan sparkle cubes
  // ===================================================================
  const sparkOrbit = pivot(group, 0, surf + 0.7, 0);
  const spark = sphere(sparkOrbit, P.amber, 0.1, 0.5, 0, 0, 10, {
    emissive: 1.4,
  });
  spark.material = (spark.material as THREE.MeshToonMaterial).clone();
  // tiny filament cross on bulb
  box(sparkOrbit, P.gold, 0.02, 0.06, 0.02, 0.5, 0.1, 0, { emissive: 0.6 });

  const sparkles: THREE.Mesh[] = [];
  const sparkleBase: [number, number, number][] = [
    [-0.5, 0.1, 0.3],
    [0.35, 0.25, -0.35],
    [-0.2, 0.35, -0.2],
  ];
  for (const [x, y, z] of sparkleBase) {
    const c = voxel(sparkOrbit, P.surfCyan, x, y, z, 0.05, { emissive: 1 });
    c.material = (c.material as THREE.MeshToonMaterial).clone();
    sparkles.push(c);
  }

  // ===================================================================
  // BUILD-BURST EMBERS — chunky amber/gold voxel sparks that fly off the
  // bench on click. Created ONCE here; invisible while idle, animated by `sel`.
  // ===================================================================
  const emberCount = 5;
  const embers: { mesh: THREE.Mesh; dir: THREE.Vector3; size: number }[] = [];
  // launch from just above the bench surface, fanned outward + up
  const emberOrigin = new THREE.Vector3(0.1, surf + 0.12, 0.1);
  for (let i = 0; i < emberCount; i++) {
    const a = (i / emberCount) * TAU + 0.3;
    const dir = new THREE.Vector3(Math.cos(a), 1.4, Math.sin(a)).normalize();
    const size = 0.05 + (i % 2) * 0.018;
    const e = voxel(group, i % 2 ? P.gold : P.amber, 0, 0, 0, size, {
      emissive: 1.4,
    });
    e.material = (e.material as THREE.MeshToonMaterial).clone();
    e.visible = false;
    embers.push({ mesh: e, dir, size });
  }

  // selection clock: drives the one-shot "build!" burst (see kit.ts)
  const selClock = makeSelectionClock();

  group.rotation.y = Math.PI / 4;

  // artifact spin pivots + bob targets, with staggered phases
  const bobbers: { p: THREE.Group; baseY: number; phase: number }[] = [
    { p: globe, baseY: surf, phase: 0 },
    { p: brain, baseY: surf + 0.02, phase: 1.4 },
    { p: gear, baseY: surf + 0.05, phase: 2.6 },
    { p: canvas, baseY: surf + 0.18, phase: 3.9 },
  ];

  const toolBaseY = surf - 0.06; // screwdriver rest height

  return {
    group,
    update(t, hover, selected) {
      // seconds since the click (0 on tap), or -1 while not selected
      const sel = selClock(t, selected);
      // decaying envelopes for the "build!" moment
      const flash = sel >= 0 ? Math.exp(-sel * 4) : 0; // warm glow pop
      const wobble = sel >= 0 ? Math.exp(-sel * 5) * Math.sin(sel * 22) : 0; // overshoot+settle
      const arc =
        sel >= 0
          ? Math.sin((Math.min(sel, 0.5) / 0.5) * Math.PI) * Math.exp(-sel * 1.5)
          : 0; // a single hop

      // staggered bob + slow y-spin for each artifact
      for (let i = 0; i < bobbers.length; i++) {
        const b = bobbers[i];
        b.p.position.y = b.baseY + 0.04 * osc(t, 2.4, b.phase);
        b.p.rotation.y = 0.4 * osc(t, 6, b.phase);
      }

      // globe rotates 360 / 16s
      globeSpin.rotation.y = (t / 16) * TAU;

      // brain slow spin + neuron pulse
      brainSpin.rotation.y = (t / 9) * TAU;
      const nm = neuron.material as THREE.MeshToonMaterial;
      nm.emissiveIntensity = 0.6 + 0.8 * Math.abs(osc(t, 1.6));

      // gear slow rotation about its axis (z-faceted disc spins on z)
      // + on click: the freshly-"built" cog kicks into a quick extra spin
      gearSpin.rotation.y = (t / 7) * TAU + wobble * 0.9;

      // canvas glint sweep: travel left->right, brighten at center
      const u = (t * 0.5) % 1; // 0..1
      glint.position.x = -0.15 + u * 0.3;
      const gm = glint.material as THREE.MeshToonMaterial;
      gm.emissiveIntensity = 0.3 + 1.3 * Math.sin(u * Math.PI);

      // floating spark orbits above + pulses emissive
      sparkOrbit.rotation.y = (t / 12) * TAU;
      sparkOrbit.position.y = surf + 0.7 + 0.05 * osc(t, 3.5);
      const sm = spark.material as THREE.MeshToonMaterial;
      // warm glow flash on click ("build!" idea lights up)
      sm.emissiveIntensity =
        1.1 + 0.6 * Math.abs(osc(t, 2)) + 0.3 * hover + 2.4 * flash;
      spark.scale.setScalar(1 + 0.35 * flash); // sphere bakes size in geo -> pure multiplier

      // sparkle cubes drift up + twinkle (ABSOLUTE size on voxel scale)
      for (let i = 0; i < sparkles.length; i++) {
        const ph = i * 2.1;
        const drift = (t * 0.15 + i * 0.33) % 1; // 0..1 rising
        sparkles[i].position.y = sparkleBase[i][1] + drift * 0.25;
        // voxel() baked size into scale -> set the ABSOLUTE world size here
        // on click the existing sparkles flare bigger + brighter for a beat
        const tw = 0.04 + 0.03 * Math.abs(osc(t, 1.1, ph)) + 0.05 * flash;
        sparkles[i].scale.setScalar(tw);
        const m = sparkles[i].material as THREE.MeshToonMaterial;
        m.emissiveIntensity = 0.4 + 1.2 * Math.abs(osc(t, 1.1, ph)) + 1.6 * flash;
      }

      // ============================================================
      // SELECTION "BUILD!" BURST — only when sel >= 0 (freshly clicked)
      // ============================================================
      if (sel >= 0) {
        // grab the tool: screwdriver hops up off the bench in a single arc
        tool.position.y = toolBaseY + 0.18 * arc;
        tool.rotation.z = 0.5 * arc; // tilt as it leaps

        // the freshly-built cog gives a little scale pop (pivot = pure multiplier)
        gear.scale.setScalar(1 + 0.18 * Math.max(0, wobble));

        // voxel embers fly outward + up from the bench, then arc back & fade
        const launch = arc; // 0 -> peak -> 0 over ~0.5s
        const spread = sel * 0.55; // keeps expanding outward as it rises
        for (let i = 0; i < embers.length; i++) {
          const e = embers[i];
          if (flash > 0.02) {
            e.mesh.visible = true;
            e.mesh.position.set(
              emberOrigin.x + e.dir.x * spread,
              emberOrigin.y + e.dir.y * spread - 0.45 * sel * sel, // gravity droop
              emberOrigin.z + e.dir.z * spread,
            );
            // absolute voxel size: pop on launch, shrink as it dies
            e.mesh.scale.setScalar(e.size * (0.4 + 1.3 * launch + 0.3 * flash));
            e.mesh.rotation.set(sel * 6, sel * 5 + i, sel * 4); // tumble
            const em = e.mesh.material as THREE.MeshToonMaterial;
            em.emissiveIntensity = 0.6 + 2.0 * flash;
          } else {
            e.mesh.visible = false;
          }
        }
      } else {
        // NOT selected -> everything the burst touched returns fully neutral
        tool.position.y = toolBaseY;
        tool.rotation.z = 0;
        gear.scale.setScalar(1);
        for (let i = 0; i < embers.length; i++) embers[i].mesh.visible = false;
      }
    },
  };
}
