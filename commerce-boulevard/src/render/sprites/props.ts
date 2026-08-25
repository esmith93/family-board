/**
 * Street furniture, vehicles and people.
 *
 * These are what make the corridor read as a place with weather and time in it
 * rather than a diagram. They are small - a person is six pixels tall - so
 * every pixel has to carry a value from the ramp.
 */

import { type Bitmap, ditherOver, line, makeBitmap, polygon, px, rect, speckle, spriteRng } from '../bitmap'
import { P } from '../palette'
import type { Sprite } from './buildings'

const sprite = (bmp: Bitmap, anchorX: number, anchorY: number): Sprite => ({ bmp, anchorX, anchorY })

/**
 * A street tree. Canopy size is driven by maturity, because a tree planted in
 * year 25 is still a stick at year 30 and the picture should say so.
 */
export function treeSprite(maturity: number, seed: number, season: 'summer' | 'bare'): Sprite {
  const rng = spriteRng(seed)
  const grown = Math.max(0.12, Math.min(1, maturity))
  const canopyR = Math.round(4 + grown * 11)
  const trunkH = Math.round(5 + grown * 13)
  const w = canopyR * 2 + 6
  const h = canopyR * 2 + trunkH + 6
  const bmp = makeBitmap(w, h)
  const cx = Math.floor(w / 2)
  const groundY = h - 3

  // Contact shadow on the ground, an iso ellipse.
  for (let y = -3; y <= 3; y++) {
    const span = Math.round(Math.sqrt(Math.max(0, 1 - (y / 3) ** 2)) * (canopyR - 1))
    for (let x = -span; x <= span; x++) px(bmp, cx + x, groundY + y, P.shadow)
  }
  ditherOver(bmp, cx - canopyR, groundY - 3, canopyR * 2, 7, 0, 0.45)

  // Trunk, lit on its left.
  const trunkTop = groundY - trunkH
  const trunkW = grown > 0.5 ? 3 : 2
  rect(bmp, cx - Math.floor(trunkW / 2), trunkTop, trunkW, trunkH, P.woodDark)
  rect(bmp, cx - Math.floor(trunkW / 2), trunkTop, 1, trunkH, P.woodMid)

  if (season === 'bare') {
    for (let b = 0; b < 5; b++) {
      const a = -0.4 - rng() * 2.3
      const len = canopyR * (0.6 + rng() * 0.6)
      line(bmp, cx, trunkTop + 2, cx + Math.cos(a) * len, trunkTop + 2 + Math.sin(a) * len * 0.8, P.woodDark)
    }
    return sprite(bmp, cx, groundY)
  }

  // Canopy: three overlapping lobes so the silhouette is not a circle.
  const cy = trunkTop - Math.round(canopyR * 0.55)
  const lobes: [number, number, number][] = [
    [0, 0, canopyR],
    [-canopyR * 0.55, canopyR * 0.28, canopyR * 0.72],
    [canopyR * 0.5, canopyR * 0.2, canopyR * 0.68],
  ]
  for (const [lx, ly, lr] of lobes) {
    for (let y = -lr; y <= lr; y++) {
      const span = Math.sqrt(Math.max(0, lr * lr - y * y))
      for (let x = -span; x <= span; x++) {
        // Light from the upper left picks out the near-left of each lobe.
        const lit = (-x / lr) * 0.6 + (-y / lr) * 0.5
        const value = lit > 0.42 ? P.leafHigh : lit > 0.05 ? P.leafLight : lit > -0.4 ? P.leafMid : P.leafDark
        px(bmp, cx + lx + x, cy + ly + y * 0.82, value)
      }
    }
  }
  // Broken texture, so the canopy reads as leaves and not as a balloon.
  speckle(bmp, cx - canopyR - 2, cy - canopyR - 2, canopyR * 2 + 5, canopyR * 2 + 5, P.leafDark, 0.16, seed ^ 0x44)
  speckle(bmp, cx - canopyR - 2, cy - canopyR - 2, canopyR * 2 + 5, canopyR * 2 + 5, P.leafHigh, 0.07, seed ^ 0x88)

  return sprite(bmp, cx, groundY)
}

