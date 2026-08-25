/**
 * Turns a SimState into something drawable.
 *
 * The important property here is that the picture is a FUNCTION of the model.
 * Nothing is decorative: if the road is narrower on screen it is because the
 * lanes got narrower, if a shopfront sits at the pavement it is because the
 * setback changed, and if the trees are small it is because they were planted
 * eight years ago.
 */

import { C } from '../sim/constants'
import { profileFor } from '../sim/landuse'
import { crossingDistanceFt } from '../sim/traffic'
import { makeRng } from '../sim/rng'
import type { Parcel, SimState, StreetState } from '../sim/types'
import { TILE_FT } from './iso'
import type { RoadRole } from './sprites/ground'

export type TileKind =
  | { sort: 'road'; role: RoadRole }
  | { sort: 'walk'; kerb: 'north' | 'south' | null; coverage: number }
  | { sort: 'lot'; faded: boolean; aisle: boolean }
  | { sort: 'grass' }
  | { sort: 'dirt' }
  | { sort: 'plaza' }

export type PropKind =
  | 'tree' | 'cobra' | 'pedlight' | 'signal' | 'shelter' | 'shelter_upgraded'
  | 'hydrant' | 'bench' | 'pole' | 'person' | 'parked_car'

export interface SceneTile {
  gx: number
  gy: number
  kind: TileKind
  seed: number
}

export interface SceneBuilding {
  gx: number
  gy: number
  parcelId: string
  use: Parcel['use']
  footprintW: number
  footprintD: number
  floors: number
  seed: number
  condition: number
}

export interface SceneProp {
  gx: number
  gy: number
  kind: PropKind
  seed: number
  /** 0..1 for trees. */
  maturity?: number
}

export interface TrafficLane {
  /** Grid row the lane occupies. */
  gy: number
  /** True if vehicles travel in +x. */
  forward: boolean
}

export interface Scene {
  gridW: number
  gridH: number
  tiles: SceneTile[]
  buildings: SceneBuilding[]
  props: SceneProp[]
  lanes: TrafficLane[]
  /** Rows that are pavement, for placing people. */
  walkRows: number[]
  /** Vehicles per day, for how busy the corridor looks. */
  aadt: number
  /** Peak running speed, which sets the gap between vehicles. */
  peakSpeedMph: number
  /** Share of trips on foot, for how many people are out. */
  walkShare: number
  busesPerHour: number
  year: number
}

/** Depth of each parcel row, in feet. */
const FRONT_ROW_DEPTH_FT = 250
const BACK_ROW_DEPTH_FT = 150

interface Band { role: RoadRole; feet: number }

/**
 * The roadway cross-section, north kerb to south kerb, in feet.
 *
 * Built from the street state rather than from a fixed template, so every
 * instrument the player touches is visible in the picture: a lane removed is a
 * band removed, a protected bike lane is a green band that was not there
 * before.
 */
