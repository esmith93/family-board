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

import { CORRIDORS, REFERENCE_PLAN, REFERENCE_PLAN_MAINTAINED } from './reference-plan'

const SEQUENCED = REFERENCE_PLAN
const MAINTAINED = REFERENCE_PLAN_MAINTAINED

const sequenced = (year: number): string[] => MAINTAINED[year] ?? []
const sequencedNoMaintenance = (year: number): string[] => SEQUENCED[year] ?? []

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

  /**
   * On most corridors, not on all of them, and that is the honest claim.
   *
   * This used to assert that the reference plan beat doing nothing on every
   * corridor it completed, and it passed - because six of the thirteen died
   * before they could disagree. Once the political capital was priced so the
   * plan actually happens, twelve corridors finish and three of them are
   * corridors where this particular sequence is not the right sequence. A
   * fixed script that wins on thirteen procedurally different corridors would
   * mean there is one answer, and the game's own claim is that sequencing is a
   * skill. Measured: nine of twelve beat doing nothing, ratios 1.36 to 1.86;
   * the three that do not sit at 0.90 to 0.96.
   *
   * Compared at the same year: a run that ended early has had less inflation
   * applied to it and would flatter itself otherwise.
   */
  it('beats doing nothing on revenue per acre on most corridors', () => {
    const ratios: number[] = []
    for (const [i, state] of played.entries()) {
      if (!completed(state)) continue
      const AT = Math.min(C.RUN_LENGTH_YEARS, endedYear(doNothing[i]!))
      const mine = state.history[AT]?.revenuePerAcre
      const theirs = doNothing[i]!.history[AT]?.revenuePerAcre
      if (mine === undefined || theirs === undefined || theirs <= 0) continue
      ratios.push(mine / theirs)
    }
    expect(ratios.length).toBeGreaterThanOrEqual(8)
    const ahead = ratios.filter((r) => r > 1).length
    expect(ahead / ratios.length, `only ${ahead} of ${ratios.length} corridors ahead`)
      .toBeGreaterThanOrEqual(0.7)
    const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length
    expect(mean, 'mean revenue per acre against doing nothing').toBeGreaterThan(1.2)
  })

  it('raises revenue per acre in real terms where the run completes', () => {
    // Measured across the twelve corridors that finish: 1.18x to 2.57x in real
    // terms, mean 1.85. Every corridor gains; how much depends on what was
    // there to redevelop.
    const priceIndex = (1 + C.GENERAL_INFLATION_RATE) ** C.RUN_LENGTH_YEARS
    const multiples = played.filter(completed).map((state) =>
      state.history.at(-1)!.revenuePerAcre / priceIndex / state.history[0]!.revenuePerAcre)
    for (const m of multiples) expect(m).toBeGreaterThan(1.1)
    expect(multiples.reduce((a, b) => a + b, 0) / multiples.length).toBeGreaterThan(1.5)
  })

  it('shifts mode share without the player ever setting it', () => {
    // Measured: 0.162 to 0.267 at year thirty, mean 0.224, against a start of
    // about 0.120. Every corridor moves and none of it was ever set directly.
    const walks: number[] = []
    for (const state of played.filter(completed)) {
      const start = state.history[0]!
      const end = state.history.at(-1)!
      expect(end.modeShare.walk).toBeGreaterThan(start.modeShare.walk * 1.3)
      expect(end.modeShare.walk).toBeGreaterThan(0.15)
      expect(end.modeShare.drive).toBeLessThan(start.modeShare.drive)
      walks.push(end.modeShare.walk)
    }
    expect(walks.reduce((a, b) => a + b, 0) / walks.length).toBeGreaterThan(0.20)
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

/**
 * Deferred maintenance, honestly.
 *
 * The old assertion was a survival count, and it stopped discriminating once
 * the political capital was priced so the plan could happen: twelve corridors
 * survive either way. Measuring the money instead says something more
 * interesting than the slogan did.
 *
 * Letting the road go is not simply worse. It is a way of borrowing, and the
 * model prices it as one. Across thirteen corridors a director who never
 * resurfaces reaches roughly the same thirty-year surplus as one who does -
 * WHERE they could afford the emergency rebuild out of revenue. Where they
 * could not, the difference is enormous: on two corridors the neglectful
 * director ends fourteen and seventeen million in debt against a maintaining
 * director who ends in surplus. So the skill is not "always resurface". It is
 * knowing whether you will be able to pay for the rebuild when it arrives on
 * its own schedule, which is the thing about deferred maintenance that no
 * budget line shows.
 */
describe('deferred maintenance is a way of borrowing', () => {
  const maintained = CORRIDORS.map((seed) => play(seed, sequenced))
  const neglected = CORRIDORS.map((seed) => play(seed, sequencedNoMaintenance))
  const surplus = (s: SimState): number => s.history.reduce((total, h) => total + h.surplus, 0)

  it('hands the neglectful director a rebuild they did not choose, every time', () => {
    // The one thing that is true on every corridor. The road reaches the end
    // of its life on its own schedule and gets rebuilt whether the city
    // budgeted for it or not, at a premium, in the middle of whatever else was
    // happening. A director who resurfaces never meets it.
    const forced = (s: SimState): boolean => s.completed['capital.reconstruct'] !== undefined
    let compared = 0
    for (const [i, gone] of neglected.entries()) {
      // A director sacked in year fourteen never finds out. Only the runs that
      // go the distance can say anything about a twenty-five year cycle.
      if (!completed(gone) || !completed(maintained[i]!)) continue
      compared++
      expect(forced(gone), `${CORRIDORS[i]}: never had to rebuild`).toBe(true)
      expect(forced(maintained[i]!), `${CORRIDORS[i]}: resurfacing did not avoid it`).toBe(false)
    }
    expect(compared, 'no corridor ran the full thirty either way').toBeGreaterThanOrEqual(8)
  })

  it('costs the neglectful director dearly wherever the rebuild has to be borrowed', () => {
    const borrowed = neglected.filter((s, i) => completed(s) && s.fiscal.debt > 5_000_000
      && maintained[i]!.fiscal.debt < s.fiscal.debt)
    expect(borrowed.length, 'no corridor was pushed into debt by deferral').toBeGreaterThan(0)
    for (const gone of borrowed) {
      const i = neglected.indexOf(gone)
      expect(surplus(maintained[i]!), `${CORRIDORS[i]}`).toBeGreaterThan(surplus(gone))
    }
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
    // Compared at the same year, for the reason the revenue test gives: a run
    // that ended early has had less inflation applied to it. Seed 'a' fires
    // the well-sequenced director, so comparing final years flattered the
    // wrong order by two per cent and this test was reading that as a result.
    /*
     * It does not merely do worse. It ends the run.
     *
     * This used to compare revenue per acre in the final year, and it passed
     * for a reason that was not the reason it claimed: the wrong-order
     * director is FIRED, on every corridor, around year ten. Comparing final
     * years was comparing a run that stopped at ten against one that ran to
     * thirty, and on the one seed where the well-sequenced director is also
     * sacked the comparison inverted and the test went red.
     *
     * The real result is better than the one that was being asserted. Calming
     * a street whose land use cannot use it costs money and approval and
     * returns nothing for a decade, and a decade is longer than a council
     * will wait. Measured at year ten the wrong order is AHEAD on revenue per
     * acre - 18.5k against 16.4k - which is exactly why it is a trap, and
     * exactly why the director who takes it does not last to see the rest.
     */
    let sacked = 0
    for (const seed of CORRIDORS.slice(0, 6)) {
      const badly = play(seed, (y) => wrongOrder[y] ?? [])
      const well = play(seed, sequenced)
      expect(endedYear(badly), `${seed}: wrong order should not outlast the right one`)
        .toBeLessThanOrEqual(endedYear(well))
      if (!completed(badly)) sacked++
    }
    expect(sacked, 'the wrong order survived everywhere').toBeGreaterThanOrEqual(5)
  })
})
