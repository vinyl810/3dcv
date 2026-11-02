import { makeSelectionClock, type BuiltModel } from '../../../kit';
import { landmarkModel, glowAll, nudgeOnScreen, TAU } from '../common';

/** Awards — golden cup spins on the podium, medals bob; click = hop + confetti burst. */
export function build(): BuiltModel {
  const m = landmarkModel('awards');
  nudgeOnScreen(m.group, 'awards', 0.9); // un-stack education/awards from the camera's view
  const { cup, medal1, medal2, confetti } = m.parts;
  const cupY = cup.position.y, m1y = medal1.position.y, m2y = medal2.position.y, cy = confetti.position.y;
  for (const p of [medal1, medal2, confetti]) p.userData.noShadow = true;
  confetti.visible = false;
  const clock = makeSelectionClock();
  return {
    group: m.group,
    update: (t, hover, selected) => {
      const sel = clock(t, selected);
      const hop = sel >= 0 ? Math.sin(Math.min(sel, 0.5) / 0.5 * Math.PI) * Math.exp(-sel * 1.5) : 0;
      const flash = sel >= 0 ? Math.exp(-sel * 2.5) : 0;
      cup.rotation.y = (t / 12) * TAU + (sel >= 0 ? TAU * (1 - Math.exp(-sel * 2.5)) : 0);
      cup.position.y = cupY + hop * 8 * m.s;
      medal1.position.y = m1y + Math.sin((t / 2.4) * TAU) * 1.2 * m.s;
      medal2.position.y = m2y + Math.sin((t / 2.4) * TAU + 2) * 1.2 * m.s;
      medal1.rotation.y = Math.sin((t / 3.1) * TAU) * 0.6;
      medal2.rotation.y = Math.sin((t / 3.1) * TAU + 1.5) * 0.6;
      // confetti: a one-shot pop that rises, spins and shrinks away (~2.2 s)
      const live = sel >= 0 && sel < 2.2;
      confetti.visible = live;
      if (live) {
        const k = sel / 2.2;
        confetti.position.y = cy + (Math.sin(Math.min(k * 2.2, 1) * Math.PI / 2) * 10 - k * k * 4) * m.s;
        confetti.rotation.y = sel * 2.5;
        confetti.scale.setScalar(Math.max(0.01, 0.4 + 1.2 * Math.min(1, k * 4)) * (1 - k * k));
      }
      glowAll(m, (0.8 + 0.2 * Math.sin((t / 1.6) * TAU)) * (1 + 0.6 * hover + 1.5 * flash));
    },
  };
}
