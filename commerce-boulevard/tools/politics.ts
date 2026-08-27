/**
 * Can the plan the tests call a win actually be paid for?
 *
 * Political capital is the binding currency, and a plan that "wins" partly by
 * not happening is a tuning bug dressed as a difficulty curve. This prints,
 * across every corridor: how many committed moves the council refuses, how
 * they end, and what the two currencies looked like on the way.
 */
import { advanceYear, instrumentById, newGame, type SimState } from '../src/sim/index'

const SEEDS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'win', 'lose', 'order', 'reckon', 'fairview-best', 'trap']

const PLANS: Record<string, Record<number, string[]>> = {
  nothing: {},
  widen: { 0: ['capital.state_widening'] },
  reference: {
    0: ['land.reduce_parking_minimums'], 1: ['land.allow_mixed_use'],
    2: ['fiscal.business_improvement_district'], 3: ['land.allow_mixed_use'],
    4: ['land.reduce_setbacks'], 5: ['fiscal.land_value_shift'],
    6: ['land.abolish_parking_minimums'], 7: ['capital.road_diet'],
    8: ['capital.repave'], 9: ['street.add_kerb_parking'],
    10: ['fiscal.price_parking'], 11: ['land.raise_height_limit'],
    12: ['street.lower_target_speed'], 13: ['fiscal.land_value_shift'],
    14: ['street.narrow_lanes'], 15: ['street.add_crossings'],
    16: ['land.raise_height_limit'], 17: ['street.plant_trees'],
    18: ['capital.bulb_outs'], 19: ['fiscal.land_value_shift'],
    21: ['land.form_based_code'], 22: ['capital.repave'],
  },
}

for (const [name, plan] of Object.entries(PLANS)) {
  let attempts = 0
  let refused = 0
  const reasons = new Map<string, number>()
  const byInstrument = new Map<string, number>()
  const endings = { fired: 0, insolvent: 0, completed: 0 }
  const finalPc: number[] = []
  const meanApproval: number[] = []

  for (const seed of SEEDS) {
    let state: SimState = newGame(seed)
    const approvals: number[] = []
    for (let y = 0; y < 30 && !state.ended; y++) {
      const chosen = plan[state.year] ?? []
      attempts += chosen.length
      const result = advanceYear(state, chosen)
      state = result.state
      approvals.push(state.politics.approval)
      for (const r of result.rejected) {
        refused++
        reasons.set(r.reason, (reasons.get(r.reason) ?? 0) + 1)
        byInstrument.set(r.instrumentId, (byInstrument.get(r.instrumentId) ?? 0) + 1)
      }
    }
    endings[state.ended?.reason ?? 'completed']++
    finalPc.push(state.politics.capital)
    meanApproval.push(approvals.reduce((a, b) => a + b, 0) / Math.max(1, approvals.length))
  }

  const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length
  console.log(`\n=== ${name} ===`)
  console.log(`  moves attempted ${attempts}, refused ${refused}`
    + (attempts > 0 ? ` (${((refused / attempts) * 100).toFixed(1)}%)` : ''))
  for (const [reason, n] of [...reasons].sort((a, b) => b[1] - a[1])) {
    console.log(`     ${n}x ${reason}`)
  }
  const worst = [...byInstrument].sort((a, b) => b[1] - a[1]).slice(0, 5)
  for (const [id, n] of worst) {
    console.log(`     ${instrumentById(id)?.label ?? id}: refused ${n}/${SEEDS.length}`)
  }
  console.log(`  endings  fired ${endings.fired}  insolvent ${endings.insolvent}`
    + `  ran the thirty ${endings.completed}   of ${SEEDS.length}`)
  console.log(`  mean approval ${mean(meanApproval).toFixed(1)}   final PC ${mean(finalPc).toFixed(1)}`)
}
