/**
 * Crashes, and who they happen to.
 *
 * Two separate questions the model keeps apart: how OFTEN something goes
 * wrong, which is mostly about conflict points and exposure, and how BADLY it
 * goes wrong when it does, which is almost entirely about speed. A corridor
 * can get safer on the first measure and worse on the second, and usually the
 * newspaper only notices the first.
 */

import { C } from './constants'
import { levelOfTrafficStress } from './environment'
import { crossingDistanceFt, curbCutsPerMile, SIGNALS_ON_CORRIDOR } from './traffic'
import type { ModeShare, Parcel, SafetyState, StreetState, TrafficState } from './types'

/**
 * Probability that a struck pedestrian dies, as a function of impact speed.
 * A logistic curve fitted to Tefft (2011): 10% at 23 mph, 50% at 42 mph,
 * 90% at 58 mph.
 */
export function pedestrianFatalityRisk(impactSpeedMph: number): number {
  const logOdds = C.PED_FATALITY_LOGIT_INTERCEPT + C.PED_FATALITY_LOGIT_SLOPE * impactSpeedMph
  return 1 / (1 + Math.exp(-logOdds))
}

/**
 * The multiplier on crash frequency from everything the player has built.
 * Each factor is a crash modification factor: below 1 means fewer crashes.
 */
export function crashModificationFactor(
  street: StreetState, parcels: readonly Parcel[], operatingSpeed: number, baselineLanes: number,
): number {
  let cmf = 1

  // Lane width. The Johns Hopkins finding, with its own speed condition
  // honoured: below about 26 mph, width stops mattering.
  if (operatingSpeed >= C.LANE_WIDTH_EFFECT_MIN_SPEED_MPH) {
    cmf *= 1 + C.CRASH_RATE_LANE_WIDTH_PER_FOOT * (street.laneWidthFt - 10)
  }

  // Lane reduction. One step is the published four-to-three conversion; more
  // than one step is extrapolation, so the effect is floored at the low end of
  // the published range rather than compounded indefinitely.
  const lanesRemoved = baselineLanes - street.throughLanesPerDirection
  if (lanesRemoved > 0) {
    cmf *= Math.max(0.53, C.CMF_ROAD_DIET ** lanesRemoved)
  } else if (lanesRemoved < 0) {
    cmf *= (1 / C.CMF_ROAD_DIET) ** Math.min(2, -lanesRemoved)
  }

  if (street.median === 'raised' || street.median === 'landscaped') cmf *= C.CMF_RAISED_MEDIAN

  if (street.roundabouts.length > 0) {
    const share = Math.min(1, street.roundabouts.length / SIGNALS_ON_CORRIDOR)
    cmf *= 1 - share * (1 - C.CMF_ROUNDABOUT)
  }

  // Every driveway is a place where one car crosses everyone else's path.
  cmf *= 1 + C.CRASH_RATE_PER_CURB_CUT * curbCutsPerMile(parcels)

  return Math.max(0.2, cmf)
}

/** How the severity split shifts with speed. */
export function severitySplit(operatingSpeed: number): {
  fatal: number; serious: number; minor: number; pdo: number
} {
  const scale = (operatingSpeed / C.SEVERITY_REFERENCE_SPEED_MPH) ** C.CRASH_SEVERITY_SPEED_EXPONENT
  const fatal = Math.min(0.08, C.BASE_SEVERITY_FATAL * scale)
  const serious = Math.min(0.3, C.BASE_SEVERITY_SERIOUS * scale)
  const minor = Math.min(0.6, C.BASE_SEVERITY_MINOR * Math.sqrt(scale))
  const pdo = Math.max(0.05, 1 - fatal - serious - minor)
  const total = fatal + serious + minor + pdo
  return { fatal: fatal / total, serious: serious / total, minor: minor / total, pdo: pdo / total }
}

export interface SafetyInputs {
  street: StreetState
  parcels: readonly Parcel[]
  traffic: TrafficState
  modeShare: ModeShare
  operatingSpeed: number
  /** Person-trips per year that touch the corridor. */
  personTripsPerYear: number
  /** Lanes per direction at year 0, the denominator for the road diet factor. */
  baselineLanes: number
}

