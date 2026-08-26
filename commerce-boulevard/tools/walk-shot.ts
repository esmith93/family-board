/** Render walk frames headlessly and write them out, so they can be looked at. */
import { writeFileSync, mkdirSync } from 'node:fs'
import { advanceYear, newGame, type SimState } from '../src/sim/index'
import { buildWalkWorld, makeWalkFrame, newWalk, renderWalk, stepWalk } from '../src/render/walk'
import { makePalette, type LightName, type SeasonName } from '../src/render/palette'
import { makeLut32, paintIndexed } from '../src/render/bitmap'
import { encodePng } from './png'

const W = 640, H = 360
mkdirSync('shots', { recursive: true })

const PLAN: Record<number, string[]> = {
  0: ['land.reduce_parking_minimums'], 1: ['land.allow_mixed_use'], 2: ['fiscal.business_improvement_district'],
  3: ['street.plant_trees'], 4: ['land.reduce_setbacks'], 5: ['fiscal.land_value_shift'],
  6: ['land.abolish_parking_minimums'], 7: ['capital.road_diet'], 8: ['capital.repave'],
  9: ['street.add_kerb_parking'], 10: ['fiscal.price_parking'], 11: ['land.raise_height_limit'],
  12: ['street.lower_target_speed'], 13: ['fiscal.land_value_shift'], 14: ['street.narrow_lanes'],
  15: ['street.add_crossings'], 16: ['land.raise_height_limit'], 17: ['street.plant_trees'],
  18: ['capital.bulb_outs'], 19: ['fiscal.land_value_shift'], 20: ['street.landscaped_median'],
  21: ['land.form_based_code'], 22: ['capital.repave'], 23: ['street.plant_trees'],
}

function play(years: number, plan: Record<number, string[]>): SimState {
  let state = newGame('fairview-best')
  for (let i = 0; i < years && !state.ended; i++) state = advanceYear(state, plan[state.year] ?? []).state
  return state
}

function shoot(name: string, state: SimState, walkFt: number, light: LightName = 'day', season: SeasonName = 'summer') {
  const world = buildWalkWorld(state)
  let walk = newWalk(world)
  const dt = 1 / 30
  while (walk.distanceFt < walkFt) walk = stepWalk(world, walk, { along: 1, cross: false }, dt)
  const frame = makeWalkFrame(W, H)
  renderWalk(world, walk, frame, walk.elapsedSec * 1000)
  const lut = makeLut32(makePalette(light, season).lut)
  const out = new Uint32Array(W * H)
  paintIndexed(frame.pixels, lut, out)
  writeFileSync(`shots/${name}.png`, encodePng(new Uint8Array(out.buffer), W, H))
  console.log(`${name}: year ${state.year}  station ${walk.stationFt.toFixed(0)}ft  ` +
    `walked ${(walk.distanceFt / 5280).toFixed(2)}mi in ${(walk.elapsedSec / 60).toFixed(1)}min`)
}

shoot('40-walk-year0', newGame('fairview-best'), 300)
shoot('41-walk-year0-far', newGame('fairview-best'), 1400)
shoot('42-walk-widened', play(5, { 0: ['capital.state_widening'] }), 900)
shoot('43-walk-year24', play(24, PLAN), 900)
shoot('44-walk-year24-b', play(24, PLAN), 2100)
shoot('45-walk-night', play(24, PLAN), 1500, 'night')
