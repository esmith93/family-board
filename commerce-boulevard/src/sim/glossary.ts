/**
 * Vocabulary the player earns.
 *
 * ANTI-GOAL, enforced by a test: the words "walkable", "car-centric",
 * "stroad" and "induced demand" appear nowhere in the primary UI. They exist
 * only as cards here, and a card unlocks only after the player has personally
 * caused the thing it names.
 *
 * A skeptic who discovers induced demand by causing it converts. One who reads
 * a tooltip about it leaves.
 */

import type { SimState } from './types'

export interface GlossaryCard {
  id: string
  term: string
  /** Shown only after unlocking. Past tense: it describes what just happened. */
  body: string
  /** Evaluated after each year. */
  triggered: (state: SimState) => boolean
}

/** Two snapshots ago, for comparisons that need a trend. */
function snapshot(state: SimState, yearsAgo: number) {
  return state.history[state.history.length - 1 - yearsAgo]
}

export const GLOSSARY_CARDS: readonly GlossaryCard[] = [
  {
    id: 'induced_demand',
    term: 'Induced demand',
    body: 'You added capacity to Commerce Blvd. For a few years it was quicker. Then traffic grew until the delay came back, and the corridor now carries more vehicles at the same speed it had before - on more lane-miles that the city maintains for ever. Economists call the general case the fundamental law of road congestion: over a long enough horizon, vehicle-miles rise roughly in proportion to lane-miles.',
    triggered: (state) => {
      if (state.street.throughLanesPerDirection <= state.baseline.lanesPerDirection) return false
      const now = snapshot(state, 0)
      if (!now) return false
      // Speed back to where it started, but carrying more traffic.
      return now.peakSpeedMph <= state.baseline.peakSpeedMph * 1.04 &&
        now.aadt > C_INITIAL_AADT * 1.12
    },
  },
  {
    id: 'stroad',
    term: 'Stroad',
    body: 'Commerce Blvd is trying to be two things. A road moves vehicles between places at speed. A street is a place where people arrive, stop and spend money. This corridor does both badly: it is fast enough to be dangerous and interrupted often enough to be slow. The portmanteau is not a compliment.',
    triggered: (state) => {
      const now = snapshot(state, 0)
      if (!now) return false
      const curbCuts = state.parcels.reduce((sum, p) => sum + p.curbCuts, 0) / 1.2
      return state.street.designSpeedMph >= 40 && curbCuts >= 22 && now.crashes > 55
    },
  },
  {
    id: 'value_per_acre',
    term: 'Value per acre',
    body: 'You have been measuring the corridor in the wrong unit. Total tax revenue rewards whatever covers the most ground. Revenue per acre asks a harder question: what does this land pay for the pipes, pavement and lighting it consumes? By that measure the car parks on Commerce Blvd are the most expensive land in Fairview.',
    triggered: (state) => state.ledgerUnlocked,
  },
  {
    id: 'car_dependency',
    term: 'Car dependency',
    body: 'A household on this corridor cannot reach a grocery, a job or a clinic without a car. That is not a preference; it is a requirement the street layout imposes. The households paying most for it are the ones who can least afford a second vehicle.',
    triggered: (state) => {
      const now = snapshot(state, 0)
      if (!now) return false
      return state.year >= 6 && now.groceryWalkShare < 0.06 && now.transportCostShare > 0.22
    },
  },
  {
    id: 'walkability',
    term: 'Walkability',
    body: 'Something changed on Commerce Blvd: enough people now make enough trips on foot that the number shows up in the mode split. It was not the pavement that did it - wide pavements beside fast traffic stay empty. It was having somewhere within a quarter of a mile worth walking to.',
    triggered: (state) => {
      const now = snapshot(state, 0)
      return !!now && now.modeShare.walk >= 0.15
    },
  },
  {
    id: 'traffic_stress',
    term: 'Level of traffic stress',
    body: 'You built a bike facility and almost nobody used it. Cycling rates track how stressful the street feels, not how many miles of lane exist: most people will not ride beside 40 mph traffic with a painted line between them, and no amount of paint changes that.',
    triggered: (state) => {
      const now = snapshot(state, 0)
      if (!now) return false
      return state.street.bikeFacility !== 'none' && state.year >= 4 && now.modeShare.bike < 0.012
    },
  },
  {
    id: 'infrastructure_liability',
    term: 'Infrastructure liability',
    body: 'The pipes, pavement and lighting under Commerce Blvd carry a replacement cost that arrives on a schedule nobody set and nobody funded. It scales with how much ground has to be served, not with how much value sits on it. Fairview has been booking the assets and not the obligation.',
    triggered: (state) => {
      const now = snapshot(state, 0)
      return !!now && now.liabilityPerAcre > now.revenuePerAcre
    },
  },
  {
    id: 'parking_crater',
    term: 'Parking crater',
    body: 'More than half the land on this corridor stores empty vehicles. It pays almost no tax, generates no trips on foot, sheds every drop of rain into the storm system and reaches 140F in August. It is also, on paper, exactly what the zoning code required.',
    triggered: (state) => {
      const acres = state.parcels.reduce((sum, p) => sum + p.acres, 0)
      const stalls = state.parcels.reduce((sum, p) => sum + p.surfaceStalls, 0)
      return state.ledgerUnlocked && (stalls * 330) / 43560 / acres > 0.45
    },
  },
  {
    id: 'sequencing',
    term: 'Sequencing',
    body: 'The same instrument produced opposite results at different times. A protected lane on a corridor of car parks went unused; the same lane after the land use changed carried real traffic. Order of operations is not a detail of this work. It is most of the work.',
    triggered: (state) => {
      const now = snapshot(state, 0)
      if (!now) return false
      return state.glossary.unlocked.includes('traffic_stress') && now.modeShare.bike >= 0.03
    },
  },
]

// Imported lazily to keep the glossary free of a cycle through constants.
const C_INITIAL_AADT = 31000

/** Cards that have newly unlocked this year. */
export function checkGlossary(state: SimState): string[] {
  const unlocked: string[] = []
  for (const card of GLOSSARY_CARDS) {
    if (state.glossary.unlocked.includes(card.id)) continue
    if (card.triggered(state)) unlocked.push(card.id)
  }
  return unlocked
}

export function cardById(id: string): GlossaryCard | undefined {
  return GLOSSARY_CARDS.find((c) => c.id === id)
}
