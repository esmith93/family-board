/**
 * Buildings, assembled from stacked seeded segments.
 *
 * A building is a box with two visible faces, a roof, and a ground floor that
 * is treated differently from the floors above it - because that is what
 * decides whether a street reads as a place or as a wall. Every material has a
 * three-value ramp: lit face, mid, shadowed face. Nothing is a flat fill.
 *
 * One deliberate cheat: shopfronts are drawn on the visible face regardless of
 * which way the parcel actually fronts. Buildings on the far side of the
 * boulevard would otherwise show the player their service yards, and the point
 * of the view is to read the street.
 */

import {
  type Bitmap, blit, ditherOver, line, makeBitmap, polygon, px, rect, speckle, spriteRng,
} from '../bitmap'
import { P } from '../palette'
import { PX_PER_FLOOR, TILE_H, TILE_W } from '../iso'
import type { LandUse } from '../../sim/types'

export interface Sprite {
  bmp: Bitmap
  /** Pixel in the bitmap that sits on the tile's (0,0) ground corner. */
  anchorX: number
  anchorY: number
}

interface Ramp { dark: number; mid: number; light: number }

const RAMPS: Record<string, Ramp> = {
  brick: { dark: P.brickDark, mid: P.brickMid, light: P.brickLight },
  stucco: { dark: P.stuccoDark, mid: P.stuccoMid, light: P.stuccoLight },
  wood: { dark: P.woodDark, mid: P.woodMid, light: P.woodLight },
  concrete: { dark: P.concreteDark, mid: P.concreteMid, light: P.concreteLight },
  roof: { dark: P.roofDark, mid: P.roofMid, light: P.roofLight },
  glass: { dark: P.glassDark, mid: P.glassMid, light: P.glassLit },
}

export interface BuildingSpec {
  use: LandUse
  /** Footprint in tiles, along the corridor and across it. */
  footprintW: number
  footprintD: number
  floors: number
  seed: number
  /** 0 derelict, 1 new. Drives grime and boarded windows. */
  condition: number
}

type Face = 'left' | 'right'

/** Geometry of a box footprint, in bitmap pixels, roof plane at y = 0. */
function boxGeometry(fw: number, fd: number, heightPx: number) {
  const halfW = TILE_W / 2
  const halfH = TILE_H / 2
  const originX = fd * halfW
  return {
    width: (fw + fd) * halfW,
    height: (fw + fd) * halfH + heightPx,
    heightPx,
    // Roof plane corners.
    p00: [originX, 0] as [number, number],
    p10: [originX + fw * halfW, fw * halfH] as [number, number],
    p11: [originX + fw * halfW - fd * halfW, (fw + fd) * halfH] as [number, number],
    p01: [originX - fd * halfW, fd * halfH] as [number, number],
    anchorX: originX,
    anchorY: heightPx,
  }
}

/**
 * Fill a rectangle in face space.
 * `i` runs along the face in vertical pixel rows; `d` runs down the wall.
 */
function faceFill(
  bmp: Bitmap, geo: ReturnType<typeof boxGeometry>, face: Face,
  i0: number, i1: number, d0: number, d1: number, index: number,
): void {
  const base = face === 'left' ? geo.p01 : geo.p10
  const sign = face === 'left' ? 1 : -1
  for (let i = Math.max(0, Math.floor(i0)); i < Math.floor(i1); i++) {
    const x = base[0] + sign * 2 * i
    const y = base[1] + i
    for (let k = 0; k < 2; k++) {
      const xx = face === 'left' ? x + k : x - k
      for (let d = Math.floor(d0); d < Math.floor(d1); d++) px(bmp, xx, y + d, index)
    }
  }
}

/** How many vertical pixel rows a face spans. */
function faceLength(geo: ReturnType<typeof boxGeometry>, face: Face, fw: number, fd: number): number {
  void geo
  return (face === 'left' ? fw : fd) * (TILE_H / 2)
}

