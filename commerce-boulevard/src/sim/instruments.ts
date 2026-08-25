/**
 * What the Public Works Director can actually do.
 *
 * RULE, enforced by a test: an instrument's description states what it changes,
 * what it costs, and how long it takes. It never says what it is FOR, and it
 * never says whether it is a good idea. The player finds that out by doing it.
 */

import { C } from './constants'
import { costIndex } from './fiscal'
import { laneMiles } from './traffic'
import type { SimState } from './types'

export type InstrumentTab = 'street' | 'land' | 'fiscal' | 'capital'

export interface Instrument {
  id: string
  tab: InstrumentTab
  label: string
  /** Mechanics and cost only. Nothing about consequences. */
  description: string
  /** One-off capital cost, dollars. */
  capitalCost: (state: SimState) => number
  /** Change to recurring annual cost, dollars. Usually zero. */
  annualCost: (state: SimState) => number
  /** Political capital required. */
  pcCost: (state: SimState) => number
  /** Years of construction before it takes effect. */
  constructionYears: number
  /** Share of corridor capacity lost while the works are on, 0..1. */
  disruption: number
  /** Whether the player has this tool yet. */
  unlockedBy: (state: SimState) => boolean
  /** Whether it can be applied right now. */
  applicable: (state: SimState) => boolean
  /** Applied to a draft state when construction finishes. */
  apply: (state: SimState) => void
}

const corridorMiles = C.CORRIDOR_LENGTH_FT / 5280
const always = (): boolean => true

function make(instrument: Partial<Instrument> & Pick<Instrument, 'id' | 'tab' | 'label' | 'description' | 'apply'>): Instrument {
  return {
    capitalCost: () => 0,
    annualCost: () => 0,
    pcCost: () => 0,
    constructionYears: 0,
    disruption: 0,
    unlockedBy: always,
    applicable: always,
    ...instrument,
  }
}

// ---------------------------------------------------------------------------
// Street
// ---------------------------------------------------------------------------

