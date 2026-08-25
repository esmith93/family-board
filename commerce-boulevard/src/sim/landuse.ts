/**
 * What each land use class is, physically and fiscally.
 *
 * The whole argument of the game lives in this table: the right-hand columns
 * (value per acre, jobs, dwellings) vary by more than an order of magnitude,
 * while the infrastructure that serves them does not vary at all.
 */

import { C } from './constants'
import type { LandUse, Parcel, ZoningState } from './types'

export interface LandUseProfile {
  use: LandUse
  /** Assessed value per acre at year 0, in a healthy market. */
  valuePerAcre: number
  /** Share of that value attributable to land rather than improvements. */
  landValueShare: number
  /** Gross floor area divided by lot area. */
  floorAreaRatio: number
  stories: number
  /** Share of the site that sheds water: roof, tarmac, pavement. */
  imperviousFraction: number
  /** Share of the site given over to surface parking. */
  surfaceParkingShare: number
  /** Dwelling units per acre. */
  dwellingsPerAcre: number
  /** Jobs per 1,000 sqft of non-residential floor area. */
  jobsPerKsf: number
  /** Share of floor area that is retail, and so generates sales tax. */
  retailShare: number
  /** Driveways onto the boulevard per parcel. Every one is a conflict point. */
  curbCutsPerParcel: number
  /**
   * How the frontage reads to somebody on foot, 0..1. Blank walls and car
   * parks score near zero; shopfronts at the pavement score near one. Feeds
   * the walking comfort penalty and the retail footfall model.
   */
  frontageQuality: number
  /** Tree canopy the use typically carries, 0..1, before street trees. */
  baseCanopy: number
  /**
   * Feet from the pavement to the front door. A shopfront at the back of the
   * footway is 5 feet; a supermarket behind its car park is 280. This is the
   * difference between a grocery you can walk to and one you cannot, on the
   * same street, at the same distance on a map.
   */
  entranceSetbackFt: number
  /**
   * Feet of PUBLIC local street the use requires per acre, to reach every
   * parcel it creates. This is where the sprawl arithmetic lives: four houses
   * to the acre need roughly 190 feet of street, sixty flats to the acre need
   * about 25. The city maintains all of it either way.
   */
  localStreetFeetPerAcre: number
  /** Can this use redevelop into something else without demolition drama. */
  redevelopable: boolean
}

const P = (p: LandUseProfile): LandUseProfile => p

