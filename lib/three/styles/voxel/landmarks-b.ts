import * as THREE from 'three';
import { GRADIENT, color, makeSelectionClock, osc, clamp, type BuiltModel } from '../../kit';
import { C } from './palette';
import { Grid, meshGrid, landmarkVoxel } from './vox';
import { type FigureSpec } from './figure';
import { buildRig, relax, bendLeg, hop, setElbow, smooth, type Rig } from './rig';

/* =========================================================================
 * Coursework — chunky bookshelf of colourful spines, a reading lamp on top and
 * a little stack of books at its feet. One book peeks out now and then; on
 * click it slides out and hops.
 * ========================================================================= */
export function buildVoxelCoursework(): BuiltModel {
  const s = landmarkVoxel('coursework');
  const group = new THREE.Group();
  const G = () => new Grid(-12, 12, -1, 30, -8, 10);

  const b = G();
  const wood = b.c(C.wood, 0.05);
  const woodL = b.c(C.woodLight, 0.05);
  const woodD = b.c(C.woodDark, 0.04);
  // carcass: back panel, sides, shelves, plinth + crown overhang
  b.box(-8, 0, -3, 8, 22, -3, woodD);
  b.box(-8, 0, -3, -8, 22, 2, wood).box(8, 0, -3, 8, 22, 2, wood);
  b.box(-8, 0, -3, 8, 1, 2, wood);
  b.box(-9, 0, 3, 9, 0, 3, woodD); // plinth kick
  for (const y of [8, 15]) b.box(-7, y, -2, 7, y, 2, woodL);
  b.box(-9, 22, -4, 9, 23, 3, wood);
  b.box(-9, 23, 3, 9, 23, 3, woodL); // crown lip highlight

  const BOOK = [C.red, C.blue, C.gold, C.green, C.violet, C.coral, C.teal, C.pink, C.navy];
  const bookCols = BOOK.map((h) => b.c(h, 0.04));
  const band = b.c(C.paper, 0.02);
  const goldBand = b.c(C.gold, 0.02);
  // fill bays: y ranges (floor of each bay)
  const bays: [number, number][] = [[2, 7], [9, 14], [16, 21]];
  const SLIDE = { x0: -1, x1: 0, y0: 9, y1: 13 }; // the animated book (middle bay)
  let k = 0;
  bays.forEach(([y0, y1], bi) => {
    let x = -7;
    while (x <= 7) {
      k++;
      const w = (k * 7) % 5 === 0 ? 2 : 1 + ((k * 3) % 2);
      const x1 = Math.min(7, x + w - 1);
      const gap = (k * 11 + bi * 5) % 13 === 0; // the odd empty slot
      const lean = (k * 5 + bi) % 9 === 0;
      if (bi === 1 && x <= SLIDE.x1 && x1 >= SLIDE.x0) { x = SLIDE.x1 + 1; continue; }
      if (!gap) {
        const h = y1 - (k * 13 % 3); // height variety
        const col = bookCols[(k * 5 + bi) % bookCols.length];
        if (lean) {
          // a book leaning against its neighbour (stepped diagonal)
          for (let yy = y0; yy <= h - 1; yy++) b.box(x, yy, -1, x, yy, 1, col);
          b.box(x + 1, h - 1, -1, x + 1, h - 1, 1, col);
        } else {
          b.box(x, y0, -2, x1, h, 1, col);
          if (k % 2 === 0) b.paint(x, h - 1, 1, x1, h - 1, 1, (k % 4 === 0) ? goldBand : band); // spine band
        }
      }
      x = x1 + 1;
    }
  });
  // books stacked at the feet (front-left), a mug on the right
  b.box(-7, 0, 5, -2, 0, 8, bookCols[1]).paint(-7, 0, 8, -2, 0, 8, band);
  b.box(-6, 1, 5, -2, 1, 8, bookCols[0]).paint(-6, 1, 8, -2, 1, 8, band);
  b.box(-7, 2, 6, -3, 2, 8, bookCols[2]).paint(-7, 2, 8, -3, 2, 8, band);
  const mug = b.c(C.white, 0.02);
  b.box(3, 0, 6, 4, 2, 7, mug).set(5, 1, 6, mug).set(3, 2, 6, b.c(C.woodDark));
  // potted plant on the crown (left)
  const pot = b.c(C.coral, 0.05);
  const leaf = b.c(C.leafLight, 0.06);
  const leafD = b.c(C.leaf, 0.06);
  b.box(-7, 24, -2, -5, 25, 0, pot);
  b.set(-6, 26, -1, leaf).set(-6, 27, -1, leaf).set(-7, 27, -1, leafD).set(-5, 28, -1, leaf)
    .set(-6, 28, 0, leafD).set(-7, 28, -2, leaf).set(-4, 27, -1, leafD);
  // reading lamp (right of crown): base + arm, shade glow separate
  const slate = b.c(C.slate, 0.04);
  b.box(4, 24, -2, 6, 24, 0, slate).box(5, 25, -1, 5, 28, -1, slate).box(5, 28, -1, 5, 28, 1, slate);
  group.add(meshGrid(b, { size: s }).group);

  const lg = G();
  const amber = lg.g(C.amber);
  lg.box(4, 26, 1, 6, 27, 3, amber);
  const lamp = meshGrid(lg, { size: s, glow: 1.0 });
  group.add(lamp.group);

  // the animated book: rests in the middle bay; pivot at its base-back
  const bk = G();
  const bc = bk.c(C.magenta, 0.03);
  bk.box(SLIDE.x0, SLIDE.y0, -2, SLIDE.x1, SLIDE.y1, 1, bc);
  bk.paint(SLIDE.x0, SLIDE.y1 - 1, 1, SLIDE.x1, SLIDE.y1 - 1, 1, bk.c(C.gold, 0.02));
  bk.paint(SLIDE.x0, SLIDE.y0 + 1, 1, SLIDE.x1, SLIDE.y0 + 1, 1, bk.c(C.gold, 0.02));
  const book = meshGrid(bk, { size: s, pivot: [-0.5, SLIDE.y0, -2.5] });
  group.add(book.group);

  group.rotation.y = Math.PI / 4;

  const clock = makeSelectionClock();
  const bx = book.group.position.x, by = book.group.position.y, bz = book.group.position.z;
  const lampMat = lamp.glowMat!;
  return {
    group,
    update(t, hover, selected) {
      const sel = clock(t, selected);
      const flash = sel >= 0 ? Math.exp(-sel * 4) : 0;
      // idle: the book peeks out every ~5 s
      const lp = t % 5;
      const peek = lp < 1.2 ? Math.sin((lp / 1.2) * Math.PI) * 1.5 : 0;
      // click: slide out ~4 voxels, hop, tilt, then settle back over ~2 s
      let out = 0, hop = 0, tilt = 0;
      if (sel >= 0) {
        const env = sel < 0.35 ? sel / 0.35 : Math.exp(-(sel - 0.35) * 1.4);
        out = 4.5 * env;
        hop = Math.sin(Math.min(sel, 0.7) / 0.7 * Math.PI) * 2.2 * (sel < 0.7 ? 1 : 0);
        tilt = Math.exp(-sel * 3) * Math.sin(sel * 14) * 0.25;
      }
      book.group.position.set(bx, by + hop * s, bz + (peek + out) * s);
      book.group.rotation.z = tilt;
      lampMat.emissiveIntensity = 0.95 + 0.08 * osc(t, 0.5) + hover * 0.35 + flash * 0.9;
    },
  };
}