/** A cobra-head arterial light: tall, with the head out over the traffic. */
export function cobraLightSprite(): Sprite {
  const h = 44
  const bmp = makeBitmap(26, h)
  const baseX = 20
  rect(bmp, baseX, 6, 2, h - 8, P.roofDark)
  rect(bmp, baseX, 6, 1, h - 8, P.roofMid)
  // The arm reaching out over the carriageway.
  line(bmp, baseX, 7, baseX - 12, 3, P.roofDark)
  line(bmp, baseX, 8, baseX - 12, 4, P.roofMid)
  rect(bmp, baseX - 15, 3, 6, 3, P.roofMid)
  rect(bmp, baseX - 15, 5, 6, 1, P.glassLit)
  rect(bmp, baseX - 1, h - 3, 4, 3, P.concreteMid)
  return sprite(bmp, baseX + 1, h - 1)
}

/** A pedestrian-scale light: half the height, twice the count, a warm globe. */
export function pedestrianLightSprite(): Sprite {
  const h = 26
  const bmp = makeBitmap(12, h)
  const x = 5
  rect(bmp, x, 5, 2, h - 7, P.roofDark)
  rect(bmp, x, 5, 1, h - 7, P.roofMid)
  rect(bmp, x - 2, 2, 6, 4, P.roofMid)
  rect(bmp, x - 1, 3, 4, 2, P.glassLit)
  rect(bmp, x - 2, 1, 6, 1, P.roofDark)
  rect(bmp, x - 1, h - 3, 4, 3, P.concreteMid)
  return sprite(bmp, x + 1, h - 1)
}

/** A signalised intersection: mast arm with three heads over the road. */
export function trafficSignalSprite(): Sprite {
  const h = 42
  const bmp = makeBitmap(38, h)
  const baseX = 32
  rect(bmp, baseX, 4, 3, h - 6, P.roofDark)
  rect(bmp, baseX, 4, 1, h - 6, P.roofMid)
  rect(bmp, 6, 4, baseX - 6, 2, P.roofDark)
  rect(bmp, 6, 4, baseX - 6, 1, P.roofMid)
  for (const hx of [10, 19, 27]) {
    rect(bmp, hx, 6, 4, 10, P.roofDark)
    rect(bmp, hx, 6, 1, 10, P.roofMid)
    px(bmp, hx + 2, 8, P.signRed)
    px(bmp, hx + 2, 11, P.lineYellow)
    px(bmp, hx + 2, 14, P.leafLight)
  }
  rect(bmp, baseX - 1, h - 3, 5, 3, P.concreteMid)
  return sprite(bmp, baseX + 1, h - 1)
}

const CAR_COLOURS = [P.signRed, P.signBlue, P.concreteLight, P.roofMid, P.awningOrange, P.woodMid, P.leafMid]

/**
 * A car, seen from the isometric three-quarter. `along` points it down the
 * corridor; the other orientation is for parked bays.
 */
/**
 * An isometric box: the top face plus the two faces that face the viewer.
 * `u` runs along the object, `v` across it, `h` upward, in half-steps of the
 * 2:1 grid. Everything with volume in this file is built from it.
 */
function isoPoint(cx: number, cy: number, dir: 1 | -1, u: number, v: number, h: number): [number, number] {
  return dir === 1
    ? [cx + 2 * u - 2 * v, cy + u + v - h]
    : [cx - 2 * u + 2 * v, cy + u + v - h]
}

function isoVolume(
  bmp: Bitmap, cx: number, cy: number, dir: 1 | -1,
  uMin: number, uMax: number, vMin: number, vMax: number, base: number, top: number,
  topIdx: number, litIdx: number, shadeIdx: number,
): void {
  const pt = (u: number, v: number, h: number) => isoPoint(cx, cy, dir, u, v, h)
  polygon(bmp, [pt(uMin, vMax, top), pt(uMax, vMax, top), pt(uMax, vMax, base), pt(uMin, vMax, base)], litIdx)
  polygon(bmp, [pt(uMax, vMin, top), pt(uMax, vMax, top), pt(uMax, vMax, base), pt(uMax, vMin, base)], shadeIdx)
  polygon(bmp, [pt(uMin, vMin, top), pt(uMax, vMin, top), pt(uMax, vMax, top), pt(uMin, vMax, top)], topIdx)
}