export function stepSafety(inputs: SafetyInputs): SafetyState {
  const { street, parcels, traffic, modeShare, operatingSpeed, personTripsPerYear, baselineLanes } = inputs

  // --- Vehicle crashes: exposure times design ---
  const millionVmt = traffic.corridorVmt / 1_000_000
  const cmf = crashModificationFactor(street, parcels, operatingSpeed, baselineLanes)
  const vehicleCrashes = millionVmt * C.BASE_CRASH_RATE_PER_MVMT * cmf

  const split = severitySplit(operatingSpeed)

  // --- Pedestrian crashes: crossings times risk per crossing ---
  const walkTrips = personTripsPerYear * modeShare.walk
  // Roughly half of walking trips need to get across the boulevard.
  const crossings = walkTrips * 0.5

  const crossingFt = crossingDistanceFt(street)
  let crossingRisk = C.PED_CRASH_RISK_PER_CROSSING * (crossingFt / 44)

  // When legal crossings are far apart, people cross where they are.
  const midblockShare = Math.max(0, Math.min(0.8, (street.crossingSpacingFt - 300) / 1200))
  crossingRisk *= 1 + midblockShare * (C.MIDBLOCK_CROSSING_RISK_MULTIPLIER - 1)

  if (street.bulbOuts) crossingRisk *= C.CMF_BULB_OUTS
  if (street.daylighting) crossingRisk *= C.CMF_DAYLIGHTING
  if (street.median === 'raised' || street.median === 'landscaped') crossingRisk *= C.CMF_RAISED_MEDIAN

  const pedestrianCrashes = crossings * crossingRisk
  const pedestrianFatal = pedestrianCrashes * pedestrianFatalityRisk(operatingSpeed)

  // --- Bicycle crashes: miles ridden times risk per mile ---
  const lts = levelOfTrafficStress(street, operatingSpeed)
  const bikeTrips = personTripsPerYear * modeShare.bike
  const bikeMiles = bikeTrips * 1.1
  let bikeRisk = C.BIKE_CRASH_RISK_PER_MILE * (1 + (lts - 1) * 0.55)
  if (street.bikeFacility === 'protected') bikeRisk *= C.CMF_PROTECTED_BIKE_LANE
  const bicycleCrashes = bikeMiles * bikeRisk
  const bicycleFatal = bicycleCrashes * pedestrianFatalityRisk(operatingSpeed) * 0.75

  // Vulnerable-user crashes are counted inside the total, not on top of it.
  const crashes = vehicleCrashes + pedestrianCrashes + bicycleCrashes
  const fatal = vehicleCrashes * split.fatal + pedestrianFatal + bicycleFatal
  const seriousInjury = vehicleCrashes * split.serious +
    (pedestrianCrashes - pedestrianFatal) * 0.42 + (bicycleCrashes - bicycleFatal) * 0.32
  const minorInjury = vehicleCrashes * split.minor +
    (pedestrianCrashes - pedestrianFatal) * 0.5 + (bicycleCrashes - bicycleFatal) * 0.6
  const propertyDamageOnly = vehicleCrashes * split.pdo

  const societalCost =
    fatal * C.VALUE_OF_STATISTICAL_LIFE +
    seriousInjury * C.COST_SERIOUS_INJURY +
    minorInjury * C.COST_MINOR_INJURY +
    propertyDamageOnly * C.COST_PDO_CRASH

  return {
    crashes: round2(crashes),
    fatal: round3(fatal),
    seriousInjury: round2(seriousInjury),
    minorInjury: round2(minorInjury),
    propertyDamageOnly: round2(propertyDamageOnly),
    pedestrianCrashes: round2(pedestrianCrashes),
    pedestrianFatal: round3(pedestrianFatal),
    bicycleCrashes: round2(bicycleCrashes),
    bicycleFatal: round3(bicycleFatal),
    societalCost: Math.round(societalCost),
  }
}

function round2(x: number): number { return Math.round(x * 100) / 100 }
function round3(x: number): number { return Math.round(x * 1000) / 1000 }
