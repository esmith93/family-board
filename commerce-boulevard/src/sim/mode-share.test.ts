/**
 * Mode share is never set by the player and never set directly at all. It
 * falls out of distances, comfort, parking price and car ownership.
 */
import { describe, expect, it } from 'vitest'
import { C } from './constants'
import { newGame, advanceYear } from './step'
import { computeTravel, makeTravelContext, bikeWillingShare, modeProbabilities, clockMinutes } from './travel'
import { levelOfTrafficStress, streetHostility } from './environment'
import { operatingSpeedMph } from './traffic'
import type { SimState } from './types'

const travelFor = (state: SimState) => {
  const ctx = makeTravelContext(state.street, state.parcels, state.environment, state.traffic)
  return { ctx, result: computeTravel(state.households, ctx) }
}

describe('mode share at year zero', () => {
  const state = newGame('mode')
  const { ctx, result } = travelFor(state)

  it('is overwhelmingly car, as an auto-oriented arterial should be', () => {
    expect(result.modeShare.drive).toBeGreaterThan(0.85)
    expect(result.modeShare.drive).toBeLessThan(0.97)
  })

  it('shows the street is hostile and the cycling stress is maximal', () => {
    expect(ctx.hostility).toBeGreaterThan(0.7)
    expect(ctx.lts).toBe(4)
  })

  it('leaves a grocery physically within reach, and almost nobody walking to it', () => {
    // The corridor is only 1.2 miles long, so on a map plenty of households
    // are within a fifteen-minute walk of the supermarket. Almost none of them
    // walk, because the walk runs beside 50 mph traffic and across a car park.
    // The gap between these two numbers is the whole argument of the game.
    expect(result.groceryWalkShare).toBeGreaterThan(0.2)
    expect(result.modeShare.walk).toBeLessThan(0.15)
    expect(result.groceryWalkShare - result.modeShare.walk).toBeGreaterThan(0.25)
  })

  it('leaves no child able to walk to school alone', () => {
    expect(result.childWalkShare).toBeLessThan(0.02)
  })

  it('puts a quarter of household income into getting around', () => {
    expect(result.transportCostShare).toBeGreaterThan(C.TRANSPORT_COST_SHARE_AUTO_DEPENDENT * 0.7)
    expect(result.transportCostShare).toBeLessThan(C.TRANSPORT_COST_SHARE_AUTO_DEPENDENT * 1.35)
  })

  it('sums to one', () => {
    const total = result.modeShare.drive + result.modeShare.walk + result.modeShare.bike + result.modeShare.transit
    expect(total).toBeCloseTo(1, 6)
  })
})

describe('bike facilities can fail', () => {
  it('gates cycling on traffic stress before it gates it on distance', () => {
    expect(bikeWillingShare(4)).toBeLessThan(0.1)
    expect(bikeWillingShare(1)).toBeGreaterThan(0.8)
  })

  it('a protected lane on a corridor of car parks goes almost unused', () => {
    let state = newGame('bikefail')
    for (let i = 0; i < 8 && !state.ended; i++) {
      state = advanceYear(state, state.year === 1 ? ['street.protected_bike_lane'] : []).state
    }
    expect(state.street.bikeFacility).toBe('protected')
    // The lane exists, the stress is gone, and still nobody rides - because
    // there is nowhere within riding distance worth going.
    expect(state.modeShare.bike).toBeLessThan(0.03)
  })

  it('costs real money and real political capital to learn that', () => {
    const before = newGame('bikefail')
    const after = advanceYear(before, ['street.protected_bike_lane']).state
    expect(after.politics.capital).toBeLessThan(before.politics.capital)
  })
})

