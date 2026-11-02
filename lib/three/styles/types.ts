import type * as THREE from 'three';
import type { BuiltModel } from '../kit';
import type { EnvPart, TodState } from '../environment';
import type { StationId } from '../layout';

/**
 * Island terrain + ALL non-landmark decor (trees, bushes, rocks, lanterns, the
 * street lamp, birds, fireflies, floating chunks…). Lives under the bobbing
 * `floating` group. Must keep clear of LANDMARK_LAYOUT footprints.
 */
export interface IslandPart extends EnvPart {
  /** Night-gated point lights; each needs userData.nightBase (on-intensity). */
  nightLights: THREE.PointLight[];
  /** Optional per-frame time-of-day hook (e.g. bulb emissive by night). */
  applyTod?: (s: TodState) => void;
}

/**
 * A complete, swappable model set. Selected at runtime with `?style=<id>` so
 * different modelling approaches can be compared side by side. Everything else
 * (camera, pixel pass, sky, lights, day/night, picking, guestbook) is shared.
 */
export interface StyleSet {
  id: string;
  label: string;
  /** Async asset loading (glTF / .vox). Awaited before the world is built. */
  preload?: () => Promise<void>;
  /** One builder per CV station. Same contract as before (see BuiltModel). */
  landmarks: Record<StationId, () => BuiltModel>;
  /** Terrain + decor. */
  buildIsland: () => IslandPart;
  /** Sea + waterfalls (+ foam). */
  buildOcean: () => EnvPart;
}
