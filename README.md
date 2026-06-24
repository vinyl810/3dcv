# Daewon Kim — Interactive 3D CV

An interactive, single-page **pixel-art 3D résumé** built with **Next.js** and **Three.js**.

The CV is presented as a floating isometric voxel island — *"Daewon's Drifting
Archipelago"* — viewed through a **fixed orthographic camera**. Ten themed
landmarks fan out around a central hub desk, each mapping to a section of the CV.
**Hover** a landmark for a label, **click** it to slide open an info panel with the
details. The whole scene is rendered through Three.js's `RenderPixelatedPass` for a
crisp, consistent pixel-art look.

## Highlights

- **Fixed isometric camera** — no orbit; the diorama is composed to read from one angle.
- **Consistent pixel aesthetic** — `EffectComposer → RenderPixelatedPass → OutputPass`,
  a single flat-shaded `MeshToonMaterial` palette, nearest-filter textures, and
  antialiasing disabled so the pixel grid never smears.
- **All geometry is procedural** — every model is built from boxes/cylinders/cones via a
  shared voxel toolkit. No external GLTF assets to load or break.
- **Single page** — one route; info is revealed through an HTML overlay while the 3D
  scene stays put behind it.
- **Mobile-first** — the orthographic frustum re-fits so the whole island stays visible
  from ultrawide down to portrait phones; taps are forgiving (screen-space nearest-landmark
  assist), the bottom **dot row doubles as a tappable section nav**, the panel goes
  full-screen with momentum scroll, notch/home-indicator safe-areas are respected, and the
  render loop pauses when the tab is backgrounded.

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
# production
npm run build && npm start
```

Requires Node 20+.

## How it's wired

```
app/
  layout.tsx          # metadata, fonts, global styles
  page.tsx            # renders <Experience/>
  globals.css         # pixel fonts + base styling
components/
  Experience.tsx      # owns React state (hover / selected), composes canvas + overlay
  SceneCanvas.tsx     # mounts the Three.js engine (dynamic import → no three in SSR bundle)
  Overlay.tsx         # identity card, hover tooltip, info panel, progress dots
  ui.module.css       # pixel-art HUD styling
lib/
  cv-data.ts          # ALL CV content, structured into 8 CV-section "stations"
                      # (big sections use `groups` for labelled sub-sections)
  three/
    kit.ts            # shared palette + materials + voxel/box/cyl/cone helpers
    engine.ts         # renderer, fixed ortho camera, pixel pass, raycasting, RAF loop
    environment.ts    # sky gradient, animated ocean + waterfalls, island, trees, lights
    models.ts         # buildWorld(): places landmarks, cables, island bob, disposal
    landmarks/        # one self-contained builder per landmark (hub, monitor, brain, …)
```

The React layer never touches WebGL directly: `engine.ts` exposes `onHover` /
`onSelect` / `onReady` callbacks, and `Experience` drives the overlay from those.

### Landmark ↔ CV section

The 8 landmarks mirror a standard (research-style) CV. The two large sections —
**Projects** and **Coursework** — use `groups` to split into labelled sub-sections.

| Landmark            | Station id     | CV section                                          |
| ------------------- | -------------- | --------------------------------------------------- |
| Hub desk + avatar   | `about`        | About / contact (researcher-first title)            |
| Graduation cap      | `education`    | Education (KAIST M.S. / B.S. / high school)          |
| Lectern + papers    | `publications` | Publications                                        |
| Ocean monitor       | `work`         | Work Experience (KOAST)                             |
| Workbench           | `projects`     | Projects (HCI/AI · Neuro/Vision · GIS · early)       |
| Bookshelf           | `coursework`   | Related Coursework (CT · CS · Bioeng.)              |
| Trophy + banner     | `awards`       | Awards & Honors                                     |
| Service stage       | `involvement`  | Involvement & Service                               |

> The earlier project-specific meshes (`brain`, `tarot`, `debate`, `music`,
> `lighthouse`) are no longer placed in the scene; their files remain under
> `landmarks/` and can be re-added to the `LANDMARKS` table at any time.

## Extending it

- **Edit CV content:** everything is in `lib/cv-data.ts`. Each `station.id` must match a
  landmark's `stationId` in `lib/three/models.ts`.
- **Add a landmark:** write `lib/three/landmarks/<id>.ts` returning a `BuiltModel`
  (`{ group, update }`) built at local origin facing the camera with
  `group.rotation.y = Math.PI / 4`, then register it (build fn + world position) in the
  `LANDMARKS` table in `models.ts`, and add a matching station in `cv-data.ts`.
- **Tune the look:** palette and materials live in `lib/three/kit.ts`; pixel size,
  camera framing, and edge strengths live in `lib/three/engine.ts`.

> Note: the `box()` / `voxel()` helpers bake size into `mesh.scale`. To animate a box's
> size, set `scale` to the **absolute** world size (not a ratio). `cyl/cone/sphere` bake
> size into geometry, so for those `scale.setScalar(k)` is a pure multiplier.

---

Built with Next.js 15, React 19, Three.js r172.
