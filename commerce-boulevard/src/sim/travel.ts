/**
 * How people get around, and what they can reach.
 *
 * Mode share is never set by the player. It falls out of four things: how far
 * the destinations are, how unpleasant each mode feels, what parking costs,
 * and whether the household owns a car at all. Land use decides the first,
 * street design decides the second, and the player controls both - but only
 * indirectly, and only slowly.
 */

import { C } from './constants'
import { profileFor } from './landuse'
import { BLOCK_DEPTH_FT } from './corridor'
import { levelOfTrafficStress, streetHostility } from './environment'
import { crossingDistanceFt, operatingSpeedMph } from './traffic'
import type {
  Destination, DestinationKind, EnvironmentState, Household, Mode, ModeShare,
  Parcel, ReachabilityRecord, StreetState, TrafficState,
} from './types'
import { DESTINATION_KINDS, MODES } from './types'

/** How often a household makes each kind of trip, as a share of all trips. */
export const TRIP_PURPOSE_WEIGHTS: Readonly<Record<DestinationKind, number>> = Object.freeze({
  work: 0.16,
  grocery: 0.34,
  school: 0.09,
  park: 0.07,
  friend: 0.28,
  clinic: 0.06,
})

/** Bus stop spacing along the corridor, feet. */
const BUS_STOP_SPACING_FT = 1000

export interface TravelContext {
  street: StreetState
  parcels: readonly Parcel[]
  environment: EnvironmentState
  traffic: TrafficState
  operatingSpeed: number
  hostility: number
  lts: number
  destinations: readonly Destination[]
}

export function makeTravelContext(
  street: StreetState, parcels: readonly Parcel[], environment: EnvironmentState, traffic: TrafficState,
): TravelContext {
  const operatingSpeed = operatingSpeedMph(street, parcels)
  return {
    street,
    parcels,
    environment,
    traffic,
    operatingSpeed,
    hostility: streetHostility(street, environment, operatingSpeed, parcels),
    lts: levelOfTrafficStress(street, operatingSpeed),
    destinations: deriveDestinations(parcels, street),
  }
}

/**
 * What is actually out there to walk to.
 *
 * Destinations are read off the land use each year, which is why a corridor of
 * car parks scores zero on reachability no matter how good its pavements are.
 */
export function deriveDestinations(parcels: readonly Parcel[], street: StreetState): Destination[] {
  const destinations: Destination[] = []

  for (const parcel of parcels) {
    const offset = parcelOffsetFt(parcel)
    for (const business of parcel.businesses) {
      if (business.kind === 'grocery') {
        destinations.push({ kind: 'grocery', station: parcel.station, side: parcel.side, offset, offCorridor: false })
      } else if (business.kind === 'clinic' || business.kind === 'pharmacy') {
        destinations.push({ kind: 'clinic', station: parcel.station, side: parcel.side, offset, offCorridor: false })
      }
    }
    if (parcel.use === 'civic') {
      destinations.push({ kind: 'school', station: parcel.station, side: parcel.side, offset, offCorridor: false })
    }
    if (parcel.use === 'park' || parcel.use === 'plaza') {
      destinations.push({ kind: 'park', station: parcel.station, side: parcel.side, offset, offCorridor: false })
    }
  }

  // The rest of Fairview. These exist whatever the player does, and for most
  // households at year zero they are the only options.
  const mid = C.CORRIDOR_LENGTH_FT / 2
  destinations.push({ kind: 'clinic', station: mid, side: 'south', offset: 2.6 * 5280, offCorridor: true })
  destinations.push({ kind: 'park', station: mid, side: 'north', offset: 1.8 * 5280, offCorridor: true })
  destinations.push({ kind: 'grocery', station: mid, side: 'south', offset: 1.6 * 5280, offCorridor: true })
  destinations.push({ kind: 'school', station: mid, side: 'north', offset: 1.4 * 5280, offCorridor: true })

  // Households whose corridor has nothing on it still have neighbours.
  void street
  return destinations
}

function parcelOffsetFt(parcel: Parcel): number {
  // Distance from the boulevard to the parcel, plus the walk across whatever
  // sits between the pavement and the door.
  const base = parcel.depth === 0 ? 60 : 300
  return base + profileFor(parcel.use).entranceSetbackFt
}

