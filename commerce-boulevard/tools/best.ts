import { newGame, advanceYear, C, availableInstruments } from '../src/sim/index'
import type { SimState } from '../src/sim/index'
const money = (n: number) => (n < 0 ? '-' : '') + '$' + Math.abs(Math.round(n / 1000)).toLocaleString() + 'k'

const PLAN: Record<number, string[]> = {
  0: ['land.reduce_parking_minimums'],
  1: ['land.allow_mixed_use'],
  2: ['fiscal.business_improvement_district'],
  3: ['land.allow_mixed_use'],
  4: ['land.reduce_setbacks'],
  5: ['fiscal.land_value_shift'],
  6: ['land.abolish_parking_minimums'],
  7: ['capital.road_diet'],
  9: ['street.add_kerb_parking'],
  10: ['fiscal.price_parking'],
  11: ['land.raise_height_limit'],
  12: ['street.lower_target_speed'],
  13: ['fiscal.land_value_shift'],
  14: ['street.narrow_lanes'],
  15: ['street.add_crossings'],
  16: ['land.raise_height_limit'],
  17: ['street.plant_trees'],
  18: ['capital.bulb_outs'],
  19: ['fiscal.land_value_shift'],
  20: ['street.widen_sidewalks'],
  21: ['land.form_based_code'],
  23: ['street.protected_bike_lane'],
  25: ['street.increase_transit'],
  27: ['street.increase_transit'],
}

let s: SimState = newGame('fairview-best')
const header = ' yr   aadt speed  car%  wlk%   revenue  expenses   surplus      debt  rev/ac  lia/ac appr   pc  pop  jobs rent'
console.log(header)
const show = (st: SimState) => {
  const h = st.history[st.history.length - 1]!
  console.log([String(h.year).padStart(2), String(h.aadt).padStart(6), h.peakSpeedMph.toFixed(1).padStart(5),
    (h.modeShare.drive * 100).toFixed(1).padStart(5), (h.modeShare.walk * 100).toFixed(1).padStart(5),
    money(h.revenue).padStart(9), money(h.expenses).padStart(9), money(h.surplus).padStart(9),
    money(h.debt).padStart(9), String(h.revenuePerAcre).padStart(7), String(h.liabilityPerAcre).padStart(7),
    h.approval.toFixed(0).padStart(4), h.capital.toFixed(0).padStart(4),
    String(h.population).padStart(5), String(h.jobs).padStart(5), String(h.medianRent).padStart(5)].join(' '))
}
show(s)
for (let i = 0; i < C.RUN_LENGTH_YEARS && !s.ended; i++) {
  const want = PLAN[s.year] ?? []
  const r = advanceYear(s, want)
  s = r.state
  if (r.rejected.length) console.log('   rejected:', r.rejected.map(x => x.instrumentId).join(', '))
  show(s)
}
console.log('ended:', s.ended)
console.log('glossary:', s.glossary.unlocked.join(', '))
const last = s.history[s.history.length - 1]!
console.log('grocery walk share', (last.groceryWalkShare * 100).toFixed(1) + '%', '| child walk', (last.childWalkShare * 100).toFixed(1) + '%',
  '| transport cost share', (last.transportCostShare * 100).toFixed(1) + '%', '| left', last.residentsLeft)
console.log('available instruments at end:', availableInstruments(s).length)
