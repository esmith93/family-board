/**
 * The shape of Fairview.
 *
 * Everything here is plain data: serializable, structurally cloneable, and
 * free of behaviour. The model modules read it and return a new state; nothing
 * mutates a state it was handed.
 */

// ---------------------------------------------------------------------------
// Land
// ---------------------------------------------------------------------------

/**
 * The land use classes the corridor can hold. Ordered roughly by intensity,
 * which is also roughly the order of revenue per acre.
 */
export type LandUse =
  | 'vacant'
  | 'surface_parking'
  | 'auto_service'      // gas, drive-thru, car wash, tyre shop, quick lube
  | 'big_box'           // single-storey anchor with a field of parking
  | 'strip_mall'        // single-storey retail bar set behind parking
  | 'single_family'
  | 'garden_apartment'  // two- to three-storey walk-ups, surface parked
  | 'office_park'
  | 'mainstreet_mixed'  // two- to three-storey, shopfront at the sidewalk
  | 'midrise_mixed'     // four- to six-storey, ground-floor retail
  | 'civic'             // school, library, city hall
  | 'park'
  | 'plaza'

export const LAND_USES: readonly LandUse[] = [
  'vacant', 'surface_parking', 'auto_service', 'big_box', 'strip_mall',
  'single_family', 'garden_apartment', 'office_park', 'mainstreet_mixed',
  'midrise_mixed', 'civic', 'park', 'plaza',
]

/** Which side of the boulevard a parcel fronts. */
export type Side = 'north' | 'south'

export interface Business {
  id: string
  kind: BusinessKind
  /** Leasable floor area, square feet. */
  floorArea: number
  /** Annual gross sales, dollars. */
  sales: number
  /** Consecutive years the business has failed to cover rent + operating cost. */
  distressYears: number
  yearOpened: number
}

export type BusinessKind =
  | 'grocery'
  | 'pharmacy'
  | 'restaurant'
  | 'cafe'
  | 'bar'
  | 'convenience'
  | 'apparel'
  | 'hardware'
  | 'salon'
  | 'clinic'
  | 'gym'
  | 'office'
  | 'auto'
  | 'chain_anchor'

export interface Parcel {
  id: string
  /** Position along the corridor, in feet from the west end. */
  station: number
  side: Side
  /** 0 fronts the boulevard; 1 is the block behind it. */
  depth: number
  acres: number
  use: LandUse
  stories: number
  /** Gross building floor area, square feet. */
  floorArea: number
  surfaceStalls: number
  structuredStalls: number
  /** Assessed land value, dollars. */
  landValue: number
  /** Assessed improvement value, dollars. */
  improvementValue: number
  businesses: Business[]
  /** Occupied dwelling units. */
  dwellings: number
  residents: number
  yearBuilt: number
  /** 0 = derelict, 1 = new. Drives redevelopment pressure and assessed value. */
  condition: number
  /** Curb cuts onto the boulevard. Drives turning conflicts. */
  curbCuts: number
  /**
   * Feet from the pavement to the front of the building AS BUILT.
   *
   * Not the same as the use's preference and not the same as today's rule. A
   * building put up under a forty-foot minimum stands forty feet back for the
   * rest of its life, whatever the council votes afterwards; the rule only
   * reaches the next thing built on the site. Which is why changing it in year
   * two shows up in year fourteen and not before.
   */
  frontSetbackFt: number
  /** Tree canopy shading this parcel, 0..1. */
  canopy: number
}

// ---------------------------------------------------------------------------
// The street
// ---------------------------------------------------------------------------

export type ParkingRegime = 'none' | 'free' | 'metered'
export type BikeFacility = 'none' | 'sharrow' | 'painted' | 'buffered' | 'protected'
export type MedianType = 'none' | 'twltl' | 'raised' | 'landscaped'
export type SignalPolicy = 'vehicle_progression' | 'balanced' | 'pedestrian_priority'
export type LightingType = 'cobra_highmast' | 'cobra_standard' | 'pedestrian_scale'