const street: Instrument[] = [
  make({
    id: 'street.narrow_lanes',
    tab: 'street',
    label: 'Restripe to 10-foot lanes',
    description: 'Reduces lane width from its current value to 10 feet. Restriping only; no kerb work. One construction season.',
    capitalCost: (s) => 42000 * corridorMiles * costIndex(s.year),
    pcCost: () => 6,
    constructionYears: 1,
    disruption: 0.1,
    applicable: (s) => s.street.laneWidthFt > 10,
    apply: (s) => { s.street.laneWidthFt = 10 },
  }),
  make({
    id: 'street.widen_lanes',
    tab: 'street',
    label: 'Restripe to 12-foot lanes',
    description: 'Increases lane width to 12 feet. Restriping only. One construction season.',
    capitalCost: (s) => 42000 * corridorMiles * costIndex(s.year),
    pcCost: () => 0,
    constructionYears: 1,
    disruption: 0.1,
    applicable: (s) => s.street.laneWidthFt < 12,
    apply: (s) => { s.street.laneWidthFt = 12 },
  }),
  make({
    id: 'street.lower_target_speed',
    tab: 'street',
    label: 'Lower the posted speed by 5 mph',
    description: 'Changes signs and the design target. Does not change the geometry. Cheap.',
    capitalCost: (s) => 18000 * costIndex(s.year),
    pcCost: () => 8,
    applicable: (s) => s.street.designSpeedMph > 20,
    apply: (s) => { s.street.designSpeedMph -= 5 },
  }),
  make({
    id: 'street.raise_target_speed',
    tab: 'street',
    label: 'Raise the posted speed by 5 mph',
    description: 'Changes signs and the design target. Cheap.',
    capitalCost: (s) => 18000 * costIndex(s.year),
    pcCost: () => 0,
    applicable: (s) => s.street.designSpeedMph < 50,
    apply: (s) => { s.street.designSpeedMph += 5 },
  }),
  make({
    id: 'street.add_kerb_parking',
    tab: 'street',
    label: 'Add kerbside parking, unpriced',
    description: 'Converts the outside lane in each direction to kerbside parking. Removes one through lane per direction.',
    capitalCost: (s) => 95000 * corridorMiles * costIndex(s.year),
    pcCost: () => 10,
    constructionYears: 1,
    disruption: 0.15,
    applicable: (s) => s.street.onStreetParking === 'none' && s.street.throughLanesPerDirection > 1,
    apply: (s) => {
      s.street.onStreetParking = 'free'
      s.street.throughLanesPerDirection -= 1
    },
  }),
  make({
    id: 'street.remove_kerb_parking',
    tab: 'street',
    label: 'Remove kerbside parking',
    description: 'Returns the kerb lane to through traffic. Adds one through lane per direction.',
    pcCost: () => 22,
    capitalCost: (s) => 40000 * corridorMiles * costIndex(s.year),
    constructionYears: 1,
    applicable: (s) => s.street.onStreetParking !== 'none',
    apply: (s) => {
      s.street.onStreetParking = 'none'
      s.street.throughLanesPerDirection += 1
    },
  }),
  make({
    id: 'street.painted_bike_lane',
    tab: 'street',
    label: 'Paint bike lanes',
    description: 'A 5-foot painted lane each way, taken from lane width. Paint and signs only.',
    capitalCost: (s) => 65000 * corridorMiles * costIndex(s.year),
    pcCost: () => 7,
    constructionYears: 1,
    applicable: (s) => s.street.bikeFacility === 'none' || s.street.bikeFacility === 'sharrow',
    apply: (s) => { s.street.bikeFacility = 'painted' },
  }),
  make({
    id: 'street.protected_bike_lane',
    tab: 'street',
    label: 'Build protected bike lanes',
    description: 'A physically separated lane each way behind a kerb or parking. Removes one through lane per direction. Two construction seasons.',
    capitalCost: (s) => 1350000 * corridorMiles * costIndex(s.year),
    annualCost: (s) => 8000 * corridorMiles * costIndex(s.year),
    pcCost: (s) => (s.traffic.volumeCapacityRatio > 0.85 ? 34 : 24),
    constructionYears: 2,
    disruption: 0.2,
    applicable: (s) => s.street.bikeFacility !== 'protected' && s.street.throughLanesPerDirection > 1,
    apply: (s) => {
      s.street.bikeFacility = 'protected'
      s.street.throughLanesPerDirection -= 1
    },
  }),
  make({
    id: 'street.widen_sidewalks',
    tab: 'street',
    label: 'Widen footways to 10 feet',
    description: 'Rebuilds the footway on both sides at 10 feet. Takes width from the kerb line. Two construction seasons.',
    capitalCost: (s) => C.CORRIDOR_LENGTH_FT * 2 * 6 * C.SIDEWALK_COST_PER_SQFT * costIndex(s.year),
    pcCost: () => 12,
    constructionYears: 2,
    disruption: 0.15,
    applicable: (s) => s.street.sidewalkWidthFt < 10,
    apply: (s) => { s.street.sidewalkWidthFt = 10 },
  }),
  make({
    id: 'street.add_crossings',
    tab: 'street',
    label: 'Halve the distance between crossings',
    description: 'Adds marked crossings with signals or beacons, halving the maximum distance between them.',
    capitalCost: (s) => (C.CORRIDOR_LENGTH_FT / s.street.crossingSpacingFt) * 180000 * costIndex(s.year),
    annualCost: (s) => (C.CORRIDOR_LENGTH_FT / s.street.crossingSpacingFt) * 2400 * costIndex(s.year),
    pcCost: () => 14,
    constructionYears: 1,
    disruption: 0.1,
    applicable: (s) => s.street.crossingSpacingFt > 300,
    apply: (s) => { s.street.crossingSpacingFt = Math.max(300, Math.round(s.street.crossingSpacingFt / 2)) },
  }),
  make({
    id: 'street.signal_pedestrian_priority',
    tab: 'street',
    label: 'Retime signals for pedestrian priority',
    description: 'Shortens the cycle to 75 seconds and adds an exclusive pedestrian phase at each signal. Controller work only.',
    capitalCost: (s) => 85000 * costIndex(s.year),
    pcCost: () => 16,
    applicable: (s) => s.street.signalPolicy !== 'pedestrian_priority',
    apply: (s) => {
      s.street.signalPolicy = 'pedestrian_priority'
      s.street.signalCycleSec = 75
    },
  }),
  make({
    id: 'street.signal_progression',
    tab: 'street',
    label: 'Retime signals for vehicle progression',
    description: 'Lengthens the cycle to 140 seconds and coordinates the arterial green band.',
    capitalCost: (s) => 85000 * costIndex(s.year),
    pcCost: () => 0,
    applicable: (s) => s.street.signalPolicy !== 'vehicle_progression',
    apply: (s) => {
      s.street.signalPolicy = 'vehicle_progression'
      s.street.signalCycleSec = 140
    },
  }),
  make({
    id: 'street.landscaped_median',
    tab: 'street',
    label: 'Replace the turn lane with a landscaped median',
    description: 'Converts the two-way left turn lane to a raised planted median with turn pockets at signals. Two construction seasons.',
    capitalCost: (s) => 1900000 * corridorMiles * costIndex(s.year),
    annualCost: (s) => 24000 * corridorMiles * costIndex(s.year),
    pcCost: () => 20,
    constructionYears: 2,
    disruption: 0.25,
    applicable: (s) => s.street.median !== 'landscaped',
    apply: (s) => { s.street.median = 'landscaped' },
  }),
  make({
    id: 'street.plant_trees',
    tab: 'street',
    label: 'Plant street trees',
    description: 'Adds 40 trees per mile per side in kerbside pits. Canopy takes about fifteen years to arrive.',
    capitalCost: (s) => 40 * corridorMiles * 2 * C.STREET_TREE_PLANTING_COST * costIndex(s.year),
    annualCost: (s) => 40 * corridorMiles * 2 * C.STREET_TREE_ANNUAL_COST * costIndex(s.year),
    pcCost: () => 4,
    constructionYears: 1,
    applicable: (s) => s.street.treesPerMilePerSide < 80,
    apply: (s) => { s.street.treesPerMilePerSide = Math.min(80, s.street.treesPerMilePerSide + 40) },
  }),
  make({
    id: 'street.pedestrian_lighting',
    tab: 'street',
    label: 'Replace lighting with pedestrian-scale poles',
    description: 'Doubles the pole count at half the mounting height. Roughly doubles the lighting line in the budget.',
    capitalCost: (s) => ((C.CORRIDOR_LENGTH_FT / (C.STREETLIGHT_SPACING_FT / 2)) * 2) * C.STREETLIGHT_CAPITAL_COST_PER_POLE * costIndex(s.year),
    pcCost: () => 8,
    constructionYears: 1,
    applicable: (s) => s.street.lighting !== 'pedestrian_scale',
    apply: (s) => { s.street.lighting = 'pedestrian_scale' },
  }),
  make({
    id: 'street.bus_lane',
    tab: 'street',
    label: 'Convert a lane each way to a bus lane',
    description: 'Removes one through lane per direction. Buses run about 25% faster on the corridor.',
    capitalCost: (s) => 380000 * corridorMiles * costIndex(s.year),
    pcCost: () => 30,
    constructionYears: 1,
    disruption: 0.1,
    unlockedBy: (s) => s.street.transitBusesPerHour >= 3,
    applicable: (s) => !s.street.busLane && s.street.throughLanesPerDirection > 1,
    apply: (s) => {
      s.street.busLane = true
      s.street.throughLanesPerDirection -= 1
    },
  }),
  make({
    id: 'street.increase_transit',
    tab: 'street',
    label: 'Add two buses per hour',
    description: 'Increases service on the corridor route. Costs operating subsidy every year, for ever.',
    annualCost: (s) => 2 * 16 * 365 * (corridorMiles / C.BUS_SPEED_MPH) * 2 * C.TRANSIT_OPERATING_COST_PER_REVENUE_HOUR * costIndex(s.year),
    pcCost: () => 9,
    applicable: (s) => s.street.transitBusesPerHour < 8,
    apply: (s) => { s.street.transitBusesPerHour += 2 },
  }),
]

