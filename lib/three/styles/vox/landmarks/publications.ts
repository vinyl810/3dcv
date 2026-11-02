import { makeSelectionClock, type BuiltModel } from '../../../kit';
import { landmarkModel, glowAll, TAU } from '../common';

/** Publications — journal on a tilted lectern; a glowing page floats + turns; click = page flip. */
export function build(): BuiltModel {
  const m = landmarkModel('publications');
  const { desk, page } = m.parts;
  desk.rotation.x = 0.3; // writing slope toward the viewer
  page.userData.noShadow = true;
  const py = page.position.y;
  const clock = makeSelectionClock();
  return {
    group: m.group,
    update: (t, hover, selected) => {
      const sel = clock(t, selected);
      const flash = sel >= 0 ? Math.exp(-sel * 2.2) : 0;
      const pop = sel >= 0 ? Math.sin(Math.min(sel, 0.6) / 0.6 * Math.PI) * Math.exp(-sel) : 0;
      page.position.y = py + Math.sin((t / 3) * TAU) * 1.0 * m.s + pop * 4 * m.s;
      page.rotation.y = Math.sin((t / 8) * TAU) * 0.5 + (sel >= 0 ? TAU * (1 - Math.exp(-sel * 2.4)) : 0);
      page.rotation.z = Math.sin((t / 4.6) * TAU) * 0.06;
      glowAll(m, (0.85 + 0.15 * Math.sin((t / 1.9) * TAU)) * (1 + 0.6 * hover + 1.4 * flash));
    },
  };
}
