/**
 * Fairview at year zero.
 *
 * Commerce Blvd is 1.2 miles of six-lane arterial with a two-way left turn
 * lane, 40-foot setbacks, and a strip of shops sitting behind their own car
 * parks. Nothing about it is unusual. That is the point.
 */

import { C } from './constants'
import { profileFor } from './landuse'
import type { Rng } from './rng'
import { makeRng } from './rng'
import type {
  FiscalPolicy, Household, LandUse, Parcel, Side, SimState, StreetState, ZoningState,
} from './types'

const SEGMENT_LENGTH_FT = C.CORRIDOR_LENGTH_FT / C.CORRIDOR_SEGMENTS

/** The front setback Fairview's code has required since it was written. */
const INITIAL_FRONT_SETBACK_FT = 40
const FRONT_ROW_DEPTH_FT = 250
const BACK_ROW_DEPTH_FT = 150

/** Feet from the boulevard centreline to a household one block back. */
export const BLOCK_DEPTH_FT = 400

export function initialStreet(): StreetState {
  return {
    throughLanesPerDirection: 3,
    laneWidthFt: 12,
    designSpeedMph: 45,
    onStreetParking: 'none',
    meterPricePerHour: 0,
    bikeFacility: 'none',
    sidewalkWidthFt: 4,
    crossingSpacingFt: 1320,
    signalCycleSec: 120,
    signalPolicy: 'vehicle_progression',
    median: 'twltl',
    treesPerMilePerSide: 8,
    // Planted when the boulevard was built, and never added to since.
    treePlantings: [{ year: -34, perMilePerSide: 8 }],
    lighting: 'cobra_highmast',
    busLane: false,
    transitBusesPerHour: 1,
    roundabouts: [],
    plazaSegments: [],
    daylighting: false,
    bulbOuts: false,
    utilitiesUndergrounded: false,
    transitStopsUpgraded: false,
    pavementAgeYears: 12,
  }
}

export function initialZoning(): ZoningState {
  return {
    parkingMinPerKsfRetail: 4.5,
    parkingMinPerDwelling: 2.0,
    frontSetbackFt: 40,
    useMixing: 'segregated',
    heightLimitStories: 3,
    maxLotCoverage: 0.4,
    aduLegal: false,
    formBasedCode: false,
    minLotSizeSqft: 8000,
  }
}

export function initialFiscalPolicy(): FiscalPolicy {
  return {
    propertyTaxMultiplier: 1,
    landValueTaxSplit: 0,
    impactFeePerDwelling: 3000,
    tif: null,
    bid: null,
  }
}

// The mix a 1970s-through-1990s commercial strip actually ends up with.
const FRONT_ROW_MIX: readonly { use: LandUse; weight: number }[] = [
  { use: 'strip_mall', weight: 30 },
  { use: 'surface_parking', weight: 22 },
  { use: 'auto_service', weight: 18 },
  { use: 'big_box', weight: 14 },
  { use: 'vacant', weight: 8 },
  { use: 'office_park', weight: 8 },
]

const BACK_ROW_MIX: readonly { use: LandUse; weight: number }[] = [
  { use: 'single_family', weight: 46 },
  { use: 'garden_apartment', weight: 22 },
  { use: 'surface_parking', weight: 16 },
  { use: 'vacant', weight: 10 },
  { use: 'single_family', weight: 6 },
]

function weightedPick(rng: Rng, mix: readonly { use: LandUse; weight: number }[]): LandUse {
  const total = mix.reduce((sum, entry) => sum + entry.weight, 0)
  let roll = rng.next() * total
  for (const entry of mix) {
    roll -= entry.weight
    if (roll <= 0) return entry.use
  }
  return mix[mix.length - 1]!.use
}