// ---------------------------------------------------------------------------
// Land use
// ---------------------------------------------------------------------------

const land: Instrument[] = [
  make({
    id: 'land.reduce_parking_minimums',
    tab: 'land',
    label: 'Halve parking minimums',
    description: 'Halves the required stalls per 1,000 sqft of retail and per dwelling. Applies to new development only.',
    pcCost: () => 12,
    applicable: (s) => s.zoning.parkingMinPerKsfRetail > 0.6,
    apply: (s) => {
      s.zoning.parkingMinPerKsfRetail = Math.round(s.zoning.parkingMinPerKsfRetail * 50) / 100
      s.zoning.parkingMinPerDwelling = Math.round(s.zoning.parkingMinPerDwelling * 50) / 100
    },
  }),
  make({
    id: 'land.abolish_parking_minimums',
    tab: 'land',
    label: 'Abolish parking minimums',
    description: 'Removes the requirement entirely. Developers may still build parking.',
    pcCost: () => 26,
    unlockedBy: (s) => s.zoning.parkingMinPerKsfRetail < 4.5,
    applicable: (s) => s.zoning.parkingMinPerKsfRetail > 0,
    apply: (s) => {
      s.zoning.parkingMinPerKsfRetail = 0
      s.zoning.parkingMinPerDwelling = 0
    },
  }),
  make({
    id: 'land.reduce_setbacks',
    tab: 'land',
    label: 'Reduce the front setback to 5 feet',
    description: 'New buildings may sit at the back of the footway instead of behind their parking.',
    pcCost: () => 10,
    applicable: (s) => s.zoning.frontSetbackFt > 5,
    apply: (s) => { s.zoning.frontSetbackFt = 5 },
  }),
  make({
    id: 'land.allow_mixed_use',
    tab: 'land',
    label: 'Allow homes above shops',
    description: 'Permits residential floors over ground-floor commercial on the corridor.',
    pcCost: () => 14,
    applicable: (s) => s.zoning.useMixing !== 'mixed',
    apply: (s) => {
      s.zoning.useMixing = s.zoning.useMixing === 'segregated' ? 'limited' : 'mixed'
    },
  }),
  make({
    id: 'land.raise_height_limit',
    tab: 'land',
    label: 'Raise the height limit by two storeys',
    description: 'Increases the maximum permitted storeys on the corridor.',
    pcCost: (s) => 11 + s.zoning.heightLimitStories * 2,
    applicable: (s) => s.zoning.heightLimitStories < 8,
    apply: (s) => { s.zoning.heightLimitStories += 2 },
  }),
  make({
    id: 'land.increase_lot_coverage',
    tab: 'land',
    label: 'Raise maximum lot coverage to 80%',
    description: 'Permits buildings to occupy more of their site.',
    pcCost: () => 9,
    applicable: (s) => s.zoning.maxLotCoverage < 0.8,
    apply: (s) => { s.zoning.maxLotCoverage = 0.8 },
  }),
  make({
    id: 'land.legalise_adu',
    tab: 'land',
    label: 'Legalise accessory dwellings',
    description: 'Permits a second small unit on lots that already hold a house.',
    pcCost: () => 15,
    applicable: (s) => !s.zoning.aduLegal,
    apply: (s) => { s.zoning.aduLegal = true },
  }),
  make({
    id: 'land.form_based_code',
    tab: 'land',
    label: 'Adopt a form-based code',
    description: 'Replaces use-based zoning on the corridor with rules about building form and frontage. Takes two years to draft and adopt.',
    capitalCost: (s) => 420000 * costIndex(s.year),
    pcCost: () => 28,
    constructionYears: 2,
    unlockedBy: (s) => s.zoning.useMixing !== 'segregated' && s.year >= 4,
    applicable: (s) => !s.zoning.formBasedCode,
    apply: (s) => {
      s.zoning.formBasedCode = true
      s.zoning.useMixing = 'mixed'
      s.zoning.frontSetbackFt = Math.min(s.zoning.frontSetbackFt, 5)
      s.zoning.maxLotCoverage = Math.max(s.zoning.maxLotCoverage, 0.8)
    },
  }),
  make({
    id: 'land.reduce_min_lot_size',
    tab: 'land',
    label: 'Reduce the minimum lot size to 3,000 sqft',
    description: 'Permits smaller lots and narrower buildings.',
    pcCost: () => 12,
    applicable: (s) => s.zoning.minLotSizeSqft > 3000,
    apply: (s) => { s.zoning.minLotSizeSqft = 3000 },
  }),
]

