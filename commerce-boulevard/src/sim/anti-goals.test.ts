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

  it('only unlocks a card after the player has caused the thing it names', () => {
    // Induced demand cannot unlock for a player who never added capacity.
    let state = newGame('vocab')
    for (let i = 0; i < 30 && !state.ended; i++) state = advanceYear(state, []).state
    expect(state.glossary.unlocked).not.toContain('induced_demand')
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
  it('raises approval and cuts congestion after the widening opens', () => {
    let widened = newGame('trap')
    let baseline = newGame('trap')
    for (let i = 0; i < 8; i++) {
      widened = advanceYear(widened, widened.year === 0 ? ['capital.state_widening'] : []).state
      baseline = advanceYear(baseline, []).state
    }
    // Year 8: the lane has been open four years.
    expect(widened.traffic.volumeCapacityRatio).toBeLessThan(baseline.traffic.volumeCapacityRatio)
    expect(widened.traffic.peakSpeedMph).toBeGreaterThan(baseline.traffic.peakSpeedMph)
    expect(widened.ended).toBeNull()
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

describe('the Ledger View is earned', () => {
  it('is locked at the start of every run', () => {
    for (const seed of ['a', 'b', 'c']) expect(newGame(seed).ledgerUnlocked).toBe(false)
  })
})
