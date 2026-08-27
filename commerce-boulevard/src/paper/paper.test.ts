/**
 * Tests for the Fairview Ledger.
 *
 * Most of these check that the paper is stupid, which is an unusual thing to
 * have to prove. The paper is the only voice in the game with a byline, and if
 * it ever gets clever - if it remembers a decision, or names a phenomenon, or
 * tells the player what a street is for - the whole thing collapses into a
 * lecture. So: no memory across years, no vocabulary the player has not earned,
 * no causal reasoning, and no access to any number the residents of Fairview
 * could not work out for themselves.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { advanceYear, cityShortfall, newGame, type SimState } from '../sim/index'
import { REFERENCE_PLAN_MAINTAINED } from '../sim/reference-plan'
import { observe } from './observation'
import { newMemory, circumstanceOf, type PaperMemory } from './residents'
import { composeFrontPage, type FrontPage } from './paper'
import { STORIES } from './stories'
import { LETTERS } from './letters'

const HERE = new URL('.', import.meta.url).pathname

/** Play a run, keeping every front page the Ledger printed. */
function runPaper(seed: string, years: number, policy: (s: SimState) => string[] = () => []): {
  pages: FrontPage[]
  memory: PaperMemory
  state: SimState
} {
  let state = newGame(seed)
  const memory = newMemory(state)
  const pages: FrontPage[] = []
  for (let i = 0; i < years && !state.ended; i++) {
    const before = cityShortfall(state)
    state = advanceYear(state, policy(state)).state
    const o = observe(state, cityShortfall(state), before)
    const frozen = state
    pages.push(composeFrontPage(o, memory, (r) => circumstanceOf(r, frozen), seed))
  }
  return { pages, memory, state }
}

/** Everything the reader actually reads. */
function textOf(page: FrontPage): string {
  const parts: string[] = [page.lead.headline, page.lead.subhead ?? '', page.lead.body ?? '']
  for (const s of [...page.seconds, ...page.briefs]) {
    parts.push(s.headline, s.subhead ?? '', s.body ?? '')
  }
  if (page.letter) parts.push(page.letter.text, page.letter.signature)
  if (page.photo) parts.push(page.photo.caption)
  return parts.join('\n')
}

describe('the paper cannot see past the observation', () => {
  it('no module in the paper reads the simulation except through observe() and the cast', () => {
    const files = readdirSync(HERE).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    // observation.ts is the window. residents.ts uses it once, at the start, to
    // find real households for the letter writers, and takes nothing else.
    const allowed = new Set(['observation.ts', 'residents.ts'])
    for (const file of files) {
      if (allowed.has(file)) continue
      const source = readFileSync(join(HERE, file), 'utf8')
      const imports = [...source.matchAll(/from '([^']+)'/g)].map((m) => m[1]!)
      expect(imports.filter((i) => i.includes('sim')), `${file} reaches into the simulation`).toEqual([])
    }
  })

  it('residents.ts takes only the households and the seed', () => {
    const source = readFileSync(join(HERE, 'residents.ts'), 'utf8')
    const line = source.split('\n').find((l) => l.includes("from '../sim"))!
    // makeRng for determinism, SimState for the household list. Nothing else.
    expect(line).toMatch(/makeRng/)
    expect(line).toMatch(/SimState/)
    expect(line.split(',').length).toBeLessThanOrEqual(2)
  })

  it('the observation withholds the numbers the reveal is made of', () => {
    const source = readFileSync(join(HERE, 'observation.ts'), 'utf8')
    for (const hidden of [
      'revenuePerAcre', 'liabilityPerAcre', 'groceryWalkShare', 'childWalkShare', 'transportCostShare',
    ]) {
      expect(source, `the paper can see ${hidden}`).not.toContain(hidden)
    }
  })
})

describe('the paper never uses vocabulary the player has not earned', () => {
  const RESERVED = [
    'walkab', 'car-centric', 'car centric', 'stroad', 'induced demand', 'induced traffic',
    'level of traffic stress', 'mode share', 'revenue per acre', 'traffic evaporation',
    'auto-oriented', 'sprawl',
  ]

  it('over three full runs, in every headline, subhead, body, letter and caption', () => {
    for (const seed of ['ledger-a', 'ledger-b', 'ledger-c']) {
      const { pages } = runPaper(seed, 30, widenThenNothing)
      for (const page of pages) {
        const text = textOf(page).toLowerCase()
        for (const word of RESERVED) {
          expect(text, `year ${page.year} of ${seed} printed "${word}"`).not.toContain(word)
        }
      }
    }
  })
})

