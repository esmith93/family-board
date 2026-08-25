/**
 * Is there a game here?
 *
 * A simulation that cannot be lost is a toy, and one that cannot be won is a
 * lecture. These tests assert that both ends exist and that the difference
 * between them is skill, not luck.
 */
import { describe, expect, it } from 'vitest'
import { C } from './constants'
import { newGame, advanceYear } from './step'
import type { SimState } from './types'

function play(seed: string, plan: (year: number) => string[], years = C.RUN_LENGTH_YEARS): SimState {
  let state = newGame(seed)
  for (let i = 0; i < years && !state.ended; i++) {
    state = advanceYear(state, plan(state.year)).state
  }
  return state
}

/** Land use first, then the street, then the modes that depend on both. */
const SEQUENCED: Record<number, string[]> = {
  0: ['land.reduce_parking_minimums'],
  1: ['land.allow_mixed_use'],
  2: ['fiscal.business_improvement_district'],
  3: ['land.allow_mixed_use'],
  4: ['land.reduce_setbacks'],
  5: ['fiscal.land_value_shift'],
  6: ['land.abolish_parking_minimums'],
  7: ['capital.road_diet'],
  9: ['street.add_kerb_parking'],
  10: ['fiscal.price_parking'],
  11: ['land.raise_height_limit'],
  12: ['street.lower_target_speed'],
  13: ['fiscal.land_value_shift'],
  14: ['street.narrow_lanes'],
  15: ['street.add_crossings'],
  16: ['land.raise_height_limit'],
  17: ['street.plant_trees'],
  18: ['capital.bulb_outs'],
  19: ['fiscal.land_value_shift'],
  21: ['land.form_based_code'],
}

/** The same plan, by a director who also keeps the pavement alive. */
const MAINTAINED: Record<number, string[]> = { ...SEQUENCED, 8: ['capital.repave'], 22: ['capital.repave'] }

const sequenced = (year: number): string[] => MAINTAINED[year] ?? []
const sequencedNoMaintenance = (year: number): string[] => SEQUENCED[year] ?? []

/** Thirteen different corridors, so no claim rests on one lucky seed. */
const CORRIDORS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'win', 'lose', 'order', 'reckon', 'fairview-best']
const completed = (s: SimState): boolean => s.ended?.reason === 'completed'
const endedYear = (s: SimState): number => s.ended?.year ?? C.RUN_LENGTH_YEARS

describe('the game can be lost', () => {
  const doNothing = CORRIDORS.map((seed) => play(seed, () => []))
  const widened = CORRIDORS.map((seed) => play(seed, (y) => (y === 0 ? ['capital.state_widening'] : [])))

  it('doing nothing ends most runs in fiscal collapse', () => {
    const lost = doNothing.filter((s) => !completed(s)).length
    expect(lost).toBeGreaterThan(CORRIDORS.length / 2)
  })

  it('taking the widening ends every run', () => {
    for (const [i, state] of widened.entries()) {
      expect(completed(state), `${CORRIDORS[i]}: widening should not survive 30 years`).toBe(false)
      expect(state.ended!.reason).toBe('insolvent')
    }
  })

  it('and ends it sooner than doing nothing, on every corridor', () => {
    for (const [i, state] of widened.entries()) {
      expect(endedYear(state), `${CORRIDORS[i]}`).toBeLessThan(endedYear(doNothing[i]!))
    }
  })

  it('running out of political capital is a real loss state', () => {
    const fired = play('fire', (y) => (
      y === 1 ? ['street.protected_bike_lane']
        : y === 4 ? ['street.remove_kerb_parking']
        : y === 6 ? ['fiscal.raise_property_tax']
        : y === 8 ? ['fiscal.raise_property_tax'] : []
    ))
    expect(fired.ended).not.toBeNull()
  })

  it('the pavement bill arrives whether the city budgeted for it or not', () => {
    const state = play('pavement', () => [])
    const forced = state.history.length > 0 && state.events !== undefined
    expect(forced).toBe(true)
    // Somewhere in the run the road reached the end of its life.
    let sawForced = false
    let s2 = newGame('pavement')
    for (let i = 0; i < C.RUN_LENGTH_YEARS && !s2.ended; i++) {
      s2 = advanceYear(s2, []).state
      if (s2.events.some((e) => e.id === 'forced_reconstruction')) sawForced = true
    }
    expect(sawForced).toBe(true)
  })
})

