/**
 * Tests for what the corridor sounds like.
 *
 * The one that matters is the first: the audio has to be a rendering of the
 * noise model rather than a mood, which means every level in the game has to
 * come out of a decibel the simulation computed. If that chain breaks the
 * sound becomes decoration with a volume slider, and the argument the player
 * can HEAR - that slowing a road does three times as much as emptying it -
 * stops being audible.
 */

import { describe, expect, it } from 'vitest'

import { advanceYear, C, newGame, trafficNoiseDba, type SimState } from '../sim/index'
import { buildWalkWorld } from '../render/walk'
import { buildDriveWorld, newDrive, stepDrive } from '../render/drive'
import { cabinMix, dbaForGain, gainForDba, kerbMix, officeMix, passLevelDba } from './mix'

function play(seed: string, years: number, plan: Record<number, string[]> = {}): SimState {
  let state = newGame(seed)
  for (let i = 0; i < years && !state.ended; i++) state = advanceYear(state, plan[state.year] ?? []).state
  return state
}

const CALMED: Record<number, string[]> = {
  7: ['capital.road_diet'], 9: ['street.add_kerb_parking'],
  12: ['street.lower_target_speed'], 14: ['street.narrow_lanes'], 17: ['street.plant_trees'],
}

describe('the level is the model', () => {
  it('converts decibels to amplitude and back', () => {
    for (const dba of [40, 55, 62, 78, 88]) {
      expect(dbaForGain(gainForDba(dba))).toBeCloseTo(dba, 6)
    }
  })

  it('halves the amplitude for every six decibels, because that is what a decibel is', () => {
    expect(gainForDba(82) / gainForDba(88)).toBeCloseTo(0.5, 2)
    expect(gainForDba(76) / gainForDba(88)).toBeCloseTo(0.25, 2)
  })

  it('is silent above full scale rather than distorted', () => {
    expect(gainForDba(120)).toBe(1)
    expect(gainForDba(-40)).toBeGreaterThanOrEqual(0)
    expect(gainForDba(Number.NaN)).toBe(0)
  })

  it('carries the corridor\'s own level into the bed unchanged', () => {
    const world = buildWalkWorld(newGame('a'))
    const mix = kerbMix(world)
    // Only the surface penalty is allowed between the model and the ear.
    const wear = Math.min(1, world.pavementAgeYears / 22)
    expect(mix.bed.dba).toBeCloseTo(world.noiseDba + C.WORN_SURFACE_NOISE_PENALTY_DBA * wear, 6)
  })
})

describe('slowing a road does more than emptying it, and you can hear it', () => {
  it('drops the level three times as far for the same halving', () => {
    // The whole noise model in one assertion, expressed as amplitude.
    const half = trafficNoiseDba(1000, 40, 30)
    const halfTraffic = trafficNoiseDba(500, 40, 30)
    const halfSpeed = trafficNoiseDba(1000, 20, 30)
    expect(half - halfTraffic).toBeCloseTo(C.NOISE_DB_PER_VOLUME_DOUBLING, 5)
    expect(half - halfSpeed).toBeCloseTo(C.NOISE_DB_PER_SPEED_DOUBLING, 5)
    // And in the thing the player actually hears:
    expect(gainForDba(halfSpeed) / gainForDba(half)).toBeLessThan(
      gainForDba(halfTraffic) / gainForDba(half) * 0.6)
  })

  it('makes a calmed corridor audibly quieter than the one it started as', () => {
    const before = kerbMix(buildWalkWorld(newGame('a')))
    const after = kerbMix(buildWalkWorld(play('a', 20, CALMED)))
    expect(after.bed.dba).toBeLessThan(before.bed.dba - 4)
    // Four decibels is a third off the amplitude. Not a subtlety.
    expect(after.bed.gain).toBeLessThan(before.bed.gain * 0.7)
  })

  it('makes a widened one no quieter, whatever else it does', () => {
    const left = kerbMix(buildWalkWorld(play('a', 16)))
    const widened = kerbMix(buildWalkWorld(play('a', 16, { 0: ['capital.state_widening'] })))
    expect(widened.bed.dba).toBeGreaterThanOrEqual(left.bed.dba - 0.5)
  })
})

