/**
 * The ground both first-person cameras stand on.
 *
 * The corridor as a plan, in feet, with a coarse occupancy grid over it for
 * ray casting and a set of functions that answer "what is at this point on the
 * street". The drive camera and the walk camera share all of it, so the tree
 * you pass at forty miles an hour is the tree you stand under on foot.
 *
 * Coordinates: x runs east along the corridor from the west end, y runs south
 * across it with zero at the NORTH KERB. So the carriageway is y in
 * [0, roadWidthFt], the north pavement is negative, and the south pavement is
 * past the far kerb. No DOM anywhere in this file.
 */

import type { CorridorModel, Frontage, Side } from './corridor'
import { P } from './palette'

/** Grid cell for the occupancy map, in feet. One traffic lane. */
export const CELL_FT = 12

/** What a ray can hit. Zero is open air. */
export const enum Solid {
  Open = 0,
  Brick = 1,
  Stucco = 2,
  Concrete = 3,
  Glass = 4,
  Fence = 5,
}

export interface Plan {
  model: CorridorModel
  /** Occupancy: one Solid per cell. */
  solid: Uint8Array
  /** Wall top, in feet divided by two, so one byte reaches five hundred feet. */
  topHalfFt: Uint8Array
  /** Ground floor use, for shopfront windows at eye level. */
  quality: Uint8Array
  gw: number
  gh: number
  /** World y, in feet, of grid row zero. */
  originY: number
  /** Distance from the north kerb to the south kerb. */
  roadWidthFt: number
  sidewalkWidthFt: number

  /*
   * Lookups, because `groundAt` runs once per pixel of road and the road is
   * most of the screen. Scanning a list of a hundred driveways per pixel cost
   * seventeen milliseconds a frame; the same answer out of an array costs
   * nothing. Nothing here is new information - it is the same model, indexed.
   */
  /** Per LOOKUP_FT of station: is there a marked crossing here. */
  crossingMask: Uint8Array
  /** Per LOOKUP_FT of station: is a driveway crossing the footway. */
  cutMaskNorth: Uint8Array
  cutMaskSouth: Uint8Array
  /**
   * The whole cross-section, precomputed.
   *
   * One `Ground` per eighth of a foot from `crossFromFt`, north to south. The
   * first version of this walked the band list and compared `band.role`
   * against six string literals for every pixel of road on the screen, which
   * is a third of a million string comparisons a frame and cost more than
   * everything else in the renderer put together.
   */
  cross: Uint8Array
  crossFlags: Uint8Array
  /** World y of `cross[0]`. */
  crossFromFt: number
  /**
   * The cross-section, resolved for every combination of the five things that
   * vary ALONG the street: whether this station is inside a marked crossing, a
   * dash of a lane line, a driveway on either side, or a slab joint.
   *
   * Thirty-two copies of sixteen hundred bytes, built once a year. What it
   * buys is a floor-casting inner loop that is one array read per pixel, with
   * every branch hoisted to the row that shares them - which is the whole
   * trick of drawing a floor in perspective and has been since 1992.
   */
  variants: Uint8Array[]
  /** Per LOOKUP_FT of station: which frontage, or -1. */
  frontageNorth: Int16Array
  frontageSouth: Int16Array
}

/** Resolution of the along-corridor lookups, in feet. */
const LOOKUP_FT = 2
/** Samples per foot across the street. An eighth of a foot resolves a stripe. */
const CROSS_PER_FT = 8

/** What a sample of the cross-section needs saying about it. */
export const enum CrossFlag {
  Carriageway = 1,
  Footway = 2,
  /** A lane line that is dashed rather than solid, so it depends on station. */
  Dashed = 4,
  /** Inside a median, which a crossing does not paint over. */
  Median = 8,
}

/** Where the near edge of a side's pavement is, in world y. */
export function walkEdge(model: CorridorModel, side: Side): number {
  return side === 'north' ? -model.sidewalkWidthFt : model.roadWidthFt
}

/** The middle of a side's pavement, which is where a person walks. */
export function walkCentre(model: CorridorModel, side: Side): number {
  return side === 'north'
    ? -model.sidewalkWidthFt / 2
    : model.roadWidthFt + model.sidewalkWidthFt / 2
}

