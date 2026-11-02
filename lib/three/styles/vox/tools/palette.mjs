/**
 * The ONE MagicaVoxel palette shared by every .vox in public/models/vox/.
 * (Authoring-only — not imported by the app; the palette is embedded in each
 * .vox file's RGBA chunk, so the runtime reads it from the file.)
 *
 * Laid out in rows of 8 = one ramp per row in MagicaVoxel's palette panel,
 * dark → light. Ramps are HUE-SHIFTED: darks drift cool (blue/violet), lights
 * drift warm (yellow) — the classic pixel-art trick that keeps shading lively.
 * Ground ramps (grass/earth/rock/sand) are deliberately muted; landmark accent
 * ramps (cloth/red/gold/pink/violet/teal) are cleaner + more saturated so the
 * CV landmarks pop as the focal points.
 *
 * Index 1..112 = ordinary lit colours. 113..120 = EMISSIVE (MATL _emit) —
 * glowing bulbs/screens. 121..124 = GLASS (MATL _glass) — translucent holo.
 */

const ROWS = {
  grass: ['#1f3d3a', '#2a5444', '#356b4c', '#4a8452', '#65a05a', '#8bbd66', '#b5d67a', '#dbe89a'],
  leaf: ['#16303c', '#1d4446', '#26594c', '#347252', '#4a8c58', '#68a65e', '#90c068', '#bcd87c'],
  earth: ['#2b2233', '#3f2c3a', '#573a3e', '#714c43', '#8d6249', '#a97d55', '#c49b68', '#dcbb84'],
  rock: ['#1d1d2c', '#2b2b3e', '#3c3d52', '#505368', '#686c80', '#858a9b', '#a6abb8', '#cbcfd6'],
  sand: ['#8a6a58', '#ad8a68', '#c9a77a', '#dfc08f', '#ecd6a8', '#f5e8c8', '#fff6e2', '#ffffff'],
  wood: ['#3a2430', '#55303a', '#72423f', '#90583f', '#ad7347', '#c78f55', '#dfad6b', '#f0cb8a'],
  water: ['#142c48', '#1b4160', '#215a78', '#28768c', '#34949c', '#4fb4ac', '#7fd2c0', '#c2efe0'],
  blue: ['#1c2048', '#263064', '#304484', '#3d5ca4', '#5079c2', '#6e98da', '#96baea', '#c4dcf6'],
  red: ['#3c1830', '#5e2038', '#84293e', '#ab3a42', '#cf5149', '#e8725a', '#f59c78', '#fcc7a4'],
  gold: ['#4a2a20', '#74401e', '#a0601e', '#c88426', '#e4aa34', '#f4ca4c', '#fde27a', '#fff3b8'],
  pink: ['#321a3e', '#4e2152', '#702b66', '#943878', '#b74c8a', '#d6699c', '#ec92b4', '#f8c0d4'],
  violet: ['#221c48', '#30286a', '#44378e', '#5a4bae', '#7462c8', '#9483dc', '#b6a8ec', '#d8d0f8'],
  // hair (3) · skin (4) · ink
  body: ['#2a1a22', '#3e2830', '#5a3a3a', '#8c5a4c', '#c48466', '#e2a888', '#f4c8a4', '#1a1824'],
  teal: ['#123a40', '#18525a', '#1f6e74', '#2a8c8e', '#3eaaa6', '#62c8be', '#94e0d2', '#c8f4ea'],
  // EMISSIVE row: lamp · hot · screen · screenHi · pinkGlow · violetGlow · goldGlow · greenGlow
  glow: ['#ffc86a', '#fff0c0', '#5ff0f0', '#c8fff8', '#ff7ab8', '#b49cff', '#ffd24a', '#a8ff96'],
  // GLASS row: holo · window · waterGlass · iceGlass (rest unused)
  glass: ['#7ff0ff', '#bfe6ff', '#5fc8d0', '#e0f4ff', '#000000', '#000000', '#000000', '#000000'],
};

const ORDER = Object.keys(ROWS);

/** Named palette indices: C.grass[0..7], C.glow[2], ... (1-based vox indices). */
export const C = {};
/** palette[i] = 0xRRGGBB for vox index i (index 0 = empty). */
export const PALETTE = new Array(256).fill(0);
ORDER.forEach((name, row) => {
  C[name] = ROWS[name].map((hex, k) => {
    const idx = row * 8 + k + 1;
    PALETTE[idx] = parseInt(hex.slice(1), 16);
    return idx;
  });
});

// Short aliases for the special rows.
export const G = {
  lamp: C.glow[0], hot: C.glow[1], screen: C.glow[2], screenHi: C.glow[3],
  pinkGlow: C.glow[4], violetGlow: C.glow[5], goldGlow: C.glow[6], greenGlow: C.glow[7],
  holo: C.glass[0], window: C.glass[1], waterGlass: C.glass[2], ice: C.glass[3],
  hairD: C.body[0], hair: C.body[1], hairL: C.body[2],
  skinS: C.body[3], skinM: C.body[4], skin: C.body[5], skinL: C.body[6], ink: C.body[7],
};

/**
 * MATL materials written into every file. MagicaVoxel shows these natively
 * (Emit / Glass); the runtime turns _emit into an emissive MeshToonMaterial and
 * _glass into a translucent one.
 */
export const MATERIALS = new Map();
C.glow.forEach((i) => MATERIALS.set(i, { _type: '_emit', _emit: '1', _flux: '1' }));
[C.glass[0], C.glass[1], C.glass[2], C.glass[3]].forEach((i) =>
  MATERIALS.set(i, { _type: '_glass', _trans: '0.55', _alpha: '0.55' }),
);
