import * as THREE from 'three';
import { P, box, cyl, cone, sphere, mat, emit, glass, osc, TAU, clamp, type BuiltModel } from '../kit';

export function buildLighthouse(): BuiltModel {
  const group = new THREE.Group();

  // ---- tower: stacked tapering cylinders ----
  // base
  cyl(group, P.foam, 0.4, 0.45, 0.5, 0, 0.25, 0, 12);
  // two painted red stripe bands (thin red cyls hugging the base)
  cyl(group, P.signalRed, 0.435, 0.45, 0.06, 0, 0.1, 0, 12);
  cyl(group, P.signalRed, 0.405, 0.42, 0.06, 0, 0.36, 0, 12);

  // mid section
  cyl(group, P.foam, 0.34, 0.38, 0.5, 0, 0.75, 0, 12);

  // gallery ring (slate) at top of tower
  cyl(group, P.slate, 0.4, 0.4, 0.1, 0, 1.05, 0, 12);

  // ---- lantern room ----
  // amber emissive "eye" lens sphere — the seeing aperture
  const eye = sphere(group, P.amber, 0.18, 0, 1.28, 0, 10, { emissive: 1.2 });
  eye.material = (eye.material as THREE.MeshToonMaterial).clone();

  // translucent surf-cyan glass cylinder housing the eye
  cyl(group, P.surfCyan, 0.3, 0.3, 0.4, 0, 1.28, 0, 12, {
    mat: glass(P.surfCyan, 0.28, 0.2),
  });

  // little roof cap over the lantern
  cone(group, P.signalRed, 0.34, 0.22, 0, 1.6, 0, 12);
  sphere(group, P.gold, 0.05, 0, 1.74, 0, 8, { emissive: 0.8 });

  // ---- rotating beam: glass amber cone child of a spinning pivot ----
  const beamPivot = new THREE.Group();
  beamPivot.position.set(0, 1.28, 0);
  group.add(beamPivot);
  // long thin cone laid along +Z, brightening toward camera
  const beam = cone(beamPivot, P.amber, 0.22, 2.2, 0, 0, 1.2, 10, {
    mat: glass(P.amber, 0.18, 0.4),
    rot: [Math.PI / 2, 0, 0], // tip points outward along +Z
  });
  beam.material = (beam.material as THREE.MeshToonMaterial).clone();
  const beamMat = beam.material as THREE.MeshToonMaterial;

  // ---- picket-fence ring of thin foam boxes around the base ----
  const pickets = 14;
  for (let i = 0; i < pickets; i++) {
    const a = (i / pickets) * TAU;
    const r = 0.62;
    box(group, P.foam, 0.06, 0.18, 0.06, Math.cos(a) * r, 0.09, Math.sin(a) * r);
  }

  // ---- tripod camera prop at the foot ----
  const tripod = new THREE.Group();
  tripod.position.set(0.55, 0, 0.55);
  group.add(tripod);
  // three slate legs splayed out
  const legA = [0, TAU / 3, (2 * TAU) / 3];
  for (let i = 0; i < 3; i++) {
    const a = legA[i];
    cyl(tripod, P.slate, 0.02, 0.02, 0.42, Math.cos(a) * 0.08, 0.2, Math.sin(a) * 0.08, 6, {
      rot: [Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35],
    });
  }
  // camera body
  box(tripod, P.slate, 0.16, 0.12, 0.12, 0, 0.45, 0);
  // surf-cyan lens dot (recording-light blink)
  const dot = sphere(tripod, P.surfCyan, 0.045, 0.04, 0.45, 0.09, 8, { emissive: 1 });
  dot.material = (dot.material as THREE.MeshToonMaterial).clone();
  const dotMat = dot.material as THREE.MeshToonMaterial;
  // small lens barrel ring
  cyl(tripod, P.abyss, 0.05, 0.05, 0.03, 0.04, 0.45, 0.06, 8, { rot: [Math.PI / 2, 0, 0] });

  // base orientation: readable front faces the +X+Z camera corner
  group.rotation.y = Math.PI / 4;

  return {
    group,
    update(t, hover) {
      // steady animation rate — hover only affects beam brightness + lift/scale

      // beam sweeps 360 / 6s
      beamPivot.rotation.y = (t * TAU) / 6;
      // brighten as the beam points toward the camera corner (world -PI/4 + sweep)
      const worldAngle = -Math.PI / 4 + beamPivot.rotation.y;
      // camera looks from +X+Z -> beam aimed when worldAngle ~ PI/4
      const facing = Math.cos(worldAngle - Math.PI / 4); // 1 when toward camera
      beamMat.emissiveIntensity = 0.25 + 0.55 * clamp(facing, 0, 1) * (0.7 + 0.3 * hover);
      beamMat.opacity = 0.12 + 0.18 * clamp(facing, 0, 1);

      // iris dilation of the amber eye (0.9 -> 1.0 over 3s)
      const dilate = 0.95 + 0.05 * osc(t, 3);
      eye.scale.setScalar(dilate);
      (eye.material as THREE.MeshToonMaterial).emissiveIntensity = 1.0 + 0.4 * Math.abs(osc(t, 1.5));

      // recording-light blink every ~2s
      const blink = osc(t, 2) > 0.6 ? 1.4 : 0.05;
      dotMat.emissiveIntensity = blink;
    },
  };
}
