/**
 * The central fiscal fact: revenue scales with the value created on a parcel,
 * liability scales with the ground that has to be served, and those two things
 * are unrelated.
 */
import { describe, expect, it } from 'vitest'
import { C } from './constants'
import { newGame, advanceYear } from './step'
import { LAND_USE_PROFILES, profileFor } from './landuse'
import {
  computeLiability, localStreetCostPerFootYear, parcelLedger, parcelPropertyTax,
  parcelSalesTax, taxWeights,
} from './fiscal'
import { applyUse } from './economy'
import type { LandUse, Parcel, SimState } from './types'

/** A one-acre parcel of a given use, valued as the model would value it. */
function testParcel(use: LandUse, state: SimState): Parcel {
  const parcel: Parcel = { ...state.parcels[0]!, id: `test-${use}`, acres: 1, depth: 0 }
  applyUse(parcel, use, 0)
  const profile = profileFor(use)
  const total = profile.valuePerAcre * 1
  parcel.landValue = Math.round(total * profile.landValueShare)
  parcel.improvementValue = Math.round(total - parcel.landValue)
  return parcel
}

describe('revenue and liability diverge by land use', () => {
  const state = newGame('fiscal')
  const weights = taxWeights(state.parcels, 0)

  const revenuePerAcre = (use: LandUse): number =>
    parcelPropertyTax(testParcel(use, state), state.fiscalPolicy, weights)

  it('mid-rise mixed use out-earns surface parking by an order of magnitude', () => {
    const parking = revenuePerAcre('surface_parking')
    const midrise = revenuePerAcre('midrise_mixed')
    expect(midrise / parking).toBeGreaterThan(10)
  })

  it('main street out-earns big box several times over on the same acre', () => {
    expect(revenuePerAcre('mainstreet_mixed') / revenuePerAcre('big_box')).toBeGreaterThan(4)
  })

  it('ranks land uses by fiscal productivity in the expected order', () => {
    const order: LandUse[] = ['vacant', 'surface_parking', 'big_box', 'garden_apartment', 'mainstreet_mixed', 'midrise_mixed']
    const values = order.map(revenuePerAcre)
    for (let i = 1; i < values.length; i++) {
      expect(values[i]!, `${order[i]} should out-earn ${order[i - 1]}`).toBeGreaterThan(values[i - 1]!)
    }
  })

  it('charges low-density land use far more for the streets that reach it', () => {
    const perFoot = localStreetCostPerFootYear(0)
    const detached = LAND_USE_PROFILES.single_family.localStreetFeetPerAcre * perFoot
    const midrise = LAND_USE_PROFILES.midrise_mixed.localStreetFeetPerAcre * perFoot
    expect(detached / midrise).toBeGreaterThan(5)
  })

  it('produces a ledger where car parks are subsidised and buildings are not', () => {
    const rows = parcelLedger(state, 0)
    const byUse = new Map<string, number[]>()
    for (const row of rows) {
      if (!byUse.has(row.use)) byUse.set(row.use, [])
      byUse.get(row.use)!.push(row.ratio)
    }
    const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length
    const parking = byUse.get('surface_parking')
    expect(parking).toBeDefined()
    // A car park pays a fraction of what it costs to serve.
    expect(mean(parking!)).toBeLessThan(1)
    // And something with a building on it pays several times over.
    const strip = byUse.get('strip_mall')
    if (strip) expect(mean(strip)).toBeGreaterThan(mean(parking!) * 3)
  })
})

