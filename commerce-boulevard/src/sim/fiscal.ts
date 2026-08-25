/**
 * The budget, and the ledger underneath it.
 *
 * The arithmetic the whole game rests on: REVENUE scales with the value
 * created on a parcel, LIABILITY scales with the frontage and area that has to
 * be served. Those two things are unrelated. A corridor can double its
 * infrastructure obligation without moving its tax base at all, and that is
 * exactly what a widening does.
 */

import { C } from './constants'
import { corridorAcres } from './corridor'
import { isTaxExempt, profileFor } from './landuse'
import { laneMiles, SIGNALS_ON_CORRIDOR } from './traffic'
import type {
  Expenses, FiscalPolicy, FiscalState, Obligation, Parcel, Revenue, SafetyState,
  SimState, StreetState, ZoningState,
} from './types'

/** Hours a day the corridor's bus route runs. */
const TRANSIT_SPAN_HOURS = 16

/** Compounding CONSTRUCTION cost index since year zero. */
export function costIndex(year: number): number {
  return (1 + C.INFLATION_RATE) ** year
}

/**
 * Compounding GENERAL price index since year zero, applied to the tax base.
 *
 * These two indices are deliberately different. Construction costs have
 * outrun general prices for most of the last two decades, so a city whose
 * revenue grows with the economy and whose obligations grow with the
 * construction market loses ground every single year without doing anything
 * wrong. Over thirty years the wedge is worth about 1.8x.
 */
export function priceIndex(year: number): number {
  return (1 + C.GENERAL_INFLATION_RATE) ** year
}

/**
 * The land-value-tax split, applied revenue-neutrally.
 *
 * At split 0 land and improvements are taxed alike. At split 1 the entire levy
 * falls on land, and the weights are set so the corridor raises the same money
 * - which means car parks pay far more and buildings pay far less. Nobody's
 * total bill changes; everybody's individual bill does.
 */
export function taxWeights(parcels: readonly Parcel[], split: number): { land: number; improvement: number } {
  // Weighted by each parcel's CLASS rate, not by raw value. Residential and
  // commercial are taxed at different rates, so a shift that ignores the
  // difference silently changes total revenue instead of only redistributing it.
  let totalLand = 0
  let totalImprovement = 0
  for (const parcel of parcels) {
    if (isTaxExempt(parcel.use)) continue
    const rate = classRate(parcel)
    totalLand += parcel.landValue * rate
    totalImprovement += parcel.improvementValue * rate
  }
  if (totalLand <= 0) return { land: 1, improvement: 1 }
  const k = totalImprovement / totalLand
  return { land: 1 + split * k, improvement: 1 - split }
}

/** The statutory class rate for a parcel, before the city share and multiplier. */
function classRate(parcel: Parcel): number {
  const residential = parcel.use === 'single_family' || parcel.use === 'garden_apartment'
  return residential
    ? C.EFFECTIVE_PROPERTY_TAX_RATE_RESIDENTIAL
    : C.EFFECTIVE_PROPERTY_TAX_RATE_COMMERCIAL
}

/** The city's own effective rate on a parcel, after its class and its share. */
export function parcelTaxRate(parcel: Parcel, policy: FiscalPolicy): number {
  return classRate(parcel) * C.CITY_SHARE_OF_PROPERTY_LEVY * policy.propertyTaxMultiplier
}

/** Annual city property tax from one parcel. */
export function parcelPropertyTax(
  parcel: Parcel, policy: FiscalPolicy, weights: { land: number; improvement: number },
): number {
  if (isTaxExempt(parcel.use)) return 0
  const rate = parcelTaxRate(parcel, policy)
  return rate * (parcel.landValue * weights.land + parcel.improvementValue * weights.improvement)
}

/** Annual local sales tax from one parcel. */
export function parcelSalesTax(parcel: Parcel): number {
  const sales = parcel.businesses.reduce((sum, b) => sum + b.sales, 0)
  return sales * C.LOCAL_SALES_TAX_SHARE
}

export interface RevenueInputs {
  parcels: readonly Parcel[]
  policy: FiscalPolicy
  street: StreetState
  /** Dwellings completed this year, which pay impact fees once. */
  newDwellings: number
  /** State or federal money arriving this year. */
  stateAid: number
}

