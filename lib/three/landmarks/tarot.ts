import * as THREE from 'three';
import { P, box, voxel, pivot, mat, emit, osc, TAU, type BuiltModel } from '../kit';

export function buildTarot(): BuiltModel {
  const group = new THREE.Group();

  // ---- mystic obsidian pedestal ----
  box(group, P.abyss, 1.0, 0.7, 1.0, 0, 0.35, 0);

  // gold trim edge boxes (top rim of pedestal)
  const ty = 0.7;
  box(group, P.gold, 1.04, 0.06, 0.06, 0, ty, 0.5);   // front top edge
  box(group, P.gold, 1.04, 0.06, 0.06, 0, ty, -0.5);  // back top edge
  box(group, P.gold, 0.06, 0.06, 1.04, 0.5, ty, 0);   // right top edge
  box(group, P.gold, 0.06, 0.06, 1.04, -0.5, ty, 0);  // left top edge
  // gold base trim
  box(group, P.gold, 1.04, 0.05, 1.04, 0, 0.04, 0);

  // faint magenta rune voxels on the front face (+Z)
  const runeZ = 0.505;
  const rune: [number, number][] = [
    [-0.28, 0.45], [-0.28, 0.32], [-0.21, 0.38],
    [0.0, 0.5], [0.0, 0.36], [0.0, 0.22], [-0.07, 0.36], [0.07, 0.36],
    [0.27, 0.48], [0.27, 0.32], [0.2, 0.4], [0.34, 0.4],
  ];
  for (const [rx, ry] of rune) {
    voxel(group, P.magenta, rx, ry, runeZ, 0.05, { emissive: 0.5 });
  }

  // ---- HCI KOREA award ribbon badge (pinned to front) ----
  const badge = pivot(group, 0, 0.16, 0.52);
  const ribbonMat = (mat(P.gold) as THREE.MeshToonMaterial).clone();
  const badgeBox = box(badge, P.gold, 0.18, 0.18, 0.05, 0, 0, 0, { mat: ribbonMat });
  // two signal-red ribbon tails
  box(badge, P.signalRed, 0.05, 0.16, 0.04, -0.05, -0.16, 0, { rot: [0, 0, 0.18] });
  box(badge, P.signalRed, 0.05, 0.16, 0.04, 0.05, -0.16, 0, { rot: [0, 0, -0.18] });
  // little gold center stud
  voxel(badge, P.amber, 0, 0, 0.04, 0.06, { emissive: 0.6 });

  // ---- 3 floating fanned tarot cards ----
  // fan center pivot above pedestal — leaned back so faces tilt toward the iso camera
  const fanCenter = pivot(group, 0, 2.0, 0.1);
  fanCenter.rotation.x = -0.22;

  type CardMotif = 'star' | 'moon' | 'eye';
  // each card gets a real side-by-side slot (offsetX), a small yaw, and a y stagger
  const cardData: {
    angle: number; motif: CardMotif; phase: number; offsetX: number; offsetY: number;
  }[] = [
    { angle: 0.32, motif: 'star', phase: 0, offsetX: -0.62, offsetY: 0 },
    { angle: 0.0, motif: 'moon', phase: TAU / 3, offsetX: 0, offsetY: 0.14 },
    { angle: -0.32, motif: 'eye', phase: (2 * TAU) / 3, offsetX: 0.62, offsetY: 0 },
  ];

  const cards: {
    swing: THREE.Group;   // y-swing + bob
    flip: THREE.Group;    // 180 reveal flip
    baseAngle: number;
    baseY: number;
    phase: number;
    isCenter: boolean;
  }[] = [];

  function buildCardFace(parent: THREE.Object3D, motif: CardMotif) {
    const fz = 0.025; // just in front of face plane
    if (motif === 'star') {
      // P.synapse plus/cross of voxels
      const s = 0.09;
      voxel(parent, P.synapse, 0, 0.15, fz, s, { emissive: 1 });
      voxel(parent, P.synapse, 0, 0.06, fz, s, { emissive: 1 });
      voxel(parent, P.synapse, 0, 0.24, fz, s, { emissive: 1 });
      voxel(parent, P.synapse, -0.09, 0.15, fz, s, { emissive: 1 });
      voxel(parent, P.synapse, 0.09, 0.15, fz, s, { emissive: 1 });
    } else if (motif === 'moon') {
      // P.surfCyan crescent — offset stacked voxels
      const s = 0.1;
      voxel(parent, P.surfCyan, -0.04, 0.28, fz, s, { emissive: 1 });
      voxel(parent, P.surfCyan, -0.08, 0.18, fz, s, { emissive: 1 });
      voxel(parent, P.surfCyan, -0.08, 0.08, fz, s, { emissive: 1 });
      voxel(parent, P.surfCyan, -0.04, -0.02, fz, s, { emissive: 1 });
    } else {
      // P.magenta eye — almond of voxels with bright center
      const s = 0.09;
      voxel(parent, P.magenta, -0.13, 0.12, fz, s, { emissive: 0.9 });
      voxel(parent, P.magenta, -0.05, 0.18, fz, s, { emissive: 0.9 });
      voxel(parent, P.magenta, 0.05, 0.18, fz, s, { emissive: 0.9 });
      voxel(parent, P.magenta, 0.13, 0.12, fz, s, { emissive: 0.9 });
      voxel(parent, P.magenta, -0.05, 0.06, fz, s, { emissive: 0.9 });
      voxel(parent, P.magenta, 0.05, 0.06, fz, s, { emissive: 0.9 });
      voxel(parent, P.foam, 0, 0.12, fz + 0.005, 0.08, { emissive: 0.8 });
    }
  }

  for (const cd of cardData) {
    // swing group: holds the card's fan SLOT (offset) + angle + bob
    const swing = pivot(fanCenter, cd.offsetX, cd.offsetY, 0);
    swing.rotation.y = cd.angle;
    // flip group inside for the reveal
    const flip = pivot(swing, 0, 0, 0);

    // card body (front faces +Z): foam face, abyss back
    box(flip, P.abyss, 0.8, 1.3, 0.04, 0, 0, 0);           // back/body
    box(flip, P.foam, 0.74, 1.24, 0.045, 0, 0, 0.005);     // foam face plate

    // 4 thin gold edge frames on the face
    box(flip, P.gold, 0.8, 0.05, 0.05, 0, 0.625, 0.01);    // top
    box(flip, P.gold, 0.8, 0.05, 0.05, 0, -0.625, 0.01);   // bottom
    box(flip, P.gold, 0.05, 1.3, 0.05, 0.375, 0, 0.01);    // right
    box(flip, P.gold, 0.05, 1.3, 0.05, -0.375, 0, 0.01);   // left

    buildCardFace(flip, cd.motif);

    cards.push({
      swing,
      flip,
      baseAngle: cd.angle,
      baseY: cd.offsetY,
      phase: cd.phase,
      isCenter: cd.motif === 'moon',
    });
  }

  // ---- gold sparkle particles ----
  const sparkleCount = 8;
  const sparkles: { mesh: THREE.Mesh; baseY: number; speed: number; sx: number; sz: number; phase: number }[] = [];
  for (let i = 0; i < sparkleCount; i++) {
    const ang = (i / sparkleCount) * TAU;
    const radius = 0.35 + (i % 3) * 0.12;
    const sx = Math.cos(ang) * radius;
    const sz = Math.sin(ang) * radius * 0.6 + 0.1;
    const baseY = 1.0 + (i % 4) * 0.18;
    const m = voxel(group, P.gold, sx, baseY, sz, 0.06, { emissive: 0.9 });
    m.material = (m.material as THREE.MeshToonMaterial).clone();
    sparkles.push({
      mesh: m,
      baseY,
      speed: 0.35 + (i % 3) * 0.08,
      sx,
      sz,
      phase: (i / sparkleCount) * TAU,
    });
  }

  const RISE_SPAN = 1.4;
  const RISE_BOTTOM = 0.9;

  group.rotation.y = Math.PI / 4;

  return {
    group,
    update(t) {
      // steady animation rate — hover only affects lift/scale
      const tt = t;

      // slow-fan + bob each card
      for (const c of cards) {
        const swingAmt = (8 * Math.PI) / 180; // +/-8deg
        c.swing.rotation.y = c.baseAngle + osc(tt, 3, c.phase) * swingAmt;
        c.swing.position.y = c.baseY + osc(tt, 3, c.phase + 1.2) * 0.08;

        // center card flips 180 every ~7s (reveal)
        if (c.isCenter) {
          const cycle = (tt % 7) / 7;
          // quick flip in last ~12% of the cycle, hold otherwise
          const flipT = cycle < 0.88 ? 0 : (cycle - 0.88) / 0.12;
          // ease and play forward-back so it returns to face
          const eased = 0.5 - 0.5 * Math.cos(flipT * TAU);
          c.flip.rotation.y = eased * Math.PI;
        }
      }

      // sparkles rise + twinkle + recycle
      for (const sp of sparkles) {
        const travel = (tt * sp.speed + sp.phase * 0.3) % RISE_SPAN;
        sp.mesh.position.y = RISE_BOTTOM + travel;
        sp.mesh.position.x = sp.sx + osc(tt, 2, sp.phase) * 0.04;
        sp.mesh.position.z = sp.sz + osc(tt, 2.4, sp.phase) * 0.04;
        const twinkle = 0.5 + 0.5 * Math.abs(osc(tt, 0.6, sp.phase));
        // NOTE: voxel() bakes size into mesh.scale, so set the ABSOLUTE world
        // size here (a tiny sparkle), not a ratio.
        const sc = 0.06 + 0.06 * twinkle;
        sp.mesh.scale.setScalar(sc);
        (sp.mesh.material as THREE.MeshToonMaterial).emissiveIntensity = 0.5 + 0.8 * twinkle;
      }

      // ribbon catches a periodic gold glint
      const glint = Math.max(0, osc(tt, 3.5));
      (badgeBox.material as THREE.MeshToonMaterial).emissive = emit(P.gold).emissive;
      (badgeBox.material as THREE.MeshToonMaterial).emissiveIntensity = 0.15 + 0.85 * glint * glint;
    },
  };
}
