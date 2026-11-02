import { makeSelectionClock, type BuiltModel } from '../../../kit';
import { landmarkModel, glowAll, nudgeOnScreen, TAU } from '../common';

/** Education — mortarboard bobs over the KAIST plinth, tassel swings; click = cap toss. */
export function build(): BuiltModel {
  const m = landmarkModel('education');
  nudgeOnScreen(m.group, 'education', -0.7); // un-stack education/awards from the camera's view
  const { cap, tassel } = m.parts;
  cap.attach(tassel); // tassel rides along with the cap (keeps its own swing pivot)
  const capY = cap.position.y;
  const clock = makeSelectionClock();
  return {
    group: m.group,
    update: (t, hover, selected) => {
      const sel = clock(t, selected);
      const toss = sel >= 0 ? Math.sin(Math.min(sel, 0.9) / 0.9 * Math.PI) : 0;
      const flash = sel >= 0 ? Math.exp(-sel * 2.5) : 0;
      cap.position.y = capY + (0.8 + 0.8 * Math.sin((t / 3) * TAU)) * m.s + toss * 14 * m.s;
      cap.rotation.y = Math.sin((t / 6) * TAU) * 0.12 + (sel >= 0 ? TAU * Math.min(1, sel / 0.9) : 0);
      cap.rotation.z = Math.sin((t / 4.2) * TAU) * 0.04 + toss * 0.25;
      cap.rotation.x = 0.2 + Math.sin((t / 5.1) * TAU) * 0.03; // board tilted toward the camera
      tassel.rotation.z = Math.sin((t / 1.7) * TAU) * 0.22 + flash * 0.5 * Math.sin(sel * 14);
      tassel.rotation.x = Math.sin((t / 2.3) * TAU + 1) * 0.12;
      glowAll(m, (0.85 + 0.15 * Math.sin((t / 2) * TAU)) * (1 + 0.6 * hover + 1.4 * flash));
    },
  };
}