// ---------------------------------------------------------------------------
// Fiscal
// ---------------------------------------------------------------------------

const fiscal: Instrument[] = [
  make({
    id: 'fiscal.raise_property_tax',
    tab: 'fiscal',
    label: 'Raise the property tax rate by 10%',
    description: 'Multiplies the city portion of the rate by 1.1. Applies to every parcel on the corridor.',
    pcCost: () => 25,
    applicable: (s) => s.fiscalPolicy.propertyTaxMultiplier < 1.8,
    apply: (s) => { s.fiscalPolicy.propertyTaxMultiplier = Math.round(s.fiscalPolicy.propertyTaxMultiplier * 110) / 100 },
  }),
  make({
    id: 'fiscal.cut_property_tax',
    tab: 'fiscal',
    label: 'Cut the property tax rate by 10%',
    description: 'Multiplies the city portion of the rate by 0.9.',
    pcCost: () => 0,
    applicable: (s) => s.fiscalPolicy.propertyTaxMultiplier > 0.6,
    apply: (s) => { s.fiscalPolicy.propertyTaxMultiplier = Math.round(s.fiscalPolicy.propertyTaxMultiplier * 90) / 100 },
  }),
  make({
    id: 'fiscal.land_value_shift',
    tab: 'fiscal',
    label: 'Shift a quarter of the levy onto land value',
    description: 'Moves 25% of the assessment weight from buildings onto land. Revenue-neutral in the year it is adopted; individual bills change.',
    pcCost: () => 22,
    constructionYears: 1,
    unlockedBy: (s) => s.year >= 3,
    applicable: (s) => s.fiscalPolicy.landValueTaxSplit < 1,
    apply: (s) => { s.fiscalPolicy.landValueTaxSplit = Math.min(1, Math.round((s.fiscalPolicy.landValueTaxSplit + 0.25) * 100) / 100) },
  }),
  make({
    id: 'fiscal.price_parking',
    tab: 'fiscal',
    label: 'Meter the kerb at $1.50 an hour',
    description: 'Installs meters on kerbside stalls. Requires kerbside parking to exist.',
    capitalCost: (s) => 620000 * costIndex(s.year),
    pcCost: () => 18,
    constructionYears: 1,
    applicable: (s) => s.street.onStreetParking === 'free',
    apply: (s) => {
      s.street.onStreetParking = 'metered'
      s.street.meterPricePerHour = 1.5
    },
  }),
  make({
    id: 'fiscal.raise_meter_price',
    tab: 'fiscal',
    label: 'Raise the meter rate by 50 cents',
    description: 'Increases the hourly kerb rate.',
    pcCost: () => 9,
    unlockedBy: (s) => s.street.onStreetParking === 'metered',
    applicable: (s) => s.street.onStreetParking === 'metered' && s.street.meterPricePerHour < 5,
    apply: (s) => { s.street.meterPricePerHour = Math.round((s.street.meterPricePerHour + 0.5) * 100) / 100 },
  }),
  make({
    id: 'fiscal.impact_fees',
    tab: 'fiscal',
    label: 'Raise impact fees to $9,000 a dwelling',
    description: 'Charged once on each new dwelling completed.',
    pcCost: () => 8,
    applicable: (s) => s.fiscalPolicy.impactFeePerDwelling < 9000,
    apply: (s) => { s.fiscalPolicy.impactFeePerDwelling = 9000 },
  }),
  make({
    id: 'fiscal.waive_impact_fees',
    tab: 'fiscal',
    label: 'Waive impact fees on the corridor',
    description: 'Sets the per-dwelling fee to zero for corridor development.',
    pcCost: () => 6,
    applicable: (s) => s.fiscalPolicy.impactFeePerDwelling > 0,
    apply: (s) => { s.fiscalPolicy.impactFeePerDwelling = 0 },
  }),
  make({
    id: 'fiscal.tif_district',
    tab: 'fiscal',
    label: 'Create a tax increment district',
    description: 'Freezes the corridor tax base at today’s value. Growth above it funds corridor capital work instead of the general fund, for twenty years.',
    pcCost: () => 16,
    unlockedBy: (s) => s.year >= 2,
    applicable: (s) => !s.fiscalPolicy.tif?.active,
    apply: (s) => {
      const base = s.parcels.reduce((sum, p) => sum + p.landValue + p.improvementValue, 0)
      s.fiscalPolicy.tif = { active: true, baseYear: s.year, baseValue: base }
    },
  }),
  make({
    id: 'fiscal.business_improvement_district',
    tab: 'fiscal',
    label: 'Form a business improvement district',
    description: 'A 0.4% surcharge on commercial assessed value, collected from corridor businesses.',
    pcCost: () => 13,
    unlockedBy: (s) => s.year >= 2,
    applicable: (s) => !s.fiscalPolicy.bid?.active,
    apply: (s) => { s.fiscalPolicy.bid = { active: true, rate: 0.004 } },
  }),
]

