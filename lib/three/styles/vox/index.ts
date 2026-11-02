import type { StyleSet } from '../types';
import { preloadVox } from './assets';
import { voxLandmarks } from './landmarks';
import { buildVoxIsland } from './island';
import { buildVoxOcean } from './ocean';

/**
 * 'vox' — MagicaVoxel asset pipeline. Every model is a hand-editable .vox file
 * in public/models/vox/ (see ./README.md), parsed + meshed at runtime with
 * exposed-face meshing, corner AO and MATL emissive/glass materials.
 */
const style: StyleSet = {
  id: 'vox',
  label: 'MagicaVoxel',
  preload: preloadVox,
  landmarks: voxLandmarks,
  buildIsland: buildVoxIsland,
  buildOcean: buildVoxOcean,
};

export default style;
