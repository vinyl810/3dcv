import * as THREE from 'three';
import {
  P,
  box,
  voxel,
  cyl,
  cone,
  pivot,
  osc,
  TAU,
  clamp,
  makeSelectionClock,
  type BuiltModel,
} from '../kit';

/**
 * About / Contact — a standing pixel-character of Daewon on the central deck,
 * holding a tablet (a small wave + neuron motif), waving hello, beside a
 * floating holographic @vinyl810 nameplate and a small warm deck lamp.
 */
export function buildHub(): BuiltModel {
  const group = new THREE.Group();

  // ---------- central wooden deck ----------
  const DECK = 1.0; // deck-top height (where the character stands)
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + Math.PI / 6;
    const r = 1.25;
    box(group, P.earth, 0.26, DECK, 0.26, Math.cos(a) * r, DECK / 2, Math.sin(a) * r);
  }
  cyl(group, P.earth, 1.7, 1.7, 0.28, 0, DECK - 0.14, 0, 18); // deck slab
  cyl(group, P.moss, 1.72, 1.72, 0.06, 0, DECK - 0.3, 0, 18); // mossy underside rim
  cyl(group, P.sand, 1.66, 1.66, 0.07, 0, DECK + 0.02, 0, 18); // sand top cap
  const F = DECK + 0.06; // standing surface (feet height)

  const HOODIE = P.oceanTeal;

  // ---------- character — front faces +Z ----------
  // shoes + legs
  box(group, P.abyss, 0.22, 0.12, 0.3, -0.13, F + 0.06, 0.03);
  box(group, P.abyss, 0.22, 0.12, 0.3, 0.13, F + 0.06, 0.03);
  box(group, P.slate, 0.19, 0.5, 0.2, -0.13, F + 0.36, 0);
  box(group, P.slate, 0.19, 0.5, 0.2, 0.13, F + 0.36, 0);

  // torso (hoodie) on a breathing pivot
  const torso = pivot(group, 0, F + 0.6, 0);
  box(torso, HOODIE, 0.58, 0.66, 0.34, 0, 0.33, 0);
  box(torso, P.foam, 0.05, 0.5, 0.02, 0, 0.3, 0.18); // zipper
  box(torso, P.dusk, 0.34, 0.12, 0.02, 0, 0.16, 0.18); // pocket
  box(torso, P.surfCyan, 0.5, 0.06, 0.34, 0, 0.62, 0, { emissive: 0.12 }); // collar

  const shY = F + 1.18; // shoulder height
  const headY = F + 1.5; // head center

  // head
  const head = new THREE.Group();
  head.position.set(0, headY, 0);
  group.add(head);
  voxel(head, P.skin, 0, 0, 0, 0.46);
  box(head, P.hair, 0.5, 0.18, 0.5, 0, 0.28, 0); // hair cap
  box(head, P.hair, 0.5, 0.08, 0.06, 0, 0.16, 0.24); // front fringe
  const eyeL = pivot(head, -0.1, 0.02, 0.235);
  const eyeR = pivot(head, 0.1, 0.02, 0.235);
  voxel(eyeL, P.abyss, 0, 0, 0, 0.07);
  voxel(eyeR, P.abyss, 0, 0, 0, 0.07);
  box(head, P.slate, 0.32, 0.03, 0.02, 0, 0.02, 0.24); // glasses bridge
  box(head, P.earth, 0.12, 0.03, 0.02, 0, -0.12, 0.235); // little smile

  // ---------- tablet arm (left), holding the tablet ----------
  box(group, HOODIE, 0.15, 0.34, 0.17, -0.36, shY - 0.13, 0.04); // upper arm
  box(group, P.skin, 0.13, 0.13, 0.32, -0.32, shY - 0.32, 0.24); // forearm forward
  voxel(group, P.skin, -0.3, shY - 0.32, 0.42, 0.13); // hand

  const tablet = pivot(group, -0.05, F + 0.86, 0.42);
  tablet.rotation.x = -0.5; // tilt the screen toward the camera
  box(tablet, P.slate, 0.52, 0.64, 0.05, 0, 0, 0);
  const screen = box(tablet, P.oceanTeal, 0.44, 0.56, 0.02, 0, 0, 0.035, {
    emissive: 0.7,
  });
  screen.material = (screen.material as THREE.MeshToonMaterial).clone();
  const screenMat = screen.material as THREE.MeshToonMaterial;
  // motif: small wave grid (graphics) + neuron dots (research)
  const waveCells: THREE.Mesh[] = [];
  const waveBaseY = [-0.13, -0.13, -0.02, -0.02];
  for (let i = 0; i < 4; i++) {
    const cx = i % 2 === 0 ? -0.1 : 0.1;
    const c = voxel(tablet, i % 2 === 0 ? P.surfCyan : P.foam, cx, waveBaseY[i], 0.05, 0.08, {
      emissive: 0.9,
    });
    c.material = (c.material as THREE.MeshToonMaterial).clone();
    waveCells.push(c);
  }
  const neuronA = voxel(tablet, P.synapse, -0.08, 0.16, 0.05, 0.06, { emissive: 1 });
  const neuronB = voxel(tablet, P.magenta, 0.1, 0.18, 0.05, 0.06, { emissive: 1 });
  neuronA.material = (neuronA.material as THREE.MeshToonMaterial).clone();
  neuronB.material = (neuronB.material as THREE.MeshToonMaterial).clone();
  box(tablet, P.synapse, 0.2, 0.015, 0.02, 0.01, 0.17, 0.05, { emissive: 0.6 }); // link

  // ---------- wave arm (right), waves hello ----------
  const waveArm = pivot(group, 0.36, shY, 0);
  box(waveArm, HOODIE, 0.15, 0.3, 0.17, 0, -0.13, 0); // upper
  box(waveArm, P.skin, 0.13, 0.26, 0.14, 0, -0.36, 0); // forearm
  voxel(waveArm, P.skin, 0, -0.52, 0, 0.14); // hand
  waveArm.rotation.z = 0.12;

  // ---------- floating holographic nameplate (@vinyl810) ----------
  const holo = pivot(group, 1.18, F + 1.02, 0.45);
  const panel = box(holo, P.surfCyan, 0.98, 0.46, 0.04, 0, 0, 0, { opacity: 0.5 });
  panel.material = (panel.material as THREE.MeshToonMaterial).clone();
  const panelMat = panel.material as THREE.MeshToonMaterial;
  box(holo, P.foam, 0.82, 0.09, 0.02, 0, 0.07, 0.03, { emissive: 1 }); // "@vinyl810" bar
  for (let r = 0; r < 4; r++) {
    for (let cc = 0; cc < 4; cc++) {
      if ((r + cc) % 2 === 0) {
        voxel(holo, P.foam, -0.36 + cc * 0.06, -0.13 + (3 - r) * 0.06, 0.03, 0.05, {
          emissive: 0.6,
        });
      }
    }
  }

  // ---------- small warm deck lamp ----------
  const lampX = -1.2;
  const lampZ = 0.85;
  cyl(group, P.earth, 0.08, 0.1, 0.08, lampX, DECK + 0.1, lampZ, 8);
  box(group, P.slate, 0.05, 0.7, 0.05, lampX, DECK + 0.45, lampZ);
  box(group, P.slate, 0.05, 0.05, 0.3, lampX, DECK + 0.8, lampZ - 0.13, { rot: [0.5, 0, 0] });
  const bulb = cone(group, P.amber, 0.13, 0.2, lampX, DECK + 0.78, lampZ - 0.3, 8, {
    rot: [Math.PI, 0, 0],
    emissive: 1.2,
  });
  bulb.material = (bulb.material as THREE.MeshToonMaterial).clone();
  const bulbMat = bulb.material as THREE.MeshToonMaterial;

  // ---------- selection burst: voxel "hello" sparks around the head ----------
  // Created ONCE at build; animated only via `sel`. Invisible while idle.
  const sparks = pivot(group, 0, headY, 0); // co-located with the head
  const sparkMeshes: THREE.Mesh[] = [];
  const SPARK_N = 6;
  const sparkPal = [P.amber, P.surfCyan, P.magenta, P.gold, P.foam, P.synapse];
  for (let i = 0; i < SPARK_N; i++) {
    const a = (i / SPARK_N) * TAU;
    const s = voxel(sparks, sparkPal[i], Math.cos(a) * 0.34, 0.34 + Math.sin(a) * 0.18, 0.1, 0.07, {
      emissive: 1.2,
    });
    s.material = (s.material as THREE.MeshToonMaterial).clone();
    s.visible = false;
    sparkMeshes.push(s);
  }

  group.rotation.y = Math.PI / 4; // face the camera corner

  const selClock = makeSelectionClock();
  const holoBaseY = F + 1.02;
  const headBaseY = headY; // head group's resting y (for the hop)
  const torsoBaseY = F + 0.6; // torso pivot resting y
  const BLINK = 5.5;

  return {
    group,
    update(t, hover, selected) {
      const sel = selClock(t, selected); // -1 idle; else seconds since the tap
      // one-shot envelopes (see kit recipes)
      const flash = sel >= 0 ? Math.exp(-sel * 4) : 0; // 1→0 glow boost
      const wobble = sel >= 0 ? Math.exp(-sel * 5) * Math.sin(sel * 22) : 0; // overshoot+settle
      const hop = sel >= 0 ? Math.sin(Math.min(sel, 0.5) / 0.5 * Math.PI) * Math.exp(-sel * 1.5) : 0; // a single bounce

      // breathing (+ an excited squash-pop on click)
      torso.scale.y = 1 + 0.015 + 0.015 * osc(t, 2.4) + wobble * 0.05;

      // blink
      const sy = t % BLINK < 0.12 ? 0.15 : 1;
      eyeL.scale.y = sy;
      eyeR.scale.y = sy;

      // a cheerful hop: lift head + torso together (legs stay planted)
      head.position.y = headBaseY + hop * 0.16;
      torso.position.y = torsoBaseY + hop * 0.12;

      // wave arm: gentle outward sway + a hello wave every ~6s,
      // plus a bigger, snappier one-shot wave on click.
      const sway = 0.12 + 0.05 * osc(t, 3);
      const lp = t % 6;
      let waveZ;
      if (lp < 1.6) {
        const u = clamp(lp / 1.6, 0, 1);
        const raise = Math.sin(u * Math.PI) * 2.2; // up then back down
        const wag = Math.sin(u * Math.PI * 6) * 0.35 * Math.sin(u * Math.PI);
        waveZ = sway + raise + wag;
      } else {
        waveZ = sway;
      }
      if (sel >= 0) {
        // raise the arm high and wag it fast, settling within ~1s
        const env = Math.exp(-sel * 2.2);
        waveZ += env * (1.9 + Math.sin(sel * 26) * 0.55);
      }
      waveArm.rotation.z = waveZ;

      // tablet motif: wave cells ripple + neuron pulse
      for (let i = 0; i < waveCells.length; i++) {
        const m = waveCells[i].material as THREE.MeshToonMaterial;
        m.emissiveIntensity = 0.5 + 0.7 * (0.5 + 0.5 * osc(t, 1.4, i * 0.9));
        waveCells[i].position.y = waveBaseY[i] + 0.015 * osc(t, 1.2, i);
      }
      (neuronA.material as THREE.MeshToonMaterial).emissiveIntensity =
        0.5 + 0.8 * Math.abs(osc(t, 1.1));
      (neuronB.material as THREE.MeshToonMaterial).emissiveIntensity =
        0.5 + 0.8 * Math.abs(osc(t, 1.1, 1.6));
      screenMat.emissiveIntensity = 0.6 + 0.15 * osc(t, 2) + hover * 0.2;

      // floating nameplate bob + glow (+ a pop & flash on click)
      holo.position.y = holoBaseY + 0.05 * osc(t, 3);
      panelMat.opacity = clamp(
        0.4 + 0.18 * (0.5 + 0.5 * osc(t, 2.5)) + hover * 0.1 + flash * 0.45,
        0,
        1,
      );
      const holoPop = 1 + wobble * 0.12;
      holo.scale.set(holoPop, holoPop, 1);

      // lamp flicker (+ a warm flare on click)
      bulbMat.emissiveIntensity =
        1.2 * (1 + 0.08 * osc(t, 0.4) * (0.6 + 0.4 * osc(t, 0.13))) + flash * 0.9;

      // selection sparks: a quick voxel "yay!" burst that pops out from the
      // head, then fades. Fully hidden when idle.
      if (sel >= 0) {
        const burst = Math.sin(Math.min(sel, 0.45) / 0.45 * Math.PI) * Math.exp(-sel * 2.4);
        const out = 1 + Math.min(sel, 0.5) * 1.4; // fling outward
        for (let i = 0; i < sparkMeshes.length; i++) {
          const s = sparkMeshes[i];
          s.visible = burst > 0.02;
          const a = (i / SPARK_N) * TAU;
          s.position.set(Math.cos(a) * 0.34 * out, 0.34 + Math.sin(a) * 0.18 * out, 0.1);
          s.scale.setScalar(clamp(burst * 1.3, 0, 1.2));
          (s.material as THREE.MeshToonMaterial).emissiveIntensity = 0.6 + burst * 1.6;
        }
        sparks.rotation.z = sel * 1.5; // a little celebratory swirl
      } else if (sparkMeshes[0].visible) {
        for (const s of sparkMeshes) s.visible = false; // reset neutral
      }
    },
  };
}
