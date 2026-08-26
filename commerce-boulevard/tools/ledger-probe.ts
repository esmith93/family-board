import { advanceYear, newGame } from '../src/sim/index'
const DEV: Record<number, string[]> = {
  0: ['land.reduce_parking_minimums'], 1: ['land.allow_mixed_use'], 2: ['fiscal.business_improvement_district'],
  3: ['street.plant_trees'], 4: ['land.reduce_setbacks'], 5: ['fiscal.land_value_shift'],
  6: ['land.abolish_parking_minimums'], 7: ['capital.road_diet'], 8: ['capital.repave'],
}
for (const [name, plan] of [['nothing', {}], ['widen', { 0: ['capital.state_widening'] }], ['dev', DEV]] as [string, Record<number,string[]>][]) {
  let s = newGame('fairview-best'); let year = -1
  for (let i = 0; i < 30 && !s.ended; i++) {
    s = advanceYear(s, plan[s.year] ?? []).state
    if (s.ledgerUnlocked && year < 0) year = s.year
  }
  console.log(`${name.padEnd(8)} ledger unlocks year ${year < 0 ? 'never' : year}, run ends ${s.ended?.reason ?? '-'} y${s.year}`)
}