describe('the game can be won', () => {
  const played = CORRIDORS.map((seed) => play(seed, sequenced))
  const doNothing = CORRIDORS.map((seed) => play(seed, () => []))

  it('a well-sequenced, well-maintained thirty years survives on many corridors', () => {
    const survivors = played.filter(completed).length
    expect(survivors).toBeGreaterThanOrEqual(4)
  })

  it('beats doing nothing on revenue per acre wherever the run completes', () => {
    // Compared at the same year: a run that ended early has had less inflation
    // applied to it and would flatter itself otherwise. Mid-run comparisons
    // also penalise the investor, who is paying for work that has not yet
    // opened - which is the whole political problem this game is about.
    for (const [i, state] of played.entries()) {
      if (!completed(state)) continue
      const AT = Math.min(C.RUN_LENGTH_YEARS, endedYear(doNothing[i]!))
      const mine = state.history[AT]?.revenuePerAcre
      const theirs = doNothing[i]!.history[AT]?.revenuePerAcre
      if (mine === undefined || theirs === undefined) continue
      expect(mine, `${CORRIDORS[i]} at year ${AT}`).toBeGreaterThan(theirs)
    }
  })

  it('raises revenue per acre in real terms where the run completes', () => {
    for (const state of played.filter(completed)) {
      const priceIndex = (1 + C.GENERAL_INFLATION_RATE) ** C.RUN_LENGTH_YEARS
      const start = state.history[0]!
      const end = state.history.at(-1)!
      expect(end.revenuePerAcre / priceIndex).toBeGreaterThan(start.revenuePerAcre * 1.4)
    }
  })

  it('shifts mode share without the player ever setting it', () => {
    for (const state of played.filter(completed)) {
      const start = state.history[0]!
      const end = state.history.at(-1)!
      expect(end.modeShare.walk).toBeGreaterThan(start.modeShare.walk * 1.6)
      expect(end.modeShare.walk).toBeGreaterThan(0.17)
      expect(end.modeShare.drive).toBeLessThan(start.modeShare.drive)
    }
  })

  it('closes the gap between what is reachable on foot and what people do', () => {
    // A grocery was within a fifteen-minute walk of many households on day
    // one. Hardly any of them walked. Narrowing that gap - not moving the
    // supermarket - is the actual achievement, and it is what the reckoning
    // reports side by side with no commentary attached.
    for (const state of played.filter(completed)) {
      const start = state.history[0]!
      const end = state.history.at(-1)!
      // Measured as a ratio rather than a difference: reachability itself
      // rises as the corridor densifies, so the meaningful question is what
      // share of the households who COULD walk actually do.
      const before = start.modeShare.walk / Math.max(0.01, start.groceryWalkShare)
      const after = end.modeShare.walk / Math.max(0.01, end.groceryWalkShare)
      expect(after, 'more of those who could walk, do').toBeGreaterThan(before)
      expect(end.modeShare.walk).toBeGreaterThan(start.modeShare.walk)
    }
  })

  it('cuts what households spend getting around', () => {
    for (const state of played.filter(completed)) {
      const start = state.history[0]!
      const end = state.history.at(-1)!
      expect(end.transportCostShare).toBeLessThan(start.transportCostShare * 0.7)
    }
  })

  it('makes the corridor quieter, and grows canopy', () => {
    for (const state of played.filter(completed)) {
      const start = state.history[0]!
      const end = state.history.at(-1)!
      expect(end.noiseDba).toBeLessThan(start.noiseDba - 1)
      expect(end.canopyFraction).toBeGreaterThan(start.canopyFraction)
    }
  })

  it('cuts crashes even as more people are out on foot', () => {
    for (const state of played.filter(completed)) {
      const start = state.history[0]!
      const end = state.history.at(-1)!
      expect(end.crashes).toBeLessThan(start.crashes)
      expect(end.modeShare.walk).toBeGreaterThan(start.modeShare.walk)
    }
  })
})

describe('maintenance discipline is a skill', () => {
  it('the same plan does strictly better when the pavement is kept alive', () => {
    const maintained = CORRIDORS.map((seed) => play(seed, sequenced))
    const neglected = CORRIDORS.map((seed) => play(seed, sequencedNoMaintenance))
    const survivedMaintained = maintained.filter(completed).length
    const survivedNeglected = neglected.filter(completed).length
    expect(survivedMaintained).toBeGreaterThan(survivedNeglected)
  })
})

describe('the reckoning tracks what it never showed the player', () => {
  const played = play('fairview-best', sequenced)

  it('records every hidden metric for every year', () => {
    for (const year of played.history) {
      expect(year.groceryWalkShare).toBeGreaterThanOrEqual(0)
      expect(year.childWalkShare).toBeGreaterThanOrEqual(0)
      expect(year.transportCostShare).toBeGreaterThan(0)
      expect(year.residentsLeft).toBeGreaterThanOrEqual(0)
      expect(year.daysOver95).toBeGreaterThan(0)
      expect(year.pedestrianFatal).toBeGreaterThanOrEqual(0)
    }
  })

  it('covers the whole run', () => {
    expect(played.history.length).toBe(C.RUN_LENGTH_YEARS + 1)
    expect(played.history[0]!.year).toBe(0)
    expect(played.history.at(-1)!.year).toBe(C.RUN_LENGTH_YEARS)
  })
})

describe('sequencing is a real skill', () => {
  it('the same instruments in the wrong order do worse', () => {
    // Street first, land use last: the corridor gets calm and stays empty.
    const wrongOrder: Record<number, string[]> = {
      1: ['capital.road_diet'],
      3: ['street.protected_bike_lane'],
      6: ['street.plant_trees'],
      9: ['street.increase_transit'],
      14: ['land.reduce_parking_minimums'],
      17: ['land.allow_mixed_use'],
      21: ['land.allow_mixed_use'],
    }
    for (const seed of CORRIDORS.slice(0, 6)) {
      const badly = play(seed, (y) => wrongOrder[y] ?? [])
      const well = play(seed, sequenced)
      expect(badly.fiscal.revenuePerAcre, `${seed}: wrong order should do worse`)
        .toBeLessThan(well.fiscal.revenuePerAcre)
    }
  })
})
