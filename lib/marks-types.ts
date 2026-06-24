/**
 * Shared, client-safe types + constants for visitor "marks" (the fireflies
 * visitors plant on the island). NO server imports live here so both the React
 * UI and the three.js engine can import it freely.
 */

export interface Mark {
  id: number;
  x: number; // island-local world X (same units as landmarks)
  z: number; // island-local world Z
  color: number; // index into MARK_COLORS
  label: string | null; // optional one-liner
  createdAt: string; // ISO timestamp
}

/** Colors a visitor can pick — matches the palette `P` in three/kit.ts. */
export const MARK_COLORS = [0xf0b266, 0xe4bd60, 0x62cdd6, 0xcf6f97, 0x9483d6] as const;
// amber · gold · cyan · rose · violet
export const MARK_COLOR_NAMES = ['amber', 'gold', 'cyan', 'rose', 'violet'] as const;

export const MAX_LABEL = 24; // max chars stored for a label
export const RENDER_CAP = 150; // most-recent marks fetched for the scene
