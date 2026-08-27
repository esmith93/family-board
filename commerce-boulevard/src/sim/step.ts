/**
 * One year of Fairview.
 *
 * The order below matters. Traffic responds to the street using LAST year's
 * mode share, because people do not re-plan their lives in January. Mode share
 * then responds to this year's street and this year's destinations. Land use
 * responds to everything, slowly, and the budget responds to land use two
 * years after that. Those lags are the game.
 */

import { C } from './constants'
import { corridorAcres, createInitialState } from './corridor'
import {
  borrowingHeadroom, committedCapital, computeExpenses, computeLiability, computeRevenue,
  countNewDwellings, stepFiscal,
} from './fiscal'
import { costIndex, priceIndex } from './fiscal'
import { checkGlossary } from './glossary'
import { instrumentById } from './instruments'
import {
  computeAbsorption, corridorJobs, corridorPopulation, stepAssessments, stepHousing,
  stepRedevelopment, stepRetail,
} from './economy'
import { stepEnvironment } from './environment'
import { makeRng } from './rng'
import { stepSafety } from './safety'
import { laneMiles, localTripGeneration, stepTraffic } from './traffic'
import { computeTravel, desiredVehicles, makeTravelContext } from './travel'
import type { ActiveProject, Obligation, SimEvent, SimState, YearSnapshot } from './types'

export interface YearResult {
  state: SimState
  /** Instruments that could not be started, and why. */
  rejected: { instrumentId: string; reason: string }[]
}

/** A fresh run. */
export function newGame(seed: string): SimState {
  const state = createInitialState(seed)
  // Establish the baselines the elasticities measure against.
  const rng = makeRng(`${seed}:bootstrap`)
  const retail = stepRetail(state.parcels, corridorPopulation(state.parcels), state.modeShare, 0, rng)
  state.parcels = retail.parcels
  state.jobs = corridorJobs(state.parcels)
  state.population = corridorPopulation(state.parcels)

  state.baseline.laneMiles = laneMiles(state.street)
  state.baseline.lanesPerDirection = state.street.throughLanesPerDirection
  state.baseline.localVehicleTrips =
    (localTripGeneration(state.parcels) * state.modeShare.drive) / C.VEHICLE_OCCUPANCY

  // Run the physical models once so year zero has real readings on the dials.
  state.traffic = stepTraffic(state.traffic, {
    street: state.street,
    parcels: state.parcels,
    modeShare: state.modeShare,
    disruption: 0,
    baselineLaneMiles: state.baseline.laneMiles,
    baselineLocalTrips: state.baseline.localVehicleTrips,
    baselinePeakSpeedMph: 0,
  })
  state.baseline.peakSpeedMph = state.traffic.peakSpeedMph
  state.environment = stepEnvironment(state.street, state.parcels, state.traffic, 0)

  const ctx = makeTravelContext(state.street, state.parcels, state.environment, state.traffic)
  const travel = computeTravel(state.households, ctx)
  state.modeShare = travel.modeShare
  state.destinations = [...ctx.destinations]

  const personTrips = localTripGeneration(state.parcels) * 365
  state.safety = stepSafety({
    street: state.street,
    parcels: state.parcels,
    traffic: state.traffic,
    modeShare: state.modeShare,
    operatingSpeed: ctx.operatingSpeed,
    personTripsPerYear: personTrips,
    baselineLanes: state.baseline.lanesPerDirection,
  })

  const revenue = computeRevenue({
    parcels: state.parcels, policy: state.fiscalPolicy, street: state.street,
    newDwellings: 0, stateAid: 0,
  })
  const expenses = computeExpenses({
    street: state.street, parcels: state.parcels, safety: state.safety,
    obligations: [], debt: 0, year: 0, transitBoardings: travel.transitBoardings, capitalSpend: 0,
  })
  state.fiscal = stepFiscal(revenue, expenses, state.fiscal, state.street, state.parcels, 0)
  state.baseline.revenuePerAcre = state.fiscal.revenuePerAcre
  state.baseline.liabilityPerAcre = state.fiscal.liabilityPerAcre
  // What the corridor was like before the player touched it, so the glossary
  // can tell a thing they did from a thing they inherited.
  state.baseline.designSpeedMph = state.street.designSpeedMph
  state.baseline.walkShare = state.modeShare.walk
  state.baseline.crashes = state.safety.crashes
  state.baseline.curbCuts = state.parcels.reduce((sum, p) => sum + p.curbCuts, 0)

  state.history = [snapshotOf(state, travel, 0)]
  return state
}

