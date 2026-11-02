import type { StyleSet } from '../types';
import { buildVoxelHub } from './hub';
import { buildVoxelIsland } from './island';
import { buildVoxelOcean } from './ocean';
import { buildVoxelEducation, buildVoxelPublications, buildVoxelWork, buildVoxelProjects } from './landmarks-a';
import { buildVoxelCoursework, buildVoxelAwards, buildVoxelInvolvement } from './landmarks-b';

/** Code-defined uniform voxel grid: every model is meshed from one voxel size. */
const style: StyleSet = {
  id: 'voxel',
  label: 'Voxel grid',
  landmarks: {
    about: buildVoxelHub,
    education: buildVoxelEducation,
    publications: buildVoxelPublications,
    work: buildVoxelWork,
    projects: buildVoxelProjects,
    coursework: buildVoxelCoursework,
    awards: buildVoxelAwards,
    involvement: buildVoxelInvolvement,
  },
  buildIsland: buildVoxelIsland,
  buildOcean: buildVoxelOcean,
};

export default style;
