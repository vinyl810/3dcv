import { P } from '../../kit';

/**
 * 'kit' style palette. Kenney packs ship flat, named materials (leafsGreen,
 * woodBark, metal, carpet…) in a candy teal/orange scheme; every one of them is
 * remapped here onto ONE harmonious palette close to the site's `P`:
 *  - the ground (grass/leaves/stone) is muted + mid-value,
 *  - landmarks get the warm, saturated accents (wood, red, gold, amber),
 *  - darks are hue-shifted cool (indigo/slate), never brown-black.
 */
export const K = {
  // ground
  grass: 0x6da36e,
  grassLight: 0x82b67c,
  grassDark: 0x4f8a5f,
  moss: 0x3f7258,
  sand: 0xe3c193,
  sandDark: 0xc9a274,
  // foliage
  leaf: 0x5c9a63,
  leafDark: 0x3d7360,
  leafTuft: 0x6aa66c,
  // rock (cool lavender greys)
  stone: 0xa3a1b8,
  stoneDark: 0x7f7c9b,
  rock: 0x7d6b72,
  rockDeep: 0x4c4560,
  rockDeeper: 0x332f4a,
  earth: 0x8a6048,
  // wood
  wood: 0xd39a62,
  woodDark: 0xa66d47,
  bark: 0x7d5541,
  barkDark: 0x664536,
  woodInner: 0xebcfa2,
  // man-made
  metal: 0xc7cedb,
  metalMid: 0x6a7388,
  metalDark: 0x3a4254,
  cream: 0xf3ecdc,
  red: P.signalRed,
  redDark: 0xb24e4a,
  blue: 0x5b7fd1,
  purple: P.synapse,
  pink: P.magenta,
  gold: P.gold,
  amber: P.amber,
  tan: 0xeab489,
  plant: 0x5fae73,
  // water
  sea: 0x2f8796,
  seaDeep: 0x23687c,
  cyan: P.surfCyan,
  foam: P.foam,
  screen: 0x15303f,
} as const;

/** Kenney material name -> palette hex. Unknown names fall back to cream. */
export const MAT_MAP: Record<string, number> = {
  // nature kit
  grass: K.leafTuft,
  leafsGreen: K.leaf,
  leafsDark: K.leafDark,
  leafsFall: K.amber,
  woodBark: K.bark,
  woodBarkDark: K.barkDark,
  woodBirch: K.cream,
  woodInner: K.woodInner,
  wood: K.wood,
  woodDark: K.woodDark,
  dirt: K.earth,
  dirtDark: K.bark,
  stone: K.stone,
  stoneDark: K.stoneDark,
  water: K.cyan,
  colorRed: K.red,
  colorRedDark: K.redDark,
  colorPurple: K.purple,
  colorYellow: K.gold,
  colorTan: K.tan,
  colorWhite: K.cream,
  corn: K.gold,
  _defaultMat: K.cream,
  // furniture kit
  metal: K.metal,
  metalLight: K.cream,
  metalMedium: K.metalMid,
  metalDark: K.metalDark,
  carpet: K.red,
  carpetDarker: K.redDark,
  carpetWhite: K.cream,
  carpetBlue: K.blue,
  plant: K.plant,
  lamp: K.amber,
  fur: K.woodDark,
  glass: K.cyan,
};
