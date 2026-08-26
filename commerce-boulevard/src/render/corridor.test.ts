/**
 * Tests for the corridor as a line.
 *
 * The point of this module is that three views agree about where things are.
 * If the signal is at 3,168 feet, it is at 3,168 feet from above, from the
 * driver's seat and from the pavement, and the tests that matter here are the
 * ones that hold that line.
 */

import { describe, expect, it } from 'vitest'

import { advanceYear, applyUse, C, newGame, type SimState } from '../sim/index'
import {
  bandsOf, corridorModel, crossingsOf, curbCutsOf, frontageAt, frontagesOf, inPlaza,
  junctionsOf, roadBands, roadWidthFt, treesOf, walkToCrossing,
} from './corridor'
import { buildScene } from './scene'
import { TILE_FT } from './iso'

const play = (years: number, ids: (year: number) => string[] = () => []): SimState => {
  let state = newGame('corridor-test')
  for (let i = 0; i < years && !state.ended; i++) state = advanceYear(state, ids(state.year)).state
  return state
}

describe('junctions', () => {
  it('puts five of them evenly along the corridor, inside both ends', () => {
    const junctions = junctionsOf(newGame('a').street)
    expect(junctions).toHaveLength(5)
    const stations = junctions.map((j) => j.stationFt)
    expect(Math.min(...stations)).toBeGreaterThan(0)
    expect(Math.max(...stations)).toBeLessThan(C.CORRIDOR_LENGTH_FT)
    // Evenly spaced, which a driver notices and a spreadsheet can check.
    const gaps = stations.slice(1).map((s, i) => s - stations[i]!)
    for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0]!, 6)
  })

  it('turns a junction into a roundabout when the player builds one', () => {
    const street = newGame('a').street
    street.roundabouts = [2]
    const junctions = junctionsOf(street)
    expect(junctions[2]!.kind).toBe('roundabout')
    expect(junctions.filter((j) => j.kind === 'signal')).toHaveLength(4)
    // And it is still in the same place. A roundabout is not a teleport.
    expect(junctions[2]!.stationFt).toBe(junctionsOf(newGame('a').street)[2]!.stationFt)
  })
})

describe('crossings', () => {
  it('always lets you cross at a junction', () => {
    const crossings = crossingsOf(newGame('a').street)
    for (const junction of junctionsOf(newGame('a').street)) {
      expect(crossings.some((c) => c.stationFt === junction.stationFt && c.signalised)).toBe(true)
    }
  })

  it('adds unsignalised crossings as the player closes the spacing', () => {
    const street = newGame('a').street
    const sparse = crossingsOf({ ...street, crossingSpacingFt: 1300 }).length
    const dense = crossingsOf({ ...street, crossingSpacingFt: 300 }).length
    expect(dense).toBeGreaterThan(sparse * 2)
  })

  it('means a long walk to cross at year zero', () => {
    const model = corridorModel(newGame('a'))
    // Standing halfway between two crossings on the starting corridor.
    const worst = Math.max(...Array.from({ length: 200 }, (_, i) =>
      walkToCrossing(model, (i * C.CORRIDOR_LENGTH_FT) / 200)))
    expect(worst).toBeGreaterThan(300)
  })

  it('shortens that walk when the player adds crossings', () => {
    const before = corridorModel(newGame('a'))
    const after = corridorModel(newGame('a'))
    after.crossings = crossingsOf({ ...after, ...newGame('a').street, crossingSpacingFt: 300 })
    const worstOf = (m: typeof before): number => Math.max(...Array.from({ length: 200 }, (_, i) =>
      walkToCrossing(m, (i * C.CORRIDOR_LENGTH_FT) / 200)))
    expect(worstOf(after)).toBeLessThan(worstOf(before))
  })
})

