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

  const HOODIE = 0x1d3d47; // deep teal — a darker hoodie

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
  // hood bunched behind the neck + two drawstrings down the chest (cozy details)
  box(torso, HOODIE, 0.48, 0.2, 0.16, 0, 0.64, -0.13); // hood (down)
  box(torso, P.dusk, 0.4, 0.13, 0.04, 0, 0.66, -0.18); // hood inner shadow
  box(torso, P.foam, 0.03, 0.2, 0.03, -0.07, 0.52, 0.18); // drawstring L
  box(torso, P.foam, 0.03, 0.2, 0.03, 0.07, 0.52, 0.18); // drawstring R
  box(torso, P.foam, 0.05, 0.05, 0.05, -0.07, 0.41, 0.19); // aglet L
  box(torso, P.foam, 0.05, 0.05, 0.05, 0.07, 0.41, 0.19); // aglet R
  // a soft neck so the head doesn't float on the shoulders
  box(torso, P.skin, 0.2, 0.15, 0.2, 0, 0.71, 0);

  const shY = F + 1.18; // shoulder height
  const headY = F + 1.5; // head center

  // head
  const head = new THREE.Group();
  head.position.set(0, headY, 0);
  group.add(head);
  voxel(head, P.skin, 0, 0, 0, 0.46);
  box(head, P.hair, 0.5, 0.18, 0.5, 0, 0.24, 0); // hair cap
  box(head, P.hair, 0.5, 0.08, 0.06, 0, 0.16, 0.24); // front fringe
  // fuller, softer hair: a top tuft, side sweeps, back volume + a swept fringe
  box(head, P.hair, 0.5, 0.08, 0.5, 0, 0.28, 0); // top volume (shorter)
  box(head, P.hair, 0.1, 0.34, 0.46, -0.235, 0.06, -0.03); // left side sweep
  box(head, P.hair, 0.1, 0.34, 0.46, 0.235, 0.06, -0.03); // right side sweep
  box(head, P.hair, 0.5, 0.32, 0.12, 0, 0.12, -0.235); // back hair
  box(head, P.hair, 0.18, 0.12, 0.05, -0.13, 0.19, 0.24); // swept fringe strand L
  box(head, P.hair, 0.12, 0.16, 0.05, 0.13, 0.16, 0.24); // swept fringe strand R
  box(head, P.earth, 0.34, 0.045, 0.06, -0.04, 0.3, 0.2); // soft lighter highlight
  const eyeL = pivot(head, -0.1, 0.02, 0.252);
  const eyeR = pivot(head, 0.1, 0.02, 0.252);
  voxel(eyeL, P.abyss, 0, 0, 0, 0.07);
  voxel(eyeR, P.abyss, 0, 0, 0, 0.07);
  voxel(eyeL, P.foam, 0.02, 0.022, 0.03, 0.025); // catch-light (sparkle)
  voxel(eyeR, P.foam, 0.02, 0.022, 0.03, 0.025);

  // ----- neat round glasses (researcher charm): slim-framed glass lenses -----
  for (const ex of [-0.1, 0.1]) {
    box(head, P.slate, 0.16, 0.16, 0.015, ex, 0.02, 0.231); // frame
    box(head, P.surfCyan, 0.125, 0.125, 0.012, ex, 0.02, 0.238, { opacity: 0.4 }); // glass lens
    box(head, P.slate, 0.022, 0.022, 0.28, Math.sign(ex) * 0.19, 0.03, 0.08); // temple arm
  }
  box(head, P.slate, 0.08, 0.026, 0.02, 0, 0.03, 0.243); // bridge

  // ----- eyebrows, rosy cheeks, a gentle smile -----
  box(head, P.hair, 0.12, 0.028, 0.02, -0.1, 0.14, 0.238);
  box(head, P.hair, 0.12, 0.028, 0.02, 0.1, 0.14, 0.238);
  voxel(head, P.horizon, -0.17, -0.08, 0.2, 0.075); // blush L
  voxel(head, P.horizon, 0.17, -0.08, 0.2, 0.075); // blush R
  box(head, P.earth, 0.1, 0.026, 0.02, 0, -0.135, 0.238); // mouth
  voxel(head, P.earth, -0.07, -0.115, 0.236, 0.03); // up-ticked corner L
  voxel(head, P.earth, 0.07, -0.115, 0.236, 0.03); // up-ticked corner R

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
  // real warm light source; off by day, gated on at night in models.ts
  const deckLight = new THREE.PointLight(new THREE.Color().setHex(0xffca7a, THREE.SRGBColorSpace), 0, 4.5, 1.8);
  deckLight.position.set(lampX, DECK + 0.9, lampZ - 0.3);
  deckLight.userData.nightBase = 2.0;
  group.add(deckLight);

  group.rotation.y = Math.PI / 4; // face the camera corner

  const selClock = makeSelectionClock();
  const holoBaseY = F + 1.02;
  const headBaseY = headY; // head group's resting y (for the hop)
  const headBaseRotX = head.rotation.x; // resting head pitch (for the nod)
  const headBaseRotZ = head.rotation.z; // resting head roll (for the tilt)
  const torsoBaseY = F + 0.6; // torso pivot resting y
  const BLINK = 5.5;

  return {
    group,
    nightLight: deckLight,
    update(t, hover, selected) {
      const sel = selClock(t, selected); // -1 idle; else seconds since the tap
      // one-shot envelopes (see kit recipes)
      const flash = sel >= 0 ? Math.exp(-sel * 4) : 0; // 1→0 glow boost
      const wobble = sel >= 0 ? Math.exp(-sel * 5) * Math.sin(sel * 22) : 0; // overshoot+settle
      const hop = sel >= 0 ? Math.sin(Math.min(sel, 0.5) / 0.5 * Math.PI) * Math.exp(-sel * 1.5) : 0; // a single bounce
      // a soft, friendly "hello there!" envelope that rises fast and eases out (~1s)
      const greet = sel >= 0 ? Math.sin(Math.min(sel, 0.55) / 0.55 * Math.PI) * Math.exp(-sel * 2) : 0;

      // breathing (+ an excited squash-pop on click)
      torso.scale.y = 1 + 0.015 + 0.015 * osc(t, 2.4) + wobble * 0.05;

      // blink
      const sy = t % BLINK < 0.12 ? 0.15 : 1;
      eyeL.scale.y = sy;
      eyeR.scale.y = sy;

      // a cheerful hop: lift head + torso together (legs stay planted)
      head.position.y = headBaseY + hop * 0.16;
      torso.position.y = torsoBaseY + hop * 0.12;

      // warm greeting head-language: a quick friendly nod + a gentle head tilt
      // that reads as "hi, nice to meet you" and settles back to idle.
      const nod = sel >= 0 ? Math.sin(sel * 9) * Math.exp(-sel * 3.4) : 0; // dip-and-recover nod
      head.rotation.x = headBaseRotX + greet * 0.16 + nod * 0.08; // chin dips toward viewer
      head.rotation.z = headBaseRotZ + greet * 0.12; // endearing little tilt

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
        // a friendly TWO-BEAT hello: raise the arm and give two clear waves,
        // easing back to idle within ~1s (reads as "hi! :)" not a frantic shake)
        const env = Math.exp(-sel * 2.2);
        waveZ += env * (1.85 + Math.sin(sel * 12) * 0.7);
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
      // tablet screen warms up with a friendly greeting glow on tap
      screenMat.emissiveIntensity = 0.6 + 0.15 * osc(t, 2) + hover * 0.2 + greet * 0.7;

      // floating nameplate: bob + glow, and on tap it gives a friendly pop &
      // brighten (a little hop of its own) to "say hi" alongside the character.
      holo.position.y = holoBaseY + 0.05 * osc(t, 3) + greet * 0.1;
      panelMat.opacity = clamp(
        0.4 + 0.18 * (0.5 + 0.5 * osc(t, 2.5)) + hover * 0.1 + flash * 0.45 + greet * 0.25,
        0,
        1,
      );
      const holoPop = 1 + greet * 0.16 + wobble * 0.08;
      holo.scale.set(holoPop, holoPop, 1);

      // lamp flicker (+ a warm flare on click)
      bulbMat.emissiveIntensity =
        1.2 * (1 + 0.08 * osc(t, 0.4) * (0.6 + 0.4 * osc(t, 0.13))) + flash * 0.9;
    },
  };
}
