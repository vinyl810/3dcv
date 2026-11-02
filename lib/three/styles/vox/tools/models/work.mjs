// Work @ KOAST — ocean-data monitor: a chunky widescreen monitor on a tall
// stand, a digital-twin globe (saturated
// blue sea, green continents) popping out of the screen inside an orbit ring,
// an ocean wave line + sea-surface heatmap strip, a wave-field histogram, and
// a 2D map card with a bobbing pin propped at the front-left of the stand.

import { Assembly, hash } from '../voxlib.mjs';
import { C, G } from '../palette.mjs';

export const name = 'work';

export function build() {
  const A = new Assembly(26, 38, 26);
  const MB = 10; // monitor bottom (chin) layer — short stand so the hub behind stays visible
  const MT = MB + 15; // monitor top layer

  // ---------------------------------------------------------------- base ---
  const base = A.part('base');
  // stone footing pad with a light lip
  base.box(5, 0, 7, 20, 1, 20, (x, y, z) => {
    const edge = x === 5 || x === 20 || z === 7 || z === 20;
    if ((x === 5 || x === 20) && (z === 7 || z === 20)) return 0;
    if (y === 0) return hash(x, z, 0, 3) < 0.25 ? C.rock[3] : C.rock[4];
    return edge ? C.rock[5] : C.rock[6];
  });
  for (let i = 0; i < 44; i++) {
    const side = i % 4;
    const a = Math.floor(hash(i, 1, 0, 5) * 15);
    const x = side === 0 ? 4 : side === 1 ? 21 : 5 + a;
    const z = side === 2 ? 6 : side === 3 ? 21 : 7 + Math.min(a, 13);
    if (hash(i, 2, 0, 5) < 0.45) continue;
    base.set(x, 0, z, hash(i, 3, 0, 5) < 0.5 ? C.grass[4] : C.grass[5]);
    if (hash(i, 4, 0, 5) < 0.35) base.set(x, 1, z, C.grass[6]);
  }
  // stand: foot plate + tall neck with a teal accent band
  base.box(8, 2, 9, 17, 2, 17, (x, y, z) => (z === 17 || x === 8 || x === 17 ? C.blue[3] : C.blue[4]));
  base.box(9, 3, 10, 16, 3, 16, C.blue[2]);
  base.box(11, 4, 11, 14, MB - 1, 13, (x) => (x === 11 ? C.rock[2] : C.rock[3]));
  base.box(11, 7, 14, 14, 8, 14, C.teal[4]);
  // monitor housing (back + sides), navy with a bright top edge
  base.box(1, MB, 11, 24, MT, 14, (x, y, z) => {
    if (y === MT) return C.blue[5];
    if (x === 1 || x === 24) return C.blue[2];
    return z === 11 ? C.blue[1] : C.blue[2];
  });
  base.box(4, MB + 3, 10, 21, MT - 3, 10, C.blue[1]); // back hump
  // bezel (front plane z = 15)
  base.box(1, MB, 15, 24, MT, 15, C.rock[1]);
  base.box(1, MT, 15, 24, MT, 15, C.blue[5]);
  base.box(1, MB, 15, 24, MB + 1, 15, C.blue[3]); // chin
  base.set(22, MB + 1, 16, G.greenGlow); // power LED
  // screen: dark sea-navy with a faint data grid
  base.box(2, MB + 2, 15, 23, MT - 1, 15, (x, y) => ((x - 2) % 5 === 0 || (y - MB - 2) % 4 === 0 ? C.water[1] : C.water[0]));
  base.box(2, MT - 1, 15, 23, MT - 1, 15, C.water[2]); // title bar
  base.set(3, MT - 1, 16, G.pinkGlow); base.set(5, MT - 1, 16, G.goldGlow); base.set(7, MT - 1, 16, G.greenGlow);
  base.box(13, MB + 2, 16, 23, MB + 2, 16, C.teal[5]); // histogram baseline
  // sea-surface heatmap strip along the bottom of the screen (cool → warm)
  const SST = [C.blue[3], C.blue[4], C.teal[4], C.teal[5], C.gold[5], C.red[5], C.gold[5], C.teal[5]];
  for (let x = 2; x <= 23; x++) base.set(x, MB + 2, 15, SST[Math.floor(((Math.sin(x * 0.55) + 1) / 2) * 7.99)]);
  // ocean wave line across the upper-right of the screen
  for (let x = 13; x <= 23; x++) base.set(x, MT - 3 + Math.round(Math.sin(x * 0.9) * 1.2), 15, G.screen);

  // ---------------------------------------------------- holo globe + ring ---
  const GX = 7.5, GY = MB + 8.5, GZ = 17.5, R = 4.4;
  const globe = A.part('globe');
  globe.sphere(GX, GY, GZ, R, (x, y, z) => {
    const dx = x - GX, dy = y - GY, dz = z - GZ;
    const lat = Math.atan2(dy, Math.hypot(dx, dz));
    const lon = Math.atan2(dz, dx);
    if (lat > 1.2) return C.sand[7]; // polar cap
    const land = Math.sin(lon * 2 + 0.6) + Math.cos(lat * 3 + lon) * 0.8;
    if (land > 0.75) return dy > 1 ? C.grass[6] : C.grass[5]; // green continents
    return dy > 1.5 ? C.blue[5] : dy < -1.5 ? C.blue[3] : C.blue[4]; // saturated blue sea
  });
  const ring = A.part('ring');
  for (let k = 0; k < 44; k++) {
    if (k % 11 === 10) continue; // a few gaps so its spin reads
    const a = (k / 44) * Math.PI * 2;
    ring.set(GX + Math.cos(a) * 6.6, GY, GZ + Math.sin(a) * 6.6, G.screen);
  }

  // ------------------------------------------------------ wave-field bars ---
  const heights = [4, 7, 5, 9, 6, 3];
  heights.forEach((hh, i) => {
    const b = A.part(`bar${i}`);
    const x0 = 13 + i * 2;
    b.box(x0, MB + 3, 16, x0, MB + 2 + hh, 16, (x, y) => (y >= MB + 2 + hh ? G.screenHi : G.screen));
  });

  // --------------------------------------------------------- 2D map card ---
  // a framed sea chart on a little easel at the front-left of the stand
  const map = A.part('map');
  base.box(2, 2, 21, 2, 3, 21, C.wood[3]); base.box(9, 2, 21, 9, 3, 21, C.wood[3]); // easel legs
  base.box(2, 2, 19, 9, 2, 19, C.wood[2]); // back brace
  map.box(1, 3, 20, 10, 11, 20, C.wood[4]); // frame
  map.box(2, 4, 21, 9, 10, 21, (x, y) => {
    const coast = 4 + Math.round(Math.sin(y * 1.1) * 1.3);
    if (x <= coast) return C.grass[5]; // land
    if ((x + y) % 4 === 0) return C.blue[5]; // depth contour
    return C.blue[4]; // sea
  });
  map.set(7, 6, 22, C.sand[7]); map.set(8, 8, 22, C.sand[7]); // buoys
  const pin = A.part('pin');
  pin.box(6, 9, 22, 6, 10, 22, C.rock[5]);
  pin.box(5, 11, 22, 7, 12, 22, C.red[4]);
  pin.set(6, 13, 22, C.red[5]);
  pin.set(5, 12, 22, C.red[6]);

  return {
    assembly: A,
    origin: [13, 0, 14],
    pivots: {
      base: [13, 0, 14],
      globe: [GX + 0.5, GY + 0.5, GZ + 0.5],
      ring: [GX + 0.5, GY + 0.5, GZ + 0.5],
      ...Object.fromEntries(heights.map((_, i) => [`bar${i}`, [13.5 + i * 2, MB + 3, 16.5]])),
      map: [5.5, 3, 20.5],
      pin: [6.5, 9, 22.5],
    },
    glow: { [G.screen]: 1.0, [G.screenHi]: 1.1, [G.greenGlow]: 0.9 },
  };
}
