import * as THREE from 'three';
import { makeSelectionClock, type BuiltModel } from '../../../kit';
import { Mesher, RP, piv, sbox, glowMat, unitFor, osc, clamp, TAU } from '../rkit';

/**
 * Publications — a honey-wood lectern whose slanted desk carries a big OPEN
 * coral-bound book; above it a page lifts and turns 360 showing a glowing teal
 * "abstract" and a gold DOI tag. A quill stands in an inkpot on the desk and a
 * small journal stack sits at the lectern's foot. Grid units: 1 = 0.1 world.
 */
export function buildRefinedPublications(): BuiltModel {
  const u = unitFor('publications');
  const group = new THREE.Group();

  // ---------------- lectern body ----------------
  const M = new Mesher(u);
  M.c(RP.wood, -8, 0, -6, 16, 2, 12, { top: RP.woodLight }); // foot
  M.c(RP.wood, -5, 2, -4, 10, 8, 8); // column
  M.c(RP.woodLight, -3, 4, 4, 6, 4, 0.5); // front inset panel
  M.c(RP.woodDark, -5.5, 2, -4.5, 11, 1, 9, { top: RP.wood }); // base collar

  // journal stack at the foot (front-right)
  const journal = (x0: number, y0: number, z0: number, w: number, d: number, col: number) => {
    M.c(col, x0, y0, z0, w, 1, d);
    M.c(RP.white, x0 + 1, y0 + 1, z0 + 0.5, w - 1.5, 1, d - 1); // page edges
    M.c(col, x0, y0 + 1, z0, 1, 1, d); // spine
    M.c(col, x0, y0 + 2, z0, w, 1, d);
  };
  journal(8.5, 0, 2, 6, 6, RP.teal);
  journal(9, 3, 2.5, 5, 5, RP.coral);
  M.to(group);

  // ---------------- slanted desk (front edge low, faces the camera) --------
  const TILT = 0.3;
  const surface = piv(group, u, 0, 13.5, 0);
  surface.rotation.x = TILT;
  const S = new Mesher(u);
  S.c(RP.wood, -5, -5, -4, 10, 3, 8); // under-desk support (fills the gap to the column)
  S.c(RP.woodLight, -12, -2, -7, 24, 2, 14); // desk board
  S.c(RP.wood, -12, 0, 6, 24, 1, 1); // front lip

  // open book: coral cover + cream page block + two angled page slabs
  S.c(RP.coral, -9, 0, -6, 18, 1, 12);
  S.c(RP.white, -8.5, 1, -5.5, 17, 1, 11);
  S.c(RP.stoneShade, -0.5, 2, -5.5, 1, 0.4, 11); // gutter
  const PA = 0.08; // page angle
  const PAGE_Y = 2.5;
  /** Centre of a sub-box at local (ox, oy) on a page slab centred (cx, PAGE_Y) rotated rz. */
  const onPage = (cx: number, rz: number, ox: number, oy: number): [number, number] => [
    cx + ox * Math.cos(rz) - oy * Math.sin(rz),
    PAGE_Y + ox * Math.sin(rz) + oy * Math.cos(rz),
  ];
  const pages: [number, number][] = [[-4.5, -PA], [4.5, PA]]; // [cx, rz]: outer edges raised
  for (const [cx, rz] of pages) {
    S.b(RP.white, 8, 1, 11, cx, PAGE_Y, 0, { rz });
  }
  // text lines (right page: 4, left page: 2 under the title)
  for (const oz of [-3, -1, 1, 3]) {
    const [x, y] = onPage(4.5, PA, 0, 0.6);
    S.b(RP.stoneShade, 5, 0.4, 1, x, y, oz, { rz: PA, flat: true });
  }
  for (const oz of [0, 2.5]) {
    const [x, y] = onPage(-4.5, -PA, 0, 0.6);
    S.b(RP.stoneShade, 5, 0.4, 1, x, y, oz, { rz: -PA, flat: true });
  }
  S.c(RP.goldDark, -0.5, 1, 5.5, 1, 1.6, 1); // bookmark tail at the front edge

  // inkpot (desk, back-right)
  S.c(RP.indigo, 9, 0, -5, 3, 3, 3, { top: RP.ink });
  S.c(RP.indigo, 9.5, 3, -4.5, 2, 1, 2, { top: RP.ink });
  S.to(surface);

  // title bar on the left page (flashes on select)
  const titleMat = glowMat(RP.gold, 0.3);
  {
    const [x, y] = onPage(-4.5, -PA, 0, 0.6);
    const tb = sbox(surface, u, titleMat, 5, 1, 2, x, y, -3);
    tb.rotation.z = -PA;
  }

  // ---------------- quill ----------------
  const quill = piv(surface, u, 10.5, 3, -3.5);
  const Q = new Mesher(u);
  Q.b(RP.woodDark, 1, 5, 1, 0.5, 2.5, 0, { rz: -0.2 });
  Q.to(quill);
  const feather = piv(quill, u, 1, 4.5, 0);
  const FEATHER_RZ = -0.28;
  const FEATHER_RX = 0.12;
  feather.rotation.set(FEATHER_RX, 0, FEATHER_RZ);
  const FQ = new Mesher(u);
  FQ.c(RP.white, -1.5, 0, -0.5, 3, 6, 1);
  FQ.c(RP.stoneShade, -0.5, 0, 0.5, 1, 6, 0.4, { flat: true }); // rib
  FQ.c(RP.coral, -1, 6, -0.5, 2, 1, 1); // coral tip
  FQ.c(RP.coral, -1.5, 0, -0.5, 3, 1, 1);
  FQ.to(feather);

  // ---------------- floating turning page ----------------
  const FLOAT_Y = 6;
  const floatPivot = piv(surface, u, 0, FLOAT_Y, 0);
  const F = new Mesher(u);
  F.c(RP.white, -6, -0.5, -4.5, 12, 1, 9);
  F.c(RP.coral, -5, 0.5, -4, 6, 0.4, 1.5); // header bar
  for (const z of [-1, 1, 3]) F.c(RP.stoneShade, 1, 0.5, z - 0.5, 4, 0.4, 1, { flat: true });
  F.to(floatPivot);
  const abstractMat = glowMat(RP.teal, 0.5);
  sbox(floatPivot, u, abstractMat, 5, 1, 4, -2.5, 0.5, 1);
  const doiMat = glowMat(RP.gold, 0.45);
  sbox(floatPivot, u, doiMat, 3, 1, 2, 3.5, 0.5, -3);

  group.rotation.y = Math.PI / 4;

  const TURN = 8;
  const selClock = makeSelectionClock();

  return {
    group,
    update(t, hover, selected) {
      // page-turn cycle: lift -> rotate 360 -> settle
      const f = (t % TURN) / TURN;
      const lift = Math.min(clamp(f / 0.15, 0, 1), 1 - clamp((f - 0.85) / 0.15, 0, 1));
      const liftE = lift * lift * (3 - 2 * lift);
      let py = FLOAT_Y + liftE * 5;
      let ry = f * TAU;
      floatPivot.rotation.x = osc(t, 1.3) * 0.07 * liftE;
      floatPivot.rotation.z = osc(t, 1.9, 0.5) * 0.04 * liftE;

      abstractMat.emissiveIntensity = 0.4 + 0.45 * (0.5 + 0.5 * osc(t, 1.6)) + hover * 0.25;

      feather.rotation.z = FEATHER_RZ + osc(t, 2.4) * 0.08;
      feather.rotation.x = FEATHER_RX + osc(t, 3.1, 1.0) * 0.05;

      const sel = selClock(t, selected);
      if (sel >= 0) {
        const flash = Math.exp(-sel * 4);
        titleMat.emissiveIntensity = 0.3 + hover * 0.2 + flash * 1.3;
        doiMat.emissiveIntensity = 0.45 + flash * 1.1 * clamp(sel * 6, 0, 1);
        abstractMat.emissiveIntensity += flash;
        // eager extra flip + hop + pop
        const flip = clamp(sel / 0.6, 0, 1);
        const hop = Math.sin((Math.min(sel, 0.5) / 0.5) * Math.PI) * Math.exp(-sel * 1.5);
        const wobble = Math.exp(-sel * 5) * Math.sin(sel * 22);
        ry += flip * TAU;
        py += hop * 2;
        floatPivot.scale.setScalar(1 + wobble * 0.1);
      } else {
        titleMat.emissiveIntensity = 0.3 + hover * 0.2;
        doiMat.emissiveIntensity = 0.45;
        floatPivot.scale.setScalar(1);
      }
      floatPivot.position.y = py * u;
      floatPivot.rotation.y = ry;

      // quill dips and "writes" on the tap
      const write = sel >= 0 ? Math.exp(-sel * 2.5) : 0;
      quill.rotation.x = write * 0.12;
      quill.rotation.z = write * Math.sin(sel * 26) * 0.22;
    },
  };
}
