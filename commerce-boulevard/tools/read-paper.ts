import { advanceYear, cityShortfall, newGame, type SimState } from '../src/sim/index'
import { observe } from '../src/paper/observation'
import { newMemory, circumstanceOf } from '../src/paper/residents'
import { composeFrontPage } from '../src/paper/paper'

const SEQUENCED: Record<number, string[]> = {
  0: ['land.reduce_parking_minimums'], 1: ['land.allow_mixed_use'],
  2: ['fiscal.business_improvement_district'], 4: ['land.reduce_setbacks'],
  5: ['fiscal.land_value_shift'], 6: ['land.abolish_parking_minimums'],
  7: ['capital.road_diet'], 8: ['capital.repave'], 9: ['street.add_kerb_parking'],
  10: ['fiscal.price_parking'], 11: ['land.raise_height_limit'],
  12: ['street.lower_target_speed'], 13: ['fiscal.land_value_shift'],
  14: ['street.narrow_lanes'], 15: ['street.add_crossings'], 16: ['land.raise_height_limit'],
  17: ['street.plant_trees'], 18: ['capital.bulb_outs'], 19: ['fiscal.land_value_shift'],
  21: ['land.form_based_code'], 22: ['capital.repave'],
}

const which = process.argv[2] ?? 'widen'
const policy = (s: SimState): string[] =>
  which === 'widen' ? (s.year === 0 ? ['capital.state_widening'] : []) : (SEQUENCED[s.year] ?? [])

let state = newGame('fairview-best')
const memory = newMemory(state)
for (let i = 0; i < 30 && !state.ended; i++) {
  const before = cityShortfall(state)
  state = advanceYear(state, policy(state)).state
  const o = observe(state, cityShortfall(state), before)
  const frozen = state
  const page = composeFrontPage(o, memory, (r) => circumstanceOf(r, frozen), 'fairview-best')
  console.log('\n' + '='.repeat(78))
  console.log(`${page.masthead.toUpperCase()}   ${page.volume}   ${page.dateline}   ${page.price}`)
  console.log(`  [mood ${o.streetMood.toFixed(2)}  ${o.peakSpeedMph.toFixed(0)}mph  ${Math.round(o.aadt/1000)}k  walk ${(o.walkShare*100).toFixed(0)}%  ${o.noiseDba.toFixed(0)}dB  canopy ${(o.canopy*100).toFixed(0)}%]`)
  console.log('-'.repeat(78))
  console.log(`## ${page.lead.headline}`)
  if (page.lead.subhead) console.log(`   ${page.lead.subhead}`)
  if (page.photo) console.log(`   [photo @${page.photo.at.toFixed(2)}] ${page.photo.caption}`)
  for (const s of page.seconds) console.log(` # ${s.headline}${s.subhead ? ' -- ' + s.subhead : ''}`)
  for (const b of page.briefs) console.log(` . ${b.headline}`)
  if (page.letter) console.log(`   LETTER: "${page.letter.text}"\n           -- ${page.letter.signature}`)
  if (page.turned) console.log('   *** THE PAPER HAS NOTICED ***')
}
console.log('\nended:', JSON.stringify(state.ended), 'noticedAt:', memory.noticedAt)
