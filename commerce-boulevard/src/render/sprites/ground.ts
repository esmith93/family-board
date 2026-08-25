/**
 * Ground and roadway tiles.
 *
 * Every surface is built from a ramp of at least three palette values plus
 * dither and seeded grain. A flat fill would read as a debug rectangle, which
 * is the one thing these must never do.
 *
 * The corridor runs along +x, so markings that follow the road are 2:1
 * diagonals across the tile, and markings that cross it run the other way.
 */

import {
  type Bitmap, ditherOver, getPx, hline, isoDiamond, isoDiamondEdge, makeBitmap, px, speckle, spriteRng,
} from '../bitmap'
import { P } from '../palette'
import { TILE_H, TILE_W } from '../iso'

/** Tile-local (u, v) in [0,1] to bitmap pixel. */
function tilePoint(u: number, v: number): [number, number] {
  return [TILE_W / 2 + (u - v) * (TILE_W / 2), (u + v) * (TILE_H / 2)]
}

/**
 * Whether a pixel lies on the tile's diamond.
 *
 * Markings are clipped to this. Without it a stripe runs off the edge of the
 * diamond into the corners of the bitmap, and the tile stops being a diamond
 * and starts being a rectangle - which is exactly what a placeholder is.
 */
/** Where a pixel sits across the tile: 0 at the north edge, 1 at the south. */
export function crossPosition(x: number, y: number): number {
  // Inverting the isometric map: u + v = 2y/TILE_H, u - v = 2x/TILE_W - 1.
  const sum = (2 * y) / TILE_H
  const diff = (2 * x) / TILE_W - 1
  return Math.max(0, Math.min(1, (sum - diff) / 2))
}

export function insideTileDiamond(x: number, y: number): boolean {
  if (y < 0 || y >= TILE_H) return false
  const step = TILE_W / TILE_H
  const t = y < TILE_H / 2 ? y : TILE_H - 1 - y
  const half = (t + 1) * step
  const x0 = Math.round(TILE_W / 2 - half)
  const span = Math.round(half * 2)
  return x >= x0 && x < x0 + span
}

/** A stripe running ALONG the corridor, at position `v` across it. */
export function stripeAlongX(
  bmp: Bitmap, v: number, index: number, thickness = 1, dash: [number, number] | null = null,
  from = 0, to = 1, clip = true,
): void {
  const [sx, sy] = tilePoint(0, v)
  const steps = TILE_W
  for (let i = Math.round(steps * from); i < Math.round(steps * to); i++) {
    if (dash) {
      const period = dash[0] + dash[1]
      if ((i % period) >= dash[0]) continue
    }
    const x = sx + i
    const y = sy + i / 2
    for (let t = 0; t < thickness; t++) {
      if (clip && !insideTileDiamond(Math.round(x), Math.round(y + t))) continue
      px(bmp, x, y + t, index)
    }
  }
}

/** A stripe running ACROSS the corridor, at position `u` along it. */
export function stripeAlongY(
  bmp: Bitmap, u: number, index: number, thickness = 1, dash: [number, number] | null = null,
  from = 0, to = 1, clip = true,
): void {
  const [sx, sy] = tilePoint(u, 0)
  const steps = TILE_W
  for (let i = Math.round(steps * from); i < Math.round(steps * to); i++) {
    if (dash) {
      const period = dash[0] + dash[1]
      if ((i % period) >= dash[0]) continue
    }
    const x = sx - i
    const y = sy + i / 2
    for (let t = 0; t < thickness; t++) {
      if (clip && !insideTileDiamond(Math.round(x), Math.round(y + t))) continue
      px(bmp, x, y + t, index)
    }
  }
}