/** Where a frontage's front wall stands, in world y. */
export function facadeY(model: CorridorModel, side: Side, frontage: Frontage): number {
  return side === 'north'
    ? -(model.sidewalkWidthFt + frontage.setbackFt)
    : model.roadWidthFt + model.sidewalkWidthFt + frontage.setbackFt
}

/** Which material a use presents to the street. */
function materialFor(frontage: Frontage): Solid {
  if (frontage.quality > 0.7) return Solid.Glass
  if (frontage.quality > 0.25) return Solid.Brick
  if (frontage.heightFt > 30) return Solid.Concrete
  return Solid.Stucco
}

/**
 * Build the occupancy grid.
 *
 * Every solid thing in it came out of a parcel: a building's frontage, its
 * as-built setback, and how deep it is given its floor area and how many
 * storeys it has. A car park has no floor area, so it puts nothing in the
 * grid at all, which is why the corridor at year zero is a view of the sky.
 */
export function buildPlan(model: CorridorModel): Plan {
  // How far north and south the grid has to reach to hold the deepest building.
  const reach = (frontages: readonly Frontage[]): number =>
    frontages.reduce((max, f) => Math.max(max, f.setbackFt + f.depthFt), 0)
  const north = model.sidewalkWidthFt + reach(model.north) + CELL_FT * 2
  const south = model.roadWidthFt + model.sidewalkWidthFt + reach(model.south) + CELL_FT * 2

  const originY = -north
  const gw = Math.ceil(model.lengthFt / CELL_FT)
  const gh = Math.ceil((north + south) / CELL_FT)
  const solid = new Uint8Array(gw * gh)
  const topHalfFt = new Uint8Array(gw * gh)
  const quality = new Uint8Array(gw * gh)

  const stamp = (side: Side, frontages: readonly Frontage[]): void => {
    for (const frontage of frontages) {
      if (frontage.heightFt <= 0 || frontage.depthFt <= 0) continue
      const face = facadeY(model, side, frontage)
      const backY = side === 'north' ? face - frontage.depthFt : face + frontage.depthFt
      const y0 = Math.min(face, backY)
      const y1 = Math.max(face, backY)

      const cx0 = Math.max(0, Math.floor(frontage.fromFt / CELL_FT))
      const cx1 = Math.min(gw - 1, Math.ceil(frontage.toFt / CELL_FT) - 1)
      const cy0 = Math.max(0, Math.floor((y0 - originY) / CELL_FT))
      const cy1 = Math.min(gh - 1, Math.ceil((y1 - originY) / CELL_FT) - 1)

      const material = materialFor(frontage)
      const top = Math.min(255, Math.round(frontage.heightFt / 2))
      const q = Math.round(frontage.quality * 255)
      for (let cy = cy0; cy <= cy1; cy++) {
        for (let cx = cx0; cx <= cx1; cx++) {
          const i = cy * gw + cx
          solid[i] = material
          topHalfFt[i] = top
          quality[i] = q
        }
      }
    }
  }

  stamp('north', model.north)
  stamp('south', model.south)

  const slots = Math.ceil(model.lengthFt / LOOKUP_FT) + 2
  const crossingMask = new Uint8Array(slots)
  for (const crossing of model.crossings) {
    const from = Math.max(0, Math.floor((crossing.stationFt - CROSSWALK_HALF_FT) / LOOKUP_FT))
    const to = Math.min(slots - 1, Math.ceil((crossing.stationFt + CROSSWALK_HALF_FT) / LOOKUP_FT))
    for (let i = from; i <= to; i++) crossingMask[i] = 1
  }

  const cutMaskNorth = new Uint8Array(slots)
  const cutMaskSouth = new Uint8Array(slots)
  for (const cut of model.curbCuts) {
    const mask = cut.side === 'north' ? cutMaskNorth : cutMaskSouth
    const from = Math.max(0, Math.floor((cut.stationFt - cut.widthFt / 2) / LOOKUP_FT))
    const to = Math.min(slots - 1, Math.ceil((cut.stationFt + cut.widthFt / 2) / LOOKUP_FT))
    for (let i = from; i <= to; i++) mask[i] = 1
  }

  const crossFromFt = -model.sidewalkWidthFt - 1
  const crossToFt = model.roadWidthFt + model.sidewalkWidthFt + 1
  const crossLen = Math.ceil((crossToFt - crossFromFt) * CROSS_PER_FT) + 1
  const cross = new Uint8Array(crossLen)
  const crossFlags = new Uint8Array(crossLen)

  for (let i = 0; i < crossLen; i++) {
    const y = crossFromFt + i / CROSS_PER_FT
    if (y < 0 || y > model.roadWidthFt) {
      // Footway. The kerb is the first few inches of it.
      const fromKerb = y < 0 ? -y : y - model.roadWidthFt
      cross[i] = fromKerb < 0.6 ? Ground.Kerb : Ground.Pavement
      crossFlags[i] = CrossFlag.Footway
      continue
    }
    crossFlags[i] = CrossFlag.Carriageway
    const band = bandCovering(model.bands, y)
    if (!band) { cross[i] = Ground.Asphalt; continue }

    if (band.role === 'median_raised') { cross[i] = Ground.Kerb; crossFlags[i]! |= CrossFlag.Median; continue }
    if (band.role === 'median_planted') { cross[i] = Ground.Median; crossFlags[i]! |= CrossFlag.Median; continue }
    if (band.role === 'bike_protected' || band.role === 'bike_painted') { cross[i] = Ground.BikeLane; continue }
    if (band.role === 'parking_bay') { cross[i] = Ground.ParkingBay; continue }

    const edge = Math.min(Math.abs(y - band.fromFt), Math.abs(y - (band.fromFt + band.widthFt)))
    if ((band.role === 'centre_double' || band.role === 'turn_lane') && edge < STRIPE_HALF_FT * 2) {
      cross[i] = Ground.CentreLine
      continue
    }
    if (edge < STRIPE_HALF_FT) {
      cross[i] = Ground.LaneLine
      // Between two lanes going the same way the line is dashed, and whether
      // this pixel is inside a dash depends on how far along the street it is.
      if (band.role === 'lane_divider') crossFlags[i]! |= CrossFlag.Dashed
      continue
    }
    cross[i] = Ground.Asphalt
  }

  const indexFrontages = (frontages: readonly Frontage[]): Int16Array => {
    const out = new Int16Array(slots).fill(-1)
    for (let i = 0; i < frontages.length; i++) {
      const f = frontages[i]!
      const from = Math.max(0, Math.floor(f.fromFt / LOOKUP_FT))
      const to = Math.min(slots - 1, Math.ceil(f.toFt / LOOKUP_FT) - 1)
      for (let j = from; j <= to; j++) out[j] = i
    }
    return out
  }

  const variants: Uint8Array[] = []
  for (let v = 0; v < 32; v++) {
    const onCrossing = (v & ROW_CROSSING) !== 0
    const dashOn = (v & ROW_DASH) !== 0
    const cutNorth = (v & ROW_CUT_NORTH) !== 0
    const cutSouth = (v & ROW_CUT_SOUTH) !== 0
    const jointOn = (v & ROW_JOINT) !== 0
    const table = new Uint8Array(crossLen)
    for (let i = 0; i < crossLen; i++) {
      const y = crossFromFt + i / CROSS_PER_FT
      const flags = crossFlags[i]!
      const kind = cross[i]! as Ground
      if ((flags & CrossFlag.Footway) !== 0) {
        if (y < 0 ? cutNorth : cutSouth) { table[i] = Ground.Driveway; continue }
        table[i] = kind === Ground.Pavement && jointOn ? Ground.Joint : kind
        continue
      }
      if (onCrossing && (flags & CrossFlag.Median) === 0) {
        table[i] = ((y * 0.5) | 0) % 2 === 0 ? Ground.Crosswalk : Ground.Asphalt
        continue
      }
      if ((flags & CrossFlag.Dashed) !== 0) {
        table[i] = dashOn ? Ground.LaneLine : Ground.Asphalt
        continue
      }
      table[i] = kind
    }
    variants.push(table)
  }

  return {
    model, solid, topHalfFt, quality, gw, gh, originY,
    roadWidthFt: model.roadWidthFt,
    sidewalkWidthFt: model.sidewalkWidthFt,
    crossingMask, cutMaskNorth, cutMaskSouth, cross, crossFlags, crossFromFt, variants,
    frontageNorth: indexFrontages(model.north),
    frontageSouth: indexFrontages(model.south),
  }
}