/**
 * Advance one year, having committed to the listed instruments.
 *
 * Instruments are paid for and queued here; most only take effect after their
 * construction years have passed.
 */
export function advanceYear(state: SimState, chosenInstrumentIds: readonly string[] = []): YearResult {
  if (state.ended) return { state, rejected: [] }

  const next: SimState = structuredClone(state)
  const rng = makeRng(`${state.seed}:year:${state.year + 1}`)
  const rejected: YearResult['rejected'] = []
  next.events = []

  // --- 1. Commit to this year's instruments ---
  // Money is as real a constraint as political capital. The city can borrow,
  // but not without limit, and the limit tightens as the debt grows.
  let headroom = borrowingHeadroom(next) - committedCapital(next)
  for (const id of chosenInstrumentIds) {
    const instrument = instrumentById(id)
    if (!instrument) { rejected.push({ instrumentId: id, reason: 'unknown instrument' }); continue }
    if (!instrument.unlockedBy(next)) { rejected.push({ instrumentId: id, reason: 'not unlocked' }); continue }
    if (!instrument.applicable(next)) { rejected.push({ instrumentId: id, reason: 'not applicable' }); continue }
    const pc = instrument.pcCost(next)
    if (pc > next.politics.capital) { rejected.push({ instrumentId: id, reason: 'not enough political capital' }); continue }

    const cost = instrument.capitalCost(next)
    if (cost > headroom) { rejected.push({ instrumentId: id, reason: 'not enough borrowing capacity' }); continue }

    next.politics.capital -= pc
    headroom -= cost
    const annual = instrument.annualCost(next)

    if (instrument.constructionYears === 0) {
      instrument.apply(next)
      next.completed[instrument.id] ??= next.year
      if (cost > 0) next.fiscal.reserve -= cost
    } else {
      const project: ActiveProject = {
        instrumentId: instrument.id,
        label: instrument.label,
        yearStarted: next.year,
        yearsRemaining: instrument.constructionYears,
        totalCost: cost,
        disruption: instrument.disruption,
        payload: {},
      }
      next.activeProjects.push(project)
    }

    if (annual > 0) {
      next.obligations.push({
        id: `${instrument.id}:${next.year}`,
        label: instrument.label,
        annualCost: annual,
        yearsRemaining: null,
        origin: 'policy',
      })
    }
    next.events.push({
      id: 'instrument_started', year: next.year, kind: 'political',
      detail: { instrument: instrument.id, label: instrument.label, pc },
    })
  }

  // --- 2. Construction ticks ---
  let capitalSpend = 0
  let disruption = 0
  const stillRunning: ActiveProject[] = []
  for (const project of next.activeProjects) {
    const perYear = project.totalCost / Math.max(1, project.yearsRemaining + 0)
    capitalSpend += project.totalCost / Math.max(1, projectDuration(project))
    void perYear
    disruption = Math.min(0.7, disruption + project.disruption)
    const remaining = project.yearsRemaining - 1
    if (remaining <= 0) {
      const instrument = instrumentById(project.instrumentId)
      if (instrument) instrument.apply(next)
      next.completed[project.instrumentId] ??= next.year + 1
      // Something finished, and finishing things is popular.
      next.politics.approval = clamp(next.politics.approval + C.APPROVAL_RIBBON_CUTTING, 0, 100)
      next.politics.capital = clamp(next.politics.capital + C.PC_RIBBON_CUTTING, 0, 120)
      next.events.push({
        id: 'project_opened', year: next.year + 1, kind: 'street',
        detail: { instrument: project.instrumentId, label: project.label },
      })
    } else {
      stillRunning.push({ ...project, yearsRemaining: remaining })
    }
  }
  next.activeProjects = stillRunning

  // --- 3. The year turns ---
  next.year += 1
  next.street.pavementAgeYears += 1
  growCanopy(next)
  forceReconstructionIfFailed(next)

  // --- 4. Traffic, using last year's mode share ---
  next.traffic = stepTraffic(next.traffic, {
    street: next.street,
    parcels: next.parcels,
    modeShare: next.modeShare,
    disruption,
    baselineLaneMiles: next.baseline.laneMiles,
    baselineLocalTrips: next.baseline.localVehicleTrips,
    baselinePeakSpeedMph: next.baseline.peakSpeedMph,
  })

  // --- 5. What the corridor is like to stand next to ---
  next.environment = stepEnvironment(next.street, next.parcels, next.traffic, next.year)

  // --- 6. How people travel, and what they can reach ---
  const ctx = makeTravelContext(next.street, next.parcels, next.environment, next.traffic)
  const travel = computeTravel(next.households, ctx)
  next.modeShare = travel.modeShare
  next.destinations = [...ctx.destinations]

  // --- 7. Crashes ---
  const personTrips = localTripGeneration(next.parcels) * 365
  next.safety = stepSafety({
    street: next.street,
    parcels: next.parcels,
    traffic: next.traffic,
    modeShare: next.modeShare,
    operatingSpeed: ctx.operatingSpeed,
    personTripsPerYear: personTrips,
    baselineLanes: next.baseline.lanesPerDirection,
  })

  // --- 8. Shops ---
  const retail = stepRetail(next.parcels, next.population, next.modeShare, next.year, rng.fork('retail'))
  next.parcels = retail.parcels
  if (retail.closures > 0 || retail.openings > 0) {
    next.events.push({
      id: 'retail_churn', year: next.year, kind: 'land',
      detail: { openings: retail.openings, closures: retail.closures },
    })
  }

  // --- 9. Land turning over ---
  const parcelsBefore = next.parcels
  const absorption = computeAbsorption(next, ctx.hostility, next.modeShare)
  const redevelopment = stepRedevelopment(next, rng.fork('redevelop'), absorption)
  next.parcels = redevelopment.parcels
  for (const change of redevelopment.redeveloped) {
    next.events.push({
      id: 'redevelopment', year: next.year, kind: 'land',
      detail: { parcel: change.parcelId, from: change.from, to: change.to },
    })
  }
  const newDwellings = countNewDwellings(parcelsBefore, next.parcels)

  // --- 10. Assessments, jobs, people, rent ---
  next.parcels = stepAssessments(next)
  next.jobs = corridorJobs(next.parcels)
  next.population = corridorPopulation(next.parcels)
  next.medianRent = stepHousing(next, absorption)

  // --- 11. The budget ---
  const stateAid = collectStateAid(next)
  const revenue = computeRevenue({
    parcels: next.parcels, policy: next.fiscalPolicy, street: next.street, newDwellings, stateAid,
  })
  const expenses = computeExpenses({
    street: next.street, parcels: next.parcels, safety: next.safety,
    obligations: next.obligations, debt: next.fiscal.debt, year: next.year,
    transitBoardings: travel.transitBoardings, capitalSpend,
  })
  const previousFiscal = next.fiscal
  next.fiscal = stepFiscal(revenue, expenses, previousFiscal, next.street, next.parcels, next.year)

  // Obligations with a clock tick down.
  next.obligations = next.obligations
    .map((o): Obligation => (o.yearsRemaining === null ? o : { ...o, yearsRemaining: o.yearsRemaining - 1 }))
    .filter((o) => o.yearsRemaining === null || o.yearsRemaining > 0)

  // --- 12. Politics ---
  updatePolitics(next, state, disruption, retail.closures, retail.openings)

  // --- 13. Households reconsider ---
  updateHouseholds(next, travel, rng.fork('households'))

  // --- 14. What the player is allowed to know ---
  const snapshot = snapshotOf(next, travel, next.year)
  next.history = [...next.history, snapshot]
  maybeUnlockLedger(next)
  const unlocked = checkGlossary(next)
  for (const id of unlocked) {
    next.glossary.unlocked.push(id)
    next.glossary.unlockedAt[id] = next.year
    next.events.push({ id: 'glossary_unlocked', year: next.year, kind: 'people', detail: { card: id } })
  }

  // --- 15. Is the player still employed ---
  checkEnding(next)

  return { state: next, rejected }
}