/** A base diamond with a light gradient and grain, never a flat fill. */
function surface(
  base: number, dark: number, light: number, grain: number, density: number, seed: number,
): Bitmap {
  const bmp = makeBitmap(TILE_W, TILE_H)
  isoDiamond(bmp, 0, 0, TILE_W, TILE_H, base)
  // Light falls from the upper left, so the near-left half lifts.
  for (let y = 0; y < TILE_H; y++) {
    for (let x = 0; x < TILE_W; x++) {
      if (bmp.data[y * TILE_W + x] === 0) continue
      const lift = (TILE_W / 2 - x) / TILE_W + (TILE_H / 2 - y) / (TILE_H * 2)
      if (lift > 0.28) bmp.data[y * TILE_W + x] = light
      else if (lift < -0.3) bmp.data[y * TILE_W + x] = dark
    }
  }
  ditherOver(bmp, 0, 0, TILE_W, TILE_H, light, 0.18)
  speckle(bmp, 0, 0, TILE_W, TILE_H, grain, density, seed)
  return bmp
}

export function asphaltSurface(seed: number, worn = false): Bitmap {
  const bmp = surface(
    worn ? P.asphaltLight : P.asphaltMid,
    P.asphaltDark,
    worn ? P.asphaltWorn : P.asphaltLight,
    P.asphaltDark, 0.09, seed,
  )
  speckle(bmp, 0, 0, TILE_W, TILE_H, P.asphaltWorn, 0.05, seed ^ 0x9e37)
  return bmp
}

/**
 * Pavement.
 *
 * `coverage` is the share of the twelve-foot tile the footway actually
 * occupies, measured from the kerb inward. A four-foot pavement is a third of
 * a tile: a thin ribbon of concrete beside a wide gravel shoulder, which is
 * exactly what these corridors look like on the ground. Without this the grid
 * would quantise a four-foot pavement and a twelve-foot one to the same
 * picture, and widening the footway - a headline instrument - would be
 * invisible.
 */
export function concreteSurface(
  seed: number, kerb: 'north' | 'south' | null = null, coverage = 1,
): Bitmap {
  const bmp = surface(P.concreteMid, P.concreteDark, P.concreteLight, P.concreteDark, 0.06, seed)

  if (coverage < 0.98) {
    // The part of the tile that is not footway is shoulder: bare, unmade
    // ground that nobody maintains and nobody walks on by choice.
    const shoulder = surface(P.asphaltWorn, P.asphaltMid, P.concreteDark, P.asphaltDark, 0.14, seed ^ 0x31)
    const keepFromNorth = kerb === 'north'
    for (let y = 0; y < TILE_H; y++) {
      for (let x = 0; x < TILE_W; x++) {
        const i = y * TILE_W + x
        if (bmp.data[i] === 0) continue
        // Position across the tile, 0 at the north edge and 1 at the south.
        const v = crossPosition(x, y)
        const onFootway = keepFromNorth ? v <= coverage : v >= 1 - coverage
        if (!onFootway) bmp.data[i] = shoulder.data[i]!
      }
    }
  }
  // Expansion joints, one along and one across, so pavements read as slabs.
  stripeAlongX(bmp, 0.5, P.concreteDark, 1)
  stripeAlongY(bmp, 0.5, P.concreteDark, 1)
  if (kerb) {
    // A kerb is a lit top edge over a shadowed face. Without it the pavement
    // and the carriageway read as one continuous surface, which is exactly the
    // impression a corridor like this gives on foot - but it is not true.
    const v = kerb === 'north' ? 0.04 : 0.94
    stripeAlongX(bmp, v, P.concreteLight, 2)
    stripeAlongX(bmp, kerb === 'north' ? v - 0.03 : v + 0.05, P.concreteDark, 1)
  }
  return bmp
}

export function grassSurface(seed: number): Bitmap {
  const bmp = surface(P.leafMid, P.leafDark, P.leafLight, P.leafDark, 0.14, seed)
  speckle(bmp, 0, 0, TILE_W, TILE_H, P.leafHigh, 0.08, seed ^ 0x1234)
  return bmp
}

export function dirtSurface(seed: number): Bitmap {
  const bmp = surface(P.woodMid, P.woodDark, P.woodLight, P.woodDark, 0.12, seed)
  speckle(bmp, 0, 0, TILE_W, TILE_H, P.leafDark, 0.05, seed ^ 0x77)
  return bmp
}

