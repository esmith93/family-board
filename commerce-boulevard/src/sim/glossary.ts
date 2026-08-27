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

/**
 * Did the player build any of these, and how long ago?
 *
 * The load-bearing question in this file. A trigger written against the state
 * of the corridor describes the corridor the player was HANDED as readily as
 * the one they made: the boulevard is six lanes at 45 mph with eighty curb
 * cuts a mile on the day they arrive, so a condition like "fast, wide and
 * dangerous" is true before they have done anything at all, and firing on it
 * hands over the vocabulary the spec says has to be earned.
 */
function builtAny(state: SimState, ids: readonly string[]): number | null {
  let earliest: number | null = null
  for (const id of ids) {
    const year = state.completed[id]
    if (year !== undefined && (earliest === null || year < earliest)) earliest = year
  }
  return earliest
}

/** Everything that adds capacity, which is what induced demand answers. */
const CAPACITY = ['capital.state_widening', 'capital.add_lane'] as const

/** Everything that makes the corridor more of a road and less of a street. */
const MADE_IT_MORE_OF_A_ROAD = [
  'capital.state_widening', 'capital.add_lane',
  'street.raise_target_speed', 'street.widen_lanes',
] as const

/** Everything a player might reasonably expect to bring people out on foot. */
const FOR_WALKING = [
  'street.widen_sidewalks', 'street.plant_trees', 'street.add_crossings',
  'street.narrow_lanes', 'street.lower_target_speed', 'street.landscaped_median',
  'street.pedestrian_lighting', 'street.signal_pedestrian_priority',
  'capital.bulb_outs', 'capital.daylighting', 'capital.road_diet',
  'capital.plaza_end', 'capital.plaza_middle', 'capital.roundabout',
  'land.allow_mixed_use', 'land.reduce_setbacks', 'land.reduce_parking_minimums',
  'land.abolish_parking_minimums', 'land.form_based_code', 'land.raise_height_limit',
  'land.increase_lot_coverage', 'land.legalise_adu', 'land.reduce_min_lot_size',
] as const

const BIKE = ['street.protected_bike_lane', 'street.painted_bike_lane'] as const

/**
 * Nothing that names the car-centric choice as a mistake may arrive before this.
 *
 * The brief protects years one to eight: the widening has to genuinely work,
 * approval up and congestion down, or the game is a lecture. A vocabulary card
 * explaining what the player has just done to themselves is the lecture, and
 * it does not stop being one because the arithmetic underneath it is sound.
 * Nine is the first year the game is allowed an opinion.
 */
const FIRST_YEAR_THE_GAME_MAY_COMMENT = 9

