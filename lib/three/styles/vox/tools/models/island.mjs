// Floating island terrain: organic squircle grass plateau (top exactly at
// world y = 0.5), a sand beach ring, a shallow lagoon ring held in by a rocky
// lip with spill notches, and a stepped, strata-banded rock underside that
// tapers to a point. Stored as a thin hollow SHELL (runtime meshes outside
// faces only). Parts: terrain (static), water (lagoon surface, animated by the
// ocean builder), crystals (emissive glints in the underside).
import { Assembly, hash } from '../voxlib.mjs';
import { C, G } from '../palette.mjs';

export const name = 'island';

const V = 0.125; // world units per voxel
const N = 164; // grid width/depth (voxels)
const O = N / 2; // grid centre (cell boundary) → world x/z = 0
const YG = 62; // grass top voxel layer → world top = 0.5
const OY = YG - 3; // origin y so (YG+1-OY)*V = 0.5
const YB = 58; // beach top layer (world top 0.0)
const YR = 58; // rim top layer
const YW = 56; // water surface voxel layer (top at world -0.25)

// smooth 1D angular noise
function angNoise(t, seed, amp) {
  return amp * (0.55 * Math.sin(3 * t + seed) + 0.3 * Math.sin(5 * t + seed * 2.1) + 0.15 * Math.sin(9 * t + seed * 3.7));
}
// 2D value noise (smooth) for mottling
function vnoise(x, z, s, seed) {
  const fx = x / s, fz = z / s;
  const x0 = Math.floor(fx), z0 = Math.floor(fz);
  const tx = fx - x0, tz = fz - z0;
  const sm = (t) => t * t * (3 - 2 * t);
  const a = hash(x0, z0, 0, seed), b = hash(x0 + 1, z0, 0, seed);
  const c = hash(x0, z0 + 1, 0, seed), d = hash(x0 + 1, z0 + 1, 0, seed);
  const u = sm(tx), v = sm(tz);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}
/** superellipse radius (world) in direction t */
function sqr(R, n, t) {
  const c = Math.abs(Math.cos(t)), s = Math.abs(Math.sin(t));
  return R / Math.pow(c ** n + s ** n, 1 / n);
}

// Spill notches in the rim (angle, half-width in world units). The camera sits
// at +x+z, so the visible faces are the +x and +z sides.
const NOTCHES = [
  { t: 0.0, hw: 0.45 }, // +x side
  { t: Math.PI / 2 + 0.25, hw: 0.4 }, // +z side, a bit off-centre
  { t: -0.55, hw: 0.35 }, // +x / -z quarter
  { t: Math.PI / 2 - 0.85, hw: 0.3 }, // near the front corner
];

