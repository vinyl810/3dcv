# `vox` style — MagicaVoxel asset pipeline

Every model in this style is a plain **MagicaVoxel `.vox` file** in
`public/models/vox/`. Open one in MagicaVoxel, edit, save, reload the page.

```
?style=vox            → this style
public/models/vox/    → the .vox assets + manifest.json (what the app loads)
lib/three/styles/vox/
  index.ts            → StyleSet (preload → landmarks → island → ocean)
  voxfile.ts          → .vox parser (SIZE/XYZI/RGBA/MATL/nTRN/nGRP/nSHP) + mesher
  assets.ts           → fetch + cache + instantiate(); VOXEL = 0.125 world units
  common.ts           → landmark scale compensation, glow helpers
  landmarks/<id>.ts   → per-landmark animation (idle, click burst, hover, night light)
  island.ts / ocean.ts→ terrain + merged decor + islets/birds/fireflies; lagoon + waterfalls
  tools/              → Node-only authoring scripts (NOT imported by the app)
    palette.mjs       → the ONE shared 128-colour palette (+ Emit/Glass materials)
    voxlib.mjs        → Grid/Assembly drawing helpers + .vox v150 writer/reader
    models/*.mjs      → procedural sources for every authored model
    build.mjs         → regenerate .vox + manifest.json, validate with three's VOXLoader
    cc0/              → untouched third-party CC0 source files (see Credits)
```

## How it renders

* `preload()` fetches `manifest.json` and every `.vox` it lists, in parallel.
* Each file is parsed by our own reader (three's `VOXLoader` ignores the scene
  graph and materials). Every **named object** in the MagicaVoxel scene becomes
  its own mesh/pivot so it can animate (character head/arms, cap, tassel, cup,
  medals, books, people…).
* Meshing: exposed faces only, greedy-merged where colour + corner-AO match,
  vertex colours from the palette × soft corner ambient occlusion, ONE shared
  `MeshToonMaterial({ vertexColors, gradientMap: GRADIENT, flatShading })` — so the
  pixel pass, banded toon light and shadows apply exactly like the rest of the scene.
* **One on-screen voxel size everywhere:** landmark roots are scaled by
  `slot.scale × 1.35` in `models.ts`, so landmark geometry is built at
  `VOXEL / (slot.scale × 1.35)`; island/decor at `VOXEL`.
* Static decor (trees, bushes, rocks, flowers, lamps, tufts) is merged into one
  lit mesh + one mesh per glow colour → the whole style draws ~110 meshes
  (~340 draw calls/frame including the shadow + normal passes; classic ≈ 2500).

## Editing a model in MagicaVoxel

1. Open `public/models/vox/<name>.vox` (MagicaVoxel 0.99+).
2. **Front = MagicaVoxel's -Y** (its default front view). Up = +Z. The app maps
   MV `(x, y, z)` → three `(x, z, -y)` and turns every landmark 45° to face the camera.
3. **Keep object names.** Each object (`nTRN` name) is a part the code animates
   by name — e.g. `about`: `deck body head armR armL plate`. Unnamed / renamed
   parts still render, they just stop animating. You may move objects
   (translation is honoured); **rotations are ignored** — don't rotate objects.
4. **Keep the palette.** All files share `tools/palette.mjs` (rows of 8 =
   dark→light hue-shifted ramps). Colour indices **113–120 are Emit** (lamp, hot
   white, screen cyan, screen highlight, pink, violet, gold, green glow) and
   **121–124 are Glass**. In MV you can also set any index's material to *Emit*
   or *Glass* yourself — the app reads `MATL` chunks, so whatever MV shows as
   emissive glows in the scene (strength per index can be tuned in
   `manifest.json → glow`).
5. Save, then reload the page (hard-reload if the browser cached the file).

**Pivots / origins** live in `manifest.json` per model, in *author voxel
coordinates* (x = MV x, y = MV z, z = −MV y): `pivots.<part>` is the point a part
rotates around (`"center" | "bottom" | "top"` or `[x, y, z]`), `origin` is the
point that sits on the landmark slot (base centre, y = 0 = ground), `meta` holds
named points the code uses (e.g. `about.meta.lamp` = night-light position,
`island.meta.falls` = waterfall spill points). If you move an animated part in
MV, move its pivot too.

**⚠ Regenerating overwrites.** `node lib/three/styles/vox/tools/build.mjs`
rewrites every authored `.vox` from `tools/models/*.mjs`. After hand-editing a
file, either delete its generator module (the manifest entry is kept) or only
rebuild others by name: `node lib/three/styles/vox/tools/build.mjs awards decor`.

### Painted shading (landmarks + characters)