describe('transit can fail', () => {
  it('burns subsidy at densities below the viability threshold', () => {
    let state = newGame('transitfail')
    const baselineDensity = state.parcels.reduce((s, p) => s + p.dwellings, 0) /
      state.parcels.reduce((s, p) => s + p.acres, 0)
    expect(baselineDensity).toBeLessThan(C.TRANSIT_DENSITY_THRESHOLD_DU_ACRE)

    let withTransit = state
    for (let i = 0; i < 6 && !withTransit.ended; i++) {
      withTransit = advanceYear(withTransit, withTransit.year <= 2 ? ['street.increase_transit'] : []).state
    }
    for (let i = 0; i < 6 && !state.ended; i++) state = advanceYear(state, []).state

    expect(withTransit.fiscal.expenses.transitSubsidy).toBeGreaterThan(state.fiscal.expenses.transitSubsidy * 1.5)
    expect(withTransit.modeShare.transit).toBeLessThan(0.06)
  })
})

describe('mode share responds to the things it should', () => {
  it('shifts toward walking when destinations arrive and the street calms', () => {
    const state = newGame('shift')
    const before = travelFor(state).result.modeShare.walk

    // Same households, same corridor: only the street changes.
    const calmer: SimState = structuredClone(state)
    calmer.street.designSpeedMph = 25
    calmer.street.throughLanesPerDirection = 1
    calmer.street.laneWidthFt = 10
    calmer.street.sidewalkWidthFt = 12
    calmer.street.crossingSpacingFt = 300
    calmer.street.treesPerMilePerSide = 80
    calmer.street.onStreetParking = 'metered'
    calmer.street.meterPricePerHour = 2
    calmer.street.median = 'landscaped'
    const after = travelFor(calmer).result.modeShare.walk

    expect(after).toBeGreaterThan(before)
  })

  it('never lets the player set it directly', async () => {
    const { readFileSync } = await import('node:fs')
    const instruments = readFileSync(new URL('./instruments.ts', import.meta.url), 'utf8')
    expect(instruments).not.toMatch(/modeShare/)
  })

  it('respects the meta-analysis ceiling on built-environment elasticity', () => {
    // Ewing & Cervero find no design variable with an elasticity above 0.39.
    // The model's own footfall and comfort parameters must stay under it.
    expect(C.RETAIL_FOOTFALL_SALES_ELASTICITY).toBeLessThanOrEqual(C.MAX_BUILT_ENVIRONMENT_ELASTICITY)
  })

  it('makes driving unavailable to a household with no car', () => {
    const state = newGame('carless')
    const ctx = makeTravelContext(state.street, state.parcels, state.environment, state.traffic)
    const household = { ...state.households[0]!, vehicles: 0 }
    const destination = ctx.destinations.find((d) => d.kind === 'grocery')!
    expect(clockMinutes(household, destination, ctx).drive).toBeNull()
    expect(modeProbabilities(household, destination, ctx).drive).toBe(0)
  })
})

describe('the speed drivers actually choose', () => {
  it('exceeds the posted speed on a wide, open road', () => {
    const state = newGame('speed')
    expect(operatingSpeedMph(state.street, state.parcels)).toBeGreaterThan(state.street.designSpeedMph)
  })

  it('falls when the geometry gives a reason to slow down', () => {
    const state = newGame('speed')
    const calmed = structuredClone(state)
    calmed.street.laneWidthFt = 10
    calmed.street.throughLanesPerDirection = 1
    calmed.street.onStreetParking = 'metered'
    calmed.street.bulbOuts = true
    calmed.street.treesPerMilePerSide = 80
    expect(operatingSpeedMph(calmed.street, calmed.parcels))
      .toBeLessThan(operatingSpeedMph(state.street, state.parcels) - 8)
  })

  it('is what drives hostility and traffic stress, not the sign', () => {
    const state = newGame('speed')
    const posted = structuredClone(state)
    posted.street.designSpeedMph = 25 // sign only, geometry unchanged
    const stillFast = operatingSpeedMph(posted.street, posted.parcels)
    expect(stillFast).toBeGreaterThan(30)
    expect(levelOfTrafficStress(posted.street, stillFast)).toBe(4)
    expect(streetHostility(posted.street, posted.environment, stillFast, posted.parcels)).toBeGreaterThan(0.6)
  })
})
