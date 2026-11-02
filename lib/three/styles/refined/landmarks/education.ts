import * as THREE from 'three';
import { makeSelectionClock, type BuiltModel } from '../../../kit';
import { Mesher, RP, piv, sbox, glowMat, unitFor, osc, clamp, TAU } from '../rkit';

/** 3×5 pixel glyphs (rows top → bottom). "I" is 1 wide to fit the plaque. */
const GLYPHS: Record<string, string[]> = {
  K: ['X.X', 'X.X', 'XX.', 'X.X', 'X.X'],
  A: ['.X.', 'X.X', 'XXX', 'X.X', 'X.X'],
  I: ['X', 'X', 'X', 'X', 'X'],
  S: ['XXX', 'X..', 'XXX', '..X', 'XXX'],
  T: ['XXX', '.X.', '.X.', '.X.', '.X.'],
};

/**
 * Education — a cream stepped stone plinth with an indigo plaque spelling
 * KAIST in glowing gold pixels, a BIG violet/indigo mortarboard on top (gold
 * trim, button and swinging tassel), a chunky book stack + diploma at its foot
 * and a violet pennant on a pole. Grid units: 1 = 0.1 world.
 */
export function buildRefinedEducation(): BuiltModel {
  const u = unitFor('education');
  const group = new THREE.Group();
  const D2R = Math.PI / 180;

  // Plinth nudged -x (away from the awards podium, which stands in front-right
  // of it from the camera); the low book stack sits back-right.
  const PX = -1.5;
  const PLINTH_TOP = 10;

  // ---------------- static: plinth + plaque + pennant pole ----------------
  const M = new Mesher(u);
  M.c(RP.stoneShade, PX - 11, 0, -11, 22, 2, 22, { top: RP.stone }); // base course
  M.c(RP.stone, PX - 10, 2, -10, 20, 7, 20); // body
  M.c(RP.stoneShade, PX - 10.5, 9, -10.5, 21, 1, 21, { top: RP.stone }); // cap rail
  M.c(RP.indigo, PX - 9.5, 2.5, 10, 19, 6, 0.6); // front plaque
  // pennant pole (back-left, outside the spinning board's sweep radius)
  const POLE_X = -14;
  const POLE_Z = -10;
  M.c(RP.stoneShade, POLE_X - 1.5, 0, POLE_Z - 1.5, 3, 1, 3, { top: RP.stone });
  M.c(RP.wood, POLE_X - 0.5, 1, POLE_Z - 0.5, 1, 21, 1);
  M.c(RP.gold, POLE_X - 1, 22, POLE_Z - 1, 2, 1, 2);
  M.c(RP.gold, POLE_X - 0.5, 23, POLE_Z - 0.5, 1, 1, 1);
  M.to(group);

  // ---------------- KAIST pixel letters (one glowing mesh) -----------------
  const letterMat = glowMat(RP.gold, 0.5);
  const L = new Mesher(u);
  let gx = PX - 8.5;
  for (const ch of 'KAIST') {
    const g = GLYPHS[ch];
    for (let r = 0; r < g.length; r++) {
      for (let c = 0; c < g[r].length; c++) {
        if (g[r][c] === 'X') L.c(RP.gold, gx + c, 7 - r, 10.6, 1, 1, 0.5);
      }
    }
    gx += g[0].length + 1;
  }
  const letters = L.build(letterMat);
  if (letters) group.add(letters);

  // ---------------- mortarboard (the hero, toss-animated) -------------------
  const cap = piv(group, u, PX, PLINTH_TOP, 0);
  const C = new Mesher(u);
  C.c(RP.violet, -5.5, 0, -5.5, 11, 1, 11); // band
  C.c(RP.violetDark, -5, 1, -5, 10, 3, 10); // skull cap
  C.c(RP.violetDark, -4, 4, -4, 8, 1, 8);
  C.to(cap);

  const board = piv(cap, u, 0, 5, 0);
  board.rotation.z = 8 * D2R;
  const B = new Mesher(u);
  B.c(RP.violet, -9, 0, -9, 18, 1, 18); // underside slab (violet edge)
  B.c(RP.indigo, -8, 1, -8, 16, 1, 16); // indigo top
  B.c(RP.gold, -9, 1, -9, 18, 1, 1).c(RP.gold, -9, 1, 8, 18, 1, 1); // gold trim
  B.c(RP.gold, -9, 1, -8, 1, 1, 16).c(RP.gold, 8, 1, -8, 1, 1, 16);
  B.c(RP.gold, -1, 2, -1, 2, 1, 2); // button
  B.to(board);

  // tassel off the front-right corner
  const tasselAnchor = piv(board, u, 8, 2, 8);
  const T = new Mesher(u);
  T.c(RP.gold, -0.5, -4, -0.5, 1, 4, 1);
  T.c(RP.amber, -1, -7, -1, 2, 3, 2, { top: RP.gold });
  T.to(tasselAnchor);

  // ---------------- book stack + diploma (front-left) ----------------------
  const books = piv(group, u, 12, 0, -6);
  const BK = new Mesher(u);
  /** One chunky book (3 tall) rotated `a` about its centre; spine on -x. */
  const book = (y0: number, w: number, d: number, cover: number, a: number) => {
    const cs = Math.cos(a);
    const sn = Math.sin(a);
    // rotate a local (ox, oz) offset about Y
    const px = (ox: number, oz: number) => ox * cs + oz * sn;
    const pz = (ox: number, oz: number) => -ox * sn + oz * cs;
    const o = { ry: a };
    BK.b(cover, w, 1, d, 0, y0 + 0.5, 0, o); // bottom board
    BK.b(RP.white, w - 1.5, 1, d - 1, px(0.25, 0), y0 + 1.5, pz(0.25, 0), o); // pages
    BK.b(cover, 1, 1, d, px(-w / 2 + 0.5, 0), y0 + 1.5, pz(-w / 2 + 0.5, 0), o); // spine
    BK.b(cover, w, 1, d, 0, y0 + 2.5, 0, o); // top board
  };
  book(0, 7, 6, RP.indigo, 0.08);
  book(3, 6, 6, RP.teal, -0.14);
  book(6, 6, 5, RP.violet, 0.05);
  BK.to(books);

  const scroll = piv(books, u, 0, 9, 0);
  scroll.rotation.y = 0.5;
  const S = new Mesher(u);
  S.b(RP.white, 6, 2, 2, 0, 1.5, 0);
  S.b(RP.stoneShade, 1, 3, 3, -3.5, 1.5, 0).b(RP.stoneShade, 1, 3, 3, 3.5, 1.5, 0);
  S.to(scroll);
  const ribbonMat = glowMat(RP.gold, 0.25);
  sbox(scroll, u, ribbonMat, 1, 3, 3, 0, 1.5, 0);

  // ---------------- pennant (flies toward -x) -------------------------------
  const pennant = piv(group, u, POLE_X - 0.5, 19, POLE_Z);
  const penInner = piv(pennant, u, 0, 0, 0);
  const PN = new Mesher(u);
  PN.c(RP.gold, -1, -3, -0.5, 1, 6, 1); // gold hoist edge
  PN.c(RP.violet, -2, -3, -0.5, 1, 6, 1);
  PN.c(RP.violet, -4, -2, -0.5, 2, 4, 1);
  PN.c(RP.violet, -5, -1, -0.5, 1, 2, 1);
  PN.to(penInner);

  group.rotation.y = Math.PI / 4;

  const selClock = makeSelectionClock();

  return {
    group,
    update(t, hover, selected) {
      const sel = selClock(t, selected);
      const energy = 1 + hover * 0.6 + (selected ? 0.4 : 0);

      const hop = sel >= 0 ? Math.sin((Math.min(sel, 0.5) / 0.5) * Math.PI) * Math.exp(-sel * 1.2) : 0;
      const turn = sel >= 0 ? Math.sin((Math.min(sel, 0.5) / 0.5) * Math.PI) * Math.exp(-sel * 0.8) : 0;
      const wobble = sel >= 0 ? Math.exp(-sel * 4) * Math.sin(sel * 16) : 0;
      const flash = sel >= 0 ? Math.exp(-sel * 4) : 0;

      // tassel: idle pendulum + the graduation "tassel turn" on tap
      tasselAnchor.rotation.z = 14 * D2R * osc(t, 2.4) * energy + 46 * D2R * turn;
      tasselAnchor.rotation.x = 5 * D2R * osc(t, 2.4, 0.6);

      // cap toss every 9s (hop + full 360 spin)
      const phase = t % 9;
      let lift = 0;
      let spin = 0;
      let tilt = 0;
      if (phase < 1.3) {
        const k = clamp(phase / 1.3, 0, 1);
        lift = 5 * Math.sin(k * Math.PI);
        spin = k * TAU;
        tilt = 6 * D2R * Math.sin(k * Math.PI * 2);
      }
      // tap: a proud high pop (no spin)
      lift += 6 * hop;
      tilt += 9 * D2R * wobble;
      cap.position.y = (PLINTH_TOP + lift) * u;
      cap.rotation.y = spin;
      cap.rotation.z = tilt;

      // books + diploma presented on tap
      books.position.y = hop * 1.2 * u;
      scroll.rotation.y = 0.5 + 4 * D2R * osc(t, 3.2) + 10 * D2R * turn;

      // pennant wave + flourish
      pennant.rotation.y = 11 * D2R * osc(t, 1.6) * energy + 20 * D2R * wobble;
      pennant.rotation.x = 6 * D2R * osc(t, 1.1, 1.0);
      penInner.position.x = -0.5 * (osc(t, 1.6) + 1) * 0.5 * u;

      letterMat.emissiveIntensity = 0.5 + hover * 0.3 + flash * 1.5;
      ribbonMat.emissiveIntensity = 0.25 + hover * 0.2 + flash * 1.6;
    },
  };
}
