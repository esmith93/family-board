/**
 * The picture must be a FUNCTION of the model.
 *
 * Nothing in the isometric view is decorative. If the road is narrower on
 * screen it is because the lanes got narrower; if a shopfront sits at the
 * pavement it is because the setback changed; if the trees are small it is
 * because they were planted eight years ago. These tests hold that line.
 */
import { describe, expect, it } from 'vitest'
import { newGame, advanceYear } from '../sim/step'
import { profileFor } from '../sim/landuse'
import { buildScene, layoutFor, roadBands } from './scene'
import { TILE_FT } from './iso'
import type { SimState } from '../sim/types'

const base = newGame('render')

function variant(edit: (state: SimState) => void): SimState {
  const copy: SimState = structuredClone(base)
  edit(copy)
  return copy
}

describe('the roadway is drawn from the street state', () => {
  it('narrows when a lane is removed', () => {
    const dieted = variant((s) => { s.street.throughLanesPerDirection = 2 })
    expect(layoutFor(dieted.street).roadRows.length)
      .toBeLessThan(layoutFor(base.street).roadRows.length)
  })

  it('quantises lane width to the tile, and says so', () => {
    // The grid is one traffic lane wide, so a lane between ten and twelve feet
    // is drawn a tile wide either way. Narrowing lanes is therefore visible in
    // the markings and in the operating speed, not in the drawn kerb-to-kerb
    // width - and that is a stated limit of the view, not an accident.
    const narrow = variant((s) => { s.street.laneWidthFt = 10 })
    const wide = layoutFor(base.street).roadRows.length
    const narrowRows = layoutFor(narrow.street).roadRows.length
    expect(narrowRows).toBeLessThanOrEqual(wide)

    // Removing a lane outright is a whole tile, and is visible.
    const dieted = variant((s) => { s.street.throughLanesPerDirection = 2 })
    expect(layoutFor(dieted.street).roadRows.length).toBeLessThan(wide)
  })

  it('shows a protected bike lane as its own band, and a painted one differently', () => {
    const protectedLane = variant((s) => { s.street.bikeFacility = 'protected' })
    const painted = variant((s) => { s.street.bikeFacility = 'painted' })
    const roles = (s: SimState): string[] => roadBands(s.street).map((b) => b.role)

    expect(roles(base)).not.toContain('bike_protected')
    expect(roles(protectedLane)).toContain('bike_protected')
    expect(roles(painted)).toContain('bike_painted')
    expect(roles(painted)).not.toContain('bike_protected')
  })

  it('turns the turn lane into a planted median when the player pays for one', () => {
    expect(roadBands(base.street).map((b) => b.role)).toContain('turn_lane')
    const planted = variant((s) => { s.street.median = 'landscaped' })
    expect(roadBands(planted.street).map((b) => b.role)).toContain('median_planted')
  })

  it('adds kerbside parking bays and a bus lane when they exist', () => {
    const parked = variant((s) => { s.street.onStreetParking = 'metered' })
    expect(roadBands(parked.street).map((b) => b.role)).toContain('parking_bay')
    const bus = variant((s) => { s.street.busLane = true })
    expect(roadBands(bus.street).map((b) => b.role)).toContain('bus_lane')
  })

  it('keeps the drawn width in step with the crossing distance the model computes', () => {
    for (const state of [base, variant((s) => { s.street.throughLanesPerDirection = 1 })]) {
      const rows = layoutFor(state.street).roadRows.length
      const bandFeet = roadBands(state.street).reduce((sum, b) => sum + b.feet, 0)
      expect(rows * TILE_FT).toBeGreaterThan(bandFeet * 0.7)
      expect(rows * TILE_FT).toBeLessThan(bandFeet * 1.5)
    }
  })

  it('widens the pavement when the player widens the pavement', () => {
    // A four-foot footway and a twelve-foot one both occupy one tile, so the
    // width is carried as coverage ON the tile rather than as extra tiles.
    const coverageOf = (state: SimState): number => {
      const scene = buildScene(state)
      const walk = scene.tiles.find((t) => t.kind.sort === 'walk' && t.kind.kerb !== null)
      return walk && walk.kind.sort === 'walk' ? walk.kind.coverage : 0
    }
    expect(coverageOf(base)).toBeLessThan(0.5)
    expect(coverageOf(variant((s) => { s.street.sidewalkWidthFt = 12 }))).toBeGreaterThan(0.9)

    // Beyond a tile it does take more tiles.
    const veryWide = layoutFor(variant((s) => { s.street.sidewalkWidthFt = 20 }).street)
    expect(veryWide.northWalk[1] - veryWide.northWalk[0])
      .toBeGreaterThan(layoutFor(base.street).northWalk[1] - layoutFor(base.street).northWalk[0])
  })
})