/**
 * A road that has reached the end of its life gets rebuilt whether the city
 * budgeted for it or not. This is the obligation the widening quietly doubled,
 * arriving on a schedule nobody set.
 */
function forceReconstructionIfFailed(state: SimState): void {
  if (state.street.pavementAgeYears < C.PAVEMENT_RECONSTRUCT_CYCLE_YEARS) return
  if (state.activeProjects.some((p) => p.instrumentId === 'capital.reconstruct')) return

  /*
   * More than the same job done on purpose.
   *
   * Measured across thirteen corridors, a director who never resurfaced ended
   * with a BETTER thirty-year surplus than one who did on nine of them, and
   * the same peak speed. Letting the road fail was simply cheaper: the
   * emergency rebuild was priced at the planned rate, so thirteen years of
   * deferral came free. An unplanned reconstruction is mobilised in a hurry,
   * tendered to whoever is available, and sequenced around a base that has
   * already gone.
   */
  const cost = laneMiles(state.street) * C.ROAD_RECONSTRUCT_COST_PER_LANE_MILE
    * costIndex(state.year) * C.EMERGENCY_RECONSTRUCTION_PREMIUM
  state.activeProjects.push({
    instrumentId: 'capital.reconstruct',
    label: 'Emergency reconstruction: Commerce Blvd has reached the end of its life',
    yearStarted: state.year,
    yearsRemaining: 3,
    totalCost: cost,
    disruption: 0.3,
    payload: { forced: true },
  })
  state.events.push({
    id: 'forced_reconstruction', year: state.year, kind: 'fiscal',
    detail: { cost: Math.round(cost), laneMiles: Math.round(laneMiles(state.street) * 100) / 100 },
  })
}