function wallMaterial(use: LandUse, rng: () => number): Ramp {
  switch (use) {
    case 'mainstreet_mixed':
      return rng() < 0.65 ? RAMPS.brick! : RAMPS.stucco!
    case 'midrise_mixed':
      return rng() < 0.5 ? RAMPS.brick! : RAMPS.stucco!
    case 'single_family':
      return rng() < 0.6 ? RAMPS.wood! : RAMPS.stucco!
    case 'garden_apartment':
      return rng() < 0.5 ? RAMPS.stucco! : RAMPS.brick!
    case 'civic':
      return RAMPS.concrete!
    case 'office_park':
      return rng() < 0.5 ? RAMPS.concrete! : RAMPS.stucco!
    default:
      return RAMPS.stucco!
  }
}

function floorHeight(use: LandUse): number {
  if (use === 'big_box') return Math.round(PX_PER_FLOOR * 1.5)
  if (use === 'strip_mall' || use === 'auto_service') return Math.round(PX_PER_FLOOR * 1.15)
  if (use === 'mainstreet_mixed' || use === 'midrise_mixed') return PX_PER_FLOOR
  return Math.round(PX_PER_FLOOR * 0.95)
}

/**
 * The main entry point. Everything about the result is a pure function of the
 * spec, so a given parcel always looks like itself across a whole run.
 */
export function buildingSprite(spec: BuildingSpec): Sprite {
  const rng = spriteRng(spec.seed)
  const fw = Math.max(1, spec.footprintW)
  const fd = Math.max(1, spec.footprintD)
  const perFloor = floorHeight(spec.use)
  const groundExtra = spec.use === 'mainstreet_mixed' || spec.use === 'midrise_mixed' ? 6 : 0
  const bodyHeight = perFloor * spec.floors + groundExtra

  const pitched = spec.use === 'single_family' || spec.use === 'garden_apartment'
  // A pitched roof rises with the span it covers, but a real roof is a pitch,
  // not a pyramid: a wide building gets a shallower one, capped so a large
  // block does not end up wearing a mountain.
  const roofRise = pitched ? Math.max(8, Math.min(24, Math.round(Math.min(fw, fd) * 3.2 + 5))) : 4

  const geo = boxGeometry(fw, fd, bodyHeight)
  const bmp = makeBitmap(geo.width, geo.height + roofRise)
  // Everything shifts down to leave room for the roof above the box.
  const dy = roofRise

  const wall = wallMaterial(spec.use, rng)
  const leftLen = faceLength(geo, 'left', fw, fd)
  const rightLen = faceLength(geo, 'right', fw, fd)

  const shifted = { ...geo, p00: shift(geo.p00, dy), p10: shift(geo.p10, dy), p11: shift(geo.p11, dy), p01: shift(geo.p01, dy) }

  // --- Walls: the left face catches the light, the right face is in shade ---
  faceFill(bmp, shifted, 'left', 0, leftLen, 0, bodyHeight, wall.light)
  faceFill(bmp, shifted, 'right', 0, rightLen, 0, bodyHeight, wall.dark)

  // Vertical falloff, so a tall wall is not one flat colour top to bottom.
  faceFill(bmp, shifted, 'left', 0, leftLen, bodyHeight * 0.62, bodyHeight, wall.mid)
  faceFill(bmp, shifted, 'right', 0, rightLen, 0, bodyHeight * 0.3, wall.mid)

  drawFloors(bmp, shifted, spec, wall, fw, fd, perFloor, bodyHeight, groundExtra, rng)

  if (pitched) drawPitchedRoof(bmp, shifted, fw, fd, roofRise, spec, rng)
  else drawFlatRoof(bmp, shifted, fw, fd, spec, rng)

  // Grime in the corners of anything that has been left alone.
  if (spec.condition < 0.55) {
    const grime = wall.dark
    speckle(bmp, 0, dy, geo.width, geo.height, grime, (0.6 - spec.condition) * 0.35, spec.seed ^ 0x9911)
  }

  return { bmp, anchorX: geo.anchorX, anchorY: geo.anchorY + dy }
}

