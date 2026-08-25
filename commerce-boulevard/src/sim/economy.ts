/**
 * Shops, homes, and what the land is worth.
 *
 * This is the slow half of the game. Street changes land in a year or two;
 * land use takes a decade. A player who fixes the street and then leaves is
 * left holding the maintenance bill for a corridor that never redeveloped.
 */

import { C } from './constants'
import { priceIndex } from './fiscal'
import { isTaxExempt, permittedFloorArea, profileFor, USE_INTENSITY } from './landuse'
import type { Rng } from './rng'
import type {
  Business, BusinessKind, LandUse, ModeShare, Parcel, SimState, ZoningState,
} from './types'

/** Annual retail spending captured by this corridor, per resident served. */
const RETAIL_SPEND_PER_CAPITA = 9800
/** Share of that spending the corridor competes for, against the rest of Fairview. */
const CORRIDOR_CAPTURE_SHARE = 0.42

export function retailFloorArea(parcel: Parcel): number {
  return parcel.floorArea * profileFor(parcel.use).retailShare
}

/**
 * How visible and reachable a parcel's shopfront is to somebody on foot.
 * Drives sales for small retail and is almost irrelevant to a big box, whose
 * customers arrive at 40 mph and park.
 */
export function footfallIndex(parcel: Parcel, modeShare: ModeShare): number {
  const profile = profileFor(parcel.use)
  const walkers = Math.min(1, modeShare.walk / 0.18)
  return profile.frontageQuality * walkers
}

export interface RetailResult {
  parcels: Parcel[]
  /** Total corridor retail sales this year, dollars. */
  totalSales: number
  openings: number
  closures: number
}

/**
 * One year of retail.
 *
 * Sales are competed for, not conjured: more retail floor area on the corridor
 * means less sales per square foot for everyone on it. This is why filling
 * every vacant lot with another strip centre makes the corridor poorer.
 */
export function stepRetail(
  parcels: readonly Parcel[], population: number, modeShare: ModeShare, year: number, rng: Rng,
): RetailResult {
  const servedPopulation = population + C.SERVICE_AREA_HOUSEHOLDS * 2.35
  const demand = servedPopulation * RETAIL_SPEND_PER_CAPITA * priceIndex(year) * CORRIDOR_CAPTURE_SHARE

  const totalRetailSqft = parcels.reduce((sum, p) => sum + retailFloorArea(p), 0)
  if (totalRetailSqft <= 0) {
    return { parcels: parcels.map(clone), totalSales: 0, openings: 0, closures: 0 }
  }

  // Competition: the same demand spread over more floor area.
  const marketSalesPerSqft = demand / totalRetailSqft

  let totalSales = 0
  let openings = 0
  let closures = 0
  const next: Parcel[] = []

  const hasGrocery = parcels.some((p) => p.businesses.some((b) => b.kind === 'grocery'))
  let needsGrocery = !hasGrocery && groceryViable(population)

  for (const parcel of parcels) {
    const updated = clone(parcel)
    const profile = profileFor(parcel.use)
    const sqft = retailFloorArea(parcel)

    if (sqft <= 0 || profile.retailShare === 0) {
      updated.businesses = []
      next.push(updated)
      continue
    }

    const formatFactor =
      parcel.use === 'big_box' ? C.RETAIL_SALES_PER_SQFT_BIG_BOX / C.RETAIL_SALES_PER_SQFT_STRIP :
      parcel.use === 'mainstreet_mixed' || parcel.use === 'midrise_mixed'
        ? C.RETAIL_SALES_PER_SQFT_MAINSTREET / C.RETAIL_SALES_PER_SQFT_STRIP : 1

    const footfall = footfallIndex(parcel, modeShare)
    const footfallFactor = 1 + C.RETAIL_FOOTFALL_SALES_ELASTICITY * footfall

    const salesPerSqft = marketSalesPerSqft * formatFactor * footfallFactor * (0.7 + 0.4 * parcel.condition)
    const rentPerSqft = (parcel.use === 'mainstreet_mixed' || parcel.use === 'midrise_mixed'
      ? C.RETAIL_RENT_PER_SQFT_MAINSTREET : C.RETAIL_RENT_PER_SQFT_STRIP) * priceIndex(year)

    // Make sure the parcel has tenants to begin with.
    if (updated.businesses.length === 0) {
      updated.businesses = seedBusinesses(updated, sqft, year, rng)
      openings += updated.businesses.length
    }

    const survivors: Business[] = []
    for (const business of updated.businesses) {
      const sales = business.floorArea * salesPerSqft
      const occupancyRatio = (business.floorArea * rentPerSqft) / Math.max(1, sales)
      const distressed = occupancyRatio > C.RETAIL_OCCUPANCY_COST_FAILURE_RATIO

      const updatedBusiness: Business = {
        ...business,
        sales: Math.round(sales),
        distressYears: distressed ? business.distressYears + 1 : 0,
      }

      // Two bad years in a row and the lease is not renewed. Plus ordinary
      // churn, which is not failure.
      const churns = rng.chance(C.BUSINESS_TURNOVER_RATE_STRIP * 0.35)
      if (updatedBusiness.distressYears >= 2 || churns) {
        closures++
      } else {
        survivors.push(updatedBusiness)
        totalSales += updatedBusiness.sales
      }
    }

    // Backfill vacancy, but only if the corridor can actually support it.
    const occupiedSqft = survivors.reduce((sum, b) => sum + b.floorArea, 0)
    const vacantSqft = sqft - occupiedSqft
    const viableSalesPerSqft = (C.RETAIL_RENT_PER_SQFT_STRIP / C.RETAIL_OCCUPANCY_COST_FAILURE_RATIO) * priceIndex(year) * 0.8
    if (vacantSqft > 1200 && marketSalesPerSqft > viableSalesPerSqft) {
      const unitSize = parcel.use === 'big_box' ? Math.min(vacantSqft, 90000) : Math.min(vacantSqft, 3200)
      const opened = makeBusiness(parcel, unitSize, year, rng)
      // A trade area with no grocery in it is a hole in the market, and the
      // market fills holes. Whether the corridor can walk to food must be a
      // consequence of the player's land use, not of a dice roll.
      if (needsGrocery && unitSize >= 2400 && parcel.use !== 'auto_service' && parcel.use !== 'office_park') {
        opened.kind = 'grocery'
        needsGrocery = false
      }
      // A shop that opens in March trades for most of the year.
      opened.sales = Math.round(opened.floorArea * salesPerSqft * 0.6)
      survivors.push(opened)
      totalSales += opened.sales
      openings++
    }

    updated.businesses = survivors
    next.push(updated)
  }

  return { parcels: next, totalSales, openings, closures }
}