/** One step up a material ramp, for a lit face. */
function lighten(index: number): number {
  const pairs: Record<number, number> = {
    [P.signRed]: P.awningOrange, [P.signBlue]: P.glassMid, [P.concreteLight]: P.stuccoLight,
    [P.roofMid]: P.roofLight, [P.awningOrange]: P.stuccoLight, [P.woodMid]: P.woodLight,
    [P.leafMid]: P.leafLight,
  }
  return pairs[index] ?? P.stuccoLight
}

/** One step down, for a face in shade. */
function darken(index: number): number {
  const pairs: Record<number, number> = {
    [P.signRed]: P.brickDark, [P.signBlue]: P.glassDark, [P.concreteLight]: P.concreteDark,
    [P.roofMid]: P.roofDark, [P.awningOrange]: P.brickMid, [P.woodMid]: P.woodDark,
    [P.leafMid]: P.leafDark,
  }
  return pairs[index] ?? P.asphaltDark
}

/**
 * A car, as a solid volume rather than a coloured sliver: roughly fifteen feet
 * long at this grid's three pixels to the foot.
 */
export function carSprite(seed: number, along: boolean): Sprite {
  const rng = spriteRng(seed)
  const body = CAR_COLOURS[Math.floor(rng() * CAR_COLOURS.length)]!
  const lit = lighten(body)
  const shade = darken(body)
  const dir: 1 | -1 = along ? 1 : -1

  const w = 40
  const h = 30
  const bmp = makeBitmap(w, h)
  const cx = w / 2
  const cy = h - 10
  const L = 6.5
  const W = 2.6
  const bodyTop = 6
  const roofTop = 11

  polygon(bmp, [
    isoPoint(cx + 2, cy + 1, dir, -L, -W, 0), isoPoint(cx + 2, cy + 1, dir, L, -W, 0),
    isoPoint(cx + 2, cy + 1, dir, L, W, 0), isoPoint(cx + 2, cy + 1, dir, -L, W, 0),
  ], P.shadow)

  for (const at of [-L + 1.6, L - 1.6]) {
    for (const side of [-W, W]) {
      const p = isoPoint(cx, cy, dir, at, side, 1)
      rect(bmp, p[0] - 1, p[1] - 2, 3, 3, P.asphaltDark)
    }
  }

  isoVolume(bmp, cx, cy, dir, -L, L, -W, W, 1, bodyTop, lit, body, shade)
  isoVolume(bmp, cx, cy, dir, -L + 2, L - 2.6, -W + 0.4, W - 0.4, bodyTop, roofTop, lit, P.glassMid, P.glassDark)
  polygon(bmp, [
    isoPoint(cx, cy, dir, -L + 2, -W + 0.4, roofTop), isoPoint(cx, cy, dir, L - 2.6, -W + 0.4, roofTop),
    isoPoint(cx, cy, dir, L - 2.6, W - 0.4, roofTop), isoPoint(cx, cy, dir, -L + 2, W - 0.4, roofTop),
  ], lit)

  const a = isoPoint(cx, cy, dir, -L, W, bodyTop)
  const b = isoPoint(cx, cy, dir, L, W, bodyTop)
  line(bmp, a[0], a[1], b[0], b[1], lit)

  const front = isoPoint(cx, cy, dir, L, W - 0.6, 3)
  const back = isoPoint(cx, cy, dir, -L, W - 0.6, 3)
  px(bmp, front[0], front[1], P.lineWhite)
  px(bmp, front[0] - dir, front[1], P.lineWhite)
  px(bmp, back[0], back[1], P.signRed)
  if (rng() < 0.25) {
    const r0 = isoPoint(cx, cy, dir, -L + 2.5, 0, roofTop + 1)
    const r1 = isoPoint(cx, cy, dir, L - 3, 0, roofTop + 1)
    line(bmp, r0[0], r0[1], r1[0], r1[1], P.asphaltDark)
  }
  return sprite(bmp, cx, cy + 2)
}

