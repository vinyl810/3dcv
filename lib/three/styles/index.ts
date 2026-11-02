import type { StyleSet } from './types';

/**
 * The scene's model set. Only the MagicaVoxel (.vox) style ships now; the
 * StyleSet contract stays so a future look can be swapped in at one place.
 * Loaded as its own chunk so three.js + models stay out of the SSR bundle.
 */
export async function loadStyle(): Promise<StyleSet> {
  return (await import('./vox')).default;
}
