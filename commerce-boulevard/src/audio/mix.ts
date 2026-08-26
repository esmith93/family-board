/**
 * What the corridor sounds like, as numbers.
 *
 * This module decides nothing about synthesis and knows nothing about Web
 * Audio. It answers one question - given the state of the street and where the
 * player is standing, what levels and what frequencies - and it answers it in
 * decibels and hertz, which is what the noise model already speaks.
 *
 * That separation is the point. The noise model says a corridor is 78 dBA at
 * the kerb and 62 dBA after a road diet; a mix built from it is sixteen
 * decibels quieter, which is a quarter of the loudness, and the player hears
 * the model rather than a designer's opinion of it.
 *
 * Pure, deterministic, and unit-tested without a browser.
 */

import {
  C, distanceToNearestLaneFt, operatingSpeedMph, trafficNoiseDba, type SimState,
} from '../sim/index'
import type { DriveState, DriveWorld } from '../render/drive'
import type { WalkState, WalkWorld } from '../render/walk'

/** Where the player is listening from. */
export type Vantage = 'office' | 'kerb' | 'cabin'

/** The continuous part: a stream of traffic, which is not a stream of cars. */
export interface Bed {
  /** Overall linear amplitude, 0 to 1. */
  gain: number
  /** The level this gain came from, kept so a test can check the chain. */
  dba: number
  /** Centre of the tyre band, and its share of the energy. */
  tyreHz: number
  tyreGain: number
  /** The engine rumble underneath it. */
  engineHz: number
  engineGain: number
  /** Everything above this is gone: a closed window, or two hundred feet. */
  brightnessHz: number
}

/**
 * One vehicle going past, as an event rather than as part of a wash.
 *
 * The vehicles in the lane nearest your feet are events; everything further
 * out is the bed. That is not a stylistic choice, it is what a Leq is - the
 * sum of the things too far away or too close together to pick apart - and it
 * is why a two-lane street sounds like cars and a six-lane road sounds like
 * traffic without either of them being drawn differently.
 */
export interface Passes {
  perSecond: number
  gain: number
  /** How fast the thing going past is going, which sets its brightness. */
  speedMph: number
  /** Feet to the nearest running lane. */
  distanceFt: number
  /** How long each one lasts, which the synthesiser and the sizing both need. */
  durationSec: number
}

export interface Mix {
  vantage: Vantage
  bed: Bed
  passes: Passes
  /** Calls a minute. Zero on a loud street, and that is not a mood. */
  birdsPerMin: number
  /** Wind in leaves, which needs leaves. */
  leafGain: number
  /** The road surface through the seat, which needs a road surface. */
  rumbleGain: number
  rumbleHz: number
  /** Your own vehicle, in the cabin. Zero everywhere else. */
  ownTyreGain: number
  ownEngineGain: number
  ownEngineHz: number
}

/**
 * Level to amplitude.
 *
 * The whole reason the audio is worth building: everything downstream is one
 * exponential away from a decibel the model computed, so nothing in the mix
 * can drift from what the simulation says without the test noticing.
 */
export function gainForDba(dba: number): number {
  if (!Number.isFinite(dba)) return 0
  return Math.max(0, Math.min(1, 10 ** ((dba - C.AUDIO_FULL_SCALE_DBA) / 20)))
}

/** Amplitude back to a level, for tests and for the "why this number" panel. */
export function dbaForGain(gain: number): number {
  return C.AUDIO_FULL_SCALE_DBA + 20 * Math.log10(Math.max(1e-6, gain))
}

/**
 * How much of a traffic stream is tyres and how much is engines.
 *
 * Below about twelve miles an hour a car is its engine; by fifty it is its
 * tyres and almost nothing else. Split by power rather than by amplitude,
 * because two half-power sources are not half as loud each.
 */
function tyreShare(speedMph: number): number {
  return Math.max(0, Math.min(1, (speedMph - 11) / 34))
}

/**
 * The shape of one vehicle going past, as amplitude against progress 0 to 1.
 *
 * Not a spike. A pass-by follows the distance law: as the vehicle goes from
 * far to abeam to far again, the level traces 1/sqrt(1 + (vt/d)^2), which is
 * a broad hump with long shoulders. The first version of this used two
 * exponential ramps, which sound like a whip crack and carry six per cent of
 * the energy of the real thing - so a corridor whose Leq was mostly near-lane
 * passes came out far too quiet.
 */
export function passEnvelope(progress: number): number {
  const t = (Math.max(0, Math.min(1, progress)) - 0.45) * 4.4
  return 1 / Math.sqrt(1 + t * t)
}

