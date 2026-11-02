/**
 * Tiny MagicaVoxel (.vox v150) authoring library — Node only, NOT imported by
 * the app. Models are authored in a Y-UP space that matches three.js:
 *   x → right, y → up, z → toward the viewer (the model's FRONT faces +z).
 * On write we convert to MagicaVoxel's Z-up space: vox = (x, -z, y), so in
 * MagicaVoxel the front of every model faces -Y (MV's "front" view).
 *
 * A file = an ASSEMBLY of named PARTS (one MV model each) placed with a proper
 * scene graph (nTRN → nGRP → nTRN/nSHP per part), so opening the file in
 * MagicaVoxel shows the whole landmark assembled, with every animated part as
 * its own named object you can select and edit.
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { PALETTE, MATERIALS } from './palette.mjs';

/** Deterministic hash → [0,1). */
export function hash(x, y = 0, z = 0, s = 0) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647 + s * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return ((h >>> 0) % 100000) / 100000;
}

/** Dense voxel grid in Y-up author space. Value 0 = empty, 1..255 = palette index. */
export class Grid {
  constructor(w, h, d) {
    this.w = w; this.h = h; this.d = d;
    this.v = new Uint8Array(w * h * d);
  }
  idx(x, y, z) { return x + this.w * (z + this.d * y); }
  inside(x, y, z) {
    return x >= 0 && y >= 0 && z >= 0 && x < this.w && y < this.h && z < this.d;
  }
  get(x, y, z) {
    x = Math.round(x); y = Math.round(y); z = Math.round(z);
    return this.inside(x, y, z) ? this.v[this.idx(x, y, z)] : 0;
  }
  set(x, y, z, c) {
    x = Math.round(x); y = Math.round(y); z = Math.round(z);
    if (this.inside(x, y, z)) this.v[this.idx(x, y, z)] = c;
    return this;
  }
  /** Inclusive axis-aligned box (corner order doesn't matter). c may be fn(x,y,z). */
  box(x0, y0, z0, x1, y1, z1, c) {
    const [ax, bx] = x0 < x1 ? [x0, x1] : [x1, x0];
    const [ay, by] = y0 < y1 ? [y0, y1] : [y1, y0];
    const [az, bz] = z0 < z1 ? [z0, z1] : [z1, z0];
    for (let y = ay; y <= by; y++)
      for (let z = az; z <= bz; z++)
        for (let x = ax; x <= bx; x++) this.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c);
    return this;
  }
  /** Hollow-able box outline helper: only the 12 edges. */
  frame(x0, y0, z0, x1, y1, z1, c) {
    for (let x = x0; x <= x1; x++) for (const y of [y0, y1]) for (const z of [z0, z1]) this.set(x, y, z, c);
    for (let y = y0; y <= y1; y++) for (const x of [x0, x1]) for (const z of [z0, z1]) this.set(x, y, z, c);
    for (let z = z0; z <= z1; z++) for (const x of [x0, x1]) for (const y of [y0, y1]) this.set(x, y, z, c);
    return this;
  }
  /** Filled ellipsoid centred at (cx,cy,cz) with radii (rx,ry,rz). */
  ellipsoid(cx, cy, cz, rx, ry, rz, c) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++)
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const q = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2;
          if (q <= 1) this.set(x, y, z, typeof c === 'function' ? c(x, y, z, q) : c);
        }
    return this;
  }
  sphere(cx, cy, cz, r, c) { return this.ellipsoid(cx, cy, cz, r, r, r, c); }
  /** Vertical cylinder (axis = y) from y0..y1, centred at (cx, cz). */
  cylY(cx, cz, y0, y1, r, c, rz = r) {
    for (let y = y0; y <= y1; y++)
      for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++)
        for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
          if (((x - cx) / r) ** 2 + ((z - cz) / rz) ** 2 <= 1)
            this.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c);
    return this;
  }
  /** Cylinder along z (axis toward the viewer), e.g. discs/medals/wheels. */
  cylZ(cx, cy, z0, z1, r, c) {
    for (let z = z0; z <= z1; z++)
      for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
        for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
          if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) this.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c);
    return this;
  }
  /** Cylinder along x. */
  cylX(cy, cz, x0, x1, r, c) {
    for (let x = x0; x <= x1; x++)
      for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
        for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++)
          if ((z - cz) ** 2 + (y - cy) ** 2 <= r * r) this.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c);
    return this;
  }
  /** Re-colour every filled voxel: fn(x,y,z,c) → new c (0 erases). */
  paint(fn) {
    for (let y = 0; y < this.h; y++)
      for (let z = 0; z < this.d; z++)
        for (let x = 0; x < this.w; x++) {
          const i = this.idx(x, y, z);
          const c = this.v[i];
          if (c) this.v[i] = fn(x, y, z, c);
        }
    return this;
  }
  /** Is (x,y,z) filled and is the voxel above it empty? (top surface) */
  isTop(x, y, z) { return this.get(x, y, z) && !this.get(x, y + 1, z); }
  count() { let n = 0; for (const c of this.v) if (c) n++; return n; }
  /** Stamp another grid into this one at offset (ox,oy,oz). */
  stamp(g, ox, oy, oz) {
    for (let y = 0; y < g.h; y++)
      for (let z = 0; z < g.d; z++)
        for (let x = 0; x < g.w; x++) {
          const c = g.v[g.idx(x, y, z)];
          if (c) this.set(x + ox, y + oy, z + oz, c);
        }
    return this;
  }
  /** Shrink to the occupied bounds; returns { grid, ox, oy, oz } (offset of the crop). */
  cropped() {
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -1, y1 = -1, z1 = -1;
    for (let y = 0; y < this.h; y++)
      for (let z = 0; z < this.d; z++)
        for (let x = 0; x < this.w; x++)
          if (this.v[this.idx(x, y, z)]) {
            if (x < x0) x0 = x; if (y < y0) y0 = y; if (z < z0) z0 = z;
            if (x > x1) x1 = x; if (y > y1) y1 = y; if (z > z1) z1 = z;
          }
    if (x1 < 0) return { grid: new Grid(1, 1, 1), ox: 0, oy: 0, oz: 0 };
    const g = new Grid(x1 - x0 + 1, y1 - y0 + 1, z1 - z0 + 1);
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++)
        for (let x = x0; x <= x1; x++) g.v[g.idx(x - x0, y - y0, z - z0)] = this.v[this.idx(x, y, z)];
    return { grid: g, ox: x0, oy: y0, oz: z0 };
  }
}