/** Bits of the variant index. */
export const ROW_CROSSING = 1
export const ROW_DASH = 2
export const ROW_CUT_NORTH = 4
export const ROW_CUT_SOUTH = 8
export const ROW_JOINT = 16

/** Everything about one screen row that does not change across it. */
export interface RowContext {
  /** The resolved cross-section for this station. */
  table: Uint8Array
  /** Index into `table` for the row's leftmost world y, and the step per pixel. */
  index: number
  step: number
  /** Which frontage stands on each side at this station, or -1. */
  frontageNorth: number
  frontageSouth: number
  /** Grain seed for the row: the station never changes across a row. */
  grainX: number
  /** What lies beyond each pavement at this station. */
  beyondNorth: Ground
  beyondSouth: Ground
  /** True if this station falls on the painted line between two stalls. */
  onStallLine: boolean
}

/**
 * Everything a floor-cast row needs, worked out once for the whole row.
 *
 * A row of a floor in perspective is a single distance, so it is a single
 * station along the corridor: whether it is inside a crossing, a dash or a
 * driveway is decided once and then holds for every pixel in it.
 */
export function beginRow(
  plan: Plan, worldX: number, leftY: number, stepY: number, out: RowContext,
): RowContext {
  const slot = slotOf(plan, worldX)
  let variant = 0
  if (plan.crossingMask[slot] === 1) variant |= ROW_CROSSING
  if (((worldX / 24) | 0) % 2 === 0) variant |= ROW_DASH
  if (plan.cutMaskNorth[slot] === 1) variant |= ROW_CUT_NORTH
  if (plan.cutMaskSouth[slot] === 1) variant |= ROW_CUT_SOUTH
  if (Math.abs((worldX % 5) - 2.5) < 0.16) variant |= ROW_JOINT

  out.table = plan.variants[variant]!
  out.index = (leftY - plan.crossFromFt) * CROSS_PER_FT
  out.step = stepY * CROSS_PER_FT
  out.frontageNorth = plan.frontageNorth[slot]!
  out.frontageSouth = plan.frontageSouth[slot]!
  out.grainX = Math.round(worldX * 6)
  out.beyondNorth = beyondClass(out.frontageNorth, plan.model.north)
  out.beyondSouth = beyondClass(out.frontageSouth, plan.model.south)
  out.onStallLine = Math.abs((worldX % STALL_WIDTH_FT) - STALL_WIDTH_FT / 2) < 0.22
  return out
}

