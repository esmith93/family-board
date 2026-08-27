/**
 * The anti-goals are enforced here, as hard constraints.
 *
 * These are the rules that decide whether a skeptic stays past ninety seconds,
 * and they are easier to break by accident than any of the modelling.
 */
import { describe, expect, it } from 'vitest'
import { INSTRUMENTS } from './instruments'
import { CONSTANT_REGISTRY } from './constants'
import { GLOSSARY_CARDS } from './glossary'
import { newGame, advanceYear } from './step'

/** Vocabulary that must never appear in the primary UI. */
const RESERVED_VOCABULARY = [
  'walkable', 'walkability', 'car-centric', 'car centric', 'stroad', 'induced demand',
  'car dependency', 'car-dependent', 'auto-dependent',
]

/** Language that argues rather than describing a mechanism. */
const ADVOCACY_LANGUAGE = [
  'safer', 'safety benefit', 'improves', 'improved', 'better for', 'good for',
  'should', 'sustainable', 'vibrant', 'liveable', 'livable', 'human-scale',
  'benefits', 'healthier', 'greener', 'reduces crashes', 'saves lives',
  'quality of life', 'best practice', 'encourages', 'promotes',
]

const instrumentText = (): string[] =>
  INSTRUMENTS.flatMap((i) => [i.label, i.description])

describe('anti-goal 2: vocabulary is earned, never given', () => {
  it('keeps the reserved words out of every instrument', () => {
    for (const text of instrumentText()) {
      for (const word of RESERVED_VOCABULARY) {
        expect(text.toLowerCase(), `instrument text must not contain "${word}": ${text}`)
          .not.toContain(word)
      }
    }
  })

  it('keeps them out of the glossary trigger metadata too', () => {
    for (const card of GLOSSARY_CARDS) {
      expect(card.id).not.toMatch(/\s/)
    }
  })

  it('starts a run with no vocabulary unlocked at all', () => {
    const state = newGame('vocab')
    expect(state.glossary.unlocked).toEqual([])
  })

  /**
   * The rule, stated properly.
   *
   * A player who does nothing for thirty years has caused nothing, so they may
   * not be given a single one of the four reserved words. Checking only
   * `induced_demand` is how two unearned cards shipped: `stroad` fired at the
   * end of year one on every seed and every plan, and `walkability` fired at
   * year six of a run where nobody had touched anything, in a card written in
   * the past tense congratulating the player for it.
   */
  it('gives a player who does nothing none of the reserved vocabulary', () => {
    const RESERVED_CARDS = ['induced_demand', 'stroad', 'walkability', 'car_dependency']
    for (const seed of ['vocab', 'vocab-2', 'vocab-3', 'vocab-4']) {
      let state = newGame(seed)
      for (let i = 0; i < 30 && !state.ended; i++) state = advanceYear(state, []).state
      for (const id of RESERVED_CARDS) {
        expect(state.glossary.unlocked, `${seed}: doing nothing must not earn "${id}"`)
          .not.toContain(id)
      }
    }
  })

  it('never unlocks a card in the year the player pays for the thing', () => {
    // The trap only works if the game keeps quiet while it is springing. The
    // widening opens in year three and is genuinely quicker; naming induced
    // demand then explains the trick before it has been played.
    let state = newGame('vocab')
    for (let i = 0; i < 6 && !state.ended; i++) {
      state = advanceYear(state, state.year === 0 ? ['capital.state_widening'] : []).state
    }
    expect(state.glossary.unlocked).not.toContain('induced_demand')
  })

  it('does unlock a card once the player has actually caused it', () => {
    let state = newGame('vocab')
    for (let i = 0; i < 30 && !state.ended; i++) {
      state = advanceYear(state, state.year === 0 ? ['capital.state_widening'] : []).state
    }
    expect(state.glossary.unlocked).toContain('induced_demand')
    expect(state.glossary.unlocked).toContain('stroad')
  })

  it('records the year each card was earned, for the end-of-run timeline', () => {
    let state = newGame('vocab')
    for (let i = 0; i < 20 && !state.ended; i++) state = advanceYear(state, []).state
    for (const id of state.glossary.unlocked) {
      expect(state.glossary.unlockedAt[id]).toBeGreaterThan(0)
    }
  })
})