/**
 * Assembly: several named parts sharing ONE author coordinate space. Draw each
 * part in its own full-size Grid (same w/h/d as the assembly) — the writer crops
 * each to its occupied bounds and records where it sits.
 */
export class Assembly {
  constructor(w, h, d) { this.w = w; this.h = h; this.d = d; this.parts = []; }
  part(name) {
    const g = new Grid(this.w, this.h, this.d);
    this.parts.push({ name, grid: g });
    return g;
  }
}

// ---------------------------------------------------------------- writer ---

class Buf {
  constructor() { this.a = []; }
  i32(v) { const b = Buffer.alloc(4); b.writeInt32LE(v); this.a.push(b); }
  u8s(arr) { this.a.push(Buffer.from(arr)); }
  str(s) { const b = Buffer.from(s, 'utf8'); this.i32(b.length); this.a.push(b); }
  dict(o) { const e = Object.entries(o); this.i32(e.length); for (const [k, v] of e) { this.str(k); this.str(String(v)); } }
  bytes() { return Buffer.concat(this.a); }
}

function chunk(id, content, children = Buffer.alloc(0)) {
  const head = Buffer.alloc(12);
  head.write(id, 0, 'ascii');
  head.writeInt32LE(content.length, 4);
  head.writeInt32LE(children.length, 8);
  return Buffer.concat([head, content, children]);
}

/**
 * Write an assembly to a .vox file. Returns stats.
 * Author (x,y,z) → vox (x, -z, y). Each part is cropped; its MV transform
 * translation = min corner + floor(size/2) (MagicaVoxel centres models on _t).
 */