export interface StreetState {
  /** Through lanes in each direction. Fairview starts at 3. */
  throughLanesPerDirection: number
  laneWidthFt: number
  /** Posted/design speed, mph. Design speed is what drivers actually read. */
  designSpeedMph: number
  onStreetParking: ParkingRegime
  meterPricePerHour: number
  bikeFacility: BikeFacility
  sidewalkWidthFt: number
  /** Feet between legal, marked crossings. Fairview starts at ~1300. */
  crossingSpacingFt: number
  signalCycleSec: number
  signalPolicy: SignalPolicy
  median: MedianType
  /** Shade trees per mile per side. */
  treesPerMilePerSide: number
  /**
   * When each cohort of street trees went in.
   *
   * A tree's age is not the city's age. Fairview's handful of old ones were
   * planted before anybody now on the council was born; the forty a mile the
   * player buys in year nineteen are sticks in year twenty-one and shade in
   * year thirty-four, and the two stand next to each other on the same block.
   * Recording only a total would draw them all the same height.
   */
  treePlantings: { year: number; perMilePerSide: number }[]
  lighting: LightingType
  busLane: boolean
  /** Buses per hour, peak direction. 0 = no service. */
  transitBusesPerHour: number
  /** Segments converted to a roundabout, by intersection index. */
  roundabouts: number[]
  /** Segments converted to a plaza (no through traffic). */
  plazaSegments: number[]
  /** Corner daylighting applied at intersections. */
  daylighting: boolean
  /** Curb extensions at crossings. */
  bulbOuts: boolean
  /** Utilities placed underground (removes pole clutter, costs a great deal). */
  utilitiesUndergrounded: boolean
  transitStopsUpgraded: boolean
  /** Years of deferred resurfacing. Drives condition and ride quality. */
  pavementAgeYears: number
}

// ---------------------------------------------------------------------------
// Policy
// ---------------------------------------------------------------------------

export type UseMixing = 'segregated' | 'limited' | 'mixed'

export interface ZoningState {
  /** Required parking stalls per 1,000 sqft of retail. */
  parkingMinPerKsfRetail: number
  /** Required parking stalls per dwelling unit. */
  parkingMinPerDwelling: number
  frontSetbackFt: number
  useMixing: UseMixing
  heightLimitStories: number
  /** Maximum share of the lot the building may cover, 0..1. */
  maxLotCoverage: number
  aduLegal: boolean
  formBasedCode: boolean
  minLotSizeSqft: number
}

export interface FiscalPolicy {
  /**
   * Multiplier on the statutory rates. 1.0 is the rate Fairview levies today;
   * raising it is an instrument, and an expensive one politically.
   */
  propertyTaxMultiplier: number
  /**
   * 0 = tax land and improvements alike; 1 = tax land only. Between the two,
   * the improvement share of the rate is reduced and the land share raised to
   * hold revenue neutral at adoption.
   */
  landValueTaxSplit: number
  impactFeePerDwelling: number
  tif: { active: boolean; baseYear: number; baseValue: number } | null
  bid: { active: boolean; rate: number } | null
}

// ---------------------------------------------------------------------------
// Traffic and travel
// ---------------------------------------------------------------------------

export type Mode = 'drive' | 'walk' | 'bike' | 'transit'
export const MODES: readonly Mode[] = ['drive', 'walk', 'bike', 'transit']

export interface TrafficState {
  /** Annual average daily traffic on the corridor, vehicles. */
  aadt: number
  /**
   * The AADT the corridor would carry at equilibrium given today's generalized
   * cost. Actual AADT chases this with a lag: that lag is induced demand.
   */
  latentAadt: number
  /** Peak-hour running speed, mph. */
  peakSpeedMph: number
  /** Off-peak running speed, mph. */
  offPeakSpeedMph: number
  /** Peak-hour volume-to-capacity ratio. */
  volumeCapacityRatio: number
  /** Vehicle miles travelled on the corridor per year. */
  corridorVmt: number
  /** Regional background growth index, 1.0 at year 0. */
  regionalIndex: number
}