const STRIP_KINDS: readonly BusinessKind[] = [
  'restaurant', 'salon', 'convenience', 'apparel', 'auto', 'gym', 'pharmacy', 'clinic',
]
const MAINSTREET_KINDS: readonly BusinessKind[] = [
  'cafe', 'restaurant', 'bar', 'apparel', 'salon', 'hardware', 'clinic', 'office', 'pharmacy',
]

function seedBusinesses(parcel: Parcel, sqft: number, year: number, rng: Rng): Business[] {
  const businesses: Business[] = []
  let remaining = sqft
  const unitSize = parcel.use === 'big_box' ? 95000 : 3000
  let index = 0
  while (remaining > unitSize * 0.5 && index < 24) {
    const size = Math.min(remaining, unitSize)
    businesses.push(makeBusiness(parcel, size, year - rng.int(0, 12), rng))
    remaining -= size
    index++
  }
  return businesses
}

function makeBusiness(parcel: Parcel, floorArea: number, year: number, rng: Rng): Business {
  const walkable = parcel.use === 'mainstreet_mixed' || parcel.use === 'midrise_mixed'
  let kind: BusinessKind
  if (parcel.use === 'big_box') kind = 'chain_anchor'
  else if (parcel.use === 'auto_service') kind = 'auto'
  else if (parcel.use === 'office_park') kind = 'office'
  else kind = rng.pick(walkable ? MAINSTREET_KINDS : STRIP_KINDS)

  return {
    id: `${parcel.id}-${kind}-${year}-${Math.floor(rng.next() * 100000)}`,
    kind,
    floorArea: Math.round(floorArea),
    sales: 0,
    distressYears: 0,
    yearOpened: year,
  }
}

/**
 * Whether the corridor can support a grocery at all. Below the trade-area
 * threshold, no amount of pavement produces a shop to walk to - which is the
 * hardest lesson in the game and the one the reachability score depends on.
 */
