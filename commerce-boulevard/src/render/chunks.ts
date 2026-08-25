/**
 * Ground chunk baking.
 *
 * The ground is tens of thousands of tiles and the cost of drawing it is one
 * canvas call per tile - which measurement showed is the single most expensive
 * thing the renderer does, at roughly four microseconds a call whatever the
 * scale. So the ground is baked in blocks of 12x12 tiles: four thousand calls
 * a frame become about thirty.
 *
 * A chunk is baked as an INDEX bitmap, exactly like a sprite, so it goes
 * through the same palette lookup and day still turns to night without
 * anything being redrawn.
 */

import { applyPalette, blit, makeBitmap, type Bitmap } from './bitmap'
import { TILE_H, TILE_W } from './iso'
import type { PaletteVariant } from './palette'

export const CHUNK = 12

type CanvasLike = OffscreenCanvas | HTMLCanvasElement

export interface GroundChunk {
  cx: number
  cy: number
  bitmap: Bitmap
  /** Screen position of the chunk's top-left pixel, before the camera. */
  originX: number
  originY: number
  canvases: Map<string, CanvasLike>
  lastUsed: number
}

function makeCanvas(width: number, height: number): CanvasLike {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(Math.max(1, width), Math.max(1, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, width)
  canvas.height = Math.max(1, height)
  return canvas
}

export function chunkOrigin(cx: number, cy: number): { x: number; y: number } {
  const x0 = cx * CHUNK
  const y0 = cy * CHUNK
  return {
    x: (x0 - y0 - CHUNK + 1) * (TILE_W / 2) - TILE_W / 2,
    y: (x0 + y0) * (TILE_H / 2),
  }
}

export class ChunkCache {
  private readonly chunks = new Map<string, GroundChunk>()
  private clock = 0
  public baked = 0

  constructor(private readonly limit = 56) {}

  /**
   * Fetch a baked chunk, building it on first request.
   * `tileAt` returns the sprite bitmap for a cell, or null for empty ground.
   */
  get(
    cx: number, cy: number,
    tileAt: (gx: number, gy: number) => Bitmap | null,
  ): GroundChunk {
    const key = `${cx},${cy}`
    const existing = this.chunks.get(key)
    if (existing) {
      existing.lastUsed = ++this.clock
      return existing
    }

    const origin = chunkOrigin(cx, cy)
    const bitmap = makeBitmap(CHUNK * TILE_W, CHUNK * TILE_H)
    const x0 = cx * CHUNK
    const y0 = cy * CHUNK

    // Back to front within the chunk, so the tiles overlap the way they do on
    // the full grid.
    for (let sum = 0; sum <= (CHUNK - 1) * 2; sum++) {
      for (let dx = 0; dx < CHUNK; dx++) {
        const dy = sum - dx
        if (dy < 0 || dy >= CHUNK) continue
        const tile = tileAt(x0 + dx, y0 + dy)
        if (!tile) continue
        const sx = (x0 + dx - (y0 + dy)) * (TILE_W / 2) - TILE_W / 2 - origin.x
        const sy = (x0 + dx + y0 + dy) * (TILE_H / 2) - origin.y
        blit(bitmap, tile, sx, sy)
      }
    }

    const chunk: GroundChunk = {
      cx, cy, bitmap, originX: origin.x, originY: origin.y,
      canvases: new Map(), lastUsed: ++this.clock,
    }
    this.chunks.set(key, chunk)
    this.baked++
    this.evict()
    return chunk
  }

  /** The chunk painted for one palette variant. */
  canvasFor(chunk: GroundChunk, variant: PaletteVariant): CanvasLike {
    const existing = chunk.canvases.get(variant.id)
    if (existing) return existing
    const canvas = makeCanvas(chunk.bitmap.width, chunk.bitmap.height)
    const ctx = canvas.getContext('2d') as (CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null)
    if (ctx) {
      const rgba = applyPalette(chunk.bitmap, variant.lut)
      const image = ctx.createImageData(chunk.bitmap.width, chunk.bitmap.height)
      image.data.set(rgba)
      ctx.putImageData(image, 0, 0)
    }
    chunk.canvases.set(variant.id, canvas)
    return canvas
  }

  /** Drop the least recently used chunks once the cache is over budget. */
  private evict(): void {
    if (this.chunks.size <= this.limit) return
    const entries = [...this.chunks.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed)
    const excess = this.chunks.size - this.limit
    for (let i = 0; i < excess; i++) this.chunks.delete(entries[i]![0])
  }

  clear(): void {
    this.chunks.clear()
  }

  get size(): number { return this.chunks.size }
}