function projectDuration(project: ActiveProject): number {
  const instrument = instrumentById(project.instrumentId)
  return instrument ? Math.max(1, instrument.constructionYears) : 1
}

/**
 * Trees grow. This is the slowest feedback in the game and the model does not
 * pretend otherwise: canopy planted in year 25 is still a sapling at year 30.
 */
function growCanopy(state: SimState): void {
  const rate = 1 / C.STREET_TREE_MATURITY_YEARS
  for (const parcel of state.parcels) {
    const target = parcel.use === 'park' ? 0.62 : parcel.canopy
    parcel.canopy = Math.min(0.85, parcel.canopy + (target - parcel.canopy) * rate)
  }
}

/** State and federal money attached to obligations the city has accepted. */
function collectStateAid(state: SimState): number {
  let aid = 0
  for (const project of state.activeProjects) {
    if (project.instrumentId === 'capital.state_widening') {
      aid += (project.totalCost / Math.max(1, projectDuration(project))) * C.STATE_GRANT_MATCH_RATIO
    }
  }
  return aid
}

function updatePolitics(
  next: SimState, previous: SimState, disruption: number, closures: number, openings: number,
): void {
  /*
   * What residents have got used to, not what happened last Tuesday.
   *
   * Measuring against a single previous year made approval a step function.
   * Removing a through lane takes ten miles an hour off the peak in the year
   * it happens, and at six approval points per ten per cent of travel time
   * that is a forty-point collapse in one year - which is a sacking. Measured
   * across the reference plan, one year in eight fell more than fifteen points
   * and the worst fell forty-four. The reference plan was not losing directors
   * to being wrong. It was losing them to a transient.
   *
   * An opinion of the traffic is formed over a few years of driving it.
   * Averaging over three gives the same total displeasure for a road that is
   * permanently slower, spreads it over the time it takes anyone to form the
   * view, and lets a corridor whose traffic evaporates within three years get
   * away with most of it - which is the thing about a road diet that nobody
   * believes until they have watched one happen.
   */
  const recent = previous.history.slice(-3)
  const settled = recent.length > 0
    ? recent.reduce((total, h) => total + h.peakSpeedMph, 0) / recent.length
    : previous.traffic.peakSpeedMph
  const previousSpeed = Math.max(1, settled)
  // Travel time, not speed: a 10% slower trip is what a resident notices.
  const travelTimeChange = previousSpeed / Math.max(1, next.traffic.peakSpeedMph) - 1

  let delta = 0
  /*
   * Bounded, in both directions.
   *
   * The delay curve is hyperbolic near capacity, so a single year at the wrong
   * side of it produced a two-hundred-per-cent travel-time change and a
   * hundred-and-thirty-point approval loss - more approval than exists. A road
   * that stays slow keeps costing the cap every year until the settled average
   * catches up with it, which is the same total displeasure delivered at the
   * speed an opinion actually forms.
   */
  const congestion = C.APPROVAL_CONGESTION_SENSITIVITY * (travelTimeChange / 0.1)
  delta -= Math.max(-C.APPROVAL_CONGESTION_ANNUAL_CAP,
    Math.min(C.APPROVAL_CONGESTION_ANNUAL_CAP, congestion))
  delta += C.PC_SURPLUS_SENSITIVITY * (next.fiscal.surplus / 1_000_000)
  delta -= disruption * 14
  delta -= closures * 0.35
  delta += openings * 0.22
  delta -= ((next.medianRent - previous.medianRent) / Math.max(1, previous.medianRent)) * 30
  delta -= Math.max(0, next.safety.fatal - previous.safety.fatal) * C.APPROVAL_FATALITY_SENSITIVITY
  delta -= (next.fiscalPolicy.propertyTaxMultiplier - previous.fiscalPolicy.propertyTaxMultiplier) * 90

  next.politics.approval = clamp(next.politics.approval + delta, 0, 100)

  const factions = next.politics.factions
  factions.drivers = clamp(factions.drivers
    - C.APPROVAL_CONGESTION_SENSITIVITY * 1.6 * (travelTimeChange / 0.1)
    - disruption * 20
    + (next.street.throughLanesPerDirection - previous.street.throughLanesPerDirection) * 9
    - (previous.street.designSpeedMph - next.street.designSpeedMph) * 1.4, 0, 100)
  factions.merchants = clamp(factions.merchants
    - closures * 1.1 + openings * 0.8 - disruption * 22
    + (next.modeShare.walk - previous.modeShare.walk) * 90
    - (previous.street.onStreetParking !== 'none' && next.street.onStreetParking === 'none' ? 8 : 0), 0, 100)
  factions.homeowners = clamp(factions.homeowners
    - (next.fiscalPolicy.propertyTaxMultiplier - previous.fiscalPolicy.propertyTaxMultiplier) * 130
    + (next.fiscal.revenuePerAcre - previous.fiscal.revenuePerAcre) / 400, 0, 100)
  factions.renters = clamp(factions.renters
    - ((next.medianRent - previous.medianRent) / Math.max(1, previous.medianRent)) * 70
    + (next.modeShare.transit - previous.modeShare.transit) * 120, 0, 100)
  factions.taxpayers = clamp(factions.taxpayers
    + next.fiscal.surplus / 700_000
    - (next.fiscal.debt - previous.fiscal.debt) / 900_000, 0, 100)

  /*
   * Capital accrues for a popular director and DRAINS for an unpopular one.
   *
   * The pivot used to sit at approval 20 over a span of 30, which sounds
   * reasonable and is not: a director running the game's own reference plan
   * averages about 34% approval, because half the plan is unpopular by
   * construction, and at that approval the old curve paid 3.5 points a year
   * against a plan that costs eleven. Better than a third of every plan was
   * refused for want of capital - not as a choice the player made, but as
   * arithmetic they could not see and could not have avoided.
   */
  const regeneration = C.PC_ANNUAL_REGENERATION_BASE
    * ((next.politics.approval - C.PC_REGENERATION_FLOOR_APPROVAL) / C.PC_REGENERATION_PIVOT_SPAN)
  next.politics.capital = clamp(next.politics.capital + regeneration, 0, 120)
}

