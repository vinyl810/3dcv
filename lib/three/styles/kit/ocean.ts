import * as THREE from 'three';
import { GRADIENT, color, glass, TAU } from '../../kit';
import type { EnvPart } from '../../environment';
import { K } from './palette';
import { grassR, beachR, rimInR, rimOutR, FALLS, SEA_Y, NA, hash } from './terrain';

/**
 * Lagoon + waterfalls. The sea is a calm ring of water held between the beach
 * and a rock rim; it spills out through a few notches in the rim as NARROW,
 * tapering streams that arc away from the floating rock and dissolve into mist
 * — no flat walls. All colour animation is vertex-colour based (no per-frame
 * allocations, no normal recomputation: flat shading derives normals).
 */
export function buildKitOcean(): EnvPart {
  const group = new THREE.Group();

  /* ------------------------------------------------------------ lagoon */
  const RINGS = 5;
  const na = NA;
  const verts = (RINGS + 1) * na;
  const base = new Float32Array(verts * 2); // x,z rest
  const shore = new Float32Array(verts); // 0..1 shoreline foam weight
  for (let k = 0; k <= RINGS; k++) {
    for (let i = 0; i < na; i++) {
      const a = (i / na) * TAU;
      const r0 = grassR(a) + 0.35;
      const r1 = rimOutR(a) + 0.02;
      const f = k / RINGS;
      const r = r0 + (r1 - r0) * f;
      const v = k * na + i;
      base[v * 2] = Math.cos(a) * r;
      base[v * 2 + 1] = Math.sin(a) * r;
      const ds = r - beachR(a);
      shore[v] = Math.exp(-Math.pow((ds + 0.15) / 0.35, 2));
    }
  }
  const idx: number[] = [];
  for (let k = 0; k < RINGS; k++) {
    for (let i = 0; i < na; i++) {
      const j = (i + 1) % na;
      const a0 = k * na + i, a1 = k * na + j, b0 = (k + 1) * na + i, b1 = (k + 1) * na + j;
      idx.push(a0, a1, b0, a1, b1, b0);
    }
  }
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(verts * 3);
  const col = new Float32Array(verts * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  for (let v = 0; v < verts; v++) {
    pos[v * 3] = base[v * 2];
    pos[v * 3 + 2] = base[v * 2 + 1];
    pos[v * 3 + 1] = SEA_Y;
  }
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  const seaMat = new THREE.MeshToonMaterial({
    vertexColors: true,
    gradientMap: GRADIENT,
    transparent: true,
    opacity: 0.9,
  });
  (seaMat as THREE.Material as { flatShading?: boolean }).flatShading = true;
  const sea = new THREE.Mesh(geo, seaMat);
  group.add(sea);

  const deep = color(K.sea);
  const crestC = color(K.cyan);
  const foamC = color(K.foam);

  const updateSea = (t: number) => {
    for (let v = 0; v < verts; v++) {
      const x = base[v * 2];
      const z = base[v * 2 + 1];
      const h =
        Math.sin(x * 0.7 + z * 0.4 - t * 1.3) * 0.03 +
        Math.cos(x * 0.35 - z * 0.8 - t * 0.9) * 0.025 +
        Math.sin((x + z) * 1.1 - t * 2.1) * 0.012;
      pos[v * 3 + 1] = SEA_Y + h;
      const crest = THREE.MathUtils.clamp((h + 0.02) / 0.07, 0, 1);
      let r = deep.r + (crestC.r - deep.r) * crest * 0.75;
      let g = deep.g + (crestC.g - deep.g) * crest * 0.75;
      let b = deep.b + (crestC.b - deep.b) * crest * 0.75;
      const fw = shore[v] * (0.55 + 0.45 * Math.sin(t * 1.6 + x * 0.8 - z * 0.6));
      r += (foamC.r - r) * fw;
      g += (foamC.g - g) * fw;
      b += (foamC.b - b) * fw;
      col[v * 3] = r;
      col[v * 3 + 1] = g;
      col[v * 3 + 2] = b;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  };
  updateSea(0);

  /* ---------------------------------------------------------- waterfalls */
  const COLS = 6;
  const ROWS = 16;
  const DROP = 8.5;
  interface Fall { geo: THREE.BufferGeometry; col: Float32Array; v: Float32Array; u: Float32Array; ph: number }
  const falls: Fall[] = [];
  const fallMat = new THREE.MeshToonMaterial({
    vertexColors: true,
    gradientMap: GRADIENT,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  // smooth-shaded (not flat): a flat-faceted ribbon makes the pixel pass's
  // normal-edge detector draw a wire grid over the stream.

  FALLS.forEach((F, fi) => {
    const rLip = rimOutR(F.a) - 0.25;
    const fpos: number[] = [];
    const vv: number[] = [];
    const uu: number[] = [];
    for (let j = 0; j <= ROWS; j++) {
      const v = j / ROWS;
      const y = SEA_Y + 0.02 - DROP * v * v * 0.35 - DROP * v * 0.65; // accelerating fall
      const out = 0.15 + 1.6 * Math.sqrt(v); // arcs away from the rock
      const narrow = 1 - 0.45 * v;
      for (let c = 0; c <= COLS; c++) {
        const u = c / COLS;
        const a = F.a + (u - 0.5) * 2 * F.half * 0.95 * narrow;
        const r = rLip + out;
        fpos.push(Math.cos(a) * r, y, Math.sin(a) * r);
        vv.push(v);
        uu.push(u);
      }
    }
    const fidx: number[] = [];
    for (let j = 0; j < ROWS; j++) {
      for (let c = 0; c < COLS; c++) {
        const a0 = j * (COLS + 1) + c;
        const a1 = a0 + 1;
        const b0 = a0 + COLS + 1;
        const b1 = b0 + 1;
        fidx.push(a0, b0, a1, a1, b0, b1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(fpos, 3));
    const fcol = new Float32Array(vv.length * 4);
    g.setAttribute('color', new THREE.BufferAttribute(fcol, 4));
    g.setIndex(fidx);
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, fallMat);
    mesh.userData.noShadow = true;
    group.add(mesh);
    falls.push({ geo: g, col: fcol, v: new Float32Array(vv), u: new Float32Array(uu), ph: fi * 1.7 });

  });

  // lip foam: one instanced draw of churning foam blobs at each notch
  const LIP_PER = 7;
  const lip = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.11, 0),
    glass(K.foam, 0.85, 0.1),
    FALLS.length * LIP_PER,
  );
  lip.userData.noShadow = true;
  lip.frustumCulled = false;
  group.add(lip);
  const lipData = FALLS.flatMap((F, fi) =>
    Array.from({ length: LIP_PER }, (_, k) => {
      const a = F.a + ((k + 0.5) / LIP_PER - 0.5) * 2 * F.half;
      const r = rimOutR(F.a) - 0.1 + (hash(fi * 9 + k, 5) - 0.5) * 0.3;
      return { x: Math.cos(a) * r, z: Math.sin(a) * r, ph: hash(fi * 9 + k, 6) * TAU, s: 0.8 + hash(fi * 9 + k, 7) * 0.9 };
    }),
  );
  const dummy = new THREE.Object3D();

  const top = color(K.foam);
  const mid = color(K.cyan);
  const low = color(K.sea);

  const updateFalls = (t: number) => {
    for (const f of falls) {
      const n = f.v.length;
      for (let i = 0; i < n; i++) {
        const v = f.v[i];
        const u = f.u[i];
        // streaks scrolling downward, offset per column
        const streak = 0.5 + 0.5 * Math.sin((v * 9 - t * 2.6 + f.ph) * 1.0 + Math.sin(u * 7.0 + f.ph) * 1.6);
        const w = THREE.MathUtils.clamp(streak * 1.4 - 0.35, 0, 1);
        const edge = 1 - Math.pow(Math.abs(u - 0.5) * 2, 3);
        const tR = v < 0.5 ? mid.r + (top.r - mid.r) * (1 - v * 2) * 0.35 : mid.r + (low.r - mid.r) * (v - 0.5) * 0.6;
        const tG = v < 0.5 ? mid.g + (top.g - mid.g) * (1 - v * 2) * 0.35 : mid.g + (low.g - mid.g) * (v - 0.5) * 0.6;
        const tB = v < 0.5 ? mid.b + (top.b - mid.b) * (1 - v * 2) * 0.35 : mid.b + (low.b - mid.b) * (v - 0.5) * 0.6;
        f.col[i * 4] = tR + (top.r - tR) * w * 0.55;
        f.col[i * 4 + 1] = tG + (top.g - tG) * w * 0.55;
        f.col[i * 4 + 2] = tB + (top.b - tB) * w * 0.55;
        f.col[i * 4 + 3] = (0.92 - 0.9 * v * v) * (0.55 + 0.45 * edge);
      }
      f.geo.attributes.color.needsUpdate = true;
    }
    for (let i = 0; i < lipData.length; i++) {
      const d = lipData[i];
      const p = 0.5 + 0.5 * Math.sin(t * 4 + d.ph);
      dummy.position.set(d.x, SEA_Y + 0.04 + p * 0.06, d.z);
      dummy.scale.setScalar(d.s * (0.7 + 0.5 * p));
      dummy.updateMatrix();
      lip.setMatrixAt(i, dummy.matrix);
    }
    lip.instanceMatrix.needsUpdate = true;
  };
  updateFalls(0);

  return {
    group,
    update: (t) => {
      updateSea(t);
      updateFalls(t);
    },
  };
}
