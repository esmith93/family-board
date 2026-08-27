/**
 * The plan the game's claims are measured against.
 *
 * Every design claim in this project - that the game can be won, that
 * sequencing is a skill, that the paper comes round on a corridor that earned
 * it - is a claim about a specific thirty years of specific decisions. That
 * plan lives here, once, because it used to live twice.
 *
 * The two copies had drifted by a single move: the simulation's copy allowed
 * homes above shops in year three and the newspaper's did not. Measured after
 * the political capital was repriced, that one move was the difference between
 * twelve corridors of thirteen finishing the run and twelve corridors of
 * twelve sacking the director by year fourteen - so `playability.test.ts`
 * proved the game could be won on a corridor `paper.test.ts` proved nobody
 * survives. Neither file was wrong about its own plan. They were not talking
 * about the same street.
 *
 * Land use first, then the street, then the modes that depend on both.
 */
export const REFERENCE_PLAN: Readonly<Record<number, string[]>> = Object.freeze({
  0: ['land.reduce_parking_minimums'],
  1: ['land.allow_mixed_use'],
  2: ['fiscal.business_improvement_district'],
  3: ['land.allow_mixed_use'],
  4: ['land.reduce_setbacks'],
  5: ['fiscal.land_value_shift'],
  6: ['land.abolish_parking_minimums'],
  7: ['capital.road_diet'],
  9: ['street.add_kerb_parking'],
  10: ['fiscal.price_parking'],
  11: ['land.raise_height_limit'],
  12: ['street.lower_target_speed'],
  13: ['fiscal.land_value_shift'],
  14: ['street.narrow_lanes'],
  15: ['street.add_crossings'],
  16: ['land.raise_height_limit'],
  17: ['street.plant_trees'],
  18: ['capital.bulb_outs'],
  19: ['fiscal.land_value_shift'],
  21: ['land.form_based_code'],
})

/** The same plan, by a director who also keeps the pavement alive. */
export const REFERENCE_PLAN_MAINTAINED: Readonly<Record<number, string[]>> = Object.freeze({
  ...REFERENCE_PLAN,
  8: ['capital.repave'],
  22: ['capital.repave'],
})

/**
 * The thirteen corridors every claim is measured across, so that no claim
 * rests on one lucky seed.
 */
export const CORRIDORS: readonly string[] = Object.freeze([
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'win', 'lose', 'order', 'reckon', 'fairview-best',
])
