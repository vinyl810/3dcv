import * as THREE from 'three';
import { makeSelectionClock, type BuiltModel } from '../../../kit';
import { Mesher, RP, piv, sbox, glowMat, unitFor, osc, clamp } from '../rkit';

/** Upright book on a shelf: width, height, colour, kind (0 static, 1 pickable, 2 featured/glowing). */
type BookSpec = [number, number, number, 0 | 1 | 2];

interface PickBook {
  obj: THREE.Object3D;
  baseZ: number;
}

/**
 * Coursework — a light-wood bookshelf (16 × 24 × 6) with three shelves of
 * chunky blue-family books (one glowing featured book per shelf, books slide
 * out idle), a potted plant + apple on top, a floating idea bulb on a stem at
 * the left (eureka rays on click) and a two-step stool on the right.
 * Grid units: 1 = 0.1 world.
 */
export function buildRefinedCoursework(): BuiltModel {
  const u = unitFor('coursework');
  const group = new THREE.Group();

  // ---------------- frame (static) ----------------
  const M = new Mesher(u);
  M.c(RP.wood, -8, 0, -3, 16, 1, 6, { top: RP.woodLight }); // kick
  M.c(RP.wood, -8, 1, -3, 1, 22, 6).c(RP.wood, 7, 1, -3, 1, 22, 6); // sides
  M.c(RP.woodDark, -7, 1, -3, 14, 22, 1); // inner back
  M.c(RP.wood, -9, 23, -3.5, 18, 1, 7, { top: RP.woodLight }); // crown
  M.c(RP.wood, -7, 8, -2, 14, 1, 5, { top: RP.woodLight }); // shelf boards
  M.c(RP.wood, -7, 16, -2, 14, 1, 5, { top: RP.woodLight });

  // ---------------- books ----------------
  const ROW_Y = [1, 9, 17];
  const SHELVES: { x0: number; flatX: number; books: BookSpec[] }[] = [
    {
      x0: -7, flatX: 4,
      books: [[2, 6, RP.blue, 1], [3, 5, RP.stone, 0], [2, 6, RP.blueDark, 0], [2, 6, RP.gold, 2], [2, 5, RP.violet, 1]],
    },
    {
      x0: -4, flatX: -7,
      books: [[3, 6, RP.teal, 1], [2, 5, RP.blue, 0], [2, 6, RP.blue, 2], [2, 6, RP.stone, 0], [2, 5, RP.blueDark, 1]],
    },
    {
      x0: -7, flatX: 4,
      books: [[2, 5, RP.violet, 0], [2, 4, RP.blue, 1], [3, 5, RP.teal, 2], [2, 5, RP.gold, 0], [2, 4, RP.blueDark, 1]],
    },
  ];
  const bandFor = (col: number) => (col === RP.stone || col === RP.gold ? RP.blueDark : RP.gold);
  const upright = (m: Mesher, x: number, y0: number, w: number, h: number, col: number) => {
    m.c(col, x, y0, -2, w, h, 4);
    m.c(bandFor(col), x, y0 + h - 2, 2, w, 1, 0.4); // spine label band
  };

  const picks: PickBook[][] = [[], [], []];
  const featured: { mesh: THREE.Mesh; mat: THREE.MeshToonMaterial }[] = [];
  SHELVES.forEach((sh, s) => {
    const y0 = ROW_Y[s];
    let x = sh.x0;
    for (const [w, h, col, kind] of sh.books) {
      if (kind === 0) {
        upright(M, x, y0, w, h, col);
      } else if (kind === 1) {
        const p = piv(group, u, 0, 0, 0);
        const PM = new Mesher(u);
        upright(PM, x, y0, w, h, col);
        PM.to(p);
        picks[s].push({ obj: p, baseZ: 0 });
      } else {
        const mat = glowMat(col, 0.25);
        const mesh = sbox(group, u, mat, w, h, 4, x + w / 2, y0 + h / 2, 0);
        featured.push({ mesh, mat });
        picks[s].push({ obj: mesh, baseZ: 0 });
      }
      x += w;
    }
    // two books lying flat in the gap, cream page edges to the front
    const fc = s === 1 ? [RP.violet, RP.blue] : [RP.teal, RP.stone];
    for (let k = 0; k < 2; k++) {
      M.c(fc[k], sh.flatX, y0 + k * 2, -2, 3, 2, 4);
      M.c(RP.white, sh.flatX, y0 + k * 2 + 0.5, 2, 2.5, 1, 0.4, { flat: true });
    }
  });

  // apple on the crown
  M.c(RP.red, -6, 24, -1, 2, 2, 2);
  M.c(RP.leafMid, -5, 26, -0.5, 1, 1, 1);

  // two-step stool (right) with a book on top
  M.c(RP.wood, 9, 0, -3, 5, 6, 4, { top: RP.woodLight });
  M.c(RP.wood, 9, 0, 1, 5, 3, 4, { top: RP.woodLight });
  M.c(RP.blue, 9.5, 6, -2.5, 4, 2, 3);
  M.c(RP.white, 10, 6.5, 0.5, 3.5, 1, 0.4, { flat: true });
  M.to(group);

  // ---------------- potted plant (sways) ----------------
  const PLANT_Y = 24;
  const plant = piv(group, u, 4, PLANT_Y, 0);
  const PL = new Mesher(u);
  PL.c(RP.coral, -2, 0, -2, 4, 2, 4);
  PL.c(RP.coralDark, -2.5, 2, -2.5, 5, 1, 5, { top: RP.dirt });
  PL.c(RP.leafMid, -3, 3, -3, 6, 2, 6, { top: RP.leafLight });
  PL.c(RP.leafLight, -2, 5, -2, 4, 1, 4);
  PL.to(plant);

  // ---------------- idea bulb on a stem (left) ----------------
  const IDEA_Y = 12;
  const idea = piv(group, u, -11, IDEA_Y, 1);
  const IS = new Mesher(u);
  IS.c(RP.gold, -1, -1, -1, 2, 2, 2, { top: RP.goldDark }); // screw base
  IS.c(RP.metalDark, 1, -0.5, -0.5, 2, 1, 1); // stem to the side panel
  IS.to(idea);
  const bulbMat = glowMat(RP.amber, 0.9);
  const BU = new Mesher(u);
  const BULB_Y = 3.5;
  BU.b(RP.amber, 2, 1, 2, 0, 1.5, 0);
  BU.b(RP.amber, 4, 3, 4, 0, BULB_Y, 0);
  BU.b(RP.amber, 3, 5, 3, 0, BULB_Y, 0);
  const bulb = BU.build(bulbMat);
  if (bulb) idea.add(bulb);

  // eureka rays (hidden until click)
  const RAY_N = 8;
  const RAY_LEN = 2;
  const rays: { mesh: THREE.Mesh; mat: THREE.MeshToonMaterial; ang: number }[] = [];
  for (let k = 0; k < RAY_N; k++) {
    const ang = (k / RAY_N) * Math.PI * 2;
    const mat = glowMat(RP.gold, 0.9);
    const mesh = sbox(idea, u, mat, RAY_LEN, 1, 1, 0, BULB_Y, 0);
    mesh.rotation.z = ang;
    mesh.visible = false;
    rays.push({ mesh, mat, ang });
  }

  group.rotation.y = Math.PI / 4;

  const SLIDE = 2;
  const PICK_PERIOD = 2.6;
  const selClock = makeSelectionClock();

  return {
    group,
    update(t, hover, selected) {
      const sel = selClock(t, selected);

      // staggered "book being picked" slide, one per shelf
      for (let s = 0; s < 3; s++) {
        const list = picks[s];
        const cyc = t / (PICK_PERIOD + s * 0.7) + s * 0.33;
        const which = Math.floor(cyc) % list.length;
        const ob = Math.sin((cyc - Math.floor(cyc)) * Math.PI);
        const eased = ob * ob * (3 - 2 * ob);
        for (const b of list) b.obj.position.z = b.baseZ * u;
        list[which].obj.position.z = (list[which].baseZ + eased * SLIDE) * u;
      }

      // featured pulse
      for (let i = 0; i < featured.length; i++) {
        featured[i].mat.emissiveIntensity = 0.2 + 0.55 * (0.5 + 0.5 * osc(t, 2.0, i * 1.1)) + hover * 0.2;
      }

      // idea bulb bob + blink
      idea.position.y = (IDEA_Y + osc(t, 2.4) * 0.6) * u;
      bulbMat.emissiveIntensity = 0.45 + (0.5 + 0.5 * osc(t, 2.0)) + hover * 0.3;

      // plant sway
      plant.rotation.z = osc(t, 3.2) * 0.06;
      plant.rotation.x = osc(t, 3.8, 0.6) * 0.04;

      if (sel >= 0) {
        // featured books hop out in a bottom→top ripple
        for (let i = 0; i < featured.length; i++) {
          const ds = Math.max(0, sel - i * 0.12);
          const arc = Math.sin((Math.min(ds, 0.5) / 0.5) * Math.PI) * Math.exp(-ds * 1.5);
          const fb = featured[i];
          fb.mesh.position.z += arc * 2.5 * u;
          fb.mesh.rotation.x = -arc * 0.25;
          fb.mat.emissiveIntensity += Math.exp(-ds * 4) * 1.1;
        }
        bulbMat.emissiveIntensity += Math.exp(-sel * 4) * 1.6;

        const burst = Math.sin((Math.min(sel, 0.4) / 0.4) * Math.PI) * Math.exp(-sel * 2.5);
        for (const r of rays) {
          r.mesh.visible = burst > 0.02;
          if (!r.mesh.visible) continue;
          const dist = 3 + burst * 1.5;
          r.mesh.position.set(Math.cos(r.ang) * dist * u, (BULB_Y + Math.sin(r.ang) * dist) * u, 0);
          r.mesh.scale.x = RAY_LEN * (0.55 + burst * 0.9) * u; // absolute length
          r.mat.emissiveIntensity = 0.4 + 1.6 * burst;
        }

        const perk = Math.sin((Math.min(sel, 0.5) / 0.5) * Math.PI) * Math.exp(-sel * 2);
        plant.position.y = (PLANT_Y + perk) * u;
      } else {
        for (const fb of featured) fb.mesh.rotation.x = 0;
        for (const r of rays) r.mesh.visible = false;
        plant.position.y = PLANT_Y * u;
      }
    },
  };
}
