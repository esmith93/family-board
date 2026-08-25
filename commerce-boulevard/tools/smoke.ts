import { newGame, advanceYear, C } from '../src/sim/index'
import type { SimState } from '../src/sim/index'

const money = (n: number) => (n < 0 ? '-' : '') + '$' + Math.abs(Math.round(n / 1000)).toLocaleString() + 'k'

function row(s: SimState) {
  const h = s.history[s.history.length - 1]!
  return [
    String(h.year).padStart(2),
    String(h.aadt).padStart(6),
    h.peakSpeedMph.toFixed(1).padStart(5),
    (h.modeShare.drive * 100).toFixed(1).padStart(5),
    (h.modeShare.walk * 100).toFixed(1).padStart(5),
    money(h.revenue).padStart(9),
    money(h.expenses).padStart(9),
    money(h.surplus).padStart(9),
    money(h.debt).padStart(9),
    String(h.revenuePerAcre).padStart(7),
    String(h.liabilityPerAcre).padStart(7),
    h.approval.toFixed(0).padStart(4),
    h.capital.toFixed(0).padStart(4),
    h.crashes.toFixed(0).padStart(5),
    h.noiseDba.toFixed(0).padStart(5),
  ].join(' ')
}

const header = ' yr   aadt speed  car%  wlk%   revenue  expenses   surplus      debt  rev/ac  lia/ac appr   pc crash  dBA'

function run(label: string, policy: (s: SimState) => string[]) {
  console.log('\n=== ' + label + ' ===')
  console.log(header)
  let state = newGame('fairview-smoke')
  console.log(row(state))
  for (let i = 0; i < C.RUN_LENGTH_YEARS && !state.ended; i++) {
    const result = advanceYear(state, policy(state))
    state = result.state
    if (result.rejected.length) console.log('   rejected:', result.rejected.map((r) => r.instrumentId + '(' + r.reason + ')').join(', '))
    console.log(row(state))
  }
  console.log('ended:', state.ended)
  console.log('glossary:', state.glossary.unlocked.join(', ') || '(none)')
  console.log('ledger unlocked:', state.ledgerUnlocked)
  return state
}

run('Do nothing', () => [])
run('Take the state widening', (s) => (s.year === 0 ? ['capital.state_widening'] : []))

// --- Anti-goal 4: at least two urbanist moves must be able to fail ---
run('Bike lane first, on dead land use', (s) =>
  s.year === 1 ? ['street.protected_bike_lane'] : [])

run('Transit first, at low density', (s) =>
  s.year === 1 ? ['street.increase_transit'] :
  s.year === 2 ? ['street.increase_transit'] :
  s.year === 4 ? ['street.bus_lane'] : [])

// --- Sequenced: land use first, then the street ---
run('Sequenced: zoning, then street, then bikes', (s) => {
  if (s.year === 0) return ['land.reduce_parking_minimums', 'land.allow_mixed_use']
  if (s.year === 1) return ['land.reduce_setbacks']
  if (s.year === 2) return ['land.raise_height_limit', 'land.allow_mixed_use']
  if (s.year === 3) return ['land.abolish_parking_minimums']
  if (s.year === 4) return ['fiscal.land_value_shift']
  if (s.year === 5) return ['capital.road_diet']
  if (s.year === 7) return ['street.narrow_lanes', 'street.lower_target_speed']
  if (s.year === 8) return ['street.add_crossings']
  if (s.year === 9) return ['street.plant_trees']
  if (s.year === 10) return ['land.raise_height_limit']
  if (s.year === 11) return ['street.protected_bike_lane']
  if (s.year === 13) return ['street.widen_sidewalks']
  if (s.year === 15) return ['fiscal.land_value_shift']
  if (s.year === 17) return ['street.increase_transit']
  return []
})