export function householdOffsetFt(household: Household): number {
  if (household.depth === 0) return 125
  if (household.depth === 1) return 325
  return 325 + (household.depth - 1) * BLOCK_DEPTH_FT
}

interface Leg {
  /** Distance along the corridor, feet. */
  along: number
  /** Distance perpendicular to the corridor, feet. */
  across: number
  /** Whether the trip has to get across the boulevard. */
  crossesBoulevard: boolean
}

function legFor(household: Household, destination: Destination): Leg {
  const along = Math.abs(household.station - destination.station)
  const crossesBoulevard = household.side !== destination.side
  const acrossOwn = householdOffsetFt(household)
  const acrossFar = destination.offset
  const across = crossesBoulevard ? acrossOwn + acrossFar : Math.abs(acrossOwn - acrossFar)
  return { along, across, crossesBoulevard }
}

/**
 * Minutes by each mode, or null where the mode is unavailable.
 * Times are PERCEIVED, not clock: a walk beside fast traffic costs more than
 * the same walk on a quiet street, and people choose on the perceived number.
 */
export function travelMinutes(
  household: Household, destination: Destination, ctx: TravelContext,
): Record<Mode, number | null> {
  const leg = legFor(household, destination)
  const { street } = ctx

  // --- Walk ---
  const crossingDetourFt = leg.crossesBoulevard ? street.crossingSpacingFt / 2 : 0
  const walkFt = leg.along + leg.across + crossingDetourFt
  const walkMinutesRaw = (walkFt / 5280 / C.WALK_SPEED_MPH) * 60
  const crossingWaitMin = leg.crossesBoulevard ? (street.signalCycleSec * 0.42) / 60 : 0
  const comfortMultiplier = 1 + (C.WALK_COMFORT_PENALTY_MAX - 1) * ctx.hostility
  const walk = (walkMinutesRaw + crossingWaitMin) * comfortMultiplier

  // --- Bike ---
  const bikeFt = leg.along + leg.across + (leg.crossesBoulevard ? street.crossingSpacingFt / 3 : 0)
  const bikeMinutesRaw = (bikeFt / 5280 / C.BIKE_SPEED_MPH) * 60
  const stressMultiplier = 1 + (C.BIKE_STRESS_PENALTY_MAX - 1) * ((ctx.lts - 1) / 3)
  const bike = (bikeMinutesRaw + crossingWaitMin * 0.6) * stressMultiplier

  // --- Drive ---
  let drive: number | null = null
  if (household.vehicles > 0) {
    const driveFt = leg.along + leg.across + (leg.crossesBoulevard && street.median === 'raised' ? 700 : 0)
    const speed = Math.max(6, ctx.traffic.peakSpeedMph)
    const runMinutes = (driveFt / 5280 / speed) * 60
    // Getting in, out, and parked is most of a short car trip.
    const parkingSearch = parkingSearchMinutes(street, ctx.parcels)
    drive = runMinutes + parkingSearch + 1.4
  }

  // --- Transit ---
  let transit: number | null = null
  if (street.transitBusesPerHour > 0 && !destination.offCorridor) {
    const accessFt = householdOffsetFt(household) + BUS_STOP_SPACING_FT / 4
    const egressFt = destination.offset + BUS_STOP_SPACING_FT / 4
    const accessMin = ((accessFt + egressFt) / 5280 / C.WALK_SPEED_MPH) * 60 * comfortMultiplier
    const headwayMin = 60 / street.transitBusesPerHour
    const waitMin = (headwayMin / 2) * C.TRANSIT_WAIT_WEIGHT
    const busSpeed = street.busLane ? C.BUS_SPEED_MPH * 1.25 : Math.min(C.BUS_SPEED_MPH, ctx.traffic.peakSpeedMph * 0.72)
    const rideMin = (leg.along / 5280 / Math.max(4, busSpeed)) * 60
    const crossPenalty = leg.crossesBoulevard ? crossingWaitMin * comfortMultiplier : 0
    transit = accessMin + waitMin + rideMin + crossPenalty
  }

  return { walk, bike, drive, transit }
}

