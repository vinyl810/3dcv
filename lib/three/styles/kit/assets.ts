import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GRADIENT, color } from '../../kit';
import { MAT_MAP, K } from './palette';

/**
 * CC0 glTF asset cache for the 'kit' style (Kenney packs, see
 * public/models/kit/CREDITS.md). preloadKit() fetches every .glb once,
 * converts ALL materials to the pipeline's single material type
 * (MeshToonMaterial + GRADIENT, flat-shaded, palette-remapped, Nearest
 * textures) and records a normalising offset so every piece() comes back with
 * its base centred on the local origin at y=0.
 */

const BASE = '/models/kit/';

export const ASSETS = [
  // nature kit
  'nature/tree_oak', 'nature/tree_default', 'nature/tree_detailed', 'nature/tree_fat',
  'nature/tree_pineRoundA', 'nature/tree_pineRoundC', 'nature/tree_pineSmallA', 'nature/tree_cone',
  'nature/plant_bush', 'nature/plant_bushDetailed', 'nature/plant_bushLarge', 'nature/plant_bushSmall',
  'nature/flower_purpleA', 'nature/flower_redA', 'nature/flower_yellowA', 'nature/flower_purpleB',
  'nature/grass', 'nature/grass_large', 'nature/mushroom_redGroup', 'nature/mushroom_tanGroup',
  'nature/stone_smallA', 'nature/stone_smallC',
  'nature/stone_tallA', 'nature/stone_tallB', 'nature/statue_column',
  'nature/statue_obelisk', 'nature/stump_round', 'nature/log_stack',
  'nature/fence_simple', 'nature/campfire_stones',
  'nature/lily_large', 'nature/hanging_moss', 'nature/pot_large',
  // furniture kit
  'furniture/bookcaseOpen', 'furniture/books', 'furniture/desk',
  'furniture/chairDesk', 'furniture/computerKeyboard', 'furniture/laptop',
  'furniture/table', 'furniture/sideTable', 'furniture/cardboardBoxOpen', 'furniture/cardboardBoxClosed',
  'furniture/lampRoundFloor', 'furniture/plantSmall1', 'furniture/pottedPlant', 'furniture/radio',
  'furniture/rugRound', 'furniture/stoolBar',
    // Quaternius people (CC0, natural proportions, skinned + animated)
  'people/hoodie', 'people/casual', 'people/man',
  // fantasy town kit
  'town/lantern', 'town/stall-red', 'town/banner-green', 'town/rock-wide',
] as const;

export type AssetName = (typeof ASSETS)[number];

interface Entry {
  scene: THREE.Group;
  /** translation that puts the bbox bottom-centre on the origin */
  offset: THREE.Vector3;
  size: THREE.Vector3;
  clips: THREE.AnimationClip[];
  skinned: boolean;
}

const cache = new Map<string, Entry>();
const matCache = new Map<string, THREE.MeshToonMaterial>();
let loading: Promise<void> | null = null;
const MAP_KEYS: Record<string, unknown> = MAT_MAP;

function toonFor(src: THREE.Material): THREE.MeshToonMaterial {
  const s = src as THREE.MeshStandardMaterial;
  const map = s.map ?? null;
  const known = s.name in MAP_KEYS;
  const key =
    (map ? `tex:${map.uuid}:${s.name}` : `n:${s.name}`) +
    `:${s.side}` +
    (known || map ? '' : `:${s.color.getHexString()}`);
  let m = matCache.get(key);
  if (m) return m;
  if (map) {
    map.magFilter = THREE.NearestFilter;
    map.minFilter = THREE.NearestFilter;
    map.generateMipmaps = false;
    map.colorSpace = THREE.SRGBColorSpace;
    map.needsUpdate = true;
  }
  // Unknown names (e.g. the Quaternius people) keep their own colour; they're
  // re-coloured per instance by character({ colors }).
  const hex = map ? 0xffffff : (MAT_MAP[s.name] ?? -1);
  const translucent = s.transparent || (s.opacity ?? 1) < 1 || s.name === 'Water';
  m = new THREE.MeshToonMaterial({
    color: map ? color(0xffffff) : hex >= 0 ? color(hex) : s.color.clone(),
    map,
    gradientMap: GRADIENT,
    side: s.side,
  });
  if (s.name === 'Water') {
    m.map = null;
    m.color = color(K.cyan);
  }
  if (translucent) {
    m.transparent = true;
    m.opacity = 0.75;
    m.depthWrite = false;
  }
  (m as THREE.Material as { flatShading?: boolean }).flatShading = true;
  m.name = `kit:${s.name}`;
  matCache.set(key, m);
  return m;
}

function prepare(gltf: GLTF): Entry {
  const scene = gltf.scene;
  let skinned = false;
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) skinned = true;
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map(toonFor)
      : toonFor(mesh.material);
  });
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  const offset = new THREE.Vector3(
    -(box.min.x + box.max.x) / 2,
    -box.min.y,
    -(box.min.z + box.max.z) / 2,
  );
  return { scene, offset, size, clips: gltf.animations, skinned };
}

