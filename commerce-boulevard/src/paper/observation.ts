/**
 * What the Fairview Ledger is allowed to know.
 *
 * The paper is not the narrator. It is a character, and it is not very smart:
 * it reports what people in Fairview can feel in the year they feel it. It
 * cannot see revenue per acre, or infrastructure liability, or how many
 * households can reach a grocery on foot, because nobody in Fairview can see
 * those either until somebody works them out.
 *
 * This module is the whole of the paper's access to the simulation, and a test
 * enforces that nothing else in src/paper reaches past it. That is what stops
 * the paper quietly becoming clever.
 */

import type { SimEvent, SimState, YearSnapshot } from '../sim/index'

/** One year as it was experienced, not as it was modelled. */
export interface Observation {
  year: number

  /** Things a person notices from a car. */
  peakSpeedMph: number
  speedChange: number
  aadt: number
  trafficChange: number
  lanesEachWay: number
  worksUnderWay: string[]
  worksFinished: string[]

  /** Things a person notices on the pavement. */
  noiseDba: number
  canopy: number
  daysOver95: number
  walkShare: number
  walkChange: number

  /** Things a person notices in the paper's own back pages. */
  businessesOpened: number
  businessesClosed: number
  businessCount: number
  vacancyMood: 'filling' | 'steady' | 'emptying'
  newHomes: number
  medianRent: number
  rentChange: number

  /** Things a person notices in their own bill, or at a council meeting. */
  cityShortfall: number
  shortfallChange: number
  debt: number
  taxChanged: number
  approval: number

  /** Things a person notices from the ambulance. */
  crashes: number
  crashChange: number
  fatalities: number
  fatalityChange: number

  /** Whether the corridor has actually got better to be on, in plain terms. */
  streetMood: number

  /** Raw events, for stories that need a specific detail. */
  events: SimEvent[]
  /** Everything so far, for the paper's very short memory. */
  history: readonly YearSnapshot[]
}

const delta = (now: number, before: number | undefined): number =>
  before === undefined ? 0 : now - before

/**
 * Reduce a year to what Fairview noticed about it.
 *
 * `streetMood` is the one composite: an ordinary resident's sense of whether
 * the corridor is a pleasant place to be, from the four things they can
 * perceive without being told - how loud it is, how wide it is, whether there
 * is shade, and whether anybody else is out walking. It is not a score of
 * anything and the paper never prints it as a number.
 */
export function observe(state: SimState, cityShortfallNow: number, cityShortfallBefore: number): Observation {
  const now = state.history[state.history.length - 1]
  const before = state.history[state.history.length - 2]
  if (!now) throw new Error('a year must have passed before it can be reported')

  const churn = state.events.find((e) => e.id === 'retail_churn')
  const opened = Number(churn?.detail.openings ?? 0)
  const closed = Number(churn?.detail.closures ?? 0)

  const newHomes = state.events.filter((e) => e.id === 'redevelopment').length

  const worksUnderWay = state.activeProjects.map((p) => p.label)
  const worksFinished = state.events
    .filter((e) => e.id === 'project_opened')
    .map((e) => String(e.detail.label))

  const canopy = now.canopyFraction
  const street = state.street

  // Four things, all of them visible or audible from the kerb, none of them a
  // number anybody in Fairview would ever calculate.
  //
  // Deliberately not built from speed: a jammed six-lane arterial is slow and
  // it is still horrible, and the crawl is not relief from it. Deliberately
  // not built from the traffic count either. A resident cannot tell a through
  // trip from a local one, and a corridor that has doubled its own population
  // carries the same total whether or not it has got better. What they can
  // tell, without being told, is how many lanes they are looking at.
  //
  // The scales are set against what this corridor can actually reach, measured
  // rather than guessed. Noise is a KERBSIDE reading, roughly thirteen feet
  // from the nearest lane centre, so the comfortable end is about 64 dBA and
  // not the 55 you would want in a back garden. Corridor-wide canopy runs from
  // about 8 per cent bare to about 22 per cent with a street tree programme
  // grown out - the parcels and the roadway are in that denominator, so it
  // never reads like a forest.
  const quiet = clamp01(1 - (now.noiseDba - 64) / 16)
  const width = clamp01(1 - (street.throughLanesPerDirection - 1) / 2.5)
  const shade = clamp01((canopy - 0.08) / 0.14)
  const company = clamp01(now.modeShare.walk / 0.22)
  const streetMood = quiet * 0.28 + width * 0.24 + shade * 0.20 + company * 0.28

  return {
    year: now.year,
    peakSpeedMph: now.peakSpeedMph,
    speedChange: delta(now.peakSpeedMph, before?.peakSpeedMph),
    aadt: now.aadt,
    trafficChange: delta(now.aadt, before?.aadt),
    lanesEachWay: street.throughLanesPerDirection,
    worksUnderWay,
    worksFinished,
    noiseDba: now.noiseDba,
    canopy,
    daysOver95: now.daysOver95,
    walkShare: now.modeShare.walk,
    walkChange: delta(now.modeShare.walk, before?.modeShare.walk),
    businessesOpened: opened,
    businessesClosed: closed,
    businessCount: now.businesses,
    vacancyMood: opened > closed + 1 ? 'filling' : closed > opened + 1 ? 'emptying' : 'steady',
    newHomes,
    medianRent: now.medianRent,
    rentChange: delta(now.medianRent, before?.medianRent),
    cityShortfall: cityShortfallNow,
    shortfallChange: cityShortfallNow - cityShortfallBefore,
    debt: now.debt,
    taxChanged: state.events.some((e) => String(e.detail.instrument ?? '').startsWith('fiscal.')) ? 1 : 0,
    approval: now.approval,
    crashes: now.crashes,
    crashChange: delta(now.crashes, before?.crashes),
    fatalities: now.fatal,
    fatalityChange: delta(now.fatal, before?.fatal),
    streetMood,
    events: state.events,
    history: state.history,
  }
}

function clamp01(x: number): number { return Math.max(0, Math.min(1, x)) }