export function computeRevenue(inputs: RevenueInputs): Revenue {
  const { parcels, policy, street, newDwellings, stateAid } = inputs
  const weights = taxWeights(parcels, policy.landValueTaxSplit)

  let propertyTax = 0
  let salesTax = 0
  let bid = 0
  for (const parcel of parcels) {
    propertyTax += parcelPropertyTax(parcel, policy, weights)
    salesTax += parcelSalesTax(parcel)
    if (policy.bid?.active && !isTaxExempt(parcel.use) && profileFor(parcel.use).retailShare > 0) {
      bid += (parcel.landValue + parcel.improvementValue) * policy.bid.rate
    }
  }

  // Priced kerb parking. Metered stalls run about 65% occupied through a
  // ten-hour paid day - by design, because that is what pricing is for.
  let parkingMeters = 0
  if (street.onStreetParking === 'metered') {
    const stallsPerSide = C.CORRIDOR_LENGTH_FT / 22
    const stalls = stallsPerSide * 2
    parkingMeters = stalls * 0.65 * 10 * 310 * street.meterPricePerHour
  }

  const impactFees = newDwellings * policy.impactFeePerDwelling

  const total = propertyTax + salesTax + parkingMeters + impactFees + bid + stateAid
  return {
    propertyTax: Math.round(propertyTax),
    salesTax: Math.round(salesTax),
    parkingMeters: Math.round(parkingMeters),
    impactFees: Math.round(impactFees),
    bid: Math.round(bid),
    stateAid: Math.round(stateAid),
    total: Math.round(total),
  }
}

/**
 * The physical liability: what it costs each year to keep the corridor
 * working. This is the number the Ledger View puts against revenue per acre,
 * and it barely moves when the land use changes.
 */
export interface LiabilityBreakdown {
  roadMaintenance: number
  roadReconstructionReserve: number
  utilityMaintenance: number
  lighting: number
  signals: number
  sidewalkMaintenance: number
  /** The local street network that reaches every parcel behind the frontage. */
  localStreets: number
  total: number
}

/**
 * Annual whole-life cost of one foot of two-lane local street, including the
 * water and sewer beneath it and the lighting above it.
 *
 * Derived from the arterial figures rather than separately sourced: a local
 * street is two lanes wide, so a foot of it is 2/5,280 of a lane-mile.
 */
export function localStreetCostPerFootYear(year: number): number {
  const perLaneFoot = 1 / 5280
  const lanes = 2
  const pavement =
    C.ROAD_ROUTINE_MAINTENANCE_PER_LANE_MILE * perLaneFoot * lanes +
    (C.ROAD_RESURFACE_COST_PER_LANE_MILE / C.PAVEMENT_RESURFACE_CYCLE_YEARS) * perLaneFoot * lanes +
    (C.ROAD_RECONSTRUCT_COST_PER_LANE_MILE / C.PAVEMENT_RECONSTRUCT_CYCLE_YEARS) * perLaneFoot * lanes
  // A water main and a sewer run under it.
  const pipes = ((C.WATER_MAIN_REPLACE_COST_PER_FT + C.SEWER_REPLACE_COST_PER_FT) / C.PIPE_SERVICE_LIFE_YEARS)
  const lighting = C.STREETLIGHT_ANNUAL_COST_PER_POLE / C.STREETLIGHT_SPACING_FT
  return (pavement + pipes + lighting) * costIndex(year)
}

/** Feet of local street the corridor's land use requires. */
export function localStreetFeet(parcels: readonly Parcel[]): number {
  return parcels.reduce((sum, p) => sum + p.acres * profileFor(p.use).localStreetFeetPerAcre, 0)
}