describe('validation against published figures', () => {
  const state = newGame('fiscal')

  it('reproduces the published big-box sales tax per acre', () => {
    // Not every generated corridor happens to hold a lot big enough for a big
    // box, so sample several.
    const samples: number[] = []
    for (const seed of ['fiscal', 'alpha', 'bravo', 'charlie', 'delta', 'echo']) {
      const corridor = newGame(seed)
      for (const parcel of corridor.parcels.filter((p) => p.use === 'big_box')) {
        samples.push(parcelSalesTax(parcel) / parcel.acres)
      }
    }
    expect(samples.length).toBeGreaterThan(3)

    // The source reports a range, not a point, because corridors differ in how
    // much retail floor area is competing for the same spending. Test the
    // median against the published range rather than demanding every corridor
    // land on the midpoint.
    samples.sort((a, b) => a - b)
    const median = samples[Math.floor(samples.length / 2)]!
    expect(median).toBeGreaterThan(20000)
    expect(median).toBeLessThan(80000)
  })

  it('implies a plausible sales per square foot for corridor retail', () => {
    for (const seed of ['fiscal', 'alpha', 'bravo']) {
      const corridor = newGame(seed)
      const sales = corridor.parcels.reduce((sum, p) => sum + p.businesses.reduce((a, b) => a + b.sales, 0), 0)
      const sqft = corridor.parcels.reduce((sum, p) => sum + p.businesses.reduce((a, b) => a + b.floorArea, 0), 0)
      const perSqft = sales / sqft
      expect(perSqft, `${seed}: sales per sqft`).toBeGreaterThan(120)
      expect(perSqft, `${seed}: sales per sqft`).toBeLessThan(700)
    }
  })

  it('reproduces published property tax per acre across all jurisdictions', () => {
    const weights = taxWeights(state.parcels, 0)
    const cityTax = state.parcels.reduce((sum, p) => sum + parcelPropertyTax(p, state.fiscalPolicy, weights), 0)
    const acres = state.parcels.reduce((sum, p) => sum + p.acres, 0)
    // Back out the all-jurisdictions figure the source reports.
    const allJurisdictions = cityTax / C.CITY_SHARE_OF_PROPERTY_LEVY / acres
    // A corridor that is 55% car park should land between the car park figure
    // and the strip mall figure.
    expect(allJurisdictions).toBeGreaterThan(4000)
    expect(allJurisdictions).toBeLessThan(25000)
  })

  it('starts the corridor near the edge of solvency, as the brief requires', () => {
    const revenue = state.fiscal.revenue.total
    const expenses = state.fiscal.expenses.total
    expect(Math.abs(revenue - expenses) / revenue).toBeLessThan(0.25)
  })
})

describe('the fiscal wall', () => {
  it('arrives, and unlocks the Ledger View, without the player being told first', () => {
    let state = newGame('wall')
    expect(state.ledgerUnlocked).toBe(false)
    let unlockYear = -1
    for (let i = 0; i < 30 && !state.ended; i++) {
      state = advanceYear(state, []).state
      if (state.ledgerUnlocked && unlockYear < 0) unlockYear = state.year
    }
    expect(unlockYear).toBeGreaterThan(0)
    expect(unlockYear).toBeLessThanOrEqual(20)
  })

  it('the liability line grows faster than the revenue line when nothing changes', () => {
    let state = newGame('wall')
    for (let i = 0; i < 20 && !state.ended; i++) state = advanceYear(state, []).state
    const first = state.history[1]!
    const last = state.history.at(-1)!
    const liabilityGrowth = last.liabilityPerAcre / first.liabilityPerAcre
    const revenueGrowth = last.revenuePerAcre / first.revenuePerAcre
    expect(liabilityGrowth).toBeGreaterThan(revenueGrowth)
  })
})

describe('the land value tax shift', () => {
  it('is revenue-neutral at adoption but moves the burden onto car parks', () => {
    const state = newGame('lvt')
    const flat = taxWeights(state.parcels, 0)
    const shifted = taxWeights(state.parcels, 1)

    const total = (split: { land: number; improvement: number }): number =>
      state.parcels.reduce((sum, p) => sum + parcelPropertyTax(p, state.fiscalPolicy, split), 0)

    expect(total(shifted) / total(flat)).toBeCloseTo(1, 2)

    const parkingBill = (split: { land: number; improvement: number }): number =>
      state.parcels.filter((p) => p.use === 'surface_parking')
        .reduce((sum, p) => sum + parcelPropertyTax(p, state.fiscalPolicy, split), 0)

    expect(parkingBill(shifted)).toBeGreaterThan(parkingBill(flat) * 1.2)
  })
})

describe('infrastructure liability composition', () => {
  it('is dominated by things that follow ground served, not value created', () => {
    const state = newGame('liability')
    const liability = computeLiability(state.street, state.parcels, 0)
    const groundFollowing = liability.roadMaintenance + liability.roadReconstructionReserve +
      liability.utilityMaintenance + liability.localStreets
    expect(groundFollowing / liability.total).toBeGreaterThan(0.8)
  })

  it('includes the reconstruction nobody budgets for', () => {
    const state = newGame('liability')
    const liability = computeLiability(state.street, state.parcels, 0)
    expect(liability.roadReconstructionReserve).toBeGreaterThan(liability.roadMaintenance)
  })
})
