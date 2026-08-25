/**
 * A tiny software rasteriser that writes PALETTE INDICES, not colours.
 *
 * Everything visible in the game is drawn through this. Working in indices
 * rather than RGBA buys three things: pixel-exact edges with no canvas
 * antialiasing smearing the art, a genuine palette swap for day and season,
 * and the ability for a test to assert that a sprite actually uses a shading
 * ramp instead of one flat fill.
 */

import { PALETTE_SIZE, TRANSPARENT } from './palette'

export interface Bitmap {
  width: number
  height: number
  /** One palette index per pixel. 0 is transparent. */
  data: Uint8Array
}

export function makeBitmap(width: number, height: number): Bitmap {
  return { width, height, data: new Uint8Array(width * height) }
}

export function px(bmp: Bitmap, x: number, y: number, index: number): void {
  const ix = x | 0
  const iy = y | 0
  if (ix < 0 || iy < 0 || ix >= bmp.width || iy >= bmp.height) return
  bmp.data[iy * bmp.width + ix] = index
}

export function getPx(bmp: Bitmap, x: number, y: number): number {
  const ix = x | 0
  const iy = y | 0
  if (ix < 0 || iy < 0 || ix >= bmp.width || iy >= bmp.height) return TRANSPARENT
  return bmp.data[iy * bmp.width + ix]!
}

export function rect(bmp: Bitmap, x: number, y: number, w: number, h: number, index: number): void {
  const x0 = Math.max(0, x | 0)
  const y0 = Math.max(0, y | 0)
  const x1 = Math.min(bmp.width, (x | 0) + (w | 0))
  const y1 = Math.min(bmp.height, (y | 0) + (h | 0))
  for (let yy = y0; yy < y1; yy++) {
    bmp.data.fill(index, yy * bmp.width + x0, yy * bmp.width + x1)
  }
}

export function hline(bmp: Bitmap, x: number, y: number, w: number, index: number): void {
  rect(bmp, x, y, w, 1, index)
}

export function vline(bmp: Bitmap, x: number, y: number, h: number, index: number): void {
  rect(bmp, x, y, 1, h, index)
}

/** Bresenham. Used for wires, poles and diagonal trim. */
export function line(bmp: Bitmap, x0: number, y0: number, x1: number, y1: number, index: number): void {
  let ax = x0 | 0
  let ay = y0 | 0
  const bx = x1 | 0
  const by = y1 | 0
  const dx = Math.abs(bx - ax)
  const dy = -Math.abs(by - ay)
  const sx = ax < bx ? 1 : -1
  const sy = ay < by ? 1 : -1
  let err = dx + dy
  for (;;) {
    px(bmp, ax, ay, index)
    if (ax === bx && ay === by) break
    const e2 = 2 * err
    if (e2 >= dy) { err += dy; ax += sx }
    if (e2 <= dx) { err += dx; ay += sy }
  }
}

/**
 * The isometric ground tile: a 2:1 diamond, stepped two pixels across for
 * every one down so the edge reads as a clean pixel-art slope rather than a
 * jagged line.
 */
export function isoDiamond(bmp: Bitmap, ox: number, oy: number, w: number, h: number, index: number): void {
  const step = w / h
  const cx = ox + w / 2
  for (let y = 0; y < h; y++) {
    const t = y < h / 2 ? y : h - 1 - y
    const half = (t + 1) * step
    const x0 = Math.round(cx - half)
    const span = Math.round(half * 2)
    hline(bmp, x0, oy + y, span, index)
  }
}

/** The same diamond, but only its outline. For kerbs and tile joints. */
export function isoDiamondEdge(bmp: Bitmap, ox: number, oy: number, w: number, h: number, index: number): void {
  const step = w / h
  const cx = ox + w / 2
  for (let y = 0; y < h; y++) {
    const t = y < h / 2 ? y : h - 1 - y
    const half = (t + 1) * step
    const x0 = Math.round(cx - half)
    const span = Math.round(half * 2)
    for (let k = 0; k < step; k++) {
      px(bmp, x0 + k, oy + y, index)
      px(bmp, x0 + span - 1 - k, oy + y, index)
    }
  }
}

/** Scanline polygon fill. Used for roof planes and awnings. */
export function polygon(bmp: Bitmap, points: readonly [number, number][], index: number): void {
  if (points.length < 3) return
  let minY = Infinity
  let maxY = -Infinity
  for (const [, y] of points) {
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  minY = Math.max(0, Math.floor(minY))
  maxY = Math.min(bmp.height - 1, Math.ceil(maxY))

  const xs: number[] = []
  for (let y = minY; y <= maxY; y++) {
    xs.length = 0
    const scan = y + 0.5
    for (let i = 0; i < points.length; i++) {
      const a = points[i]!
      const b = points[(i + 1) % points.length]!
      const [ax, ay] = a
      const [bx, by] = b
      if ((ay <= scan && by > scan) || (by <= scan && ay > scan)) {
        xs.push(ax + ((scan - ay) / (by - ay)) * (bx - ax))
      }
    }
    xs.sort((p, q) => p - q)
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const x0 = Math.round(xs[i]!)
      const x1 = Math.round(xs[i + 1]!)
      hline(bmp, x0, y, Math.max(0, x1 - x0), index)
    }
  }
}

