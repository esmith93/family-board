/**
 * One palette. Thirty-two colours, defined once, used by every sprite in the
 * game.
 *
 * Sprites are rasterised into INDEX buffers, not colour buffers, so day, dusk,
 * night and the seasons are a lookup-table swap over an already-drawn sprite
 * rather than a redraw. Changing the light costs 32 array reads, not a
 * repaint.
 *
 * The register is warm and slightly nostalgic - Sim Tower, not blueprint. Note
 * that there is no neutral grey anywhere in here: shadows are violet, concrete
 * is warm, and asphalt carries a blue cast. Grey is what a placeholder looks
 * like, so the palette does not contain any.
 */

/** Index 0 is always transparent. Indices 1..32 are the palette proper. */
export const TRANSPARENT = 0

export const PALETTE_INDEX = {
  shadow: 1,
  asphaltDark: 2,
  asphaltMid: 3,
  asphaltLight: 4,
  asphaltWorn: 5,
  lineYellow: 6,
  lineWhite: 7,
  concreteDark: 8,
  concreteMid: 9,
  concreteLight: 10,
  brickDark: 11,
  brickMid: 12,
  brickLight: 13,
  stuccoDark: 14,
  stuccoMid: 15,
  stuccoLight: 16,
  roofDark: 17,
  roofMid: 18,
  roofLight: 19,
  woodDark: 20,
  woodMid: 21,
  woodLight: 22,
  leafDark: 23,
  leafMid: 24,
  leafLight: 25,
  leafHigh: 26,
  glassDark: 27,
  glassMid: 28,
  glassLit: 29,
  signRed: 30,
  signBlue: 31,
  awningOrange: 32,
  // The sky. The isometric view paints it as a canvas gradient behind the
  // world, but a first-person camera has to put it IN the frame buffer, and
  // the frame buffer holds palette indices. So the sky gets three of them.
  skyHigh: 33,
  skyMid: 34,
  skyLow: 35,
} as const

export type PaletteName = keyof typeof PALETTE_INDEX
export const P = PALETTE_INDEX

/** Every material ramp, so a test can assert each has at least three values. */
export const MATERIAL_RAMPS: Readonly<Record<string, PaletteName[]>> = Object.freeze({
  asphalt: ['asphaltDark', 'asphaltMid', 'asphaltLight', 'asphaltWorn'],
  concrete: ['concreteDark', 'concreteMid', 'concreteLight'],
  brick: ['brickDark', 'brickMid', 'brickLight'],
  stucco: ['stuccoDark', 'stuccoMid', 'stuccoLight'],
  roof: ['roofDark', 'roofMid', 'roofLight'],
  wood: ['woodDark', 'woodMid', 'woodLight'],
  foliage: ['leafDark', 'leafMid', 'leafLight', 'leafHigh'],
  glass: ['glassDark', 'glassMid', 'glassLit'],
})

export interface Rgb { r: number; g: number; b: number }

const hex = (value: string): Rgb => ({
  r: parseInt(value.slice(1, 3), 16),
  g: parseInt(value.slice(3, 5), 16),
  b: parseInt(value.slice(5, 7), 16),
})

/** Midday. Every other light condition is derived from this one. */
const DAY: Readonly<Record<PaletteName, Rgb>> = Object.freeze({
  // A violet shadow, because a grey one reads as unfinished.
  shadow: hex('#3a3552'),

  // Asphalt carries a blue cast and gets lighter as it wears.
  asphaltDark: hex('#34323d'),
  asphaltMid: hex('#45434e'),
  asphaltLight: hex('#57555f'),
  asphaltWorn: hex('#6d6a74'),

  lineYellow: hex('#d9be6b'),
  lineWhite: hex('#dedacf'),

  // Warm concrete. Pavements are not grey either.
  concreteDark: hex('#7f796d'),
  concreteMid: hex('#9d978a'),
  concreteLight: hex('#beb8a8'),

  brickDark: hex('#743a30'),
  brickMid: hex('#985140'),
  brickLight: hex('#b66c54'),

  stuccoDark: hex('#aa845f'),
  stuccoMid: hex('#d0a97d'),
  stuccoLight: hex('#ecca9f'),

  roofDark: hex('#46565a'),
  roofMid: hex('#607573'),
  roofLight: hex('#809792'),

  woodDark: hex('#664330'),
  woodMid: hex('#8b6141'),
  woodLight: hex('#ae8057'),

  leafDark: hex('#2f4a2c'),
  leafMid: hex('#456a3a'),
  leafLight: hex('#6b904d'),
  leafHigh: hex('#91b163'),

  glassDark: hex('#47606f'),
  glassMid: hex('#6b8c9b'),
  glassLit: hex('#f1d58a'),

  signRed: hex('#c04539'),
  signBlue: hex('#3e6ba3'),
  awningOrange: hex('#c56f3d'),

  // Daylight values, kept for completeness. Every light overrides these.
  skyHigh: hex('#7fb4cf'),
  skyMid: hex('#a7cbdf'),
  skyLow: hex('#cfe3e4'),
})

export const PALETTE_NAMES = Object.keys(PALETTE_INDEX) as PaletteName[]
export const PALETTE_SIZE = PALETTE_NAMES.length

export type LightName = 'day' | 'dusk' | 'night' | 'overcast'
export type SeasonName = 'spring' | 'summer' | 'autumn' | 'winter'