function makeParcel(
  rng: Rng, id: string, station: number, side: Side, depth: number, acres: number, use: LandUse, year: number,
): Parcel {
  const profile = profileFor(use)
  const lotSqft = acres * 43560
  const floorArea = Math.round(lotSqft * profile.floorAreaRatio)
  const parkingSqft = lotSqft * profile.surfaceParkingShare
  const surfaceStalls = Math.round(parkingSqft / C.PARKING_STALL_AREA_SQFT)

  // Buildings on a corridor like this were built across three decades.
  const yearBuilt = year - rng.int(8, 48)
  const condition = Math.max(0.15, Math.min(0.95, 0.85 - (year - yearBuilt) * 0.011 + rng.normal() * 0.07))

  // Same formula as marketValue(), so year zero starts in equilibrium
  // rather than ramping for the first few years.
  const totalValue = profile.valuePerAcre * acres * (0.7 + 0.55 * condition)
  const landValue = Math.round(totalValue * profile.landValueShare)
  const improvementValue = Math.round(totalValue - landValue)

  const dwellings = Math.round(profile.dwellingsPerAcre * acres)

  return {
    id,
    station,
    side,
    depth,
    acres: Math.round(acres * 1000) / 1000,
    use,
    stories: profile.stories,
    floorArea,
    surfaceStalls,
    structuredStalls: 0,
    landValue,
    improvementValue,
    businesses: [],
    dwellings,
    residents: Math.round(dwellings * 2.35),
    yearBuilt,
    condition: Math.round(condition * 1000) / 1000,
    curbCuts: depth === 0 ? profile.curbCutsPerParcel : 0,
    // Everything on the corridor was put up under the forty-foot minimum that
    // is still on the books in year zero, so even the handful of shopfronts
    // stand back from the pavement they were meant to be on.
    frontSetbackFt: Math.max(INITIAL_FRONT_SETBACK_FT, profile.entranceSetbackFt),
    canopy: Math.max(0, Math.min(1, profile.baseCanopy + rng.normal() * 0.04)),
  }
}

/** Share of corridor land that is surface car park, standalone or attached. */
export function surfaceParkingShare(parcels: readonly Parcel[]): number {
  let parkingAcres = 0
  let totalAcres = 0
  for (const parcel of parcels) {
    totalAcres += parcel.acres
    parkingAcres += parcel.acres * profileFor(parcel.use).surfaceParkingShare
  }
  return totalAcres > 0 ? parkingAcres / totalAcres : 0
}

export function generateParcels(rng: Rng, year: number): Parcel[] {
  const parcels: Parcel[] = []
  const sides: Side[] = ['north', 'south']

  for (let segment = 0; segment < C.CORRIDOR_SEGMENTS; segment++) {
    for (const side of sides) {
      const segmentStart = segment * SEGMENT_LENGTH_FT

      // Front row: one to three lots across the block face.
      const frontLots = rng.int(1, 3)
      const frontAcresTotal = (SEGMENT_LENGTH_FT * FRONT_ROW_DEPTH_FT) / 43560
      const frontSplits = splitEvenly(rng, frontAcresTotal, frontLots)
      let cursor = 0
      for (let i = 0; i < frontLots; i++) {
        const acres = frontSplits[i]!
        const widthFt = (acres * 43560) / FRONT_ROW_DEPTH_FT
        const station = segmentStart + cursor + widthFt / 2
        cursor += widthFt
        // A big box needs a big lot; small lots get small uses.
        let use = weightedPick(rng, FRONT_ROW_MIX)
        if (use === 'big_box' && acres < 2.2) use = 'strip_mall'
        parcels.push(makeParcel(rng, `f${segment}${side[0]}${i}`, station, side, 0, acres, use, year))
      }

      // Back row: two or three lots.
      const backLots = rng.int(2, 3)
      const backAcresTotal = (SEGMENT_LENGTH_FT * BACK_ROW_DEPTH_FT) / 43560
      const backSplits = splitEvenly(rng, backAcresTotal, backLots)
      cursor = 0
      for (let i = 0; i < backLots; i++) {
        const acres = backSplits[i]!
        const widthFt = (acres * 43560) / BACK_ROW_DEPTH_FT
        const station = segmentStart + cursor + widthFt / 2
        cursor += widthFt
        const use = weightedPick(rng, BACK_ROW_MIX)
        parcels.push(makeParcel(rng, `b${segment}${side[0]}${i}`, station, side, 1, acres, use, year))
      }
    }
  }

  // Fairview has one school and one small park on the corridor. Both matter
  // enormously to the reachability score and neither pays property tax.
  const backParcels = parcels.filter((p) => p.depth === 1 && p.use !== 'garden_apartment')
  if (backParcels.length > 2) {
    const school = backParcels[Math.floor(backParcels.length * 0.28)]!
    const park = backParcels[Math.floor(backParcels.length * 0.71)]!
    convertTo(school, 'civic', year)
    convertTo(park, 'park', year)
  }

  fitParkingShare(rng, parcels, C.INITIAL_SURFACE_PARKING_SHARE, year)
  return parcels
}

