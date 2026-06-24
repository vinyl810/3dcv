import * as THREE from 'three';
import { P, box, cyl, cone, dome, pivot, osc, TAU, lerp, clamp, makeSelectionClock, type BuiltModel } from '../kit';

export function buildEducation(): BuiltModel {
  const group = new THREE.Group();

  // ---- refined stone plinth (light foam/sand so the dark cap pops against it) ----
  // sand base course
  box(group, P.sand, 1.5, 0.18, 1.5, 0, 0.09, 0);
  // foam stone body
  box(group, P.foam, 1.34, 0.5, 1.34, 0, 0.43, 0);
  // sand cap rail on top of the plinth for a finished edge
  box(group, P.sand, 1.46, 0.08, 1.46, 0, 0.72, 0);

  // ---- inlaid slate "KAIST" front panel on the camera-facing (+Z) face ----
  const frontZ = 0.68;
  // recessed slate plaque
  box(group, P.slate, 1.04, 0.34, 0.04, 0, 0.42, frontZ);
  // thin gold frame trim around the plaque (top/bottom rails)
  box(group, P.gold, 1.1, 0.03, 0.05, 0, 0.6, frontZ + 0.005);
  box(group, P.gold, 1.1, 0.03, 0.05, 0, 0.24, frontZ + 0.005);

  // amber "KAIST" lettering blocks across the plaque front
  const letterY = 0.42;
  const letterXs = [-0.42, -0.21, 0, 0.21, 0.42];
  const letters: THREE.Mesh[] = [];
  for (let i = 0; i < letterXs.length; i++) {
    const ltr = box(group, P.amber, 0.14, 0.18, 0.04, letterXs[i], letterY, frontZ + 0.02, {
      emissive: 0.35,
    });
    // clone the cached emit material so we can flash this letter on selection
    ltr.material = (ltr.material as THREE.MeshToonMaterial).clone();
    letters.push(ltr);
  }

  // ---- graduation cap (the HERO, toss-animated) ----
  const cap = pivot(group, 0, 0.76, 0); // sits on the plinth rail
  const capRestY = 0;

  // rounded skull cap the mortarboard rests on
  dome(cap, P.dusk, 0.46, 0, 0, 0, 14);
  // a lighter band around the base of the cap so it reads against the dome
  cyl(cap, P.horizon, 0.47, 0.47, 0.12, 0, 0.04, 0, 16);

  // mortarboard: flat board, tilted ~8deg
  const board = pivot(cap, 0, 0.46, 0);
  board.rotation.z = (8 * Math.PI) / 180;
  // dark abyss board top so the silhouette is crisp...
  box(board, P.abyss, 1.2, 0.07, 1.2, 0, 0.04, 0);
  // ...wrapped in a thin gold trim edge so the square reads against any bg
  box(board, P.gold, 1.28, 0.025, 0.06, 0, 0.075, 0.62);
  box(board, P.gold, 1.28, 0.025, 0.06, 0, 0.075, -0.62);
  box(board, P.gold, 0.06, 0.025, 1.28, 0.62, 0.075, 0);
  box(board, P.gold, 0.06, 0.025, 1.28, -0.62, 0.075, 0);
  // foam underside rim catches light from below
  box(board, P.foam, 1.16, 0.02, 1.16, 0, -0.01, 0);
  // gold button on top center
  cyl(board, P.gold, 0.06, 0.06, 0.05, 0, 0.105, 0, 12);

  // ---- vivid gold tassel: swinging chain off the front-right corner ----
  // front-right of the board (+x,+z corner before the group's PI/4 rotation)
  const tasselAnchor = pivot(board, 0.5, 0.08, 0.5);
  const seg = 0.1;
  let lastY = -seg / 2;
  for (let i = 0; i < 5; i++) {
    box(tasselAnchor, P.amber, 0.045, seg, 0.045, 0, lastY, 0, { emissive: 0.2 });
    lastY -= seg;
  }
  // gold bead at the end
  box(tasselAnchor, P.gold, 0.11, 0.11, 0.11, 0, lastY + seg / 2 - 0.02, 0, {
    emissive: 0.25,
  });

  // ---- stack of 3 books beside the plinth (front-left, toward +Z) ----
  const books = pivot(group, -0.95, 0, 0.5);
  function bookLayer(y: number, w: number, d: number, cover: number, tilt: number) {
    const b = pivot(books, 0, y, 0);
    b.rotation.y = tilt;
    box(b, cover, w, 0.16, d, 0, 0, 0); // cover
    box(b, P.foam, w - 0.08, 0.1, d - 0.08, 0, 0, 0); // pages peeking
    box(b, cover, 0.05, 0.18, d, -w / 2 + 0.025, 0, 0); // spine
    return b;
  }
  bookLayer(0.1, 0.62, 0.46, P.signalRed, 0.12);
  bookLayer(0.27, 0.58, 0.44, P.oceanTeal, -0.18);
  bookLayer(0.44, 0.54, 0.42, P.synapse, 0.06);

  // ---- diploma scroll resting on the books (rolled paper + gold ribbon) ----
  const scroll = pivot(books, 0, 0.58, 0);
  scroll.rotation.set(0, 0.5, Math.PI / 2);
  cyl(scroll, P.foam, 0.09, 0.09, 0.6, 0, 0, 0, 12);
  // rolled lips at each end
  cyl(scroll, P.sand, 0.1, 0.1, 0.06, 0, 0.3, 0, 12);
  cyl(scroll, P.sand, 0.1, 0.1, 0.06, 0, -0.3, 0, 12);
  // gold ribbon around the middle
  const ribbon = cyl(scroll, P.gold, 0.095, 0.095, 0.07, 0, 0, 0, 12, { emissive: 0.25 });
  // clone so the ribbon can shine on selection without touching the shared cache
  ribbon.material = (ribbon.material as THREE.MeshToonMaterial).clone();

  // ---- small celebratory pennant (front-right back corner) for life ----
  const flag = pivot(group, 0.78, 0.72, -0.55);
  box(flag, P.earth, 0.035, 1.0, 0.035, 0, 0.5, 0); // pole
  cone(flag, P.gold, 0.05, 0.06, 0, 1.02, 0, 8); // finial
  const pennant = pivot(flag, 0.035, 0.86, 0);
  const tri = cone(pennant, P.magenta, 0.15, 0.32, 0.16, 0, 0, 3, {
    rot: [0, 0, -Math.PI / 2],
  });

  // readable front (+Z) toward the camera corner
  group.rotation.y = Math.PI / 4;

  // ---- selection clock + base emissive snapshot ----
  const selClock = makeSelectionClock();
  const letterBaseEmit = 0.35;
  const ribbonBaseEmit = 0.25;
  const D2R = Math.PI / 180;

  // ---- animation ----
  // Tap = a "graduation moment": a proud high cap toss (no dizzy spin, so it
  // reads distinctly from the idle 360 toss), the iconic tassel TURN to the
  // other side, the diploma + books lifting to be presented, a pennant
  // flourish, and the KAIST plaque + diploma ribbon lighting up.
  return {
    group,
    update(t: number, hover: number, selected: boolean) {
      const sel = selClock(t, selected);
      const energy = 1 + hover * 0.6 + (selected ? 0.4 : 0);

      // one-shot envelopes for the tap
      const hop = sel >= 0 ? Math.sin(Math.min(sel, 0.5) / 0.5 * Math.PI) * Math.exp(-sel * 1.2) : 0; // proud single arc
      const turn = sel >= 0 ? Math.sin(Math.min(sel, 0.5) / 0.5 * Math.PI) * Math.exp(-sel * 0.8) : 0; // tassel sweep
      const wobble = sel >= 0 ? Math.exp(-sel * 4) * Math.sin(sel * 16) : 0; // settle wobble
      const flash = sel >= 0 ? Math.exp(-sel * 4) : 0; // 1 -> 0 glow boost

      // tassel: idle pendulum swing + the iconic graduation "tassel turn" on tap
      const swing = (14 * D2R) * osc(t, 2.4) * energy;
      tasselAnchor.rotation.z = swing + (46 * D2R) * turn;
      tasselAnchor.rotation.x = (5 * D2R) * osc(t, 2.4, 0.6);

      // celebratory cap toss every ~9s (hop + full 360 spin) — the idle ritual
      const cycle = 9;
      const phase = t % cycle;
      let lift = 0;
      let spin = 0;
      let tilt = 0;
      if (phase < 1.3) {
        const u = clamp(phase / 1.3, 0, 1);
        const arc = Math.sin(u * Math.PI);
        lift = 0.42 * arc;
        spin = u * TAU; // full 360 over the toss
        tilt = (6 * D2R) * Math.sin(u * Math.PI * 2);
      }
      // tap: a PROUD high pop that tips its cap — no spin, so it's distinct
      lift += 0.52 * hop;
      tilt += (9 * D2R) * wobble;
      cap.position.y = (0.76 + capRestY) + lift;
      cap.rotation.y = spin;
      cap.rotation.z = tilt;

      // diploma + books lift to be "presented" on the tap; scroll shimmers idle
      books.position.y = hop * 0.09;
      scroll.rotation.y = 0.5 + (4 * D2R) * osc(t, 3.2) + (10 * D2R) * turn;

      // pennant waves idle + a celebratory flourish on the tap
      pennant.rotation.y = (11 * D2R) * osc(t, 1.6) * energy + (20 * D2R) * wobble;
      pennant.rotation.x = (6 * D2R) * osc(t, 1.1, 1.0);
      tri.position.x = lerp(0.15, 0.19, (osc(t, 1.6) + 1) / 2);

      // KAIST plaque lettering + the diploma ribbon light up on the tap
      const letterEmit = letterBaseEmit + flash * 1.5;
      for (const ltr of letters) {
        (ltr.material as THREE.MeshToonMaterial).emissiveIntensity = letterEmit;
      }
      (ribbon.material as THREE.MeshToonMaterial).emissiveIntensity = ribbonBaseEmit + flash * 1.6;
    },
  };
}