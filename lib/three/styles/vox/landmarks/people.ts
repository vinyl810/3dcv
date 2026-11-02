import { characterModel, TAU } from '../common';
import { applyPose, buildRig, crouch, every, hopCurve, legBend, type Pose, type Rig } from '../rig';

/**
 * The three involvement people (two mentees + the speaker), fully rigged.
 * Idle: breathing, weight shift, glances, relaxed arms; mentees clap in short
 * bouts, the speaker gestures. Click (`sel` = s since click): staggered
 * crouch → hop → land, then a cheer with alternating knee steps.
 * Returns the per-frame update (t seconds, sel ≥ 0 while selected else −1).
 */
const BONE_KEYS = ['hips', 'torso', 'head', 'upperArmL', 'forearmL', 'handL', 'upperArmR', 'forearmR', 'handR',
  'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'] as const;

export function buildPeople(m: Parameters<typeof characterModel>[0]): (t: number, sel: number) => void {
  const crowd = characterModel(m, 'involvement_people');
  const rigs: { rig: Rig; pose: Pose; lift: [number, number, number] }[] = [0, 1, 2].map((i) => {
    const rig = buildRig(crowd, `p${i}_`, m.s);
    const pose: Pose = {};
    for (const k of BONE_KEYS) (pose as Record<string, [number, number, number]>)[k] = [0, 0, 0];
    const lift: [number, number, number] = [0, 0, 0];
    pose.lift = lift;
    return { rig, pose, lift };
  });
  return (t, sel) => {
    rigs.forEach(({ rig, pose, lift }, i) => {
        const P = pose as Record<string, [number, number, number]>;
        for (const k of BONE_KEYS) { const a = P[k]; a[0] = 0; a[1] = 0; a[2] = 0; }
        lift[0] = 0; lift[1] = 0; lift[2] = 0;
        const ph = i * 1.9;

        // idle body
        pose.breath = 1 + 0.025 * Math.sin((t / 3.2) * TAU + ph);
        const w = Math.sin((t / 4.6) * TAU + ph);
        P.hips[2] = 0.04 * w; lift[0] = 0.2 * w;
        P.thighL[2] = -0.04 * w; P.thighR[2] = -0.04 * w;
        P.torso[2] = -0.05 * w;
        { lift[1] += 0.3 * Math.abs(Math.sin((t / 1.2) * Math.PI + ph)); P.head[2] += 0.07 * Math.sin((t / 1.2) * Math.PI + ph); }
        P.head[0] = -0.22;
        // speaker looks at the audience; mentees glance at the speaker now and then
        P.head[1] = i === 2 ? 0.35 * Math.sin((t / 5) * TAU) : every(t, 6, 2, ph) * (i === 0 ? -0.5 : 0.5);
        // relaxed arms: hang a little out, soft elbows
        P.upperArmL[2] = 0.1; P.upperArmR[2] = -0.1;
        P.upperArmL[0] = 0.04 * Math.sin((t / 3.2) * TAU + ph); P.upperArmR[0] = -P.upperArmL[0];
        P.forearmL[0] = -0.25; P.forearmR[0] = -0.25;

        if (i < 2) {
          // CLAP bouts (mentees): arms forward + in, forearms up, hands meet in front
          const c = every(t, 9, 2.4, i * 4.5);
          if (c > 0) {
            const clap = 0.5 + 0.5 * Math.sin(t * TAU * 2.6);
            P.upperArmL[0] += -0.8 * c; P.upperArmR[0] += -0.8 * c;
            P.upperArmL[2] += (-0.55 - 0.2 * clap) * c; P.upperArmR[2] += (0.55 + 0.2 * clap) * c;
            P.forearmL[0] += -1.0 * c; P.forearmR[0] += -1.0 * c;
          }
        } else {
          // speaker: an open-hand gesture toward the audience every few seconds
          const g = every(t, 4.5, 2.2, 1);
          P.upperArmL[0] += -0.7 * g; P.upperArmL[2] += 0.25 * g;
          P.forearmL[0] += -0.9 * g - 0.25 * g * Math.sin(t * TAU * 1.2);
          P.handL[0] = 0.3 * g;
        }

        // click: staggered hop, then cheer with stepping knees
        const s = sel >= 0 ? sel - i * 0.15 : -1;
        if (s >= 0) {
          const h = hopCurve(s, i === 2 ? 3 : 5);
          if (h.knee > 0 || h.lift > 0) crouch(pose, rig, h.knee, h.lift);
          const cheer = Math.min(1, s / 0.3) * Math.exp(-Math.max(0, s - 1.6) * 1.5);
          if (cheer > 0.01) {
            P.upperArmL[0] = -0.3 * cheer; P.upperArmR[0] = -0.3 * cheer;
            P.upperArmL[2] = 0.1 + 2.3 * cheer + 0.15 * Math.sin(s * 14) * cheer;
            P.upperArmR[2] = -0.1 - 2.3 * cheer - 0.15 * Math.sin(s * 14 + 1) * cheer;
            P.forearmL[0] = -0.25 - 0.6 * cheer; P.forearmR[0] = -0.25 - 0.6 * cheer;
            P.head[0] = -0.22 - 0.15 * cheer;
            // step in place on alternating knees after landing (only for the mentees on the floor)
            if (s > 0.95 && i < 2) {
              const st = Math.sin((s - 0.95) * TAU * 1.6);
              legBend(pose, rig, 'L', 0.9 * Math.max(0, st) * cheer);
              legBend(pose, rig, 'R', 0.9 * Math.max(0, -st) * cheer);
            }
          }
        }
        applyPose(rig, pose);
      });

  };
}