describe('anti-goal 5: a tooltip states mechanics and cost, and nothing else', () => {
  it('contains no advocacy language in any instrument description', () => {
    for (const instrument of INSTRUMENTS) {
      const text = `${instrument.label} ${instrument.description}`.toLowerCase()
      for (const phrase of ADVOCACY_LANGUAGE) {
        expect(text, `"${instrument.id}" must not argue: found "${phrase}"`)
          .not.toContain(phrase)
      }
    }
  })

  it('never states a downstream effect', () => {
    // Descriptions may say what changes physically and what it costs. They may
    // not say what happens as a result.
    for (const instrument of INSTRUMENTS) {
      const text = instrument.description.toLowerCase()
      expect(text, instrument.id).not.toMatch(/\b(will (?:reduce|increase|lower|raise|attract|encourage))\b/)
      expect(text, instrument.id).not.toMatch(/\b(results? in|leads? to|so that)\b/)
      /*
       * A bare comparative walks straight through the phrases above, and one
       * did: the bus lane was the only card in forty-six that quantified its
       * own payoff ("Buses run about 25% faster on the corridor") while the
       * roundabout says nothing about crashes and the road diet says nothing
       * about speed. The asymmetry was the tell.
       */
      expect(text, instrument.id)
        .not.toMatch(/\b(faster|slower|quieter|safer|cheaper|cleaner|fewer|busier|calmer)\b/)
    }
  })

  it('gives every instrument a description that says what it changes', () => {
    for (const instrument of INSTRUMENTS) {
      expect(instrument.description.length, instrument.id).toBeGreaterThan(30)
      expect(instrument.label.length, instrument.id).toBeGreaterThan(4)
    }
  })
})

describe('anti-goal 1: no villains', () => {
  it('never blames a person or a group', () => {
    const blame = ['greedy', 'selfish', 'evil', 'stupid', 'idiot', 'lazy', 'nimby', 'developer greed']
    const everything = [
      ...instrumentText(),
      ...GLOSSARY_CARDS.flatMap((c) => [c.term, c.body]),
    ]
    for (const text of everything) {
      for (const word of blame) {
        expect(text.toLowerCase(), `must not contain "${word}"`).not.toContain(word)
      }
    }
  })
})

describe('anti-goal 6: congratulate solvency, never values', () => {
  it('has no praise vocabulary anywhere in the simulation', () => {
    const praise = ['congratulations', 'well done', 'you did the right thing', 'great job']
    const everything = [...instrumentText(), ...GLOSSARY_CARDS.flatMap((c) => [c.term, c.body])]
    for (const text of everything) {
      for (const word of praise) {
        expect(text.toLowerCase()).not.toContain(word)
      }
    }
  })
})

describe('anti-goal 3: car-centric choices genuinely work in years 1-8', () => {
  /**
   * Every year of the eight, not the eighth.
   *
   * This test used to sample year 8 alone and pass, while years 1 and 2 were
   * measured to LOSE to doing nothing on speed, approval and congestion across
   * twenty-six corridors - all twenty-six, all three metrics. The player took
   * the free lane and their first two newspapers were of a slower, angrier
   * street, in exactly the window the brief says decides whether a skeptic
   * stays. A sample of one year is not a guard on eight.
   */
  it('is better than doing nothing in every one of years 1 to 8', () => {
    for (const seed of ['trap', 'trap-2', 'trap-3', 'skeptic']) {
      let widened = newGame(seed)
      let baseline = newGame(seed)
      for (let year = 1; year <= 8; year++) {
        widened = advanceYear(widened, widened.year === 0 ? ['capital.state_widening'] : []).state
        baseline = advanceYear(baseline, []).state
        expect(widened.traffic.peakSpeedMph, `${seed} y${year}: slower than doing nothing`)
          .toBeGreaterThanOrEqual(baseline.traffic.peakSpeedMph)
        expect(widened.traffic.volumeCapacityRatio, `${seed} y${year}: more congested than doing nothing`)
          .toBeLessThanOrEqual(baseline.traffic.volumeCapacityRatio)
        expect(widened.politics.approval, `${seed} y${year}: less popular than doing nothing`)
          .toBeGreaterThanOrEqual(baseline.politics.approval - 1)
      }
      expect(widened.ended).toBeNull()
    }
  })

  it('costs no political capital at all to take the grant', () => {
    const state = newGame('trap')
    const instrument = INSTRUMENTS.find((i) => i.id === 'capital.state_widening')!
    expect(instrument.pcCost(state)).toBe(0)
  })

  it('hides the obligation inside the offer rather than in the description', () => {
    const instrument = INSTRUMENTS.find((i) => i.id === 'capital.state_widening')!
    // It is stated plainly - the trap is that it is true and still tempting,
    // not that it is concealed.
    expect(instrument.description.toLowerCase()).toContain('maintenance')
  })
})

