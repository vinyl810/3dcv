import * as THREE from 'three';
import type { EnvPart } from '../../environment';
import { GRADIENT } from '../../kit';
import { VOXEL, instantiate, voxAsset } from './assets';

/**
 * The lagoon + waterfalls. The lagoon is the `water` part of island.vox (so its
 * shape is editable in MagicaVoxel); every voxel face shimmers through a few
 * quantised palette steps (pixel-art water, not a smooth gradient). Waterfalls
 * are NARROW voxel ribbons that spill from notches in the rim, scroll bright
 * bands downward and break into fading droplets — so they read as
 * falling water, not walls.
 */

const PAL = {
  deep: 0x28768c, mid: 0x34949c, light: 0x4fb4ac, crest: 0x7fd2c0, foam: 0xc2efe0, white: 0xfff6e2,
};
const col = (hex: number) => new THREE.Color().setHex(hex, THREE.SRGBColorSpace);

export function buildVoxOcean(): EnvPart {
  const group = new THREE.Group();
  const { asset, entry } = voxAsset('island');
  const meta = (entry as unknown as { meta: { falls: [number, number, number, number][]; waterY: number } }).meta;

  // ------------------------------------------------------------- lagoon ---
  const inst = instantiate('island', VOXEL);
  const waterPivot = inst.parts.water;
  const waterMesh = waterPivot.children[0] as THREE.Mesh;
  const wgeo = waterMesh.geometry as THREE.BufferGeometry;
  const wmat = new THREE.MeshToonMaterial({
    vertexColors: true, gradientMap: GRADIENT, transparent: true, opacity: 0.88,
    emissive: col(0x0b2a36), emissiveIntensity: 1,
  });
  waterMesh.material = wmat;
  waterPivot.removeFromParent();
  group.add(waterPivot);
  waterPivot.position.y -= 0.02; // tiny dip so the rim lip sits proud
  waterPivot.userData.noShadow = true;

  // Per face (4 verts): centre (x,z), whether it hugs the shore, and a phase.
  const wpos = wgeo.attributes.position as THREE.BufferAttribute;
  const wcol = wgeo.attributes.color as THREE.BufferAttribute;
  const nFaces = wpos.count / 4;
  const fx = new Float32Array(nFaces), fz = new Float32Array(nFaces), shore = new Float32Array(nFaces);
  const wpart = asset.parts.find((p) => p.name === 'water')!;
  const has = (x: number, z: number) => {
    const lx = x - wpart.min[0], lz = z - wpart.min[2];
    if (lx < 0 || lz < 0 || lx >= wpart.w || lz >= wpart.d) return false;
    for (let y = 0; y < wpart.h; y++) if (wpart.v[lx + wpart.w * (lz + wpart.d * y)]) return true;
    return false;
  };
  const org = entry.origin!;
  for (let f = 0; f < nFaces; f++) {
    let sx = 0, sz = 0;
    for (let k = 0; k < 4; k++) { sx += wpos.getX(f * 4 + k); sz += wpos.getZ(f * 4 + k); }
    fx[f] = sx / 4; fz[f] = sz / 4;
    const vx = Math.floor(fx[f] / VOXEL + org[0]), vz = Math.floor(fz[f] / VOXEL + org[2]);
    let open = 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (!has(vx + dx, vz + dz)) open++;
    shore[f] = open;
  }
  const C = { deep: col(PAL.deep), mid: col(PAL.mid), light: col(PAL.light), crest: col(PAL.crest), foam: col(PAL.foam) };
  let lastWater = -1;
  const updateWater = (t: number) => {
    if (t - lastWater < 1 / 12) return; // quantised shimmer: 12 fps is plenty + cheap
    lastWater = t;
    for (let f = 0; f < nFaces; f++) {
      const x = fx[f], z = fz[f];
      const r = Math.hypot(x, z);
      const v =
        Math.sin(r * 2.2 - t * 1.6) * 0.45 +
        Math.sin(x * 1.7 + z * 0.9 + t * 0.9) * 0.35 +
        Math.sin(z * 2.3 - x * 0.6 - t * 1.3) * 0.25;
      let c = v < -0.35 ? C.deep : v < 0.25 ? C.mid : v < 0.72 ? C.light : C.crest;
      if (shore[f] >= 3) c = Math.sin(t * 2.2 + x * 3.1 + z * 2.7) > -0.2 ? C.foam : C.crest;
      else if (shore[f] >= 1 && v > 0.1) c = C.crest;
      for (let k = 0; k < 4; k++) wcol.setXYZ(f * 4 + k, c.r, c.g, c.b);
    }
    wcol.needsUpdate = true;
  };
  updateWater(0);

  // ---------------------------------------------------------- waterfalls ---
  const WATER_Y = meta.waterY;
  const ROWS = 46;
  const fallMat = new THREE.MeshToonMaterial({
    vertexColors: true, gradientMap: GRADIENT, transparent: true, depthWrite: false,
    emissive: col(0x123c48), emissiveIntensity: 1, side: THREE.FrontSide,
  });
  const box = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
  const boxPos = box.attributes.position as THREE.BufferAttribute;
  const boxNor = box.attributes.normal as THREE.BufferAttribute;
  type Cell = { row: number; col: number; phase: number; alpha: number };
  const falls: { cells: Cell[]; color: THREE.BufferAttribute; nCols: number }[] = [];
  meta.falls.forEach(([ex, ez, ang, hw], fi) => {
    const nx = Math.cos(ang), nz = Math.sin(ang); // outward
    const tx = -nz, tz = nx; // along the rim
    const nCols = Math.max(4, Math.round((hw * 2) / VOXEL));
    const cells: Cell[] = [];
    const pos: number[] = [], nor: number[] = [];
    const rnd = (a: number, b: number) => { const s = Math.sin(a * 127.1 + b * 311.7 + fi * 74.7) * 43758.5453; return s - Math.floor(s); };
    for (let row = 0; row < ROWS; row++) {
      const spread = row > 18 ? Math.floor((row - 18) / 9) : 0; // widens as it falls
      for (let c = -spread; c < nCols + spread; c++) {
        // the lower third breaks up into droplets
        const keep = row < 26 ? 1 : 1 - (row - 26) / (ROWS - 26) * 0.95;
        if (rnd(row, c) > keep) continue;
        const out = row < 3 ? row * 0.45 + 0.5 : 1.9 + Math.min(row - 3, 10) * 0.09; // lip curve, then free fall
        const jitter = row > 26 ? (rnd(c, row + 99) - 0.5) * 1.6 : 0;
        const along = (c - nCols / 2 + 0.5) * VOXEL + jitter * VOXEL * 0.6;
        const cx = ex + nx * out * VOXEL + tx * along;
        const cz = ez + nz * out * VOXEL + tz * along;
        const cy = WATER_Y - VOXEL * 0.5 - row * VOXEL;
        const sx = row < 3 ? 1 : 0.9;
        for (let k = 0; k < boxPos.count; k++) {
          // box local (x along rim, z outward) → world
          const lx = boxPos.getX(k) * VOXEL * sx, ly = boxPos.getY(k) * VOXEL, lz = boxPos.getZ(k) * VOXEL * 0.8;
          pos.push(cx + tx * lx + nx * lz, cy + ly, cz + tz * lx + nz * lz);
          const bx = boxNor.getX(k), by = boxNor.getY(k), bz = boxNor.getZ(k);
          nor.push(tx * bx + nx * bz, by, tz * bx + nz * bz);
        }
        cells.push({ row, col: c, phase: rnd(c, 7) * 3, alpha: row < 30 ? 0.92 : 0.92 * (1 - (row - 30) / (ROWS - 30)) });
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    const color = new THREE.Float32BufferAttribute(new Float32Array(cells.length * 36 * 4), 4);
    geo.setAttribute('color', color);
    const mesh = new THREE.Mesh(geo, fallMat);
    mesh.userData.noShadow = true;
    mesh.renderOrder = 3;
    group.add(mesh);
    falls.push({ cells, color, nCols });

  });

  const FC = [col(PAL.mid), col(PAL.light), col(PAL.crest), col(PAL.foam), col(PAL.white)];
  let lastFall = -1;
  const updateFalls = (t: number) => {
    if (t - lastFall < 1 / 20) return;
    lastFall = t;
    for (const f of falls) {
      const arr = f.color.array as Float32Array;
      f.cells.forEach((cell, i) => {
        // bright bands scroll DOWN (row increases with t)
        const v = ((cell.row * 0.23 - t * 2.4 + cell.phase) % 1 + 1) % 1;
        let c = v < 0.42 ? FC[0] : v < 0.7 ? FC[1] : v < 0.88 ? FC[2] : FC[3];
        if (cell.row < 2) c = (cell.col + Math.floor(t * 6)) % 3 === 0 ? FC[4] : FC[3]; // churn at the lip
        if (cell.col < 0 || cell.col >= f.nCols) c = FC[2];
        const a = cell.alpha;
        for (let k = 0; k < 36; k++) {
          const o = (i * 36 + k) * 4;
          arr[o] = c.r; arr[o + 1] = c.g; arr[o + 2] = c.b; arr[o + 3] = a;
        }
      });
      f.color.needsUpdate = true;
    }
  };
  updateFalls(0);

  return {
    group,
    update: (t) => {
      updateWater(t);
      updateFalls(t);
    },
  };
}