export interface PaletteVariant {
  id: string
  light: LightName
  season: SeasonName
  /** Flat RGBA lookup table, 4 bytes per index, index 0 transparent. */
  lut: Uint8ClampedArray
}

interface Grade {
  /** Multiply. Below 1 darkens. */
  gain: Rgb
  /** Blend toward this colour by `tint`. */
  toward: Rgb
  tint: number
}

const LIGHT_GRADES: Readonly<Record<LightName, Grade>> = Object.freeze({
  day: { gain: { r: 1, g: 1, b: 1 }, toward: { r: 255, g: 240, b: 210 }, tint: 0.04 },
  // Low sun: everything warms, shadows lengthen into orange.
  dusk: { gain: { r: 1.02, g: 0.9, b: 0.78 }, toward: { r: 255, g: 168, b: 96 }, tint: 0.2 },
  // Not black - a deep blue. Nothing in a city is ever actually black.
  night: { gain: { r: 0.42, g: 0.45, b: 0.62 }, toward: { r: 28, g: 34, b: 70 }, tint: 0.42 },
  overcast: { gain: { r: 0.86, g: 0.88, b: 0.92 }, toward: { r: 176, g: 184, b: 196 }, tint: 0.18 },
})

/** Season shifts the foliage ramp and, in winter, the ground. */
const SEASON_LEAVES: Readonly<Record<SeasonName, Partial<Record<PaletteName, string>>>> = Object.freeze({
  spring: { leafDark: '#3b5a30', leafMid: '#547d3e', leafLight: '#7ea451', leafHigh: '#a6c46b' },
  summer: {},
  autumn: { leafDark: '#6b3f22', leafMid: '#a5652a', leafLight: '#c98c36', leafHigh: '#dfae55' },
  winter: {
    leafDark: '#4a4436', leafMid: '#5f5847', leafLight: '#7a7361', leafHigh: '#9a9382',
    concreteLight: '#d8d5cc', concreteMid: '#bab6ac',
  },
})

function blend(colour: Rgb, grade: Grade): Rgb {
  const r = colour.r * grade.gain.r
  const g = colour.g * grade.gain.g
  const b = colour.b * grade.gain.b
  return {
    r: r + (grade.toward.r - r) * grade.tint,
    g: g + (grade.toward.g - g) * grade.tint,
    b: b + (grade.toward.b - b) * grade.tint,
  }
}

/**
 * Build the lookup table for one light and season.
 *
 * Lit windows are exempt from the night grade - they are the light source, not
 * a lit surface - which is what makes a night scene read as a city rather than
 * as a dark picture of one.
 */
export function makePalette(light: LightName, season: SeasonName): PaletteVariant {
  const grade = LIGHT_GRADES[light]
  const seasonal = SEASON_LEAVES[season]
  const lut = new Uint8ClampedArray((PALETTE_SIZE + 1) * 4)

  for (let i = 0; i < PALETTE_NAMES.length; i++) {
    const name = PALETTE_NAMES[i]!
    const override = seasonal[name]
    const base = override ? hex(override) : DAY[name]

    let out: Rgb
    if (name === 'skyHigh' || name === 'skyMid' || name === 'skyLow') {
      // The sky is not a lit surface, it is the light. Grading it like a brick
      // would give a night sky the colour of a brick at night.
      const top = hex(SKY[light].top)
      const bottom = hex(SKY[light].bottom)
      out = name === 'skyHigh' ? top
        : name === 'skyLow' ? bottom
          : { r: (top.r + bottom.r) / 2, g: (top.g + bottom.g) / 2, b: (top.b + bottom.b) / 2 }
    } else if (name === 'glassLit') {
      // A lit window at night is brighter than in daylight, not dimmer.
      out = light === 'night' ? { r: 255, g: 226, b: 150 }
        : light === 'dusk' ? { r: 248, g: 216, b: 140 }
          : blend(base, grade)
    } else if (name === 'lineYellow' || name === 'lineWhite') {
      // Retroreflective paint holds its brightness under headlights.
      out = light === 'night' ? blend(base, { ...grade, gain: { r: 0.72, g: 0.72, b: 0.8 } }) : blend(base, grade)
    } else {
      out = blend(base, grade)
    }

    const offset = (PALETTE_INDEX[name]) * 4
    lut[offset] = out.r
    lut[offset + 1] = out.g
    lut[offset + 2] = out.b
    lut[offset + 3] = 255
  }
  // Index 0 stays fully transparent.
  lut[0] = 0; lut[1] = 0; lut[2] = 0; lut[3] = 0

  return { id: `${light}:${season}`, light, season, lut }
}

/** The sky is drawn as a gradient, not a sprite, so it has its own colours. */
export const SKY: Readonly<Record<LightName, { top: string; bottom: string }>> = Object.freeze({
  day: { top: '#7fb4cf', bottom: '#cfe3e4' },
  dusk: { top: '#5b5480', bottom: '#e8955c' },
  night: { top: '#141a38', bottom: '#2c3358' },
  overcast: { top: '#9aa6b0', bottom: '#c6ccce' },
})

export function rgbaString(variant: PaletteVariant, name: PaletteName): string {
  const o = PALETTE_INDEX[name] * 4
  return `rgb(${variant.lut[o]}, ${variant.lut[o + 1]}, ${variant.lut[o + 2]})`
}
