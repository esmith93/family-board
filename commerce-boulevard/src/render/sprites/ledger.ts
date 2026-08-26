/**
 * The corridor drawn as what it pays and what it costs.
 *
 * One column per parcel. The solid part is the revenue that parcel produces
 * per acre; the ring around it is what the city spends per acre to serve it.
 * A column that reaches its ring pays its way. One that stops short does not,
 * and the empty box above it is the difference.
 *
 * There is deliberately no colour semantics in this: nothing is green for good
 * and red for bad, because the shape already says it and a legend that told
 * the player how to feel about a number would be the game arguing. A parcel
 * that pays no tax because it is a park is drawn as a plinth with no ring,
 * since it was never supposed to.
 */

import { line, makeBitmap, px, rect, type Bitmap } from '../bitmap'
import { P } from '../palette'
import { TILE_H, TILE_W } from '../iso'

export interface Sprite {
  bmp: Bitmap
  anchorX: number
  anchorY: number
}

export interface ColumnSpec {
  /** Footprint in tiles. */
  footprintW: number
  footprintD: number
  /** Height of the solid part, in pixels. */
  revenuePx: number
  /** Height of the ring, in pixels. Zero draws no ring. */
  liabilityPx: number
  /** Nothing here is expected to pay: a park, a school, the city's own land. */
  exempt: boolean
}

/**
 * How tall a dollar of revenue per acre is drawn.
 *
 * Generous. A parcel's footprint on this corridor is two hundred and fifty
 * feet deep and often as wide, so at a modest scale every column is a pancake
 * and the picture says nothing. At six thousandths of a pixel a typical acre
 * stands about a hundred and thirty pixels and the best on the street stands
 * five hundred, which is the difference the whole screen exists to show.
 */
export const PX_PER_DOLLAR_PER_ACRE = 0.006
/** A gridline every this many dollars per acre, so the column can be read. */
export const GRID_DOLLARS_PER_ACRE = 10_000

const halfW = TILE_W / 2
const halfH = TILE_H / 2

interface Geometry {
  width: number
  height: number
  bodyPx: number
  anchorX: number
  anchorY: number
  /** Top-face corners, with the top plane at y = 0 before the shift. */
  p00: [number, number]
  p10: [number, number]
  p11: [number, number]
  p01: [number, number]
}

function geometryFor(fw: number, fd: number, bodyPx: number): Geometry {
  const originX = fd * halfW
  return {
    width: (fw + fd) * halfW,
    height: (fw + fd) * halfH + bodyPx,
    bodyPx,
    anchorX: originX,
    anchorY: bodyPx,
    p00: [originX, 0],
    p10: [originX + fw * halfW, fw * halfH],
    p11: [originX + fw * halfW - fd * halfW, (fw + fd) * halfH],
    p01: [originX - fd * halfW, fd * halfH],
  }
}

/** Fill one side of the box, from `d0` to `d1` pixels below the top plane. */
function face(
  bmp: Bitmap, geo: Geometry, side: 'left' | 'right', length: number,
  d0: number, d1: number, ink: number, dy: number,
): void {
  const base = side === 'left' ? geo.p01 : geo.p10
  const sign = side === 'left' ? 1 : -1
  for (let i = 0; i < length; i++) {
    const x = base[0] + sign * 2 * i
    const y = base[1] + i + dy
    rect(bmp, x, y + d0, 2, Math.max(0, d1 - d0), ink)
  }
}

/** The diamond on top, filled by scanning between the two upper edges. */
function top(bmp: Bitmap, geo: Geometry, ink: number, dy: number): void {
  const [ax, ay] = geo.p00
  const [bx, by] = geo.p10
  const [cx, cy] = geo.p11
  const [dx, dy2] = geo.p01
  const minY = Math.min(ay, by, cy, dy2)
  const maxY = Math.max(ay, by, cy, dy2)
  const edges: [number, number, number, number][] = [
    [ax, ay, bx, by], [bx, by, cx, cy], [cx, cy, dx, dy2], [dx, dy2, ax, ay],
  ]
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    let lo = Infinity
    let hi = -Infinity
    for (const [x0, y0, x1, y1] of edges) {
      if (y0 === y1) continue
      const t = (y - y0) / (y1 - y0)
      if (t < 0 || t > 1) continue
      const x = x0 + (x1 - x0) * t
      lo = Math.min(lo, x)
      hi = Math.max(hi, x)
    }
    if (lo > hi) continue
    rect(bmp, Math.round(lo), y + dy, Math.round(hi - lo) + 1, 1, ink)
  }
}

