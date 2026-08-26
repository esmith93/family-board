/**
 * Tests for the newsprint screen.
 *
 * The one that matters is the last: a photograph of a street has to come out
 * looking like a photograph of a street, which for a halftone means a spread
 * of dot sizes rather than a field of identical ones. A screen that turns
 * everything into the same dot is a grey rectangle, and the spec is explicit
 * that there are to be no grey rectangles.
 */

import { describe, expect, it } from 'vitest'
import { DEFAULT_INK, halftone, inkCoverage } from './photo'

/** A width x height RGBA field from a function of position, 0 black to 1 white. */
function field(width: number, height: number, f: (x: number, y: number) => number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = Math.round(Math.max(0, Math.min(1, f(x, y))) * 255)
      const i = (y * width + x) * 4
      out[i] = v
      out[i + 1] = v
      out[i + 2] = v
      out[i + 3] = 255
    }
  }
  return out
}

const W = 96
const H = 64

describe('the screen', () => {
  it('prints in two inks and nothing else', () => {
    const screened = halftone(field(W, H, (x, y) => ((x + y) % 40) / 40), W, H)
    const seen = new Set<string>()
    for (let i = 0; i < screened.length; i += 4) {
      seen.add(`${screened[i]},${screened[i + 1]},${screened[i + 2]}`)
    }
    expect(seen.size).toBe(2)
    expect(seen.has(DEFAULT_INK.ink.join(','))).toBe(true)
    expect(seen.has(DEFAULT_INK.paper.join(','))).toBe(true)
  })

  it('is opaque everywhere', () => {
    const screened = halftone(field(W, H, () => 0.5), W, H)
    for (let i = 3; i < screened.length; i += 4) expect(screened[i]).toBe(255)
  })

  it('treats transparent pixels as bare paper, not as black', () => {
    const empty = new Uint8ClampedArray(W * H * 4)
    const screened = halftone(empty, W, H)
    expect(inkCoverage(screened)).toBeLessThan(0.02)
  })

  it('puts more ink on a dark picture than a light one', () => {
    const dark = inkCoverage(halftone(field(W, H, () => 0.15), W, H))
    const mid = inkCoverage(halftone(field(W, H, () => 0.5), W, H))
    const light = inkCoverage(halftone(field(W, H, () => 0.9), W, H))
    expect(dark).toBeGreaterThan(mid)
    expect(mid).toBeGreaterThan(light)
    expect(light).toBeLessThan(0.12)
    expect(dark).toBeGreaterThan(0.55)
  })

  it('holds a gradient as a gradient', () => {
    // Left edge dark, right edge light. The ink has to follow.
    const screened = halftone(field(W, H, (x) => x / W), W, H)
    const leftHalf = new Uint8ClampedArray(screened.buffer.slice(0))
    let inkLeft = 0
    let inkRight = 0
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4
        const dark = Math.abs(leftHalf[i]! - DEFAULT_INK.ink[0]) < 8
        if (!dark) continue
        if (x < W / 2) inkLeft++
        else inkRight++
      }
    }
    expect(inkLeft).toBeGreaterThan(inkRight * 2)
  })

  it('screens at an angle rather than on the pixel grid', () => {
    // A 45 degree screen must not put every dot on the same row, or it reads
    // as scan lines. Count how many distinct rows carry the first dot column.
    const screened = halftone(field(W, H, () => 0.5), W, H, { cell: 4, angle: 45 })
    const rowsWithInk = new Set<number>()
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < 8; x++) {
        const i = (y * W + x) * 4
        if (Math.abs(screened[i]! - DEFAULT_INK.ink[0]) < 8) rowsWithInk.add(y)
      }
    }
    expect(rowsWithInk.size).toBeGreaterThan(H / 4)
  })

  it('is not a grey rectangle', () => {
    // The anti-placeholder rule, applied to the photograph. A picture of a
    // street has a sky, a road surface and things standing on it, so the
    // screened result must contain dots of genuinely different sizes.
    const streetish = field(W, H, (x, y) => {
      if (y < H * 0.3) return 0.92                      // sky
      if (y > H * 0.75) return 0.34                     // asphalt
      return 0.55 + 0.35 * Math.sin(x / 7) * Math.cos(y / 5)  // buildings and trees
    })
    const screened = halftone(streetish, W, H, { cell: 3 })

    // Measure ink coverage in a grid of patches. A flat screen gives every
    // patch the same number; a photograph does not.
    const patches: number[] = []
    for (let py = 0; py < 4; py++) {
      for (let px = 0; px < 6; px++) {
        let inked = 0
        let total = 0
        for (let y = py * (H / 4); y < (py + 1) * (H / 4); y++) {
          for (let x = px * (W / 6); x < (px + 1) * (W / 6); x++) {
            const i = ((y | 0) * W + (x | 0)) * 4
            if (Math.abs(screened[i]! - DEFAULT_INK.ink[0]) < 8) inked++
            total++
          }
        }
        patches.push(inked / total)
      }
    }
    const min = Math.min(...patches)
    const max = Math.max(...patches)
    expect(max - min, 'the photograph came out flat').toBeGreaterThan(0.3)
    // And it is a picture, not a silhouette: some of it is mid-tone.
    expect(patches.filter((p) => p > 0.15 && p < 0.85).length).toBeGreaterThan(6)
  })
})