/** Actual clock minutes, unweighted by comfort. Used for the 15-minute test. */
export function clockMinutes(
  household: Household, destination: Destination, ctx: TravelContext,
): Record<Mode, number | null> {
  const leg = legFor(household, destination)
  const { street } = ctx
  const crossingDetourFt = leg.crossesBoulevard ? street.crossingSpacingFt / 2 : 0
  const crossingWaitMin = leg.crossesBoulevard ? (street.signalCycleSec * 0.42) / 60 : 0

  const walkFt = leg.along + leg.across + crossingDetourFt
  const walk = (walkFt / 5280 / C.WALK_SPEED_MPH) * 60 + crossingWaitMin

  const bikeFt = leg.along + leg.across + (leg.crossesBoulevard ? street.crossingSpacingFt / 3 : 0)
  const bike = (bikeFt / 5280 / C.BIKE_SPEED_MPH) * 60 + crossingWaitMin * 0.6

  let drive: number | null = null
  if (household.vehicles > 0) {
    const driveFt = leg.along + leg.across
    drive = (driveFt / 5280 / Math.max(6, ctx.traffic.peakSpeedMph)) * 60 +
      parkingSearchMinutes(street, ctx.parcels) + 1.4
  }

  let transit: number | null = null
  if (street.transitBusesPerHour > 0 && !destination.offCorridor) {
    const accessFt = householdOffsetFt(household) + BUS_STOP_SPACING_FT / 4 + destination.offset
    const busSpeed = street.busLane ? C.BUS_SPEED_MPH * 1.25 : Math.min(C.BUS_SPEED_MPH, ctx.traffic.peakSpeedMph * 0.72)
    transit = (accessFt / 5280 / C.WALK_SPEED_MPH) * 60 +
      60 / street.transitBusesPerHour / 2 +
      (leg.along / 5280 / Math.max(4, busSpeed)) * 60
  }

  return { walk, bike, drive, transit }
}

/**
 * How long it takes to park.
 *
 * A half-empty car park costs almost nothing. Free kerb parking that is full
 * costs several minutes. Priced kerb parking is never full, which is the
 * entire argument for pricing it.
 */
export function parkingSearchMinutes(street: StreetState, parcels: readonly Parcel[]): number {
  const totalStalls = parcels.reduce((sum, p) => sum + p.surfaceStalls + p.structuredStalls, 0)
  const demand = parcels.reduce((sum, p) => sum + (p.floorArea / 1000) * 2.6 + p.dwellings * 0.9, 0)
  const occupancy = totalStalls > 0 ? demand / totalStalls : 1.2

  let minutes = C.PARKING_SEARCH_MINUTES * Math.max(0.2, occupancy) ** 2.2
  if (street.onStreetParking === 'metered') minutes = Math.min(minutes, 1.2)
  return Math.max(0.3, Math.min(9, minutes))
}

/** Out-of-pocket cost of one trip by each mode, dollars. */
export function tripCost(
  household: Household, destination: Destination, ctx: TravelContext,
): Record<Mode, number> {
  const leg = legFor(household, destination)
  const miles = (leg.along + leg.across) / 5280
  const meter = ctx.street.onStreetParking === 'metered' ? ctx.street.meterPricePerHour * 0.75 : 0
  void household
  return {
    drive: miles * C.VEHICLE_OPERATING_COST_PER_MILE + meter,
    walk: 0,
    bike: 0,
    transit: C.TRANSIT_FARE,
  }
}

