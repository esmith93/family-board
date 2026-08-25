/** The rasteriser everything else is drawn with. */
import { describe, expect, it } from 'vitest'
import {
  applyPalette, blit, bounds, ditherRect, getPx, isoDiamond, line, makeBitmap, polygon, px, rect,
  speckle, spriteRng, swapIndex, usedIndices,
} from './bitmap'
import { makePalette, PALETTE_INDEX, TRANSPARENT } from './palette'

describe('primitives', () => {
  it('clips to the bitmap instead of throwing', () => {
    const bmp = makeBitmap(8, 8)
    px(bmp, -5, 3, 4)
    px(bmp, 100, 3, 4)
    rect(bmp, -4, -4, 20, 20, 7)
    expect(getPx(bmp, 0, 0)).toBe(7)
    expect(getPx(bmp, 7, 7)).toBe(7)
    expect(getPx(bmp, -1, 0)).toBe(TRANSPARENT)
  })

  it('draws a line between its endpoints', () => {
    const bmp = makeBitmap(16, 16)
    line(bmp, 1, 1, 14, 8, 3)
    expect(getPx(bmp, 1, 1)).toBe(3)
    expect(getPx(bmp, 14, 8)).toBe(3)
  })

  it('fills a polygon', () => {
    const bmp = makeBitmap(16, 16)
    polygon(bmp, [[2, 2], [13, 2], [13, 13], [2, 13]], 5)
    expect(getPx(bmp, 8, 8)).toBe(5)
    expect(getPx(bmp, 0, 0)).toBe(TRANSPARENT)
  })
})

describe('the isometric diamond', () => {
  const bmp = makeBitmap(64, 32)
  isoDiamond(bmp, 0, 0, 64, 32, 9)

  it('leaves the corners empty', () => {
    for (const [x, y] of [[0, 0], [63, 0], [0, 31], [63, 31]] as [number, number][]) {
      expect(getPx(bmp, x, y)).toBe(TRANSPARENT)
    }
  })

  it('is widest at its waist and narrowest at its points', () => {
    const widthAt = (y: number): number => {
      let count = 0
      for (let x = 0; x < 64; x++) if (getPx(bmp, x, y) !== TRANSPARENT) count++
      return count
    }
    expect(widthAt(15)).toBe(64)
    expect(widthAt(0)).toBe(4)
    expect(widthAt(31)).toBe(4)
  })

  it('is symmetric about both axes', () => {
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 64; x++) {
        expect(getPx(bmp, x, y)).toBe(getPx(bmp, 63 - x, y))
        expect(getPx(bmp, x, y)).toBe(getPx(bmp, x, 31 - y))
      }
    }
  })

  it('tiles without gaps: two diamonds meeting share no empty seam', () => {
    const pair = makeBitmap(128, 64)
    isoDiamond(pair, 0, 0, 64, 32, 1)
    isoDiamond(pair, 32, 16, 64, 32, 2)
    // The shared edge is covered by one or the other.
    expect(getPx(pair, 63, 31)).not.toBe(TRANSPARENT)
  })
})

describe('shading helpers', () => {
  it('dithers between two values', () => {
    const bmp = makeBitmap(8, 8)
    ditherRect(bmp, 0, 0, 8, 8, 3, 4, 0.5)
    const used = usedIndices(bmp)
    expect(used.has(3)).toBe(true)
    expect(used.has(4)).toBe(true)
  })

  it('speckles deterministically and only over existing ink', () => {
    const make = (): number[] => {
      const bmp = makeBitmap(16, 16)
      rect(bmp, 0, 0, 8, 16, 2)
      speckle(bmp, 0, 0, 16, 16, 5, 0.5, 1234)
      return Array.from(bmp.data)
    }
    expect(make()).toEqual(make())
    const bmp = makeBitmap(16, 16)
    rect(bmp, 0, 0, 8, 16, 2)
    speckle(bmp, 0, 0, 16, 16, 5, 1, 99)
    // Nothing appeared on the empty half.
    expect(getPx(bmp, 12, 8)).toBe(TRANSPARENT)
  })

  it('blits without carrying transparency across', () => {
    const dst = makeBitmap(8, 8)
    rect(dst, 0, 0, 8, 8, 1)
    const src = makeBitmap(4, 4)
    px(src, 1, 1, 6)
    blit(dst, src, 2, 2)
    expect(getPx(dst, 3, 3)).toBe(6)
    expect(getPx(dst, 2, 2)).toBe(1)
  })

  it('swaps one index for another', () => {
    const bmp = makeBitmap(4, 4)
    rect(bmp, 0, 0, 4, 4, 3)
    swapIndex(bmp, 3, 8)
    expect(getPx(bmp, 2, 2)).toBe(8)
  })

  it('reports the bounding box of what was drawn', () => {
    const bmp = makeBitmap(16, 16)
    rect(bmp, 4, 5, 3, 2, 1)
    expect(bounds(bmp)).toEqual({ x: 4, y: 5, w: 3, h: 2 })
  })
})

describe('the palette swap', () => {
  it('maps indices through the lookup table and leaves zero transparent', () => {
    const bmp = makeBitmap(2, 1)
    px(bmp, 0, 0, PALETTE_INDEX.brickMid)
    const variant = makePalette('day', 'summer')
    const rgba = applyPalette(bmp, variant.lut)
    const o = PALETTE_INDEX.brickMid * 4
    expect(rgba[0]).toBe(variant.lut[o])
    expect(rgba[3]).toBe(255)
    // The untouched pixel stays fully transparent.
    expect(rgba[7]).toBe(0)
  })

  it('produces different colours for different light without touching the bitmap', () => {
    const bmp = makeBitmap(1, 1)
    px(bmp, 0, 0, PALETTE_INDEX.brickMid)
    const before = Array.from(bmp.data)
    const day = applyPalette(bmp, makePalette('day', 'summer').lut)
    const night = applyPalette(bmp, makePalette('night', 'summer').lut)
    expect(Array.from(day)).not.toEqual(Array.from(night))
    // The sprite itself was never redrawn.
    expect(Array.from(bmp.data)).toEqual(before)
  })
})

describe('sprite randomness', () => {
  it('repeats for a seed and differs between seeds', () => {
    const a = spriteRng(7)
    const b = spriteRng(7)
    const c = spriteRng(8)
    const draw = (r: () => number): number[] => Array.from({ length: 20 }, () => r())
    expect(draw(a)).toEqual(draw(b))
    expect(draw(spriteRng(7))).not.toEqual(draw(c))
  })
})