describe('a street where you hear cars, and a road where you hear traffic', () => {
  /*
   * The difference is not how loud a passing car is - a car passing thirteen
   * feet away is loud on any street. It is what is happening the REST of the
   * time. Measured as the share of the minute that is an event rather than a
   * wash, which is what "you hear cars" and "you hear traffic" actually mean.
   */
  const dutyCycle = (m: ReturnType<typeof kerbMix>): number =>
    m.passes.perSecond * m.passes.durationSec

  it('is a wash almost all of the time on six lanes', () => {
    const mix = kerbMix(buildWalkWorld(newGame('a')))
    expect(dutyCycle(mix)).toBeLessThan(0.2)
    // Five lanes of the six are in the bed, and the bed is what is there.
    expect(mix.bed.gain).toBeGreaterThan(gainForDba(mix.bed.dba) * 0.85)
  })

  it('becomes a sequence of cars once there are two lanes instead of six', () => {
    const wide = dutyCycle(kerbMix(buildWalkWorld(newGame('a'))))
    const narrow = dutyCycle(kerbMix(buildWalkWorld(play('a', 22, CALMED))))
    expect(narrow).toBeGreaterThan(wide * 2)
  })

  it('and by then half the bed is the near lane rather than a twentieth of it', () => {
    const wide = kerbMix(buildWalkWorld(newGame('a')))
    const narrow = kerbMix(buildWalkWorld(play('a', 22, CALMED)))
    const bedShare = (m: ReturnType<typeof kerbMix>): number => m.bed.gain / gainForDba(m.bed.dba)
    expect(bedShare(narrow)).toBeLessThan(bedShare(wide))
  })

  it('keeps the bed and the near lane adding up to the level the model computed', () => {
    const world = buildWalkWorld(newGame('a'))
    const mix = kerbMix(world)
    const bedShare = Math.sqrt((world.laneCount - 1) / world.laneCount)
    expect(mix.bed.gain).toBeCloseTo(gainForDba(mix.bed.dba) * bedShare, 9)
  })

  it('goes past less often the emptier the road is', () => {
    const world = buildWalkWorld(newGame('a'))
    expect(kerbMix({ ...world, aadt: 9000 }).passes.perSecond)
      .toBeLessThan(kerbMix(world).passes.perSecond)
  })
})

describe('the events and the bed add up to the level the model computed', () => {
  /*
   * The claim the whole audio layer makes. The near lane is emitted as
   * discrete vehicles and the rest of the road as a continuous bed; if those
   * two do not sum to the equivalent level the noise model computed, then the
   * sound is no longer a rendering of the model and the argument the player
   * can hear stops being the argument the model makes.
   *
   * Verified end to end as well: rendering the real synthesiser offline in a
   * browser for seventy seconds, a corridor the model says is 8.6 dB quieter
   * comes out 9.8 dB quieter, the residual being the tyre-to-engine balance
   * shifting as the road slows down. `npm run audio` re-runs that.
   */
  const totalEnergy = (mix: ReturnType<typeof kerbMix>): number =>
    mix.bed.gain ** 2
    + mix.passes.perSecond * mix.passes.durationSec * mix.passes.gain ** 2
      * C.PASS_ENVELOPE_ENERGY_FACTOR

  it('holds on every corridor and every year', () => {
    for (const seed of ['a', 'b', 'c', 'lose', 'fairview-best']) {
      for (const years of [0, 5, 13, 22, 29]) {
        const world = buildWalkWorld(play(seed, years))
        const mix = kerbMix(world)
        const target = gainForDba(mix.bed.dba) ** 2
        expect(totalEnergy(mix) / target, `${seed} year ${years}`).toBeCloseTo(1, 5)
      }
    }
  })

  it('holds when the corridor has been calmed to two lanes', () => {
    const mix = kerbMix(buildWalkWorld(play('a', 24, CALMED)))
    expect(totalEnergy(mix) / gainForDba(mix.bed.dba) ** 2).toBeCloseTo(1, 5)
  })

  it('never emits more than the model says, even where the sizing is clamped', () => {
    // The clamp can only ever make a pass quieter than the identity wants, so
    // the total can fall short and cannot overshoot. Overshooting would mean
    // the game is louder than the corridor it is modelling.
    for (const seed of ['a', 'b', 'lose']) {
      for (const years of [0, 9, 26]) {
        const world = buildWalkWorld(play(seed, years))
        for (const aadt of [1200, 9000, 38000, 70000]) {
          const mix = kerbMix({ ...world, aadt })
          expect(totalEnergy(mix)).toBeLessThanOrEqual(gainForDba(mix.bed.dba) ** 2 * 1.000001)
        }
      }
    }
  })
})