export function plazaSurface(seed: number): Bitmap {
  const bmp = surface(P.concreteLight, P.concreteMid, P.stuccoLight, P.concreteMid, 0.05, seed)
  // A quartered paving pattern with a warm inlay, so a plaza reads as designed
  // rather than as a car park somebody forgot to stripe.
  stripeAlongX(bmp, 0.25, P.stuccoMid, 1)
  stripeAlongX(bmp, 0.75, P.stuccoMid, 1)
  stripeAlongY(bmp, 0.25, P.stuccoMid, 1)
  stripeAlongY(bmp, 0.75, P.stuccoMid, 1)
  return bmp
}

// ---------------------------------------------------------------------------
// Roadway
// ---------------------------------------------------------------------------

export type RoadRole =
  | 'lane'
  | 'lane_divider'
  | 'centre_double'
  | 'turn_lane'
  | 'bike_painted'
  | 'bike_protected'
  | 'bus_lane'
  | 'parking_bay'
  | 'crosswalk'
  | 'median_raised'
  | 'median_planted'
  | 'stop_bar'

export function roadTile(role: RoadRole, seed: number): Bitmap {
  const bmp = asphaltSurface(seed)

  switch (role) {
    case 'lane':
      break

    case 'lane_divider':
      // A dashed white skip line on the tile's upstream edge.
      stripeAlongX(bmp, 0.02, P.lineWhite, 1, [10, 12])
      break

    case 'centre_double':
      stripeAlongX(bmp, 0.42, P.lineYellow, 1)
      stripeAlongX(bmp, 0.58, P.lineYellow, 1)
      break

    case 'turn_lane': {
      // A two-way left turn lane: yellow on both edges, the inner one broken.
      stripeAlongX(bmp, 0.06, P.lineYellow, 1)
      stripeAlongX(bmp, 0.16, P.lineYellow, 1, [8, 10])
      stripeAlongX(bmp, 0.84, P.lineYellow, 1, [8, 10])
      stripeAlongX(bmp, 0.94, P.lineYellow, 1)
      break
    }

    case 'bike_painted':
      stripeAlongX(bmp, 0.08, P.lineWhite, 1)
      stripeAlongX(bmp, 0.92, P.lineWhite, 1)
      break

    case 'bike_protected': {
      // Green surfacing between a kerb and a buffer.
      for (let y = 0; y < TILE_H; y++) {
        for (let x = 0; x < TILE_W; x++) {
          const i = y * TILE_W + x
          if (bmp.data[i] === 0) continue
          if (bmp.data[i] === P.asphaltDark) bmp.data[i] = P.leafDark
          else if (bmp.data[i] === P.asphaltLight || bmp.data[i] === P.asphaltWorn) bmp.data[i] = P.leafLight
          else bmp.data[i] = P.leafMid
        }
      }
      stripeAlongX(bmp, 0.06, P.lineWhite, 1)
      stripeAlongX(bmp, 0.94, P.concreteLight, 2)
      break
    }

    case 'bus_lane': {
      stripeAlongX(bmp, 0.06, P.lineWhite, 2)
      stripeAlongX(bmp, 0.94, P.lineWhite, 2)
      // A painted diamond in the middle of the lane.
      const cx = TILE_W / 2
      const cy = TILE_H / 2
      for (let d = 0; d < 5; d++) {
        px(bmp, cx - d, cy + Math.round(d / 2), P.lineWhite)
        px(bmp, cx + d, cy + Math.round(d / 2), P.lineWhite)
        px(bmp, cx - d, cy - Math.round(d / 2), P.lineWhite)
        px(bmp, cx + d, cy - Math.round(d / 2), P.lineWhite)
      }
      break
    }

    case 'parking_bay':
      stripeAlongY(bmp, 0.04, P.lineWhite, 1)
      stripeAlongY(bmp, 0.52, P.lineWhite, 1)
      stripeAlongX(bmp, 0.04, P.lineWhite, 1)
      break

    case 'crosswalk':
      // A ladder crossing: bars parallel to traffic, spaced across it.
      for (const v of [0.12, 0.3, 0.48, 0.66, 0.84]) {
        stripeAlongX(bmp, v, P.lineWhite, 2)
      }
      break

    case 'stop_bar':
      stripeAlongY(bmp, 0.2, P.lineWhite, 3)
      break

    case 'median_raised': {
      const kerb = makeBitmap(TILE_W, TILE_H)
      isoDiamond(kerb, 0, 0, TILE_W, TILE_H, P.concreteMid)
      ditherOver(kerb, 0, 0, TILE_W, TILE_H, P.concreteLight, 0.3)
      isoDiamondEdge(kerb, 0, 0, TILE_W, TILE_H, P.concreteLight)
      speckle(kerb, 0, 0, TILE_W, TILE_H, P.concreteDark, 0.06, seed)
      return kerb
    }

    case 'median_planted': {
      const planted = grassSurface(seed)
      isoDiamondEdge(planted, 0, 0, TILE_W, TILE_H, P.concreteLight)
      return planted
    }
  }
  return bmp
}

