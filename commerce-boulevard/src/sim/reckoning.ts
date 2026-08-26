/**
 * The reckoning.
 *
 * Thirty years of numbers the game has been keeping and not showing, put next
 * to the ones it started with.
 *
 * ANTI-GOAL, and the one this file exists to hold: it reports, it does not
 * grade. There is no score, no letter, no stars, and nothing anywhere that
 * says whether a number went the right way. A player who widened the road and
 * a player who narrowed it get the same document with different numbers in it,
 * and neither is told what to think about theirs. A test reads every string
 * this module can produce and checks it.
 *
 * The one thing that is allowed to be pointed is putting two numbers side by
 * side. Households that could reach a grocery on foot, and trips actually made
 * on foot, are both facts, and printing them in the same row is not commentary.
 */

import { GLOSSARY_CARDS } from './glossary'
import { isTaxExempt, profileFor } from './landuse'
import { parcelLedger } from './fiscal'
import type { LandUse, SimState, YearSnapshot } from './types'

export type Format =
  | 'money' | 'moneyExact' | 'moneyPerAcre' | 'percent' | 'count' | 'decimal1'
  | 'mph' | 'dba' | 'ratio' | 'feet'

export interface ReckoningLine {
  label: string
  /** What it was in the first year the game recorded. */
  then: number
  /** What it is now. */
  now: number
  format: Format
  /**
   * The total across the whole run, where a rate in the final year is the
   * wrong number to look at. Deaths are the obvious case.
   */
  total?: number
  /** What the number means. A definition, never a verdict. */
  note?: string
}

export interface ReckoningSection {
  title: string
  lines: ReckoningLine[]
}

/** The corridor's own account, aggregated over everything that pays tax. */
export interface CorridorAccount {
  taxableAcres: number
  revenuePerAcre: number
  liabilityPerAcre: number
  ratio: number
  payingParcels: number
  taxableParcels: number
  byUse: { use: LandUse; acres: number; revenuePerAcre: number; liabilityPerAcre: number; ratio: number }[]
  parkingShare: number
}

export interface Reckoning {
  reason: 'fired' | 'insolvent' | 'completed'
  finalYear: number
  /** A statement of what happened. Not a verdict on it. */
  headline: string
  sections: ReckoningSection[]
  account: CorridorAccount
  /** Vocabulary the player earned by causing the thing it names. */
  vocabulary: { term: string; year: number }[]
  /** The two numbers, side by side. */
  reach: { couldWalkToGrocery: number; walked: number; childrenCouldWalk: number }
}

const HEADLINES: Readonly<Record<Reckoning['reason'], string>> = Object.freeze({
  fired: 'The council has thanked you for your service.',
  insolvent: 'Fairview has entered state financial oversight.',
  completed: 'Thirty years.',
})

/** The corridor's account. Parks and schools are left out rather than failed. */
export function corridorAccount(state: SimState): CorridorAccount {
  const rows = parcelLedger(state, state.year).filter((r) => !isTaxExempt(r.use as LandUse))

  let acres = 0
  let revenue = 0
  let liability = 0
  const uses = new Map<LandUse, { acres: number; revenue: number; liability: number }>()
  for (const row of rows) {
    acres += row.acres
    revenue += row.revenuePerAcre * row.acres
    liability += row.liabilityPerAcre * row.acres
    const use = row.use as LandUse
    const entry = uses.get(use) ?? { acres: 0, revenue: 0, liability: 0 }
    entry.acres += row.acres
    entry.revenue += row.revenuePerAcre * row.acres
    entry.liability += row.liabilityPerAcre * row.acres
    uses.set(use, entry)
  }

  const allAcres = state.parcels.reduce((sum, p) => sum + p.acres, 0)
  const parkingAcres = state.parcels.reduce(
    (sum, p) => sum + p.acres * profileFor(p.use).surfaceParkingShare, 0)

  return {
    taxableAcres: acres,
    revenuePerAcre: acres > 0 ? revenue / acres : 0,
    liabilityPerAcre: acres > 0 ? liability / acres : 0,
    ratio: liability > 0 ? revenue / liability : 0,
    payingParcels: rows.filter((r) => r.ratio >= 1).length,
    taxableParcels: rows.length,
    byUse: [...uses.entries()]
      .map(([use, v]) => ({
        use,
        acres: v.acres,
        revenuePerAcre: v.revenue / Math.max(0.01, v.acres),
        liabilityPerAcre: v.liability / Math.max(0.01, v.acres),
        ratio: v.liability > 0 ? v.revenue / v.liability : 0,
      }))
      .sort((a, b) => b.acres - a.acres),
    parkingShare: allAcres > 0 ? parkingAcres / allAcres : 0,
  }
}

const sum = (history: readonly YearSnapshot[], pick: (h: YearSnapshot) => number): number =>
  history.reduce((total, h) => total + pick(h), 0)

/**
 * Assemble it.
 *
 * `then` is the first year the game recorded rather than a remembered constant,
 * so a corridor generated from a different seed reckons against its own start
 * and not against somebody else's.
 */
