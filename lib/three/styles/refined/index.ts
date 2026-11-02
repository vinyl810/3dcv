import type { StyleSet } from '../types';
import { buildRefinedIsland } from './island';
import { buildRefinedOcean } from './ocean';
import { buildRefinedHub } from './landmarks/hub';
import { buildRefinedEducation } from './landmarks/education';
import { buildRefinedPublications } from './landmarks/publications';
import { buildRefinedMonitor } from './landmarks/monitor';
import { buildRefinedProjects } from './landmarks/projects';
import { buildRefinedCoursework } from './landmarks/coursework';
import { buildRefinedTrophy } from './landmarks/trophy';
import { buildRefinedInvolvement } from './landmarks/involvement';

/**
 * Refined: the classic procedural-primitive approach redone with an art
 * director's eye — one pixel grain (0.1 world-unit grid), merged vertex-coloured
 * parts, a lighter focal palette, an organic stepped island with a lagoon ring
 * and narrow tapered falls.
 */
const style: StyleSet = {
  id: 'refined',
  label: 'Refined',
  landmarks: {
    about: buildRefinedHub,
    education: buildRefinedEducation,
    publications: buildRefinedPublications,
    work: buildRefinedMonitor,
    projects: buildRefinedProjects,
    coursework: buildRefinedCoursework,
    awards: buildRefinedTrophy,
    involvement: buildRefinedInvolvement,
  },
  buildIsland: buildRefinedIsland,
  buildOcean: buildRefinedOcean,
};

export default style;
