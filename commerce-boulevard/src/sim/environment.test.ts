/**
 * Noise, air and heat. The noise asymmetry is the argument the player can
 * hear, so the model must get it exactly right.
 */
import { describe, expect, it } from 'vitest'
import { C } from './constants'
import { newGame } from './step'
import { canopyFraction, stepEnvironment, trafficNoiseDba, imperviousFraction } from './environment'

describe('traffic noise', () => {
  it('rises 3 dB when volume doubles', () => {
    const quiet = trafficNoiseDba(1000, 35, 50)
    const loud = trafficNoiseDba(2000, 35, 50)
    expect(loud - quiet).toBeCloseTo(3.0, 1)
  })

  it('rises 9 dB when speed doubles', () => {
    const slow = trafficNoiseDba(2000, 20, 50)
    const fast = trafficNoiseDba(2000, 40, 50)
    expect(fast - slow).toBeCloseTo(9.0, 1)
  })

  it('makes speed worth three times as much as volume', () => {
    // The whole point: slowing a road down does far more than emptying it.
    const halvingVolume = trafficNoiseDba(2000, 40, 50) - trafficNoiseDba(1000, 40, 50)
    const halvingSpeed = trafficNoiseDba(2000, 40, 50) - trafficNoiseDba(2000, 20, 50)
    expect(halvingSpeed / halvingVolume).toBeCloseTo(3.0, 1)
  })

  it('falls 3 dB per doubling of distance, as a line source does', () => {
    expect(trafficNoiseDba(2000, 35, 50) - trafficNoiseDba(2000, 35, 100)).toBeCloseTo(3.0, 1)
  })

  it('lands on a realistic kerbside level for a six-lane arterial', () => {
    const state = newGame('noise')
    expect(state.environment.sidewalkNoiseDba).toBeGreaterThan(68)
    expect(state.environment.sidewalkNoiseDba).toBeLessThan(82)
  })

  it('starts the corridor well above the WHO annoyance threshold', () => {
    const state = newGame('noise')
    expect(state.environment.sidewalkNoiseDba).toBeGreaterThan(C.NOISE_ANNOYANCE_THRESHOLD)
    expect(state.environment.sidewalkNoiseDba).toBeGreaterThan(C.NOISE_CARDIOVASCULAR_THRESHOLD)
  })

  it('does not flatter street trees acoustically', () => {
    expect(C.NOISE_VEGETATION_ATTENUATION).toBeLessThanOrEqual(3)
  })
})

describe('heat', () => {
  const state = newGame('heat')

  it('keeps surface temperature and air temperature apart', () => {
    // These are different quantities by roughly a factor of six, and the two
    // are constantly conflated in popular writing about urban heat.
    expect(state.environment.surfaceTempExcessF).toBeGreaterThan(30)
    expect(state.environment.airTempExcessF).toBeLessThan(12)
    expect(state.environment.surfaceTempExcessF / state.environment.airTempExcessF).toBeGreaterThan(4)
  })

  it('reports an air temperature excess inside the defensible range', () => {
    expect(state.environment.airTempExcessF).toBeGreaterThan(0)
    expect(state.environment.airTempExcessF).toBeLessThanOrEqual(C.AIR_TEMP_UHI_MAX_F)
  })

  it('cools measurably as canopy arrives, and not by very much', () => {
    const shaded = structuredClone(state)
    for (const parcel of shaded.parcels) parcel.canopy = 0.5
    shaded.street.treesPerMilePerSide = 80
    const after = stepEnvironment(shaded.street, shaded.parcels, shaded.traffic, 0)

    expect(after.canopyFraction).toBeGreaterThan(state.environment.canopyFraction)
    expect(after.airTempExcessF).toBeLessThan(state.environment.airTempExcessF)
    // Air cooling from canopy is real and small.
    const cooling = state.environment.airTempExcessF - after.airTempExcessF
    expect(cooling).toBeLessThan(C.AIR_TEMP_CANOPY_COOLING_MAX_F * 2)
    // Surface cooling is the large effect.
    expect(state.environment.surfaceTempExcessF - after.surfaceTempExcessF).toBeGreaterThan(cooling)
  })

  it('counts a corridor that is more than half car park as mostly impervious', () => {
    expect(imperviousFraction(state.parcels, state.street)).toBeGreaterThan(0.6)
    expect(canopyFraction(state.parcels, state.street)).toBeLessThan(0.25)
  })

  it('adds hot days for local heat on top of a trend the player does not control', () => {
    const later = stepEnvironment(state.street, state.parcels, state.traffic, 30)
    expect(later.daysOver95).toBeGreaterThan(state.environment.daysOver95)
  })
})

describe('air quality', () => {
  const state = newGame('air')

  it('does not overstate the near-road PM2.5 gradient', () => {
    // Several reviews find little or no near-road PM2.5 gradient at all. The
    // model keeps the increment modest on purpose.
    expect(state.environment.pm25Increment).toBeLessThan(C.PM25_REGIONAL_BACKGROUND * 0.45)
  })

  it('keeps the NO2 gradient larger than the PM2.5 one, as measured', () => {
    const pmRelative = state.environment.pm25Increment / C.PM25_REGIONAL_BACKGROUND
    const noRelative = state.environment.no2Increment / C.NO2_REGIONAL_BACKGROUND
    expect(noRelative).toBeGreaterThan(pmRelative)
  })

  it('rises in stop-and-go conditions', () => {
    const jammed = structuredClone(state)
    jammed.traffic.volumeCapacityRatio = 1
    const after = stepEnvironment(jammed.street, jammed.parcels, jammed.traffic, 0)
    expect(after.pm25Increment).toBeGreaterThan(state.environment.pm25Increment)
  })
})