describe('the cross-section', () => {
  it('is as wide as the model says it is', () => {
    const street = newGame('a').street
    const bands = bandsOf(street)
    const total = bands.reduce((sum, b) => sum + b.widthFt, 0)
    expect(total).toBeCloseTo(roadWidthFt(street), 6)
    // Bands butt up against each other with no gaps and no overlaps.
    for (let i = 1; i < bands.length; i++) {
      expect(bands[i]!.fromFt).toBeCloseTo(bands[i - 1]!.fromFt + bands[i - 1]!.widthFt, 6)
    }
  })

  it('runs traffic both ways, half each', () => {
    const bands = bandsOf(newGame('a').street)
    const west = bands.filter((b) => b.direction === -1)
    const east = bands.filter((b) => b.direction === 1)
    expect(west.length).toBe(east.length)
    expect(west.length).toBeGreaterThan(0)
    // Westbound on the north half, eastbound on the south. Drive on the right.
    const centre = roadWidthFt(newGame('a').street) / 2
    for (const b of west) expect(b.fromFt + b.widthFt / 2).toBeLessThan(centre)
    for (const b of east) expect(b.fromFt + b.widthFt / 2).toBeGreaterThan(centre)
  })

  it('loses a lane in each direction when the player takes one out', () => {
    const street = newGame('a').street
    const before = bandsOf(street).filter((b) => b.direction !== 0).length
    const after = bandsOf({ ...street, throughLanesPerDirection: street.throughLanesPerDirection - 1 })
      .filter((b) => b.direction !== 0).length
    expect(before - after).toBe(2)
  })

  it('narrows when the lanes narrow, even though the tile grid cannot show it', () => {
    // The isometric view quantises to twelve-foot tiles, so narrowing a lane
    // from twelve feet to ten may not move the drawn kerb at all. From the
    // driver's seat and from the pavement it is two feet, and it is felt.
    const street = newGame('a').street
    const wide = roadWidthFt({ ...street, laneWidthFt: 12 })
    const narrow = roadWidthFt({ ...street, laneWidthFt: 10 })
    const laneBands = roadBands(street).filter((b) => b.feet === street.laneWidthFt).length
    expect(laneBands).toBeGreaterThanOrEqual(2 * street.throughLanesPerDirection)
    expect(wide - narrow).toBeCloseTo(2 * laneBands, 6)
  })
})

describe('frontages', () => {
  it('covers the corridor on both sides without overlapping', () => {
    const state = newGame('a')
    for (const side of ['north', 'south'] as const) {
      const frontages = frontagesOf(state.parcels, side)
      expect(frontages.length).toBeGreaterThan(6)
      for (let i = 1; i < frontages.length; i++) {
        expect(frontages[i]!.fromFt).toBeGreaterThanOrEqual(frontages[i - 1]!.fromFt)
      }
    }
  })

  it('finds what is standing at a given point on the street', () => {
    const state = newGame('a')
    const frontages = frontagesOf(state.parcels, 'north')
    const middle = frontages[3]!
    const found = frontageAt(frontages, (middle.fromFt + middle.toFt) / 2)
    expect(found?.parcelId).toBe(middle.parcelId)
  })

  it('starts mostly set back behind parking, which is what the corridor is', () => {
    const frontages = frontagesOf(newGame('a').parcels, 'north')
    const setBack = frontages.filter((f) => f.setbackFt > 40).length
    expect(setBack / frontages.length).toBeGreaterThan(0.4)
  })

  it('holds a building where the rule put it when it was built', () => {
    // Fairview's code has required forty feet since it was written, so even
    // the shopfronts stand back from the pavement in year zero.
    const frontages = frontagesOf(newGame('a').parcels, 'north')
    for (const f of frontages) expect(f.setbackFt).toBeGreaterThanOrEqual(40)
  })

  it('brings a building forward only when the rule reaches it', () => {
    // The mechanism, stated directly rather than through a thirty-year run:
    // the code's minimum is a floor, and the use's own preference is what it
    // does with the room. Relaxing the minimum lets a shopfront onto the
    // pavement. It does not move a big box, which wants its car park in front
    // and will keep it whatever the code permits.
    const parcel = { ...newGame('a').parcels[0]!, depth: 0, acres: 1 }
    const under = (use: Parameters<typeof applyUse>[1], rule: number): number => {
      const copy = { ...parcel }
      applyUse(copy, use, 12, rule)
      return copy.frontSetbackFt
    }
    expect(under('mainstreet_mixed', 40)).toBe(40)
    expect(under('mainstreet_mixed', 5)).toBe(5)
    expect(under('big_box', 40)).toBe(280)
    expect(under('big_box', 5)).toBe(280)
  })

  it('leaves the buildings that were already there where they are', () => {
    // A rule change in year two does nothing to a strip mall built in 1974.
    // That is the point, and it is why the corridor takes a decade to turn.
    const before = frontagesOf(newGame('slow').parcels, 'north')
    let state = newGame('slow')
    state = advanceYear(state, ['land.reduce_setbacks']).state
    const after = frontagesOf(state.parcels, 'north')
    const standing = after.filter((f) => before.some((b) => b.parcelId === f.parcelId && b.use === f.use))
    expect(standing.length).toBeGreaterThan(15)
    for (const f of standing) {
      expect(f.setbackFt).toBe(before.find((b) => b.parcelId === f.parcelId)!.setbackFt)
    }
  })
})