function convertTo(parcel: Parcel, use: LandUse, year: number): void {
  const profile = profileFor(use)
  parcel.use = use
  parcel.stories = profile.stories
  parcel.floorArea = Math.round(parcel.acres * 43560 * profile.floorAreaRatio)
  parcel.surfaceStalls = Math.round((parcel.acres * 43560 * profile.surfaceParkingShare) / C.PARKING_STALL_AREA_SQFT)
  parcel.dwellings = Math.round(profile.dwellingsPerAcre * parcel.acres)
  parcel.residents = Math.round(parcel.dwellings * 2.35)
  parcel.curbCuts = parcel.depth === 0 ? profile.curbCutsPerParcel : 0
  parcel.canopy = profile.baseCanopy
  parcel.frontSetbackFt = Math.max(INITIAL_FRONT_SETBACK_FT, profile.entranceSetbackFt)
  parcel.landValue = Math.round(profile.valuePerAcre * parcel.acres * profile.landValueShare)
  parcel.improvementValue = Math.round(profile.valuePerAcre * parcel.acres * (1 - profile.landValueShare))
  parcel.yearBuilt = Math.min(parcel.yearBuilt, year)
}

/**
 * Nudge the mix until the corridor is 55% surface car park, which is the
 * figure the brief specifies. Deterministic: same seed, same corridor.
 */
function fitParkingShare(rng: Rng, parcels: Parcel[], target: number, year: number): void {
  const candidates = rng.shuffle(parcels.filter((p) => p.use === 'vacant' || p.use === 'office_park' || p.use === 'strip_mall'))
  let index = 0
  let guard = 0
  while (surfaceParkingShare(parcels) < target && index < candidates.length && guard++ < 500) {
    convertTo(candidates[index]!, 'surface_parking', year)
    index++
  }
  // Overshoot correction: turn the smallest car parks back into strip retail.
  const parkingLots = parcels.filter((p) => p.use === 'surface_parking').sort((a, b) => a.acres - b.acres)
  let backIndex = 0
  while (surfaceParkingShare(parcels) > target + 0.01 && backIndex < parkingLots.length && guard++ < 1000) {
    convertTo(parkingLots[backIndex]!, 'strip_mall', year)
    backIndex++
  }
}

function splitEvenly(rng: Rng, total: number, parts: number): number[] {
  if (parts === 1) return [total]
  const weights: number[] = []
  let sum = 0
  for (let i = 0; i < parts; i++) {
    const w = 0.7 + rng.next() * 0.6
    weights.push(w)
    sum += w
  }
  return weights.map((w) => (w / sum) * total)
}

/**
 * The households the corridor serves. A few hundred representative households,
 * weighted, rather than 120,000 individuals: the model needs distributions,
 * not people.
 */
export function generateHouseholds(rng: Rng, parcels: readonly Parcel[]): Household[] {
  const households: Household[] = []
  const SERVICE_AREA_HOUSEHOLDS = 7200
  const SAMPLE = 300
  const weight = SERVICE_AREA_HOUSEHOLDS / SAMPLE

  // A third live on the corridor itself; the rest live in the blocks behind it.
  const onCorridor = parcels.filter((p) => p.dwellings > 0)
  const corridorDwellings = onCorridor.reduce((sum, p) => sum + p.dwellings, 0)

  for (let i = 0; i < SAMPLE; i++) {
    const onCorridorDraw = corridorDwellings > 0 && rng.next() < 0.34
    let station: number
    let side: Side
    let depth: number

    if (onCorridorDraw) {
      const parcel = rng.pick(onCorridor)
      station = parcel.station
      side = parcel.side
      depth = parcel.depth
    } else {
      station = rng.next() * C.CORRIDOR_LENGTH_FT
      side = rng.chance(0.5) ? 'north' : 'south'
      // Most of the service area is two to six blocks back.
      depth = 2 + Math.floor(rng.next() * 5)
    }

    // Log-normal-ish income spread around the median.
    const income = Math.round(C.MEDIAN_HOUSEHOLD_INCOME * Math.exp(rng.normal() * 0.45))
    const children = rng.next() < 0.31 ? rng.int(1, 3) : 0

    households.push({
      id: `hh${i}`,
      weight,
      station,
      side,
      depth,
      income,
      vehicles: income < 32000 ? (rng.chance(0.45) ? 0 : 1) : rng.chance(0.55) ? 2 : 1,
      children,
      walkPropensity: Math.max(0.05, Math.min(0.95, 0.42 + rng.normal() * 0.2)),
      // Friends live where friends live: usually somewhere else in Fairview.
      friend: {
        station: rng.next() * C.CORRIDOR_LENGTH_FT,
        side: rng.chance(0.5) ? 'north' : 'south',
        offset: rng.chance(0.3) ? 300 + rng.next() * 1800 : 0.6 * 5280 + rng.next() * 2.4 * 5280,
      },
      work: (() => {
        // About one household in twelve works on the corridor itself.
        const onCorridor = rng.chance(0.085)
        return {
          station: rng.next() * C.CORRIDOR_LENGTH_FT,
          side: rng.chance(0.5) ? 'north' : 'south',
          offset: onCorridor ? 125 + rng.next() * 250 : (1.4 + rng.next() * 4.6) * 5280,
          onCorridor,
        }
      })(),
      patience: rng.int(2, 6),
    })
  }
  return households
}

