/**
 * Tests for the view from the pavement.
 *
 * The walk view exists to show the half of the corridor a windscreen cannot:
 * how far it is to somewhere you are allowed to cross, how long you stand
 * there when you get there, and what happens if you decide not to bother. All
 * three are consequences of instruments the player bought, and the tests here
 * are mostly about holding that chain intact.
 *
 * The other thing being defended is restraint. This view is the one that could
 * most easily start arguing, and it must not.
 */

import { describe, expect, it } from 'vitest'

import { advanceYear, newGame, type SimState } from '../sim/index'
import {
  buildWalkWorld, detourFt, gapChancePerSecond, makeWalkFrame, nearestCrossing, newWalk,
  renderWalk, stepWalk, walkIsGreen, type WalkState, type WalkWorld,
} from './walk'
import { PALETTE_INDEX } from './palette'

const W = 320
const H = 180
const CORRIDORS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'win', 'lose', 'order', 'reckon', 'fairview-best']

function play(seed: string, years: number, plan: Record<number, string[]> = {}): SimState {
  let state = newGame(seed)
  for (let i = 0; i < years && !state.ended; i++) state = advanceYear(state, plan[state.year] ?? []).state
  return state
}

/** Walk east for a while and stop. */
function walkFor(world: WalkWorld, seconds: number): WalkState {
  let walk = newWalk(world)
  for (let t = 0; t < seconds; t += 1 / 30) {
    walk = stepWalk(world, walk, { along: 1, cross: false }, 1 / 30)
  }
  return walk
}

/** Stand at a spot and try to get to the other side. Returns seconds waited. */
function tryToCross(world: WalkWorld, stationFt: number, giveUpAfterSec = 400): number {
  let walk: WalkState = { ...newWalk(world), stationFt }
  for (let t = 0; t < giveUpAfterSec; t += 1 / 30) {
    walk = stepWalk(world, walk, { along: 0, cross: true }, 1 / 30)
    if (walk.crossings > 0) return walk.waitedSec
  }
  return Infinity
}

function frameAfter(state: SimState, seconds: number): Uint8Array {
  const world = buildWalkWorld(state)
  const walk = walkFor(world, seconds)
  const frame = makeWalkFrame(W, H)
  renderWalk(world, walk, frame, seconds * 1000)
  return frame.pixels
}

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length

describe('getting to the other side', () => {
  it('is a long way to a crossing on the corridor as it stands', () => {
    const world = buildWalkWorld(newGame('a'))
    const worst = Math.max(...Array.from({ length: 300 }, (_, i) =>
      detourFt(world, (i / 300) * world.model.lengthFt)))
    // A quarter of a mile of walking to go forty feet sideways.
    expect(worst).toBeGreaterThan(400)
  })

  it('is a shorter way once the player has paid for crossings', () => {
    const before = buildWalkWorld(newGame('a'))
    const after = buildWalkWorld(play('a', 4, { 0: ['street.add_crossings'] }))
    const worstOf = (world: WalkWorld): number => Math.max(...Array.from({ length: 300 }, (_, i) =>
      detourFt(world, (i / 300) * world.model.lengthFt)))
    expect(worstOf(after)).toBeLessThan(worstOf(before) * 0.75)
  })

  it('makes you wait at the signal for as long as the cycle says', () => {
    const world = buildWalkWorld(newGame('a'))
    const junction = world.model.junctions[1]!
    const waits = Array.from({ length: 12 }, (_, i) => {
      let walk: WalkState = { ...newWalk(world), stationFt: junction.stationFt, elapsedSec: i * 9.5 }
      for (let t = 0; t < 400; t += 1 / 30) {
        walk = stepWalk(world, walk, { along: 0, cross: true }, 1 / 30)
        if (walk.crossings > 0) return walk.waitedSec
      }
      return 400
    })
    // Never instant, never forever, and on the order of a two-minute cycle.
    expect(Math.min(...waits)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...waits)).toBeLessThan(world.cycleSec + 5)
    expect(mean(waits)).toBeGreaterThan(8)
  })

  it('gives the pedestrian less of the cycle when the boulevard takes more', () => {
    const greenSeconds = (policy: SimState['street']['signalPolicy']): number => {
      const state = newGame('a')
      state.street.signalPolicy = policy
      const world = buildWalkWorld(state)
      let green = 0
      const samples = 4000
      for (let i = 0; i < samples; i++) {
        if (walkIsGreen(world, 0, (i / samples) * world.cycleSec * 20)) green++
      }
      return (green / samples) * world.cycleSec
    }
    // This is the trade, stated in seconds: the same setting that lets a car
    // through five junctions is the one that leaves somebody at the kerb.
    expect(greenSeconds('vehicle_progression')).toBeLessThan(greenSeconds('pedestrian_priority'))
  })
})