/**
 * A 4x4 ordered dither between two indices. This is how a 32-colour palette
 * produces more than 32 apparent tones without ever inventing a new colour -
 * the trick that makes limited-palette pixel art work.
 */
const BAYER_4 = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
]

export function ditherRect(
  bmp: Bitmap, x: number, y: number, w: number, h: number,
  low: number, high: number, amount: number,
): void {
  const threshold = Math.max(0, Math.min(16, Math.round(amount * 16)))
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      const b = BAYER_4[((yy & 3) << 2) | (xx & 3)]!
      px(bmp, x + xx, y + yy, b < threshold ? high : low)
    }
  }
}

/** Dither only where the bitmap already has ink, so shading follows a shape. */
export function ditherOver(
  bmp: Bitmap, x: number, y: number, w: number, h: number, high: number, amount: number,
): void {
  const threshold = Math.max(0, Math.min(16, Math.round(amount * 16)))
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      if (getPx(bmp, x + xx, y + yy) === TRANSPARENT) continue
      const b = BAYER_4[((yy & 3) << 2) | (xx & 3)]!
      if (b < threshold) px(bmp, x + xx, y + yy, high)
    }
  }
}

/**
 * Seeded speckle, for asphalt grain and worn concrete. Deterministic: the same
 * seed always produces the same wear pattern, so a given corridor always looks
 * like itself.
 */
export function speckle(
  bmp: Bitmap, x: number, y: number, w: number, h: number,
  index: number, density: number, seed: number,
): void {
  let state = (seed | 0) >>> 0
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      state = (state + 0x6d2b79f5) | 0
      let t = state
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296
      if (r >= density) continue
      if (getPx(bmp, x + xx, y + yy) === TRANSPARENT) continue
      px(bmp, x + xx, y + yy, index)
    }
  }
}

/** Draw `src` onto `dst` at an offset, skipping transparent pixels. */
export function blit(dst: Bitmap, src: Bitmap, ox: number, oy: number): void {
  for (let y = 0; y < src.height; y++) {
    const dy = oy + y
    if (dy < 0 || dy >= dst.height) continue
    for (let x = 0; x < src.width; x++) {
      const value = src.data[y * src.width + x]!
      if (value === TRANSPARENT) continue
      const dx = ox + x
      if (dx < 0 || dx >= dst.width) continue
      dst.data[dy * dst.width + dx] = value
    }
  }
}

/** Recolour every pixel of one index to another. Used for material variants. */
export function swapIndex(bmp: Bitmap, from: number, to: number): void {
  for (let i = 0; i < bmp.data.length; i++) if (bmp.data[i] === from) bmp.data[i] = to
}

/** Trim to the bounding box of non-transparent pixels. */
export function bounds(bmp: Bitmap): { x: number; y: number; w: number; h: number } {
  let minX = bmp.width
  let minY = bmp.height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < bmp.height; y++) {
    for (let x = 0; x < bmp.width; x++) {
      if (bmp.data[y * bmp.width + x] === TRANSPARENT) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  if (maxX < 0) return { x: 0, y: 0, w: 0, h: 0 }
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

/** The distinct palette indices a sprite uses. A test reads this. */
export function usedIndices(bmp: Bitmap): Set<number> {
  const used = new Set<number>()
  for (const value of bmp.data) if (value !== TRANSPARENT) used.add(value)
  return used
}

/**
 * The palette swap itself: an index buffer plus a lookup table, out comes
 * RGBA. Deliberately returns raw bytes rather than an ImageData so the whole
 * render core stays testable without a DOM.
 */
export function applyPalette(bmp: Bitmap, lut: Uint8ClampedArray): Uint8ClampedArray {
  const out = new Uint8ClampedArray(bmp.width * bmp.height * 4)
  for (let i = 0; i < bmp.data.length; i++) {
    const index = bmp.data[i]!
    if (index === TRANSPARENT || index > PALETTE_SIZE) continue
    const o = index * 4
    const p = i * 4
    out[p] = lut[o]!
    out[p + 1] = lut[o + 1]!
    out[p + 2] = lut[o + 2]!
    out[p + 3] = lut[o + 3]!
  }
  return out
}

/** A tiny deterministic generator for sprite variation. */
export function spriteRng(seed: number): () => number {
  let state = (seed | 0) >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
