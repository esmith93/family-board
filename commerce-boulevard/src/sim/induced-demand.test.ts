/**
 * The engine of the whole game: added capacity works, and then it stops
 * working, and the city keeps the bill.
 */
import { describe, expect, it } from 'vitest'
import { C } from './constants'
import { newGame, advanceYear } from './step'
import { corridorCapacity, effectiveGreenRatio, laneMiles } from './traffic'
import type { SimState } from './types'

function run(seed: string, plan: (year: number) => string[], years: number): SimState[] {
  let state = newGame(seed)
  const states = [state]
  for (let i = 0; i < years && !state.ended; i++) {
    state = advanceYear(state, plan(state.year)).state
    states.push(state)
  }
  return states
}

const doNothing = (): string[] => []
const widenAtYearZero = (year: number): string[] => (year === 0 ? ['capital.state_widening'] : [])

describe('induced demand', () => {
  const baseline = run('induced', doNothing, 25)
  const widened = run('induced', widenAtYearZero, 25)

  const speedAt = (states: SimState[], year: number): number => states[year]!.traffic.peakSpeedMph
  const aadtAt = (states: SimState[], year: number): number => states[year]!.traffic.aadt

  it('the widening genuinely works once it opens', () => {
    // Construction runs years 1-3; the lane opens for year 4.
    expect(speedAt(widened, 4)).toBeGreaterThan(speedAt(baseline, 4))
    const gain = speedAt(widened, 4) / speedAt(baseline, 4) - 1
    expect(gain).toBeGreaterThan(0.04)
  })

  it('congestion comes back to where it started, on more lanes', () => {
    // The honest formulation of the fundamental law: the corridor returns to
    // its OWN pre-widening level of service, not to a counterfactual. Judging
    // it against a do-nothing baseline flatters the widening, because the
    // baseline degrades from regional growth too.
    const before = widened[0]!.traffic.volumeCapacityRatio
    const justOpened = widened[4]!.traffic.volumeCapacityRatio
    const settled = widened[18]!.traffic.volumeCapacityRatio

    // It genuinely works at first.
    expect(justOpened).toBeLessThan(before * 0.9)
    // And then it does not.
    expect(settled).toBeGreaterThan(before * 0.92)

    // Speed tells the same story: a real gain that fades to nothing.
    expect(speedAt(widened, 4) / speedAt(widened, 0) - 1).toBeGreaterThan(0.04)
    expect(speedAt(widened, 18) / speedAt(widened, 0) - 1).toBeLessThan(0.025)
  })

  it('carries far more traffic at the same level of service', () => {
    const trafficGrowth = aadtAt(widened, 18) / aadtAt(widened, 0) - 1
    expect(trafficGrowth).toBeGreaterThan(0.25)
  })

  it('refills gradually, not immediately', () => {
    // Year 4 is the opening. Traffic must still be climbing years later.
    expect(aadtAt(widened, 8)).toBeGreaterThan(aadtAt(widened, 4))
    expect(aadtAt(widened, 14)).toBeGreaterThan(aadtAt(widened, 8))
  })

  it('leaves permanently more traffic than the corridor started with', () => {
    const extra = aadtAt(widened, 20) / aadtAt(baseline, 20) - 1
    expect(extra).toBeGreaterThan(0.08)
  })

  it('adds lane-miles the city maintains for ever', () => {
    const before = laneMiles(baseline[20]!.street)
    const after = laneMiles(widened[20]!.street)
    expect(after).toBeGreaterThan(before)
    // And the obligation is permanent: no expiry.
    const obligation = widened[20]!.obligations.find((o) => o.origin === 'state_grant')
    expect(obligation).toBeDefined()
    expect(obligation!.yearsRemaining).toBeNull()
  })

  it('costs the city its solvency sooner than doing nothing', () => {
    expect(widened[20]!.fiscal.debt).toBeGreaterThan(baseline[20]!.fiscal.debt)
  })

  it('unlocks the vocabulary only after the player has caused it', () => {
    expect(baseline.at(-1)!.glossary.unlocked).not.toContain('induced_demand')
    expect(widened.at(-1)!.glossary.unlocked).toContain('induced_demand')
  })

  it('runs in reverse: traffic evaporates when capacity is removed', () => {
    const dieted = run('induced', (year) => (year === 1 ? ['capital.road_diet'] : []), 20)

    // The year the lane closes the corridor is genuinely jammed.
    expect(dieted[3]!.traffic.volumeCapacityRatio).toBeGreaterThan(1)

    // Then traffic leaves for other routes, and does not all come back.
    expect(dieted[6]!.traffic.aadt).toBeLessThan(dieted[2]!.traffic.aadt * 0.95)
    expect(dieted[18]!.traffic.aadt).toBeLessThan(baseline[18]!.traffic.aadt * 0.9)

    // Which is why the corridor settles at a workable speed rather than
    // staying in permanent gridlock.
    expect(dieted[18]!.traffic.peakSpeedMph).toBeGreaterThan(14)
  })

  it('uses an elasticity inside the published range', () => {
    expect(C.VMT_LANE_MILE_ELASTICITY).toBeGreaterThanOrEqual(0.5)
    expect(C.VMT_LANE_MILE_ELASTICITY).toBeLessThanOrEqual(1.0)
  })

  it('refills on the published time course', () => {
    // The adjustment rate should close ~80% of the gap in five years and
    // ~95% in ten, matching the three-to-ten-year literature.
    const rate = C.INDUCED_DEMAND_ADJUSTMENT_RATE
    const closedAt5 = 1 - (1 - rate) ** 5
    const closedAt10 = 1 - (1 - rate) ** 10
    expect(closedAt5).toBeGreaterThan(0.6)
    expect(closedAt5).toBeLessThan(0.92)
    expect(closedAt10).toBeGreaterThan(0.9)
  })
})

describe('capacity model validation', () => {
  it('reproduces the published arterial lane capacity from first principles', () => {
    const state = newGame('capacity')
    const perLane = corridorCapacity(state.street) / state.street.throughLanesPerDirection
    expect(perLane).toBeGreaterThan(C.LANE_CAPACITY_VPHPL_ANCHOR * 0.8)
    expect(perLane).toBeLessThan(C.LANE_CAPACITY_VPHPL_ANCHOR * 1.2)

    const green = effectiveGreenRatio(state.street)
    expect(green).toBeGreaterThan(C.ARTERIAL_GREEN_RATIO_ANCHOR - 0.08)
    expect(green).toBeLessThan(C.ARTERIAL_GREEN_RATIO_ANCHOR + 0.08)
  })
})