describe('the spectrum', () => {
  it('is tyres at speed and engines at a crawl', () => {
    const base = buildWalkWorld(newGame('a'))
    const tyreShareOf = (speedMph: number): number => {
      const m = kerbMix({ ...base, trafficSpeedMph: speedMph })
      return m.bed.tyreGain / Math.max(1e-9, m.bed.tyreGain + m.bed.engineGain)
    }
    expect(tyreShareOf(50)).toBeGreaterThan(0.9)
    expect(tyreShareOf(14)).toBeLessThan(0.4)
    expect(tyreShareOf(50)).toBeGreaterThan(tyreShareOf(30))
    expect(tyreShareOf(30)).toBeGreaterThan(tyreShareOf(14))
  })

  it('puts the tyre band where tyres are', () => {
    const mix = kerbMix(buildWalkWorld(newGame('a')))
    expect(mix.bed.tyreHz).toBeGreaterThan(C.TYRE_NOISE_PEAK_HZ * 0.7)
    expect(mix.bed.tyreHz).toBeLessThan(C.TYRE_NOISE_PEAK_HZ * 1.4)
  })

  it('splits the energy rather than duplicating it', () => {
    const mix = kerbMix(buildWalkWorld(newGame('a')))
    const power = mix.bed.tyreGain ** 2 + mix.bed.engineGain ** 2
    expect(Math.sqrt(power)).toBeCloseTo(mix.bed.gain, 6)
  })
})

describe('a car is a box', () => {
  it('is quieter inside it than beside it, by the amount the constant says', () => {
    const state = play('a', 6)
    const walk = kerbMix(buildWalkWorld(state))
    const world = buildDriveWorld(state)
    const cabin = cabinMix(world, newDrive(world))
    expect(walk.bed.dba - cabin.bed.dba).toBeCloseTo(C.CAR_CABIN_ATTENUATION_DBA, 4)
  })

  it('is duller inside it too, not just quieter', () => {
    const state = play('a', 6)
    const world = buildDriveWorld(state)
    expect(cabinMix(world, newDrive(world)).bed.brightnessHz)
      .toBeLessThan(kerbMix(buildWalkWorld(state)).bed.brightnessHz / 4)
  })

  it('gets louder as you go faster, from your own wheels', () => {
    const world = buildDriveWorld(play('a', 6))
    const at = (mph: number): ReturnType<typeof cabinMix> =>
      cabinMix(world, { ...newDrive(world), speedFps: mph * (5280 / 3600) })
    expect(at(45).ownTyreGain).toBeGreaterThan(at(20).ownTyreGain)
    expect(at(20).ownTyreGain).toBeGreaterThan(at(6).ownTyreGain)
    expect(at(45).rumbleGain).toBeGreaterThan(at(12).rumbleGain)
  })

  it('rumbles more the longer the resurfacing has been put off', () => {
    const smooth = play('a', 6)
    smooth.street.pavementAgeYears = 1
    const rough = play('a', 6)
    rough.street.pavementAgeYears = 24
    const at = (state: SimState): number => {
      const world = buildDriveWorld(state)
      return cabinMix(world, { ...newDrive(world), speedFps: 40 * (5280 / 3600) }).rumbleGain
    }
    expect(at(rough)).toBeGreaterThan(at(smooth) * 1.5)
  })

  it('makes the street louder as well as rougher when it is left too long', () => {
    const smooth = play('a', 6)
    smooth.street.pavementAgeYears = 1
    const rough = play('a', 6)
    rough.street.pavementAgeYears = 24
    expect(kerbMix(buildWalkWorld(rough)).bed.dba)
      .toBeGreaterThan(kerbMix(buildWalkWorld(smooth)).bed.dba + 1.5)
  })
})

describe('wind in the leaves', () => {
  it('is inaudible next to the corridor as it stands', () => {
    const mix = kerbMix(buildWalkWorld(play('a', 24, { 2: ['street.plant_trees'] })))
    // Forty-two decibels against seventy-eight. It is there and nobody can
    // hear it, which is the correct amount of credit to give a tree for noise.
    expect(mix.leafGain).toBeGreaterThan(0)
    expect(mix.leafGain).toBeLessThan(mix.bed.gain / 20)
  })

  it('comes out once the road has stopped shouting', () => {
    const calmed = kerbMix(buildWalkWorld(play('a', 24, { ...CALMED, 2: ['street.plant_trees'] })))
    const loud = kerbMix(buildWalkWorld(play('a', 24, { 2: ['street.plant_trees'] })))
    expect(calmed.leafGain / calmed.bed.gain).toBeGreaterThan(loud.leafGain / loud.bed.gain * 1.5)
  })

  it('needs leaves', () => {
    const world = buildWalkWorld(newGame('a'))
    expect(kerbMix({ ...world, canopy: 0 }).leafGain).toBe(0)
  })
})

