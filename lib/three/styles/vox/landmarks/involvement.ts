import { makeSelectionClock, type BuiltModel } from '../../../kit';
import { landmarkModel, glowAll, TAU } from '../common';
import { buildPeople } from './people';

/**
 * Involvement — stage with three fully rigged people (see ../rig.ts):
 *  • idle: breathing, weight shift, the odd glance, relaxed arms (soft elbows);
 *    the two mentees break into short CLAP bouts (forearms meet in front);
 *    the speaker gestures with one hand.
 *  • click: staggered anticipation-crouch → hop → land, then a CHEER — both
 *    arms up with bent elbows while stepping in place on alternating knees.
 * Banner halves ripple; spotlight ring pulses.
 */
export function build(): BuiltModel {
  const m = landmarkModel('involvement');
  const people = buildPeople(m); // rigged mentees + speaker (./people.ts)
  const { clothL, clothR, ring } = m.parts;
  const clock = makeSelectionClock();

  return {
    group: m.group,
    update: (t, hover, selected) => {
      const sel = clock(t, selected);
      const flash = sel >= 0 ? Math.exp(-sel * 3) : 0;

      people(t, sel);

      if (clothL && clothR) {
        const rip = Math.sin((t / 1.7) * TAU);
        const wave = sel >= 0 ? Math.exp(-sel * 2) * Math.sin(sel * 12) * 0.25 : 0;
        clothL.rotation.y = rip * 0.1 + wave;
        clothR.rotation.y = -Math.sin((t / 1.7) * TAU + 1.2) * 0.1 - wave;
      }
      if (ring) {
        const pulse = 1 + 0.04 * Math.sin((t / 1.4) * TAU) + 0.18 * flash;
        ring.scale.set(pulse, 1, pulse);
      }
      glowAll(m, (0.85 + 0.15 * Math.sin((t / 1.4) * TAU)) * (1 + 0.6 * hover + 1.5 * flash));
    },
  };
}

