/**
 * Money and political capital are both real constraints, and the game is the
 * tension between them: the correct move is usually the politically expensive
 * one, and some years neither currency stretches far enough.
 */
import { describe, expect, it } from 'vitest'
import { C } from './constants'
import { borrowingHeadroom, cityShortfall, committedCapital } from './fiscal'
import { advanceYear, newGame } from './step'
import { instrumentById } from './instruments'
import type { SimState } from './types'

describe('the city shortfall', () => {
  it('opens at the figure in the cold open', () => {
    const state = newGame('money')
    expect(cityShortfall(state)).toBeCloseTo(C.OPENING_DEFICIT, 0)
  })

  it('widens when the corridor takes on an obligation it did not have', () => {
    let widened = newGame('money')
    let left = newGame('money')
    for (let i = 0; i < 8; i++) {
      widened = advanceYear(widened, widened.year === 0 ? ['capital.state_widening'] : []).state
      left = advanceYear(left, []).state
    }
    expect(cityShortfall(widened)).toBeGreaterThan(cityShortfall(left))
  })

  it('narrows dollar for dollar as the corridor ledger improves', () => {
    const state = newGame('money')
    const before = cityShortfall(state)
    const richer: SimState = structuredClone(state)
    richer.fiscal.surplus += 1_000_000
    expect(before - cityShortfall(richer)).toBeCloseTo(1_000_000, 0)
  })
})

describe('money is a real constraint', () => {
  it('gives the city borrowing capacity that shrinks as debt grows', () => {
    const state = newGame('money')
    const indebted: SimState = structuredClone(state)
    indebted.fiscal.debt = state.fiscal.revenue.total * 2
    expect(borrowingHeadroom(indebted)).toBeLessThan(borrowingHeadroom(state))
  })

  it('refuses an instrument the city cannot borrow for', () => {
    const broke: SimState = structuredClone(newGame('money'))
    broke.fiscal.debt = broke.fiscal.revenue.total * 20
    expect(borrowingHeadroom(broke)).toBe(0)

    const result = advanceYear(broke, ['capital.reconstruct'])
    expect(result.rejected.map((r) => r.reason)).toContain('not enough borrowing capacity')
    // And the works never started.
    expect(result.state.activeProjects.some((p) => p.instrumentId === 'capital.reconstruct')).toBe(false)
  })

  it('counts capital already committed against the same capacity', () => {
    let state = newGame('money')
    expect(committedCapital(state)).toBe(0)
    state = advanceYear(state, ['capital.reconstruct']).state
    expect(committedCapital(state)).toBeGreaterThan(0)
  })

  it('does not charge political capital for something it then refuses', () => {
    const broke: SimState = structuredClone(newGame('money'))
    broke.fiscal.debt = broke.fiscal.revenue.total * 20
    const before = broke.politics.capital
    const result = advanceYear(broke, ['capital.road_diet'])
    expect(result.state.politics.capital).toBeGreaterThanOrEqual(before)
  })
})

describe('political capital is a real constraint', () => {
  it('refuses an instrument the director cannot afford politically', () => {
    const state: SimState = structuredClone(newGame('pc'))
    state.politics.capital = 2
    const result = advanceYear(state, ['capital.road_diet'])
    expect(result.rejected.map((r) => r.reason)).toContain('not enough political capital')
  })

  it('charges more for a road diet on a busy corridor than on a quiet one', () => {
    const busy = newGame('pc')
    const quiet: SimState = structuredClone(busy)
    quiet.traffic.volumeCapacityRatio = 0.1
    const instrument = instrumentById('capital.road_diet')!
    expect(instrument.pcCost(busy)).toBeGreaterThan(instrument.pcCost(quiet))
  })

  it('costs nothing politically to accept the state grant', () => {
    const state = newGame('pc')
    expect(instrumentById('capital.state_widening')!.pcCost(state)).toBe(0)
  })

  it('runs out, and that ends the run', () => {
    let state: SimState = structuredClone(newGame('pc'))
    state.politics.approval = 4
    state.politics.capital = 3
    for (let i = 0; i < 6 && !state.ended; i++) state = advanceYear(state, []).state
    expect(state.ended?.reason).toBe('fired')
  })
})

describe('committing to a year', () => {
  it('applies immediate instruments at once and queues the rest', () => {
    const state = newGame('commit')
    const after = advanceYear(state, ['fiscal.impact_fees', 'capital.road_diet']).state
    expect(after.fiscalPolicy.impactFeePerDwelling).toBe(9000)
    expect(after.activeProjects.some((p) => p.instrumentId === 'capital.road_diet')).toBe(true)
    // The lane is still there until the works finish.
    expect(after.street.throughLanesPerDirection).toBe(state.street.throughLanesPerDirection)
  })

  it('reports what it refused, and why, rather than failing silently', () => {
    const state = newGame('commit')
    const result = advanceYear(state, ['no.such.instrument', 'capital.roundabout'])
    expect(result.rejected.map((r) => r.instrumentId)).toContain('no.such.instrument')
    // A roundabout is not unlocked until year 3.
    expect(result.rejected.map((r) => r.reason)).toContain('not unlocked')
  })

  it('turns a permanent annual cost into an obligation the player can see', () => {
    const state = advanceYear(newGame('commit'), ['street.plant_trees']).state
    expect(state.obligations.some((o) => o.label.includes('tree'))).toBe(true)
  })
})