/* =========================================================================
 * Awards — 3-step podium (1st gold-trimmed white, 2nd silver, 3rd bronze)
 * with a big gold cup on top that slowly turns and bobs, a glowing star above.
 * Click: the cup spins up and voxel confetti bursts out and lands back ON the
 * podium step tops.
 * ========================================================================= */
export function buildVoxelAwards(): BuiltModel {
  const s = landmarkVoxel('awards');
  const group = new THREE.Group();
  const G = () => new Grid(-12, 12, -1, 30, -8, 8);

  const b = G();
  const white = b.c(C.white, 0.03);
  const goldD = b.c(C.goldDark, 0.03);
  const silver = b.c(C.steel, 0.04);
  const bronze = b.c(C.coral, 0.04);
  const bronzeD = b.c(0xc06a4c, 0.04);
  const navy = b.c(C.navy, 0.03);
  // steps: center 1st (tall), left 2nd, right 3rd
  const TOP1 = 9, TOP2 = 6, TOP3 = 4; // top voxel layer index of each step
  b.box(-4, 0, -4, 4, TOP1, 4, white);
  b.box(-4, TOP1, -4, 4, TOP1, 4, goldD);
  b.box(-11, 0, -4, -5, TOP2, 4, silver);
  b.box(-11, TOP2, -4, -5, TOP2, 4, b.c(0xb4bccc, 0.03));
  b.box(5, 0, -4, 11, TOP3, 4, bronze);
  b.box(5, TOP3, -4, 11, TOP3, 4, bronzeD);
  b.box(-11, 0, -4, 11, 0, 4, navy); // dark plinth line grounds it
  // numerals on the front faces (z=5 layer, 1 voxel proud)
  const num = b.c(C.gold, 0.02);
  const ONE = ['.#.', '##.', '.#.', '.#.', '###'];
  const TWO = ['##.', '..#', '.#.', '###'];
  const glyph = (rows: string[], x0: number, yTop: number, c: number) =>
    rows.forEach((r, i) => { for (let j = 0; j < r.length; j++) if (r[j] === '#') b.set(x0 + j, yTop - i, 5, c); });
  glyph(ONE, -1, TOP1 - 1, num);
  glyph(TWO, -9, TOP2, b.c(C.navy, 0.02));
  const THREE_ = ['###', '.##', '..#', '###'];
  glyph(THREE_, 7, TOP3 - 1, b.c(C.navy, 0.02));
  // ribbon rosettes hanging on 2nd/3rd fronts
  const rib = b.c(C.blue, 0.03);
  b.box(-6, 2, 5, -6, 4, 5, rib).set(-7, 1, 5, rib).set(-5, 1, 5, rib);
  group.add(meshGrid(b, { size: s }).group);

  // the cup (spins about its own vertical axis)
  const cupY = TOP1 + 1;
  const c = G();
  const gold = c.c(C.gold, 0.04);
  const gD = c.c(C.goldDark, 0.03);
  c.box(-3, cupY, -3, 3, cupY, 3, c.c(C.ink, 0.03)); // base block
  c.box(-2, cupY + 1, -2, 2, cupY + 1, 2, gD);
  c.box(-1, cupY + 2, -1, 1, cupY + 4, 1, gold); // stem
  c.box(-2, cupY + 5, -2, 2, cupY + 5, 2, gD);
  // bowl: flared stack of discs, hollow top
  c.cyl(0, 0, cupY + 6, cupY + 7, 3, gold);
  c.cyl(0, 0, cupY + 8, cupY + 11, 4, gold);
  c.disc(0, cupY + 11, 0, 3, 0); // carve the mouth
  c.disc(0, cupY + 10, 0, 3, 0);
  c.disc(0, cupY + 9, 0, 2, gD); // inner shadow floor
  // handles (rings either side)
  for (const sx of [-1, 1]) {
    c.box(sx * 5, cupY + 10, 0, sx * 6, cupY + 10, 0, gold);
    c.box(sx * 6, cupY + 7, 0, sx * 6, cupY + 10, 0, gold);
    c.box(sx * 5, cupY + 7, 0, sx * 5, cupY + 7, 0, gold);
  }
  c.paint(-4, cupY + 8, -4, 4, cupY + 8, 4, gD, gold); // band
  const cup = meshGrid(c, { size: s, pivot: [0, cupY, 0] });
  group.add(cup.group);

  // floating star above the cup
  const st = G();
  const sg = st.g(C.amber);
  const SY = cupY + 16;
  const STAR = ['..#..', '.###.', '#####', '.###.', '.#.#.'];
  STAR.forEach((r, i) => { for (let j = 0; j < r.length; j++) if (r[j] === '#') st.set(j - 2, SY + 2 - i, 0, sg); });
  const star = meshGrid(st, { size: s, pivot: [0, SY, 0], glow: 1.1 });
  group.add(star.group);

  // confetti: one InstancedMesh of voxel cubes (1 draw call)
  const N = 18;
  const cubeGeo = new THREE.BoxGeometry(s, s, s);
  const cmat = new THREE.MeshToonMaterial({ gradientMap: GRADIENT });
  (cmat as THREE.Material as { flatShading?: boolean }).flatShading = true;
  const conf = new THREE.InstancedMesh(cubeGeo, cmat, N);
  const CCOL = [C.red, C.blue, C.gold, C.green, C.magenta, C.cyan, C.violet];
  // rest spots ON the step tops (avoid the cup base); y = top of step layer + ½
  const rest: [number, number, number][] = [];
  const startY = (cupY + 11) * s;
  for (let i = 0; i < N; i++) {
    const r1 = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
    const r2 = Math.abs(Math.sin(i * 78.233) * 12543.123) % 1;
    let x: number, z: number, top: number;
    const pick = i % 3;
    if (pick === 0) { x = -10 + Math.floor(r1 * 6); z = -3 + Math.floor(r2 * 7); top = TOP2; }
    else if (pick === 1) { x = 6 + Math.floor(r1 * 6); z = -3 + Math.floor(r2 * 7); top = TOP3; }
    else { x = (r1 < 0.5 ? -4 : 4); z = -3 + Math.floor(r2 * 7); top = TOP1; }
    rest.push([x * s, (top + 1) * s + s / 2, z * s]);
    conf.setColorAt(i, color(CCOL[i % CCOL.length]));
  }
  const dummy = new THREE.Object3D();
  const placeConfetti = (u: number, sel: number) => {
    for (let i = 0; i < N; i++) {
      const [rx, ry, rz] = rest[i];
      if (u >= 1) {
        dummy.position.set(rx, ry, rz);
        dummy.rotation.set(0, 0, 0);
      } else {
        // ballistic arc from the cup mouth to the rest spot
        const h = 9 * s + (i % 4) * 2 * s;
        dummy.position.set(rx * u, startY + (ry - startY) * u + 4 * h * u * (1 - u), rz * u);
        dummy.rotation.set(sel * (3 + (i % 3)), sel * 4, 0);
      }
      dummy.updateMatrix();
      conf.setMatrixAt(i, dummy.matrix);
    }
    conf.instanceMatrix.needsUpdate = true;
  };
  placeConfetti(1, 0);
  conf.frustumCulled = false; // instances move during the burst
  group.add(conf);

  group.rotation.y = Math.PI / 4;

  const clock = makeSelectionClock();
  const cupBaseY = cup.group.position.y;
  const starY = star.group.position.y;
  const starMat = star.glowMat!;
  let spin = 0;
  let lastT = -1;
  let settled = true;
  return {
    group,
    update(t, hover, selected) {
      const sel = clock(t, selected);
      const dt = lastT < 0 ? 0 : clamp(t - lastT, 0, 0.1);
      lastT = t;
      const flash = sel >= 0 ? Math.exp(-sel * 4) : 0;
      // spin: slow idle turn + a fast burst on click (integrated, no phase jump)
      spin += dt * (0.5 + (sel >= 0 ? 14 * Math.exp(-sel * 2.2) : 0));
      cup.group.rotation.y = spin;
      const hop = sel >= 0 ? Math.sin(Math.min(sel, 0.5) / 0.5 * Math.PI) * Math.exp(-sel * 1.5) : 0;
      cup.group.position.y = cupBaseY + 0.03 * osc(t, 3) + hop * 0.25;
      star.group.position.y = starY + 0.08 * osc(t, 2.6);
      star.group.rotation.y = -spin * 0.6;
      starMat.emissiveIntensity = 1.0 + 0.25 * osc(t, 1.8) + hover * 0.4 + flash * 1.0;
      // confetti: 1.3 s flight after each click, then rests on the steps
      if (sel >= 0 && sel < 1.3) { placeConfetti(sel / 1.3, sel); settled = false; }
      else if (!settled) { placeConfetti(1, 0); settled = true; }
    },
  };
}