export function groceryViable(population: number): boolean {
  return population + C.SERVICE_AREA_HOUSEHOLDS * 2.35 >= C.GROCERY_TRADE_AREA_POPULATION
}

// ---------------------------------------------------------------------------
// Housing
// ---------------------------------------------------------------------------

export function stepHousing(state: SimState, absorption: AbsorptionBudget): number {
  const units = state.parcels.reduce((sum, p) => sum + p.dwellings, 0)

  // The corridor competes inside a city-wide housing market it does not
  // control. Rent here is the city rent, adjusted for how much people want to
  // be on this particular street and whether there is anywhere to live on it.
  const desirabilityFactor = 0.85 + 0.35 * absorption.desirability

  const scarcity = units > 0
    ? Math.max(0.75, Math.min(1.6, (absorption.targetHouseholds / units) ** (1 / C.HOUSING_SUPPLY_ELASTICITY)))
    : 1.2

  // More allowed density eases rent - a contested effect, held deliberately modest.
  const allowedDensity = state.zoning.heightLimitStories * state.zoning.maxLotCoverage
  const densityEffect = (allowedDensity / (3 * 0.4)) ** C.RENT_DENSITY_ELASTICITY

  // Required parking is bundled into the rent whether the tenant drives or not.
  const parkingLoad = state.zoning.parkingMinPerDwelling * C.PARKING_MINIMUM_COST_PER_UNIT

  const target = C.CITY_MEDIAN_RENT * priceIndex(state.year) * desirabilityFactor * scarcity * densityEffect +
    parkingLoad * priceIndex(state.year)

  // Rents are sticky: leases, notice periods, and the fact that most tenants
  // are not moving this year.
  const cap = state.medianRent * C.MAX_ANNUAL_RENT_CHANGE
  const move = Math.max(-cap, Math.min(cap, (target - state.medianRent) * 0.35))
  return Math.round(state.medianRent + move)
}

// ---------------------------------------------------------------------------
// Land value and redevelopment
// ---------------------------------------------------------------------------

/** What a parcel would be worth today if it were sold and used as it is. */
export function marketValue(parcel: Parcel, state: SimState): number {
  const profile = profileFor(parcel.use)
  if (isTaxExempt(parcel.use)) return 0

  // Corridor quality lifts everything on it, slowly.
  const rentIndex = state.medianRent / (C.CITY_MEDIAN_RENT * priceIndex(state.year))
  const conditionFactor = 0.7 + 0.55 * parcel.condition
  return profile.valuePerAcre * priceIndex(state.year) * parcel.acres * conditionFactor * rentIndex ** 0.6
}

/** The uses a parcel could legally and physically become. */
export function candidateUses(parcel: Parcel, zoning: ZoningState): LandUse[] {
  const options: LandUse[] = ['surface_parking', 'strip_mall', 'auto_service']
  if (zoning.heightLimitStories >= 2 && zoning.useMixing !== 'segregated') options.push('mainstreet_mixed')
  if (zoning.heightLimitStories >= 4 && zoning.useMixing === 'mixed') options.push('midrise_mixed')
  if (zoning.heightLimitStories >= 2) options.push('garden_apartment')
  if (parcel.acres >= 2.2) options.push('big_box')
  options.push('office_park')
  return options
}

export interface RedevelopmentResult {
  parcels: Parcel[]
  redeveloped: { parcelId: string; from: LandUse; to: LandUse }[]
}

/**
 * How much new floor area the corridor can actually absorb this year.
 *
 * Nothing gets built because it would be nice. It gets built because somebody
 * wants to rent it. Demand for living on Commerce Blvd depends on what
 * Commerce Blvd is like to live on - which is the loop that pays a patient
 * player back, and the one that never closes for an impatient one.
 */
export interface AbsorptionBudget {
  /** Dwellings the market will take up this year. */
  residentialUnits: number
  /** Dwellings the corridor could eventually support at today's desirability. */
  targetHouseholds: number
  /** Square feet of retail the corridor's spending can support. */
  retailSqft: number
  /** 0..1. How much people want to be here. */
  desirability: number
}

