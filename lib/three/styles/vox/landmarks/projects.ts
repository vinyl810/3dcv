import { makeSelectionClock, type BuiltModel } from '../../../kit';
import { landmarkModel, glowAll, TAU } from '../common';

/**
 * Projects — HCI/vision workbench. The camera slowly pans as if tracking, the
 * gear spins, the research brain pulses, the idea bulb floats with orbiting
 * sparkles. Click: camera snaps (quick recoil + REC flash), bulb pops up +
 * flashes, sparkles burst outward, the gear whirls.
 */
export function build(): BuiltModel {
  const m = landmarkModel('projects');
  const { camera, brain, gear, bulb } = m.parts;
  const camMats = m.emits.camera ?? [];
  const sparks = [0, 1, 2, 3].map((i) => m.parts[`spark${i}`]);
  const bulbP = bulb.position.clone();
  const sparkOff = sparks.map((s) => s.position.clone().sub(bulbP));
  bulb.userData.noShadow = true;
  for (const s of sparks) s.userData.noShadow = true;
  const bulbMats = m.emits.bulb ?? [];

  const clock = makeSelectionClock();
  return {
    group: m.group,
    update: (t, hover, selected) => {
      const sel = clock(t, selected);
      const burst = sel >= 0 ? Math.exp(-sel * 1.6) : 0;
      const hop = sel >= 0 ? Math.sin(Math.min(sel, 0.5) / 0.5 * Math.PI) * Math.exp(-sel * 1.2) : 0;
      const whirl = sel >= 0 ? TAU * 2 * (1 - Math.exp(-sel * 2)) : 0;

      // camera: slow tracking pan, a little tilt; click = shutter recoil
      const snap = sel >= 0 ? Math.exp(-sel * 8) * Math.sin(sel * 30) : 0;
      camera.rotation.y = Math.sin((t / 5) * TAU) * 0.45;
      camera.rotation.x = Math.sin((t / 3.3) * TAU) * 0.06 + snap * 0.12;
      gear.rotation.z = -t * 0.8 - whirl;
      const beat = Math.max(0, Math.sin((t / 1.4) * TAU));
      brain.scale.setScalar(1 + 0.04 * beat * beat + 0.08 * burst);

      bulb.position.y = bulbP.y + Math.sin((t / 2.4) * TAU) * 0.8 * m.s + hop * 5 * m.s;
      bulb.rotation.y = Math.sin((t / 4) * TAU) * 0.3;
      const spread = 1 + 0.9 * burst;
      sparks.forEach((s, i) => {
        const a = t * 0.8 + (i * TAU) / 4;
        const o = sparkOff[i];
        const c = Math.cos(a * 0.35), sn = Math.sin(a * 0.35);
        s.position.set(
          bulbP.x + (o.x * c - o.z * sn) * spread,
          bulb.position.y + o.y * spread + Math.sin(t * 2 + i) * 0.5 * m.s,
          bulbP.z + (o.x * sn + o.z * c) * spread,
        );
        s.rotation.z = t * 1.5 + i;
        s.scale.setScalar(0.75 + 0.25 * Math.sin(t * 3 + i * 1.7) + 0.4 * burst);
      });

      const pulse = 0.88 + 0.12 * Math.sin((t / 1.9) * TAU);
      glowAll(m, pulse * (1 + 0.6 * hover + 1.0 * burst));
      glowAll(m, pulse * (1 + 0.6 * hover + 2.2 * burst), bulbMats);
      const rec = Math.sin(t * TAU * 0.8) > 0 ? 1 : 0.25; // blinking REC light
      glowAll(m, rec * (1 + 0.6 * hover) + 3 * burst, camMats);
    },
  };
}
