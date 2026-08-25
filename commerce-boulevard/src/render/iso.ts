/**
 * Isometric projection.
 *
 * The world is a grid of 12-foot squares - one traffic lane wide, which is why
 * a lane, a parking bay and a bike lane all land on exact tile boundaries and
 * the road never looks approximate.
 */

/** One world tile is one traffic lane wide. */
export const TILE_FT = 12
/** Base tile footprint on screen, 2:1. */
export const TILE_W = 64
export const TILE_H = 32
/** Screen pixels per foot of height, for buildings and props. */
export const FT_PER_FLOOR = 11
export const PX_PER_FLOOR = 22

export interface Point { x: number; y: number }

/** Grid coordinates to screen, before the camera is applied. */
export function toScreen(gx: number, gy: number): Point {
  return {
    x: (gx - gy) * (TILE_W / 2),
    y: (gx + gy) * (TILE_H / 2),
  }
}

/** Screen coordinates back to the grid. Used for hit testing. */
export function toGrid(sx: number, sy: number): Point {
  const a = sx / (TILE_W / 2)
  const b = sy / (TILE_H / 2)
  return { x: (a + b) / 2, y: (b - a) / 2 }
}

/** Painter's order. Lower sorts first, so it is drawn behind. */
export function depthOf(gx: number, gy: number, layer = 0): number {
  return (gx + gy) * 16 + layer
}

export interface Camera {
  /** Centre of the view, in grid coordinates. */
  gx: number
  gy: number
  zoom: number
  viewWidth: number
  viewHeight: number
}

export function makeCamera(viewWidth: number, viewHeight: number): Camera {
  return { gx: 0, gy: 0, zoom: 1, viewWidth, viewHeight }
}

/** Where a grid cell lands in the viewport. */
export function project(camera: Camera, gx: number, gy: number): Point {
  const world = toScreen(gx, gy)
  const centre = toScreen(camera.gx, camera.gy)
  return {
    x: (world.x - centre.x) * camera.zoom + camera.viewWidth / 2,
    y: (world.y - centre.y) * camera.zoom + camera.viewHeight / 2,
  }
}

/** The grid cell under a viewport point. */
export function unproject(camera: Camera, sx: number, sy: number): Point {
  const centre = toScreen(camera.gx, camera.gy)
  const worldX = (sx - camera.viewWidth / 2) / camera.zoom + centre.x
  const worldY = (sy - camera.viewHeight / 2) / camera.zoom + centre.y
  return toGrid(worldX, worldY)
}

/**
 * The range of grid cells that can touch the viewport.
 *
 * Generous on the far edges: a six-storey building is drawn well above its own
 * tile, so a cell can be off the bottom of the view and still be visible.
 */
export function visibleRange(camera: Camera, gridW: number, gridH: number, margin = 6): {
  x0: number; x1: number; y0: number; y1: number
} {
  const corners: Point[] = [
    unproject(camera, 0, 0),
    unproject(camera, camera.viewWidth, 0),
    unproject(camera, 0, camera.viewHeight),
    unproject(camera, camera.viewWidth, camera.viewHeight),
  ]
  let minX = Infinity; let maxX = -Infinity
  let minY = Infinity; let maxY = -Infinity
  for (const p of corners) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y)
  }
  // Buildings rise, so extend the far side by enough rows to catch them.
  const rise = Math.ceil((PX_PER_FLOOR * 7) / (TILE_H / 2))
  return {
    x0: Math.max(0, Math.floor(minX) - margin),
    x1: Math.min(gridW - 1, Math.ceil(maxX) + margin + rise),
    y0: Math.max(0, Math.floor(minY) - margin),
    y1: Math.min(gridH - 1, Math.ceil(maxY) + margin + rise),
  }
}
