/**
 * When each word is earned.
 *
 * A card that unlocks on a run where the player did nothing is a card the game
 * gave away. This prints the unlock year of every card under three plans, over
 * a spread of corridors, so the question can be settled with a table instead of
 * an opinion.
 */
import { advanceYear, GLOSSARY_CARDS, newGame } from '../src/sim/index'

const SEEDS = ['fairview', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l']

const PLANS: Record<string, Record<number, string[]>> = {
  nothing: {},
  widen: { 0: ['capital.state_widening'] },
  // Anti-goal 4: a protected lane on a corridor of car parks must be able
  // to fail, and the player must be able to find out that it did.
  earlybike: { 1: ['street.protected_bike_lane'] },
  sequenced: {
    0: ['land.reduce_parking_minimums'], 1: ['land.allow_mixed_use'],
    2: ['fiscal.business_improvement_district'], 3: ['street.plant_trees'],
    4: ['land.reduce_setbacks'], 5: ['fiscal.land_value_shift'],
    6: ['land.abolish_parking_minimums'], 7: ['capital.road_diet'],
    8: ['capital.repave'], 10: ['street.narrow_lanes'], 12: ['street.protected_bike_lane'],
    14: ['capital.bulb_outs'], 16: ['street.crossings_every_400'], 18: ['capital.daylighting'],
  },
}

const rows: Record<string, Record<string, (number | null)[]>> = {}
for (const card of GLOSSARY_CARDS) rows[card.id] = { nothing: [], widen: [], earlybike: [], sequenced: [] }

for (const [name, plan] of Object.entries(PLANS)) {
  for (const seed of SEEDS) {
    let state = newGame(`${seed}`)
    const at: Record<string, number> = {}
    for (let y = 0; y < 30 && !state.ended; y++) {
      state = advanceYear(state, plan[state.year] ?? []).state
      for (const id of state.glossary.unlocked) at[id] ??= state.year
    }
    for (const card of GLOSSARY_CARDS) rows[card.id]![name]!.push(at[card.id] ?? null)
  }
}

const stat = (list: (number | null)[]): string => {
  const got = list.filter((v): v is number => v !== null).sort((a, b) => a - b)
  if (got.length === 0) return '     never'
  const median = got[Math.floor(got.length / 2)]!
  return `${String(got.length).padStart(2)}/${list.length} y${String(median).padStart(2)} [${got[0]}-${got[got.length - 1]}]`
}

console.log(`${'card'.padEnd(26)} ${'DID NOTHING'.padEnd(18)} ${'TOOK THE WIDENING'.padEnd(18)} ${'BIKE LANE AT YEAR 1'.padEnd(18)} SEQUENCED`)
for (const card of GLOSSARY_CARDS) {
  const r = rows[card.id]!
  console.log(`${card.id.padEnd(26)} ${stat(r.nothing!).padEnd(18)} ${stat(r.widen!).padEnd(18)} `
    + `${stat(r.earlybike!).padEnd(18)} ${stat(r.sequenced!)}`)
}