export const LAND_USE_PROFILES: Readonly<Record<LandUse, LandUseProfile>> = Object.freeze({
  vacant: P({
    use: 'vacant', valuePerAcre: C.VALUE_PER_ACRE_VACANT, landValueShare: 1.0,
    floorAreaRatio: 0, stories: 0, imperviousFraction: 0.1, surfaceParkingShare: 0,
    dwellingsPerAcre: 0, jobsPerKsf: 0, retailShare: 0, curbCutsPerParcel: 0,
    frontageQuality: 0.1, baseCanopy: 0.15, entranceSetbackFt: 0, localStreetFeetPerAcre: 40, redevelopable: true,
  }),
  surface_parking: P({
    use: 'surface_parking', valuePerAcre: C.VALUE_PER_ACRE_SURFACE_PARKING, landValueShare: 0.92,
    floorAreaRatio: 0, stories: 0, imperviousFraction: 0.95, surfaceParkingShare: 1.0,
    dwellingsPerAcre: 0, jobsPerKsf: 0, retailShare: 0, curbCutsPerParcel: 2,
    frontageQuality: 0.0, baseCanopy: 0.02, entranceSetbackFt: 0, localStreetFeetPerAcre: 55, redevelopable: true,
  }),
  auto_service: P({
    use: 'auto_service', valuePerAcre: C.VALUE_PER_ACRE_AUTO_SERVICE, landValueShare: 0.55,
    floorAreaRatio: 0.12, stories: 1, imperviousFraction: 0.93, surfaceParkingShare: 0.55,
    dwellingsPerAcre: 0, jobsPerKsf: 2.2, retailShare: 0.7, curbCutsPerParcel: 2,
    frontageQuality: 0.05, baseCanopy: 0.03, entranceSetbackFt: 90, localStreetFeetPerAcre: 60, redevelopable: true,
  }),
  big_box: P({
    use: 'big_box', valuePerAcre: C.VALUE_PER_ACRE_BIG_BOX, landValueShare: 0.4,
    floorAreaRatio: 0.18, stories: 1, imperviousFraction: 0.94, surfaceParkingShare: 0.62,
    dwellingsPerAcre: 0, jobsPerKsf: 1.1, retailShare: 1.0, curbCutsPerParcel: 2,
    frontageQuality: 0.02, baseCanopy: 0.04, entranceSetbackFt: 280, localStreetFeetPerAcre: 55, redevelopable: true,
  }),
  strip_mall: P({
    use: 'strip_mall', valuePerAcre: C.VALUE_PER_ACRE_STRIP_MALL, landValueShare: 0.45,
    floorAreaRatio: 0.25, stories: 1, imperviousFraction: 0.92, surfaceParkingShare: 0.58,
    dwellingsPerAcre: 0, jobsPerKsf: 1.8, retailShare: 0.95, curbCutsPerParcel: 2,
    frontageQuality: 0.08, baseCanopy: 0.05, entranceSetbackFt: 190, localStreetFeetPerAcre: 60, redevelopable: true,
  }),
  single_family: P({
    use: 'single_family', valuePerAcre: C.VALUE_PER_ACRE_SINGLE_FAMILY, landValueShare: 0.35,
    floorAreaRatio: 0.28, stories: 1.5, imperviousFraction: 0.45, surfaceParkingShare: 0.1,
    dwellingsPerAcre: 4.2, jobsPerKsf: 0, retailShare: 0, curbCutsPerParcel: 1,
    frontageQuality: 0.35, baseCanopy: 0.32, entranceSetbackFt: 35, localStreetFeetPerAcre: 190, redevelopable: false,
  }),
  garden_apartment: P({
    use: 'garden_apartment', valuePerAcre: C.VALUE_PER_ACRE_GARDEN_APARTMENT, landValueShare: 0.28,
    floorAreaRatio: 0.7, stories: 2.5, imperviousFraction: 0.65, surfaceParkingShare: 0.32,
    dwellingsPerAcre: 20, jobsPerKsf: 0, retailShare: 0, curbCutsPerParcel: 1,
    frontageQuality: 0.3, baseCanopy: 0.2, entranceSetbackFt: 65, localStreetFeetPerAcre: 90, redevelopable: true,
  }),
  office_park: P({
    use: 'office_park', valuePerAcre: C.VALUE_PER_ACRE_OFFICE_PARK, landValueShare: 0.3,
    floorAreaRatio: 0.45, stories: 2, imperviousFraction: 0.85, surfaceParkingShare: 0.5,
    dwellingsPerAcre: 0, jobsPerKsf: 3.6, retailShare: 0.03, curbCutsPerParcel: 2,
    frontageQuality: 0.12, baseCanopy: 0.12, entranceSetbackFt: 160, localStreetFeetPerAcre: 70, redevelopable: true,
  }),
  mainstreet_mixed: P({
    use: 'mainstreet_mixed', valuePerAcre: C.VALUE_PER_ACRE_MAINSTREET_MIXED, landValueShare: 0.3,
    floorAreaRatio: 1.6, stories: 2.5, imperviousFraction: 0.8, surfaceParkingShare: 0.12,
    dwellingsPerAcre: 26, jobsPerKsf: 2.4, retailShare: 0.36, curbCutsPerParcel: 0.4,
    frontageQuality: 0.86, baseCanopy: 0.14, entranceSetbackFt: 5, localStreetFeetPerAcre: 45, redevelopable: true,
  }),
  midrise_mixed: P({
    use: 'midrise_mixed', valuePerAcre: C.VALUE_PER_ACRE_MIDRISE_MIXED, landValueShare: 0.25,
    floorAreaRatio: 3.4, stories: 5, imperviousFraction: 0.82, surfaceParkingShare: 0.04,
    dwellingsPerAcre: 62, jobsPerKsf: 2.6, retailShare: 0.2, curbCutsPerParcel: 0.3,
    frontageQuality: 0.9, baseCanopy: 0.16, entranceSetbackFt: 5, localStreetFeetPerAcre: 25, redevelopable: false,
  }),
  civic: P({
    use: 'civic', valuePerAcre: 0, landValueShare: 1.0,
    floorAreaRatio: 0.5, stories: 2, imperviousFraction: 0.6, surfaceParkingShare: 0.28,
    dwellingsPerAcre: 0, jobsPerKsf: 2.0, retailShare: 0, curbCutsPerParcel: 1,
    frontageQuality: 0.55, baseCanopy: 0.3, entranceSetbackFt: 85, localStreetFeetPerAcre: 50, redevelopable: false,
  }),
  park: P({
    use: 'park', valuePerAcre: 0, landValueShare: 1.0,
    floorAreaRatio: 0, stories: 0, imperviousFraction: 0.12, surfaceParkingShare: 0.05,
    dwellingsPerAcre: 0, jobsPerKsf: 0, retailShare: 0, curbCutsPerParcel: 0.5,
    frontageQuality: 0.7, baseCanopy: 0.62, entranceSetbackFt: 25, localStreetFeetPerAcre: 30, redevelopable: false,
  }),
  plaza: P({
    use: 'plaza', valuePerAcre: 0, landValueShare: 1.0,
    floorAreaRatio: 0, stories: 0, imperviousFraction: 0.55, surfaceParkingShare: 0,
    dwellingsPerAcre: 0, jobsPerKsf: 0, retailShare: 0, curbCutsPerParcel: 0,
    frontageQuality: 0.8, baseCanopy: 0.35, entranceSetbackFt: 0, localStreetFeetPerAcre: 20, redevelopable: false,
  }),
})