export interface ModeShare {
  drive: number
  walk: number
  bike: number
  transit: number
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

export type DestinationKind = 'grocery' | 'school' | 'work' | 'park' | 'friend' | 'clinic'
export const DESTINATION_KINDS: readonly DestinationKind[] = [
  'grocery', 'school', 'work', 'park', 'friend', 'clinic',
]

export interface Destination {
  kind: DestinationKind
  /** Station along the corridor, feet. */
  station: number
  side: Side
  /** Extra distance off the corridor, feet. */
  offset: number
  /** True if this is a regional destination reached only by leaving the corridor. */
  offCorridor: boolean
}

/**
 * A representative household. The sim carries a few hundred of these and
 * weights them; it does not attempt to model 120,000 people individually.
 */
export interface Household {
  id: string
  /** How many real households this one stands for. */
  weight: number
  station: number
  side: Side
  /** Blocks back from the boulevard. 0 means fronting it. */
  depth: number
  /** Annual household income, dollars. */
  income: number
  /** Vehicles available. Emergent: households shed cars when they can. */
  vehicles: number
  /** Children of school age. */
  children: number
  /** 0..1. How willing this household is to walk, before the street is considered. */
  walkPropensity: number
  /**
   * Where this household's friends actually live. A specific place, assigned
   * once - not "the nearest building with flats in it", which would make
   * every household's social life implausibly walkable.
   */
  friend: { station: number; side: Side; offset: number }
  /**
   * Where this household works. Assigned once, like the friend: a job is a
   * specific place, not "the nearest employer". Most of Fairview works
   * somewhere other than Commerce Blvd.
   */
  work: { station: number; side: Side; offset: number; onCorridor: boolean }
  /** Years remaining before this household reconsiders whether to stay. */
  patience: number
}

/** What a household can actually reach, and how. */
export interface ReachabilityRecord {
  householdId: string
  weight: number
  /** For each destination kind, the modes that reach it within 15 minutes. */
  within15: Record<DestinationKind, Mode[]>
  /** Annual household transport cost, dollars. */
  transportCost: number
  /** Whether a school-age child could make the school trip alone, on foot. */
  childCanWalkToSchool: boolean
}

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

export interface EnvironmentState {
  /** A-weighted equivalent sound level at the sidewalk, dBA. */
  sidewalkNoiseDba: number
  /** A-weighted equivalent sound level 100ft back from the kerb, dBA. */
  setbackNoiseDba: number
  /** Near-road PM2.5 increment over regional background, ug/m3. */
  pm25Increment: number
  /** Near-road NO2 increment over regional background, ppb. */
  no2Increment: number
  /** Share of corridor land that sheds water, 0..1. */
  imperviousFraction: number
  /** Share of corridor land under tree canopy, 0..1. */
  canopyFraction: number
  /** Afternoon air temperature above the rural reference, degrees F. */
  airTempExcessF: number
  /** Peak summer pavement surface temperature above air temperature, degrees F. */
  surfaceTempExcessF: number
  /** Days per year the corridor exceeds 95F. */
  daysOver95: number
}

// ---------------------------------------------------------------------------
// Safety
// ---------------------------------------------------------------------------

export interface SafetyState {
  /** Total reported crashes on the corridor this year. */
  crashes: number
  /** Crashes by KABCO-style severity. */
  fatal: number
  seriousInjury: number
  minorInjury: number
  propertyDamageOnly: number
  pedestrianCrashes: number
  pedestrianFatal: number
  bicycleCrashes: number
  bicycleFatal: number
  /** Comprehensive societal cost of this year's crashes, dollars. */
  societalCost: number
}

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

export interface Revenue {
  propertyTax: number
  salesTax: number
  parkingMeters: number
  impactFees: number
  bid: number
  stateAid: number
  total: number
}

export interface Expenses {
  roadMaintenance: number
  roadReconstructionReserve: number
  utilityMaintenance: number
  lighting: number
  signals: number
  sidewalkMaintenance: number
  emergencyResponse: number
  transitSubsidy: number
  parksAndTrees: number
  debtService: number
  total: number
}

export interface FiscalState {
  revenue: Revenue
  expenses: Expenses
  /** Revenue minus expenses this year. Negative accumulates as debt. */
  surplus: number
  /** Outstanding general obligation debt, dollars. */
  debt: number
  /** Cash reserve. Goes negative into debt. */
  reserve: number
  /** Annual revenue per acre of corridor land, dollars. */
  revenuePerAcre: number
  /** Annual infrastructure liability per acre of corridor land, dollars. */
  liabilityPerAcre: number
}

// ---------------------------------------------------------------------------
// Construction and instruments
// ---------------------------------------------------------------------------

export interface ActiveProject {
  instrumentId: string
  label: string
  yearStarted: number
  yearsRemaining: number
  /** Total capital cost, spread across the construction years. */
  totalCost: number
  /** Fraction of corridor capacity lost while under construction, 0..1. */
  disruption: number
  /** Applied to state when the last year ticks over. */
  payload: Record<string, unknown>
}

/** A commitment the city has taken on that it cannot walk away from. */
export interface Obligation {
  id: string
  label: string
  /** Annual cost in dollars, indexed to inflation. */
  annualCost: number
  /** Years remaining, or null for permanent. */
  yearsRemaining: number | null
  /** Set when the obligation came from accepting outside money. */
  origin: 'state_grant' | 'debt' | 'contract' | 'policy'
}

// ---------------------------------------------------------------------------
// Political capital
// ---------------------------------------------------------------------------

export interface PoliticsState {
  /** Political capital. Hits zero and the player is fired. */
  capital: number
  /** Overall approval, 0..100. Drives the annual capital award. */
  approval: number
  /** Approval among distinct constituencies, 0..100. */
  factions: {
    drivers: number
    merchants: number
    homeowners: number
    renters: number
    taxpayers: number
  }
}

// ---------------------------------------------------------------------------
// Glossary
// ---------------------------------------------------------------------------

/**
 * Vocabulary the player earns by causing the phenomenon. Never shown before
 * the corresponding event fires.
 */
export interface GlossaryState {
  unlocked: string[]
  /** Year each card unlocked, for the end-of-run timeline. */
  unlockedAt: Record<string, number>
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

export interface SimState {
  seed: string
  /** 0 is the year the player is hired. The run ends after year 30. */
  year: number
  rngDraws: number