/** How long one vehicle is worth listening to, in seconds. */
export function passDurationSec(speedMph: number, distanceFt: number): number {
  const fps = Math.max(6, speedMph) * (5280 / 3600)
  return Math.max(0.3, Math.min(2.6, (Math.max(6, distanceFt) * 2.6) / fps))
}

/**
 * Size a pass so the events and the bed together come to the level the model
 * computed, and no more.
 *
 * The near lane is responsible for one lane's share of the corridor's acoustic
 * energy. Spread that share over the rate the vehicles actually arrive at and
 * the length of time each is audible, allow for the shape of the envelope, and
 * out comes the peak amplitude. Nothing is chosen: it is the only peak that
 * makes the total add up.
 */
function passGainFor(fullGain: number, lanes: number, perSecond: number, durationSec: number): number {
  const share = (fullGain * fullGain) / lanes
  const dutyEnergy = perSecond * durationSec * C.PASS_ENVELOPE_ENERGY_FACTOR
  if (dutyEnergy <= 0) return 0
  return Math.max(0, Math.min(1, Math.sqrt(share / dutyEnergy)))
}

/**
 * Wind in the leaves, as a level rather than as a fader.
 *
 * Which is the point: at forty-two decibels it is thirty-six below the
 * corridor at year zero, so it is inaudible there and no amount of planting
 * changes that. It appears when the road stops shouting, and only then.
 */
function leafGainFor(canopy: number): number {
  const share = Math.max(0, Math.min(1, canopy / 0.22))
  if (share <= 0) return 0
  return gainForDba(C.LEAF_RUSTLE_DBA - 8 * (1 - share))
}

/** Below this, birds. Above it, no birds, and no amount of trees changes that. */
function birdsFor(canopy: number, dba: number): number {
  const shade = Math.max(0, Math.min(1, canopy / 0.22))
  const quiet = Math.max(0, Math.min(1, (C.BIRD_SILENCE_DBA - dba) / 14))
  return C.BIRD_CALLS_PER_MIN_AT_FULL_CANOPY * shade * quiet
}

function bedFor(dba: number, speedMph: number, brightnessHz: number): Bed {
  const gain = gainForDba(dba)
  const share = tyreShare(speedMph)
  // The peak is set by resonances and moves little; the balance around it does.
  const shift = C.TYRE_PEAK_HZ_PER_SPEED_DOUBLING ** (Math.log2(Math.max(6, speedMph) / 30))
  return {
    gain,
    dba,
    tyreHz: C.TYRE_NOISE_PEAK_HZ * shift,
    tyreGain: gain * Math.sqrt(share),
    engineHz: C.ENGINE_FIRING_HZ_AT_CRUISE * Math.max(0.55, Math.min(1.6, speedMph / 30)),
    engineGain: gain * Math.sqrt(1 - share),
    brightnessHz,
  }
}

/** Peak-hour flow across every running lane, vehicles a second. */
function peakFlowPerSec(aadt: number): number {
  return (aadt * C.PEAK_HOUR_SHARE_OF_AADT) / 3600
}

/**
 * Standing at the kerb.
 *
 * The loudest place in the game, and the one the model already has a number
 * for. A ravelled surface adds a couple of decibels to it, which is the same
 * deferred resurfacing that shakes the car.
 */
export function kerbMix(world: WalkWorld, walk?: WalkState): Mix {
  const wear = Math.min(1, world.pavementAgeYears / 22)
  const dba = world.noiseDba + C.WORN_SURFACE_NOISE_PENALTY_DBA * wear
  const speed = world.trafficSpeedMph
  const lanes = Math.max(1, world.laneCount)

  // The near lane is the events; the rest of the road is the bed. Split by
  // energy, so the two together are still the level the model computed.
  const bedShare = Math.sqrt(Math.max(0, lanes - 1) / lanes)
  const full = bedFor(dba, speed, 9000)
  const bed: Bed = {
    ...full,
    gain: full.gain * bedShare,
    tyreGain: full.tyreGain * bedShare,
    engineGain: full.engineGain * bedShare,
  }

  const crossing = walk?.phase === 'crossing'
  // Out in it, the nearest lane is the one you are standing in.
  const nearest = crossing ? 8 : world.nearestLaneFt
  const flow = peakFlowPerSec(world.aadt)
  const perSecond = flow / lanes
  const durationSec = passDurationSec(speed, nearest)

  return {
    vantage: 'kerb',
    bed,
    passes: {
      perSecond,
      gain: passGainFor(full.gain, lanes, perSecond, durationSec),
      speedMph: speed,
      distanceFt: nearest,
      durationSec,
    },
    birdsPerMin: birdsFor(world.canopy, dba),
    leafGain: leafGainFor(world.canopy),
    rumbleGain: 0,
    rumbleHz: 0,
    ownTyreGain: 0,
    ownEngineGain: 0,
    ownEngineHz: 0,
  }
}

