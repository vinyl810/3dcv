// Debug: ASCII front view (+z looking toward -z) of one part of a model module.
import { pathToFileURL } from 'node:url';
import { G, C } from './palette.mjs';
const [modFile, partName, modelName] = process.argv.slice(2);
const mod = await import(pathToFileURL(modFile).href);
const out = modelName ? mod.buildAll().find((o) => o.name === modelName) : mod.build();
const parts = out.assembly.parts.filter((p) => !partName || partName.split(',').includes(p.name));
const g0 = parts[0].grid;
const sym = (c) => c === G.ink ? '@' : c === G.hair || c === G.hairL ? '#' : c === G.skin ? 'o' : c === G.skinM ? '.' : c === C.pink[6] ? 'p' : c === C.red[3] ? 'r' : c === C.sand[7] ? '*' : c === G.skinS ? ',' : c === C.blue[2] ? 'b' : [C.body[7], G.hairD, C.earth[3]].includes(c) ? '#' : c ? '+' : ' ';
let y0 = 1e9, y1 = -1, x0 = 1e9, x1 = -1;
for (const p of parts) p.grid.paint((x, y, z, c) => { y0 = Math.min(y0, y); y1 = Math.max(y1, y); x0 = Math.min(x0, x); x1 = Math.max(x1, x); return c; });
for (let y = y1; y >= y0; y--) {
  let row = String(y).padStart(3) + ' ';
  for (let x = x0; x <= x1; x++) {
    let best = -1, c = 0;
    for (const p of parts) for (let z = 0; z < g0.d; z++) { const v = p.grid.get(x, y, z); if (v && z > best) { best = z; c = v; } }
    row += sym(c);
  }
  console.log(row);
}
