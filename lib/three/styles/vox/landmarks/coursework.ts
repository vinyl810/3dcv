import * as THREE from 'three';
import { makeSelectionClock, type BuiltModel } from '../../../kit';
import { landmarkModel, glowAll, TAU } from '../common';

/** Coursework — bookshelf; featured spines pulse in turn, hop out on click; plant sways. */
export function build(): BuiltModel {
  const m = landmarkModel('coursework');
  const feats = [m.parts.feat0, m.parts.feat1, m.parts.feat2].filter(Boolean) as THREE.Group[];
  const base = feats.map((f) => f.position.clone());
  const plant = m.parts.plant;
  const clock = makeSelectionClock();
  return {
    group: m.group,
    update: (t, hover, selected) => {
      const sel = clock(t, selected);
      feats.forEach((f, i) => {
        // staggered pop-out: slide forward, little hop, settle back
        const s = sel >= 0 ? sel - i * 0.15 : -1;
        const out = s > 0 ? Math.sin(Math.min(s, 0.6) / 0.6 * Math.PI) * Math.exp(-s * 0.8) : 0;
        const idle = Math.max(0, Math.sin((t / 4.5) * TAU - i * 2.1)) ** 6; // one at a time peeks out
        f.position.z = base[i].z + (out * 5 + idle * 1.2) * m.s;
        f.position.y = base[i].y + out * 2.5 * m.s;
        f.rotation.z = out * 0.25 * (i % 2 ? 1 : -1);
        const k = (0.75 + 0.5 * idle) * (1 + 0.6 * hover + 1.6 * out);
        glowAll(m, k, m.emits[f.name] ?? []);
      });
      if (plant) {
        const wob = sel >= 0 ? Math.exp(-sel * 3) * Math.sin(sel * 18) * 0.3 : 0;
        plant.rotation.z = Math.sin((t / 3.1) * TAU) * 0.06 + wob;
        plant.rotation.x = Math.sin((t / 4.3) * TAU) * 0.04;
      }
    },
  };
}
