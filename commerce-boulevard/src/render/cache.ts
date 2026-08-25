/**
 * Two-level sprite cache.
 *
 * Level one holds the INDEX bitmap: the drawing work, done once per distinct
 * sprite for the life of the session. Level two holds a canvas per palette
 * variant, produced from that bitmap by a lookup table.
 *
 * Which means changing from day to dusk, or summer to autumn, never redraws a
 * single sprite - it re-runs a 32-entry LUT over pixels that were rasterised
 * long ago.
 */

import { applyPalette, type Bitmap } from './bitmap'
import type { PaletteVariant } from './palette'
import type { Sprite } from './sprites/buildings'

type CanvasLike = OffscreenCanvas | HTMLCanvasElement

export interface CachedSprite {
  bitmap: Bitmap
  anchorX: number
  anchorY: number
  canvases: Map<string, CanvasLike>
}

function makeCanvas(width: number, height: number): CanvasLike {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(Math.max(1, width), Math.max(1, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, width)
  canvas.height = Math.max(1, height)
  return canvas
}

export class SpriteCache {
  private readonly sprites = new Map<string, CachedSprite>()
  /** Sprites rasterised this session, for the debug overlay. */
  public rasterised = 0
  public painted = 0

  /** Fetch a sprite, rasterising it once on first request. */
  get(key: string, draw: () => Sprite): CachedSprite {
    const existing = this.sprites.get(key)
    if (existing) return existing
    const drawn = draw()
    this.rasterised++
    const entry: CachedSprite = {
      bitmap: drawn.bmp,
      anchorX: drawn.anchorX,
      anchorY: drawn.anchorY,
      canvases: new Map(),
    }
    this.sprites.set(key, entry)
    return entry
  }

  /** The sprite painted for one palette variant. This is the palette swap. */
  canvasFor(entry: CachedSprite, variant: PaletteVariant): CanvasLike {
    const existing = entry.canvases.get(variant.id)
    if (existing) return existing

    const { bitmap } = entry
    const canvas = makeCanvas(bitmap.width, bitmap.height)
    const ctx = canvas.getContext('2d') as (CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null)
    if (ctx) {
      const rgba = applyPalette(bitmap, variant.lut)
      const image = ctx.createImageData(Math.max(1, bitmap.width), Math.max(1, bitmap.height))
      image.data.set(rgba)
      ctx.putImageData(image, 0, 0)
    }
    entry.canvases.set(variant.id, canvas)
    this.painted++
    return canvas
  }

  get size(): number {
    return this.sprites.size
  }

  /** Drop painted canvases for variants that are no longer in use. */
  trimVariants(keep: ReadonlySet<string>): void {
    for (const entry of this.sprites.values()) {
      for (const id of [...entry.canvases.keys()]) {
        if (!keep.has(id)) entry.canvases.delete(id)
      }
    }
  }
}