export function profileFor(use: LandUse): LandUseProfile {
  return LAND_USE_PROFILES[use]
}

/** Civic land, parks and plazas pay no property tax. That is a real cost. */
export function isTaxExempt(use: LandUse): boolean {
  return use === 'civic' || use === 'park' || use === 'plaza'
}

/** Uses that read as a wall of parked cars to somebody trying to walk past. */
export function isAutoOriented(use: LandUse): boolean {
  return use === 'surface_parking' || use === 'big_box' || use === 'strip_mall' ||
    use === 'auto_service' || use === 'office_park'
}

/**
 * Total floor area a parcel could hold under current zoning.
 *
 * Parking minimums bite here: required stalls consume site area that could
 * otherwise hold building, so a high minimum caps density below the height
 * limit long before the height limit is reached.
 */
export function permittedFloorArea(parcel: Parcel, zoning: ZoningState, use: LandUse): number {
  const profile = profileFor(use)
  const lotSqft = parcel.acres * 43560

  // Setbacks take a slice off the front of the lot.
  const frontage = Math.sqrt(lotSqft / 2.2)
  const setbackLoss = Math.min(0.5, (zoning.frontSetbackFt * frontage) / lotSqft)
  const buildableSqft = lotSqft * (1 - setbackLoss)

  const byHeight = buildableSqft * zoning.maxLotCoverage * Math.min(zoning.heightLimitStories, profile.stories || 1)
  const byForm = lotSqft * profile.floorAreaRatio

  let cap = Math.min(byHeight, byForm)

  // Now take out the land the parking minimum demands.
  const stallsPerKsf = profile.retailShare * zoning.parkingMinPerKsfRetail
  const stallsPerDwelling = zoning.parkingMinPerDwelling
  const dwellingsAtCap = (cap / 1000) * (profile.dwellingsPerAcre > 0 ? 0.62 : 0) // ~620 sqft of gross area per unit
  const requiredStalls = (cap / 1000) * stallsPerKsf + dwellingsAtCap * stallsPerDwelling
  const parkingSqft = requiredStalls * C.PARKING_STALL_AREA_SQFT

  if (parkingSqft > 0) {
    // Solve for the floor area at which building plus its required surface
    // parking exactly fills the lot.
    const parkingPerFloorSqft = parkingSqft / Math.max(cap, 1)
    const footprintPerFloorSqft = 1 / Math.max(profile.stories, 1)
    const feasible = buildableSqft / (footprintPerFloorSqft + parkingPerFloorSqft)
    cap = Math.min(cap, feasible)
  }

  return Math.max(0, cap)
}

/** Order of intensity, used to judge whether a change is up-zoning or down. */
export const USE_INTENSITY: Readonly<Record<LandUse, number>> = Object.freeze({
  vacant: 0, surface_parking: 1, park: 1, plaza: 1, auto_service: 2,
  big_box: 3, strip_mall: 3, single_family: 3, office_park: 4, civic: 4,
  garden_apartment: 5, mainstreet_mixed: 7, midrise_mixed: 9,
})