describe('an instrument never reveals its own effect', () => {
  /**
   * A card may cite the constants behind the figures it SHOWS - what a
   * lane-mile costs, how long a pavement lasts. It may never cite the
   * constants behind what the instrument DOES. Listing the roundabout's crash
   * modification factor on its card would tell the player what a roundabout is
   * for, which is the one thing the card must not do.
   */
  const EFFECT_KEY = /^CMF_|ELASTICITY|FATALITY|SEVERITY|CRASH|NOISE|TEMP|PM25|NO2|WILLING|APPROVAL|UHI|CANOPY_COOLING|DAYS_OVER/

  it('cites only cost-side constants', () => {
    for (const instrument of INSTRUMENTS) {
      for (const key of instrument.sourceKeys ?? []) {
        expect(EFFECT_KEY.test(key), `"${instrument.id}" cites "${key}", which is an effect`).toBe(false)
      }
    }
  })

  it('cites constants that actually exist', () => {
    for (const instrument of INSTRUMENTS) {
      for (const key of instrument.sourceKeys ?? []) {
        expect(CONSTANT_REGISTRY[key], `"${instrument.id}" cites unknown constant "${key}"`).toBeDefined()
      }
    }
  })

  it('states unlock conditions as mechanics, never as encouragement', () => {
    for (const instrument of INSTRUMENTS) {
      const hint = instrument.unlockHint
      if (!hint) continue
      const lower = hint.toLowerCase()
      for (const word of [...RESERVED_VOCABULARY, ...ADVOCACY_LANGUAGE]) {
        expect(lower, `"${instrument.id}" unlock hint contains "${word}"`).not.toContain(word)
      }
      expect(lower.startsWith('available') || lower.startsWith('the offer'), `"${instrument.id}": ${hint}`).toBe(true)
    }
  })
})

describe('the interface says no more than the instruments do', () => {
  it('keeps the reserved vocabulary out of every screen the player reads', async () => {
    const { readdirSync, readFileSync } = await import('node:fs')
    const dir = new URL('../ui/', import.meta.url)
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))) {
      const source = readFileSync(new URL(file, dir), 'utf8')
      // Only the strings: code identifiers and comments are not shown to anyone.
      const strings = [...source.matchAll(/'((?:[^'\\\n]|\\.)*)'|`([^`]*)`/g)]
        .map((m) => (m[1] ?? m[2] ?? '')).join(' ').toLowerCase()
      // Guard against a broken extraction making this test vacuous.
      expect(strings.length, `${file}: found no player-facing text to check`).toBeGreaterThan(40)
      for (const word of RESERVED_VOCABULARY) {
        expect(strings, `${file} shows the player "${word}"`).not.toContain(word)
      }
    }
  })
})

/**
 * The provenance panel is a player-facing surface, and it had no guard at all.
 *
 * "Why this number?" renders a constant's own `label` and `note` verbatim. The
 * notes were written for whoever was reading the model, and several of them
 * were writing to that reader: one of them called the ninety-ten grant "the
 * honest core of American municipal finance, and the opening trap of the
 * game", and it was reachable by clicking a button on the grant screen, inside
 * the first ninety seconds, before the player had made a single decision. The
 * game announcing that it has a thesis and that this is a trap is the exact
 * thing the skeptic closes the tab over.
 *
 * The panel's job is provenance. A note may state the sourced fact. The moment
 * it starts a second sentence about what the number MEANS, it is a tooltip
 * that argues.
 */
