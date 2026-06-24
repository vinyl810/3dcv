import * as THREE from 'three';
import {
  P,
  box,
  voxel,
  cyl,
  sphere,
  dome,
  pivot,
  emit,
  osc,
  TAU,
  type BuiltModel,
} from '../kit';

export function buildBrain(): BuiltModel {
  const group = new THREE.Group();

  // ---- base ring (slate) ----
  cyl(group, P.slate, 1.05, 1.1, 0.18, 0, 0.09, 0, 16);
  // subtle rim accent
  cyl(group, P.dusk, 0.95, 1.0, 0.06, 0, 0.2, 0, 16);

  // ---- inner throb pivot holds brain + neurons ----
  const throb = pivot(group, 0, 1.35, 0);

  // ---- low-poly brain: clustered voxel blobs with a central fissure gap ----
  // Two hemispheres offset in Z so a gap (fissure) runs along X.
  type Blob = [number, number, number, number, number]; // x,y,z,size,hex
  const fissure = 0.14; // half-gap along Z
  const lobes: Blob[] = [
    // left hemisphere (+Z)
    [0.0, 0.1, fissure + 0.18, 0.3, P.magenta],
    [0.32, 0.02, fissure + 0.14, 0.26, P.synapse],
    [-0.3, 0.04, fissure + 0.16, 0.26, P.synapse],
    [0.14, 0.26, fissure + 0.12, 0.24, P.magenta],
    [-0.16, 0.24, fissure + 0.14, 0.22, P.synapse],
    [0.28, -0.18, fissure + 0.1, 0.22, P.magenta],
    [-0.26, -0.16, fissure + 0.12, 0.2, P.magenta],
    // right hemisphere (-Z)
    [0.0, 0.1, -(fissure + 0.18), 0.3, P.synapse],
    [0.32, 0.02, -(fissure + 0.14), 0.26, P.magenta],
    [-0.3, 0.04, -(fissure + 0.16), 0.26, P.magenta],
    [0.14, 0.26, -(fissure + 0.12), 0.24, P.synapse],
    [-0.16, 0.24, -(fissure + 0.14), 0.22, P.magenta],
    [0.28, -0.18, -(fissure + 0.1), 0.22, P.synapse],
    [-0.26, -0.16, -(fissure + 0.12), 0.2, P.synapse],
  ];
  for (const [x, y, z, s, hex] of lobes) {
    voxel(throb, hex, x, y, z, s, { rot: [0.2, 0.4, 0.1] });
  }

  // ---- neuron network: 8 nodes + connecting thin-box segments ----
  const nodePos: [number, number, number][] = [
    [0.0, 0.5, 0.0],
    [0.45, 0.2, 0.3],
    [-0.45, 0.2, 0.3],
    [0.45, 0.2, -0.3],
    [-0.45, 0.2, -0.3],
    [0.0, -0.05, 0.5],
    [0.0, -0.05, -0.5],
    [0.0, 0.3, 0.0],
  ];

  const nodes: THREE.Mesh[] = [];
  for (const [x, y, z] of nodePos) {
    const n = sphere(throb, P.foam, 0.05, x, y, z, 8, { emissive: 1 });
    n.material = (n.material as THREE.MeshToonMaterial).clone();
    nodes.push(n);
  }

  // connections (pairs of node indices)
  const links: [number, number][] = [
    [7, 0],
    [7, 1],
    [7, 2],
    [7, 3],
    [7, 4],
    [0, 1],
    [0, 2],
    [5, 1],
    [6, 3],
    [5, 2],
    [6, 4],
  ];

  const segMeshes: THREE.Mesh[] = [];
  for (const [a, b] of links) {
    const pa = new THREE.Vector3(...nodePos[a]);
    const pb = new THREE.Vector3(...nodePos[b]);
    const mid = pa.clone().add(pb).multiplyScalar(0.5);
    const len = pa.distanceTo(pb);
    // thin long box (default along Z), oriented to point a->b
    const seg = box(throb, P.synapse, 0.02, 0.02, len, mid.x, mid.y, mid.z, {
      emissive: 0.4,
    });
    seg.material = (seg.material as THREE.MeshToonMaterial).clone();
    const dir = pb.clone().sub(pa).normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      dir,
    );
    seg.quaternion.copy(quat);
    segMeshes.push(seg);
  }

  // ---- translucent glass dome over the brain ----
  dome(group, P.surfCyan, 1.0, 0, 0.25, 0, 14, { opacity: 0.22 });

  // ---- EEG readout strip on base front (front = +Z) ----
  // backing panel
  box(group, P.abyss, 1.2, 0.4, 0.05, 0, 0.22, 1.08);
  // red zig-zag waveform: row of small emissive boxes at varying heights
  const waveCount = 14;
  const waveBoxes: THREE.Mesh[] = [];
  for (let i = 0; i < waveCount; i++) {
    const bx = -0.52 + (i / (waveCount - 1)) * 1.04;
    const w = box(group, P.signalRed, 0.05, 0.08, 0.06, bx, 0.22, 1.11, {
      emissive: 1,
    });
    w.material = (w.material as THREE.MeshToonMaterial).clone();
    waveBoxes.push(w);
  }

  // ---- little EEG cap beside the dome with 4 electrode dots ----
  const capPivot = pivot(group, 1.25, 0.4, 0.2);
  dome(capPivot, P.horizon, 0.32, 0, 0, 0, 10);
  cyl(capPivot, P.slate, 0.33, 0.34, 0.04, 0, 0.0, 0, 12);
  const elec: [number, number, number][] = [
    [0.12, 0.12, 0.12],
    [-0.12, 0.12, 0.12],
    [0.12, 0.12, -0.12],
    [-0.12, 0.12, -0.12],
  ];
  for (const [x, y, z] of elec) {
    sphere(capPivot, P.surfCyan, 0.05, x, y, z, 8, { emissive: 0.8 });
  }

  group.rotation.y = Math.PI / 4;

  return {
    group,
    update(t, hover) {
      // hover affects only lift/scale + emissive, never the animation rate

      // brain throb: uniform scale 1.0 -> 1.03 over ~3s
      const th = 1.0 + 0.015 + 0.015 * osc(t, 3);
      throb.scale.setScalar(th);

      // rolling neuron firing (~2 cycles/sec)
      const firePhase = (t * 2) % nodes.length;
      for (let i = 0; i < nodes.length; i++) {
        // distance around the rolling cycle
        let d = Math.abs(i - firePhase);
        d = Math.min(d, nodes.length - d);
        const fire = Math.max(0, 1 - d * 0.7);
        const m = nodes[i].material as THREE.MeshToonMaterial;
        // brighten synapse->foam: lerp color + emissive intensity
        m.emissiveIntensity = 0.4 + 1.4 * fire;
        m.color.setHex(0x9d7bff).lerp(new THREE.Color(0xeaf6f6), fire);
        m.emissive.copy(m.color);
        const pop = 1 + 0.6 * fire;
        nodes[i].scale.setScalar(pop);
      }

      // segments brighten with their endpoint firing
      for (let s = 0; s < segMeshes.length; s++) {
        const [a, b] = links[s];
        const da = Math.min(
          Math.abs(a - firePhase),
          nodes.length - Math.abs(a - firePhase),
        );
        const db = Math.min(
          Math.abs(b - firePhase),
          nodes.length - Math.abs(b - firePhase),
        );
        const fire = Math.max(0, 1 - Math.min(da, db) * 0.7);
        const m = segMeshes[s].material as THREE.MeshToonMaterial;
        m.emissiveIntensity = 0.3 + 1.0 * fire;
        m.color.setHex(0x9d7bff).lerp(new THREE.Color(0xeaf6f6), fire);
        m.emissive.copy(m.color);
      }

      // EEG waveform scroll: spikes travel left-to-right each frame.
      // NOTE: box() bakes size into mesh.scale, so scale.y is the ABSOLUTE
      // world height here, anchored so the bars grow upward from the strip.
      const scroll = t * 6;
      for (let i = 0; i < waveBoxes.length; i++) {
        const h =
          0.04 + 0.13 * Math.abs(osc(i + scroll, 3)) + 0.04 * Math.abs(osc(i + scroll, 1.3));
        waveBoxes[i].scale.y = h;
        waveBoxes[i].position.y = 0.12 + h / 2;
      }

      // EEG cap idle bob
      capPivot.position.y = 0.4 + 0.03 * osc(t, 2.5);
      capPivot.rotation.y = 0.2 * osc(t, 5);
    },
  };
}
