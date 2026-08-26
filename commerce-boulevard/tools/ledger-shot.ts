/** Render the Ledger View headlessly, so it can be looked at. */
import { writeFileSync, mkdirSync } from 'node:fs'
import { advanceYear, newGame, type SimState } from '../src/sim/index'
import { buildLedgerScene, ledgerSummary } from '../src/render/ledger'
import { valueColumn } from '../src/render/sprites/ledger'
import { applyPalette } from '../src/render/bitmap'
import { makePalette } from '../src/render/palette'
import { encodePng } from './png'

mkdirSync('shots', { recursive: true })
const SEQ: Record<number, string[]> = {
  0: ['land.reduce_parking_minimums'], 1: ['land.allow_mixed_use'], 4: ['land.reduce_setbacks'],
  6: ['land.abolish_parking_minimums'], 7: ['capital.road_diet'], 8: ['capital.repave'],
  11: ['land.raise_height_limit'], 16: ['land.raise_height_limit'], 21: ['land.form_based_code'],
}
const play = (plan: Record<number, string[]>, years: number): SimState => {
  let s = newGame('fairview-best')
  for (let i = 0; i < years && !s.ended; i++) s = advanceYear(s, plan[s.year] ?? []).state
  return s
}
// One column, big, so the drawing can be checked.
const lut = makePalette('day', 'summer').lut
for (const [name, spec] of [
  ['pays', { footprintW: 4, footprintD: 3, revenuePx: 190, liabilityPx: 90, exempt: false }],
  ['short', { footprintW: 4, footprintD: 3, revenuePx: 40, liabilityPx: 150, exempt: false }],
  ['exempt', { footprintW: 4, footprintD: 3, revenuePx: 20, liabilityPx: 0, exempt: true }],
] as const) {
  const sprite = valueColumn(spec)
  writeFileSync(`shots/60-column-${name}.png`,
    encodePng(new Uint8Array(applyPalette(sprite.bmp, lut).buffer), sprite.bmp.width, sprite.bmp.height))
  console.log(`${name}: ${sprite.bmp.width}x${sprite.bmp.height}`)
}
for (const [name, years, plan] of [['y16-nothing', 16, {}], ['y26-sequenced', 26, SEQ]] as const) {
  const s = play(plan, years)
  const scene = buildLedgerScene(s)
  const sum = ledgerSummary(s)
  console.log(`${name}: ${scene.ledger!.length} columns, corridor $${Math.round(sum.revenuePerAcre).toLocaleString()}/ac vs $${Math.round(sum.liabilityPerAcre).toLocaleString()}/ac, ratio ${sum.ratio.toFixed(2)}, ${sum.payingParcels}/${sum.taxableParcels} pay`)
}
