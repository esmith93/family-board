/**
 * The simulation.
 *
 * Pure, headless, deterministic, and free of any DOM reference: give it a seed
 * and a sequence of decisions and it will give you the same thirty years every
 * time. Everything the renderers, the newspaper and the scoring need is here.
 */

export * from './types'
export { C, CONSTANT_REGISTRY, CONSTANT_GROUPS } from './constants'
export type { ConstantKey } from './constants'
export { explain } from './sourced'
export type { Confidence, SourcedConstant, Source } from './sourced'
export { makeRng, makeCountedRng, hashSeed } from './rng'
export type { Rng } from './rng'
export { LAND_USE_PROFILES, profileFor, isAutoOriented, isTaxExempt, permittedFloorArea } from './landuse'
export type { LandUseProfile } from './landuse'
export { createInitialState, corridorAcres, frontageParcels, surfaceParkingShare, segmentOf, SEGMENT_LENGTH_FT } from './corridor'
export {
  laneMiles, operatingSpeedMph, corridorCapacity, corridorSpeed, crossingDistanceFt,
  curbCutsPerMile, localTripGeneration, seversCorridor, effectiveGreenRatio,
  signalDelaySeconds, SIGNALS_ON_CORRIDOR,
} from './traffic'
export { stepEnvironment, trafficNoiseDba, streetHostility, levelOfTrafficStress, canopyFraction, imperviousFraction } from './environment'
export { computeTravel, makeTravelContext, travelMinutes, clockMinutes, modeProbabilities, deriveDestinations, TRIP_PURPOSE_WEIGHTS } from './travel'
export type { TravelContext, TravelResult } from './travel'
export { stepSafety, pedestrianFatalityRisk, severitySplit, crashModificationFactor } from './safety'
export {
  stepRetail, stepHousing, stepRedevelopment, stepAssessments, marketValue, computeAbsorption,
  corridorJobs, corridorPopulation, residentialDensityPerAcre, intensityIndex, groceryViable,
} from './economy'
export {
  computeRevenue, computeExpenses, computeLiability, stepFiscal, parcelLedger,
  taxWeights, parcelPropertyTax, parcelSalesTax, requiredParking, costIndex, priceIndex,
  cityShortfall, borrowingHeadroom, committedCapital, localStreetCostPerFootYear, localStreetFeet,
} from './fiscal'
export type { ParcelLedgerRow, LiabilityBreakdown } from './fiscal'
export { INSTRUMENTS, instrumentById, availableInstruments, instrumentsForTab } from './instruments'
export type { Instrument, InstrumentTab } from './instruments'
export { GLOSSARY_CARDS, checkGlossary, cardById } from './glossary'
export type { GlossaryCard } from './glossary'
export { newGame, advanceYear, simulate } from './step'
export type { YearResult } from './step'