/** Car park, lawn or paving, decided once per row. */
function beyondClass(index: number, frontages: readonly Frontage[]): Ground {
  const frontage = index < 0 ? null : frontages[index]
  if (!frontage || frontage.parkingShare > 0.25) return Ground.Lot
  return frontage.quality > 0.6 ? Ground.Plaza : Ground.Grass
}

/** Is this point in a bay rather than in the aisle between two rows of them? */
export function inStallBand(y: number): boolean {
  const intoRow = ((y % STALL_ROW_FT) + STALL_ROW_FT) % STALL_ROW_FT
  return intoRow >= 4 && intoRow <= STALL_ROW_FT - 4
}

export function makeRowContext(): RowContext {
  return {
    table: new Uint8Array(1), index: 0, step: 0, frontageNorth: -1, frontageSouth: -1, grainX: 0,
    beyondNorth: Ground.Lot, beyondSouth: Ground.Lot, onStallLine: false,
  }
}

/** What is beyond the pavement at this row, given the frontage standing there. */
export function beyondRow(
  plan: Plan, row: RowContext, x: number, y: number,
): Ground {
  const index = y < 0 ? row.frontageNorth : row.frontageSouth
  const frontages = y < 0 ? plan.model.north : plan.model.south
  return beyondPavement(index, frontages, x, y)
}