`build.mjs` runs `tools/paint.mjs` on the 8 landmark models and gives them corner
AO 0.22, matching the island. It shifts each voxel along its own palette ramp:
- a per-part fake light (up, +x, +z), with rims on lit top edges and darker undersides;
- material texture: wood grain, fabric folds on clothing and banner parts only,
  metallic gold rims and streaks, hair strands, and stone grit;
- voxels with at most 1 same-colour neighbour (eyes, letters, trims) keep their
  exact colour.

If you hand-paint a landmark in MagicaVoxel and want to keep your shading,
remove it from the `PAINTED` set in `build.mjs`.

### Characters (rigged humanoids)

**Variants:** `?char=a|b|cur` (read only in `chars.ts`; default **b**) picks the character set.
- `a`: stylized "toon folk" (`tools/toonfolk.mjs`) at the landmark grain (0.125).
- `b`: the same stylized design at 0.0625, with deliberately simple shapes.
- `cur`: the earlier semi-realistic figures (`tools/humanoid.mjs`, 0.0625).

All character models are generated by `tools/models/chars.mjs`
(`about_char{_a,_b,}`, `involvement_people{_a,_b,}`). The toon variants are
hand-shaded with 3 tones per material and skip the painter pass, so faces stay
light. They also get a bouncier idle.


**Resolution:** characters are authored at `CHAR_RES = 2` times the landmark voxel density
(`assets.ts`; 0.0625 world units per voxel instead of 0.125) in their own files,
`about_char.vox` and `involvement_people.vox`. Their coordinates are exactly
2× the parent landmark's (coarse cell centre c → fine 2c + 0.5), so
`characterModel()` drops them into the landmark's rotated group at
`landmarkVoxel / CHAR_RES`. The extra voxels hold the face: 2×3 eyes with a
catch-light, brows, a nose shade, a smile, cheeks and ears. They also hold
5-shade strand hair, hoodie seams, a pocket and drawstrings, jeans seams, and
shoes with soles. Keep `CHAR_RES` in `tools/models/{about,involvement}.mjs` in sync.


The hub Daewon and the three involvement people come from ONE generator,
`tools/humanoid.mjs`. Each is 15 named objects (bones), with optional prefix
`p0_`, `p1_` and so on:
`hips → torso → head`, `torso → upperArm{L,R} → forearm{L,R} → hand{L,R}`,
`hips → thigh{L,R} → shin{L,R} → foot{L,R}` (L = the character's left = +x).
Every limb segment starts with a rounded joint cap centred exactly on its
pivot, so bends never open gaps. At runtime `rig.ts` merges a character's 15
parts into ONE rigidly-skinned `SkinnedMesh`, so each character is one draw
call, with nested bones. Poses are joint rotations clamped to natural ranges:
knees only bend backward and elbows only forward. `crouch()` / `legBend()`
keep the feet planted, and `hopCurve()` gives the
anticipation → jump → landing timeline. If you edit a body part in MagicaVoxel,
keep its object name; the pivots are in `manifest.json`.

### Island specifics

* `island.vox` = parts `terrain` (stored as a thin hollow shell — the mesher
  flood-fills the outside and only draws outward faces), `water` (the lagoon
  surface; owned by `ocean.ts`, which shimmers each voxel face through 5
  quantised water colours, so keep it one voxel thick) and `crystals` (emissive
  glints in the underside).
* The grass top must stay flat at **world y = 0.5** (voxel layer 62 with origin
  y = 59) over at least |x|,|z| ≤ 6.5 — landmarks and visitor fireflies sit there.
  The build prints the grass radius on the diagonal as a check.
* Waterfalls are code: narrow 1-voxel ribbons that spill from the rim notches
  listed in `island.meta.falls`, scroll bright bands downward and break into
  fading droplets (no wall planes).
* Decor props are parts of `decor.vox` / `cc0trees.vox`; their placement is the
  `SPOTS` list in `island.ts` (snapped to the voxel grid, rotations in 90° steps).
  Lamps listed in `LIGHTS` also get a real night `PointLight` (≤ 4).

## Credits & licences

* `cc0trees.vox` parts **oak** and **pine_tall** are recoloured from
  **padadu — "Voxel Pack 02 - Nature"** (`huge_tree_32.vox`, `tree1_32.vox`),
  <https://padadu.itch.io/voxel-pack-02-nature>, licensed **Creative Commons
  Zero v1.0 Universal (CC0)** per that page. Originals are kept unmodified in
  `tools/cc0/`. (Credit appreciated by the author, not required.)
* Everything else (8 landmarks, terrain, decor, bird, palette) was authored for
  this project by the generator scripts in `tools/models/`.
