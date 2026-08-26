/** Render drive frames headlessly and write them out, so they can be looked at. */
import { writeFileSync, mkdirSync } from 'node:fs'
import { advanceYear, newGame, type SimState } from '../src/sim/index'
import { buildDriveWorld, makeDriveFrame, newDrive, renderDrive, stepDrive } from '../src/render/drive'
import { makePalette, type LightName, type SeasonName } from '../src/render/palette'
import { makeLut32, paintIndexed } from '../src/render/bitmap'
import { encodePng } from './png'

const W = 480, H = 270
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

function shoot(
  name: string, state: SimState, driveSec: number,
  light: LightName = 'day', season: SeasonName = 'summer', untilStationFt = Infinity,
) {
  const world = buildDriveWorld(state)
  let drive = newDrive(world)
  const dt = 1 / 30
  for (let t = 0; t < driveSec && drive.stationFt < untilStationFt; t += dt) {
    drive = stepDrive(world, drive, { throttle: 1, steer: 0 }, dt)
  }
  const frame = makeDriveFrame(W, H)
  renderDrive(world, drive, frame, driveSec * 1000)
  const lut = makeLut32(makePalette(light, season).lut)
  const out = new Uint32Array(W * H)
  paintIndexed(frame.pixels, lut, out)
  writeFileSync(`shots/${name}.png`, encodePng(new Uint8Array(out.buffer), W, H))
  const mph = (drive.speedFps / (5280 / 3600)).toFixed(0)
  console.log(`${name}: year ${state.year}  ${drive.stationFt.toFixed(0)}ft  ${mph}mph  ` +
    `stopped ${drive.stoppedSec.toFixed(1)}s  conflicts ${drive.conflicts}  ${drive.ended ?? 'driving'}`)
}

const arg = process.argv[2] ?? 'all'
if (arg === 'all') {
  shoot('30-drive-year0', newGame('fairview-best'), 8)
  shoot('31-drive-year0-far', newGame('fairview-best'), 26)
  shoot('32-drive-widened', play(4, { 0: ['capital.state_widening'] }), 14)
  shoot('33-drive-year24', play(24, PLAN), 14)
  shoot('34-drive-night', play(24, PLAN), 22, 'night')
  shoot('35-drive-autumn', play(24, PLAN), 30, 'dusk', 'autumn')
  // Right up on the first junction, where the signal is big enough to read.
  const junction0 = 6336 / 5 / 2
  shoot('36-drive-signal', newGame('fairview-best'), 60, 'day', 'summer', junction0 - 210)
  shoot('37-drive-signal-late', play(24, PLAN), 60, 'day', 'summer', junction0 - 150)
}