/**
 * Sitting in the car.
 *
 * A car is a box that takes about twenty-four decibels off everything outside
 * it and replaces them with two things of its own: the surface under the
 * wheels and the engine in front of them. Which is why a corridor can be
 * unbearable to stand beside and perfectly pleasant to drive, and why nobody
 * who only ever drives it finds out.
 */
export function cabinMix(world: DriveWorld, drive: DriveState): Mix {
  const wear = Math.min(1, world.pavementAgeYears / 22)
  const outsideDba = world.kerbNoiseDba + C.WORN_SURFACE_NOISE_PENALTY_DBA * wear
  const insideDba = outsideDba - C.CAR_CABIN_ATTENUATION_DBA
  // A closed cabin is a low-pass filter before it is an attenuator.
  const lanes = Math.max(1, world.laneCount)
  const bed = bedFor(insideDba, world.runningSpeedMph, 900)
  const closingMph = world.runningSpeedMph * 2
  const cabinPassSec = passDurationSec(closingMph, 24)
  const cabinPassesPerSec = Math.min(2.4, peakFlowPerSec(world.aadt) / lanes)

  const ownSpeed = drive.speedFps / (5280 / 3600)
  const share = tyreShare(ownSpeed)
  // Your own wheels and engine, which are two feet away and not attenuated.
  const ownDba = 52 + C.NOISE_DB_PER_SPEED_DOUBLING * Math.log2(Math.max(5, ownSpeed) / 30)
  const own = gainForDba(ownDba)

  return {
    vantage: 'cabin',
    bed,
    passes: {
      // Oncoming traffic still registers, muffled, as it goes by. You meet it
      // at the sum of the two speeds, which is why it is a snap and not a
      // swell.
      perSecond: cabinPassesPerSec,
      gain: passGainFor(gainForDba(insideDba), lanes, cabinPassesPerSec, cabinPassSec),
      speedMph: world.runningSpeedMph + ownSpeed,
      distanceFt: 24,
      durationSec: cabinPassSec,
    },
    birdsPerMin: 0,
    leafGain: 0,
    // The surface, through the seat. Deferred resurfacing you can hear.
    rumbleGain: own * (0.35 + 0.9 * wear) * Math.min(1, ownSpeed / 25),
    rumbleHz: 34 + Math.min(70, ownSpeed * 1.4),
    ownTyreGain: own * Math.sqrt(share),
    ownEngineGain: own * Math.sqrt(1 - share) * (drive.speedFps < 2 ? 0.55 : 1),
    ownEngineHz: C.ENGINE_FIRING_HZ_AT_CRUISE * Math.max(0.4, Math.min(1.9, ownSpeed / 28)),
  }
}

/**
 * At the desk, looking at the map.
 *
 * The corridor is still out there. It is a mile away through a window, which
 * is most of a room's worth of attenuation and nearly all of its brightness,
 * and it is the only thing in the office that changes when the player does
 * something.
 */
export function officeMix(state: SimState): Mix {
  const dba = state.environment.setbackNoiseDba - C.CAR_CABIN_ATTENUATION_DBA * 0.9
  const speed = operatingSpeedMph(state.street, state.parcels)
  const bed = bedFor(dba, speed, 480)
  return {
    vantage: 'office',
    bed,
    passes: { perSecond: 0, gain: 0, speedMph: speed, distanceFt: 400, durationSec: 1 },
    birdsPerMin: birdsFor(state.environment.canopyFraction, dba + 18) * 0.4,
    leafGain: 0,
    rumbleGain: 0,
    rumbleHz: 0,
    ownTyreGain: 0,
    ownEngineGain: 0,
    ownEngineHz: 0,
  }
}

/**
 * The exposure level of one vehicle going past, at a distance, in dBA.
 *
 * Out of the same stream formula as everything else. Three thousand six
 * hundred an hour is one a second, so the equivalent level of that stream is
 * the exposure level of a single event - the ten-log-of-the-count term is
 * exactly zero - and no separate model is needed for a single car.
 */
export function passLevelDba(speedMph: number, distanceFt: number): number {
  return trafficNoiseDba(3600, speedMph, distanceFt)
}

/** Feet from the pavement to the middle of the nearest running lane. */
export function nearestLaneFt(state: SimState): number {
  return distanceToNearestLaneFt(state.street)
}