export function build() {
  const A = new Assembly(N, 64, N);
  const terr = A.part('terrain');
  const water = A.part('water');
  const crys = A.part('crystals');

  const solid = new Uint8Array(N * 64 * N); // full solid before shelling
  const col = new Uint8Array(N * 64 * N);
  const id = (x, y, z) => x + N * (z + N * y);

  const RG = 7.62;
  let minGrassDiag = 99;
  for (let z = 0; z < N; z++)
    for (let x = 0; x < N; x++) {
      const wx = (x + 0.5 - O) * V, wz = (z + 0.5 - O) * V;
      const r = Math.hypot(wx, wz);
      const t = Math.atan2(wz, wx);
      const rg = sqr(RG, 6, t) + angNoise(t, 1.3, 0.22);
      const rb = rg + 0.55 + angNoise(t, 4.1, 0.12);
      const rw = rb + 1.0 + angNoise(t, 7.7, 0.18);
      const rr = rw + 0.5 + angNoise(t, 2.9, 0.08);
      if (r > rr) {
        // underside can't extend beyond the rim
        continue;
      }
      let top, ring;
      if (r <= rg) { top = YG; ring = 'grass'; }
      else if (r <= rb) { top = YB; ring = 'beach'; }
      else if (r <= rw) {
        // lagoon bed slopes down then up again
        const f = (r - rb) / (rw - rb);
        top = YW - 1 - Math.round(2.2 * Math.sin(f * Math.PI));
        ring = 'lagoon';
      } else {
        top = YR + (hash(x, z, 0, 5) < 0.18 ? 1 : 0);
        ring = 'rim';
        for (const n of NOTCHES) {
          let dt = Math.abs(((t - n.t + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
          if (dt * r < n.hw) top = YW - 1;
        }
      }

      // underside profile: radius fraction by depth below the rim, in strata steps
      for (let y = top; y >= 0; y--) {
        const k = YR - y; // depth below rim top
        if (k > 0) {
          const strata = Math.floor(k / 5);
          const kk = strata * 5 + (hash(strata, Math.round(t * 6), 0, 11) < 0.5 ? 0 : 2);
          const f = 1 - 0.9 * Math.pow(Math.min(1, kk / 58), 1.25);
          const jag = angNoise(t, strata * 1.7, 0.35) + (hash(x, z, strata, 3) - 0.5) * 0.25;
          const rk = rr * f + jag * (0.4 + 0.6 * (1 - f));
          if (r > rk) continue;
        }
        solid[id(x, y, z)] = 1;
        // colour
        let c;
        const dTop = top - y;
        if (ring === 'grass' && dTop <= 1) {
          if (dTop === 0) {
            const m = vnoise(x, z, 9, 1) * 0.7 + vnoise(x, z, 3.5, 2) * 0.3;
            const edge = rg - r;
            c = m < 0.36 ? C.grass[3] : m < 0.62 ? C.grass[4] : C.grass[5];
            if (hash(x, z, 1, 21) < 0.03) c = C.grass[6];
            if (edge < 0.14) c = C.grass[5]; // bright lip catches the light
          } else c = C.grass[3];
        } else if (ring === 'grass' && dTop <= 3) {
          c = hash(x, y, z, 2) < 0.5 ? C.earth[4] : C.earth[5];
        } else if ((ring === 'beach' || (ring === 'grass' && y <= YB)) && y >= YB - 1) {
          c = y === top ? (vnoise(x, z, 4, 6) < 0.45 ? C.sand[3] : C.sand[4]) : C.sand[2];
          if (y === top && ring === 'beach' && hash(x, z, 0, 8) < 0.05) c = C.sand[2];
        } else if (ring === 'lagoon' && dTop <= 1) {
          c = dTop === 0 ? (hash(x, z, 0, 12) < 0.3 ? C.water[3] : C.water[4]) : C.water[2];
        } else if (ring === 'rim' && dTop === 0 && y >= YR) {
          const mo = hash(x, z, 0, 13);
          c = mo < 0.15 ? C.grass[4] : mo < 0.5 ? C.rock[5] : C.rock[4];
        } else {
          const k = YR - y;
          if (k < 4) c = hash(x, y, z, 7) < 0.5 ? C.earth[4] : C.earth[3];
          else if (k < 22) {
            const band = Math.floor((k + Math.round(angNoise(t, 3.3, 1.5))) / 4) % 3;
            c = [C.earth[3], C.earth[2], C.earth[4]][band];
            if (hash(x, y, z, 9) < 0.08) c = C.rock[3];
          } else if (k < 42) {
            const band = Math.floor((k + Math.round(angNoise(t, 5.1, 1.5))) / 5) % 2;
            c = band ? C.rock[3] : C.rock[2];
            if (hash(x, y, z, 10) < 0.1) c = C.earth[2];
          } else c = hash(x, y, z, 14) < 0.5 ? C.rock[2] : C.violet[1];
        }
        col[id(x, y, z)] = c;
      }
      // lagoon water surface layer (separate part)
      if (ring === 'lagoon' || (ring === 'rim' && top < YW)) water.set(x, YW, z, C.water[5]);
    }

  // grass overhang drips just below the plateau edge onto the beach wall
  for (let z = 1; z < N - 1; z++)
    for (let x = 1; x < N - 1; x++) {
      if (!solid[id(x, YG, z)]) continue;
      const exposed = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => !solid[id(x + dx, YG, z + dz)]);
      if (exposed) {
        const len = hash(x, z, 0, 31) < 0.45 ? 1 + Math.floor(hash(x, z, 0, 32) * 2.4) : 0;
        for (let k = 1; k <= len; k++) if (solid[id(x, YG - k, z)]) col[id(x, YG - k, z)] = k === len ? C.grass[2] : C.grass[3];
      }
    }

  // shell: keep only voxels with an empty 6-neighbour (runtime meshes outside faces)
  for (let y = 0; y < 64; y++)
    for (let z = 0; z < N; z++)
      for (let x = 0; x < N; x++) {
        if (!solid[id(x, y, z)]) continue;
        let edge = x === 0 || z === 0 || y === 0 || x === N - 1 || z === N - 1 || y === 63;
        if (!edge)
          edge = !solid[id(x + 1, y, z)] || !solid[id(x - 1, y, z)] || !solid[id(x, y + 1, z)] ||
            !solid[id(x, y - 1, z)] || !solid[id(x, y, z + 1)] || !solid[id(x, y, z - 1)];
        if (edge) terr.set(x, y, z, col[id(x, y, z)]);
      }

  // crystals poking out of the underside (sparing emissive glints)
  const glints = [];
  for (let i = 0; i < 14; i++) {
    const t = hash(i, 1, 0, 40) * Math.PI * 2;
    const y = 18 + Math.floor(hash(i, 2, 0, 40) * 28);
    // walk inward from the edge to find the surface at this height
    for (let rr = 78; rr > 2; rr--) {
      const x = Math.round(O + Math.cos(t) * rr), z = Math.round(O + Math.sin(t) * rr);
      if (solid[id(x, y, z)]) {
        const ox = Math.round(Math.cos(t)), oz = Math.round(Math.sin(t));
        const g = i % 3 === 0 ? G.violetGlow : G.screen;
        crys.set(x + ox, y, z + oz, g);
        crys.set(x + ox, y - 1, z + oz, g);
        crys.set(x + 2 * ox, y - 1, z + 2 * oz, g);
        crys.set(x + ox, y - 2, z + oz, g);
        glints.push([x, y, z]);
        break;
      }
    }
  }
  // hanging root tendrils under the rim
  for (let i = 0; i < 26; i++) {
    const t = hash(i, 5, 0, 41) * Math.PI * 2;
    for (let rr = 80; rr > 2; rr--) {
      const x = Math.round(O + Math.cos(t) * rr), z = Math.round(O + Math.sin(t) * rr);
      let yb = -1;
      for (let y = YR - 3; y > YR - 14; y--) if (solid[id(x, y, z)] && !solid[id(x, y - 1, z)]) { yb = y; break; }
      if (yb > 0) {
        const len = 2 + Math.floor(hash(i, 6, 0, 41) * 6);
        for (let k = 1; k <= len; k++) terr.set(x, yb - k, z, k > len - 2 ? C.leaf[3] : C.earth[2]);
        break;
      }
    }
  }

  // spill notch meta (world coords) for the waterfalls
  const falls = NOTCHES.map((n) => {
    // outer rim radius at this angle (match the formula above)
    const rg = sqr(RG, 6, n.t) + angNoise(n.t, 1.3, 0.22);
    const rb = rg + 0.55 + angNoise(n.t, 4.1, 0.12);
    const rw = rb + 1.0 + angNoise(n.t, 7.7, 0.18);
    const rr = rw + 0.5 + angNoise(n.t, 2.9, 0.08);
    return [Math.cos(n.t) * rr, Math.sin(n.t) * rr, n.t, n.hw];
  });
  for (const t of [Math.PI / 4, 3 * Math.PI / 4, -Math.PI / 4, -3 * Math.PI / 4])
    minGrassDiag = Math.min(minGrassDiag, sqr(RG, 6, t) + angNoise(t, 1.3, 0.22));
  console.log(`  island: min grass radius on the diagonal = ${minGrassDiag.toFixed(2)} (needs >= ${(6.5 * Math.SQRT2).toFixed(2)})`);

  return {
    assembly: A,
    origin: [O, OY, O],
    hollow: true,
    ao: 0.22,
    noMerge: ['water'],
    pivots: { terrain: [O, OY, O], water: [O, OY, O], crystals: [O, OY, O] },
    glow: { [G.screen]: 0.9, [G.violetGlow]: 0.9 },
    meta: { falls, waterY: (YW + 1 - OY) * V },
  };
}
