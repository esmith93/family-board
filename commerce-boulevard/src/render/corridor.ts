/**
 * The corridor as a line, measured in feet from the west end.
 *
 * The isometric view thinks in twelve-foot tiles because that is one traffic
 * lane and it makes the road look exact. A driver and a pedestrian do not
 * think in tiles: they think in how far away the next signal is, how many feet
 * of asphalt there are between them and the far pavement, and whether there is
 * a driveway about to cross the footway in front of them. This module is that
 * second way of looking at the same street.
 *
 * It is the single source of truth for where things are ALONG the corridor, so
 * a signal you can see from above is the same signal you stop at in the car and
 * the same signal you wait at on foot. It has no DOM dependency and no canvas
 * in it; everything here is arithmetic over SimState.
 */

import { C, profileFor, segmentOf, SEGMENT_LENGTH_FT, SIGNALS_ON_CORRIDOR } from '../sim/index'
import type { LandUse, Parcel, SimState, StreetState } from '../sim/index'
import type { RoadRole } from './sprites/ground'

export type Side = 'north' | 'south'

/** One band of the cross-section as the model describes it, in feet. */
export interface RoadBand { role: RoadRole; feet: number }

/**
 * The roadway cross-section, north kerb to south kerb, in feet.
 *
 * Built from the street state rather than from a fixed template, so every
 * instrument the player touches is visible in the picture: a lane removed is a
 * band removed, a protected bike lane is a green band that was not there
 * before.
 */
export function roadBands(street: StreetState): RoadBand[] {
  const bands: RoadBand[] = []
  const lane = street.laneWidthFt

  const parkingFeet = street.onStreetParking === 'none' ? 0 : 8
  const bikeFeet = street.bikeFacility === 'protected' ? 7
    : street.bikeFacility === 'buffered' ? 6
      : street.bikeFacility === 'painted' ? 5 : 0
  const bikeRole: RoadRole = street.bikeFacility === 'protected' ? 'bike_protected' : 'bike_painted'

  const side = (inbound: boolean): RoadBand[] => {
    const out: RoadBand[] = []
    if (parkingFeet > 0) out.push({ role: 'parking_bay', feet: parkingFeet })
    if (bikeFeet > 0) out.push({ role: bikeRole, feet: bikeFeet })
    if (street.busLane) out.push({ role: 'bus_lane', feet: lane })
    for (let i = 0; i < street.throughLanesPerDirection; i++) {
      out.push({ role: i === street.throughLanesPerDirection - 1 ? 'lane' : 'lane_divider', feet: lane })
    }
    return inbound ? out : out.reverse()
  }

  bands.push(...side(true))
  if (street.median === 'twltl') bands.push({ role: 'turn_lane', feet: lane })
  else if (street.median === 'raised') bands.push({ role: 'median_raised', feet: 8 })
  else if (street.median === 'landscaped') bands.push({ role: 'median_planted', feet: 10 })
  else bands.push({ role: 'centre_double', feet: 0.1 })
  bands.push(...side(false))

  return bands
}


/** One band of the carriageway, located across the street rather than along it. */
export interface Band {
  role: RoadRole
  /** Feet from the north kerb to this band's near edge. */
  fromFt: number
  widthFt: number
  /** +1 travels east, -1 west, 0 is not a running lane. */
  direction: 1 | -1 | 0
}

/** A junction. Some of them are roundabouts, which is a different experience. */
export interface Junction {
  index: number
  stationFt: number
  kind: 'signal' | 'roundabout'
}

export interface Crossing {
  stationFt: number
  /** Marked crossings at junctions are protected; the others are not. */
  signalised: boolean
}

export interface Frontage {
  parcelId: string
  use: LandUse
  /** Feet from the back of the pavement to the front door. */
  setbackFt: number
  /** Height of the building itself. */
  heightFt: number
  /** Feet along the corridor that this frontage occupies. */
  fromFt: number
  toFt: number
  /** How far back from its own front wall the building goes. */
  depthFt: number
  /** How the frontage reads to somebody on foot, 0..1. */
  quality: number
  /** Share of the site given to surface parking. */
  parkingShare: number
  condition: number
}

/** A driveway crossing the footway. Every one is a place a car turns across you. */
export interface CurbCut {
  stationFt: number
  side: Side
  widthFt: number
}