function shift(p: [number, number], dy: number): [number, number] {
  return [p[0], p[1] + dy]
}

function drawFloors(
  bmp: Bitmap, geo: ReturnType<typeof boxGeometry>, spec: BuildingSpec, wall: Ramp,
  fw: number, fd: number, perFloor: number, bodyHeight: number, groundExtra: number,
  rng: () => number,
): void {
  const leftLen = faceLength(geo, 'left', fw, fd)
  const rightLen = faceLength(geo, 'right', fw, fd)
  const groundTop = bodyHeight - perFloor - groundExtra

  const shopfront = spec.use === 'mainstreet_mixed' || spec.use === 'midrise_mixed' ||
    spec.use === 'strip_mall' || spec.use === 'big_box'

  // --- Upper floors ---
  for (let floor = 0; floor < spec.floors - 1; floor++) {
    const top = floor * perFloor + 4
    if (top + perFloor > groundTop) break
    drawWindowBand(bmp, geo, 'left', leftLen, top, perFloor, wall, spec, rng, true)
    drawWindowBand(bmp, geo, 'right', rightLen, top, perFloor, wall, spec, rng, false)
    // A string course between floors reads as brick coursing.
    faceFill(bmp, geo, 'left', 0, leftLen, top + perFloor - 2, top + perFloor - 1, wall.mid)
    faceFill(bmp, geo, 'right', 0, rightLen, top + perFloor - 2, top + perFloor - 1, wall.dark)
  }

  // --- Ground floor ---
  if (shopfront) {
    drawShopfront(bmp, geo, 'left', leftLen, groundTop, bodyHeight, spec, rng)
    drawShopfront(bmp, geo, 'right', rightLen, groundTop, bodyHeight, spec, rng)
  } else {
    drawWindowBand(bmp, geo, 'left', leftLen, groundTop + 4, perFloor, wall, spec, rng, true)
    drawWindowBand(bmp, geo, 'right', rightLen, groundTop + 4, perFloor, wall, spec, rng, false)
    // A front door.
    const doorAt = Math.floor(leftLen * 0.45)
    faceFill(bmp, geo, 'left', doorAt, doorAt + 5, bodyHeight - 13, bodyHeight, P.woodDark)
    faceFill(bmp, geo, 'left', doorAt, doorAt + 5, bodyHeight - 13, bodyHeight - 12, P.woodLight)
  }

  if (spec.use === 'auto_service') {
    // Roller shutter bays, which is most of what these buildings are.
    for (let bay = 0; bay < Math.max(1, fw - 1); bay++) {
      const at = 3 + bay * Math.floor(leftLen / Math.max(1, fw - 1))
      const w = Math.max(6, Math.floor(leftLen / Math.max(1, fw - 1)) - 5)
      faceFill(bmp, geo, 'left', at, at + w, bodyHeight - 16, bodyHeight, P.roofMid)
      for (let d = bodyHeight - 15; d < bodyHeight; d += 3) {
        faceFill(bmp, geo, 'left', at, at + w, d, d + 1, P.roofDark)
      }
    }
  }
}

