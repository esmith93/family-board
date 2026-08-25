/**
 * Crash frequency and crash severity are different questions with different
 * answers. Severity is almost entirely about speed.
 */
import { describe, expect, it } from 'vitest'
import { C } from './constants'
import { newGame, advanceYear } from './step'
import { crashModificationFactor, pedestrianFatalityRisk, severitySplit } from './safety'
import { crossingDistanceFt } from './traffic'

describe('pedestrian fatality risk', () => {
  it('reproduces the published curve', () => {
    // Tefft (2011): 10% at 23 mph, 25% at 32, 50% at 42, 75% at 50, 90% at 58.
    expect(pedestrianFatalityRisk(23)).toBeCloseTo(0.10, 1)
    expect(pedestrianFatalityRisk(32)).toBeCloseTo(0.25, 1)
    expect(pedestrianFatalityRisk(42)).toBeCloseTo(0.50, 1)
    expect(pedestrianFatalityRisk(50)).toBeCloseTo(0.75, 1)
    expect(pedestrianFatalityRisk(58)).toBeCloseTo(0.90, 1)
  })

  it('passes through the published half-risk speed', () => {
    expect(pedestrianFatalityRisk(C.PED_FATALITY_50PCT_SPEED_ANCHOR)).toBeGreaterThan(0.45)
    expect(pedestrianFatalityRisk(C.PED_FATALITY_50PCT_SPEED_ANCHOR)).toBeLessThan(0.58)
  })

  it('is steepest exactly where US arterials are designed', () => {
    const slope30to45 = pedestrianFatalityRisk(45) - pedestrianFatalityRisk(30)
    const slope60to75 = pedestrianFatalityRisk(75) - pedestrianFatalityRisk(60)
    expect(slope30to45).toBeGreaterThan(slope60to75)
  })

  it('is monotonic', () => {
    for (let v = 5; v < 80; v += 5) {
      expect(pedestrianFatalityRisk(v + 5)).toBeGreaterThan(pedestrianFatalityRisk(v))
    }
  })
})

describe('severity scales with speed', () => {
  it('makes a crash at 45 far deadlier than the same crash at 25', () => {
    const slow = severitySplit(25)
    const fast = severitySplit(45)
    expect(fast.fatal / slow.fatal).toBeGreaterThan(4)
    expect(fast.pdo).toBeLessThan(slow.pdo)
  })

  it('always produces a valid distribution', () => {
    for (let v = 10; v <= 60; v += 5) {
      const split = severitySplit(v)
      const total = split.fatal + split.serious + split.minor + split.pdo
      expect(total).toBeCloseTo(1, 6)
      for (const share of Object.values(split)) expect(share).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('crash modification factors', () => {
  const state = newGame('safety')

  it('cuts crashes when a lane is removed', () => {
    const dieted = structuredClone(state)
    dieted.street.throughLanesPerDirection = 2
    const before = crashModificationFactor(state.street, state.parcels, 45, 3)
    const after = crashModificationFactor(dieted.street, dieted.parcels, 45, 3)
    expect(after).toBeLessThan(before)
  })

  it('honours the lane-width finding, including its speed condition', () => {
    const narrow = structuredClone(state)
    narrow.street.laneWidthFt = 10

    // Above the threshold speed, narrowing helps.
    expect(crashModificationFactor(narrow.street, narrow.parcels, 40, 3))
      .toBeLessThan(crashModificationFactor(state.street, state.parcels, 40, 3))

    // At 20-25 mph the same study found no significant difference, and the
    // model does not invent one.
    expect(crashModificationFactor(narrow.street, narrow.parcels, 22, 3))
      .toBeCloseTo(crashModificationFactor(state.street, state.parcels, 22, 3), 6)
  })

  it('rewards removing driveways', () => {
    const fewer = structuredClone(state)
    for (const parcel of fewer.parcels) parcel.curbCuts = 0
    expect(crashModificationFactor(fewer.street, fewer.parcels, 45, 3))
      .toBeLessThan(crashModificationFactor(state.street, state.parcels, 45, 3))
  })

  it('uses published values for the treatments that have them', () => {
    expect(C.CMF_ROAD_DIET).toBeGreaterThan(0.5)
    expect(C.CMF_ROAD_DIET).toBeLessThan(1)
    expect(C.CMF_ROUNDABOUT_INJURY).toBeLessThan(C.CMF_ROUNDABOUT)
  })
})

describe('the corridor at year zero', () => {
  const state = newGame('safety')

  it('produces a crash count in the right order for a busy arterial', () => {
    const perMile = state.safety.crashes / 1.2
    expect(perMile).toBeGreaterThan(30)
    expect(perMile).toBeLessThan(160)
  })

  it('kills roughly one person every year or two', () => {
    expect(state.safety.fatal).toBeGreaterThan(0.1)
    expect(state.safety.fatal).toBeLessThan(1.5)
  })

  it('makes people cross far more road than they should have to', () => {
    expect(crossingDistanceFt(state.street)).toBeGreaterThan(70)
  })

  it('carries a societal cost far larger than the city budget line for it', () => {
    expect(state.safety.societalCost).toBeGreaterThan(state.fiscal.expenses.emergencyResponse * 5)
  })
})

describe('safety improves when the corridor is calmed', () => {
  it('cuts deaths when speed comes down', () => {
    let fast = newGame('calm')
    let slow = newGame('calm')
    for (let i = 0; i < 12 && !slow.ended; i++) {
      const plan = slow.year === 1 ? ['capital.road_diet']
        : slow.year === 4 ? ['street.narrow_lanes']
        : slow.year === 6 ? ['street.lower_target_speed']
        : slow.year === 8 ? ['street.lower_target_speed'] : []
      slow = advanceYear(slow, plan).state
      fast = advanceYear(fast, []).state
    }
    expect(slow.safety.fatal).toBeLessThan(fast.safety.fatal)
    expect(slow.safety.crashes).toBeLessThan(fast.safety.crashes)
  })
})
