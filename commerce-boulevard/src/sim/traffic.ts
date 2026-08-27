/**
 * Capacity, speed, and the way traffic grows back.
 *
 * The central mechanic: corridor traffic is split into LOCAL trips, which the
 * land use generates, and THROUGH trips, which the corridor attracts from the
 * rest of the network. Widening does very little to local trips and a great
 * deal to through trips - and it does it slowly, over five to ten years, which
 * is exactly long enough for the widening to look like a success first.
 */

import { C } from './constants'
import { SEGMENT_LENGTH_FT } from './corridor'
import { profileFor } from './landuse'
import type { ModeShare, Parcel, StreetState, TrafficState } from './types'

/** Signalised intersections on the corridor. */
export const SIGNALS_ON_CORRIDOR = 5


export function laneMiles(street: StreetState): number {
  const lengthMiles = C.CORRIDOR_LENGTH_FT / 5280
  const through = street.throughLanesPerDirection * 2
  const turnLane = street.median === 'twltl' ? 1 : 0
  const bus = street.busLane ? 2 : 0
  // A protected bike lane is a lane the city maintains, and the model charges
  // for it. It is cheaper per mile than a traffic lane but it is not free.
  const bike = street.bikeFacility === 'protected' || street.bikeFacility === 'buffered' ? 2 * 0.4 : 0
  const plazaFraction = street.plazaSegments.length / C.CORRIDOR_SEGMENTS
  return lengthMiles * (through + turnLane + bus + bike) * (1 - plazaFraction)
}

/**
 * The speed drivers actually choose, which is not the speed on the sign.
 *
 * Wide lanes and many of them read as permission. Kerbside friction - parked
 * cars, trees, buildings close to the pavement, narrow crossings - reads as a
 * reason to slow down. A city can post 25 on a road built for 50 and get 45.
 */
export function operatingSpeedMph(street: StreetState, parcels: readonly Parcel[]): number {
  let speed = street.designSpeedMph

  // Geometry that invites speed.
  speed += (street.laneWidthFt - 10) * 1.15
  speed += Math.max(0, street.throughLanesPerDirection - 1) * 1.1
  if (street.median === 'twltl') speed += 1.0

  // Friction that discourages it.
  if (street.onStreetParking !== 'none') speed -= 3.2
  if (street.bulbOuts) speed -= 1.6
  if (street.bikeFacility === 'protected') speed -= 1.2
  if (street.median === 'landscaped') speed -= 1.4
  speed -= Math.min(2.6, street.treesPerMilePerSide / 45)
  speed -= Math.min(2.2, (1320 - Math.min(1320, street.crossingSpacingFt)) / 500)

  // Buildings held close to the pavement narrow the visual field.
  const frontage = parcels.filter((p) => p.depth === 0)
  const enclosure = frontage.length > 0
    ? frontage.reduce((sum, p) => sum + profileFor(p.use).frontageQuality * p.acres, 0) /
      frontage.reduce((sum, p) => sum + p.acres, 0)
    : 0
  speed -= enclosure * 4.5

  // Drivers will not crawl on an open road, and will not fly on a closed one.
  return Math.max(12, Math.min(58, speed))
}

/** Effective green for the arterial through movement, as a share of the cycle. */
export function effectiveGreenRatio(street: StreetState): number {
  const phases = street.signalPolicy === 'pedestrian_priority' ? 5 : 4
  const lostTime = 4 * phases
  const usable = Math.max(0.2, (street.signalCycleSec - lostTime) / street.signalCycleSec)
  const arterialShare =
    street.signalPolicy === 'vehicle_progression' ? 0.62 :
    street.signalPolicy === 'balanced' ? 0.55 : 0.47
  return usable * arterialShare
}

/** Through-lane capacity in the peak direction, vehicles per hour. */
export function corridorCapacity(street: StreetState, disruption = 0): number {
  // Narrow lanes carry slightly less. The HCM width adjustment, roughly.
  const widthFactor = 1 + (street.laneWidthFt - 12) / 33
  const greenRatio = effectiveGreenRatio(street)
  const perLane = C.SATURATION_FLOW_RATE * greenRatio * widthFactor
  let capacity = perLane * street.throughLanesPerDirection

  // A roundabout removes the signal's lost time but tops out lower.
  if (street.roundabouts.length > 0) {
    const share = street.roundabouts.length / SIGNALS_ON_CORRIDOR
    const roundaboutCapacity = Math.min(1050 * street.throughLanesPerDirection, capacity * 1.25)
    capacity = capacity * (1 - share) + roundaboutCapacity * share
  }

  // A plaza in the middle of the corridor severs it. At either end it does not.
  if (seversCorridor(street)) capacity *= 0.12

  return Math.max(150, capacity * (1 - disruption))
}

