import * as THREE from 'three';
import { makeSelectionClock, type BuiltModel } from '../../../kit';
import { landmarkModel, glowAll, TAU } from '../common';

/**
 * Work @ KOAST — ocean-data monitor. The holo digital-twin globe spins out of
 * the screen inside a dashed orbit ring, the wave-field bars breathe, the map
 * pin bobs. Click: globe whirl + bars surge + screen flash.
 */
export function build(): BuiltModel {
  const m = landmarkModel('work');
  const { globe, ring, pin } = m.parts;
  const bars = [0, 1, 2, 3, 4, 5].map((i) => m.parts[`bar${i}`]);
  const pinY = pin.position.y;
  const globeY = globe.position.y;
  for (const o of [globe, ring, pin]) o.userData.noShadow = true;
  ring.rotation.x = 0.35;

  const clock = makeSelectionClock();
  return {
    group: m.group,
    update: (t, hover, selected) => {
      const sel = clock(t, selected);
      const burst = sel >= 0 ? Math.exp(-sel * 1.8) : 0;
      const whirl = sel >= 0 ? TAU * (1 - Math.exp(-sel * 2.2)) : 0;

      globe.rotation.y = t * 0.55 + whirl;
      globe.position.y = globeY + Math.sin((t / 3) * TAU) * 0.4 * m.s;
      ring.position.y = globe.position.y;
      ring.rotation.y = -t * 0.9;
      ring.rotation.z = Math.sin((t / 5) * TAU) * 0.12;

      bars.forEach((b, i) => {
        const w = 0.5 + 0.5 * Math.sin(t * 2.1 + i * 1.1);
        b.scale.y = 0.45 + 0.55 * w + 0.5 * burst;
      });
      pin.position.y = pinY + Math.abs(Math.sin(t * 2.4)) * 1.2 * m.s + burst * 3 * m.s;

      const pulse = 0.9 + 0.1 * Math.sin((t / 1.7) * TAU);
      glowAll(m, pulse * (1 + 0.6 * hover + 1.1 * burst));
    },
  };
}
