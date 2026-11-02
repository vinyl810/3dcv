import * as THREE from 'three';
import { buildIsland, buildNightLamp, buildOcean } from '../../environment';
import { buildHub } from '../../landmarks/hub';
import { buildEducation } from '../../landmarks/education';
import { buildPublications } from '../../landmarks/publications';
import { buildMonitor } from '../../landmarks/monitor';
import { buildProjects } from '../../landmarks/projects';
import { buildCoursework } from '../../landmarks/coursework';
import { buildTrophy } from '../../landmarks/trophy';
import { buildInvolvement } from '../../landmarks/involvement';
import type { StyleSet } from '../types';

/** The original procedural primitives (box/cyl/cone mix) — the baseline. */
const classic: StyleSet = {
  id: 'classic',
  label: 'Classic (current)',
  landmarks: {
    about: buildHub,
    education: buildEducation,
    publications: buildPublications,
    work: buildMonitor,
    projects: buildProjects,
    coursework: buildCoursework,
    awards: buildTrophy,
    involvement: buildInvolvement,
  },
  buildIsland: () => {
    const island = buildIsland();
    const lamp = buildNightLamp();
    const group = new THREE.Group();
    group.add(island.group, lamp.group);
    return {
      group,
      nightLights: island.nightLights,
      update: island.update,
      applyTod: lamp.applyTod,
    };
  },
  buildOcean,
};

export default classic;