/* =========================================================================
 * Involvement — a little community stage: three volunteers under a
 * bunting line and a glowing banner. They bob idly; on click they jump and
 * cheer (arms-up sprite frame).
 * ========================================================================= */
export function buildVoxelInvolvement(): BuiltModel {
  const s = landmarkVoxel('involvement');
  const group = new THREE.Group();
  const G = () => new Grid(-13, 13, -1, 36, -9, 9);

  const b = G();
  const plank = b.c(C.plank, 0.05);
  const plankL = b.c(C.woodLight, 0.05);
  const navy = b.c(C.navy, 0.03);
  const goldT = b.c(C.gold, 0.03);
  // stage: navy skirt, gold trim, plank floor
  b.box(-12, 0, -6, 12, 1, 5, navy);
  b.box(-12, 1, 5, 12, 1, 5, goldT);
  for (let z = -6; z <= 5; z++) b.box(-12, 2, z, 12, 2, z, z % 2 ? plank : plankL);
  b.box(-3, 0, 6, 3, 0, 7, plankL); // front step
  // skirt stars
  const st = b.c(C.white, 0.02);
  for (let x = -9; x <= 9; x += 6) b.set(x, 0, 6, st);
  // poles + bunting line
  const pole = b.c(C.slate, 0.03);
  b.box(-12, 3, -6, -12, 32, -6, pole).box(12, 3, -6, 12, 32, -6, pole);
  b.set(-12, 33, -6, goldT).set(12, 33, -6, goldT);
  b.box(-11, 31, -6, 11, 31, -6, b.c(C.ink, 0.02));
  const FLAG = [C.red, C.gold, C.cyan, C.magenta, C.green, C.blue, C.coral];
  for (let i = 0; i < 7; i++) {
    const fx = -9 + i * 3;
    const fc = b.c(FLAG[i], 0.03);
    b.box(fx - 1, 30, -6, fx + 1, 30, -6, fc).set(fx, 29, -6, fc);
  }
  group.add(meshGrid(b, { size: s }).group);

  // banner cloth with glowing heart-in-hands glyph (pulses)
  const bn = G();
  const cloth = bn.c(C.magenta, 0.03);
  bn.box(-9, 22, -6, 9, 28, -6, cloth);
  bn.box(-9, 21, -6, 9, 21, -6, bn.c(0xa84d7a, 0.03)); // hem
  const heart = bn.g(C.pink);
  const HEART = ['.##.##.', '#######', '.#####.', '..###..', '...#...'];
  HEART.forEach((r, i) => { for (let j = 0; j < r.length; j++) if (r[j] === '#') bn.set(-3 + j, 27 - i, -5, heart); });
  const banner = meshGrid(bn, { size: s, glow: 0.9 });
  group.add(banner.group);

  // three volunteers (shared rounded figure, head ≈ 1/4 height)
  const B = 3; // feet layer (stage top is y=2)
  const people: { rig: Rig; phase: number }[] = [];
  const specs: { x: number; z: number; shirt: number; hair: number; cap?: number }[] = [
    { x: -7, z: -1, shirt: C.green, hair: C.hair },
    { x: 0, z: 1, shirt: C.coral, hair: 0x5a3a26, cap: C.blue },
    { x: 7, z: -1, shirt: C.blue, hair: C.hair },
  ];
  specs.forEach((sp, pi) => {
    const fig: FigureSpec = {
      x: sp.x, y: B, z: sp.z, legH: 6, legW: 1, torsoH: 7, waist: 1.6, shoulder: 2.5, depth: 1.2,
      head: [2.4, 2.5, 2.3], neck: 1,
    };
    const rig = buildRig(fig, {
      skin: C.skin, shirt: sp.shirt, shirtDark: sp.shirt, pants: C.jeans, shoe: C.shoe,
      hair: sp.hair, hairLight: sp.hair === C.hair ? 0x5a3b2c : 0x7a5236, cheek: C.pink, eye: C.ink,
    }, s, {
      cap: sp.cap,
      torsoDetail: (t, TL) => {
        let bz = 4;
        while (bz > 0 && !t.get(1, TL.torso0 + 3, bz)) bz--;
        t.set(1, TL.torso0 + 3, bz, t.c(C.white, 0.02)); // volunteer badge
      },
    });
    group.add(rig.root);
    people.push({ rig, phase: pi * 2.9 });
  });

  group.rotation.y = Math.PI / 4;

  const clock = makeSelectionClock();
  const bannerMat = banner.glowMat!;
  return {
    group,
    update(t, hover, selected) {
      const sel = clock(t, selected);
      const flash = sel >= 0 ? Math.exp(-sel * 4) : 0;
      people.forEach(({ rig, phase }, i) => {
        relax(rig, t, phase);
        // idle weight shift
        const ws = Math.sin(t * 0.8 + phase);
        rig.hips.rotation.z = 0.03 * ws;
        for (const l of rig.legs) l.a.rotation.z = -0.03 * ws;
        bendLeg(rig, ws > 0 ? rig.legs[0] : rig.legs[1], 0.08 * Math.abs(ws));
        rig.head.rotation.y = 0.25 * Math.sin(t * 0.45 + phase);
        rig.root.rotation.y = 0.1 * Math.sin(t * 0.3 + phase);

        // routine every 9 s (staggered): clap along + step in place
        const c = (t + phase) % 9;
        if (c < 3) {
          const env = smooth(c / 0.4) * smooth((3 - c) / 0.4);
          const beat = 0.5 + 0.5 * Math.cos(c * Math.PI * 2 * 2.2); // 1 = hands together
          for (const a of rig.arms) {
            a.a.rotation.set(-0.75 * env, -a.side * (0.35 + 0.33 * beat) * env, a.side * 0.07 * (1 - env));
            setElbow(a, -0.2 - 1.25 * env);
          }
          rig.legs.forEach((l, k) => bendLeg(rig, l, 0.3 * env * Math.max(0, Math.sin(c * Math.PI * 2 * 1.1 + k * Math.PI))));
        }

        // click: staggered cheer — hop (with anticipation) ×2, arms up, fists pumping
        if (sel >= 0) {
          const ls = sel - i * 0.15;
          if (ls >= 0 && ls < 2.6) {
            hop(rig, ls, 5);
            if (ls > 1.1) hop(rig, ls - 1.1, 3);
            const env = smooth(ls / 0.3) * smooth((2.6 - ls) / 0.5);
            for (const a of rig.arms) {
              a.a.rotation.set(-0.15 * env, a.side * 1.45 * env, a.side * (0.07 + 2.25 * env));
              setElbow(a, -0.2 - (0.55 + 0.35 * Math.sin(ls * 11 + a.side)) * env);
            }
          }
        }
        rig.eyes.scale.y = (t + phase) % 4.7 < 0.12 ? 0.15 : 1;
      });
      bannerMat.emissiveIntensity = 0.8 + 0.25 * osc(t, 2.2) + hover * 0.4 + flash * 0.9;
    },
  };
}