/** Multinomial logit over the modes available to this household. */
export function modeProbabilities(
  household: Household, destination: Destination, ctx: TravelContext,
): Record<Mode, number> {
  const minutes = travelMinutes(household, destination, ctx)
  const costs = tripCost(household, destination, ctx)

  const asc: Record<Mode, number> = {
    drive: C.ASC_DRIVE,
    walk: C.ASC_WALK + (household.walkPropensity - 0.42) * 1.6,
    bike: C.ASC_BIKE,
    transit: C.ASC_TRANSIT,
  }

  const utilities: Partial<Record<Mode, number>> = {}
  for (const mode of MODES) {
    const time = minutes[mode]
    if (time === null) continue
    utilities[mode] = asc[mode] +
      C.MODE_UTILITY_TIME_COEFFICIENT * time +
      C.MODE_UTILITY_COST_COEFFICIENT * costs[mode]
  }

  const entries = Object.entries(utilities) as [Mode, number][]
  const max = Math.max(...entries.map(([, u]) => u))
  let sum = 0
  const exps: [Mode, number][] = entries.map(([mode, u]) => {
    const e = Math.exp(u - max)
    sum += e
    return [mode, e]
  })

  const result: Record<Mode, number> = { drive: 0, walk: 0, bike: 0, transit: 0 }
  for (const [mode, e] of exps) result[mode] = e / sum

  // Most people simply will not ride in traffic, however the arithmetic comes
  // out. Level of traffic stress gates cycling before utility does: the share
  // of adults willing to ride at all falls off a cliff between LTS 2 and 3.
  const willing = bikeWillingShare(ctx.lts)
  if (result.bike > 0 && willing < 1) {
    const suppressed = result.bike * (1 - willing)
    result.bike -= suppressed
    const others = result.drive + result.walk + result.transit
    if (others > 0) {
      result.drive += suppressed * (result.drive / others)
      result.walk += suppressed * (result.walk / others)
      result.transit += suppressed * (result.transit / others)
    } else {
      result.walk += suppressed
    }
  }
  return result
}

/** The share of adults who will ride at all, by level of traffic stress. */
export function bikeWillingShare(lts: number): number {
  if (lts <= 1) return C.BIKE_WILLING_SHARE_LTS1
  if (lts <= 2) return C.BIKE_WILLING_SHARE_LTS2
  if (lts <= 3) return C.BIKE_WILLING_SHARE_LTS3
  return C.BIKE_WILLING_SHARE_LTS4
}

/** Nearest destination of each kind, by straight network distance. */
function nearestByKind(household: Household, ctx: TravelContext): Partial<Record<DestinationKind, Destination>> {
  const nearest: Partial<Record<DestinationKind, Destination>> = {
    friend: {
      kind: 'friend',
      station: household.friend.station,
      side: household.friend.side,
      offset: household.friend.offset,
      offCorridor: household.friend.offset > 3000,
    },
    work: {
      kind: 'work',
      station: household.work.station,
      side: household.work.side,
      offset: household.work.offset,
      offCorridor: !household.work.onCorridor,
    },
  }
  const best: Partial<Record<DestinationKind, number>> = { friend: 0, work: 0 }
  for (const destination of ctx.destinations) {
    if (destination.kind === 'friend' || destination.kind === 'work') continue
    const leg = legFor(household, destination)
    const distance = leg.along + leg.across
    const current = best[destination.kind]
    if (current === undefined || distance < current) {
      best[destination.kind] = distance
      nearest[destination.kind] = destination
    }
  }
  return nearest
}

export interface TravelResult {
  modeShare: ModeShare
  reachability: ReachabilityRecord[]
  /** Share of households with no car. */
  carlessShare: number
  /** Household transport cost as a share of income, weighted mean. */
  transportCostShare: number
  /** Share of households that can walk to a grocery in 15 minutes. */
  groceryWalkShare: number
  /** Share of school-age children who could walk to school alone. */
  childWalkShare: number
  /** Daily person-trips by transit, for the subsidy calculation. */
  transitBoardings: number
}