describe('crossing where there is no crossing', () => {
  it('is close to impossible on six lanes at the peak', () => {
    // Six lanes of exponential headway is six independent coin flips that all
    // have to come up at once, and they do not.
    expect(gapChancePerSecond(buildWalkWorld(newGame('a')))).toBeLessThan(0.05)
  })

  it('becomes possible once the road is narrower and quieter', () => {
    const wide = buildWalkWorld(newGame('a'))
    const narrow = buildWalkWorld(play('a', 16, {
      7: ['capital.road_diet'], 9: ['street.add_kerb_parking'], 12: ['street.lower_target_speed'],
    }))
    expect(gapChancePerSecond(narrow)).toBeGreaterThan(gapChancePerSecond(wide) * 10)
  })

  it('is helped by somewhere to stand halfway', () => {
    const open = newGame('a')
    open.street.median = 'none'
    const refuge = newGame('a')
    refuge.street.median = 'landscaped'
    const withRefuge = buildWalkWorld(refuge)
    const without = buildWalkWorld(open)
    expect(withRefuge.hasRefuge).toBe(true)
    expect(without.hasRefuge).toBe(false)
    // Two halves of a road, one at a time, against both halves at once.
    expect(gapChancePerSecond(withRefuge)).toBeGreaterThan(gapChancePerSecond(without))
    expect(tryToCross(withRefuge, 900, 600)).toBeLessThanOrEqual(tryToCross(without, 900, 600))
  })

  it('lets you across eventually on a street that has been calmed', () => {
    const world = buildWalkWorld(play('a', 18, {
      7: ['capital.road_diet'], 9: ['street.add_kerb_parking'],
      12: ['street.lower_target_speed'], 14: ['street.narrow_lanes'],
    }))
    expect(tryToCross(world, 900, 600)).toBeLessThan(600)
  })
})

describe('walking', () => {
  it('walks at three miles an hour and this game does not speed that up', () => {
    const world = buildWalkWorld(newGame('a'))
    const walk = walkFor(world, 60)
    const mph = (walk.distanceFt / 5280) / (walk.elapsedSec / 3600)
    expect(mph).toBeGreaterThan(2.6)
    expect(mph).toBeLessThan(3.4)
  })

  it('stays on the corridor', () => {
    const world = buildWalkWorld(newGame('a'))
    let walk = newWalk(world)
    for (let t = 0; t < 3000; t += 1 / 30) {
      walk = stepWalk(world, walk, { along: 1, cross: false }, 1 / 30)
    }
    expect(walk.stationFt).toBeLessThanOrEqual(world.model.lengthFt)
    expect(walk.stationFt).toBeGreaterThanOrEqual(0)
  })

  it('puts you on the other pavement when you get there', () => {
    const world = buildWalkWorld(play('a', 18, {
      7: ['capital.road_diet'], 12: ['street.lower_target_speed'], 14: ['street.narrow_lanes'],
    }))
    const junction = world.model.junctions[2]!
    let walk: WalkState = { ...newWalk(world), stationFt: junction.stationFt }
    const startedOn = walk.side
    for (let t = 0; t < 500 && walk.crossings === 0; t += 1 / 30) {
      walk = stepWalk(world, walk, { along: 0, cross: true }, 1 / 30)
    }
    expect(walk.crossings).toBe(1)
    expect(walk.side).not.toBe(startedOn)
    expect(walk.phase).toBe('walking')
  })

  it('finds the nearest crossing, not just any crossing', () => {
    const world = buildWalkWorld(newGame('a'))
    const at = 2400
    const found = nearestCrossing(world, at)
    for (const crossing of world.model.crossings) {
      expect(Math.abs(crossing.stationFt - at)).toBeGreaterThanOrEqual(found.distFt - 1e-6)
    }
  })
})

