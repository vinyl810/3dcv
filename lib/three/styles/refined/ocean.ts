import * as THREE from 'three';
import { GRADIENT, color } from '../../kit';
import type { EnvPart } from '../../environment';
import { RP, rng } from './rkit';
import { CELL, HALF_CELLS, WATER_Y, NOTCHES, cellMap, cellAt, cx } from './shape';

/**
 * Refined water: a readable LAGOON RING held inside the island's rock lip
 * (pixel-quantised animated colours: drifting light bands + breathing shore
 * foam), spilling through three notches as NARROW, tapered, stepped falls with
 * scrolling streaks that break into droplets/mist below the island.
 */

function lin(hex: number): THREE.Color {
  return new THREE.Color().setHex(hex, THREE.SRGBColorSpace);
}

/** Striped streak texture for the falls (8 × 16 texels, nearest, repeating). */
function fallTexture(): THREE.DataTexture {
  const W = 8, H = 16;
  const data = new Uint8Array(W * H * 4);
  const water: number = RP.water, light: number = RP.waterLight, foam: number = RP.foam;
  // per-column streak offsets → staggered vertical highlights
  for (let x = 0; x < W; x++) {
    const off = Math.floor(rng(x, 3) * H);
    const len = 3 + Math.floor(rng(x, 4) * 5);
    for (let y = 0; y < H; y++) {
      const k = (y - off + H) % H;
      let c = water;
      if (k < len) c = light;
      if (k === 0 && rng(x, 5) > 0.35) c = foam;
      const i = (y * W + x) * 4;
      data[i] = (c >> 16) & 255;
      data[i + 1] = (c >> 8) & 255;
      data[i + 2] = c & 255;
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

interface FallInfo { axis: 'x' | 'z'; along: number; edge: number; width: number }

export function buildRefinedOcean(): EnvPart {
  const group = new THREE.Group();
  const map = cellMap();
  const n = HALF_CELLS * 2;

  // ------------------------------------------------------------ lagoon ----
  const qx: number[] = [];
  const qz: number[] = [];
  const kind: number[] = []; // 0 open, 1 shore, 2 lip
  const pos: number[] = [];
  const nor: number[] = [];
  const q = CELL / 2;
  const isLand = (i: number, j: number) => {
    const t = cellAt(map, i, j);
    return t === 'S' || t === 'G';
  };
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const t = map[i][j];
      if (t !== 'W' && t !== 'N') continue;
      const x = cx(i), z = cx(j);
      for (let a = 0; a < 2; a++) {
        for (let b = 0; b < 2; b++) {
          const x0 = x - CELL / 2 + a * q, z0 = z - CELL / 2 + b * q;
          // shore = this sub-quad touches a land cell (side or corner)
          const di = a === 0 ? -1 : 1, dj = b === 0 ? -1 : 1;
          const shore = isLand(i + di, j) || isLand(i, j + dj) || isLand(i + di, j + dj);
          let lip = t === 'N';
          for (let u = -1; u <= 1 && !lip; u++) for (let v = -1; v <= 1; v++) if (cellAt(map, i + u, j + v) === 'N') lip = true;
          qx.push(x0 + q / 2);
          qz.push(z0 + q / 2);
          kind.push(lip ? 2 : shore ? 1 : 0);
          const y = WATER_Y;
          pos.push(x0, y, z0, x0, y, z0 + q, x0 + q, y, z0 + q, x0, y, z0, x0 + q, y, z0 + q, x0 + q, y, z0);
          for (let k = 0; k < 6; k++) nor.push(0, 1, 0);
        }
      }
    }
  }
  const NQ = qx.length;
  const lagoonGeo = new THREE.BufferGeometry();
  lagoonGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  lagoonGeo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  const colArr = new Float32Array(NQ * 18);
  const colAttr = new THREE.BufferAttribute(colArr, 3);
  colAttr.setUsage(THREE.DynamicDrawUsage);
  lagoonGeo.setAttribute('color', colAttr);
  const lagoonMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: GRADIENT });
  (lagoonMat as THREE.Material as { flatShading?: boolean }).flatShading = true;
  const lagoon = new THREE.Mesh(lagoonGeo, lagoonMat);
  group.add(lagoon);
  const C_DEEP = lin(RP.waterDeep), C_W = lin(RP.water), C_L = lin(RP.waterLight), C_F = lin(RP.foam);
  const qPhase = qx.map((x, i) => rng(i, 17) * 0.8 + (x + qz[i]) * 0.35);

  // ------------------------------------------------------------- falls ----
  const falls: FallInfo[] = NOTCHES.map((nt) => {
    let edge = -Infinity;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (map[i][j] !== 'N') continue;
        const along = nt.axis === 'z' ? cx(i) : cx(j);
        const out = nt.axis === 'z' ? cx(j) : cx(i);
        if (Math.abs(along - nt.along) < nt.width / 2) edge = Math.max(edge, out + CELL / 2);
      }
    }
    return { axis: nt.axis, along: nt.along, edge, width: nt.width };
  });

  const tex = fallTexture();
  const fallMat = new THREE.MeshToonMaterial({
    map: tex,
    gradientMap: GRADIENT,
    emissive: color(0xffffff),
    emissiveMap: tex,
    emissiveIntensity: 0.28,
  });
  const fp: number[] = [];
  const fn: number[] = [];
  const fu: number[] = [];
  // push an axis-aligned box in "fall space": a = along, o = outward, y = up
  const pushBox = (f: FallInfo, a0: number, a1: number, o0: number, o1: number, y0: number, y1: number) => {
    const P = (a: number, o: number, y: number): [number, number, number] =>
      f.axis === 'z' ? [a, y, o] : [o, y, a];
    const quad = (
      p: [number, number, number][], nrm: [number, number, number], uvs: [number, number][],
    ) => {
      // winding: fix to face nrm
      const [A, B, C] = p;
      const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2];
      const vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
      const cr = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
      const flip = cr[0] * nrm[0] + cr[1] * nrm[1] + cr[2] * nrm[2] < 0;
      const order = flip ? [0, 3, 2, 0, 2, 1] : [0, 1, 2, 0, 2, 3];
      for (const k of order) {
        fp.push(...p[k]);
        fn.push(...nrm);
        fu.push(...uvs[k]);
      }
    };
    const outN: [number, number, number] = f.axis === 'z' ? [0, 0, 1] : [1, 0, 0];
    const sideN: [number, number, number] = f.axis === 'z' ? [1, 0, 0] : [0, 0, 1];
    const sideNeg: [number, number, number] = [-sideN[0], 0, -sideN[2]];
    const V = (y: number) => y * 0.5; // 16 texels per 2 world units
    // outer face (streaks across the width)
    quad(
      [P(a0, o1, y0), P(a1, o1, y0), P(a1, o1, y1), P(a0, o1, y1)], outN,
      [[a0, V(y0)], [a1, V(y0)], [a1, V(y1)], [a0, V(y1)]],
    );
    // the two side faces
    quad(
      [P(a1, o0, y0), P(a1, o1, y0), P(a1, o1, y1), P(a1, o0, y1)], sideN,
      [[o0 * 2, V(y0)], [o1 * 2, V(y0)], [o1 * 2, V(y1)], [o0 * 2, V(y1)]],
    );
    quad(
      [P(a0, o0, y0), P(a0, o1, y0), P(a0, o1, y1), P(a0, o0, y1)], sideNeg,
      [[o0 * 2, V(y0)], [o1 * 2, V(y0)], [o1 * 2, V(y1)], [o0 * 2, V(y1)]],
    );
    // top
    quad(
      [P(a0, o0, y1), P(a1, o0, y1), P(a1, o1, y1), P(a0, o1, y1)], [0, 1, 0],
      [[a0, o0], [a1, o0], [a1, o1], [a0, o1]],
    );
  };
  for (const f of falls) {
    const E = f.edge;
    const c = f.along;
    const hw = f.width / 2;
    // lip tongue curling over the rim, then a tapered, stepped drop
    pushBox(f, c - hw, c + hw, E - 0.5, E + 0.15, WATER_Y - 0.2, WATER_Y + 0.001);
    const steps: [number, number, number, number][] = [
      // [halfWidth, outward offset, yTop, yBottom]
      [hw, 0.1, WATER_Y, -0.9],
      [hw - 0.05, 0.2, -0.9, -1.9],
      [hw - 0.15, 0.28, -1.9, -2.9],
      [hw - 0.25, 0.34, -2.9, -3.7],
      [hw - 0.35, 0.38, -3.7, -4.3],
    ];
    for (const [w, o, yt, yb] of steps) pushBox(f, c - w, c + w, E + o - 0.25, E + o, yb, yt);
  }
  const fallGeo = new THREE.BufferGeometry();
  fallGeo.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3));
  fallGeo.setAttribute('normal', new THREE.Float32BufferAttribute(fn, 3));
  fallGeo.setAttribute('uv', new THREE.Float32BufferAttribute(fu, 2));
  const fallMesh = new THREE.Mesh(fallGeo, fallMat);
  fallMesh.userData.noShadow = true;
  group.add(fallMesh);

  // ---------------------------------------- droplets + lip foam (instanced)
  const DROPS = 16;
  const LIP = 7;
  const total = falls.length * (DROPS + LIP);
  const dropMat = new THREE.MeshToonMaterial({
    color: color(RP.foam), gradientMap: GRADIENT, emissive: color(RP.waterLight), emissiveIntensity: 0.35,
  });
  const drops = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), dropMat, total);
  drops.userData.noShadow = true;
  drops.frustumCulled = false;
  group.add(drops);
  const dummy = new THREE.Object3D();

  return {
    group,
    update: (t) => {
      // lagoon colours (quantised → crisp pixel water)
      for (let i = 0; i < NQ; i++) {
        const x = qx[i], z = qz[i], ph = qPhase[i];
        let c = C_W;
        if (kind[i] === 2) {
          c = Math.sin(t * 4.0 + ph * 5) > 0.1 ? C_F : C_L;
        } else if (kind[i] === 1) {
          const s = Math.sin(t * 1.4 + ph * 2.2);
          c = s > 0.45 ? C_F : s > -0.3 ? C_L : C_W;
        } else {
          const band = Math.sin(x * 1.1 + z * 0.8 - t * 1.0) * 0.6 + Math.sin(-x * 0.6 + z * 1.4 - t * 0.7) * 0.5 + (ph % 1) * 0.3 - 0.15;
          c = band > 0.72 ? C_L : band < -0.55 ? C_DEEP : C_W;
        }
        const o = i * 18;
        for (let k = 0; k < 18; k += 3) {
          colArr[o + k] = c.r;
          colArr[o + k + 1] = c.g;
          colArr[o + k + 2] = c.b;
        }
      }
      colAttr.needsUpdate = true;

      // falls: scroll streaks downward
      tex.offset.y = t * 0.55;

      // droplets: break off the fall foot and dissolve into mist
      let idx = 0;
      for (let fi = 0; fi < falls.length; fi++) {
        const f = falls[fi];
        for (let k = 0; k < DROPS; k++) {
          const r1 = rng(fi * 37 + k, 1), r2 = rng(fi * 37 + k, 2);
          const p = (t * (0.35 + r2 * 0.2) + r1) % 1;
          const a = f.along + (r1 - 0.5) * f.width * (0.5 + p * 0.9);
          const o = f.edge + 0.25 + p * 0.5 + r2 * 0.15;
          const y = -4.0 - p * 2.8;
          const s = 0.2 * (1 - p * 0.75);
          if (f.axis === 'z') dummy.position.set(a, y, o);
          else dummy.position.set(o, y, a);
          dummy.scale.setScalar(s);
          dummy.updateMatrix();
          drops.setMatrixAt(idx++, dummy.matrix);
        }
        for (let k = 0; k < LIP; k++) {
          const r1 = rng(fi * 53 + k, 7);
          const cyc = (t * (0.6 + r1 * 0.5) + r1 * 3) % 1;
          const a = f.along + ((k + 0.5) / LIP - 0.5) * f.width * 0.95;
          const o = f.edge - 0.1 - r1 * 0.3;
          const s = cyc < 0.7 ? 0.08 + 0.1 * Math.sin((cyc / 0.7) * Math.PI) : 0;
          if (f.axis === 'z') dummy.position.set(a, WATER_Y + 0.05 + s * 0.4, o);
          else dummy.position.set(o, WATER_Y + 0.05 + s * 0.4, a);
          dummy.scale.setScalar(Math.max(s, 0.0001));
          dummy.updateMatrix();
          drops.setMatrixAt(idx++, dummy.matrix);
        }
      }
      drops.instanceMatrix.needsUpdate = true;
    },
  };
}
