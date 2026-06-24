import * as THREE from 'three';
import { P, box, cyl, cone, sphere, mat, osc, clamp, makeSelectionClock, type BuiltModel } from '../kit';

export function buildCoursework(): BuiltModel {
  const group = new THREE.Group();

  // ============================================================
  // BOOKSHELF FRAME (P.earth) ~1.5 W x 2.2 H x 0.6 D
  // Open front faces +Z.
  // ============================================================
  const W = 1.5;
  const H = 2.2;
  const D = 0.6;
  const panelT = 0.08;
  const halfW = W / 2;

  // side panels
  box(group, P.earth, panelT, H, D, -halfW + panelT / 2, H / 2, 0);
  box(group, P.earth, panelT, H, D, halfW - panelT / 2, H / 2, 0);
  // back panel (set toward -Z, leaving the front open)
  box(group, P.earth, W, H, panelT, 0, H / 2, -D / 2 + panelT / 2);
  // a slightly darker inner back so the cavity reads with depth
  box(group, P.abyss, W - panelT * 2, H - panelT * 2, 0.02, 0, H / 2, -D / 2 + panelT + 0.01);

  // 4 horizontal shelf boards: bottom, two dividers, top -> 3 rows.
  const innerW = W - panelT * 2;
  const boardY = [0.06, H / 3, (H * 2) / 3, H - 0.05];
  for (const by of boardY) {
    box(group, P.earth, innerW, 0.07, D - 0.04, 0, by, 0.01);
  }

  // shelf row centers (vertical midpoint between consecutive boards)
  const rowY = [
    (boardY[0] + boardY[1]) / 2,
    (boardY[1] + boardY[2]) / 2,
    (boardY[2] + boardY[3]) / 2,
  ];
  const rowH = boardY[1] - boardY[0]; // approx interior height per row

  // ============================================================
  // BOOKS — thin vertical spines standing on each shelf.
  // Each shelf: 5-6 upright spines + ONE book laid flat on top.
  // We track every upright spine so idle motion can pick one per shelf.
  // ============================================================
  const spinePalette = [
    P.grass,
    P.synapse,
    P.magenta,
    P.gold,
    P.surfCyan,
    P.signalRed,
    P.oceanTeal,
    P.sand,
  ];

  interface PickBook {
    mesh: THREE.Mesh;
    baseZ: number;
  }
  // featured (pulsing) spines — one per shelf, cloned material
  const featured: THREE.MeshToonMaterial[] = [];
  // featured spine meshes (one per shelf) so selection can hop them out
  const featuredBooks: PickBook[] = [];
  // per-shelf list of pickable upright books
  const shelves: PickBook[][] = [[], [], []];

  const spineW = 0.12;
  const spineD = 0.34;
  const usableW = innerW - 0.08;

  for (let s = 0; s < 3; s++) {
    const count = 5 + (s % 2); // 5 or 6 books per shelf
    const gap = 0.018;
    const totalW = count * spineW + (count - 1) * gap;
    const startX = -totalW / 2 + spineW / 2;
    const shelfBaseY = boardY[s] + 0.035; // sit on top of the board
    void usableW;

    for (let i = 0; i < count; i++) {
      // deterministic height variation (no Math.random)
      const variant = (i * 3 + s * 2) % 5;
      const spineH = clamp(rowH * 0.62 + variant * 0.022, 0.42, 0.58);
      const colHex = spinePalette[(i + s * 2) % spinePalette.length];
      const x = startX + i * (spineW + gap);
      const baseZ = D / 2 - spineD / 2 - 0.06; // toward the open front
      const yPos = shelfBaseY + spineH / 2;

      // The featured (middle-ish) book per shelf glows — give it a cloned mat.
      const isFeatured = i === Math.floor(count / 2);
      const m = box(group, colHex, spineW, spineH, spineD, x, yPos, baseZ, {
        emissive: isFeatured ? 0.25 : undefined,
      });
      if (isFeatured) {
        m.material = (m.material as THREE.MeshToonMaterial).clone();
        featured.push(m.material as THREE.MeshToonMaterial);
        featuredBooks.push({ mesh: m, baseZ });
      }
      // tiny pale page-edge stripe on the front face for charm
      box(group, P.foam, spineW * 0.55, spineH * 0.84, 0.015, x, yPos, baseZ + spineD / 2 - 0.005);

      shelves[s].push({ mesh: m, baseZ });
    }

    // ONE book laid FLAT on top of the standing books.
    const flatHex = spinePalette[(s * 3 + 1) % spinePalette.length];
    const flatY = shelfBaseY + clamp(rowH * 0.62, 0.42, 0.58) + 0.05;
    box(group, flatHex, totalW * 0.62, 0.1, spineD - 0.02, -totalW * 0.1, flatY, D / 2 - spineD / 2 - 0.06);
    // a thin page block hint along the flat book's front
    box(group, P.foam, totalW * 0.6, 0.04, 0.02, -totalW * 0.1, flatY, D / 2 - 0.09);
  }

  // ============================================================
  // TOP OF SHELF: label plate + a charm (potted plant)
  // ============================================================
  const topY = boardY[3] + 0.03;

  // gold/slate label plate, front-facing (+Z)
  box(group, P.slate, 0.6, 0.16, 0.06, -0.2, topY + 0.09, D / 2 - 0.12);
  box(group, P.gold, 0.5, 0.1, 0.02, -0.2, topY + 0.09, D / 2 - 0.085, { emissive: 0.3 });

  // CHARM: tiny potted plant (earth pot + grass cone) — swaying in its pivot.
  const plant = new THREE.Group();
  plant.position.set(0.45, topY, 0.02);
  group.add(plant);
  cyl(plant, P.earth, 0.11, 0.085, 0.13, 0, 0.065, 0, 10);
  cyl(plant, P.moss, 0.1, 0.1, 0.02, 0, 0.13, 0, 10);
  // foliage (two stacked cones for a leafy little bush)
  cone(plant, P.grass, 0.14, 0.22, 0, 0.25, 0, 8);
  cone(plant, P.grass, 0.1, 0.16, 0, 0.36, 0, 8);
  // a small amber apple tucked beside the pot
  sphere(group, P.amber, 0.07, 0.7, topY + 0.07, 0.05, 8, { emissive: 0.18 });

  // ============================================================
  // FLOATING "IDEA" LIGHTBULB to the left, on a thin stem.
  // ============================================================
  const idea = new THREE.Group();
  idea.position.set(-halfW - 0.1, rowY[1] + 0.1, D / 2 - 0.05);
  group.add(idea);
  // thin stem reaching back toward the shelf side panel
  cyl(idea, P.slate, 0.012, 0.012, 0.26, 0.12, 0.02, 0, 6, { rot: [0, 0, Math.PI / 2] });
  // bulb (emissive, cloned so it can blink)
  const bulb = sphere(idea, P.amber, 0.12, 0, 0.16, 0, 8, { emissive: 0.9 });
  bulb.material = (bulb.material as THREE.MeshToonMaterial).clone();
  const bulbMat = bulb.material as THREE.MeshToonMaterial;
  // little screw base
  cyl(idea, P.gold, 0.05, 0.05, 0.05, 0, 0.04, 0, 8, { emissive: 0.2 });
  const ideaBaseY = idea.position.y;

  // ============================================================
  // SELECTION BURST GEOMETRY — radiating "eureka" shine lines around the
  // idea bulb (the classic lightbulb idea-burst). Built ONCE here; animated
  // via `sel` in update; invisible while idle.
  // ============================================================
  const bulbCenterY = 0.16; // bulb center within the idea group
  const RAY_N = 8;
  const rayLen = 0.16; // baked length of each shine dash (along local X)
  const rays: { mesh: THREE.Mesh; ang: number }[] = [];
  for (let k = 0; k < RAY_N; k++) {
    const ang = (k / RAY_N) * Math.PI * 2;
    // a thin gold dash whose long axis (X) is rotated to point radially in XY.
    const ray = box(idea, P.gold, rayLen, 0.03, 0.03, 0, bulbCenterY, 0, { emissive: 0.9 });
    ray.material = (ray.material as THREE.MeshToonMaterial).clone();
    ray.rotation.z = ang;
    ray.visible = false;
    rays.push({ mesh: ray, ang });
  }

  // shared selection clock for this landmark
  const selClock = makeSelectionClock();

  // orient readable front toward the +X+Z camera corner
  group.rotation.y = Math.PI / 4;

  // ============================================================
  // IDLE ANIMATION
  // ============================================================
  const SLIDE = 0.12;
  const PICK_PERIOD = 2.6; // each shelf advances its picked book on this beat

  return {
    group,
    update(t, hover, selected) {
      // seconds since this landmark was clicked (-1 while not selected)
      const sel = selClock(t, selected);

      // --- staggered "book being picked" slide, one per shelf ---
      for (let s = 0; s < 3; s++) {
        const list = shelves[s];
        if (list.length === 0) continue;
        const period = PICK_PERIOD + s * 0.7; // de-sync shelves
        const cyclePos = t / period + s * 0.33;
        const which = Math.floor(cyclePos) % list.length;
        const frac = cyclePos - Math.floor(cyclePos); // 0..1 within this book
        // smooth out-and-back over the cycle
        const outBack = Math.sin(frac * Math.PI); // 0 -> 1 -> 0
        const eased = outBack * outBack * (3 - 2 * outBack);
        // reset all books on this shelf, then push the active one forward
        for (const b of list) b.mesh.position.z = b.baseZ;
        const active = list[which];
        active.mesh.position.z = active.baseZ + eased * SLIDE;
      }

      // --- featured spine pulse ---
      const pulse = 0.5 + 0.5 * osc(t, 1.8);
      for (let i = 0; i < featured.length; i++) {
        featured[i].emissiveIntensity = 0.2 + 0.55 * (0.5 + 0.5 * osc(t, 2.0, i * 1.1));
      }
      void pulse;

      // --- idea bulb bob + ~2s blink ---
      idea.position.y = ideaBaseY + osc(t, 2.4) * 0.05;
      const blink = 0.5 + 0.5 * osc(t, 2.0);
      bulbMat.emissiveIntensity = 0.45 + 1.0 * blink + hover * 0.3;

      // --- potted plant sway ---
      plant.rotation.z = osc(t, 3.2) * 0.06;
      plant.rotation.x = osc(t, 3.8, 0.6) * 0.04;

      // ============================================================
      // SELECTION BURST — plays once when `selected` flips true.
      // A glow ripple sweeps the shelf bottom->top, the featured spines
      // pop out and settle, the idea bulb flashes, and voxel "aha" sparks
      // fling from the bulb. All neutral when sel < 0 (idle unchanged).
      // ============================================================
      if (sel >= 0) {
        // per-shelf stagger so the reaction RIPPLES across the bookshelf.
        const RIPPLE = 0.12; // seconds of delay between shelves
        for (let i = 0; i < featuredBooks.length; i++) {
          const ds = Math.max(0, sel - i * RIPPLE); // local time for this shelf
          // single hop OUT of the shelf, then settle back.
          const arc =
            Math.sin(Math.min(ds, 0.5) / 0.5 * Math.PI) * Math.exp(-ds * 1.5);
          const fb = featuredBooks[i];
          // layer the pop ON TOP of whatever idle left in z (idle resets to baseZ).
          fb.mesh.position.z = fb.mesh.position.z + arc * 0.18;
          // a small forward tip as it juts out, then settles to flat.
          fb.mesh.rotation.x = -arc * 0.25;
          // glow ripple: flash boost layered on top of the idle pulse.
          const flash = Math.exp(-ds * 4); // 1 -> 0
          featured[i].emissiveIntensity += flash * 1.1;
        }

        // idea bulb: a bright "aha" flash on click, then settle.
        const bulbFlash = Math.exp(-sel * 4);
        bulbMat.emissiveIntensity += bulbFlash * 1.6;

        // "eureka" shine lines streak radially out from the bulb, then fade.
        const rayBurst = Math.sin(Math.min(sel, 0.4) / 0.4 * Math.PI) * Math.exp(-sel * 2.5);
        for (const ry of rays) {
          ry.mesh.visible = rayBurst > 0.02;
          if (!ry.mesh.visible) continue;
          const dist = 0.15 + rayBurst * 0.13; // dash sits just outside the bulb
          ry.mesh.position.set(
            Math.cos(ry.ang) * dist,
            bulbCenterY + Math.sin(ry.ang) * dist,
            0,
          );
          ry.mesh.scale.x = rayLen * (0.55 + rayBurst * 0.9); // streak outward
          (ry.mesh.material as THREE.MeshToonMaterial).emissiveIntensity = 0.4 + 1.6 * rayBurst;
        }

        // the potted plant perks up (learning = growth) then settles.
        const perk = Math.sin(Math.min(sel, 0.5) / 0.5 * Math.PI) * Math.exp(-sel * 2);
        plant.position.y = topY + perk * 0.07;
      } else {
        // NEUTRAL idle state — fully reset everything the burst touched.
        for (const fb of featuredBooks) fb.mesh.rotation.x = 0;
        for (const ry of rays) ry.mesh.visible = false;
        plant.position.y = topY;
      }
    },
  };
}