describe('the picture', () => {
  it('is never a flat rectangle', () => {
    for (const [name, state] of [
      ['year 0', newGame('a')],
      ['grown in', play('a', 24, {
        3: ['street.plant_trees'], 7: ['capital.road_diet'], 17: ['street.plant_trees'],
      })],
    ] as [string, SimState][]) {
      const pixels = frameAfter(state, 20)
      const counts = new Map<number, number>()
      for (const ink of pixels) counts.set(ink, (counts.get(ink) ?? 0) + 1)
      expect(counts.size, `${name}: only ${counts.size} colours`).toBeGreaterThanOrEqual(8)
      const biggest = Math.max(...counts.values()) / pixels.length
      expect(biggest, `${name}: one colour owns ${(biggest * 100).toFixed(0)}%`).toBeLessThan(0.5)
      expect(counts.get(0) ?? 0, `${name}: holes in the frame`).toBe(0)
    }
  })

  it('shows the trees the player planted, and only when they have grown', () => {
    const leaves = new Set<number>([
      PALETTE_INDEX.leafDark, PALETTE_INDEX.leafMid, PALETTE_INDEX.leafLight, PALETTE_INDEX.leafHigh,
    ])
    const crowns = (state: SimState): number => {
      const world = buildWalkWorld(state)
      const walk = walkFor(world, 20)
      const frame = makeWalkFrame(W, H)
      renderWalk(world, walk, frame, 20000)
      let n = 0
      for (let y = 0; y < frame.horizon; y++) {
        for (let x = 0; x < W; x++) if (leaves.has(frame.pixels[y * W + x]!)) n++
      }
      return n / (frame.horizon * W)
    }
    const bare = crowns(play('a', 24))
    const sticks = crowns(play('a', 24, { 23: ['street.plant_trees'] }))
    const shade = crowns(play('a', 24, { 2: ['street.plant_trees'] }))
    // Planted last year they are sticks; planted twenty-two years ago they are trees.
    expect(shade).toBeGreaterThan(sticks)
    expect(sticks).toBeGreaterThanOrEqual(bare)
  })

  it('is deterministic', () => {
    expect(Array.from(frameAfter(play('same', 8), 14)))
      .toEqual(Array.from(frameAfter(play('same', 8), 14)))
  })

  it('is a different street on a different corridor', () => {
    expect(Array.from(frameAfter(play('one', 8), 14)))
      .not.toEqual(Array.from(frameAfter(play('two', 8), 14)))
  })

  it('draws a frame well inside a sixtieth of a second', () => {
    const world = buildWalkWorld(play('a', 18))
    const walk = walkFor(world, 20)
    const frame = makeWalkFrame(480, 270)
    renderWalk(world, walk, frame, 0)
    const started = performance.now()
    const runs = 30
    for (let i = 0; i < runs; i++) renderWalk(world, walk, frame, i * 33)
    const each = (performance.now() - started) / runs
    expect(each, `${each.toFixed(2)}ms per frame at 480x270`).toBeLessThan(9)
  })
})

describe('what the corridor is like on foot', () => {
  it('gets quieter and slower when the player narrows it', () => {
    const before = buildWalkWorld(newGame('a'))
    const after = buildWalkWorld(play('a', 18, {
      7: ['capital.road_diet'], 9: ['street.add_kerb_parking'],
      12: ['street.lower_target_speed'], 14: ['street.narrow_lanes'], 17: ['street.plant_trees'],
    }))
    expect(after.trafficSpeedMph).toBeLessThan(before.trafficSpeedMph)
    expect(after.noiseDba).toBeLessThan(before.noiseDba)
    expect(after.laneCount).toBeLessThan(before.laneCount)
  })

  it('is measurably worse to cross the more of it there is', () => {
    const easier = CORRIDORS.map((seed) => gapChancePerSecond(buildWalkWorld(play(seed, 16, {
      7: ['capital.road_diet'], 12: ['street.lower_target_speed'],
    }))))
    const harder = CORRIDORS.map((seed) => gapChancePerSecond(buildWalkWorld(play(seed, 16, {
      0: ['capital.state_widening'],
    }))))
    expect(mean(easier)).toBeGreaterThan(mean(harder))
  })
})