describe('auto levels', () => {
  it('makes a dark picture readable instead of solid ink', () => {
    // The game's palette is a dark one. A crop of it screened at fixed levels
    // prints as a black rectangle, which is exactly the failure the spec bans.
    const dim = field(W, H, (x, y) => 0.06 + 0.14 * (0.5 + 0.5 * Math.sin(x / 6) * Math.cos(y / 4)))
    const flat = inkCoverage(halftone(dim, W, H))
    const levelled = inkCoverage(halftone(dim, W, H, { autoLevels: true }))
    expect(flat).toBeGreaterThan(0.85)
    expect(levelled).toBeGreaterThan(0.2)
    expect(levelled).toBeLessThan(0.8)
  })

  it('leaves a picture that already fills the range alone', () => {
    const full = field(W, H, (x) => x / W)
    const plain = inkCoverage(halftone(full, W, H))
    const levelled = inkCoverage(halftone(full, W, H, { autoLevels: true }))
    expect(Math.abs(plain - levelled)).toBeLessThan(0.12)
  })
})

describe('exposure', () => {
  it('reads a picture that is four fifths one shade', () => {
    // The corridor at year zero: a very large amount of asphalt at one value,
    // a bright kerb line, and almost nothing else. Stretching the levels alone
    // leaves this as a black rectangle with white streaks, which is what the
    // first attempt at the newspaper photograph actually looked like.
    const asphalt = field(W, H, (x, y) => {
      const onKerb = Math.abs((x + y) % 34) < 2
      if (onKerb) return 0.78
      return 0.33 + 0.02 * Math.sin(x * 1.7 + y)
    })
    const exposed = inkCoverage(halftone(asphalt, W, H, { autoLevels: true }))
    expect(exposed).toBeGreaterThan(0.3)
    expect(exposed).toBeLessThan(0.7)
  })

  it('inks roughly the fraction of the page it says it will', () => {
    // The calibration itself. A flat mid-grey, screened with a straight tone
    // curve, has to come out at about half ink and half paper. This is the
    // test that catches the dot radius being confused with the dot area.
    for (const [value, wanted] of [[0.25, 0.75], [0.5, 0.5], [0.75, 0.25]] as const) {
      const flat = field(W, H, () => value)
      const inked = inkCoverage(halftone(flat, W, H, { gamma: 1, blackPoint: 0, whitePoint: 1 }))
      expect(Math.abs(inked - wanted), `${value} grey printed at ${inked.toFixed(2)}`).toBeLessThan(0.09)
    }
  })

  it('still separates a dark subject from a light one', () => {
    const dark = field(W, H, (x) => 0.1 + 0.05 * Math.sin(x))
    const light = field(W, H, (x) => 0.8 + 0.05 * Math.sin(x))
    // With no range to work with the exposure leaves them where they are.
    expect(inkCoverage(halftone(dark, W, H))).toBeGreaterThan(
      inkCoverage(halftone(light, W, H)))
  })
})