function bandCovering(bands: CorridorModel['bands'], y: number): CorridorModel['bands'][number] | undefined {
  for (const band of bands) {
    if (y >= band.fromFt && y < band.fromFt + band.widthFt) return band
  }
  return undefined
}

/** Station to lookup slot, clamped. */
function slotOf(plan: Plan, x: number): number {
  const i = Math.floor(x / LOOKUP_FT)
  return i < 0 ? 0 : i >= plan.crossingMask.length ? plan.crossingMask.length - 1 : i
}

/** What the ray hit, in world terms. */
export interface Hit {
  /** Perpendicular distance, which is the one that does not fish-eye. */
  distFt: number
  solid: Solid
  topFt: number
  quality: number
  /** 0..1 across the face of the wall, for windows and trim. */
  wallU: number
  /** True if the ray hit a face running along the corridor. */
  lengthwise: boolean
}

/**
 * Cast one ray and collect what it passes through, nearest first.
 *
 * Variable heights mean a single hit is not enough: a strip mall in front of an
 * office block hides its lower half and not its upper. The caller draws them
 * back to front, which is also why there is no depth buffer anywhere.
 */
export function castRay(
  plan: Plan, fromX: number, fromY: number, dirX: number, dirY: number,
  maxDistFt: number, out: Hit[],
): number {
  out.length = 0
  const cellX0 = (fromX - 0) / CELL_FT
  const cellY0 = (fromY - plan.originY) / CELL_FT
  let mapX = Math.floor(cellX0)
  let mapY = Math.floor(cellY0)

  const rayX = dirX === 0 ? 1e-9 : dirX
  const rayY = dirY === 0 ? 1e-9 : dirY
  const deltaX = Math.abs(1 / rayX)
  const deltaY = Math.abs(1 / rayY)

  let stepX: number
  let stepY: number
  let sideDistX: number
  let sideDistY: number
  if (rayX < 0) { stepX = -1; sideDistX = (cellX0 - mapX) * deltaX }
  else { stepX = 1; sideDistX = (mapX + 1 - cellX0) * deltaX }
  if (rayY < 0) { stepY = -1; sideDistY = (cellY0 - mapY) * deltaY }
  else { stepY = 1; sideDistY = (mapY + 1 - cellY0) * deltaY }

  const maxCells = maxDistFt / CELL_FT
  let travelled = 0
  let lengthwise = false
  let tallestSoFar = 0

  for (let step = 0; step < 512 && out.length < 8; step++) {
    if (sideDistX < sideDistY) {
      travelled = sideDistX
      sideDistX += deltaX
      mapX += stepX
      // A face crossed in x runs ACROSS the corridor: a building's end wall.
      lengthwise = false
    } else {
      travelled = sideDistY
      sideDistY += deltaY
      mapY += stepY
      lengthwise = true
    }
    if (travelled > maxCells) break
    if (mapX < 0 || mapY < 0 || mapX >= plan.gw || mapY >= plan.gh) break

    const index = mapY * plan.gw + mapX
    const material = plan.solid[index]!
    if (material === Solid.Open) continue

    const topFt = plan.topHalfFt[index]! * 2
    // Nothing behind a wall already taller than everything is worth collecting.
    if (topFt <= tallestSoFar) continue
    tallestSoFar = topFt

    const distFt = travelled * CELL_FT
    const hitX = fromX + dirX * distFt
    const hitY = fromY + dirY * distFt
    const along = lengthwise ? hitX : hitY
    out.push({
      distFt,
      solid: material as Solid,
      topFt,
      quality: plan.quality[index]! / 255,
      wallU: (along / CELL_FT) - Math.floor(along / CELL_FT),
      lengthwise,
    })
  }
  return out.length
}

// --- The ground ------------------------------------------------------------

export const enum Ground {
  Asphalt = 0,
  LaneLine = 1,
  CentreLine = 2,
  Crosswalk = 3,
  Pavement = 4,
  Kerb = 5,
  Median = 6,
  BikeLane = 7,
  ParkingBay = 8,
  Lot = 9,
  Grass = 10,
  Plaza = 11,
  Driveway = 12,
  /** The painted line of a parking stall. */
  LotStripe = 13,
  /** The joint between two concrete pavement slabs. */
  Joint = 14,
}