export function preloadKit(): Promise<void> {
  if (loading) return loading;
  const loader = new GLTFLoader();
  loading = Promise.all(
    ASSETS.map((name) =>
      loader.loadAsync(`${BASE}${name}.glb`).then((g) => {
        cache.set(name, prepare(g));
      }),
    ),
  ).then(() => undefined);
  return loading;
}

function entry(name: AssetName): Entry {
  const e = cache.get(name);
  if (!e) throw new Error(`kit asset not preloaded: ${name}`);
  return e;
}

/** Natural (unscaled) size of an asset's bounding box. */
export function assetSize(name: AssetName): THREE.Vector3 {
  return entry(name).size;
}

export interface PieceOpts {
  /** uniform scale (default 1) */
  s?: number;
  /** scale so the piece is this tall (overrides s) */
  h?: number;
  /** scale so the piece's larger footprint side is this wide (overrides s) */
  w?: number;
  x?: number;
  y?: number;
  z?: number;
  /** yaw (radians) */
  ry?: number;
  /** extra non-uniform stretch applied after the uniform scale */
  sx?: number;
  sy?: number;
  sz?: number;
  /** keep the asset's own origin instead of base-centring it */
  raw?: boolean;
}

/**
 * Clone a static piece. Returns a Group whose origin is the asset's
 * bottom-centre (unless raw). Geometry + materials are shared with the cache —
 * call ownMaterials() before animating colours.
 */
export function piece(name: AssetName, o: PieceOpts = {}, parent?: THREE.Object3D): THREE.Group {
  const e = entry(name);
  const inner = e.skinned ? (SkeletonUtils.clone(e.scene) as THREE.Group) : e.scene.clone(true);
  if (!o.raw) inner.position.copy(e.offset);
  const g = new THREE.Group();
  g.name = name;
  g.add(inner);
  let s = o.s ?? 1;
  if (o.h !== undefined) s = o.h / Math.max(1e-4, e.size.y);
  if (o.w !== undefined) s = o.w / Math.max(1e-4, Math.max(e.size.x, e.size.z));
  g.scale.set(s * (o.sx ?? 1), s * (o.sy ?? 1), s * (o.sz ?? 1));
  g.position.set(o.x ?? 0, o.y ?? 0, o.z ?? 0);
  g.rotation.y = o.ry ?? 0;
  parent?.add(g);
  return g;
}

/**
 * Give a sub-tree its own copies of the (shared, cached) materials so they can
 * be animated (emissive hover glow etc.) without touching other users. Returns
 * the unique cloned materials.
 */
export function ownMaterials(root: THREE.Object3D): THREE.MeshToonMaterial[] {
  const map = new Map<THREE.Material, THREE.MeshToonMaterial>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const swap = (m: THREE.Material) => {
      if (m.userData.owned) return m; // already private (animated by its builder)
      let c = map.get(m);
      if (!c) {
        c = (m as THREE.MeshToonMaterial).clone();
        map.set(m, c);
      }
      return c;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
  });
  return [...map.values()];
}

/** Clone a material for private animation and flag it so ownMaterials() keeps it. */
export function own<M extends THREE.Material>(m: M): M {
  const c = m.clone() as M;
  c.userData.owned = true;
  return c;
}

/**
 * Hover glow helper: brightens a landmark's own materials PROPORTIONALLY
 * (emissive = albedo × k; textured mats use their map as emissiveMap) so darks
 * stay dark instead of washing grey. Pure function of `hover` (no time scaling).
 */
export function makeHoverGlow(root: THREE.Object3D, strength = 0.35): (hover: number) => void {
  const mats = ownMaterials(root).filter((m) => {
    const e = m.emissive;
    return e.r + e.g + e.b < 0.01 && !m.transparent; // leave glowing parts alone
  });
  for (const m of mats) if (m.map) m.emissiveMap = m.map;
  let last = -1;
  return (hover: number) => {
    const k = Math.round(hover * 50) / 50;
    if (k === last) return;
    last = k;
    for (const m of mats) m.emissive.copy(m.color).multiplyScalar(k * strength);
  };
}

/* ------------------------------------------------------------ characters */

export interface KitCharacter {
  group: THREE.Group;
  /** The skinned scene root (bones are found by name under it). */
  rig: THREE.Object3D;
  /** Crossfade to a looping clip. */
  loop: (clip: string, fade?: number) => void;
  /** Play a clip once, then fall back to the current loop. */
  once: (clip: string, fade?: number) => void;
  /** Advance the mixer from ABSOLUTE time t (dt derived + clamped). */
  update: (t: number) => void;
  /** True while a one-shot clip (once()) is playing. */
  busy: () => boolean;
}

export interface CharOpts extends PieceOpts {
  /** source material name -> palette hex (per-instance outfit/skin/hair). */
  colors?: Record<string, number>;
  /** uniform scale of the head bone (slight stylisation for pixel readability). */
  head?: number;
  /** name of the head bone (default 'Head'). */
  headBone?: string;
}

const charMatCache = new Map<number, THREE.MeshToonMaterial>();
function charMat(hex: number): THREE.MeshToonMaterial {
  let m = charMatCache.get(hex);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color: color(hex), gradientMap: GRADIENT });
    charMatCache.set(hex, m);
  }
  return m;
}