/** A bus: forty feet of the same volume, and unmistakable beside a car. */
export function busSprite(seed: number): Sprite {
  const rng = spriteRng(seed)
  const w = 60
  const h = 40
  const bmp = makeBitmap(w, h)
  const cx = w / 2
  const cy = h - 12
  const dir: 1 | -1 = 1
  const L = 11
  const W = 3
  const top = 15

  polygon(bmp, [
    isoPoint(cx + 2, cy + 1, dir, -L, -W, 0), isoPoint(cx + 2, cy + 1, dir, L, -W, 0),
    isoPoint(cx + 2, cy + 1, dir, L, W, 0), isoPoint(cx + 2, cy + 1, dir, -L, W, 0),
  ], P.shadow)

  for (const at of [-L + 2.5, L - 3]) {
    for (const side of [-W, W]) {
      const p = isoPoint(cx, cy, dir, at, side, 1)
      rect(bmp, p[0] - 1, p[1] - 3, 3, 4, P.asphaltDark)
    }
  }

  isoVolume(bmp, cx, cy, dir, -L, L, -W, W, 1, top, P.lineWhite, P.concreteLight, P.concreteDark)

  for (let u = -L + 1.2; u < L - 1.4; u += 1.9) {
    const p0 = isoPoint(cx, cy, dir, u, W, 11)
    const p1 = isoPoint(cx, cy, dir, u + 1.3, W, 11)
    polygon(bmp, [p0, p1, [p1[0], p1[1] + 5], [p0[0], p0[1] + 5]], P.glassMid)
  }
  const s0 = isoPoint(cx, cy, dir, -L, W, 4)
  const s1 = isoPoint(cx, cy, dir, L, W, 4)
  line(bmp, s0[0], s0[1], s1[0], s1[1], P.signBlue)
  line(bmp, s0[0], s0[1] + 1, s1[0], s1[1] + 1, P.signBlue)

  const front = isoPoint(cx, cy, dir, L, W - 0.8, 3)
  px(bmp, front[0], front[1], P.lineWhite)
  if (rng() < 0.6) {
    const dest = isoPoint(cx, cy, dir, L - 2.5, W, 13)
    rect(bmp, dest[0] - 2, dest[1] - 1, 4, 2, P.glassLit)
  }
  return sprite(bmp, cx, cy + 2)
}

const CLOTHES = [P.signRed, P.signBlue, P.awningOrange, P.leafMid, P.stuccoMid, P.brickMid]

/** A person. Six pixels of head, coat and legs, and it has to read at 1x. */
export function personSprite(seed: number): Sprite {
  const rng = spriteRng(seed)
  const coat = CLOTHES[Math.floor(rng() * CLOTHES.length)]!
  const bmp = makeBitmap(6, 12)
  px(bmp, 2, 9, P.shadow); px(bmp, 3, 9, P.shadow)
  // Legs, coat, head, and one lit pixel so the figure has a light side.
  px(bmp, 2, 8, P.asphaltDark); px(bmp, 3, 8, P.asphaltDark)
  rect(bmp, 2, 4, 2, 4, coat)
  px(bmp, 2, 4, P.stuccoLight)
  rect(bmp, 2, 2, 2, 2, P.stuccoMid)
  px(bmp, 2, 2, P.stuccoLight)
  px(bmp, 2, 1, P.woodDark); px(bmp, 3, 1, P.woodDark)
  return sprite(bmp, 3, 10)
}

