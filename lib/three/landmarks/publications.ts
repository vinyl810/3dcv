import * as THREE from 'three';
import {
  P,
  box,
  voxel,
  cyl,
  mat,
  osc,
  TAU,
  lerp,
  clamp,
  makeSelectionClock,
  type BuiltModel,
} from '../kit';

export function buildPublications(): BuiltModel {
  const group = new THREE.Group();

  // ---- writing lectern ----
  // base column
  box(group, P.earth, 0.7, 0.8, 0.5, 0, 0.4, 0);
  // little foot for stability
  box(group, P.earth, 0.85, 0.1, 0.62, 0, 0.05, 0);
  // a darker plinth shadow line so the foot reads as a separate plate
  box(group, P.abyss, 0.86, 0.03, 0.63, 0, 0.105, 0);
  // angled top desk, tilted ~20deg toward the viewer (+Z)
  box(group, P.earth, 0.78, 0.07, 0.58, 0, 0.86, 0.02, { rot: [-0.35, 0, 0] });
  // a small lip on the desk's lower edge to "hold" the papers
  box(group, P.earth, 0.78, 0.06, 0.05, 0, 0.78, 0.27, { rot: [-0.35, 0, 0] });

  // ---- the resting surface for everything that sits "on" the desk ----
  // Mounted into a tilted pivot so it shares the lectern's slope.
  const surface = new THREE.Group();
  surface.position.set(0, 0.9, 0.02);
  surface.rotation.x = -0.35;
  group.add(surface);

  // ============================================================
  // BOUND JOURNAL (the hero silhouette)
  // A thick book with a colored cover + visible spine and page block.
  // ============================================================
  const bookW = 0.74;
  const bookD = 0.54;
  const coverT = 0.035;
  const pageBlockH = 0.14; // stacked page edges between covers
  const bookBaseY = 0.04;

  // bottom cover (oceanTeal binding)
  box(surface, P.oceanTeal, bookW, coverT, bookD, 0, bookBaseY, 0);
  // page block (cream edges) sandwiched between covers
  const pageBlockY = bookBaseY + coverT / 2 + pageBlockH / 2;
  box(surface, P.foam, bookW - 0.05, pageBlockH, bookD - 0.04, 0, pageBlockY, 0.005);
  // faint horizontal banding on the fore-edge so it reads as many pages
  for (let i = 0; i < 4; i++) {
    box(
      surface,
      P.sand,
      bookW - 0.04,
      0.006,
      bookD - 0.03,
      0,
      pageBlockY - pageBlockH / 2 + 0.02 + i * 0.034,
      0.012,
      { name: 'pageband' },
    );
  }
  // top cover (oceanTeal binding) — the journal's face
  const topCoverY = pageBlockY + pageBlockH / 2 + coverT / 2;
  box(surface, P.oceanTeal, bookW, coverT, bookD, 0, topCoverY, 0);

  // raised spine ridge along the back (-Z) edge, taller than the page block
  box(
    surface,
    P.abyss,
    bookW + 0.02,
    coverT * 2 + pageBlockH + 0.02,
    0.05,
    0,
    pageBlockY + 0.01,
    -bookD / 2 + 0.02,
  );
  // gold spine band accents
  box(surface, P.gold, bookW * 0.62, 0.02, 0.052, 0, pageBlockY + 0.05, -bookD / 2 + 0.02, {
    emissive: 0.25,
  });
  box(surface, P.gold, bookW * 0.62, 0.02, 0.052, 0, pageBlockY - 0.04, -bookD / 2 + 0.02, {
    emissive: 0.25,
  });

  // ---- cover typography (a "title block" + author bars in gold) ----
  const coverTopY = topCoverY + coverT / 2 + 0.004;
  // gold title plate (cloned to flare on selection)
  const titlePlate = box(surface, P.gold, 0.5, 0.01, 0.1, 0, coverTopY, -0.13, { emissive: 0.3 });
  titlePlate.material = (titlePlate.material as THREE.MeshToonMaterial).clone();
  const titlePlateMat = titlePlate.material as THREE.MeshToonMaterial;
  // a slim gold rule under the title
  box(surface, P.gold, 0.46, 0.008, 0.018, 0, coverTopY, -0.04, { emissive: 0.2 });
  // author / volume bars (slate) lower on the cover
  for (let r = 0; r < 2; r++) {
    box(surface, P.slate, 0.3 - r * 0.08, 0.007, 0.02, 0, coverTopY, 0.08 + r * 0.07);
  }
  // small cyan "volume" chip in a corner
  box(surface, P.surfCyan, 0.1, 0.012, 0.07, 0.26, coverTopY, 0.18, { emissive: 0.4 });

  // ============================================================
  // FLOATING TURNING PAGE (focal motion)
  // A crisp single sheet that lifts and spins 360, carrying a glowing
  // cyan "abstract" block + a gold DOI tag + faint text lines.
  // ============================================================
  const floatBaseY = topCoverY + 0.18;
  const floatPivot = new THREE.Group();
  floatPivot.position.set(0, floatBaseY, 0);
  surface.add(floatPivot);

  const sheetW = 0.66;
  const sheetT = 0.022;
  const sheetD = 0.48;
  // the sheet itself
  box(floatPivot, P.foam, sheetW, sheetT, sheetD, 0, 0, 0);
  // thin colored header bar so the page reads as a formatted article
  box(floatPivot, P.oceanTeal, sheetW - 0.06, sheetT + 0.004, 0.05, 0, 0.002, -sheetD / 2 + 0.06, {
    emissive: 0.15,
  });

  // glowing cyan "abstract" block on the floating sheet (cloned to pulse)
  const abstract = box(
    floatPivot,
    P.surfCyan,
    0.3,
    sheetT + 0.012,
    0.14,
    -0.13,
    0.004,
    0.0,
    { emissive: 0.5 },
  );
  abstract.material = (abstract.material as THREE.MeshToonMaterial).clone();
  const abstractMat = abstract.material as THREE.MeshToonMaterial;

  // faint slate text lines on the right column of the floating sheet
  for (let r = 0; r < 4; r++) {
    box(floatPivot, P.slate, 0.22, 0.006, 0.014, 0.16, sheetT / 2 + 0.004, -0.07 + r * 0.05);
  }
  // gold "DOI" tag clipped to a corner of the floating sheet (cloned to flare)
  const doiTag = box(floatPivot, P.gold, 0.16, 0.02, 0.08, 0.2, sheetT / 2 + 0.012, -0.16, {
    emissive: 0.45,
  });
  doiTag.material = (doiTag.material as THREE.MeshToonMaterial).clone();
  const doiTagMat = doiTag.material as THREE.MeshToonMaterial;

  // ============================================================
  // QUILL IN AN INKPOT (back-left of the desk)
  // ============================================================
  // inkpot body + rim for a clearer vessel read
  box(surface, P.abyss, 0.18, 0.13, 0.18, -0.3, 0.07, -0.17);
  box(surface, P.slate, 0.2, 0.02, 0.2, -0.3, 0.135, -0.17);
  // glossy ink surface glint inside the rim
  box(surface, P.oceanTeal, 0.11, 0.02, 0.11, -0.3, 0.145, -0.17, { emissive: 0.2 });

  // quill assembly in its own pivot so the feather can sway
  const quill = new THREE.Group();
  quill.position.set(-0.3, 0.14, -0.17);
  surface.add(quill);
  // stem (shaft)
  cyl(quill, P.earth, 0.01, 0.02, 0.58, 0, 0.29, 0, 6, { rot: [0.12, 0, -0.18] });
  // feather pivot near the top of the shaft so vane + spine sway together
  const feather = new THREE.Group();
  feather.position.set(0.07, 0.46, 0);
  feather.rotation.set(0.12, 0, -0.28);
  quill.add(feather);
  // feather vane (broad tapered blade)
  box(feather, P.foam, 0.07, 0.34, 0.012, 0, 0.12, 0);
  // feather spine (a darker central rib for legibility)
  box(feather, P.slate, 0.012, 0.36, 0.016, 0, 0.12, 0.001);
  // feather tip accent
  box(feather, P.surfCyan, 0.05, 0.06, 0.012, 0, 0.3, 0, { emissive: 0.2 });

  // ============================================================
  // MAGNIFYING GLASS leaning on the journal (lens glint pulse)
  // ============================================================
  const magnifier = new THREE.Group();
  magnifier.position.set(0.36, topCoverY + 0.04, 0.1);
  magnifier.rotation.set(0.2, 0, -0.5);
  surface.add(magnifier);
  // slate ring (torus) for the lens frame
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.03, 6, 16), mat(P.slate));
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, 0.2, 0);
  magnifier.add(ring);
  // translucent cyan lens filling the ring
  cyl(magnifier, P.surfCyan, 0.17, 0.17, 0.02, 0, 0.2, 0, 16, { opacity: 0.35 });
  // glint overlay on the lens (cloned, animated opacity + emissive)
  const glint = cyl(magnifier, P.foam, 0.16, 0.16, 0.012, 0, 0.205, 0, 16, { emissive: 0.0 });
  glint.material = (glint.material as THREE.MeshToonMaterial).clone();
  const glintMat = glint.material as THREE.MeshToonMaterial;
  glintMat.transparent = true;
  glintMat.opacity = 0.0;
  // ferrule + handle of the magnifier
  cyl(magnifier, P.gold, 0.03, 0.03, 0.05, 0, 0.0, 0, 8, { emissive: 0.15 });
  cyl(magnifier, P.earth, 0.022, 0.022, 0.3, 0, -0.16, 0, 6);

  // ============================================================
  // SMALL DETAIL: citation / poster cards + an award ribbon hint
  // ============================================================
  // two tidy citation cards fanned at the front-right of the desk
  const card1 = box(surface, P.foam, 0.2, 0.012, 0.14, 0.24, 0.05, 0.22, { rot: [0, 0.25, 0] });
  // faint text on card1
  for (let r = 0; r < 2; r++) {
    box(surface, P.slate, 0.13, 0.005, 0.012, 0.24, 0.057, 0.18 + r * 0.05, { rot: [0, 0.25, 0] });
  }
  // a colored tab on card1 so it reads as a labeled reference
  box(surface, P.magenta, 0.05, 0.014, 0.04, 0.32, 0.05, 0.16, { rot: [0, 0.25, 0], emissive: 0.3 });
  void card1;

  // award ribbon hint: a gold seal medallion with two hanging tails (front-left)
  const ribbon = new THREE.Group();
  ribbon.position.set(-0.26, 0.05, 0.2);
  surface.add(ribbon);
  // seal disc
  cyl(ribbon, P.gold, 0.06, 0.06, 0.018, 0, 0.01, 0, 12, { emissive: 0.35 });
  cyl(ribbon, P.amber, 0.035, 0.035, 0.022, 0, 0.012, 0, 12, { emissive: 0.25 });
  // two ribbon tails fanning forward (+Z)
  box(ribbon, P.signalRed, 0.03, 0.01, 0.12, -0.025, 0.005, 0.09, { rot: [0, 0.2, 0] });
  box(ribbon, P.signalRed, 0.03, 0.01, 0.12, 0.025, 0.005, 0.09, { rot: [0, -0.2, 0] });

  // tiny loose sheet corner near the magnifier for scatter
  voxel(surface, P.foam, 0.32, 0.03, -0.22, 0.06);

  // orient readable front toward the +X+Z camera corner
  group.rotation.y = Math.PI / 4;

  // ---- animation ----
  const TURN = 8; // seconds for one full page turn cycle
  const selClock = makeSelectionClock();
  const floatBaseScale = floatPivot.scale.x; // baked geometry scale (== 1)

  return {
    group,
    update(t, hover, selected) {
      // steady animation rate — hover only affects lift/scale

      // turning-page cycle: lift -> rotate 360 -> settle
      const phase = (t) % TURN;
      const f = phase / TURN; // 0..1 within the cycle

      // lift profile: rise in first 15%, hold, settle in last 15%
      const liftUp = clamp(f / 0.15, 0, 1);
      const liftDown = 1 - clamp((f - 0.85) / 0.15, 0, 1);
      const lift = Math.min(liftUp, liftDown); // 0 at ends, 1 in middle
      const liftEased = lift * lift * (3 - 2 * lift); // smoothstep
      floatPivot.position.y = floatBaseY + liftEased * 0.32;

      // full 360 turn on y across the cycle
      floatPivot.rotation.y = f * TAU;
      // a little flutter tilt while airborne
      floatPivot.rotation.x = osc(t, 1.3) * 0.07 * liftEased;
      floatPivot.rotation.z = osc(t, 1.9, 0.5) * 0.04 * liftEased;

      // cyan abstract block shimmer
      abstractMat.emissiveIntensity = 0.4 + 0.45 * (0.5 + 0.5 * osc(t, 1.6));

      // quill feather sway
      feather.rotation.z = -0.28 + osc(t, 2.4) * 0.08;
      feather.rotation.x = 0.12 + osc(t, 3.1, 1.0) * 0.05;

      // magnifying lens periodic specular glint (sharp pulse every ~3.5s)
      const g = osc(t, 3.5);
      const glintPulse = Math.pow(clamp(g, 0, 1), 6); // sharp, brief flash
      glintMat.opacity = lerp(0.0, 0.85, glintPulse);
      glintMat.emissiveIntensity = glintPulse * 1.2;

      // ---- SELECTION BURST: a scholarly "published!" beat on a fresh click ----
      const sel = selClock(t, selected);
      if (sel >= 0) {
        // publication metadata lights up: title plate + DOI tag + abstract
        const flash = Math.exp(-sel * 4); // 1 -> 0
        titlePlateMat.emissiveIntensity = 0.3 + flash * 1.3;
        // DOI flares a touch later for an outward ripple feel
        doiTagMat.emissiveIntensity = 0.45 + Math.exp(-sel * 4) * 1.1 * clamp(sel * 6, 0, 1);
        abstractMat.emissiveIntensity += flash * 1.0;

        // the floating sheet does an EAGER extra page-turn: a quick lift + an
        // added 360 flip + a little overshoot pop, layered on the idle turn.
        const flip = clamp(sel / 0.6, 0, 1);
        const hop = Math.sin(Math.min(sel, 0.5) / 0.5 * Math.PI) * Math.exp(-sel * 1.5);
        const wobble = Math.exp(-sel * 5) * Math.sin(sel * 22);
        floatPivot.rotation.y += flip * TAU;
        floatPivot.position.y += hop * 0.14;
        floatPivot.scale.setScalar(floatBaseScale * (1 + wobble * 0.1));

        // the magnifier glint flares, as if inspecting the freshly published work
        const magFlash = Math.exp(-sel * 4);
        glintMat.opacity = Math.max(glintMat.opacity, magFlash * 0.9);
        glintMat.emissiveIntensity = Math.max(glintMat.emissiveIntensity, magFlash * 1.4);
      } else {
        // not selected: every selection-driven offset fully neutral
        titlePlateMat.emissiveIntensity = 0.3;
        doiTagMat.emissiveIntensity = 0.45;
        floatPivot.scale.setScalar(floatBaseScale);
      }

      // the quill dips and "writes" on the tap (set every frame so it resets clean)
      const write = sel >= 0 ? Math.exp(-sel * 2.5) : 0;
      const scribble = write * Math.sin(sel * 26);
      quill.rotation.x = write * 0.12;
      quill.rotation.z = scribble * 0.22;
    },
  };
}