/**
 * A surface car park: worn asphalt with faded bay markings. The single most
 * common surface on Commerce Blvd, so it had better not look like filler.
 */
export function parkingLotTile(seed: number, faded: boolean, aisle = false): Bitmap {
  const bmp = asphaltSurface(seed, true)
  const stripe = faded ? P.asphaltWorn : P.lineWhite
  // Bay markings are short ticks off an aisle, not lines across the world.
  // An aisle row carries no markings at all, which is what makes the pattern
  // read as a car park rather than as a texture.
  if (!aisle) {
    stripeAlongY(bmp, 0.14, stripe, 1, null, 0.04, 0.5)
    stripeAlongY(bmp, 0.64, stripe, 1, null, 0.04, 0.5)
  }
  if (faded) speckle(bmp, 0, 0, TILE_W, TILE_H, P.asphaltDark, 0.1, seed ^ 0xabcd)
  const rng = spriteRng(seed ^ 0x5eed)

  // Patch repairs and cracking, so a large car park is not one repeating cell.
  // Eight cached variants per surface is enough to break the eye's pattern.
  if (rng() < 0.3) {
    const px0 = 14 + Math.floor(rng() * 22)
    const py0 = 6 + Math.floor(rng() * 14)
    const pw = 8 + Math.floor(rng() * 14)
    const ph = 4 + Math.floor(rng() * 6)
    for (let y = 0; y < ph; y++) {
      for (let x = 0; x < pw; x++) {
        if (getPx(bmp, px0 + x, py0 + y) === 0) continue
        px(bmp, px0 + x, py0 + y, P.asphaltDark)
      }
    }
    speckle(bmp, px0, py0, pw, ph, P.asphaltMid, 0.3, seed ^ 0x1f1f)
  }
  if (rng() < 0.4) {
    // A crack, running roughly with the slope of the bay markings.
    const cx0 = 10 + Math.floor(rng() * 30)
    const cy0 = 6 + Math.floor(rng() * 16)
    let x = cx0
    let y = cy0
    for (let step = 0; step < 10 + Math.floor(rng() * 10); step++) {
      if (getPx(bmp, x, y) !== 0) px(bmp, x, y, P.asphaltDark)
      x += rng() < 0.75 ? 1 : 2
      if (rng() < 0.5) y += rng() < 0.5 ? 1 : 0
    }
  }

  // Weeds coming through the cracks, because they always do.
  if (rng() < 0.35) {
    const wx = 12 + Math.floor(rng() * 40)
    const wy = 8 + Math.floor(rng() * 16)
    px(bmp, wx, wy, P.leafDark)
    px(bmp, wx + 1, wy, P.leafMid)
    px(bmp, wx, wy - 1, P.leafMid)
  }
  return bmp
}

/** A kerb edge, drawn as a thin lip along one side of a tile. */
export function kerbEdge(side: 'north' | 'south'): Bitmap {
  const bmp = makeBitmap(TILE_W, TILE_H + 3)
  const v = side === 'north' ? 0.0 : 1.0
  stripeAlongX(bmp, v, P.concreteLight, 1, null, 0, 1, false)
  stripeAlongX(bmp, v + (side === 'north' ? 0.02 : -0.02), P.concreteMid, 1, null, 0, 1, false)
  for (let x = 0; x < TILE_W; x++) {
    for (let y = TILE_H - 1; y >= 0; y--) {
      if (bmp.data[y * TILE_W + x] !== 0) {
        hline(bmp, x, y + 1, 1, P.concreteDark)
        break
      }
    }
  }
  return bmp
}