describe('the paper keeps the game\'s other promises too', () => {
  /** Every word printed across three whole runs under three different plans. */
  const everything = (): string => {
    const parts: string[] = []
    for (const [seed, policy] of [
      ['ledger-a', widenThenNothing], ['ledger-p', sequencedPlan], ['ledger-q', cosmeticPlan],
    ] as const) {
      for (const page of runPaper(seed, 30, policy).pages) parts.push(textOf(page))
    }
    return parts.join('\n').toLowerCase()
  }

  it('has no villains in it', () => {
    // Anti-goal 1. The Ledger quotes a developer, a spokesman and a council
    // member every other week, and it never once suggests any of them is the
    // problem, which is what an actual local paper does.
    const text = everything()
    for (const word of [
      'greedy', 'greed', 'selfish', 'evil', 'stupid', 'idiot', 'lazy', 'nimby',
      'corrupt', 'to blame', 'special interests', 'lobby',
    ]) {
      expect(text, `the paper blamed somebody: "${word}"`).not.toContain(word)
    }
  })

  it('never congratulates anybody on their values', () => {
    // Anti-goal 6. The paper is allowed to say the traders had a good year.
    // It is not allowed to tell the player they were right.
    const text = everything()
    for (const phrase of [
      'congratulations', 'well done', 'the right thing', 'great job',
      // Stemmed. The ban used to read 'vindicated the' and a letter got
      // through saying 'been vindicated'.
      'vindicat', 'the right way', 'nobody wanted to be on',
      'proved right', 'visionary', 'bold leadership', 'courageous',
    ]) {
      expect(text, `the paper handed out a prize: "${phrase}"`).not.toContain(phrase)
    }
  })

  it('never tells the player what a street is for', () => {
    // Anti-goal 5, applied to the one voice in the game with a byline. The
    // Ledger reports a thing that happened. It does not explain the thing.
    const text = everything()
    for (const phrase of [
      'the purpose of', 'is designed to', 'in order to encourage', 'so that people',
      'studies show', 'experts say', 'research suggests', 'best practice',
    ]) {
      expect(text, `the paper explained itself: "${phrase}"`).not.toContain(phrase)
    }
  })
})

describe('the paper has no memory and does not reason about causes', () => {
  it('never explains one year with another', () => {
    // A headline that reasons is a headline that has stopped being a newspaper
    // and started being the game talking. The Ledger reports and stops.
    const CAUSAL = [
      'because', 'therefore', 'as a result', 'which is why', 'caused by', 'thanks to',
      'the reason', 'stems from', 'brought about by', 'consequence of', 'ever since',
      'follows the decision', 'years earlier', 'years ago the city',
    ]
    for (const seed of ['ledger-a', 'ledger-d']) {
      const { pages } = runPaper(seed, 30, widenThenNothing)
      for (const page of pages) {
        const text = textOf(page).toLowerCase()
        for (const phrase of CAUSAL) {
          expect(text, `year ${page.year} of ${seed} reasoned: "${phrase}"`).not.toContain(phrase)
        }
      }
    }
  })

  it('never prints a year other than the one it is dated', () => {
    // The single hardest rule. If the paper can write "since the 2003 widening"
    // it has a memory, and if it has a memory the player never has to build one.
    const { pages } = runPaper('ledger-a', 30, widenThenNothing)
    for (const page of pages) {
      const stray = textOf(page).match(/\b(19|20)\d{2}\b/g)
      expect(stray, `year ${page.year} dated something`).toBeNull()
    }
  })

  it('does not run the same story two years running', () => {
    const { pages } = runPaper('ledger-b', 30, widenThenNothing)
    for (let i = 1; i < pages.length; i++) {
      expect(pages[i]!.lead.id, `repeated lead in year ${pages[i]!.year}`).not.toBe(pages[i - 1]!.lead.id)
    }
  })

  it('does not print the same letter twice in a run', () => {
    const { pages } = runPaper('ledger-c', 30, widenThenNothing)
    const seen = new Set<string>()
    for (const page of pages) {
      if (!page.letter) continue
      expect(seen.has(page.letter.text), `reprinted a letter in year ${page.year}`).toBe(false)
      seen.add(page.letter.text)
    }
  })
})

describe('the paper comes out every week whatever happened', () => {
  it('always has a lead and a column of briefs', () => {
    const { pages } = runPaper('ledger-e', 30)
    expect(pages.length).toBeGreaterThan(20)
    for (const page of pages) {
      expect(page.lead.headline.length).toBeGreaterThan(8)
      expect(page.briefs.length).toBeGreaterThanOrEqual(2)
      expect(page.masthead).toBe('The Fairview Ledger')
      expect(page.dateline).toMatch(/^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday), /)
    }
  })

  it('runs a letter in most weeks', () => {
    const { pages } = runPaper('ledger-e', 30)
    const withLetters = pages.filter((p) => p.letter !== null).length
    expect(withLetters / pages.length).toBeGreaterThan(0.6)
  })

  it('gives the letters column a familiar name', () => {
    const { pages, memory } = runPaper('ledger-f', 30, widenThenNothing)
    const writers = new Set(pages.filter((p) => p.letter).map((p) => p.letter!.resident.name))
    expect(writers.size).toBeGreaterThan(1)
    expect(writers.size).toBeLessThanOrEqual(memory.cast.length)
    // Somebody writes in more than once, or there is no arc to watch.
    const repeat = Object.values(memory.appearances).some((years) => years.length >= 3)
    expect(repeat).toBe(true)
  })

  it('is deterministic', () => {
    const a = runPaper('ledger-g', 25, widenThenNothing).pages.map(textOf).join('|')
    const b = runPaper('ledger-g', 25, widenThenNothing).pages.map(textOf).join('|')
    expect(a).toBe(b)
  })

  it('prints a different paper in a different town', () => {
    const a = runPaper('ledger-g', 25).pages.map(textOf).join('|')
    const b = runPaper('ledger-h', 25).pages.map(textOf).join('|')
    expect(a).not.toBe(b)
  })
})

