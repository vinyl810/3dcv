import * as THREE from 'three';
import { GRADIENT, color } from '../../kit';
import type { EnvPart } from '../../environment';
import { C } from './palette';
import { Grid, V, hash3, meshGrid, litMat } from './vox';
import { norm, rSand, rRim, rOuter, FALLS, fallAt } from './shape';

/**
 * Voxel water: a moat ring around the island (held by the rock rim), spilling
 * through notches into narrow, tapered, stepped waterfalls that dissolve into
 * voxel mist. Wave crests, shoreline foam and the falling-water stripes are all
 * animated in the vertex shader from a per-voxel `aCell` attribute (one
 * uniform per frame → zero CPU per voxel). Foam/mist cubes = one InstancedMesh.
 */

function waterMaterial(kind: 'sea' | 'fall') {
  const m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: GRADIENT });
  (m as THREE.Material as { flatShading?: boolean }).flatShading = true;
  const uTime = { value: 0 };
  const crest = color(C.waterShallow);
  const foam = color(C.foam);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.uniforms.uCrest = { value: crest };
    sh.uniforms.uFoam = { value: foam };
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute vec3 aCell;\nuniform float uTime;\nuniform vec3 uCrest;\nuniform vec3 uFoam;\n' +
          'float vh(vec3 c){ return fract(sin(dot(c, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }',
      )
      .replace(
        '#include <color_vertex>',
        '#include <color_vertex>\n' +
          (kind === 'sea'
            ? // travelling swells → quantised crest bands; shoreline foam flickers
              '{ float w = sin(aCell.x*0.23 + aCell.z*0.13 - uTime*1.3) + 0.75*sin(-aCell.x*0.11 + aCell.z*0.21 - uTime*0.9 + 1.7);\n' +
              '  float cr = step(1.2, w) + 0.5*step(0.75, w);\n' +
              '  vColor.rgb = mix(vColor.rgb, uCrest, min(cr, 1.0)*0.55);\n' +
              '  float sh = aCell.y;\n' + // shore weight stored in aCell.y (see below)
              '  float fz = sh * (0.55 + 0.45*sin(uTime*2.1 + vh(floor(aCell))*6.28));\n' +
              '  vColor.rgb = mix(vColor.rgb, uFoam, step(0.62, fz)); }'
            : // falling water: bright streaks scroll downward, per-column offset
              '{ float col = vh(vec3(aCell.x, 0.0, aCell.z));\n' +
              '  float s = fract((aCell.y + uTime*9.0 + col*13.0) / 9.0);\n' +
              '  vColor.rgb = mix(vColor.rgb, uFoam, step(0.8, s)*0.8);\n' +
              '  vColor.rgb = mix(vColor.rgb, uCrest, step(0.45, s)*(1.0-step(0.8, s))*0.35); }'),
      );
  };
  m.customProgramCacheKey = () => 'vox-water-' + kind;
  return { mat: m, uTime };
}