/**
 * Whether the plaza conversions cut the corridor in two.
 *
 * A plaza at the west or east end takes one block out of a route that still
 * works. A plaza in the middle takes away the route. Same instrument, same
 * cost, opposite outcome - which is the sequencing lesson in miniature.
 */
export function seversCorridor(street: StreetState): boolean {
  return street.plazaSegments.some((s) => s > 0 && s < C.CORRIDOR_SEGMENTS - 1)
}

/**
 * Average control delay per signalised intersection, seconds.
 * Webster's uniform delay plus an incremental term for oversaturation.
 */
export function signalDelaySeconds(street: StreetState, volumeCapacityRatio: number): number {
  const g = effectiveGreenRatio(street)
  const cycle = street.signalCycleSec
  const x = Math.min(1.25, volumeCapacityRatio)
  const uniform = (0.5 * cycle * (1 - g) ** 2) / Math.max(0.05, 1 - Math.min(1, x) * g)
  // Oversaturation adds delay steeply, but a real queue spills into side
  // streets and re-routes rather than growing without limit. An arterial in
  // failure crawls at 8-12 mph; it does not stop.
  const incremental = x > 0.85 ? 700 * (x - 0.85) ** 2 : 0
  return Math.min(115, uniform + incremental)
}

/** Peak-hour running speed over the whole corridor, mph. */
export function corridorSpeed(
  street: StreetState, parcels: readonly Parcel[], volumeCapacityRatio: number,
): number {
  const freeFlow = operatingSpeedMph(street, parcels)
  const lengthMiles = C.CORRIDOR_LENGTH_FT / 5280
  const runningMinutes = (lengthMiles / freeFlow) * 60

  const activeSignals = SIGNALS_ON_CORRIDOR - street.roundabouts.length
  const signalMinutes = (activeSignals * signalDelaySeconds(street, volumeCapacityRatio)) / 60
  // A roundabout still costs a few seconds of yield delay.
  const roundaboutMinutes = (street.roundabouts.length * 7) / 60

  const totalMinutes = runningMinutes + signalMinutes + roundaboutMinutes
  // The floor is what the comment above says an arterial in failure does. It
  // was 7, below the bottom of the range the model itself states, and it was
  // binding: five signals at the 115-second cap is nine and a half minutes of
  // control delay over 1.2 miles, so the year a lane came out the corridor
  // read 7 mph and then recovered to 15, and the transient was worth a
  // hundred and thirty approval points on its own.
  return Math.max(9, (lengthMiles / totalMinutes) * 60)
}

/** Person-trips per day that begin or end on the corridor. */
export function localTripGeneration(parcels: readonly Parcel[]): number {
  let trips = 0
  for (const parcel of parcels) {
    const profile = profileFor(parcel.use)
    // ITE-style rates, coarsened: trips per dwelling and per 1,000 sqft.
    trips += parcel.dwellings * 7.5
    const nonResidentialKsf = (parcel.floorArea / 1000) * (1 - (profile.dwellingsPerAcre > 0 ? 0.55 : 0))
    trips += nonResidentialKsf * profile.retailShare * 34
    trips += nonResidentialKsf * (1 - profile.retailShare) * profile.jobsPerKsf * 3.2
  }
  return trips
}

export interface TrafficInputs {
  street: StreetState
  parcels: readonly Parcel[]
  modeShare: ModeShare
  /** Capacity lost to works this year, 0..1. */
  disruption: number
  /** Lane-miles the corridor had at year 0, the denominator of the elasticity. */
  baselineLaneMiles: number
  /** Local vehicle trips at year 0, for scaling. */
  baselineLocalTrips: number
  /** Peak speed at year 0, the denominator of the travel-time elasticity. */
  baselinePeakSpeedMph: number
}

/**
 * One year of traffic.
 *
 * Through traffic chases an equilibrium set by capacity; it does not jump to
 * it. That lag is the whole trap: the widening genuinely works for years
 * before the road fills back up.
 */