export function reckon(state: SimState): Reckoning {
  const history = state.history
  const first = history[0]
  const last = history[history.length - 1]
  const reason = state.ended?.reason ?? 'completed'

  if (!first || !last) {
    return {
      reason,
      finalYear: state.year,
      headline: HEADLINES[reason],
      sections: [],
      account: corridorAccount(state),
      vocabulary: [],
      reach: { couldWalkToGrocery: 0, walked: 0, childrenCouldWalk: 0 },
    }
  }

  const account = corridorAccount(state)
  const line = (
    label: string, pick: (h: YearSnapshot) => number, format: Format,
    extra?: { total?: number; note?: string },
  ): ReckoningLine => ({
    label, then: pick(first), now: pick(last), format, ...extra,
  })

  const sections: ReckoningSection[] = [
    {
      title: 'The money',
      lines: [
        { label: 'Revenue per acre', then: first.revenuePerAcre, now: last.revenuePerAcre, format: 'moneyPerAcre' },
        {
          label: 'Infrastructure liability per acre',
          then: first.liabilityPerAcre, now: last.liabilityPerAcre, format: 'moneyPerAcre',
          note: 'What the city spends each year keeping the pipes, the pavement and the lights in front of an acre.',
        },
        {
          label: 'Revenue divided by liability',
          then: first.liabilityPerAcre > 0 ? first.revenuePerAcre / first.liabilityPerAcre : 0,
          now: account.ratio, format: 'ratio',
          note: 'Above one, the corridor covers what it costs. Below one, somewhere else in Fairview is covering it.',
        },
        line('Outstanding debt', (h) => h.debt, 'money'),
        line('Annual surplus', (h) => h.surplus, 'money', {
          total: sum(history, (h) => h.surplus),
          note: 'The total is every year of the run added up.',
        }),
        {
          label: 'Parcels that cover their own cost',
          then: Number.NaN, now: account.payingParcels, format: 'count',
          note: `Out of ${account.taxableParcels} that are on the tax roll.`,
        },
      ],
    },
    {
      title: 'The street',
      lines: [
        { label: 'Through lanes each way', then: state.baseline.lanesPerDirection, now: state.street.throughLanesPerDirection, format: 'count' },
        line('Vehicles a day', (h) => h.aadt, 'count'),
        line('Peak-hour speed', (h) => h.peakSpeedMph, 'mph'),
        line('Sound level at the kerb', (h) => h.noiseDba, 'dba'),
        line('Tree canopy', (h) => h.canopyFraction, 'percent'),
        line('Days over ninety-five', (h) => h.daysOver95, 'count'),
        {
          label: 'Feet between marked crossings',
          then: 1320, now: state.street.crossingSpacingFt, format: 'feet',
        },
      ],
    },
    {
      title: 'The people',
      lines: [
        line('People living on the corridor', (h) => h.population, 'count'),
        line('Jobs on the corridor', (h) => h.jobs, 'count'),
        line('Businesses trading', (h) => h.businesses, 'count'),
        line('Median rent, a month', (h) => h.medianRent, 'moneyExact'),
        {
          label: 'People who gave up and moved',
          then: 0, now: last.residentsLeft, format: 'count',
          note: 'Across the whole service area of eighteen thousand, added up over the run. '
            + 'An address that turns over twice is counted twice.',
        },
        line('Household transport cost', (h) => h.transportCostShare, 'percent', {
          note: 'What running the cars takes out of a median household income.',
        }),
      ],
    },
    {
      title: 'The ambulance',
      lines: [
        line('Collisions a year', (h) => h.crashes, 'count', {
          total: sum(history, (h) => h.crashes),
        }),
        line('Deaths a year', (h) => h.fatal, 'decimal1', {
          total: sum(history, (h) => h.fatal),
          note: 'The total is everyone killed on Commerce Boulevard across the run.',
        }),
        line('Deaths on foot a year', (h) => h.pedestrianFatal, 'decimal1', {
          total: sum(history, (h) => h.pedestrianFatal),
        }),
      ],
    },
    {
      title: 'Getting about',
      lines: [
        line('Trips made on foot', (h) => h.modeShare.walk, 'percent'),
        line('Trips made by bicycle', (h) => h.modeShare.bike, 'percent'),
        line('Trips made by bus', (h) => h.modeShare.transit, 'percent'),
        line('Trips made by car', (h) => h.modeShare.drive, 'percent'),
        {
          label: 'Households within a fifteen-minute walk of a grocery',
          then: first.groceryWalkShare, now: last.groceryWalkShare, format: 'percent',
          note: 'Measured in clock time on the footway that exists.',
        },
        {
          label: 'Children who could walk to school alone',
          then: first.childWalkShare, now: last.childWalkShare, format: 'percent',
        },
      ],
    },
  ]

  const vocabulary = GLOSSARY_CARDS
    .filter((card) => state.glossary.unlocked.includes(card.id))
    .map((card) => ({ term: card.term, year: state.glossary.unlockedAt[card.id] ?? 0 }))
    .sort((a, b) => a.year - b.year)

  return {
    reason,
    finalYear: state.ended?.year ?? state.year,
    headline: HEADLINES[reason],
    sections,
    account,
    vocabulary,
    reach: {
      couldWalkToGrocery: last.groceryWalkShare,
      walked: last.modeShare.walk,
      childrenCouldWalk: last.childWalkShare,
    },
  }
}
