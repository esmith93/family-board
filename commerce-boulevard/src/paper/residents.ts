/**
 * The people who write to the Fairview Ledger.
 *
 * A small cast, drawn from the households the simulation is actually modelling,
 * so what they write about is what is happening to them. They recur across
 * years, which is the point: the player is meant to watch one person change
 * their mind about the same street over twenty years without that person ever
 * once understanding why.
 *
 * Nobody in this file knows what a lane-mile is.
 */

import { makeRng, type SimState } from '../sim/index'

export type Voice = 'commuter' | 'retiree' | 'merchant' | 'parent' | 'renter' | 'taxpayer'

export interface Resident {
  id: string
  name: string
  street: string
  voice: Voice
  /** The household in the simulation whose life this person is living. */
  householdId: string
  /** The year they started writing in. */
  since: number
}

const STREETS = [
  'Ash Street', 'Linden Avenue', 'Pike Street', 'Cottonwood Lane', 'Delaware Avenue',
  'Ninth Street', 'Mercer Street', 'Bellingham Road', 'Quarry Road', 'Sumac Drive',
]

const NAMES: Record<Voice, string[]> = {
  retiree: ['Dale Hovanec', 'Marion Pelletier', 'Stanley Ruthven'],
  parent: ['Renata Sowerby', 'Amos Whitfield', 'Priya Ranganathan'],
  merchant: ['Curt Baumann', 'Lucille Ferraro', 'Hyun-Woo Baek'],
  renter: ['Ivy Delgado', 'Theo Marchetti', 'Nadia Okonkwo'],
  taxpayer: ['Wendell Frayne', 'Bernice Stroud', 'Gil Aranda'],
  commuter: ['Marguerite Okonjo', 'Roy Tibbetts', 'Danielle Vasquez'],
}

/** The regulars, in the order the letters page tends to reach for them. */
const ROTATION: Voice[] = ['commuter', 'retiree', 'merchant', 'parent', 'taxpayer', 'renter']

/**
 * Build the cast. Deterministic from the seed, so a given Fairview always has
 * the same people in it.
 */
export function makeCast(state: SimState): Resident[] {
  const rng = makeRng(`${state.seed}:letters`)
  const cast: Resident[] = []
  const usedStreets = new Set<string>()

  for (let i = 0; i < ROTATION.length; i++) {
    const voice = ROTATION[i]!
    const name = NAMES[voice][Math.floor(rng.next() * NAMES[voice].length)]!
    let street = STREETS[Math.floor(rng.next() * STREETS.length)]!
    let guard = 0
    while (usedStreets.has(street) && guard++ < 20) {
      street = STREETS[Math.floor(rng.next() * STREETS.length)]!
    }
    usedStreets.add(street)

    // Give each writer a household whose circumstances match their voice, so
    // the merchant is not secretly a car-free renter.
    const household = pickHousehold(state, voice, rng)
    cast.push({
      id: `resident-${i}`,
      name,
      street,
      voice,
      householdId: household,
      since: 0,
    })
  }
  return cast
}

function pickHousehold(state: SimState, voice: Voice, rng: ReturnType<typeof makeRng>): string {
  const households = state.households
  const wants = (h: (typeof households)[number]): boolean => {
    switch (voice) {
      case 'parent': return h.children > 0
      case 'renter': return h.income < 55_000 && h.vehicles <= 1
      case 'commuter': return h.vehicles >= 1 && h.depth >= 2
      case 'retiree': return h.depth <= 2
      case 'taxpayer': return h.income > 60_000
      case 'merchant': return h.depth <= 1
    }
  }
  const matches = households.filter(wants)
  const pool = matches.length > 0 ? matches : households
  return pool[Math.floor(rng.next() * pool.length)]!.id
}

/**
 * The paper's morgue: which residents have written, when, and who has given up
 * and moved away. Carried alongside the simulation rather than inside it,
 * because it is the paper's bookkeeping and not the city's.
 */
export interface PaperMemory {
  cast: Resident[]
  /** Years each resident has appeared, most recent last. */
  appearances: Record<string, number[]>
  /** Templates already used, so the paper does not repeat itself verbatim. */
  usedLetters: Record<string, number>
  usedStories: Record<string, number>
  /** Residents who left town, and the year they went. */
  departed: Record<string, number>
  /** Whether the paper has started to notice, and how long it took. */
  noticedAt: number | null
  /** Consecutive years the corridor has been a decent place to stand. */
  goodYears: number
  /** Last week's lead, which never leads again. */
  lastLead: string | null
}

export function newMemory(state: SimState): PaperMemory {
  return {
    cast: makeCast(state),
    appearances: {},
    usedLetters: {},
    usedStories: {},
    departed: {},
    noticedAt: null,
    goodYears: 0,
    lastLead: null,
  }
}

/** How the household behind a writer is actually faring, in plain terms. */
export interface Circumstance {
  /** Cars they run. */
  vehicles: number
  income: number
  children: number
  /** Rent as a share of what they earn. */
  rentBurden: number
  /** Whether they front the corridor or live back from it. */
  onCorridor: boolean
}

export function circumstanceOf(resident: Resident, state: SimState): Circumstance {
  const household = state.households.find((h) => h.id === resident.householdId)
  if (!household) {
    return { vehicles: 1, income: 60_000, children: 0, rentBurden: 0.25, onCorridor: false }
  }
  return {
    vehicles: household.vehicles,
    income: household.income,
    children: household.children,
    rentBurden: (state.medianRent * 12) / Math.max(1, household.income),
    onCorridor: household.depth <= 1,
  }
}