function updateHouseholds(next: SimState, travel: ReturnType<typeof computeTravel>, rng: ReturnType<typeof makeRng>): void {
  const records = new Map(travel.reachability.map((r) => [r.householdId, r]))
  let left = 0

  next.households = next.households.map((household) => {
    const record = records.get(household.id)
    if (!record) return household

    const updated = { ...household }

    // Cars are shed slowly, and only when they have stopped being necessary.
    const wanted = desiredVehicles(household, record)
    if (wanted < household.vehicles && rng.chance(0.25)) updated.vehicles = household.vehicles - 1
    else if (wanted > household.vehicles && rng.chance(0.4)) updated.vehicles = household.vehicles + 1

    // Whether this is still somewhere to live.
    const costBurden = record.transportCost / Math.max(1, household.income)
    const rentBurden = (next.medianRent * 12) / Math.max(1, household.income)
    const reach = Object.values(record.within15).filter((modes) => modes.length > 0).length / 6
    const unhappy = costBurden > 0.28 || rentBurden > 0.4 || reach < 0.4

    updated.patience = unhappy ? household.patience - 1 : Math.min(6, household.patience + 1)

    if (updated.patience <= 0) {
      left += household.weight * 2.35
      // Somebody else moves in, on different terms.
      updated.patience = rng.int(3, 6)
      updated.income = Math.round(C.MEDIAN_HOUSEHOLD_INCOME * priceIndex(next.year) * Math.exp(rng.normal() * 0.45))
      updated.walkPropensity = Math.max(0.05, Math.min(0.95, 0.42 + rng.normal() * 0.2))
      updated.children = rng.next() < 0.31 ? rng.int(1, 3) : 0
    }
    return updated
  })

  next.residentsLeft += Math.round(left)
}