export interface StreetTree {
  stationFt: number
  side: Side
  maturity: number
}

export interface CorridorModel {
  lengthFt: number
  /** North kerb to south kerb. */
  roadWidthFt: number
  sidewalkWidthFt: number
  bands: Band[]
  junctions: Junction[]
  crossings: Crossing[]
  north: Frontage[]
  south: Frontage[]
  curbCuts: CurbCut[]
  trees: StreetTree[]
  /** Segments with no through traffic at all. */
  plazaSegments: number[]
  year: number
}

/** Feet per floor, matching what the isometric view draws. */
const FLOOR_HEIGHT_FT = 11

/**
 * Where the junctions are.
 *
 * Five of them, spread evenly with a half-space at each end, so the first is
 * not on the city limit and the last is not either. A junction the player has
 * converted to a roundabout is still a junction; it is just one you do not sit
 * at.
 */
export function junctionsOf(street: StreetState): Junction[] {
  const out: Junction[] = []
  for (let i = 0; i < SIGNALS_ON_CORRIDOR; i++) {
    out.push({
      index: i,
      stationFt: ((i + 0.5) * C.CORRIDOR_LENGTH_FT) / SIGNALS_ON_CORRIDOR,
      kind: street.roundabouts.includes(i) ? 'roundabout' : 'signal',
    })
  }
  return out
}

/**
 * Where it is legal to cross.
 *
 * Every junction is a crossing whether or not the city marked one, plus
 * whatever marked crossings the spacing buys between them. Fairview starts at
 * about thirteen hundred feet between them, which is a quarter of a mile of
 * walking to go forty feet sideways.
 */
export function crossingsOf(street: StreetState): Crossing[] {
  const out: Crossing[] = junctionsOf(street).map((j) => ({ stationFt: j.stationFt, signalised: true }))
  const spacing = Math.max(120, street.crossingSpacingFt)
  for (let station = spacing; station < C.CORRIDOR_LENGTH_FT; station += spacing) {
    // Do not mark one on top of a junction.
    if (out.some((c) => Math.abs(c.stationFt - station) < spacing * 0.4)) continue
    out.push({ stationFt: station, signalised: false })
  }
  return out.sort((a, b) => a.stationFt - b.stationFt)
}

/** The cross-section, north kerb to south kerb, with running directions. */
export function bandsOf(street: StreetState): Band[] {
  const raw = roadBands(street)
  const out: Band[] = []
  let cursor = 0
  // roadBands lays the northern half down first. Traffic on the northern half
  // of a two-way street runs west; on the southern half it runs east.
  const centre = raw.reduce((sum, b) => sum + b.feet, 0) / 2
  for (const band of raw) {
    const running = band.role === 'lane' || band.role === 'lane_divider' || band.role === 'bus_lane'
    out.push({
      role: band.role,
      fromFt: cursor,
      widthFt: band.feet,
      direction: running ? (cursor + band.feet / 2 < centre ? -1 : 1) : 0,
    })
    cursor += band.feet
  }
  return out
}

export function roadWidthFt(street: StreetState): number {
  return roadBands(street).reduce((sum, b) => sum + b.feet, 0)
}

/**
 * The frontages, in order along the corridor.
 *
 * Only the front row: the back row is not visible from the street and a person
 * on the pavement has never heard of it.
 */
export function frontagesOf(parcels: readonly Parcel[], side: Side): Frontage[] {
  return parcels
    .filter((p) => p.depth === 0 && p.side === side)
    .map((p) => {
      const profile = profileFor(p.use)
      const lotDepthFt = 250
      const widthFt = (p.acres * 43560) / lotDepthFt
      // A single-storey box with a hundred thousand square feet in it is three
      // hundred feet deep; the same floor area over four storeys is not.
      const footprint = p.floorArea / Math.max(1, p.stories)
      const depthFt = p.floorArea <= 0 ? 0
        : Math.max(18, Math.min(lotDepthFt, footprint / Math.max(20, widthFt)))
      return {
        parcelId: p.id,
        use: p.use,
        setbackFt: p.frontSetbackFt,
        heightFt: p.floorArea <= 0 ? 0 : Math.max(1, Math.round(p.stories)) * FLOOR_HEIGHT_FT,
        fromFt: p.station - widthFt / 2,
        toFt: p.station + widthFt / 2,
        depthFt,
        quality: profile.frontageQuality,
        parkingShare: profile.surfaceParkingShare,
        condition: p.condition,
      }
    })
    .sort((a, b) => a.fromFt - b.fromFt)
}

