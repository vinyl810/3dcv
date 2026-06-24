# Working notes — Daewon Kim 3D CV

Handoff for future sessions: current progress + the hard-won principles/gotchas of
this codebase. (Architecture & how-to-extend live in `README.md`.)

## What this is

Interactive pixel-art **3D CV** for Daewon Kim. **Next.js 15.5 (App Router) +
vanilla Three.js r172 (NOT react-three-fiber)**. Single page. Fixed dimetric
orthographic camera, `RenderPixelatedPass` pipeline, refined "Muted Twilight" dusk
palette. Dev server: `npm run dev` → http://localhost:3000 (LAN: 192.168.50.251).

## Current state (progress)

- **Content** (`lib/cv-data.ts`): 8 CV sections mirroring the source PDF —
  `about · education · publications · work · projects · coursework · awards ·
  involvement`. Title is **researcher-first** ("HCI / Cognitive-AI Researcher · Web
  Graphics Engineer"). `projects` + `coursework` use `groups` for labelled
  sub-sections. **GPA was removed** from Education (per user). Each `station.id`
  must match a `LANDMARKS` entry's `stationId` in `lib/three/models.ts`.
- **Scene**: floating diamond island in `lib/three/environment.ts`; 8 landmark
  meshes in `lib/three/landmarks/*` placed/scaled by `lib/three/models.ts`.
  - `about` = **standing pixel character** (holds a tablet w/ wave+neuron motif,
    waves, floating @vinyl810 holo nameplate, small lamp).
  - New meshes: `projects` (workbench), `coursework` (bookshelf), `involvement`
    (service stage). `work` = ocean monitor (scaled down to `0.85`).
  - `PROP_SCALE = 1.35` (global landmark-size knob; island unchanged).
  - **Unused builders** still in `landmarks/` but not imported: `brain`, `tarot`,
    `debate`, `music`, `lighthouse` (re-add to `LANDMARKS` to bring back).
- **Interaction**: hover tooltip + lift, click → info panel. Stable hit **proxies**
  (see principles). Bottom **dot-nav** = tappable section list.
  - **Desktop**: full-screen 3D, right-side slide panel, dot-nav bottom-right,
    mouse-wheel zoom (bonus).
  - **Mobile (≤640px)**: full-screen 3D + **pinch-zoom / drag-pan** (iso angle
    stays fixed — only zoom + pan), tap → **centered popup** (dim backdrop,
    tap-outside / X to close), dot-nav centered, **auto zoom-in to 1.5× on load**.
- Verified end-to-end via Playwright (8/8 landmarks reachable, panels/popups,
  zoom/pan, desktop+mobile). `tsc --noEmit` clean, console 0 errors.

## Principles / gotchas (learned the hard way here)

1. **`box()`/`voxel()` bake size into `mesh.scale`.** To *animate* a box's size,
   set `scale` to the **absolute** world size — NEVER divide by the baked size.
   `scale.setScalar(v/0.05)` ballooned tiny props into ~1-unit cubes (bit us 4×:
   tarot sparkles, brain EEG bars, trophy stars, projects sparkles).
   `cyl/cone/sphere/dome` bake size into **geometry** (scale=1) → `setScalar(k)` is
   a pure multiplier there.
2. **Facing:** camera looks from **+X+Y+Z**. Builders build their front toward `+Z`
   then end with **`group.rotation.y = Math.PI / 4`** so it faces the camera.
   `-Math.PI/4` turns it *edge-on* (an earlier wrong instruction broke all meshes).
3. **Never scale absolute time by hover.** `osc(t * (1 + hover), …)` jumps the phase
   hugely on hover-in/out because `t` is large → animations fast-forward/rewind.
   Keep animation rate constant; hover may change emissive/amplitude/lift only.
4. **Hover/click raycast STABLE proxies, not animated geometry** (else hover
   flickers as parts move under the cursor). Proxies = invisible **oriented boxes**
   hugging each model's rest silhouette, on **render layer 1** (camera renders only
   layer 0 → never drawn; `raycaster.layers.set(1)`). They're siblings of `root`
   under `floating` (bob with island, but don't move with per-landmark animation or
   the hover lift). Size knobs: `PROXY_PAD / PROXY_TOP / PROXY_BOTTOM` in
   `models.ts`. Tight oriented boxes (not AABBs of 45°-rotated models) avoid
   covering neighbours. A fully-occluded landmark needs *moving*, not a smaller box.
