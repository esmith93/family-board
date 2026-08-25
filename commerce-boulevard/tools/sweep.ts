import { newGame, advanceYear, C } from '../src/sim/index'
import type { SimState } from '../src/sim/index'
const SEQ: Record<number, string[]> = {
  0:['land.reduce_parking_minimums'],1:['land.allow_mixed_use'],2:['fiscal.business_improvement_district'],
  3:['land.allow_mixed_use'],4:['land.reduce_setbacks'],5:['fiscal.land_value_shift'],
  6:['land.abolish_parking_minimums'],7:['capital.road_diet'],9:['street.add_kerb_parking'],
  10:['fiscal.price_parking'],11:['land.raise_height_limit'],12:['street.lower_target_speed'],
  13:['fiscal.land_value_shift'],14:['street.narrow_lanes'],15:['street.add_crossings'],
  16:['land.raise_height_limit'],17:['street.plant_trees'],18:['capital.bulb_outs'],
  19:['fiscal.land_value_shift'],21:['land.form_based_code'],
}
const SEQ_MAINTAINED: Record<number, string[]> = { ...SEQ, 8: ['capital.repave'], 22: ['capital.repave'] }
const play = (seed: string, plan: (y: number) => string[]) => {
  let s: SimState = newGame(seed)
  for (let i = 0; i < C.RUN_LENGTH_YEARS && !s.ended; i++) s = advanceYear(s, plan(s.year)).state
  return s
}
const seeds = ['a','b','c','d','e','f','g','h','win','lose','order','reckon','fairview-best']
console.log('seed          | nothing        | widen          | sequenced                    | start rev/ac')
for (const seed of seeds) {
  const n = play(seed, () => [])
  const w = play(seed, y => y === 0 ? ['capital.state_widening'] : [])
  const q = play(seed, y => SEQ_MAINTAINED[y] ?? [])
  const f = (s: SimState) => `${(s.ended?.reason ?? 'running').padEnd(9)}@${String(s.ended?.year ?? 30).padStart(2)}`
  const last = q.history.at(-1)!
  console.log(seed.padEnd(13), '|', f(n), '|', f(w), '|', f(q),
    'rev/ac', String(last.revenuePerAcre).padStart(6), 'walk', (last.modeShare.walk*100).toFixed(0)+'%',
    'groc', (last.groceryWalkShare*100).toFixed(0)+'%', '|', String(newGame(seed).fiscal.revenuePerAcre).padStart(5))
}