export function stepTraffic(previous: TrafficState, inputs: TrafficInputs): TrafficState {
  const {
    street, parcels, modeShare, disruption, baselineLaneMiles, baselineLocalTrips, baselinePeakSpeedMph,
  } = inputs

  const regionalIndex = previous.regionalIndex * (1 + C.REGIONAL_GROWTH_RATE)

  // --- Local traffic: what the land use generates, filtered by mode share ---
  const personTrips = localTripGeneration(parcels)
  const localVehicleTrips = (personTrips * modeShare.drive) / C.VEHICLE_OCCUPANCY
  const localScale = baselineLocalTrips > 0 ? localVehicleTrips / baselineLocalTrips : 1
  const baselineLocal = C.INITIAL_AADT * (1 - C.INITIAL_THROUGH_SHARE)
  const localAadt = baselineLocal * localScale

  // --- Through traffic: what the capacity attracts ---
  const laneMileRatio = baselineLaneMiles > 0 ? laneMiles(street) / baselineLaneMiles : 1
  const baselineThrough = C.INITIAL_AADT * C.INITIAL_THROUGH_SHARE
  let latentThrough = baselineThrough * regionalIndex * laneMileRatio ** C.VMT_LANE_MILE_ELASTICITY

  // Induced demand runs both ways. A corridor that gets slower sheds through
  // traffic to other routes, other times and other trips - the evaporation
  // that road diets rely on and that capacity-only models never show. Uses
  // last year's speed, because drivers learn a route is bad by driving it.
  if (baselinePeakSpeedMph > 0 && previous.peakSpeedMph > 0) {
    const travelTimeRatio = Math.max(0.5, Math.min(4, baselinePeakSpeedMph / previous.peakSpeedMph))
    latentThrough *= travelTimeRatio ** C.VMT_TRAVEL_TIME_ELASTICITY
  }

  // Severing the corridor sends through traffic somewhere else, permanently.
  if (seversCorridor(street)) latentThrough *= 0.15

  const previousThrough = Math.max(0, previous.aadt - baselineLocal * localScale)
  const through = previousThrough + (latentThrough - previousThrough) * C.INDUCED_DEMAND_ADJUSTMENT_RATE

  const aadt = Math.max(500, localAadt + through)
  const latentAadt = localAadt + latentThrough

  // --- Level of service ---
  const capacity = corridorCapacity(street, disruption)
  const peakVolume = aadt * C.PEAK_HOUR_FACTOR_K * C.DIRECTIONAL_SPLIT_D
  const volumeCapacityRatio = peakVolume / capacity

  const peakSpeedMph = corridorSpeed(street, parcels, volumeCapacityRatio)
  const offPeakSpeedMph = corridorSpeed(street, parcels, volumeCapacityRatio * 0.55)

  const corridorVmt = aadt * C.AVERAGE_TRIP_LENGTH_ON_CORRIDOR_MI * 365

  return {
    aadt,
    latentAadt,
    peakSpeedMph,
    offPeakSpeedMph,
    volumeCapacityRatio,
    corridorVmt,
    regionalIndex,
  }
}

/** Minutes to drive the length of the corridor at the peak. */
export function corridorDriveMinutes(traffic: TrafficState): number {
  const lengthMiles = C.CORRIDOR_LENGTH_FT / 5280
  return (lengthMiles / Math.max(1, traffic.peakSpeedMph)) * 60
}

/** Feet a pedestrian must cross to get from one side to the other. */
export function crossingDistanceFt(street: StreetState): number {
  const through = street.throughLanesPerDirection * 2 * street.laneWidthFt
  const turnLane = street.median === 'twltl' ? street.laneWidthFt : 0
  const raised = street.median === 'raised' || street.median === 'landscaped' ? 8 : 0
  const parking = street.onStreetParking === 'none' ? 0 : 16
  const bike = street.bikeFacility === 'protected' ? 14 : street.bikeFacility === 'buffered' ? 10 : 0
  const bus = street.busLane ? 2 * street.laneWidthFt : 0
  const total = through + turnLane + raised + parking + bike + bus
  // Kerb extensions take the parking lane out of the crossing.
  return street.bulbOuts ? total - parking : total
}

/** Driveways per mile onto the boulevard. Every one is a conflict point. */
export function curbCutsPerMile(parcels: readonly Parcel[]): number {
  const total = parcels.reduce((sum, p) => sum + p.curbCuts, 0)
  return total / (C.CORRIDOR_LENGTH_FT / 5280)
}

/** Which segment a station falls in, for capital projects. */
export function segmentIndex(station: number): number {
  return Math.floor(station / SEGMENT_LENGTH_FT)
}