/**
 * The Ledger View is earned, never given.
 *
 * It unlocks when the player hits the wall - debt past a year and a half of
 * revenue, or a sustained deficit - which the brief puts somewhere between
 * year 12 and year 20.
 *
 * The floor used to be year 8 and a four-year deficit streak, and measured
 * over twenty corridors that put the player who took the state grant at year
 * 8 flat while the player who did nothing waited until 14. Which is backwards
 * twice over: it opens the argument before the widening has finished making
 * it, and it rewards the worse decision with the better tool. The floor is now
 * 11 and the streak six, so both paths land inside the window the brief asks
 * for and the view arrives when there is still time to act on it.
 */
const LEDGER_EARLIEST_YEAR = 11
const LEDGER_DEFICIT_STREAK = 6

function maybeUnlockLedger(state: SimState): void {
  if (state.ledgerUnlocked) return
  const deficitYears = state.history.slice(-LEDGER_DEFICIT_STREAK)
    .filter((h) => h.surplus < 0).length
  const drowning = state.fiscal.debt > state.fiscal.revenue.total * 1.5
  if (state.year < LEDGER_EARLIEST_YEAR) return
  if (drowning || deficitYears >= LEDGER_DEFICIT_STREAK) {
    state.ledgerUnlocked = true
    state.events.push({
      id: 'ledger_unlocked', year: state.year, kind: 'fiscal',
      detail: { debt: state.fiscal.debt, revenue: state.fiscal.revenue.total },
    })
  }
}

function checkEnding(state: SimState): void {
  if (state.politics.capital <= 0) {
    state.ended = { year: state.year, reason: 'fired' }
    state.events.push({ id: 'fired', year: state.year, kind: 'political', detail: { approval: state.politics.approval } })
    return
  }
  if (state.fiscal.debt > state.fiscal.revenue.total * 6) {
    state.ended = { year: state.year, reason: 'insolvent' }
    state.events.push({ id: 'insolvent', year: state.year, kind: 'fiscal', detail: { debt: state.fiscal.debt } })
    return
  }
  if (state.year >= C.RUN_LENGTH_YEARS) {
    state.ended = { year: state.year, reason: 'completed' }
  }
}

function snapshotOf(
  state: SimState, travel: ReturnType<typeof computeTravel>, year: number,
): YearSnapshot {
  const businesses = state.parcels.reduce((sum, p) => sum + p.businesses.length, 0)
  return {
    year,
    aadt: Math.round(state.traffic.aadt),
    peakSpeedMph: Math.round(state.traffic.peakSpeedMph * 10) / 10,
    corridorVmt: Math.round(state.traffic.corridorVmt),
    modeShare: { ...state.modeShare },
    revenue: state.fiscal.revenue.total,
    expenses: state.fiscal.expenses.total,
    surplus: state.fiscal.surplus,
    debt: state.fiscal.debt,
    revenuePerAcre: state.fiscal.revenuePerAcre,
    liabilityPerAcre: state.fiscal.liabilityPerAcre,
    approval: Math.round(state.politics.approval * 10) / 10,
    capital: Math.round(state.politics.capital * 10) / 10,
    population: state.population,
    jobs: state.jobs,
    businesses,
    medianRent: state.medianRent,
    crashes: state.safety.crashes,
    fatal: state.safety.fatal,
    pedestrianFatal: state.safety.pedestrianFatal,
    noiseDba: state.environment.sidewalkNoiseDba,
    canopyFraction: state.environment.canopyFraction,
    daysOver95: state.environment.daysOver95,
    airTempExcessF: state.environment.airTempExcessF,
    groceryWalkShare: Math.round(travel.groceryWalkShare * 1000) / 1000,
    childWalkShare: Math.round(travel.childWalkShare * 1000) / 1000,
    transportCostShare: Math.round(travel.transportCostShare * 1000) / 1000,
    residentsLeft: state.residentsLeft,
  }
}

/** Run a whole game with a fixed policy, for tests and for tuning. */
export function simulate(
  seed: string, years: number, policy: (state: SimState) => string[] = () => [],
): SimState {
  let state = newGame(seed)
  for (let i = 0; i < years && !state.ended; i++) {
    state = advanceYear(state, policy(state)).state
  }
  return state
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x))
}

export { corridorAcres, computeLiability }

export interface SimEventList { events: SimEvent[] }