export function writeVox(path, asm) {
  const models = [];
  for (const p of asm.parts) {
    const { grid, ox, oy, oz } = p.grid.cropped();
    if (!grid.count()) continue;
    // vox-space size
    const sx = grid.w, sy = grid.d, sz = grid.h;
    const xyzi = [];
    for (let y = 0; y < grid.h; y++)
      for (let z = 0; z < grid.d; z++)
        for (let x = 0; x < grid.w; x++) {
          const c = grid.v[grid.idx(x, y, z)];
          if (c) xyzi.push(x, grid.d - 1 - z, y, c);
        }
    // world-space (vox) min corner of this model
    const minX = ox, minY = -(oz + grid.d - 1), minZ = oy;
    const t = [minX + Math.floor(sx / 2), minY + Math.floor(sy / 2), minZ + Math.floor(sz / 2)];
    models.push({ name: p.name, sx, sy, sz, xyzi, t, n: xyzi.length / 4 });
  }

  const parts = [];
  for (const m of models) {
    const s = new Buf(); s.i32(m.sx); s.i32(m.sy); s.i32(m.sz);
    parts.push(chunk('SIZE', s.bytes()));
    const v = new Buf(); v.i32(m.n); v.u8s(m.xyzi);
    parts.push(chunk('XYZI', v.bytes()));
  }
  // scene graph: 0 root nTRN → 1 nGRP → (2+2i nTRN → 3+2i nSHP → model i)
  {
    const b = new Buf(); b.i32(0); b.dict({}); b.i32(1); b.i32(-1); b.i32(-1); b.i32(1); b.dict({});
    parts.push(chunk('nTRN', b.bytes()));
    const g = new Buf(); g.i32(1); g.dict({}); g.i32(models.length);
    models.forEach((_, i) => g.i32(2 + 2 * i));
    parts.push(chunk('nGRP', g.bytes()));
    models.forEach((m, i) => {
      const t = new Buf(); t.i32(2 + 2 * i); t.dict({ _name: m.name }); t.i32(3 + 2 * i); t.i32(-1); t.i32(0);
      t.i32(1); t.dict({ _t: `${m.t[0]} ${m.t[1]} ${m.t[2]}` });
      parts.push(chunk('nTRN', t.bytes()));
      const s = new Buf(); s.i32(3 + 2 * i); s.dict({}); s.i32(1); s.i32(i); s.dict({});
      parts.push(chunk('nSHP', s.bytes()));
    });
  }
  for (let l = 0; l < 8; l++) {
    const b = new Buf(); b.i32(l); b.dict({}); b.i32(-1);
    parts.push(chunk('LAYR', b.bytes()));
  }
  // RGBA: entry k ↔ colour index k+1
  {
    const b = Buffer.alloc(256 * 4);
    for (let k = 0; k < 256; k++) {
      const hex = PALETTE[k + 1] ?? 0;
      b[k * 4] = (hex >> 16) & 255; b[k * 4 + 1] = (hex >> 8) & 255; b[k * 4 + 2] = hex & 255; b[k * 4 + 3] = 255;
    }
    parts.push(chunk('RGBA', b));
  }
  for (const [id, props] of MATERIALS) {
    const b = new Buf(); b.i32(id); b.dict(props);
    parts.push(chunk('MATL', b.bytes()));
  }
  const children = Buffer.concat(parts);
  const head = Buffer.alloc(8);
  head.write('VOX ', 0, 'ascii');
  head.writeInt32LE(150, 4);
  const file = Buffer.concat([head, chunk('MAIN', Buffer.alloc(0), children)]);
  writeFileSync(path, file);
  return { bytes: file.length, parts: models.map((m) => `${m.name}:${m.n}`), voxels: models.reduce((a, m) => a + m.n, 0) };
}

/**
 * Read the FIRST model of a .vox file into a Y-up author Grid (palette ignored —
 * returns the raw colour indices). Used to import third-party CC0 models, which
 * we then recolour into our palette.
 */
export function readVoxGrid(path) {
  const b = readFileSync(path);
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let o = 20, size = null, data = null;
  while (o + 12 <= b.length) {
    const id = b.toString('ascii', o, o + 4);
    const n = dv.getInt32(o + 4, true), k = dv.getInt32(o + 8, true);
    if (id === 'SIZE' && !size) size = [dv.getInt32(o + 12, true), dv.getInt32(o + 16, true), dv.getInt32(o + 20, true)];
    if (id === 'XYZI' && !data) { const c = dv.getInt32(o + 12, true); data = b.subarray(o + 16, o + 16 + c * 4); }
    o += 12 + n + k;
  }
  const [sx, sy, sz] = size;
  const g = new Grid(sx, sz, sy);
  for (let i = 0; i < data.length; i += 4) g.set(data[i], data[i + 2], sy - 1 - data[i + 1], data[i + 3]);
  return g;
}