export function roadBands(street: StreetState): Band[] {
  const bands: Band[] = []
  const lane = street.laneWidthFt

  const parkingFeet = street.onStreetParking === 'none' ? 0 : 8
  const bikeFeet = street.bikeFacility === 'protected' ? 7
    : street.bikeFacility === 'buffered' ? 6
      : street.bikeFacility === 'painted' ? 5 : 0
  const bikeRole: RoadRole = street.bikeFacility === 'protected' ? 'bike_protected' : 'bike_painted'

  const side = (inbound: boolean): Band[] => {
    const out: Band[] = []
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

interface Layout {
  gridW: number
  gridH: number
  northBack: [number, number]
  northFront: [number, number]
  northWalk: [number, number]
  road: [number, number]
  southWalk: [number, number]
  southFront: [number, number]
  southBack: [number, number]
  roadRows: { gy: number; role: RoadRole }[]
}

function tilesFor(feet: number): number {
  return Math.max(1, Math.round(feet / TILE_FT))
}

export function layoutFor(street: StreetState): Layout {
  const gridW = Math.ceil(C.CORRIDOR_LENGTH_FT / TILE_FT)
  // Pavements narrower than a tile still get a tile; how much of it they cover
  // is carried on the tile itself.
  const walkTiles = Math.max(1, Math.ceil(Math.max(4, street.sidewalkWidthFt) / TILE_FT))
  const backTiles = tilesFor(BACK_ROW_DEPTH_FT)
  const frontTiles = tilesFor(FRONT_ROW_DEPTH_FT)

  const bands = roadBands(street)
  const roadRows: { gy: number; role: RoadRole }[] = []

  let cursor = 0
  const northBack: [number, number] = [cursor, cursor + backTiles]; cursor += backTiles
  const northFront: [number, number] = [cursor, cursor + frontTiles]; cursor += frontTiles
  const northWalk: [number, number] = [cursor, cursor + walkTiles]; cursor += walkTiles

  const roadStart = cursor
  // Cumulative rounding across the whole cross-section, so bands do not each
  // round up independently and inflate the road.
  //
  // The grid quantum is one traffic lane, which means a change in lane WIDTH
  // between ten and twelve feet may not move the drawn kerb line at all. Lane
  // COUNT always does. Narrowing is visible in the model (operating speed,
  // crash rate) and in the markings rather than in the drawn width.
  let feetSoFar = 0
  let tilesPlaced = 0
  for (const band of bands) {
    feetSoFar += band.feet
    const wanted = Math.round(feetSoFar / TILE_FT)
    const count = Math.max(band.feet > 1 ? 1 : 0, wanted - tilesPlaced)
    for (let i = 0; i < count; i++) roadRows.push({ gy: roadStart + tilesPlaced + i, role: band.role })
    tilesPlaced += count
  }
  cursor = roadStart + tilesPlaced
  const road: [number, number] = [roadStart, cursor]

  const southWalk: [number, number] = [cursor, cursor + walkTiles]; cursor += walkTiles
  const southFront: [number, number] = [cursor, cursor + frontTiles]; cursor += frontTiles
  const southBack: [number, number] = [cursor, cursor + backTiles]; cursor += backTiles

  return {
    gridW, gridH: cursor,
    northBack, northFront, northWalk, road, southWalk, southFront, southBack, roadRows,
  }
}

/** Where a parcel sits on the grid. */
function parcelBox(parcel: Parcel, layout: Layout): { x0: number; x1: number; y0: number; y1: number } {
  const depthFt = parcel.depth === 0 ? FRONT_ROW_DEPTH_FT : BACK_ROW_DEPTH_FT
  const widthFt = (parcel.acres * 43560) / depthFt
  const x0 = Math.round((parcel.station - widthFt / 2) / TILE_FT)
  const x1 = Math.max(x0 + 1, Math.round((parcel.station + widthFt / 2) / TILE_FT))

  let range: [number, number]
  if (parcel.side === 'north') range = parcel.depth === 0 ? layout.northFront : layout.northBack
  else range = parcel.depth === 0 ? layout.southFront : layout.southBack

  return { x0, x1, y0: range[0], y1: range[1] }
}

/** How far this parcel's building sits back from the pavement, in tiles. */
function setbackTiles(parcel: Parcel): number {
  return Math.max(0, Math.round(profileFor(parcel.use).entranceSetbackFt / TILE_FT))
}

export function buildScene(state: SimState): Scene {
  const layout = layoutFor(state.street)
  const rng = makeRng(`${state.seed}:scene:${state.year}`)
  const tiles: SceneTile[] = []
  const buildings: SceneBuilding[] = []
  const props: SceneProp[] = []

  const cell = (gx: number, gy: number, kind: TileKind): void => {
    tiles.push({ gx, gy, kind, seed: (gx * 73856093) ^ (gy * 19349663) })
  }

  // --- Roadway ---
  const crossingEvery = Math.max(6, Math.round(state.street.crossingSpacingFt / TILE_FT))
  const signalEvery = Math.round(layout.gridW / 6)
  for (let gx = 0; gx < layout.gridW; gx++) {
    const atCrossing = gx % crossingEvery === 0
    for (const row of layout.roadRows) {
      const role: RoadRole = atCrossing && row.role !== 'median_raised' && row.role !== 'median_planted'
        ? 'crosswalk' : row.role
      cell(gx, row.gy, { sort: 'road', role })
    }
  }

  // --- Pavements ---
  const walkRows: number[] = []
  const walkFeet = Math.max(4, state.street.sidewalkWidthFt)
  for (const [index, [start, end]] of [layout.northWalk, layout.southWalk].entries()) {
    const rows = end - start
    for (let gy = start; gy < end; gy++) {
      walkRows.push(gy)
      // The kerb goes on whichever edge of the pavement meets the carriageway,
      // and the footway is measured outward from it.
      const fromKerb = index === 0 ? (end - 1 - gy) : (gy - start)
      const remaining = walkFeet - fromKerb * TILE_FT
      const coverage = Math.max(0.18, Math.min(1, remaining / TILE_FT))
      const kerb: 'north' | 'south' | null =
        index === 0 ? (gy === end - 1 ? 'south' : null) : (gy === start ? 'north' : null)
      void rows
      for (let gx = 0; gx < layout.gridW; gx++) cell(gx, gy, { sort: 'walk', kerb, coverage })
    }
  }

  // --- Parcels ---
  for (const parcel of state.parcels) {
    const box = parcelBox(parcel, layout)
    const profile = profileFor(parcel.use)
    const worn = parcel.condition < 0.45

    // The lot surface first.
    for (let gx = box.x0; gx < box.x1; gx++) {
      for (let gy = box.y0; gy < box.y1; gy++) {
        const acrossFrac = parcel.side === 'north'
          ? (gy - box.y0) / Math.max(1, box.y1 - box.y0)
          : 1 - (gy - box.y0) / Math.max(1, box.y1 - box.y0)
        // Parking sits between the pavement and the building, which is the
        // whole reason these places are unpleasant to walk through.
        const nearRoad = parcel.side === 'north' ? acrossFrac > 1 - profile.surfaceParkingShare
          : acrossFrac > 1 - profile.surfaceParkingShare

        // Bays run in pairs with a driving aisle between them, which is what
        // stops a car park reading as wallpaper.
        const aisle = ((gy - box.y0) % 3) === 2
        if (parcel.use === 'plaza') cell(gx, gy, { sort: 'plaza' })
        else if (parcel.use === 'park') cell(gx, gy, { sort: 'grass' })
        else if (parcel.use === 'vacant') cell(gx, gy, { sort: 'dirt' })
        else if (parcel.use === 'surface_parking') cell(gx, gy, { sort: 'lot', faded: worn, aisle })
        else if (nearRoad && profile.surfaceParkingShare > 0.05) cell(gx, gy, { sort: 'lot', faded: worn, aisle })
        else cell(gx, gy, { sort: 'grass' })
      }
    }

    // Then the building, set back from the pavement by its own frontage habit.
    if (parcel.floorArea > 400 && profile.stories > 0) {
      const footprintSqft = parcel.floorArea / Math.max(1, profile.stories)
      const parcelW = box.x1 - box.x0
      const parcelD = box.y1 - box.y0
      const wantTiles = Math.max(1, Math.round(footprintSqft / (TILE_FT * TILE_FT)))
      let fd = Math.max(1, Math.min(parcelD - 1, Math.round(Math.sqrt(wantTiles / 1.6))))
      let fw = Math.max(1, Math.min(parcelW, Math.round(wantTiles / fd)))
      if (fw > parcelW) { fw = parcelW; fd = Math.max(1, Math.min(parcelD - 1, Math.round(wantTiles / fw))) }

      const back = setbackTiles(parcel)
      // North-side buildings sit at the far edge of their lot from the road;
      // south-side buildings mirror it.
      const gy = parcel.side === 'north'
        ? Math.max(box.y0, box.y1 - fd - back)
        : Math.min(box.y1 - fd, box.y0 + back)
      const gx = box.x0 + Math.max(0, Math.floor((parcelW - fw) / 2))

      buildings.push({
        gx, gy, parcelId: parcel.id, use: parcel.use,
        footprintW: fw, footprintD: fd,
        floors: Math.max(1, Math.round(profile.stories)),
        seed: hashString(parcel.id),
        condition: parcel.condition,
      })

      // Cars parked in rows on the lot between the building and the road,
      // with gaps: a strip mall car park is never full, which is most of why
      // there is so much of it.
      const rows = Math.max(1, Math.min(4, Math.floor(back / 3)))
      const occupancy = Math.max(0.15, Math.min(0.8, parcel.surfaceStalls > 0
        ? (parcel.floorArea / 1000) * 2.2 / Math.max(1, parcel.surfaceStalls) : 0.2))
      for (let r = 0; r < rows; r++) {
        const py = parcel.side === 'north'
          ? box.y1 - 2 - r * 3
          : box.y0 + 1 + r * 3
        if (py <= box.y0 || py >= box.y1) continue
        for (let cx2 = box.x0 + 1; cx2 < box.x1 - 1; cx2 += 2) {
          if (rng.next() > occupancy) continue
          props.push({ gx: cx2, gy: py, kind: 'parked_car', seed: (cx2 * 31 + py * 17) | 0 })
        }
      }
    }

    // Parcel canopy: trees scattered according to how green the parcel is.
    const canopyTrees = Math.round(parcel.canopy * (box.x1 - box.x0) * 0.5)
    for (let t = 0; t < canopyTrees; t++) {
      const tx = box.x0 + Math.floor(rng.next() * Math.max(1, box.x1 - box.x0))
      const ty = box.y0 + Math.floor(rng.next() * Math.max(1, box.y1 - box.y0))
      props.push({ gx: tx, gy: ty, kind: 'tree', seed: (tx * 5081 + ty * 907) | 0, maturity: 0.55 + rng.next() * 0.45 })
    }
  }

  // --- Street trees, on the pavement, at the spacing the player paid for ---
  const treeSpacingFt = state.street.treesPerMilePerSide > 0
    ? 5280 / state.street.treesPerMilePerSide : Infinity
  if (Number.isFinite(treeSpacingFt)) {
    const every = Math.max(1, Math.round(treeSpacingFt / TILE_FT))
    // Trees planted this run are still growing. Fifteen years to useful shade.
    const plantedRecently = state.street.treesPerMilePerSide > 8
    const age = plantedRecently ? Math.min(1, state.year / C.STREET_TREE_MATURITY_YEARS) : 1
    for (let gx = 2; gx < layout.gridW; gx += every) {
      for (const [start, end] of [layout.northWalk, layout.southWalk]) {
        const gy = start === layout.northWalk[0] ? start : end - 1
        props.push({
          gx, gy, kind: 'tree', seed: (gx * 2654435761 + gy) | 0,
          maturity: gx % (every * 2) === 0 ? age : Math.min(1, age + 0.25),
        })
      }
    }
  }

  // --- Lighting, signals, poles, shelters ---
  const lightEvery = Math.max(2, Math.round(C.STREETLIGHT_SPACING_FT / TILE_FT /
    (state.street.lighting === 'pedestrian_scale' ? 2 : 1)))
  const lightKind: PropKind = state.street.lighting === 'pedestrian_scale' ? 'pedlight' : 'cobra'
  for (let gx = 1; gx < layout.gridW; gx += lightEvery) {
    props.push({ gx, gy: layout.northWalk[1] - 1, kind: lightKind, seed: gx })
    props.push({ gx: gx + Math.floor(lightEvery / 2), gy: layout.southWalk[0], kind: lightKind, seed: gx + 7 })
  }

  const activeSignals = 5 - state.street.roundabouts.length
  for (let s = 0; s < activeSignals; s++) {
    const gx = Math.round((s + 0.5) * signalEvery)
    props.push({ gx, gy: layout.northWalk[1] - 1, kind: 'signal', seed: gx })
  }

  if (!state.street.utilitiesUndergrounded) {
    for (let gx = 4; gx < layout.gridW; gx += 12) {
      props.push({ gx, gy: layout.southWalk[1] - 1, kind: 'pole', seed: gx })
    }
  }

  if (state.street.transitBusesPerHour > 0) {
    const stopEvery = Math.max(20, Math.round(1000 / TILE_FT))
    for (let gx = 8; gx < layout.gridW; gx += stopEvery) {
      props.push({
        gx, gy: layout.northWalk[0],
        kind: state.street.transitStopsUpgraded ? 'shelter_upgraded' : 'shelter',
        seed: gx,
      })
    }
  }

  for (let gx = 6; gx < layout.gridW; gx += 26) {
    props.push({ gx, gy: layout.northWalk[1] - 1, kind: 'hydrant', seed: gx })
  }
  if (state.street.sidewalkWidthFt >= 8) {
    for (let gx = 14; gx < layout.gridW; gx += 22) {
      props.push({ gx, gy: layout.southWalk[0], kind: 'bench', seed: gx })
    }
  }

  // --- People on the pavement, in proportion to how many actually walk ---
  const peopleCount = Math.round(layout.gridW * state.modeShare.walk * 0.9)
  for (let i = 0; i < peopleCount; i++) {
    const gx = Math.floor(rng.next() * layout.gridW)
    const gy = walkRows[Math.floor(rng.next() * walkRows.length)]!
    props.push({ gx, gy, kind: 'person', seed: (gx * 6151 + gy * 769 + i) | 0 })
  }

  // --- Which rows carry moving traffic ---
  const laneRows = layout.roadRows.filter((r) => r.role === 'lane' || r.role === 'lane_divider' || r.role === 'bus_lane')
  const midpoint = laneRows.length / 2
  const lanes: TrafficLane[] = laneRows.map((row, index) => ({ gy: row.gy, forward: index < midpoint }))

  return {
    gridW: layout.gridW,
    gridH: layout.gridH,
    tiles,
    buildings,
    props,
    lanes,
    walkRows,
    aadt: state.traffic.aadt,
    peakSpeedMph: state.traffic.peakSpeedMph,
    walkShare: state.modeShare.walk,
    busesPerHour: state.street.transitBusesPerHour,
    year: state.year,
  }
}

/** Crossing width in tiles, for the debug overlay and the walk camera later. */
export function roadWidthTiles(street: StreetState): number {
  return Math.round(crossingDistanceFt(street) / TILE_FT)
}

function hashString(value: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h | 0
}