export const GLOSSARY_CARDS: readonly GlossaryCard[] = [
  {
    id: 'induced_demand',
    term: 'Induced demand',
    body: 'You added capacity to Commerce Blvd. For a few years it was quicker. Then traffic grew until the delay came back, and the corridor now carries more vehicles at the same speed it had before - on more lane-miles that the city maintains for ever. Economists call the general case the fundamental law of road congestion: over a long enough horizon, vehicle-miles rise roughly in proportion to lane-miles.',
    triggered: (state) => {
      const opened = builtAny(state, CAPACITY)
      if (opened === null) return false
      const now = snapshot(state, 0)
      if (!now) return false

      /*
       * The card is about an ARC, and an arc takes years.
       *
       * It used to fire in the year the widening opened, which is the single
       * worst year to name it: the player has just been handed the win the
       * brief promises them for years one to eight, and the game leans over
       * and explains the trick before it has been played. The road has to have
       * been genuinely quicker, and then have given it back, before the word
       * means anything.
       */
      if (state.year < FIRST_YEAR_THE_GAME_MAY_COMMENT) return false
      const since = state.history.filter((h) => h.year >= opened)
      const best = since.reduce((top, h) => Math.max(top, h.peakSpeedMph), 0)
      if (best < state.baseline.peakSpeedMph * 1.03) return false
      const bestAt = since.find((h) => h.peakSpeedMph >= best - 0.001)?.year ?? state.year
      if (state.year - bestAt < 5) return false
      const thenAadt = since.find((h) => h.year === bestAt)?.aadt ?? now.aadt
      return now.peakSpeedMph <= best * 0.99 && now.aadt > thenAadt * 1.06
    },
  },
  {
    id: 'stroad',
    term: 'Stroad',
    body: 'Commerce Blvd is trying to be two things. A road moves vehicles between places at speed. A street is a place where people arrive, stop and spend money. This corridor does both badly: it is fast enough to be dangerous and interrupted often enough to be slow. The portmanteau is not a compliment.',
    triggered: (state) => {
      const now = snapshot(state, 0)
      if (!now) return false

      /*
       * Commerce Boulevard is a stroad on the day the player walks in, and
       * that is not their doing. The trigger used to describe exactly that
       * corridor - fast, wide, cut to ribbons by driveways - so it fired at
       * the end of year one on every seed and every plan including doing
       * nothing, which is the game handing over the word rather than the
       * player earning it. What a player CAN cause is more of one.
       */
      const built = builtAny(state, MADE_IT_MORE_OF_A_ROAD)
      if (built === null) return false
      // And not while the win is still landing. The brief protects years one
      // to eight for the car-centric choice; handing the player a card whose
      // last line is "the portmanteau is not a compliment" in year three, for
      // the one move the game steered them into, is the lecture it forbids.
      if (state.year - built < 6) return false
      if (state.year < FIRST_YEAR_THE_GAME_MAY_COMMENT) return false
      return state.street.designSpeedMph >= 40
        && now.crashes > state.baseline.crashes * 1.15
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
      // Written against absolute thresholds this never fired once in thirty
      // years on any plan, because the corridor does not start anywhere near
      // them. Against the baseline it says what it is supposed to say: the
      // player made it harder to live here without a car than they found it.
      if (state.year < 6) return false
      if (builtAny(state, MADE_IT_MORE_OF_A_ROAD) === null) return false
      return now.groceryWalkShare <= state.baseline.walkShare * 0.5
        || (now.transportCostShare >= state.history[0]!.transportCostShare
          && now.modeShare.drive >= state.history[0]!.modeShare.drive)
    },
  },
  {
    id: 'walkability',
    term: 'Walkability',
    body: 'Something changed on Commerce Blvd: enough people now make enough trips on foot that the number shows up in the mode split. It was not the pavement that did it - wide pavements beside fast traffic stay empty. It was having somewhere within a quarter of a mile worth walking to.',
    triggered: (state) => {
      const now = snapshot(state, 0)
      if (!now) return false
      /*
       * A flat threshold of fifteen per cent fired at year six of a run where
       * the player did nothing at all, on every seed, and the card's own text
       * congratulates them for a change that never happened. It has to be a
       * delta, and it has to be one they bought.
       */
      const built = builtAny(state, FOR_WALKING)
      if (built === null || state.year - built < 3) return false
      return now.modeShare.walk >= state.baseline.walkShare + 0.06
    },
  },
  {
    id: 'traffic_stress',
    term: 'Level of traffic stress',
    body: 'You built a bike facility and almost nobody used it. Cycling rates track how stressful the street feels, not how many miles of lane exist: most people will not ride beside 40 mph traffic with a painted line between them, and no amount of paint changes that.',
    triggered: (state) => {
      const now = snapshot(state, 0)
      if (!now) return false
      /*
       * One of the two moves the brief says must be able to fail. It failed in
       * the model and the card never appeared, because the threshold was a
       * bike share so low that a lane on a dead corridor still cleared it.
       * The measure of failure is not the level, it is the level against what
       * the lane cost and against a corridor that could have used it.
       */
      const built = builtAny(state, BIKE)
      if (built === null || state.year - built < 4) return false
      const stalls = state.parcels.reduce((sum, p) => sum + p.surfaceStalls, 0)
      const acres = state.parcels.reduce((sum, p) => sum + p.acres, 0)
      const stillMostlyParking = (stalls * 330) / 43560 / acres > 0.44
      return stillMostlyParking && now.modeShare.bike < 0.03
    },
  },
  {
    id: 'infrastructure_liability',
    term: 'Infrastructure liability',
    body: 'The pipes, pavement and lighting under Commerce Blvd carry a replacement cost that arrives on a schedule nobody set and nobody funded. It scales with how much ground has to be served, not with how much value sits on it. Fairview has been booking the assets and not the obligation.',
    triggered: (state) => {
      const now = snapshot(state, 0)
      if (!now) return false
      // The ratio has to have got worse than the one on the desk on day one.
      // Otherwise this is a card about the corridor the player was handed.
      const wasCovered = state.baseline.revenuePerAcre / Math.max(1, state.baseline.liabilityPerAcre)
      const isCovered = now.revenuePerAcre / Math.max(1, now.liabilityPerAcre)
      return isCovered < 1 && isCovered < wasCovered * 0.9
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
      return state.glossary.unlocked.includes('traffic_stress') && now.modeShare.bike >= 0.022
    },
  },
]

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
