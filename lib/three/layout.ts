/**
 * Island layout shared by every model style (no three.js import — client-safe).
 * stationId must match lib/cv-data.ts station ids. Order = CV / dot-nav order.
 */

export type StationId =
  | 'about'
  | 'education'
  | 'publications'
  | 'work'
  | 'projects'
  | 'coursework'
  | 'awards'
  | 'involvement';

export interface LandmarkSlot {
  id: StationId;
  label: string;
  pos: [number, number]; // x, z on the grass
  scale: number;
  /** Clearance radius decor/fireflies must keep from pos. */
  keepOut: number;
}

/** Top of the grass slab — every landmark base rests here. */
export const GRASS_TOP = 0.5;

/** Grass is the square |x|,|z| <= GRASS_HALF; sand rim to SAND_HALF. */
export const GRASS_HALF = 7.7;
export const SAND_HALF = 8.5;

export const LANDMARK_LAYOUT: LandmarkSlot[] = [
  { id: 'about', label: 'About · @vinyl810', pos: [0, 0], scale: 1, keepOut: 2.6 },
  { id: 'education', label: 'Education', pos: [0, -6], scale: 1, keepOut: 2.2 },
  { id: 'publications', label: 'Publications', pos: [-6.5, 1], scale: 0.95, keepOut: 2.2 },
  { id: 'work', label: 'Work · KOAST', pos: [4.5, 2.5], scale: 0.78, keepOut: 2.0 },
  { id: 'projects', label: 'Projects', pos: [-1, 5], scale: 1, keepOut: 2.2 },
  { id: 'coursework', label: 'Coursework', pos: [-5, -4], scale: 1, keepOut: 2.2 },
  { id: 'awards', label: 'Awards & Honors', pos: [3, -5.5], scale: 1, keepOut: 2.2 },
  { id: 'involvement', label: 'Involvement & Service', pos: [6, -1], scale: 1, keepOut: 2.2 },
];

/** True if (x, z) is within any landmark keep-out (+ extra margin). */
export function nearLandmark(x: number, z: number, extra = 0): boolean {
  return LANDMARK_LAYOUT.some(
    (L) => (x - L.pos[0]) ** 2 + (z - L.pos[1]) ** 2 < (L.keepOut + extra) ** 2,
  );
}
