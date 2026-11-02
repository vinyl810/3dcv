import * as THREE from 'three';
import { makeSelectionClock, type BuiltModel } from '../../../kit';
import { landmarkModel, metaPoint, glowAll, characterModel, TAU } from '../common';
import { applyPose, buildRig, crouch, easeInOut, every, hopCurve, type Pose } from '../rig';

/**
 * About — Daewon on the hub dais, fully rigged (hips → torso → head / arms;
 * hips → thigh → shin → foot). Idle: breathing, a slow weight shift, the odd
 * glance/nod, a periodic wave (shoulder raise + elbow bend + forearm swing)
 * while the other hand holds the tablet. Click: crouch → jump → knees absorb.
 */
export function build(): BuiltModel {
  const m = landmarkModel('about');
  const ch = characterModel(m, 'about_char'); // fine-voxel character
  const rig = buildRig(ch, '', m.s); // lifts stay in landmark-voxel units
  const { plate, tablet } = m.parts;
  // shoulders: twist → forward → abduct (see wave below)
  rig.bones.upperArmL.rotation.order = 'ZXY';
  rig.bones.upperArmR.rotation.order = 'ZXY';
  const plateBase = plate.position.clone();

  // The tablet is held in the right hand: parent it to the hand bone, grip at
  // its inner edge, counter-rotated so the screen faces forward in the hold pose.
  const HOLD_SHOULDER = -0.35, HOLD_ELBOW = -1.3;
  rig.bones.handR.add(tablet);
  tablet.position.set(0.6 * m.s, -1.4 * m.s, 0.4 * m.s);
  tablet.rotation.set(-(HOLD_SHOULDER + HOLD_ELBOW), 0, 0.12); // undo the hold pose so the screen faces front, level

  const light = new THREE.PointLight(new THREE.Color().setHex(0xffca7a, THREE.SRGBColorSpace), 0, 6, 1.4);
  light.position.copy(metaPoint('about', 'lamp', m.s));
  light.userData.nightBase = 3.2;
  m.group.add(light);
  plate.userData.noShadow = true;

  const clock = makeSelectionClock();
  const pose: Pose = {};
  const arr = (k: keyof Pose): [number, number, number] => {
    let a = pose[k] as [number, number, number] | undefined;
    if (!a) { a = [0, 0, 0]; (pose as Record<string, unknown>)[k] = a; }
    return a;
  };
  const BONE_KEYS = ['hips', 'torso', 'head', 'upperArmL', 'forearmL', 'handL', 'upperArmR', 'forearmR', 'handR',
    'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'] as const;
  const lift: [number, number, number] = [0, 0, 0];

  return {
    group: m.group,
    nightLight: light,
    update: (t, hover, selected) => {
      const sel = clock(t, selected);
      for (const k of BONE_KEYS) { const a = arr(k); a[0] = 0; a[1] = 0; a[2] = 0; }
      lift[0] = 0; lift[1] = 0; lift[2] = 0;
      pose.lift = lift;

      // --- idle body: breathing + slow weight shift (feet stay planted) ---
      pose.breath = 1 + 0.022 * Math.sin((t / 3.6) * TAU);
      const w = Math.sin((t / 5.2) * TAU);
      arr('hips')[2] = 0.035 * w;
      lift[0] = 0.25 * w;
      arr('thighL')[2] = -0.035 * w;
      arr('thighR')[2] = -0.035 * w;
      arr('torso')[2] = -0.05 * w;
      arr('torso')[0] = 0.02 * Math.sin((t / 3.6) * TAU);
      { // playful: a soft bob on the beat + head sway
        const b = Math.abs(Math.sin((t / 1.4) * Math.PI));
        lift[1] += 0.35 * b;
        arr('head')[2] += 0.06 * Math.sin((t / 1.4) * Math.PI);
      }

      // --- head: face lifted toward the high camera, an occasional glance + nod ---
      const glance = every(t, 7.5, 2.4, 1.5) * (Math.floor(t / 7.5) % 2 ? 0.5 : -0.4);
      const nod = every(t, 11, 0.9, 6);
      arr('head')[0] = -0.24 + 0.1 * nod;
      arr('head')[1] = glance;
      arr('head')[2] = 0.04 * Math.sin((t / 4.3) * TAU) + arr('head')[2];

      // --- tablet arm (R): elbow bent, holding the tablet up ---
      arr('upperArmR')[0] = HOLD_SHOULDER + 0.03 * Math.sin((t / 3.6) * TAU);
      arr('upperArmR')[2] = -0.12;
      arr('forearmR')[0] = HOLD_ELBOW;

      // --- wave arm (L): relaxed hang ↔ wave (shoulder raise, elbow bend, forearm swing) ---
      const wave = sel >= 0 ? 1 : easeInOut(Math.min(1, every(t, 8, 3.6, 0.5) * 1.6));
      // upper arm (ZXY order): twist the arm outward, then abduct it sideways,
      // so the elbow bends in the frontal plane and the forearm points up.
      arr('upperArmL')[0] = -0.05 - 0.2 * wave;
      arr('upperArmL')[1] = 1.5 * wave;
      arr('upperArmL')[2] = 0.12 + (1.3 - 0.12) * wave;
      // elbow flexion now swings the forearm side to side = the wave
      arr('forearmL')[0] = -0.25 + (-1.45 + 0.25) * wave - wave * 0.42 * Math.sin((t / 0.9) * TAU);
      arr('handL')[0] = -wave * 0.25 * Math.sin((t / 0.9) * TAU - 0.9);

      // --- click: anticipation crouch → jump → land (knees absorb) ---
      const h = hopCurve(sel, 6);
      if (sel >= 0) {
        crouch(pose, rig, h.knee, h.lift);
        // cheer: the waving arm shoots up while airborne
        arr('upperArmL')[2] += 1.3 * h.air;
        arr('forearmL')[0] += 0.9 * h.air; // straighten toward a fist-pump
        arr('head')[0] -= 0.15 * h.air;
      }
      applyPose(rig, pose);

      plate.position.y = plateBase.y + Math.sin((t / 2.6) * TAU) * 1.2 * m.s;
      plate.rotation.y = Math.sin((t / 5) * TAU) * 0.25 + (sel >= 0 ? TAU * (1 - Math.exp(-sel * 3)) : 0);

      const burst = sel >= 0 ? Math.exp(-sel * 1.6) : 0;
      glowAll(m, (0.85 + 0.15 * Math.sin((t / 1.8) * TAU)) * (1 + 0.6 * hover + 1.2 * burst));
    },
  };
}
