/**
 * Regenerate every authored .vox + manifest.json into public/models/vox/.
 *
 *   node lib/three/styles/vox/tools/build.mjs            # all models
 *   node lib/three/styles/vox/tools/build.mjs about tree # only these
 *
 * ⚠ Re-running OVERWRITES the .vox files of the models it builds. If you have
 * hand-edited a file in MagicaVoxel, either stop generating it (delete its
 * module from tools/models/) or only rebuild the others by name.
 *
 * Each model module exports `name` and `build()` → { assembly, origin?,
 * pivots?, glow?, hollow?, ao?, meta? }. After writing, every file is parsed
 * back with three's own VOXLoader as a validity check.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { writeVox } from './voxlib.mjs';
import { paintAssembly } from './paint.mjs';

// Landmarks + characters get the shared painted-voxel pass (tools/paint.mjs)
// and corner AO, to match the hand-shaded island/decor.
const PAINTED = new Set(['about', 'education', 'publications', 'work', 'projects', 'coursework', 'awards', 'involvement']);

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../../..');
const outDir = join(root, 'public/models/vox');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const only = process.argv.slice(2);

// Serialize concurrent builds (several agents may run this at once): take an
// exclusive lock dir, wait up to 2 min, release on exit.
import { mkdirSync as _mk, rmSync as _rm, statSync as _st } from 'node:fs';
const LOCK = join(outDir, '.buildlock');
{
  const t0 = Date.now();
  for (;;) {
    try { _mk(LOCK); break; } catch {
      try { if (Date.now() - _st(LOCK).mtimeMs > 120000) _rm(LOCK, { recursive: true, force: true }); } catch {}
      if (Date.now() - t0 > 120000) throw new Error('build lock timeout');
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200);
    }
  }
  process.on('exit', () => { try { _rm(LOCK, { recursive: true, force: true }); } catch {} });
}
const manPath = join(outDir, 'manifest.json');
const manifest = existsSync(manPath)
  ? JSON.parse(readFileSync(manPath, 'utf8'))
  : { voxel: 0.125, models: {} };

const { VOXLoader } = await import(pathToFileURL(join(root, 'node_modules/three/examples/jsm/loaders/VOXLoader.js')).href);

const mods = readdirSync(join(here, 'models')).filter((f) => f.endsWith('.mjs'));
let total = 0;
const fresh = {};
let anyFailed = false;
for (const f of mods) {
  let mod, outs;
  try {
    mod = await import(pathToFileURL(join(here, 'models', f)).href);
    outs = mod.buildAll ? mod.buildAll() : [{ name: mod.name, ...mod.build() }];
  } catch (e) {
    console.error(`!! ${f}: ${e.message} — keeping its previous manifest entry`);
    anyFailed = true;
    continue;
  }
  for (const o of outs) {
    if (PAINTED.has(o.name)) { paintAssembly(o.assembly); if (o.ao === undefined) o.ao = 0.22; }
    const file = `${o.name}.vox`;
    const entry = { file };
    if (o.origin) entry.origin = o.origin;
    if (o.pivots) entry.pivots = o.pivots;
    if (o.glow) entry.glow = Object.fromEntries(Object.entries(o.glow).map(([k, v]) => [String(k), v]));
    if (o.hollow) entry.hollow = true;
    if (o.ao !== undefined) entry.ao = o.ao;
    if (o.meta) entry.meta = o.meta;
    if (o.noMerge) entry.noMerge = o.noMerge;
    fresh[o.name] = entry;
    // only (re)write the .vox of the requested models (all when none given)
    if (only.length && !only.includes(o.name) && !only.includes(mod.name)) continue;
    const st = writeVox(join(outDir, file), o.assembly);
    const buf = readFileSync(join(outDir, file));
    const chunks = new VOXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    if (!chunks || chunks.length !== st.parts.length) throw new Error(`${file}: VOXLoader read ${chunks?.length} models, expected ${st.parts.length}`);
    total += st.bytes;
    console.log(`${file.padEnd(22)} ${String(st.bytes).padStart(8)} B  ${st.voxels} vox  [${st.parts.join(' ')}]  ✓ VOXLoader`);
  }
}
// manifest = every model module's current entry (re-derived each run, so
// concurrent/partial runs never drop another model) + stale entries kept only
// for modules that failed to load.
// If every module loaded, the manifest is EXACTLY the current set (drops
// entries for models that no longer exist).
if (!anyFailed) manifest.models = {};
for (const [k, v] of Object.entries(fresh)) if (existsSync(join(outDir, v.file))) manifest.models[k] = v;
writeFileSync(manPath, JSON.stringify(manifest, null, 1));
console.log(`wrote ${Object.keys(manifest.models).length} manifest entries; this run ${(total / 1024).toFixed(1)} KB`);