export function computeAbsorption(
  state: SimState, hostility: number, modeShare: ModeShare,
): AbsorptionBudget {
  // A hostile, loud, unwalkable corridor is somewhere to drive past, not to
  // live on. A pleasant one competes for the whole city's households.
  const desirability = clamp01(0.12 + 0.5 * (1 - hostility) + 1.1 * modeShare.walk)

  const targetHouseholds = C.SERVICE_AREA_HOUSEHOLDS * (0.03 + 0.34 * desirability)
  const currentUnits = state.parcels.reduce((sum, p) => sum + p.dwellings, 0)
  const unitGap = targetHouseholds - currentUnits
  // Absorption is slow even in a hot market: a 1.2-mile corridor does not take
  // a thousand flats in a year.
  const residentialUnits = Math.max(0, Math.min(90, unitGap * 0.12))

  const servedPopulation = state.population + C.SERVICE_AREA_HOUSEHOLDS * 2.35
  const spending = servedPopulation * RETAIL_SPEND_PER_CAPITA * priceIndex(state.year) * CORRIDOR_CAPTURE_SHARE
  // Retail is supportable only down to the sales per square foot at which a
  // tenant can still cover the rent.
  const supportableSqft = spending / (C.RETAIL_SALES_PER_SQFT_STRIP * priceIndex(state.year))
  const existingRetail = state.parcels.reduce((sum, p) => sum + retailFloorArea(p), 0)
  const retailSqft = Math.max(0, Math.min(30000, (supportableSqft - existingRetail) * 0.15))

  return { residentialUnits, targetHouseholds, retailSqft, desirability }
}

/**
 * One year of land turning over.
 *
 * A parcel redevelops when three things are true at once: the value it could
 * hold exceeds what it holds now by enough to pay for demolition and risk, the
 * zoning permits that use, and somebody actually wants the space. Miss any one
 * and nothing happens - which is why up-zoning a dead corridor changes
 * nothing, and why fixing the street before the zoning changes nothing either.
 */
export function stepRedevelopment(
  state: SimState, rng: Rng, budget: AbsorptionBudget,
): RedevelopmentResult {
  const redeveloped: RedevelopmentResult['redeveloped'] = []
  const parcels = state.parcels.map(clone)

  let unitsLeft = budget.residentialUnits
  let retailLeft = budget.retailSqft

  interface Candidate { parcel: Parcel; use: LandUse; uplift: number }
  const candidates: Candidate[] = []

  for (const parcel of parcels) {
    const profile = profileFor(parcel.use)
    if (!profile.redevelopable) continue

    const currentValue = marketValue(parcel, state)
    // Demolition, financing and the developer's margin.
    const hurdle = currentValue * 1.35 + parcel.acres * 120000

    let bestUse: LandUse | null = null
    let bestValue = hurdle

    for (const use of candidateUses(parcel, state.zoning)) {
      if (use === parcel.use) continue
      const candidateProfile = profileFor(use)
      const permitted = permittedFloorArea(parcel, state.zoning, use)
      // Parking minimums bite here: if the required parking eats the site, the
      // denser use cannot be built, whatever the height limit says.
      const feasibleShare = candidateProfile.floorAreaRatio > 0
        ? Math.min(1, permitted / (parcel.acres * 43560 * candidateProfile.floorAreaRatio))
        : 1
      if (feasibleShare < 0.55) continue

      const candidateValue = candidateProfile.valuePerAcre * parcel.acres * feasibleShare *
        (state.medianRent / 1150) ** 0.6 * (0.55 + 0.75 * budget.desirability)
      if (candidateValue > bestValue) {
        bestValue = candidateValue
        bestUse = use
      }
    }

    if (bestUse) {
      candidates.push({ parcel, use: bestUse, uplift: bestValue / Math.max(1, currentValue) })
    }
  }

  // The most profitable sites go first, and the year runs out of demand before
  // it runs out of sites.
  candidates.sort((a, b) => b.uplift - a.uplift)

  for (const candidate of candidates) {
    const profile = profileFor(candidate.use)
    const units = Math.round(profile.dwellingsPerAcre * candidate.parcel.acres)
    const retail = candidate.parcel.acres * 43560 * profile.floorAreaRatio * profile.retailShare

    // Buildings are not divisible: a 180-unit block cannot be built 90 units
    // at a time. A single project may draw ahead on the pipeline, which then
    // pauses everything else until demand catches up.
    const unitCeiling = Math.max(60, budget.residentialUnits * 2.5)
    const retailCeiling = Math.max(20000, budget.retailSqft * 2.5)
    if (units > 0 && (unitsLeft <= 0 || units > unitCeiling)) continue
    if (retail > 0 && (retailLeft <= 0 || retail > retailCeiling)) continue
    if (units === 0 && retail === 0 && candidate.use !== 'surface_parking') continue

    // Even a clearly better use takes years to happen. Older buildings first.
    const chance = Math.min(0.5, (candidate.uplift - 1) * 0.18 + (1 - candidate.parcel.condition) * 0.08)
    if (chance <= 0 || !rng.chance(chance)) continue

    const from = candidate.parcel.use
    applyUse(candidate.parcel, candidate.use, state.year)
    redeveloped.push({ parcelId: candidate.parcel.id, from, to: candidate.use })
    unitsLeft -= units
    retailLeft -= retail
  }

  return { parcels, redeveloped }
}