export function computeTravel(households: readonly Household[], ctx: TravelContext): TravelResult {
  const totals: ModeShare = { drive: 0, walk: 0, bike: 0, transit: 0 }
  let weightSum = 0
  let carlessWeight = 0
  let costShareSum = 0
  let groceryWalkWeight = 0
  let childWalkWeight = 0
  let childWeight = 0
  let transitTrips = 0

  const reachability: ReachabilityRecord[] = []
  const crossingFt = crossingDistanceFt(ctx.street)

  for (const household of households) {
    const nearest = nearestByKind(household, ctx)
    const within15: Record<DestinationKind, Mode[]> = {
      work: [], grocery: [], school: [], park: [], friend: [], clinic: [],
    }

    const householdShare: ModeShare = { drive: 0, walk: 0, bike: 0, transit: 0 }
    let annualMiles = 0

    for (const kind of DESTINATION_KINDS) {
      const destination = nearest[kind]
      const purposeWeight = TRIP_PURPOSE_WEIGHTS[kind]
      if (!destination) continue

      const probabilities = modeProbabilities(household, destination, ctx)
      for (const mode of MODES) householdShare[mode] += probabilities[mode] * purposeWeight

      const clock = clockMinutes(household, destination, ctx)
      for (const mode of MODES) {
        const time = clock[mode]
        if (time !== null && time <= C.ACCESSIBILITY_TIME_BUDGET_MIN) within15[kind].push(mode)
      }

      const leg = legFor(household, destination)
      const miles = (leg.along + leg.across) / 5280
      // Roughly 1,200 trips a household-year, split by purpose.
      annualMiles += miles * 2 * 1200 * purposeWeight * probabilities.drive
      transitTrips += household.weight * 1200 * purposeWeight * probabilities.transit / 365
    }

    for (const mode of MODES) totals[mode] += householdShare[mode] * household.weight
    weightSum += household.weight
    if (household.vehicles === 0) carlessWeight += household.weight

    // Counted the way the H+T index counts it: the whole cost of owning the
    // vehicle, not just the marginal cost of the trips taken in it.
    const transportCost =
      household.vehicles * C.CAR_OWNERSHIP_ANNUAL_COST +
      annualMiles * C.VEHICLE_OPERATING_COST_PER_MILE +
      householdShare.transit * 1200 * C.TRANSIT_FARE
    costShareSum += (transportCost / Math.max(1, household.income)) * household.weight

    const groceryWalkable = within15.grocery.includes('walk')
    if (groceryWalkable) groceryWalkWeight += household.weight

    // A child walking alone needs more than a short walk: it needs a street
    // the parent will allow. This is the strictest test in the model.
    const schoolWalk = within15.school.includes('walk')
    const crossingSafe = crossingFt <= 52 && ctx.operatingSpeed <= 32
    const childCanWalkToSchool = schoolWalk && ctx.hostility < 0.45 &&
      (crossingSafe || nearest.school?.side === household.side)
    if (household.children > 0) {
      childWeight += household.weight * household.children
      if (childCanWalkToSchool) childWalkWeight += household.weight * household.children
    }

    reachability.push({
      householdId: household.id,
      weight: household.weight,
      within15,
      transportCost: Math.round(transportCost),
      childCanWalkToSchool,
    })
  }

  const modeShare: ModeShare = {
    drive: totals.drive / weightSum,
    walk: totals.walk / weightSum,
    bike: totals.bike / weightSum,
    transit: totals.transit / weightSum,
  }
  // Purpose weights sum to 1, so the shares already do; normalise against
  // floating point drift anyway.
  const shareSum = modeShare.drive + modeShare.walk + modeShare.bike + modeShare.transit
  for (const mode of MODES) modeShare[mode] /= shareSum

  return {
    modeShare,
    reachability,
    carlessShare: carlessWeight / weightSum,
    transportCostShare: costShareSum / weightSum,
    groceryWalkShare: groceryWalkWeight / weightSum,
    childWalkShare: childWeight > 0 ? childWalkWeight / childWeight : 0,
    transitBoardings: transitTrips,
  }
}

/**
 * Whether a household still needs the car it owns.
 *
 * Households do not shed cars because the street looks nice. They shed them
 * when the car stops being necessary - when a grocery, a school and a job are
 * all reachable without one - and even then they do it slowly.
 */
export function desiredVehicles(household: Household, record: ReachabilityRecord): number {
  const carFree = (kind: DestinationKind): boolean =>
    record.within15[kind].some((mode) => mode !== 'drive')

  const essentials = [carFree('grocery'), carFree('work'), carFree('clinic')].filter(Boolean).length
  const budgetPressure = household.income < 42000

  if (essentials === 3 && (budgetPressure || household.walkPropensity > 0.55)) return 0
  if (essentials >= 2) return Math.min(household.vehicles, 1)
  if (essentials === 1 && household.vehicles > 1) return 1
  return household.vehicles
}