function drawWindowBand(
  bmp: Bitmap, geo: ReturnType<typeof boxGeometry>, face: Face, faceLen: number,
  top: number, perFloor: number, wall: Ramp, spec: BuildingSpec, rng: () => number, lit: boolean,
): void {
  const winH = Math.max(4, perFloor - 8)
  const pitch = spec.use === 'midrise_mixed' ? 9 : 11
  const winW = Math.max(3, pitch - 5)
  for (let i = 4; i + winW < faceLen - 2; i += pitch) {
    const boarded = spec.condition < 0.3 && rng() < 0.3
    const glass = boarded ? P.woodDark : lit ? P.glassMid : P.glassDark
    faceFill(bmp, geo, face, i, i + winW, top, top + winH, glass)
    // A reveal above the opening, so windows sit IN the wall, not on it.
    faceFill(bmp, geo, face, i, i + winW, top - 1, top, wall.dark)
    // A sill catching the light.
    faceFill(bmp, geo, face, i - 1, i + winW + 1, top + winH, top + winH + 1, wall.light)
    if (!boarded && lit && rng() < 0.45) {
      faceFill(bmp, geo, face, i, i + winW, top, top + Math.max(1, Math.floor(winH / 3)), P.glassLit)
    }
  }
}

function drawShopfront(
  bmp: Bitmap, geo: ReturnType<typeof boxGeometry>, face: Face, faceLen: number,
  groundTop: number, bodyHeight: number, spec: BuildingSpec, rng: () => number,
): void {
  const sillTop = groundTop + 5
  const glassBottom = bodyHeight - 3

  // Continuous glazing, broken into bays by mullions.
  faceFill(bmp, geo, face, 3, faceLen - 3, sillTop, glassBottom, P.glassMid)
  faceFill(bmp, geo, face, 3, faceLen - 3, sillTop, sillTop + 2, P.glassDark)
  for (let i = 3; i < faceLen - 3; i += 9) {
    faceFill(bmp, geo, face, i, i + 1, sillTop, glassBottom, P.concreteDark)
  }
  // A kickplate at the pavement.
  faceFill(bmp, geo, face, 3, faceLen - 3, glassBottom, bodyHeight, P.concreteMid)

  // A sign band above the glazing, in one of the palette's accent colours.
  const accents = [P.signRed, P.signBlue, P.awningOrange, P.roofMid]
  const accent = accents[Math.floor(rng() * accents.length)]!
  faceFill(bmp, geo, face, 2, faceLen - 2, groundTop, groundTop + 4, accent)
  faceFill(bmp, geo, face, 2, faceLen - 2, groundTop, groundTop + 1, P.stuccoLight)
  // Lettering, suggested rather than spelled.
  for (let i = 6; i < faceLen - 8; i += 3) {
    if (rng() < 0.7) faceFill(bmp, geo, face, i, i + 2, groundTop + 1, groundTop + 3, P.stuccoLight)
  }

  // Awnings on the smaller-grained frontages.
  if ((spec.use === 'mainstreet_mixed' || spec.use === 'strip_mall') && rng() < 0.7) {
    for (let i = 4; i + 8 < faceLen - 4; i += 14) {
      const colour = rng() < 0.5 ? P.awningOrange : P.signRed
      faceFill(bmp, geo, face, i, i + 10, sillTop + 1, sillTop + 4, colour)
      faceFill(bmp, geo, face, i, i + 10, sillTop + 4, sillTop + 5, P.shadow)
    }
  }

  // A lit interior at night, which is what glassLit is for.
  if (rng() < 0.6) {
    faceFill(bmp, geo, face, 5, Math.max(6, faceLen - 6), sillTop + 3, sillTop + 7, P.glassLit)
  }
}

/** Flat roofs are not all the same colour, and a big one is mostly machinery. */
const ROOF_RAMPS: Ramp[] = [
  { dark: P.roofDark, mid: P.roofMid, light: P.roofLight },
  { dark: P.concreteDark, mid: P.concreteMid, light: P.concreteLight },
  { dark: P.brickDark, mid: P.brickMid, light: P.brickLight },
  { dark: P.asphaltDark, mid: P.asphaltMid, light: P.asphaltLight },
  { dark: P.stuccoDark, mid: P.stuccoMid, light: P.stuccoLight },
]