export function character(name: AssetName, o: CharOpts = {}, parent?: THREE.Object3D): KitCharacter {
  const e = entry(name);
  const group = piece(name, o, parent);
  const rig = group.children[0];
  if (o.colors) {
    const cols = o.colors;
    rig.traverse((n) => {
      const mesh = n as THREE.Mesh;
      if (!mesh.isMesh) return;
      const swap = (m: THREE.Material) => {
        const hex = cols[m.name.replace(/^kit:/, '')];
        return hex === undefined ? m : charMat(hex);
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
    });
  }
  const headBone = o.head ? findNode(rig, o.headBone ?? 'Head') : null;
  const headK = o.head ?? 1;
  const mixer = new THREE.AnimationMixer(rig);
  const actions = new Map<string, THREE.AnimationAction>();
  for (const c of e.clips) {
    const a = mixer.clipAction(c);
    actions.set(c.name, a);
    const short = c.name.split('|').pop()!; // 'CharacterArmature|Idle' -> 'Idle'
    if (!actions.has(short)) actions.set(short, a);
  }
  let current: THREE.AnimationAction | null = null;
  let loopAction: THREE.AnimationAction | null = null;

  const to = (a: THREE.AnimationAction, fade: number) => {
    if (a === current) return;
    a.reset().play();
    if (current) current.crossFadeTo(a, fade, false);
    current = a;
  };
  mixer.addEventListener('finished', () => {
    if (loopAction && current !== loopAction) to(loopAction, 0.25);
  });

  let lastT = -1;
  return {
    group,
    rig,
    loop: (clip, fade = 0.3) => {
      const a = actions.get(clip);
      if (!a) return;
      a.setLoop(THREE.LoopRepeat, Infinity);
      a.clampWhenFinished = false;
      loopAction = a;
      to(a, fade);
    },
    once: (clip, fade = 0.15) => {
      const a = actions.get(clip);
      if (!a) return;
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
      if (a === current) a.reset();
      to(a, fade);
    },
    busy: () => !!current && current !== loopAction,
    update: (t) => {
      const dt = lastT < 0 ? 0 : Math.min(0.1, Math.max(0, t - lastT));
      lastT = t;
      mixer.update(dt);
      if (headBone) headBone.scale.setScalar(headK);
    },
  };
}

/** Find a named node (e.g. a bone like 'arm-right') under an object. */
export function findNode(root: THREE.Object3D, name: string): THREE.Object3D | null {
  // GLTFLoader sanitises node names ('UpperArm.L' → 'UpperArmL'), so match both.
  const alt = THREE.PropertyBinding.sanitizeNodeName(name);
  let hit: THREE.Object3D | null = null;
  root.traverse((o) => {
    if (!hit && (o.name === name || o.name === alt)) hit = o;
  });
  return hit;
}

/* ---------------------------------------------------------- static batch */

/**
 * Collapse many static pieces into ONE mesh per material (keeps the island's
 * decor to a handful of draw calls). Add pieces positioned relative to the
 * batch root, then build().
 */
export class StaticBatch {
  private root = new THREE.Group();
  add(obj: THREE.Object3D): THREE.Object3D {
    this.root.add(obj);
    return obj;
  }
  build(): THREE.Group {
    this.root.updateMatrixWorld(true);
    const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
    this.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || (mesh as THREE.SkinnedMesh).isSkinnedMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const src = mesh.geometry;
      const groups = src.groups.length && Array.isArray(mesh.material) ? src.groups : [{ start: 0, count: Infinity, materialIndex: 0 }];
      for (const gr of groups) {
        const m = mats[gr.materialIndex ?? 0];
        let g = src.index ? src.toNonIndexed() : src.clone();
        if (Array.isArray(mesh.material) && src.groups.length) {
          // slice out this group's triangles
          const start = gr.start;
          const count = Math.min(gr.count, g.attributes.position.count - start);
          const sliced = new THREE.BufferGeometry();
          for (const k of Object.keys(g.attributes)) {
            const a = g.attributes[k] as THREE.BufferAttribute;
            sliced.setAttribute(
              k,
              new THREE.BufferAttribute(
                (a.array as Float32Array).slice(start * a.itemSize, (start + count) * a.itemSize),
                a.itemSize,
              ),
            );
          }
          g = sliced;
        }
        const keepUv = !!(m as THREE.MeshToonMaterial).map;
        for (const k of Object.keys(g.attributes)) {
          if (k !== 'position' && k !== 'normal' && !(keepUv && k === 'uv')) g.deleteAttribute(k);
        }
        if (!g.attributes.normal) g.computeVertexNormals();
        g.applyMatrix4(mesh.matrixWorld);
        let list = buckets.get(m);
        if (!list) buckets.set(m, (list = []));
        list.push(g);
      }
    });
    const out = new THREE.Group();
    for (const [m, list] of buckets) {
      const merged = mergeGeometries(list, false);
      for (const g of list) g.dispose();
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, m);
      out.add(mesh);
    }
    return out;
  }
}