describe('the provenance panel states a fact and stops', () => {
  /** Every key the player can actually reach a card for. */
  const reachable = (): string[] => {
    const keys = new Set<string>()
    for (const instrument of INSTRUMENTS) {
      for (const key of instrument.sourceKeys ?? []) keys.add(key)
    }
    // The two meters in the top bar, which cite their keys from the UI.
    for (const key of [
      'OPENING_DEFICIT', 'CITY_POPULATION', 'INFRA_GAP_PER_CAPITA_ANNUAL',
      'STARTING_POLITICAL_CAPITAL', 'PC_ANNUAL_REGENERATION_BASE', 'PC_RIBBON_CUTTING',
    ]) keys.add(key)
    return [...keys]
  }

  /** Talking to whoever is holding the controller, rather than about a number. */
  const FOURTH_WALL = [
    'the player', 'the game', 'in the game', 'this game', 'the brief',
    'on purpose', 'included so', 'tuned high', 'tuned low', 'would be a lecture',
    'the opening trap', 'the trap', 'the whole point', 'which is the point',
  ]

  /** A note that has stopped reporting and started arguing. */
  const EDITORIAL = [
    'honest core', 'quietly subsid', 'so unforgiving', 'is most of why',
    'which is why', 'everything else follows', 'it is average', 'the honest answer',
    'almost never justified', 'nobody funds',
  ]

  it('cites a real constant for every key the player can click', () => {
    for (const key of reachable()) {
      expect(CONSTANT_REGISTRY[key], `no constant named "${key}"`).toBeDefined()
    }
  })

  it('never puts the reserved vocabulary in a panel the player can open', () => {
    for (const key of reachable()) {
      const constant = CONSTANT_REGISTRY[key]!
      const text = `${constant.label} ${constant.note ?? ''}`.toLowerCase()
      for (const word of RESERVED_VOCABULARY) {
        expect(text, `${key} shows the player "${word}"`).not.toContain(word)
      }
    }
  })

  it('never argues, praises or addresses the player directly', () => {
    for (const key of reachable()) {
      const constant = CONSTANT_REGISTRY[key]!
      const text = `${constant.label} ${constant.note ?? ''}`.toLowerCase()
      for (const phrase of [...ADVOCACY_LANGUAGE, ...FOURTH_WALL, ...EDITORIAL]) {
        expect(text, `${key} says "${phrase}": ${constant.note}`).not.toContain(phrase)
      }
    }
  })
})

describe('the page itself says no more than the instruments do', () => {
  it('keeps the reserved vocabulary and the advocacy out of index.html', async () => {
    const { readFileSync } = await import('node:fs')
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
    // Text nodes plus the attributes a reader actually gets read to them.
    const body = html.slice(html.indexOf('<body'))
    const text = body
      .replace(/<style[\s\S]*?<\/style>/g, ' ')
      .replace(/<script[\s\S]*?<\/script>/g, ' ')
      .replace(/<[^>]+>/g, ' ')
    const attrs = [...body.matchAll(/(?:title|alt|aria-label|placeholder)="([^"]*)"/g)]
      .map((m) => m[1] ?? '').join(' ')
    const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? ''
    const all = `${text} ${attrs} ${title}`.toLowerCase()
    expect(all.replace(/\s+/g, ' ').trim().length, 'found no page text to check').toBeGreaterThan(40)
    for (const word of [...RESERVED_VOCABULARY, ...ADVOCACY_LANGUAGE]) {
      expect(all, `index.html shows the player "${word}"`).not.toContain(word)
    }
  })
})

describe('the Ledger View is earned', () => {
  it('is locked at the start of every run', () => {
    for (const seed of ['a', 'b', 'c']) expect(newGame(seed).ledgerUnlocked).toBe(false)
  })
})