function drawFlatRoof(
  bmp: Bitmap, geo: ReturnType<typeof boxGeometry>, fw: number, fd: number,
  spec: BuildingSpec, rng: () => number,
): void {
  const ramp = ROOF_RAMPS[Math.floor(rng() * ROOF_RAMPS.length)]!
  polygon(bmp, [geo.p00, geo.p10, geo.p11, geo.p01], ramp.mid)
  ditherOver(bmp, 0, 0, bmp.width, geo.p11[1] + 2, ramp.light, 0.22)
  speckle(bmp, 0, 0, bmp.width, geo.p11[1] + 2, ramp.dark, 0.07, spec.seed ^ 0x3311)

  // Seams between roofing bays, running the length of the building. A wide
  // roof with nothing on it is the fastest way to look like a placeholder.
  const lerpP = (a: [number, number], b: [number, number], t: number): [number, number] =>
    [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
  const seams = Math.max(2, Math.min(7, Math.round(fd * 1.4)))
  for (let k = 1; k < seams; k++) {
    const t = k / seams
    const a = lerpP(geo.p00, geo.p01, t)
    const b = lerpP(geo.p10, geo.p11, t)
    line(bmp, a[0], a[1], b[0], b[1], k % 2 === 0 ? ramp.dark : ramp.light)
  }

  // A parapet: a bright lip on the two lower edges, dark on the upper two.
  line(bmp, geo.p01[0], geo.p01[1], geo.p11[0], geo.p11[1], ramp.light)
  line(bmp, geo.p10[0], geo.p10[1], geo.p11[0], geo.p11[1], ramp.light)
  line(bmp, geo.p00[0], geo.p00[1], geo.p10[0], geo.p10[1], ramp.dark)
  line(bmp, geo.p00[0], geo.p00[1], geo.p01[0], geo.p01[1], ramp.dark)

  // Rooftop plant. A big box roof is mostly machinery, and it should look it.
  const area = fw * fd
  const units = spec.use === 'big_box' ? 4 + Math.floor(rng() * 5)
    : Math.max(1, Math.min(8, Math.round(area / 7) + Math.floor(rng() * 3)))
  const cx = (geo.p00[0] + geo.p11[0]) / 2
  const cy = (geo.p00[1] + geo.p11[1]) / 2
  for (let u = 0; u < units; u++) {
    const jitterX = (rng() - 0.5) * fw * 18
    const jitterY = (rng() - 0.5) * fd * 9
    drawRoofUnit(bmp, Math.round(cx + jitterX), Math.round(cy + jitterY), 6 + Math.floor(rng() * 5), rng)
  }
}

function drawRoofUnit(bmp: Bitmap, x: number, y: number, size: number, rng: () => number): void {
  const h = 4 + Math.floor(rng() * 4)
  // A small iso box: top, then two faces.
  polygon(bmp, [
    [x, y - size / 2], [x + size, y], [x, y + size / 2], [x - size, y],
  ], P.roofLight)
  polygon(bmp, [
    [x - size, y], [x, y + size / 2], [x, y + size / 2 + h], [x - size, y + h],
  ], P.roofDark)
  polygon(bmp, [
    [x, y + size / 2], [x + size, y], [x + size, y + h], [x, y + size / 2 + h],
  ], P.roofMid)
  // A vent grille on the lit face.
  for (let g = 1; g < h; g += 2) {
    line(bmp, x - size + 2, y + 1 + g, x - 2, y + size / 2 - 1 + g, P.roofLight)
  }
}

function drawPitchedRoof(
  bmp: Bitmap, geo: ReturnType<typeof boxGeometry>, fw: number, fd: number,
  rise: number, spec: BuildingSpec, rng: () => number,
): void {
  const ramp = RAMPS.roof!
  const shingle = rng() < 0.5 ? ramp : { dark: P.brickDark, mid: P.brickMid, light: P.brickLight }

  // A hipped roof: the footprint inset and lifted, with four planes to it.
  const inset = 0.2
  const lift = rise
  const lerp = (a: [number, number], b: [number, number], t: number): [number, number] =>
    [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]

  const centre: [number, number] = [
    (geo.p00[0] + geo.p11[0]) / 2, (geo.p00[1] + geo.p11[1]) / 2,
  ]
  const r00 = lift2(lerp(geo.p00, centre, inset), lift)
  const r10 = lift2(lerp(geo.p10, centre, inset), lift)
  const r11 = lift2(lerp(geo.p11, centre, inset), lift)
  const r01 = lift2(lerp(geo.p01, centre, inset), lift)

  // Far planes first, near planes over them.
  polygon(bmp, [geo.p00, geo.p10, r10, r00], shingle.mid)
  polygon(bmp, [geo.p00, geo.p01, r01, r00], shingle.dark)
  polygon(bmp, [geo.p01, geo.p11, r11, r01], shingle.light)
  polygon(bmp, [geo.p10, geo.p11, r11, r10], shingle.mid)
  polygon(bmp, [r00, r10, r11, r01], shingle.light)

  // Courses of shingles on the lit plane.
  for (let t = 0.12; t < 1; t += 0.14) {
    const a = lerp(geo.p01, r01, t)
    const b = lerp(geo.p11, r11, t)
    line(bmp, a[0], a[1], b[0], b[1], shingle.mid)
  }
  // A ridge catching the sun.
  line(bmp, r01[0], r01[1], r11[0], r11[1], shingle.light)
  line(bmp, r00[0], r00[1], r10[0], r10[1], shingle.light)

  // Eaves shadow under the overhang.
  line(bmp, geo.p01[0], geo.p01[1] + 1, geo.p11[0], geo.p11[1] + 1, P.shadow)

  if (spec.use === 'single_family' && rng() < 0.6) {
    // A chimney, because a roofline without one reads as a shed.
    const cx = Math.round(lerp(r00, r11, 0.35)[0])
    const cy = Math.round(lerp(r00, r11, 0.35)[1])
    rect(bmp, cx - 2, cy - 9, 4, 10, P.brickMid)
    rect(bmp, cx - 2, cy - 9, 1, 10, P.brickLight)
    rect(bmp, cx - 3, cy - 10, 6, 2, P.brickDark)
  }
  void fw
  void fd
}

function lift2(p: [number, number], dy: number): [number, number] {
  return [p[0], p[1] - dy]
}

/** A soft contact shadow so a building sits on the ground instead of floating. */
export function buildingShadow(fw: number, fd: number): Sprite {
  const halfW = TILE_W / 2
  const halfH = TILE_H / 2
  const width = (fw + fd) * halfW
  const height = (fw + fd) * halfH + 6
  const bmp = makeBitmap(width, height)
  const originX = fd * halfW
  const p00: [number, number] = [originX + 5, 3]
  const p10: [number, number] = [originX + fw * halfW + 5, fw * halfH + 3]
  const p11: [number, number] = [originX + fw * halfW - fd * halfW + 5, (fw + fd) * halfH + 3]
  const p01: [number, number] = [originX - fd * halfW + 5, fd * halfH + 3]
  polygon(bmp, [p00, p10, p11, p01], P.shadow)
  // Dithered so the edge softens rather than cutting.
  ditherOver(bmp, 0, 0, width, height, 0, 0.4)
  return { bmp, anchorX: originX, anchorY: 0 }
}

/** Compose a building with its shadow into a single cached sprite. */
export function buildingWithShadow(spec: BuildingSpec): Sprite {
  const building = buildingSprite(spec)
  const shadow = buildingShadow(spec.footprintW, spec.footprintD)
  const padX = 6
  const padY = 8
  const bmp = makeBitmap(building.bmp.width + padX, building.bmp.height + padY)
  blit(bmp, shadow.bmp, building.anchorX - shadow.anchorX, building.anchorY - shadow.anchorY)
  blit(bmp, building.bmp, 0, 0)
  return { bmp, anchorX: building.anchorX, anchorY: building.anchorY }
}
