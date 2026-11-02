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
  common.ts           → landmark scale compensation, characterModel(), glow helpers
  rig.ts              → character skeleton (one skinned mesh each), poses, hop/crouch curves
  landmarks/<id>.ts   → per-landmark animation (idle, click burst, hover, night light)
  landmarks/people.ts → the three rigged involvement people
  island.ts / ocean.ts→ terrain + merged decor + islets/birds/fireflies; lagoon + waterfalls
  tools/              → Node-only authoring scripts (NOT imported by the app)
    palette.mjs       → the ONE shared 128-colour palette (+ Emit/Glass materials)
    voxlib.mjs        → Grid/Assembly drawing helpers + .vox v150 writer/reader
    models/*.mjs      → procedural sources for every authored model (chars.mjs = characters)
    toonfolk.mjs      → the stylized character generator (15-bone rig contract)
    paint.mjs         → painted-voxel shading pass for the landmarks
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

### Painted shading (landmarks)

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

The hub Daewon and the three involvement people are stylized "toon folk",
generated by `tools/toonfolk.mjs` via `tools/models/chars.mjs` into
`about_char.vox` and `involvement_people.vox`. They have:
- simple, iconic proportions: a head about 1/3 of the height;
- rounded-box heads and torsos, chunky limbs, mitten hands and block shoes;
- a minimal face: 2×2 eyes with a highlight, blush and a tiny mouth;
- one signature detail each: a hoodie with drawstrings, a cap, or a ponytail.

Every material is hand-shaded with 3 tones, and skin only uses the light warm
shades. These models skip the `paint.mjs` pass, and their AO is a soft 0.1, so
faces never go dark.

**Resolution:** characters are authored at `CHAR_RES = 2` times the landmark
density (`assets.ts`: 0.0625 world units per voxel instead of 0.125), with
deliberately simple shapes so the finer grain still matches the world.
Their coordinates are exactly 2× the parent landmark's (a coarse cell centre c
maps to fine 2c + 0.5), so `characterModel()` drops them into the landmark's
rotated group at `landmarkVoxel / CHAR_RES`. Keep `CHAR_RES` in
`tools/models/chars.mjs` in sync with `assets.ts`.

**Rig:** each character is 15 named objects (bones). The involvement people use
the prefixes `p0_`, `p1_` and `p2_`.
- `hips → torso → head`
- `torso → upperArm{L,R} → forearm{L,R} → hand{L,R}`
- `hips → thigh{L,R} → shin{L,R} → foot{L,R}`

L is the character's left, which is +x.

Every limb segment starts with a rounded joint cap centred exactly on its
pivot, so bends never open gaps. At runtime `rig.ts` merges a character's 15
parts into ONE rigidly-skinned `SkinnedMesh` with nested bones, so each
character is a single draw call. Poses are joint rotations clamped to natural
ranges: knees only bend backward, elbows only forward. `crouch()` and
`legBend()` keep the feet planted, and `hopCurve()` gives the anticipation →
jump → landing timeline. The idle has a light, playful bob.

If you edit a body part in MagicaVoxel, keep its object name; the pivots are
in `manifest.json`. The hub's tablet is a separate part of `about.vox` that is
parented to the right hand at runtime.

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