describe('the paper cheers the widening and never takes it back', () => {
  it('is pleased in the early years and baffled in the late ones', () => {
    const { pages } = runPaper('ledger-a', 30, widenThenNothing)
    const early = pages.filter((p) => p.year <= 6).map((p) => p.lead.id + ' ' + textOf(p))
    const late = pages.filter((p) => p.year >= 14).map((p) => p.lead.id + ' ' + textOf(p))
    expect(early.join(' ')).toMatch(/freely again|Work begins|Ribbon cut|traffic counts/i)
    expect(late.join(' ')).toMatch(/gap widens|borrows|Backups return|standstill|go dark/i)
  })

  it('never suggests the two are connected', () => {
    const { pages } = runPaper('ledger-a', 30, widenThenNothing)
    const late = pages.filter((p) => p.year >= 12).map(textOf).join('\n').toLowerCase()
    for (const phrase of ['the widening', 'the lanes added', 'since the road was widened']) {
      expect(late, `the paper joined the dots: "${phrase}"`).not.toContain(phrase)
    }
  })
})

describe('the turn is earned, not scheduled', () => {
  it('never turns on a corridor that was only widened', () => {
    for (const seed of ['ledger-a', 'ledger-b', 'ledger-c']) {
      const { pages, memory } = runPaper(seed, 30, widenThenNothing)
      expect(pages.some((p) => p.turned), `${seed} turned without earning it`).toBe(false)
      expect(memory.noticedAt).toBeNull()
    }
  })

  it('never turns on a corridor that was only decorated', () => {
    // Trees, crossings, lighting and a painted bike lane, and nothing at all
    // done about the land use or the width of the road. This has to be allowed
    // to fail, and the paper is where the player finds out that it did.
    for (const seed of ['a', 'reckon', 'fairview-best']) {
      const { pages } = runPaper(seed, 30, cosmeticPlan)
      expect(pages.some((p) => p.turned), `${seed} turned on decoration alone`).toBe(false)
    }
  })

  it('does turn on a corridor that earned it, once, and late', () => {
    const turnYears: number[] = []
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'win', 'order', 'reckon', 'fairview-best']) {
      const { pages, memory } = runPaper(seed, 30, sequencedPlan)
      expect(pages.filter((p) => p.turned).length, `${seed} turned twice`).toBeLessThanOrEqual(1)
      if (memory.noticedAt !== null) turnYears.push(memory.noticedAt)
    }
    // Not every corridor gets there. Enough of them do that the turn is real.
    expect(turnYears.length).toBeGreaterThanOrEqual(5)
    expect(Math.min(...turnYears), 'the paper came round too easily').toBeGreaterThanOrEqual(15)
  })

  it('stays turned once it has turned', () => {
    const { pages, memory } = runPaper('fairview-best', 30, sequencedPlan)
    if (memory.noticedAt === null) return
    const after = pages.filter((p) => p.year > memory.noticedAt!)
    // The tone does not go back: something from the paper's new register keeps
    // showing up, rather than the turn being one headline and then silence.
    const later = after.map((p) => [p.lead, ...p.seconds].map((s) => s.id).join(' ')).join(' ')
    expect(later).toMatch(/turn\./)
  })
})

describe('the desk has enough copy to fill the page', () => {
  it('has enough copy that a thirty-year run is not four headlines', () => {
    expect(STORIES.length).toBeGreaterThanOrEqual(28)
    expect(LETTERS.length).toBeGreaterThanOrEqual(24)
  })

  it('every story id is unique', () => {
    const ids = STORIES.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    const letterIds = LETTERS.map((l) => l.id)
    expect(new Set(letterIds).size).toBe(letterIds.length)
  })

  it('uses most of the library over a long run rather than four favourites', () => {
    const { memory } = runPaper('ledger-a', 30, widenThenNothing)
    const used = Object.keys(memory.usedStories).length
    expect(used).toBeGreaterThan(10)
  })
})

// --- Policies ---------------------------------------------------------------

/** Take the state's money in year one and then govern by inertia. */
function widenThenNothing(state: SimState): string[] {
  return state.year === 0 ? ['capital.state_widening'] : []
}

/** The one reference plan, shared with the simulation's own tests. */
function sequencedPlan(state: SimState): string[] {
  return REFERENCE_PLAN_MAINTAINED[state.year] ?? []
}

/** The nice things, and only the nice things. This is allowed to not work. */
const COSMETIC: Record<number, string[]> = {
  2: ['street.plant_trees'],
  5: ['street.add_crossings'],
  9: ['street.pedestrian_lighting'],
  14: ['street.painted_bike_lane'],
  20: ['street.plant_trees'],
}

function cosmeticPlan(state: SimState): string[] {
  return COSMETIC[state.year] ?? []
}