/** A bus shelter: a roof, a back panel and a bench. */
export function busShelterSprite(upgraded: boolean): Sprite {
  const bmp = makeBitmap(34, 26)
  const baseY = 21
  for (let i = 0; i < 14; i++) {
    px(bmp, 6 + i, baseY + Math.round(i / 2) - 1, P.shadow)
    px(bmp, 7 + i, baseY + Math.round(i / 2) - 1, P.shadow)
  }
  // Back panel glazing.
  for (let i = 0; i < 15; i++) {
    const x = 5 + i * 2
    const y = 6 + i
    for (let d = 0; d < 11; d++) px(bmp, x, y + d, d < 9 ? P.glassMid : P.roofDark)
    px(bmp, x + 1, y, P.roofDark)
  }
  // Roof.
  for (let i = 0; i < 17; i++) {
    const x = 3 + i * 2
    const y = 4 + i
    px(bmp, x, y, P.roofLight); px(bmp, x + 1, y, P.roofMid)
    px(bmp, x, y + 1, P.roofDark)
  }
  // Bench.
  for (let i = 0; i < 11; i++) px(bmp, 8 + i * 2, 15 + i, P.woodMid)
  if (upgraded) {
    rect(bmp, 24, 7, 5, 4, P.signBlue)
    rect(bmp, 25, 8, 3, 2, P.glassLit)
  }
  return sprite(bmp, 17, baseY)
}

/** A fire hydrant. Tiny, and the corridor looks wrong without them. */
export function hydrantSprite(): Sprite {
  const bmp = makeBitmap(5, 9)
  px(bmp, 2, 8, P.shadow)
  rect(bmp, 1, 3, 3, 5, P.signRed)
  rect(bmp, 1, 3, 1, 5, P.awningOrange)
  rect(bmp, 0, 4, 5, 1, P.signRed)
  rect(bmp, 1, 2, 3, 1, P.signRed)
  px(bmp, 1, 2, P.awningOrange)
  return sprite(bmp, 2, 8)
}

/** A bench, for the pavements that get one. */
export function benchSprite(): Sprite {
  const bmp = makeBitmap(18, 12)
  for (let i = 0; i < 7; i++) px(bmp, 3 + i * 2, 10 + Math.round(i / 2) - 2, P.shadow)
  for (let i = 0; i < 7; i++) {
    const x = 2 + i * 2
    const y = 5 + i
    px(bmp, x, y, P.woodLight); px(bmp, x + 1, y, P.woodMid)
    px(bmp, x, y + 2, P.woodMid); px(bmp, x + 1, y + 2, P.woodDark)
  }
  px(bmp, 2, 8, P.roofDark); px(bmp, 14, 15, P.roofDark)
  return sprite(bmp, 9, 12)
}

/** A utility pole with overhead wires, until the player buries them. */
export function utilityPoleSprite(): Sprite {
  const h = 52
  const bmp = makeBitmap(20, h)
  const x = 9
  rect(bmp, x, 2, 2, h - 4, P.woodDark)
  rect(bmp, x, 2, 1, h - 4, P.woodMid)
  for (const armY of [6, 13]) {
    rect(bmp, x - 6, armY, 14, 1, P.woodMid)
    for (const cx of [x - 5, x, x + 6]) {
      px(bmp, cx, armY - 1, P.glassMid)
    }
  }
  px(bmp, x, h - 3, P.shadow); px(bmp, x + 1, h - 3, P.shadow)
  return sprite(bmp, x + 1, h - 2)
}

/**
 * A pool of light on the ground.
 *
 * Drawn additively at dusk and after dark. Dithered rather than smoothly
 * blended, so it stays inside the palette and reads as pixel art rather than
 * as a soft glow pasted over one.
 *
 * This is the visible consequence of the lighting instrument: swapping cobra
 * heads for pedestrian-scale poles halves the spacing and doubles the count,
 * and the pavement stops being a dark gap between bright roads.
 */
export function lightPoolSprite(radius: number, warm: boolean): Sprite {
  const w = radius * 2 + 2
  const h = radius + 2
  const bmp = makeBitmap(w, h)
  const cx = w / 2
  const cy = h / 2
  const index = warm ? P.glassLit : P.lineWhite
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x - cx) / radius
      const dy = (y - cy) / (radius / 2)
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d > 1) continue
      // Falloff carried by dither density rather than by alpha.
      const strength = (1 - d) ** 1.35
      const b = BAYER_8[((y & 7) << 3) | (x & 7)]!
      if (b < strength * 78) px(bmp, x, y, index)
    }
  }
  return sprite(bmp, cx, cy)
}

/** An 8x8 ordered dither, for smoother falloff than the 4x4 used elsewhere. */
const BAYER_8 = [
  0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26,
  12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
  3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25,
  15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21,
]