/** Which frontage is at this station, if any. */
export function frontageAt(frontages: readonly Frontage[], stationFt: number): Frontage | null {
  for (const f of frontages) {
    if (stationFt >= f.fromFt && stationFt < f.toFt) return f
  }
  return null
}

/**
 * Every driveway onto the boulevard.
 *
 * Spread evenly across each parcel's frontage, because that is how a strip
 * corridor does it: one in, one out, and nothing between them but kerb.
 */
export function curbCutsOf(parcels: readonly Parcel[]): CurbCut[] {
  const out: CurbCut[] = []
  for (const side of ['north', 'south'] as const) {
    for (const f of frontagesOf(parcels, side)) {
      const count = Math.round(profileFor(f.use).curbCutsPerParcel)
      const span = f.toFt - f.fromFt
      for (let i = 0; i < count; i++) {
        out.push({
          stationFt: f.fromFt + (span * (i + 1)) / (count + 1),
          side,
          widthFt: 30,
        })
      }
    }
  }
  return out.sort((a, b) => a.stationFt - b.stationFt)
}

/**
 * The street trees.
 *
 * Planted at even spacing from the density the player paid for, and no more
 * mature than the years since they went in. A tree planted in year nine is a
 * stick in year eleven and shade in year twenty-four, and it is drawn that way
 * in every view.
 */
export function treesOf(street: StreetState, year: number): StreetTree[] {
  if (street.treesPerMilePerSide <= 0) return []
  const perSide = (street.treesPerMilePerSide * C.CORRIDOR_LENGTH_FT) / 5280
  if (perSide < 1) return []
  const spacing = C.CORRIDOR_LENGTH_FT / perSide
  const out: StreetTree[] = []
  for (const side of ['north', 'south'] as const) {
    for (let station = spacing / 2; station < C.CORRIDOR_LENGTH_FT; station += spacing) {
      out.push({ stationFt: station, side, maturity: maturityAt(year, station, side) })
    }
  }
  return out
}

/**
 * How grown a tree is, 0 to 1.
 *
 * Deliberately not uniform: a corridor whose trees all went in at once and are
 * all exactly the same height reads as wallpaper. The variation is a function
 * of position, so it is the same every time the view is opened.
 */
function maturityAt(year: number, station: number, side: Side): number {
  const jitter = ((Math.sin(station * 0.017 + (side === 'north' ? 0 : 1.7)) + 1) / 2) * 0.25
  const grown = Math.max(0, Math.min(1, year / 22))
  return Math.max(0.05, Math.min(1, grown * (0.85 + jitter)))
}

/** Everything both first-person cameras need, built once per year. */
export function corridorModel(state: SimState): CorridorModel {
  const street = state.street
  return {
    lengthFt: C.CORRIDOR_LENGTH_FT,
    roadWidthFt: roadWidthFt(street),
    sidewalkWidthFt: Math.max(3, street.sidewalkWidthFt),
    bands: bandsOf(street),
    junctions: junctionsOf(street),
    crossings: crossingsOf(street),
    north: frontagesOf(state.parcels, 'north'),
    south: frontagesOf(state.parcels, 'south'),
    curbCuts: curbCutsOf(state.parcels),
    trees: treesOf(street, state.year),
    plazaSegments: [...street.plazaSegments],
    year: state.year,
  }
}

/** Is this station inside a block the player has closed to through traffic? */
export function inPlaza(model: CorridorModel, stationFt: number): boolean {
  return model.plazaSegments.includes(segmentOf(stationFt))
}

/** Distance to the next crossing in either direction, in feet. */
export function walkToCrossing(model: CorridorModel, stationFt: number): number {
  let best = Infinity
  for (const c of model.crossings) best = Math.min(best, Math.abs(c.stationFt - stationFt))
  return best === Infinity ? C.CORRIDOR_LENGTH_FT : best
}

export { SEGMENT_LENGTH_FT }