  parcels: Parcel[]
  street: StreetState
  zoning: ZoningState
  fiscalPolicy: FiscalPolicy

  households: Household[]
  destinations: Destination[]

  traffic: TrafficState
  modeShare: ModeShare
  environment: EnvironmentState
  safety: SafetyState
  fiscal: FiscalState
  politics: PoliticsState

  activeProjects: ActiveProject[]
  obligations: Obligation[]
  glossary: GlossaryState

  /** Instruments the player has unlocked so far. */
  unlockedInstruments: string[]
  /**
   * Instruments that have actually taken effect, and the year they did.
   *
   * Not what was selected and not what is under construction: what is built
   * and working. The glossary reads this, because the difference between a
   * word the player earned and a word the game handed them is whether they
   * did the thing, and nothing else in the state records that they did.
   */
  completed: Record<string, number>
  /** Ledger View is earned, never given. */
  ledgerUnlocked: boolean

  /** Housing rent index for the corridor, dollars per month for a median unit. */
  medianRent: number
  /** Corridor jobs. */
  jobs: number
  /** Corridor population. */
  population: number

  /** Year-zero values the elasticities are measured against. Never changes. */
  baseline: {
    laneMiles: number
    localVehicleTrips: number
    lanesPerDirection: number
    peakSpeedMph: number
    revenuePerAcre: number
    liabilityPerAcre: number
    /*
     * The rest are here for the glossary, which must be able to tell what the
     * player CHANGED from what they were handed. A card that fires on the
     * corridor as inherited is a card the game gave away.
     */
    designSpeedMph: number
    walkShare: number
    crashes: number
    curbCuts: number
  }

  /**
   * Residents who gave up on the corridor and moved away, cumulative since
   * year zero. Counts departures driven by cost, rent or unreachability - not
   * ordinary moves - so it can exceed the corridor's population over thirty
   * years without anything being wrong.
   */
  residentsLeft: number

  /** Set when the run has ended, with the reason. */
  ended: { year: number; reason: 'fired' | 'insolvent' | 'completed' } | null

  /** Events that fired this year, for the newspaper and the glossary. */
  events: SimEvent[]
  /** Everything that has happened, for the end-of-run reckoning. */
  history: YearSnapshot[]
}

export interface SimEvent {
  id: string
  year: number
  kind: 'fiscal' | 'street' | 'land' | 'safety' | 'people' | 'political' | 'environment'
  /** Machine-readable. The newspaper decides how to phrase it, badly. */
  detail: Record<string, number | string | boolean>
}

/** One year, flattened, for charts and the reckoning. */
export interface YearSnapshot {
  year: number
  aadt: number
  peakSpeedMph: number
  corridorVmt: number
  modeShare: ModeShare
  revenue: number
  expenses: number
  surplus: number
  debt: number
  revenuePerAcre: number
  liabilityPerAcre: number
  approval: number
  capital: number
  population: number
  jobs: number
  businesses: number
  medianRent: number
  crashes: number
  fatal: number
  pedestrianFatal: number
  noiseDba: number
  canopyFraction: number
  daysOver95: number
  airTempExcessF: number
  /** Share of households that can reach a grocery within 15 minutes on foot. */
  groceryWalkShare: number
  /** Share of school-age children who could walk to school alone. */
  childWalkShare: number
  /** Household transport cost as a share of income. */
  transportCostShare: number
  residentsLeft: number
}