describe('buildings stand where the land use puts them', () => {
  const scene = buildScene(base)

  it('places one building per built parcel', () => {
    const built = base.parcels.filter((p) => p.floorArea > 400 && profileFor(p.use).stories > 0)
    expect(scene.buildings.length).toBe(built.length)
  })

  it('sets a strip mall back behind its car park and a shopfront at the pavement', () => {
    // The setback comes from the land use profile, which is the same number the
    // travel model uses to decide whether the shop is walkable.
    expect(profileFor('strip_mall').entranceSetbackFt)
      .toBeGreaterThan(profileFor('mainstreet_mixed').entranceSetbackFt * 10)
  })

  it('gives a taller use more floors on screen', () => {
    const byUse = new Map(scene.buildings.map((b) => [b.use, b.floors]))
    for (const [use, floors] of byUse) {
      expect(floors, use).toBe(Math.max(1, Math.round(profileFor(use).stories)))
    }
  })

  it('fits every building inside its own parcel', () => {
    for (const building of scene.buildings) {
      expect(building.footprintW).toBeGreaterThan(0)
      expect(building.footprintD).toBeGreaterThan(0)
      expect(building.gx).toBeGreaterThanOrEqual(0)
      expect(building.gy).toBeGreaterThanOrEqual(0)
      expect(building.gy + building.footprintD).toBeLessThanOrEqual(scene.gridH)
    }
  })
})

describe('the scene carries the model into the picture', () => {
  it('shows more people on the pavement when more people walk', () => {
    const quiet = buildScene(variant((s) => { s.modeShare = { drive: 0.98, walk: 0.01, bike: 0.005, transit: 0.005 } }))
    const busy = buildScene(variant((s) => { s.modeShare = { drive: 0.6, walk: 0.3, bike: 0.05, transit: 0.05 } }))
    const people = (s: ReturnType<typeof buildScene>): number => s.props.filter((p) => p.kind === 'person').length
    expect(people(busy)).toBeGreaterThan(people(quiet))
  })

  it('shows saplings, not shade, for trees planted a few years ago', () => {
    let planted = newGame('trees')
    planted = advanceYear(planted, ['street.plant_trees']).state
    const early = buildScene(planted)
    const streetTrees = early.props.filter((p) => p.kind === 'tree' && (p.maturity ?? 1) < 0.5)
    expect(streetTrees.length).toBeGreaterThan(0)
  })

  it('swaps cobra heads for pedestrian poles, and doubles their number', () => {
    const cobra = buildScene(base)
    const pedestrian = buildScene(variant((s) => { s.street.lighting = 'pedestrian_scale' }))
    const count = (s: ReturnType<typeof buildScene>, kind: string): number =>
      s.props.filter((p) => p.kind === kind).length
    expect(count(cobra, 'cobra')).toBeGreaterThan(0)
    expect(count(pedestrian, 'cobra')).toBe(0)
    expect(count(pedestrian, 'pedlight')).toBeGreaterThan(count(cobra, 'cobra'))
  })

  it('takes the poles away when the wires go underground', () => {
    expect(buildScene(base).props.some((p) => p.kind === 'pole')).toBe(true)
    const buried = buildScene(variant((s) => { s.street.utilitiesUndergrounded = true }))
    expect(buried.props.some((p) => p.kind === 'pole')).toBe(false)
  })

  it('puts shelters out only where a bus runs, and upgrades them when paid for', () => {
    const noBus = buildScene(variant((s) => { s.street.transitBusesPerHour = 0 }))
    expect(noBus.props.some((p) => p.kind === 'shelter' || p.kind === 'shelter_upgraded')).toBe(false)
    const upgraded = buildScene(variant((s) => { s.street.transitStopsUpgraded = true }))
    expect(upgraded.props.some((p) => p.kind === 'shelter_upgraded')).toBe(true)
  })

  it('draws more crossings when the player adds crossings', () => {
    const crossings = (s: ReturnType<typeof buildScene>): number =>
      s.tiles.filter((t) => t.kind.sort === 'road' && t.kind.role === 'crosswalk').length
    const sparse = buildScene(base)
    const dense = buildScene(variant((s) => { s.street.crossingSpacingFt = 300 }))
    expect(crossings(dense)).toBeGreaterThan(crossings(sparse))
  })

  it('gives the roadway one lane row per through lane, both directions', () => {
    const scene = buildScene(base)
    expect(scene.lanes.length).toBe(base.street.throughLanesPerDirection * 2)
    expect(scene.lanes.filter((l) => l.forward).length).toBe(base.street.throughLanesPerDirection)
  })

  it('is deterministic for a given state', () => {
    const a = buildScene(base)
    const b = buildScene(base)
    expect(JSON.stringify(a.tiles)).toBe(JSON.stringify(b.tiles))
    expect(JSON.stringify(a.buildings)).toBe(JSON.stringify(b.buildings))
    expect(JSON.stringify(a.props)).toBe(JSON.stringify(b.props))
  })

  it('covers the whole corridor and nothing beyond it', () => {
    const scene = buildScene(base)
    for (const tile of scene.tiles) {
      expect(tile.gx).toBeGreaterThanOrEqual(0)
      expect(tile.gx).toBeLessThan(scene.gridW)
      expect(tile.gy).toBeGreaterThanOrEqual(0)
      expect(tile.gy).toBeLessThan(scene.gridH)
    }
  })
})