export function buildVoxelOcean(): EnvPart {
  const group = new THREE.Group();
  const R = 100;

  /* ------------------------------------------------ moat water (j = 0) --- */
  const sea = new Grid(-R, R, 0, 0, -R, R);
  const deep = sea.c(C.waterDeep, 0.03);
  const mid = sea.c(C.water, 0.03);
  const shallow = sea.c(C.waterShallow, 0.03);
  for (let k = -R; k <= R; k++)
    for (let i = -R; i <= R; i++) {
      const x = i * V, z = k * V;
      const d = norm(x, z);
      const rs = rSand(x, z), rr = rRim(x, z), ro = rOuter(x, z);
      const inFall = fallAt(x, z) >= 0;
      if (d < rs - 0.02 || d >= (inFall ? ro + 0.02 : rr)) continue;
      const u = (d - rs) / Math.max(0.3, rr - rs); // 0 shore → 1 rim
      const c = u < 0.22 ? shallow : u < 0.55 || inFall ? mid : deep;
      sea.set(i, 0, k, c);
    }
  // Only top faces (+ the outward lip face in the fall notches) are ever seen.
  const seaPart = meshGrid(sea, {
    ao: 0,
    cellAttr: true,
    faces: (x, _y, z, f) => f === 2 || (fallAt(x * V, z * V) >= 0 && f !== 3),
  });
  // Re-purpose aCell.y as a shoreline weight (all water is j = 0 anyway).
  const seaMesh = seaPart.lit!;
  const cellA = seaMesh.geometry.getAttribute('aCell') as THREE.BufferAttribute;
  for (let n = 0; n < cellA.count; n++) {
    const x = cellA.getX(n) * V, z = cellA.getZ(n) * V;
    const dd = norm(x, z) - rSand(x, z);
    const dr = rRim(x, z) - norm(x, z);
    const w = Math.max(Math.exp(-((dd / 0.28) ** 2)), 0.75 * Math.exp(-((dr / 0.22) ** 2)));
    cellA.setY(n, w);
  }
  const seaW = waterMaterial('sea');
  seaMesh.material = seaW.mat;
  group.add(seaPart.group);

  /* ------------------------------------------------ waterfalls ---------- */
  const fallG = new Grid(-R, R, -56, 0, -R, R);
  const fw = fallG.c(C.waterShallow, 0.02);
  const fwm = fallG.c(C.water, 0.02);
  const foamSpots: { x: number; y: number; z: number; kind: 0 | 1 }[] = [];
  for (const F of FALLS) {
    const ux = Math.cos(F.a), uz = Math.sin(F.a);
    const px = -uz, pz = ux; // lateral
    // polar distance to the lip along this direction
    let tl = 9;
    while (tl < 13 && norm(ux * tl, uz * tl) < rOuter(ux * tl, uz * tl)) tl += V / 2;
    const LEN = 46;
    for (let j = 0; j >= -LEN; j--) {
      const f = -j / LEN;
      const step = Math.floor(-j / 11) * V * 1.2; // stepped outward drift
      const t0 = tl + 0.1 + step;
      const hw = F.half * 0.95 * (1 - 0.5 * f);
      const thick = j > -2 ? 0.45 : 2.2 * V;
      for (let r = 0; r <= thick; r += V * 0.5)
        for (let sOff = -hw; sOff <= hw; sOff += V * 0.5) {
          const x = ux * (t0 + r) + px * sOff, z = uz * (t0 + r) + pz * sOff;
          const i = Math.round(x / V), k = Math.round(z / V);
          // dissolve into mist near the bottom (pixel dither)
          if (f > 0.7 && hash3(i, j, k, 3) < (f - 0.7) / 0.3) continue;
          fallG.set(i, j, k, Math.abs(sOff) > hw - V ? fw : hash3(i, j, k, 5) < 0.5 ? fwm : fw);
        }
    }
    for (let n = 0; n < 9; n++) {
      const sOff = (hash3(n, 1, F.a * 100) - 0.5) * 2 * F.half;
      const r = tl + (hash3(n, 2, F.a * 100) - 0.3) * 0.5;
      foamSpots.push({ x: ux * r + px * sOff, y: 0.14 + hash3(n, 3, 1) * 0.06, z: uz * r + pz * sOff, kind: 0 });
    }
    for (let n = 0; n < 12; n++) {
      const sOff = (hash3(n, 4, F.a * 100) - 0.5) * 2 * F.half * 1.6;
      const r = tl + 0.4 + Math.floor(LEN / 11) * V * 1.2 + (hash3(n, 5, F.a * 100) - 0.5) * 0.9;
      foamSpots.push({ x: ux * r + px * sOff, y: -LEN * V + 0.2 + hash3(n, 6, 1) * 0.4, z: uz * r + pz * sOff, kind: 1 });
    }
  }
  const fallPart = meshGrid(fallG, { ao: 0, cellAttr: true });
  const fallW = waterMaterial('fall');
  fallPart.lit!.material = fallW.mat;
  group.add(fallPart.group);

  /* ------------------------------------------------ foam / mist cubes --- */
  const cubeG = new Grid(0, 0, 0, 0, 0, 0);
  cubeG.set(0, 0, 0, cubeG.c(C.foam, 0));
  const cubeGeo = meshGrid(cubeG, { ao: 0, pivot: [0, 0.5, 0] }).lit!.geometry;
  const foam = new THREE.InstancedMesh(cubeGeo, litMat(), foamSpots.length);
  foam.userData.noShadow = true;
  foam.frustumCulled = false;
  group.add(foam);
  const phase = foamSpots.map((_, n) => hash3(n, 9, 9));
  const rate = foamSpots.map((_, n) => 0.35 + hash3(n, 10, 9) * 0.4);
  const m4 = new THREE.Matrix4();

  return {
    group,
    update: (t) => {
      seaW.uTime.value = t;
      fallW.uTime.value = t;
      for (let n = 0; n < foamSpots.length; n++) {
        const sp = foamSpots[n];
        const c = (t * rate[n] + phase[n]) % 1;
        let sc: number, y: number;
        if (sp.kind === 0) {
          // lip churn: pop in, hold, pop out
          sc = c < 0.15 ? c / 0.15 : c < 0.7 ? 1 : Math.max(0, 1 - (c - 0.7) / 0.15);
          sc *= 0.9;
          y = sp.y + Math.sin(t * 3 + n) * 0.02;
        } else {
          // mist: rises and shrinks away
          sc = 1.8 * (1 - c);
          y = sp.y + c * 0.9;
        }
        m4.makeScale(sc, sc, sc);
        m4.setPosition(sp.x, y, sp.z);
        foam.setMatrixAt(n, m4);
      }
      foam.instanceMatrix.needsUpdate = true;
    },
  };
}
