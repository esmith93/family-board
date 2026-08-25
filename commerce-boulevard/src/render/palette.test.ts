/**
 * The palette is a fixed resource and the whole look depends on it holding its
 * shape, so these are stricter than they look.
 */
import { describe, expect, it } from 'vitest'
import {
  makePalette, MATERIAL_RAMPS, PALETTE_INDEX, PALETTE_NAMES, PALETTE_SIZE, SKY, TRANSPARENT,
  type PaletteName,
} from './palette'

const day = makePalette('day', 'summer')
const night = makePalette('night', 'summer')

function colourOf(variant: ReturnType<typeof makePalette>, name: PaletteName): [number, number, number] {
  const o = PALETTE_INDEX[name] * 4
  return [variant.lut[o]!, variant.lut[o + 1]!, variant.lut[o + 2]!]
}

const luminance = ([r, g, b]: [number, number, number]): number => 0.2126 * r + 0.7152 * g + 0.0722 * b

describe('the palette', () => {
  it('is about thirty-two colours', () => {
    expect(PALETTE_SIZE).toBeGreaterThanOrEqual(28)
    expect(PALETTE_SIZE).toBeLessThanOrEqual(36)
  })

  it('assigns every name a unique index, with zero left transparent', () => {
    const indices = PALETTE_NAMES.map((n) => PALETTE_INDEX[n])
    expect(new Set(indices).size).toBe(indices.length)
    expect(indices).not.toContain(TRANSPARENT)
    expect(day.lut[3]).toBe(0)
  })

  it('contains no neutral grey at all', () => {
    // Grey is what a placeholder looks like. Shadows are violet, concrete is
    // warm, asphalt carries a blue cast - and a test keeps it that way.
    for (const name of PALETTE_NAMES) {
      const [r, g, b] = colourOf(day, name)
      const spread = Math.max(r, g, b) - Math.min(r, g, b)
      expect(spread, `${name} is neutral grey`).toBeGreaterThan(6)
    }
  })

  it('gives every material at least three distinct values', () => {
    for (const [material, ramp] of Object.entries(MATERIAL_RAMPS)) {
      expect(ramp.length, material).toBeGreaterThanOrEqual(3)
      const seen = new Set(ramp.map((name) => colourOf(day, name).join(',')))
      expect(seen.size, `${material} ramp has duplicate values`).toBe(ramp.length)
    }
  })

  it('orders every ramp from dark to light', () => {
    for (const [material, ramp] of Object.entries(MATERIAL_RAMPS)) {
      for (let i = 1; i < ramp.length; i++) {
        expect(luminance(colourOf(day, ramp[i]!)), `${material}: ${ramp[i]} vs ${ramp[i - 1]}`)
          .toBeGreaterThan(luminance(colourOf(day, ramp[i - 1]!)))
      }
    }
  })
})

describe('light and season are a lookup swap', () => {
  it('darkens every surface at night', () => {
    for (const name of PALETTE_NAMES) {
      if (name === 'glassLit') continue
      expect(luminance(colourOf(night, name)), `${name} should be darker at night`)
        .toBeLessThan(luminance(colourOf(day, name)))
    }
  })

  it('makes a lit window brighter at night, not dimmer', () => {
    expect(luminance(colourOf(night, 'glassLit'))).toBeGreaterThan(luminance(colourOf(day, 'glassLit')))
  })

  it('holds road markings up under headlights', () => {
    // Retroreflective paint does not dim the way the road around it does.
    const paintRatio = luminance(colourOf(night, 'lineWhite')) / luminance(colourOf(day, 'lineWhite'))
    const roadRatio = luminance(colourOf(night, 'asphaltMid')) / luminance(colourOf(day, 'asphaltMid'))
    expect(paintRatio).toBeGreaterThan(roadRatio)
  })

  it('shifts the foliage ramp with the season and leaves the rest alone', () => {
    const autumn = makePalette('day', 'autumn')
    expect(colourOf(autumn, 'leafMid')).not.toEqual(colourOf(day, 'leafMid'))
    expect(colourOf(autumn, 'brickMid')).toEqual(colourOf(day, 'brickMid'))
    // Autumn leaves are warmer than summer ones.
    expect(colourOf(autumn, 'leafMid')[0]).toBeGreaterThan(colourOf(day, 'leafMid')[0])
  })

  it('puts snow on the pavements in winter', () => {
    const winter = makePalette('day', 'winter')
    expect(luminance(colourOf(winter, 'concreteLight')))
      .toBeGreaterThan(luminance(colourOf(day, 'concreteLight')))
  })

  it('gives each variant a distinct identity, so the cache can key on it', () => {
    const ids = new Set([
      makePalette('day', 'summer').id, makePalette('night', 'summer').id,
      makePalette('day', 'winter').id, makePalette('dusk', 'autumn').id,
    ])
    expect(ids.size).toBe(4)
  })

  it('has a sky for every light condition', () => {
    for (const light of ['day', 'dusk', 'night', 'overcast'] as const) {
      expect(SKY[light].top).toMatch(/^#[0-9a-f]{6}$/i)
      expect(SKY[light].bottom).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})