function clamp01(x: number): number { return Math.max(0, Math.min(1, x)) }

export function applyUse(parcel: Parcel, use: LandUse, year: number): void {
  const profile = profileFor(use)
  parcel.use = use
  parcel.stories = profile.stories
  parcel.floorArea = Math.round(parcel.acres * 43560 * profile.floorAreaRatio)
  parcel.surfaceStalls = Math.round((parcel.acres * 43560 * profile.surfaceParkingShare) / C.PARKING_STALL_AREA_SQFT)
  parcel.structuredStalls = use === 'midrise_mixed' ? Math.round(parcel.acres * 43560 * 0.0009) : 0
  parcel.dwellings = Math.round(profile.dwellingsPerAcre * parcel.acres)
  parcel.residents = Math.round(parcel.dwellings * 2.35)
  parcel.curbCuts = parcel.depth === 0 ? profile.curbCutsPerParcel : 0
  parcel.canopy = profile.baseCanopy
  parcel.condition = 1
  parcel.yearBuilt = year
  parcel.businesses = []
}

/**
 * Assessed value chases market value with a lag, because assessors reassess on
 * a cycle. The fiscal reward for good land use therefore arrives after the
 * political cost of causing it - which is most of why cities do not do it.
 */
export function stepAssessments(state: SimState): Parcel[] {
  return state.parcels.map((parcel) => {
    const updated = clone(parcel)
    const profile = profileFor(parcel.use)
    const market = marketValue(parcel, state)
    const targetLand = market * profile.landValueShare
    const targetImprovement = market - targetLand
    const rate = 1 / C.ASSESSMENT_LAG_YEARS

    updated.landValue = Math.round(parcel.landValue + (targetLand - parcel.landValue) * rate)
    updated.improvementValue = Math.round(parcel.improvementValue + (targetImprovement - parcel.improvementValue) * rate)
    // Buildings age. Street trees, meanwhile, grow.
    updated.condition = Math.max(0.1, parcel.condition - 0.009)
    return updated
  })
}

/** Corridor jobs, from floor area and use. */
export function corridorJobs(parcels: readonly Parcel[]): number {
  let jobs = 0
  for (const parcel of parcels) {
    const profile = profileFor(parcel.use)
    const nonResidentialShare = profile.dwellingsPerAcre > 0 ? 0.35 : 1
    jobs += (parcel.floorArea / 1000) * nonResidentialShare * profile.jobsPerKsf
  }
  return Math.round(jobs)
}

/** Corridor population, from occupied dwellings. */
export function corridorPopulation(parcels: readonly Parcel[]): number {
  return parcels.reduce((sum, p) => sum + p.residents, 0)
}

/** Whether the corridor is dense enough for a bus to make sense. */
export function residentialDensityPerAcre(parcels: readonly Parcel[]): number {
  const dwellings = parcels.reduce((sum, p) => sum + p.dwellings, 0)
  const acres = parcels.reduce((sum, p) => sum + p.acres, 0)
  return acres > 0 ? dwellings / acres : 0
}

/** How much more intense the corridor has become since year zero. */
export function intensityIndex(parcels: readonly Parcel[]): number {
  const total = parcels.reduce((sum, p) => sum + p.acres, 0)
  if (total === 0) return 0
  return parcels.reduce((sum, p) => sum + USE_INTENSITY[p.use] * p.acres, 0) / total
}

function clone(parcel: Parcel): Parcel {
  return { ...parcel, businesses: parcel.businesses.map((b) => ({ ...b })) }
}