export function computeLiability(street: StreetState, parcels: readonly Parcel[], year: number): LiabilityBreakdown {
  const index = costIndex(year)
  const lm = laneMiles(street)
  const lengthMiles = C.CORRIDOR_LENGTH_FT / 5280

  // Deferring resurfacing is cheap for a few years and then very expensive,
  // because the base starts to fail and patching replaces preservation.
  const overdue = Math.max(0, street.pavementAgeYears - C.PAVEMENT_RESURFACE_CYCLE_YEARS)
  const deterioration = 1 + (overdue / C.PAVEMENT_RESURFACE_CYCLE_YEARS) * 1.6
  const roadMaintenance = lm * C.ROAD_ROUTINE_MAINTENANCE_PER_LANE_MILE * index * deterioration

  // The reserve nobody funds: the annual cost of the resurfacing and the
  // reconstruction that are certainly coming.
  const roadReconstructionReserve = lm * index * (
    C.ROAD_RESURFACE_COST_PER_LANE_MILE / C.PAVEMENT_RESURFACE_CYCLE_YEARS +
    C.ROAD_RECONSTRUCT_COST_PER_LANE_MILE / C.PAVEMENT_RECONSTRUCT_CYCLE_YEARS
  )

  // A water main and a sewer run the length of the corridor, plus laterals to
  // every parcel. Pipe length follows FRONTAGE, not floor area - so it is
  // identical whether the frontage holds a car park or a six-storey building.
  const mainFeet = C.CORRIDOR_LENGTH_FT * 2
  const lateralFeet = parcels.filter((p) => p.depth === 0).length * 90
  const pipeFeet = mainFeet + lateralFeet
  const utilityMaintenance = pipeFeet * index *
    ((C.WATER_MAIN_REPLACE_COST_PER_FT + C.SEWER_REPLACE_COST_PER_FT) / 2 / C.PIPE_SERVICE_LIFE_YEARS)

  const spacing = street.lighting === 'pedestrian_scale' ? C.STREETLIGHT_SPACING_FT / 2 : C.STREETLIGHT_SPACING_FT
  const poles = (C.CORRIDOR_LENGTH_FT / spacing) * 2
  const lighting = poles * C.STREETLIGHT_ANNUAL_COST_PER_POLE * index

  const activeSignals = Math.max(0, SIGNALS_ON_CORRIDOR - street.roundabouts.length)
  const signals = activeSignals * C.SIGNAL_ANNUAL_MAINTENANCE * index

  const sidewalkSqft = C.CORRIDOR_LENGTH_FT * street.sidewalkWidthFt * 2
  const sidewalkMaintenance = sidewalkSqft * index * (C.SIDEWALK_COST_PER_SQFT / C.SIDEWALK_SERVICE_LIFE_YEARS)

  // The streets behind the boulevard. Their length is set by the land use, and
  // it is the single largest liability the corridor carries.
  const localStreets = localStreetFeet(parcels) * localStreetCostPerFootYear(year)

  void lengthMiles
  const total = roadMaintenance + roadReconstructionReserve + utilityMaintenance +
    lighting + signals + sidewalkMaintenance + localStreets

  return {
    roadMaintenance: Math.round(roadMaintenance),
    roadReconstructionReserve: Math.round(roadReconstructionReserve),
    utilityMaintenance: Math.round(utilityMaintenance),
    lighting: Math.round(lighting),
    signals: Math.round(signals),
    sidewalkMaintenance: Math.round(sidewalkMaintenance),
    localStreets: Math.round(localStreets),
    total: Math.round(total),
  }
}

export interface ExpenseInputs {
  street: StreetState
  parcels: readonly Parcel[]
  safety: SafetyState
  obligations: readonly Obligation[]
  debt: number
  year: number
  /** Daily transit boardings, for the fare offset. */
  transitBoardings: number
  /** Capital spend committed this year by projects under construction. */
  capitalSpend: number
}

export function computeExpenses(inputs: ExpenseInputs): Expenses {
  const { street, parcels, safety, obligations, debt, year, transitBoardings, capitalSpend } = inputs
  const index = costIndex(year)
  const liability = computeLiability(street, parcels, year)

  const emergencyResponse = safety.crashes * C.EMERGENCY_RESPONSE_COST_PER_CRASH * index

  // The corridor's share of a bus route: vehicle-hours spent on this 1.2 miles.
  const corridorMiles = C.CORRIDOR_LENGTH_FT / 5280
  const busSpeed = street.busLane ? C.BUS_SPEED_MPH * 1.25 : C.BUS_SPEED_MPH
  const revenueHours = street.transitBusesPerHour * TRANSIT_SPAN_HOURS * 365 * (corridorMiles / busSpeed) * 2
  const grossTransit = revenueHours * C.TRANSIT_OPERATING_COST_PER_REVENUE_HOUR * index
  const fares = transitBoardings * 365 * C.TRANSIT_FARE
  const transitSubsidy = Math.max(0, grossTransit - fares)

  const trees = street.treesPerMilePerSide * corridorMiles * 2
  const parkAcres = parcels.filter((p) => p.use === 'park' || p.use === 'plaza').reduce((s, p) => s + p.acres, 0)
  const parksAndTrees = (trees * C.STREET_TREE_ANNUAL_COST + parkAcres * 7500) * index

  const obligationCost = obligations.reduce((sum, o) => sum + o.annualCost * index, 0)

  // Twenty-year level debt service on outstanding general obligation debt.
  const rate = C.MUNICIPAL_BORROWING_RATE
  const debtService = debt > 0 ? (debt * rate) / (1 - (1 + rate) ** -20) : 0

  const total = liability.total + emergencyResponse + transitSubsidy + parksAndTrees +
    debtService + obligationCost + capitalSpend

  return {
    roadMaintenance: liability.roadMaintenance,
    roadReconstructionReserve: liability.roadReconstructionReserve,
    utilityMaintenance: liability.utilityMaintenance,
    lighting: liability.lighting,
    signals: liability.signals,
    sidewalkMaintenance: liability.sidewalkMaintenance,
    emergencyResponse: Math.round(emergencyResponse),
    transitSubsidy: Math.round(transitSubsidy),
    parksAndTrees: Math.round(parksAndTrees),
    debtService: Math.round(debtService + obligationCost + capitalSpend),
    total: Math.round(total),
  }
}

