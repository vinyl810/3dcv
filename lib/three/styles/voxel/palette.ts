/**
 * Voxel-style palette (sRGB hex). Derived from the kit's "Muted Twilight" P but
 * split into value tiers: GROUND stays mid-value / low-saturation so the
 * landmarks (brighter, warmer, more saturated) pop as focal points. Accents
 * are used sparingly.
 */
export const C = {
  // ---- ground tier (mid value, calm) ----
  grass: 0x5f9a6c,
  grassLight: 0x6faa76,
  grassDark: 0x4b8160,
  moss: 0x3f7056,
  sand: 0xd8b98d,
  sandDark: 0xc09a70,
  dirt: 0x7a5640,
  dirtDark: 0x5c4034,
  rock: 0x6b6478,
  rockDark: 0x4d4a5e,
  rockLight: 0x8a8296,

  // ---- water ----
  water: 0x2f8ea0,
  waterDeep: 0x23708a,
  waterShallow: 0x4fb7c2,
  foam: 0xf1f7f2,

  // ---- landmark tier (brighter, saturated) ----
  wood: 0xb07a4c,
  woodLight: 0xcf9a62,
  woodDark: 0x7e5236,
  plank: 0xe2b77c,
  paper: 0xf6eedb,
  paperShade: 0xdcd2bb,
  ink: 0x2b2d42,
  navy: 0x26304f,
  slate: 0x434b63,
  steel: 0x8c97ad,
  white: 0xf4f4ee,
  gold: 0xf1c75b,
  goldDark: 0xc8963e,
  amber: 0xffb45e,
  red: 0xe0604f,
  coral: 0xf08a6c,
  magenta: 0xd8699b,
  pink: 0xf2a0b8,
  violet: 0x8f7be0,
  teal: 0x2f9aa8,
  cyan: 0x6fe0e6,
  blue: 0x4f86d8,
  green: 0x6cc072,
  leaf: 0x4f9a5c,
  leafLight: 0x74bb6c,
  leafDark: 0x3a7a50,
  pine: 0x2f6e55,
  pineLight: 0x46896a,

  // ---- character ----
  skin: 0xf7cba2,
  skinShade: 0xd99b74,
  hair: 0x3b2a22,
  hoodie: 0x2c7f8e,
  hoodieDark: 0x1f5c6a,
  jeans: 0x3c4a78,
  shoe: 0x2a2633,
} as const;
