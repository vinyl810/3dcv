import * as THREE from 'three';
import { P, box, cyl, sphere, pivot, mat, osc, lerp, clamp, type BuiltModel } from '../kit';

export function buildDebate(): BuiltModel {
  const group = new THREE.Group();

  // ---- circular debate stage ----
  cyl(group, P.slate, 1.1, 1.1, 0.15, 0, 0.075, 0, 24);
  // amber spotlight ring on the top edge (thin emissive tube)
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.0, 0.05, 8, 28),
    mat(P.amber),
  );
  ring.material = mat(P.amber).clone();
  (ring.material as THREE.MeshToonMaterial).emissive.setHex(P.amber);
  (ring.material as THREE.MeshToonMaterial).emissiveIntensity = 0.9;
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.16;
  group.add(ring);

  // ---- builder for a robot on a podium ----
  function buildRobot(
    side: number, // -1 left, +1 right
    bodyHex: number,
    visorHex: number,
    hunch: number,
  ) {
    const root = pivot(group, side * 0.55, 0, 0);

    // podium
    box(root, P.earth, 0.4, 0.5, 0.4, 0, 0.25 + 0.15, 0);

    // bot pivot (sits on podium top ~y0.65) — this bounces while talking
    const bot = pivot(root, 0, 0.65, 0);
    bot.rotation.z = hunch; // slight tilt for the "hunched" one

    // body
    box(bot, bodyHex, 0.45, 0.6, 0.35, 0, 0.3, 0);
    // head
    box(bot, P.foam, 0.4, 0.4, 0.4, 0, 0.8, 0);
    // visor band (emissive) — clone so we can animate brightness
    const visor = box(bot, visorHex, 0.34, 0.1, 0.02, 0, 0.82, 0.2, {
      emissive: 0.6,
    });
    visor.material = (visor.material as THREE.MeshToonMaterial).clone();

    // antennas + bulbs
    box(bot, P.slate, 0.03, 0.18, 0.03, -0.1, 1.08, 0);
    box(bot, P.slate, 0.03, 0.18, 0.03, 0.1, 1.08, 0);
    sphere(bot, visorHex, 0.05, -0.1, 1.2, 0, 6, { emissive: 0.8 });
    sphere(bot, visorHex, 0.05, 0.1, 1.2, 0, 6, { emissive: 0.8 });

    return { bot, visor, baseY: 0.65 };
  }

  const robotA = buildRobot(-1, P.slate, P.magenta, 0); // left, happy
  const robotB = buildRobot(1, P.slate, P.synapse, -0.12); // right, hunched

  // ---- speech bubbles (floating, between the bots) ----
  function buildBubble(side: number, glyphHex: number, isHeart: boolean) {
    const bub = pivot(group, side * 0.3, 1.35, 0.25);
    box(bub, P.foam, 0.32, 0.26, 0.08, 0, 0, 0);
    // tail
    box(bub, P.foam, 0.06, 0.06, 0.06, side * 0.1, -0.16, 0);
    if (isHeart) {
      // heart voxel cluster (magenta)
      box(bub, glyphHex, 0.07, 0.07, 0.04, -0.05, 0.04, 0.05, { emissive: 0.5 });
      box(bub, glyphHex, 0.07, 0.07, 0.04, 0.05, 0.04, 0.05, { emissive: 0.5 });
      box(bub, glyphHex, 0.13, 0.07, 0.04, 0, -0.02, 0.05, { emissive: 0.5 });
      box(bub, glyphHex, 0.05, 0.05, 0.04, 0, -0.08, 0.05, { emissive: 0.5 });
    } else {
      // "?" — dot + stem (synapse)
      box(bub, glyphHex, 0.12, 0.05, 0.04, 0, 0.06, 0.05, { emissive: 0.5 });
      box(bub, glyphHex, 0.05, 0.06, 0.04, 0.04, 0.0, 0.05, { emissive: 0.5 });
      box(bub, glyphHex, 0.05, 0.05, 0.04, 0, -0.05, 0.05, { emissive: 0.5 });
      box(bub, glyphHex, 0.05, 0.05, 0.04, 0, -0.13, 0.05, { emissive: 0.5 });
    }
    bub.scale.setScalar(0);
    return bub;
  }

  const bubbleA = buildBubble(-1, P.magenta, true);
  const bubbleB = buildBubble(1, P.synapse, false);

  // ---- token streams: 5 cubes per side arcing toward center ----
  const TOKENS = 5;
  function buildStream(hex: number) {
    const cubes: THREE.Mesh[] = [];
    for (let i = 0; i < TOKENS; i++) {
      const c = box(group, hex, 0.07, 0.07, 0.07, 0, 0, 0, { emissive: 0.7 });
      cubes.push(c);
    }
    return cubes;
  }
  const streamA = buildStream(P.surfCyan);
  const streamB = buildStream(P.surfCyan);

  // start (visor height) and end (opponent) anchors
  const startA = new THREE.Vector3(-0.55, 1.45, 0.2);
  const endA = new THREE.Vector3(0.55, 1.45, 0.2);
  const startB = new THREE.Vector3(0.55, 1.45, 0.2);
  const endB = new THREE.Vector3(-0.55, 1.45, 0.2);

  function placeArc(cube: THREE.Mesh, s: THREE.Vector3, e: THREE.Vector3, u: number) {
    cube.position.x = lerp(s.x, e.x, u);
    cube.position.z = lerp(s.z, e.z, u);
    const arc = Math.sin(u * Math.PI) * 0.35; // bow upward
    cube.position.y = lerp(s.y, e.y, u) + arc;
  }

  group.rotation.y = Math.PI / 4;

  const CYCLE = 3; // seconds each speaker holds the floor

  function applyRobot(
    r: { bot: THREE.Group; visor: THREE.Mesh; baseY: number },
    active: boolean,
    t: number,
    localPhase: number,
    hover: number,
  ) {
    const vm = r.visor.material as THREE.MeshToonMaterial;
    if (active) {
      // talk bounce (2-frame feel via fast square-ish osc)
      r.bot.position.y = r.baseY + 0.04 * Math.sign(osc(t, 0.18, localPhase));
      vm.emissiveIntensity = 1.4 + 0.4 * Math.abs(osc(t, 0.4)) + hover * 0.4;
    } else {
      r.bot.position.y = r.baseY;
      vm.emissiveIntensity = 0.35;
    }
  }

  return {
    group,
    update(t, hover) {
      // who speaks: alternate every CYCLE seconds
      const phase = (t % (CYCLE * 2)) / CYCLE; // 0..2
      const aActive = phase < 1;

      // --- bubble pop-in timing (0.3s ramp at start of each turn) ---
      const turnT = t % CYCLE; // time since current turn started
      const pop = clamp(turnT / 0.3, 0, 1);
      const popEase = pop * pop * (3 - 2 * pop);

      bubbleA.scale.setScalar(aActive ? popEase : 0);
      bubbleB.scale.setScalar(aActive ? 0 : popEase);
      // gentle float on the visible bubble
      bubbleA.position.y = 1.35 + (aActive ? 0.03 * osc(t, 1.2) : 0);
      bubbleB.position.y = 1.35 + (!aActive ? 0.03 * osc(t, 1.2, 1) : 0);

      applyRobot(robotA, aActive, t, 0, hover);
      applyRobot(robotB, !aActive, t, 1.5, hover);

      // --- token streams flow from the active speaker to opponent ---
      const speed = 0.35; // steady flow rate (hover no longer scales time)
      for (let i = 0; i < TOKENS; i++) {
        const u = (t * speed + i / TOKENS) % 1;
        // active speaker's stream visible & flowing; the other parked off-arc
        if (aActive) {
          placeArc(streamA[i], startA, endA, u);
          streamA[i].visible = true;
          streamB[i].visible = false;
        } else {
          placeArc(streamB[i], startB, endB, u);
          streamB[i].visible = true;
          streamA[i].visible = false;
        }
      }

      // spotlight ring pulse
      (ring.material as THREE.MeshToonMaterial).emissiveIntensity =
        0.7 + 0.3 * Math.abs(osc(t, 2)) + hover * 0.3;
    },
  };
}