5. **Materials are module-level cached/shared** (`mat/emit/glass` in `kit.ts`). To
   animate `emissiveIntensity`, **clone the material first**, else you mutate every
   user. Don't dispose cached materials on unmount (re-mount reuses them).
6. **Pixel pipeline:** `EffectComposer → RenderPixelatedPass → OutputPass`,
   `antialias:false`, `NoToneMapping`, SRGB; ONE material type
   (`MeshToonMaterial`, flat-shaded, 4-step banded gradient); NearestFilter;
   orthographic camera. Palette = single source of truth (`P` in `kit.ts`).
7. **Camera zoom/pan** (`engine.ts`): pinch (2 pointers) + wheel set `camZoom`;
   1-finger drag pans (only when zoomed). Tap-vs-drag via `TAP_SLOP`; **select
   fires on pointer-UP** (a tap), not down. Pan moves `camera.position` along the
   constant `rightDir/upDir` (no re-`lookAt` → angle stays fixed). `applyCamera()`
   clamps pan so the island can't drift off; re-call it on resize. Mobile intro:
   `INTRO_ZOOM/DELAY/DUR`. **`setPointerCapture` can throw** (no active pointer /
   synthetic events) → wrap in try/catch or the handler aborts and taps break.
8. **Verification that worked:** drive the real browser with Playwright. For
   diagnostics, temporarily expose `window.__cv = { scene, camera, world, pick }`
   in `engine.init()`, then remove it before finishing. **Grid-scan** screen pixels
   through `__cv.pick()` to prove every landmark is reachable. Always screenshot +
   read the image to judge visuals — tsc passing ≠ it looks right.

## Visitor guestbook (Neon Postgres)

Visitors plant a glowing **firefly** on the island (color + optional ≤24-char
label) that persists for everyone — the island brightens as people leave traces.

- **DB:** Neon Postgres via `@neondatabase/serverless` (HTTP driver; the old
  `@vercel/postgres` is deprecated). ONE table `marks(id,x,z,color,label,
  ip_hash,created_at)` + one index, auto-created (`CREATE TABLE IF NOT EXISTS`).
- **Server-only** data layer `lib/marks.ts` (`import 'server-only'`); client-safe
  shared types in `lib/marks-types.ts`. Write = Server Action `app/actions.ts`
  → `plantMark`. Read = `getMarks()` cached (`unstable_cache`, revalidate 60s) so
  `/` is ISR and the DB is hit at most once/min. Rate-limit **1 / IP / hour**
  (sha256 `ip_hash`, salt `MARK_SALT`), render-cap 150. Free tier is plenty.
- **Graceful degrade:** no connection string → `dbEnabled()` false, the form
  shows "Coming soon", scene + build still work (so local dev runs before the DB).
- **3D:** `buildVisitorMarks()` in `environment.ts` renders each mark as a
  drifting/twinkling firefly under `floating`, on the **default layer** (drawn,
  not raycast → no hover interference). Placement keep-out mirrors the landmark
  xz so a firefly never lands on a landmark. UI = `TraceBox.tsx` (bottom-left).
- **To go live:** Vercel → Storage → create **Neon** Postgres (injects
  `DATABASE_URL`/`POSTGRES_URL`). Local: `vercel env pull .env.local`. The live
  DB write+render path was not testable locally (only the no-DB UI was verified).

## User preferences

- Communicates in **Korean** → respond in Korean.
- Iterates heavily on visual/UX detail; expects **visual verification (screenshots)
  before claiming done**, and likes **single tunable knobs** (`PROP_SCALE`,
  `PROXY_*`, `INTRO_*`, per-landmark `scale`/`pos`).
- Rejected a 3D-top / content-sheet split for mobile; chose **zoom + popup**. The
  iso island is width-constrained on portrait (can't grow much without clipping the
  diamond corners) → **zoom is the lever**, not bigger framing.
