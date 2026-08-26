/**
 * Tests for the reckoning.
 *
 * Two things are defended. That the numbers are the ones the game actually
 * kept, and that the document does not grade them. The second is the one that
 * needs a test, because a scoring screen is the most natural thing in the
 * world to write and it would undo the whole game: a player told they did well
 * has been handed a conclusion instead of reaching one.
 */

import { describe, expect, it } from 'vitest'

import { advanceYear, newGame, reckon, type Reckoning, type SimState } from './index'

const SEQUENCED: Record<number, string[]> = {
  0: ['land.reduce_parking_minimums'], 1: ['land.allow_mixed_use'],
  2: ['fiscal.business_improvement_district'], 4: ['land.reduce_setbacks'],
  5: ['fiscal.land_value_shift'], 6: ['land.abolish_parking_minimums'],
  7: ['capital.road_diet'], 8: ['capital.repave'], 9: ['street.add_kerb_parking'],
  11: ['land.raise_height_limit'], 16: ['land.raise_height_limit'],
  17: ['street.plant_trees'], 21: ['land.form_based_code'], 22: ['capital.repave'],
}
const WIDEN: Record<number, string[]> = { 0: ['capital.state_widening'] }

function play(seed: string, plan: Record<number, string[]> = {}, years = 30): SimState {
  let state = newGame(seed)
  for (let i = 0; i < years && !state.ended; i++) state = advanceYear(state, plan[state.year] ?? []).state
  return state
}

/** Every word the document can put on screen. */
function words(reckoning: Reckoning): string {
  const parts = [reckoning.headline]
  for (const section of reckoning.sections) {
    parts.push(section.title)
    for (const line of section.lines) {
      parts.push(line.label)
      if (line.note) parts.push(line.note)
    }
  }
  for (const term of reckoning.vocabulary) parts.push(term.term)
  return parts.join(' ').toLowerCase()
}

const CORRIDORS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'win', 'lose', 'order', 'reckon', 'fairview-best']

describe('it reports, it does not grade', () => {
  it('never tells the player how they did', () => {
    const banned = [
      'score', 'grade', 'rating', 'rank', 'stars', 'points',
      'well done', 'congratulations', 'you succeeded', 'you failed', 'good work',
      'better', 'worse', 'improved', 'declined', 'success', 'failure',
      'should have', 'you were right', 'you were wrong', 'the right choice',
      'unfortunately', 'sadly', 'happily', 'thankfully', 'impressive', 'disappointing',
    ]
    for (const plan of [{}, WIDEN, SEQUENCED]) {
      for (const seed of ['a', 'lose', 'fairview-best']) {
        const text = words(reckon(play(seed, plan)))
        for (const word of banned) {
          expect(text, `the reckoning said "${word}"`).not.toContain(word)
        }
      }
    }
  })

  it('keeps the earned vocabulary out of the labels', () => {
    // The four words the spec bans from the primary interface. They are in the
    // glossary cards the player earned, and the reckoning lists those by name -
    // which is the one place they are allowed, because the player caused them.
    for (const seed of ['a', 'fairview-best']) {
      const reckoning = reckon(play(seed, WIDEN))
      const labels = reckoning.sections
        .flatMap((s) => [s.title, ...s.lines.flatMap((l) => [l.label, l.note ?? ''])])
        .join(' ').toLowerCase()
      for (const word of ['walkab', 'car-centric', 'stroad', 'induced demand']) {
        expect(labels, `a label said "${word}"`).not.toContain(word)
      }
    }
  })

  it('gives the same document whatever the player did, with different numbers in it', () => {
    const shape = (r: Reckoning): string =>
      r.sections.map((s) => `${s.title}:${s.lines.map((l) => l.label).join('|')}`).join('//')
    expect(shape(reckon(play('a', WIDEN)))).toBe(shape(reckon(play('a', SEQUENCED))))
  })

  it('says what happened rather than what to think about it', () => {
    expect(reckon(play('a', {}, 0)).headline).toBe('Thirty years.')
    const fired = play('lose', { 0: ['fiscal.raise_property_tax'], 1: ['fiscal.raise_property_tax'] })
    if (fired.ended?.reason === 'fired') {
      expect(reckon(fired).headline).toBe('The council has thanked you for your service.')
    }
  })
})