/** Total corridor land, acres. */
export function corridorAcres(parcels: readonly Parcel[]): number {
  return parcels.reduce((sum, p) => sum + p.acres, 0)
}

/** Every parcel that fronts the boulevard, west to east. */
export function frontageParcels(parcels: readonly Parcel[]): Parcel[] {
  return parcels.filter((p) => p.depth === 0).sort((a, b) => a.station - b.station)
}

/** Which segment index a station falls in. */
export function segmentOf(station: number): number {
  return Math.max(0, Math.min(C.CORRIDOR_SEGMENTS - 1, Math.floor(station / SEGMENT_LENGTH_FT)))
}

export { SEGMENT_LENGTH_FT }

/** A fresh Fairview. Everything downstream is a function of this and the seed. */
export function createInitialState(seed: string): SimState {
  const rng = makeRng(seed).fork('worldgen')
  const parcels = generateParcels(rng, 0)
  const households = generateHouseholds(rng.fork('households'), parcels)

  return {
    seed,
    year: 0,
    rngDraws: 0,
    parcels,
    street: initialStreet(),
    zoning: initialZoning(),
    fiscalPolicy: initialFiscalPolicy(),
    households,
    destinations: [],
    traffic: {
      aadt: C.INITIAL_AADT,
      latentAadt: C.INITIAL_AADT,
      peakSpeedMph: 0,
      offPeakSpeedMph: 0,
      volumeCapacityRatio: 0,
      corridorVmt: 0,
      regionalIndex: 1,
    },
    modeShare: { drive: 0.93, walk: 0.04, bike: 0.005, transit: 0.025 },
    environment: {
      sidewalkNoiseDba: 0, setbackNoiseDba: 0, pm25Increment: 0, no2Increment: 0,
      imperviousFraction: 0, canopyFraction: 0, airTempExcessF: 0,
      surfaceTempExcessF: 0, daysOver95: C.BASE_DAYS_OVER_95,
    },
    safety: {
      crashes: 0, fatal: 0, seriousInjury: 0, minorInjury: 0, propertyDamageOnly: 0,
      pedestrianCrashes: 0, pedestrianFatal: 0, bicycleCrashes: 0, bicycleFatal: 0,
      societalCost: 0,
    },
    fiscal: {
      revenue: {
        propertyTax: 0, salesTax: 0, parkingMeters: 0, impactFees: 0, bid: 0,
        stateAid: 0, total: 0,
      },
      expenses: {
        roadMaintenance: 0, roadReconstructionReserve: 0, utilityMaintenance: 0,
        lighting: 0, signals: 0, sidewalkMaintenance: 0, emergencyResponse: 0,
        transitSubsidy: 0, parksAndTrees: 0, debtService: 0, total: 0,
      },
      surplus: 0, debt: 0, reserve: 0, revenuePerAcre: 0, liabilityPerAcre: 0,
    },
    politics: {
      capital: C.STARTING_POLITICAL_CAPITAL,
      approval: 50,
      factions: { drivers: 50, merchants: 50, homeowners: 50, renters: 50, taxpayers: 44 },
    },
    activeProjects: [],
    obligations: [],
    glossary: { unlocked: [], unlockedAt: {} },
    unlockedInstruments: [],
    ledgerUnlocked: false,
    medianRent: 1150,
    jobs: 0,
    population: 0,
    baseline: {
      laneMiles: 0, localVehicleTrips: 0, lanesPerDirection: 3,
      peakSpeedMph: 0, revenuePerAcre: 0, liabilityPerAcre: 0,
    },
    residentsLeft: 0,
    ended: null,
    events: [],
    history: [],
  }
}