/** The outline of the diamond, for the ring and the gridlines. */
function topOutline(bmp: Bitmap, geo: Geometry, ink: number, dy: number): void {
  const pts: [number, number][] = [geo.p00, geo.p10, geo.p11, geo.p01]
  for (let i = 0; i < 4; i++) {
    const a = pts[i]!
    const b = pts[(i + 1) % 4]!
    line(bmp, a[0], a[1] + dy, b[0], b[1] + dy, ink)
  }
}

/** The four vertical corners, for the hollow part above a column that falls short. */
function verticals(bmp: Bitmap, geo: Geometry, from: number, to: number, ink: number, dy: number): void {
  for (const point of [geo.p00, geo.p10, geo.p11, geo.p01]) {
    for (let y = from; y < to; y++) px(bmp, point[0], point[1] + y + dy, ink)
  }
}

/**
 * One parcel's column.
 *
 * Drawn tall enough to hold whichever of revenue and cost is larger, so a
 * parcel that falls a long way short is a short solid block inside a tall
 * empty one - which is the picture, and is why the ring is drawn even when
 * nothing reaches it.
 */
export function valueColumn(spec: ColumnSpec): Sprite {
  const fw = Math.max(1, spec.footprintW)
  const fd = Math.max(1, spec.footprintD)
  const solid = Math.max(2, Math.round(spec.revenuePx))
  const ring = spec.exempt ? 0 : Math.max(0, Math.round(spec.liabilityPx))
  const geo = geometryFor(fw, fd, solid)
  // Room above the solid column for a ring that overshoots it.
  const headroom = Math.max(0, ring - solid) + 2
  const bmp = makeBitmap(geo.width, geo.height + headroom)
  const dy = headroom

  /*
   * Each step along a face moves two pixels across and one down, so a face
   * spanning n*halfW pixels takes half that many steps.
   *
   * The left face runs from the west corner toward the near one, which is the
   * ALONG-corridor direction and therefore fw; the right face runs from the
   * east corner, which is fd. Swapping the two leaves a notch under the near
   * corner where the walls fail to meet and a diagonal spur where one of them
   * carries on past the box.
   */
  const leftLen = (fw * halfW) / 2
  const rightLen = (fd * halfW) / 2

  if (spec.exempt) {
    // A plinth. It pays nothing and it was never asked to.
    face(bmp, geo, 'left', leftLen, 0, solid, P.concreteDark, dy)
    face(bmp, geo, 'right', rightLen, 0, solid, P.shadow, dy)
    top(bmp, geo, P.concreteMid, dy)
    topOutline(bmp, geo, P.concreteDark, dy)
    return { bmp, anchorX: geo.anchorX, anchorY: geo.anchorY + dy }
  }

  // The solid part: what this acre pays.
  face(bmp, geo, 'left', leftLen, 0, solid, P.stuccoMid, dy)
  face(bmp, geo, 'right', rightLen, 0, solid, P.stuccoDark, dy)

  // Gridlines, so the column is a measurement and not a shape.
  const step = GRID_DOLLARS_PER_ACRE * PX_PER_DOLLAR_PER_ACRE
  for (let d = step; d < solid; d += step) {
    face(bmp, geo, 'left', leftLen, d - 1, d, P.stuccoLight, dy)
    face(bmp, geo, 'right', rightLen, d - 1, d, P.stuccoMid, dy)
  }
  top(bmp, geo, P.stuccoLight, dy)
  topOutline(bmp, geo, P.stuccoDark, dy)

  if (ring > 0) {
    // What the city spends on this acre, as a line at that height. Above the
    // column and the gap is drawn as an empty box; below it and the column has
    // already gone past it.
    const ringY = dy + solid - ring
    if (ring > solid) {
      verticals(bmp, geo, -(ring - solid), 0, P.lineWhite, dy)
    }
    const ringGeo = { ...geo }
    for (let i = 0; i < 4; i++) {
      const pts: [number, number][] = [ringGeo.p00, ringGeo.p10, ringGeo.p11, ringGeo.p01]
      const a = pts[i]!
      const b = pts[(i + 1) % 4]!
      line(bmp, a[0], a[1] + ringY, b[0], b[1] + ringY, P.lineWhite)
    }
  }

  return { bmp, anchorX: geo.anchorX, anchorY: geo.anchorY + dy }
}