/**
 * Palette index for each ground kind, so the caller never guesses.
 *
 * A typed array rather than a frozen object: this is read once per pixel of
 * road on the screen, and an object with integer keys is a dictionary lookup
 * where an array is an offset.
 */
export const GROUND_INK: Uint8Array = (() => {
  const table = new Uint8Array(16)
  table[Ground.Asphalt] = P.asphaltMid
  table[Ground.LaneLine] = P.lineWhite
  table[Ground.CentreLine] = P.lineYellow
  table[Ground.Crosswalk] = P.lineWhite
  table[Ground.Pavement] = P.concreteLight
  table[Ground.Kerb] = P.concreteMid
  table[Ground.Median] = P.leafMid
  table[Ground.BikeLane] = P.leafDark
  table[Ground.ParkingBay] = P.asphaltDark
  table[Ground.Lot] = P.asphaltWorn
  table[Ground.Grass] = P.leafMid
  table[Ground.Plaza] = P.concreteMid
  table[Ground.Driveway] = P.concreteDark
  table[Ground.LotStripe] = P.lineWhite
  table[Ground.Joint] = P.concreteMid
  return table
})()

const STRIPE_HALF_FT = 0.35
const CROSSWALK_HALF_FT = 6

/**
 * What is underfoot at a point on the plan.
 *
 * Everything here is read off the cross-section the player built. Take a lane
 * out and the band that lane occupied stops being asphalt; add kerbside
 * parking and a bay appears where the lane was. Nothing is drawn that the
 * model does not contain.
 */
export function groundAt(plan: Plan, x: number, y: number): Ground {
  const across = ((y - plan.crossFromFt) * CROSS_PER_FT) | 0
  if (across < 0 || across >= plan.cross.length) {
    const slot = slotOf(plan, x)
    return y < 0
      ? beyondPavement(plan.frontageNorth[slot]!, plan.model.north, x, y)
      : beyondPavement(plan.frontageSouth[slot]!, plan.model.south, x, y)
  }

  const flags = plan.crossFlags[across]!
  const slot = slotOf(plan, x)

  if ((flags & CrossFlag.Footway) !== 0) {
    const mask = y < 0 ? plan.cutMaskNorth : plan.cutMaskSouth
    if (mask[slot] === 1) return Ground.Driveway
    const kind = plan.cross[across]!
    // Pavement is poured in slabs, and the joints between them are the only
    // thing on a footway that tells you how fast you are walking.
    if (kind === Ground.Pavement && Math.abs((x % 5) - 2.5) < 0.16) return Ground.Joint
    return kind as Ground
  }

  if (plan.crossingMask[slot] === 1 && (flags & CrossFlag.Median) === 0) {
    // Zebra bars, painted across the direction of travel.
    return ((y * 0.5) | 0) % 2 === 0 ? Ground.Crosswalk : Ground.Asphalt
  }
  if ((flags & CrossFlag.Dashed) !== 0) {
    return ((x / 24) | 0) % 2 === 0 ? Ground.LaneLine : Ground.Asphalt
  }
  return plan.cross[across]! as Ground
}

/**
 * What is between the pavement and the building.
 *
 * On this corridor the answer is usually a car park, and a car park is not a
 * grey rectangle: it is a field of nine-foot stalls with a white line between
 * each of them, and those lines are most of what you see of it from a car.
 */
function beyondPavement(
  index: number, frontages: readonly Frontage[], x: number, y: number,
): Ground {
  const frontage = index < 0 ? null : frontages[index]
  if (!frontage || frontage.parkingShare > 0.25) return lotOrStripe(x, y)
  return frontage.quality > 0.6 ? Ground.Plaza : Ground.Grass
}

const STALL_WIDTH_FT = 9
const STALL_ROW_FT = 36

function lotOrStripe(x: number, y: number): Ground {
  if (!inStallBand(y)) return Ground.Lot
  return Math.abs((x % STALL_WIDTH_FT) - STALL_WIDTH_FT / 2) < 0.22 ? Ground.LotStripe : Ground.Lot
}