/**
 * Three instruments that worked in the model and moved nothing on screen.
 *
 * That is the exact failure this file exists to catch: a player buys a thing,
 * the numbers shift, and the street looks identical, so the only way to know
 * anything happened is to read a spreadsheet. These hold the three that had
 * slipped through.
 */
describe('what the corridor looks like when the player changes it', () => {
  const tilesAt = (state: SimState, sort: string): number =>
    buildScene(state).tiles.filter((t) => t.kind.sort === sort).length
  /**
   * Cars at the KERB, not cars on a lot. The parcels are full of parked cars
   * whatever the street does, and counting those would hide the answer.
   */
  const parkedAtTheKerb = (state: SimState): number => {
    const bays = new Set(
      layoutFor(state.street).roadRows.filter((r) => r.role === 'parking_bay').map((r) => r.gy))
    return buildScene(state).props
      .filter((p) => p.kind === 'parked_car' && bays.has(p.gy)).length
  }

  it('paves a block that has been closed to through traffic', () => {
    const before = tilesAt(base, 'plaza')
    const closed = variant((s) => { s.street.plazaSegments = [6] })
    expect(tilesAt(closed, 'plaza')).toBeGreaterThan(before)

    // And it is the carriageway that went, not something borrowed from a verge.
    expect(tilesAt(closed, 'road')).toBeLessThan(tilesAt(base, 'road'))
  })

  it('stands the footway in the parking bay where there are kerb extensions', () => {
    const withParking = variant((s) => { s.street.onStreetParking = 'free' })
    const built = variant((s) => {
      s.street.onStreetParking = 'free'
      s.street.bulbOuts = true
    })
    expect(tilesAt(built, 'walk')).toBeGreaterThan(tilesAt(withParking, 'walk'))
    expect(tilesAt(built, 'road')).toBeLessThan(tilesAt(withParking, 'road'))
  })

  it('clears the cars back from every corner when the crossings are daylighted', () => {
    const withParking = variant((s) => { s.street.onStreetParking = 'free' })
    const cleared = variant((s) => {
      s.street.onStreetParking = 'free'
      s.street.daylighting = true
    })
    expect(parkedAtTheKerb(cleared)).toBeLessThan(parkedAtTheKerb(withParking))
    expect(parkedAtTheKerb(cleared)).toBeGreaterThan(0)
  })

  it('empties the kerb when the bays are metered, and clears it when they go', () => {
    const free = variant((s) => { s.street.onStreetParking = 'free' })
    const priced = variant((s) => {
      s.street.onStreetParking = 'metered'
      s.street.meterPricePerHour = 3
    })
    const gone = variant((s) => { s.street.onStreetParking = 'none' })
    expect(parkedAtTheKerb(priced)).toBeLessThan(parkedAtTheKerb(free))
    expect(parkedAtTheKerb(gone)).toBe(0)
  })
})