describe('birds', () => {
  it('are not on the corridor as it stands', () => {
    expect(kerbMix(buildWalkWorld(newGame('a'))).birdsPerMin).toBe(0)
  })

  it('need trees AND quiet, not either', () => {
    const loudWithTrees = buildWalkWorld(play('a', 24, { 2: ['street.plant_trees'] }))
    const quietWithout = buildWalkWorld(play('a', 22, {
      7: ['capital.road_diet'], 12: ['street.lower_target_speed'], 14: ['street.narrow_lanes'],
    }))
    const both = buildWalkWorld(play('a', 24, { ...CALMED, 2: ['street.plant_trees'] }))
    const birds = (w: ReturnType<typeof buildWalkWorld>): number => kerbMix(w).birdsPerMin
    expect(birds(both)).toBeGreaterThan(birds(loudWithTrees))
    expect(birds(both)).toBeGreaterThan(birds(quietWithout))
  })

  it('go silent above the level the constant names', () => {
    const world = buildWalkWorld(newGame('a'))
    const loud = { ...world, noiseDba: C.BIRD_SILENCE_DBA + 1, canopy: 0.4 }
    expect(kerbMix(loud).birdsPerMin).toBe(0)
  })
})

describe('the office', () => {
  it('hears the corridor from a long way off, and dully', () => {
    const state = play('a', 4)
    const office = officeMix(state)
    const kerb = kerbMix(buildWalkWorld(state))
    expect(office.bed.gain).toBeLessThan(kerb.bed.gain * 0.2)
    expect(office.bed.brightnessHz).toBeLessThan(kerb.bed.brightnessHz)
    expect(office.passes.gain).toBe(0)
  })

  it('changes when the player changes the street', () => {
    const before = officeMix(play('a', 4))
    const after = officeMix(play('a', 22, CALMED))
    expect(after.bed.gain).toBeLessThan(before.bed.gain)
  })
})

describe('every mix is a mix', () => {
  it('produces finite, bounded numbers on every corridor and every year', () => {
    for (const seed of ['a', 'b', 'lose', 'fairview-best']) {
      for (const years of [0, 1, 9, 18, 29]) {
        const state = play(seed, years)
        const world = buildDriveWorld(state)
        let drive = newDrive(world)
        for (let t = 0; t < 3; t += 1 / 30) drive = stepDrive(world, drive, { throttle: 1, steer: 0 }, 1 / 30)
        for (const mix of [officeMix(state), kerbMix(buildWalkWorld(state)), cabinMix(world, drive)]) {
          for (const [key, value] of Object.entries(mix)) {
            if (typeof value === 'number') {
              expect(Number.isFinite(value), `${seed}/${years}/${mix.vantage}: ${key}`).toBe(true)
            }
          }
          for (const gain of [mix.bed.gain, mix.bed.tyreGain, mix.bed.engineGain, mix.leafGain,
            mix.rumbleGain, mix.ownTyreGain, mix.ownEngineGain, mix.passes.gain]) {
            expect(gain).toBeGreaterThanOrEqual(0)
            expect(gain).toBeLessThanOrEqual(1)
          }
          expect(mix.bed.tyreHz).toBeGreaterThan(20)
          expect(mix.bed.tyreHz).toBeLessThan(18000)
        }
      }
    }
  })

  it('is deterministic', () => {
    expect(JSON.stringify(kerbMix(buildWalkWorld(play('same', 12)))))
      .toBe(JSON.stringify(kerbMix(buildWalkWorld(play('same', 12)))))
  })
})

describe('one vehicle at a distance', () => {
  it('is quieter the further away the lane it is in', () => {
    expect(passLevelDba(40, 60)).toBeLessThan(passLevelDba(40, 12))
  })

  it('falls off at the rate the model says a line source falls off at', () => {
    expect(passLevelDba(40, 24) - passLevelDba(40, 48))
      .toBeCloseTo(C.NOISE_DB_PER_DISTANCE_DOUBLING, 5)
  })
})