export function stepFiscal(
  revenue: Revenue, expenses: Expenses, previous: FiscalState,
  street: StreetState, parcels: readonly Parcel[], year: number,
): FiscalState {
  const surplus = revenue.total - expenses.total
  let reserve = previous.reserve + surplus
  let debt = previous.debt

  // A deficit is borrowed. A surplus pays the debt down before it banks.
  if (reserve < 0) {
    debt += -reserve
    reserve = 0
  } else if (debt > 0) {
    const paydown = Math.min(debt, reserve * 0.6)
    debt -= paydown
    reserve -= paydown
  }

  const acres = corridorAcres(parcels)
  const liability = computeLiability(street, parcels, year)

  return {
    revenue,
    expenses,
    surplus: Math.round(surplus),
    debt: Math.round(debt),
    reserve: Math.round(reserve),
    revenuePerAcre: Math.round(revenue.total / Math.max(1, acres)),
    liabilityPerAcre: Math.round(liability.total / Math.max(1, acres)),
  }
}

// ---------------------------------------------------------------------------
// The Ledger View
// ---------------------------------------------------------------------------

export interface ParcelLedgerRow {
  parcelId: string
  use: string
  acres: number
  station: number
  side: string
  revenuePerAcre: number
  liabilityPerAcre: number
  /** Revenue divided by liability. Below 1 and the parcel is subsidised. */
  ratio: number
}

/**
 * Every parcel, scored.
 *
 * Liability is allocated by FRONTAGE FEET, because that is what pipe length
 * and pavement width actually follow. A 4-acre car park with 400 feet of
 * frontage carries the same obligation as a 4-acre mid-rise block with the
 * same frontage, and pays a fortieth of the tax.
 *
 * This is what the player is not shown until they have already hit the wall.
 */
export function parcelLedger(state: SimState, year: number): ParcelLedgerRow[] {
  const liability = computeLiability(state.street, state.parcels, year)
  const weights = taxWeights(state.parcels, state.fiscalPolicy.landValueTaxSplit)

  const frontageFor = (parcel: Parcel): number => {
    // Back-row parcels are served by the corridor's mains, but at a discount:
    // they front a local street, not the arterial.
    const width = Math.sqrt((parcel.acres * 43560) / 2.2)
    return parcel.depth === 0 ? width : width * 0.45
  }
  const totalFrontage = state.parcels.reduce((sum, p) => sum + frontageFor(p), 0)
  const arterialLiability = liability.total - liability.localStreets
  const perFootYear = localStreetCostPerFootYear(year)

  return state.parcels.map((parcel) => {
    const revenue = parcelPropertyTax(parcel, state.fiscalPolicy, weights) + parcelSalesTax(parcel)
    const share = totalFrontage > 0 ? frontageFor(parcel) / totalFrontage : 0
    // Arterial infrastructure is shared, so it is split by frontage. The local
    // street network is not shared: a parcel that needs 190 feet of street per
    // acre is charged for 190 feet of street per acre.
    const parcelLiability = arterialLiability * share +
      parcel.acres * profileFor(parcel.use).localStreetFeetPerAcre * perFootYear

    const revenuePerAcre = revenue / Math.max(0.01, parcel.acres)
    const liabilityPerAcre = parcelLiability / Math.max(0.01, parcel.acres)

    return {
      parcelId: parcel.id,
      use: parcel.use,
      acres: parcel.acres,
      station: parcel.station,
      side: parcel.side,
      revenuePerAcre: Math.round(revenuePerAcre),
      liabilityPerAcre: Math.round(liabilityPerAcre),
      ratio: Math.round((revenuePerAcre / Math.max(1, liabilityPerAcre)) * 100) / 100,
    }
  })
}

/** Dwellings completed since last year, for impact fees. */
export function countNewDwellings(before: readonly Parcel[], after: readonly Parcel[]): number {
  const byId = new Map(before.map((p) => [p.id, p.dwellings]))
  let added = 0
  for (const parcel of after) {
    const previous = byId.get(parcel.id) ?? 0
    if (parcel.dwellings > previous) added += parcel.dwellings - previous
  }
  return added
}

/** Required parking, in stalls, under current zoning. Used by the UI. */
export function requiredParking(parcels: readonly Parcel[], zoning: ZoningState): number {
  let stalls = 0
  for (const parcel of parcels) {
    const profile = profileFor(parcel.use)
    stalls += (parcel.floorArea / 1000) * profile.retailShare * zoning.parkingMinPerKsfRetail
    stalls += parcel.dwellings * zoning.parkingMinPerDwelling
  }
  return Math.round(stalls)
}
