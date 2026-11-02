import type { StyleSet } from './types';

/**
 * Model-style registry. `?style=<id>` picks one at runtime (default: vox).
 * Each style is its own code-split chunk, so only the chosen one is loaded.
 */
export const STYLE_IDS = ['classic', 'voxel', 'kit', 'vox', 'refined'] as const;
export type StyleId = (typeof STYLE_IDS)[number];

/** The chosen production look (MagicaVoxel .vox models). */
export const DEFAULT_STYLE: StyleId = 'vox';

export const STYLE_LABELS: Record<StyleId, string> = {
  classic: 'Classic',
  voxel: 'Voxel grid',
  kit: 'CC0 kit',
  vox: 'MagicaVoxel',
  refined: 'Refined',
};

export function styleFromUrl(): StyleId {
  if (typeof location === 'undefined') return DEFAULT_STYLE;
  const raw = new URLSearchParams(location.search).get('style');
  return (STYLE_IDS as readonly string[]).includes(raw ?? '') ? (raw as StyleId) : DEFAULT_STYLE;
}

export async function loadStyle(id: StyleId): Promise<StyleSet> {
  // Literal import paths so the bundler can code-split each style.
  switch (id) {
    case 'voxel':
      return (await import('./voxel')).default;
    case 'kit':
      return (await import('./kit')).default;
    case 'refined':
      return (await import('./refined')).default;
    case 'classic':
      return (await import('./classic')).default;
    default:
      return (await import('./vox')).default;
  }
}
