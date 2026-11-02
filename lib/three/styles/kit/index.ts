import type { StyleSet } from '../types';
import { preloadKit } from './assets';
import { buildKitIsland } from './island';
import { buildKitOcean } from './ocean';
import { kitLandmarks } from './landmarks';

/**
 * 'kit' — CC0 low-poly glTF asset packs (Kenney Nature / Furniture / Mini
 * Characters / Fantasy Town; credits in public/models/kit/CREDITS.md), all
 * re-materialled to the pipeline's single toon material + one palette, composed
 * into readable CV vignettes on an organic floating island with a lagoon.
 */
const style: StyleSet = {
  id: 'kit',
  label: 'CC0 kit',
  preload: preloadKit,
  landmarks: kitLandmarks,
  buildIsland: buildKitIsland,
  buildOcean: buildKitOcean,
};

export default style;