describe('curb cuts', () => {
  it('puts a driveway inside the parcel it belongs to, never on the boundary', () => {
    const state = newGame('a')
    const cuts = curbCutsOf(state.parcels)
    expect(cuts.length).toBeGreaterThan(10)
    for (const side of ['north', 'south'] as const) {
      const frontages = frontagesOf(state.parcels, side)
      for (const cut of cuts.filter((c) => c.side === side)) {
        expect(frontageAt(frontages, cut.stationFt)).not.toBeNull()
      }
    }
  })

  it('thins out as the corridor stops being a strip', () => {
    const before = curbCutsOf(newGame('a').parcels).length
    const state = play(26, (year) => (
      { 0: ['land.reduce_parking_minimums'], 1: ['land.allow_mixed_use'],
        4: ['land.reduce_setbacks'], 6: ['land.abolish_parking_minimums'],
        11: ['land.raise_height_limit'], 21: ['land.form_based_code'] } as Record<number, string[]>
    )[year] ?? [])
    expect(curbCutsOf(state.parcels).length).toBeLessThan(before)
  })
})

describe('street trees', () => {
  it('are not there before anybody plants them', () => {
    expect(treesOf({ ...newGame('a').street, treesPerMilePerSide: 0 }, 10)).toEqual([])
  })

  it('are saplings the year after they go in and shade twenty years later', () => {
    const street = { ...newGame('a').street, treesPerMilePerSide: 60 }
    const young = treesOf(street, 2)
    const old = treesOf(street, 26)
    expect(young.length).toBe(old.length)
    const mean = (ts: typeof young): number => ts.reduce((s, t) => s + t.maturity, 0) / ts.length
    expect(mean(young)).toBeLessThan(0.2)
    expect(mean(old)).toBeGreaterThan(0.8)
  })

  it('are not all the same height, which would read as wallpaper', () => {
    const trees = treesOf({ ...newGame('a').street, treesPerMilePerSide: 60 }, 14)
    expect(new Set(trees.map((t) => t.maturity.toFixed(3))).size).toBeGreaterThan(6)
  })
})

describe('the corridor model as a whole', () => {
  it('is deterministic', () => {
    const a = JSON.stringify(corridorModel(newGame('same')))
    const b = JSON.stringify(corridorModel(newGame('same')))
    expect(a).toBe(b)
  })

  it('agrees with the isometric scene about where the junctions are', () => {
    // This is the whole reason the module exists.
    const state = newGame('agree')
    const scene = buildScene(state)
    const drawn = scene.props.filter((p) => p.kind === 'signal').map((p) => p.gx).sort((a, b) => a - b)
    const modelled = junctionsOf(state.street)
      .filter((j) => j.kind === 'signal')
      .map((j) => Math.round(j.stationFt / TILE_FT))
      .sort((a, b) => a - b)
    expect(drawn).toEqual(modelled)
  })

  it('agrees with the isometric scene about where you may cross', () => {
    const state = newGame('agree')
    const scene = buildScene(state)
    const striped = new Set(
      scene.tiles.filter((t) => t.kind.sort === 'road' && t.kind.role === 'crosswalk').map((t) => t.gx))
    for (const crossing of crossingsOf(state.street)) {
      const gx = Math.round(crossing.stationFt / TILE_FT)
      if (gx >= scene.gridW) continue
      expect(striped.has(gx), `no stripes drawn at ${crossing.stationFt} ft`).toBe(true)
    }
  })

  it('knows which blocks the player has closed to traffic', () => {
    const state = newGame('a')
    state.street.plazaSegments = [5]
    const model = corridorModel(state)
    expect(inPlaza(model, 5.5 * (C.CORRIDOR_LENGTH_FT / C.CORRIDOR_SEGMENTS))).toBe(true)
    expect(inPlaza(model, 0.5 * (C.CORRIDOR_LENGTH_FT / C.CORRIDOR_SEGMENTS))).toBe(false)
  })
})