describe('the numbers are the ones the game kept', () => {
  it('reckons the first recorded year against the last', () => {
    const state = play('a', SEQUENCED)
    const reckoning = reckon(state)
    const first = state.history[0]!
    const last = state.history[state.history.length - 1]!
    const find = (label: string): { then: number; now: number } => {
      const line = reckoning.sections.flatMap((s) => s.lines).find((l) => l.label === label)
      if (!line) throw new Error(`no line labelled "${label}" in the reckoning`)
      return line
    }
    expect(find('Vehicles a day').then).toBe(first.aadt)
    expect(find('Vehicles a day').now).toBe(last.aadt)
    expect(find('Median rent, a month').now).toBe(last.medianRent)
  })

  it('totals the things a final-year rate would misrepresent', () => {
    const reckoning = reckon(play('a', {}))
    const deaths = reckoning.sections.flatMap((s) => s.lines).find((l) => l.label === 'Deaths a year')!
    expect(deaths.total).toBeDefined()
    // Thirty years of a rate is thirty times the rate, near enough.
    expect(deaths.total!).toBeGreaterThan(deaths.now * 5)
  })

  it('produces finite numbers on every corridor and every ending', () => {
    for (const seed of CORRIDORS) {
      for (const plan of [{}, WIDEN, SEQUENCED]) {
        const reckoning = reckon(play(seed, plan))
        for (const line of reckoning.sections.flatMap((s) => s.lines)) {
          // `then` may be deliberately absent for a line with no year-zero value.
          expect(Number.isFinite(line.now), `${seed}: ${line.label}`).toBe(true)
          if (line.total !== undefined) expect(Number.isFinite(line.total)).toBe(true)
        }
      }
    }
  })

  it('survives a run with no recorded year at all', () => {
    const reckoning = reckon({ ...newGame('a'), history: [] })
    expect(reckoning.sections).toEqual([])
    expect(reckoning.headline).toBe('Thirty years.')
    expect(reckoning.account.taxableParcels).toBeGreaterThan(0)
  })

  it('is deterministic', () => {
    expect(JSON.stringify(reckon(play('same', SEQUENCED))))
      .toBe(JSON.stringify(reckon(play('same', SEQUENCED))))
  })
})

describe('the corridor account', () => {
  it('leaves the park out rather than marking it a failure', () => {
    const account = reckon(play('a', {})).account
    for (const row of account.byUse) {
      expect(['park', 'civic', 'plaza']).not.toContain(row.use)
    }
    expect(account.taxableParcels).toBeLessThan(120)
    expect(account.taxableParcels).toBeGreaterThan(60)
  })

  it('says the widened corridor covers less of itself than the one left alone', () => {
    const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length
    const widened = mean(CORRIDORS.map((s) => reckon(play(s, WIDEN)).account.ratio))
    const left = mean(CORRIDORS.map((s) => reckon(play(s, {})).account.ratio))
    expect(widened).toBeLessThan(left)
  })

  it('sorts uses by the land they occupy, which is what the city pays to serve', () => {
    const byUse = reckon(play('a', {})).account.byUse
    for (let i = 1; i < byUse.length; i++) {
      expect(byUse[i]!.acres).toBeLessThanOrEqual(byUse[i - 1]!.acres)
    }
  })
})

describe('the two numbers, side by side', () => {
  it('reports what could be reached on foot and what was walked, separately', () => {
    // The corridor as inherited. A supermarket on a mile-and-a-bit of street
    // is physically within a fifteen-minute walk of a good many households,
    // and almost none of them walk to it. Both numbers are true and printing
    // them in the same row is the whole of the argument.
    const reach = reckon(play('a', {}, 1)).reach
    expect(reach.couldWalkToGrocery).toBeGreaterThan(0.2)
    expect(reach.walked).toBeLessThan(0.12)
    expect(reach.couldWalkToGrocery).toBeGreaterThan(reach.walked * 3)
  })

  it('narrows it on a corridor that was actually changed', () => {
    const ratioOf = (plan: Record<number, string[]>): number => {
      const reach = reckon(play('fairview-best', plan)).reach
      return reach.walked / Math.max(0.001, reach.couldWalkToGrocery)
    }
    expect(ratioOf(SEQUENCED)).toBeGreaterThan(ratioOf(WIDEN))
  })
})

describe('the vocabulary', () => {
  it('lists only what the player caused, in the order they caused it', () => {
    const state = play('a', WIDEN)
    const reckoning = reckon(state)
    expect(reckoning.vocabulary.length).toBe(state.glossary.unlocked.length)
    for (let i = 1; i < reckoning.vocabulary.length; i++) {
      expect(reckoning.vocabulary[i]!.year).toBeGreaterThanOrEqual(reckoning.vocabulary[i - 1]!.year)
    }
  })

  it('names what the player inherited as well as what they did', () => {
    // Fairview is a stroad on the day the job starts, so that card is earned
    // in the first year by nobody's decision. Induced demand is not: it takes
    // widening the road and then waiting.
    const early = reckon(play('a', {}, 2)).vocabulary.map((v) => v.term)
    expect(early).toContain('Stroad')
    expect(early).not.toContain('Induced demand')
    const widened = reckon(play('a', WIDEN)).vocabulary.map((v) => v.term)
    expect(widened).toContain('Induced demand')
  })
})