// ---------------------------------------------------------------------------
// Capital
// ---------------------------------------------------------------------------

const capital: Instrument[] = [
  make({
    id: 'capital.state_widening',
    tab: 'capital',
    label: 'Accept the state DOT widening grant',
    description: 'The state funds 90% of construction to add one through lane each way. The city pays the remaining 10% and takes ownership of the finished roadway, including all future maintenance and reconstruction. Three construction seasons. Offer expires after year 2.',
    capitalCost: (s) => 2 * corridorMiles * C.ROAD_RECONSTRUCT_COST_PER_LANE_MILE * 2.4 * costIndex(s.year) * (1 - C.STATE_GRANT_MATCH_RATIO),
    pcCost: () => 0,
    constructionYears: 3,
    disruption: 0.16,
    unlockedBy: (s) => s.year <= 2,
    applicable: (s) => s.year <= 2 && s.street.throughLanesPerDirection < 4 &&
      !s.obligations.some((o) => o.id.startsWith('capital.state_widening')),
    apply: (s) => {
      s.street.throughLanesPerDirection += 1
      s.street.pavementAgeYears = 0
      // The obligation the grant does not mention: 2.4 extra lane-miles of
      // routine maintenance and reconstruction reserve, for ever.
      const addedLaneMiles = 2 * corridorMiles
      s.obligations.push({
        id: `capital.state_widening:maintenance:${s.year}`,
        label: 'Commerce Blvd widening: maintenance and reconstruction',
        annualCost: addedLaneMiles * (
          C.ROAD_ROUTINE_MAINTENANCE_PER_LANE_MILE +
          C.ROAD_RESURFACE_COST_PER_LANE_MILE / C.PAVEMENT_RESURFACE_CYCLE_YEARS +
          C.ROAD_RECONSTRUCT_COST_PER_LANE_MILE / C.PAVEMENT_RECONSTRUCT_CYCLE_YEARS
        ),
        yearsRemaining: null,
        origin: 'state_grant',
      })
    },
  }),
  make({
    id: 'capital.repave',
    tab: 'capital',
    label: 'Mill and overlay the corridor',
    description: 'Resurfaces every lane. Resets pavement age. One construction season.',
    capitalCost: (s) => laneMiles(s.street) * C.ROAD_RESURFACE_COST_PER_LANE_MILE * costIndex(s.year),
    pcCost: () => 0,
    constructionYears: 1,
    disruption: 0.18,
    applicable: (s) => s.street.pavementAgeYears > 3,
    apply: (s) => { s.street.pavementAgeYears = 0 },
  }),
  make({
    id: 'capital.reconstruct',
    tab: 'capital',
    label: 'Fully reconstruct the corridor',
    description: 'Rebuilds the roadway to full depth including drainage. Resets pavement age. Three construction seasons.',
    capitalCost: (s) => laneMiles(s.street) * C.ROAD_RECONSTRUCT_COST_PER_LANE_MILE * costIndex(s.year),
    pcCost: () => 10,
    constructionYears: 3,
    disruption: 0.3,
    apply: (s) => { s.street.pavementAgeYears = 0 },
  }),
  make({
    id: 'capital.road_diet',
    tab: 'capital',
    label: 'Remove one through lane each way',
    description: 'Reduces through lanes per direction by one. Restriping plus kerb work at intersections. Two construction seasons.',
    capitalCost: (s) => 620000 * corridorMiles * costIndex(s.year),
    pcCost: (s) => Math.round(14 + 34 * Math.min(1, s.traffic.volumeCapacityRatio)),
    constructionYears: 2,
    disruption: 0.25,
    applicable: (s) => s.street.throughLanesPerDirection > 1,
    apply: (s) => { s.street.throughLanesPerDirection -= 1 },
  }),
  make({
    id: 'capital.add_lane',
    tab: 'capital',
    label: 'Add one through lane each way',
    description: 'Widens the roadway by one lane per direction. Adds 2.4 lane-miles to the maintenance obligation permanently. Three construction seasons.',
    capitalCost: (s) => 2 * corridorMiles * C.ROAD_RECONSTRUCT_COST_PER_LANE_MILE * 2.4 * costIndex(s.year),
    pcCost: () => 0,
    constructionYears: 3,
    disruption: 0.18,
    applicable: (s) => s.street.throughLanesPerDirection < 4,
    apply: (s) => { s.street.throughLanesPerDirection += 1 },
  }),
  make({
    id: 'capital.roundabout',
    tab: 'capital',
    label: 'Convert a signal to a roundabout',
    description: 'Replaces one signalised intersection with a roundabout. Removes that signal from the maintenance budget. Two construction seasons.',
    capitalCost: (s) => 2400000 * costIndex(s.year),
    pcCost: () => 15,
    constructionYears: 2,
    disruption: 0.2,
    unlockedBy: (s) => s.year >= 3,
    applicable: (s) => s.street.roundabouts.length < 5,
    apply: (s) => { s.street.roundabouts = [...s.street.roundabouts, s.street.roundabouts.length] },
  }),
  make({
    id: 'capital.plaza_end',
    tab: 'capital',
    label: 'Convert the east end block to a plaza',
    description: 'Closes the easternmost block to through traffic and paves it as public space. Two construction seasons.',
    capitalCost: (s) => 3100000 * costIndex(s.year),
    annualCost: (s) => 46000 * costIndex(s.year),
    pcCost: () => 24,
    constructionYears: 2,
    disruption: 0.15,
    unlockedBy: (s) => s.year >= 5,
    applicable: (s) => !s.street.plazaSegments.includes(C.CORRIDOR_SEGMENTS - 1),
    apply: (s) => { s.street.plazaSegments = [...s.street.plazaSegments, C.CORRIDOR_SEGMENTS - 1] },
  }),
  make({
    id: 'capital.plaza_middle',
    tab: 'capital',
    label: 'Convert a central block to a plaza',
    description: 'Closes one mid-corridor block to through traffic and paves it as public space. Two construction seasons.',
    capitalCost: (s) => 3100000 * costIndex(s.year),
    annualCost: (s) => 46000 * costIndex(s.year),
    pcCost: () => 24,
    constructionYears: 2,
    disruption: 0.15,
    unlockedBy: (s) => s.year >= 5,
    applicable: (s) => !s.street.plazaSegments.includes(6),
    apply: (s) => { s.street.plazaSegments = [...s.street.plazaSegments, 6] },
  }),
  make({
    id: 'capital.daylighting',
    tab: 'capital',
    label: 'Daylight every intersection',
    description: 'Removes parking and clutter within 25 feet of each crossing. Paint and bollards.',
    capitalCost: (s) => 240000 * costIndex(s.year),
    pcCost: () => 7,
    constructionYears: 1,
    applicable: (s) => !s.street.daylighting,
    apply: (s) => { s.street.daylighting = true },
  }),
  make({
    id: 'capital.bulb_outs',
    tab: 'capital',
    label: 'Build kerb extensions at crossings',
    description: 'Extends the kerb into the parking lane at each marked crossing. Requires kerbside parking. Two construction seasons.',
    capitalCost: (s) => (C.CORRIDOR_LENGTH_FT / s.street.crossingSpacingFt) * 4 * 42000 * costIndex(s.year),
    pcCost: () => 11,
    constructionYears: 2,
    disruption: 0.1,
    applicable: (s) => !s.street.bulbOuts && s.street.onStreetParking !== 'none',
    apply: (s) => { s.street.bulbOuts = true },
  }),
  make({
    id: 'capital.undergrounding',
    tab: 'capital',
    label: 'Put the overhead utilities underground',
    description: 'Removes poles and overhead wires along the corridor. Three construction seasons. Very expensive.',
    capitalCost: (s) => C.UTILITY_UNDERGROUNDING_COST_PER_MILE * corridorMiles * costIndex(s.year),
    pcCost: () => 12,
    constructionYears: 3,
    disruption: 0.3,
    unlockedBy: (s) => s.year >= 6,
    applicable: (s) => !s.street.utilitiesUndergrounded,
    apply: (s) => { s.street.utilitiesUndergrounded = true },
  }),
  make({
    id: 'capital.transit_stops',
    tab: 'capital',
    label: 'Upgrade the bus stops',
    description: 'Shelters, seating, lighting and real-time signs at every stop on the corridor.',
    capitalCost: (s) => 780000 * costIndex(s.year),
    annualCost: (s) => 26000 * costIndex(s.year),
    pcCost: () => 6,
    constructionYears: 1,
    unlockedBy: (s) => s.street.transitBusesPerHour >= 2,
    applicable: (s) => !s.street.transitStopsUpgraded,
    apply: (s) => { s.street.transitStopsUpgraded = true },
  }),
]

export const INSTRUMENTS: readonly Instrument[] = [...street, ...land, ...fiscal, ...capital]

export function instrumentById(id: string): Instrument | undefined {
  return INSTRUMENTS.find((i) => i.id === id)
}

export function availableInstruments(state: SimState): Instrument[] {
  return INSTRUMENTS.filter((i) => i.unlockedBy(state) && i.applicable(state))
}

/** Instruments in a tab that the player can see, whether or not usable now. */
export function instrumentsForTab(state: SimState, tab: InstrumentTab): Instrument[] {
  return INSTRUMENTS.filter((i) => i.tab === tab && i.unlockedBy(state))
}
