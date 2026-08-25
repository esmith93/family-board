/**
 * Renders MODEL.md from the constant registry.
 *
 * MODEL.md is not written by hand. It is a rendering of constants.ts, so the
 * documentation and the model cannot disagree - and a test fails if the file
 * on disk has fallen behind.
 */
import { CONSTANT_REGISTRY, CONSTANT_GROUPS } from './constants'
import { LAND_USE_PROFILES, LAND_USES } from './types-helpers'
import type { SourcedConstant } from './sourced'

const num = (n: number): string => {
  if (n === 0) return '0'
  const abs = Math.abs(n)
  if (abs >= 1000) return n.toLocaleString('en-US')
  if (abs >= 1) return String(Math.round(n * 1000) / 1000)
  if (abs >= 0.001) return String(Math.round(n * 100000) / 100000)
  return n.toExponential(2)
}

const CONFIDENCE_LABEL: Record<string, string> = {
  settled: 'Settled',
  contextual: 'Varies by context',
  contested: 'Contested',
}

function sourceCell(c: SourcedConstant): string {
  if (c.source.url === 'internal') return `_Design parameter_`
  return `[${c.source.title.replace(/\|/g, '/')}](${c.source.url}) (${c.source.year})`
}

export function renderModelDoc(): string {
  const lines: string[] = []
  const all = Object.values(CONSTANT_REGISTRY)
  const contested = all.filter((c) => c.confidence === 'contested')
  const design = all.filter((c) => c.source.url === 'internal')
  const sourced = all.filter((c) => c.source.url !== 'internal')

  lines.push('# MODEL.md')
  lines.push('')
  lines.push('**This file is generated.** It is rendered from `src/sim/constants.ts` by `npm run model`.')
  lines.push('Edit the constants, not this document; a test fails if the two disagree.')
  lines.push('')
  lines.push('Every number the simulation uses appears below with its value, its units, an honest')
  lines.push('range, and where it came from. The in-game **"Why this number?"** panel reads the same')
  lines.push('registry, so a constant cannot enter the model without declaring its source.')
  lines.push('')
  lines.push(`- **${all.length}** constants in the model`)
  lines.push(`- **${sourced.length}** carry a citation to published work`)
  lines.push(`- **${design.length}** are game design parameters, marked as such rather than dressed up with a citation they do not have`)
  lines.push(`- **${contested.length}** sit on literature where researchers actively disagree`)
  lines.push('')
  lines.push('## How to read the confidence column')
  lines.push('')
  lines.push('| Label | Meaning |')
  lines.push('| --- | --- |')
  lines.push('| Settled | Independent sources converge, or the figure is arithmetic. |')
  lines.push('| Varies by context | Broadly accepted, but the figure moves with market, region or method. |')
  lines.push('| Contested | Researchers disagree about sign, size, or method. The game says so rather than picking a side quietly. |')
  lines.push('')
  lines.push('## Where the literature disagrees')
  lines.push('')
  lines.push('These are the numbers a hostile expert reader should attack first, and the ones the')
  lines.push('game surfaces to the player with the disagreement attached.')
  lines.push('')
  for (const c of contested) {
    lines.push(`- **${c.label}** — ${num(c.value)} ${c.unit} (range ${num(c.low)}–${num(c.high)}). ${c.note}`)
  }
  lines.push('')
  lines.push('## Known verification gaps')
  lines.push('')
  const gaps = all.filter((c) => c.note.includes('VERIFICATION GAP') || c.note.includes('verification gap'))
  if (gaps.length === 0) {
    lines.push('None recorded.')
  } else {
    for (const c of gaps) lines.push(`- **${c.label}** — ${c.note}`)
  }
  lines.push('')

  for (const group of CONSTANT_GROUPS) {
    lines.push(`## ${group.title}`)
    lines.push('')
    lines.push(group.blurb)
    lines.push('')
    lines.push('| Constant | Value | Units | Range | Confidence | Source |')
    lines.push('| --- | ---: | --- | ---: | --- | --- |')
    for (const key of group.keys) {
      const c = CONSTANT_REGISTRY[key]
      if (!c) continue
      lines.push(`| \`${c.key}\`<br>${c.label} | ${num(c.value)} | ${c.unit} | ${num(c.low)}–${num(c.high)} | ${CONFIDENCE_LABEL[c.confidence]} | ${sourceCell(c)} |`)
    }
    lines.push('')
    for (const key of group.keys) {
      const c = CONSTANT_REGISTRY[key]
      if (!c) continue
      lines.push(`- **${c.label}** (\`${c.key}\`): ${c.note}`)
    }
    lines.push('')
  }

  lines.push('## Land use profiles')
  lines.push('')
  lines.push('These are the physical and fiscal characteristics of each land use class. They are')
  lines.push('design parameters calibrated so that the resulting revenue and sales tax per acre')
  lines.push('reproduce the published figures cited above — a test asserts that they do.')
  lines.push('')
  lines.push('`Local street ft/acre` is where the sprawl arithmetic lives: four houses to the acre')
  lines.push('need roughly 190 feet of public street to reach them, sixty flats to the acre need')
  lines.push('about 25, and the city maintains every foot of it either way.')
  lines.push('')
  lines.push('`Entrance setback` is the walk from the pavement to the front door. A shopfront at')
  lines.push('the back of the footway is 5 feet; a supermarket behind its car park is 280. Two')
  lines.push('groceries the same distance apart on a map are not the same distance apart on foot.')
  lines.push('')
  lines.push('| Land use | $/acre | FAR | Storeys | Impervious | Surface parking | Dwellings/acre | Jobs/1000sqft | Retail share | Frontage quality | Entrance setback ft | Local street ft/acre |')
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |')
  for (const use of LAND_USES) {
    const p = LAND_USE_PROFILES[use]
    lines.push(`| ${use} | ${num(p.valuePerAcre)} | ${p.floorAreaRatio} | ${p.stories} | ${p.imperviousFraction} | ${p.surfaceParkingShare} | ${p.dwellingsPerAcre} | ${p.jobsPerKsf} | ${p.retailShare} | ${p.frontageQuality} | ${p.entranceSetbackFt} | ${p.localStreetFeetPerAcre} |`)
  }
  lines.push('')
  lines.push('## Functional forms')
  lines.push('')
  lines.push('The equations these constants combine into. Each lives in the module named.')
  lines.push('')
  lines.push('### Induced demand — `traffic.ts`')
  lines.push('')
  lines.push('Corridor traffic splits into LOCAL trips, generated by the land use and filtered')
  lines.push('through mode share, and THROUGH trips, attracted by capacity:')
  lines.push('')
  lines.push('```')
  lines.push('latentThrough = baseThrough')
  lines.push('              × regionalIndex')
  lines.push('              × (laneMiles / laneMiles₀) ^ VMT_LANE_MILE_ELASTICITY')
  lines.push('              × (speed₀ / speed_{t-1}) ^ VMT_TRAVEL_TIME_ELASTICITY')
  lines.push('')
  lines.push('through_t = through_{t-1} + (latentThrough − through_{t-1}) × INDUCED_DEMAND_ADJUSTMENT_RATE')
  lines.push('```')
  lines.push('')
  lines.push('The second term runs in both directions. Adding capacity pulls traffic in over five')
  lines.push('to ten years; taking capacity away lets it evaporate over the same period. The lag is')
  lines.push('the whole point: new capacity genuinely works before it refills.')
  lines.push('')
  lines.push('### Capacity and speed — `traffic.ts`')
  lines.push('')
  lines.push('```')
  lines.push('greenRatio     = (cycle − 4 × phases) / cycle × arterialGreenShare')
  lines.push('capacity       = SATURATION_FLOW_RATE × greenRatio × widthFactor × lanes')
  lines.push('peakVolume     = AADT × PEAK_HOUR_FACTOR_K × DIRECTIONAL_SPLIT_D')
  lines.push('signalDelay    = 0.5 × cycle × (1 − g)² / (1 − min(1,x)·g)  +  700 × max(0, x − 0.85)²')
  lines.push('speed          = length / (length/freeFlow + signals × signalDelay)')
  lines.push('```')
  lines.push('')
  lines.push('`freeFlow` is the speed drivers actually choose, not the posted speed: wide lanes and')
  lines.push('many of them read as permission, and kerbside friction reads as a reason to slow down.')
  lines.push('A city can post 25 on a road built for 50 and get 45.')
  lines.push('')
  lines.push('### Traffic noise — `environment.ts`')
  lines.push('')
  lines.push('```')
  lines.push('Leq = NOISE_REFERENCE_DBA')
  lines.push('    + NOISE_DB_PER_VOLUME_DOUBLING   × log₂(volume / 1000)')
  lines.push('    + NOISE_DB_PER_SPEED_DOUBLING    × log₂(speed / 30)')
  lines.push('    − NOISE_DB_PER_DISTANCE_DOUBLING × log₂(distance / 50)')
  lines.push('```')
  lines.push('')
  lines.push('Halving traffic volume saves 3 dB. Halving speed saves 9 dB. That asymmetry is the')
  lines.push('single most useful fact in this document and almost nobody knows it.')
  lines.push('')
  lines.push('### Pedestrian fatality risk — `safety.ts`')
  lines.push('')
  lines.push('```')
  lines.push('P(death | struck at v) = 1 / (1 + exp(−(PED_FATALITY_LOGIT_INTERCEPT + PED_FATALITY_LOGIT_SLOPE × v)))')
  lines.push('```')
  lines.push('')
  lines.push('Fitted to the published curve: 10% at 23 mph, 25% at 32, 50% at 42, 75% at 50, 90% at 58.')
  lines.push('')
  lines.push('### Revenue and liability per acre — `fiscal.ts`')
  lines.push('')
  lines.push('```')
  lines.push('revenue_parcel   = rate(class) × cityShare × multiplier')
  lines.push('                 × (landValue × landWeight + improvementValue × improvementWeight)')
  lines.push('                 + sales × LOCAL_SALES_TAX_SHARE')
  lines.push('')
  lines.push('liability_parcel = arterialLiability × (frontageFeet / totalFrontageFeet)')
  lines.push('                 + acres × localStreetFeetPerAcre × costPerFootYear')
  lines.push('```')
  lines.push('')
  lines.push('Revenue follows the value created on a parcel. Liability follows the frontage and area')
  lines.push('that has to be served. Those two quantities are unrelated, and the gap between them is')
  lines.push('the game.')
  lines.push('')
  lines.push('### Reachability — `travel.ts`')
  lines.push('')
  lines.push('For each representative household, the model records which modes reach each kind of')
  lines.push('destination within fifteen minutes of CLOCK time - the literal, defensible definition')
  lines.push('used in the accessibility literature, unweighted by how unpleasant the trip is.')
  lines.push('')
  lines.push('This produces an uncomfortable year-zero reading, and it is left uncomfortable on')
  lines.push('purpose. Commerce Blvd is 1.2 miles long, so a supermarket on it is physically within')
  lines.push('a fifteen-minute walk of a good share of nearby households from day one. Almost none')
  lines.push('of them walk. The reckoning reports both numbers next to each other and says nothing')
  lines.push('further: the gap between what is reachable and what is done is the argument, and it')
  lines.push('is stronger than a claim that nothing was reachable would have been.')
  lines.push('')
  lines.push('### Mode choice — `travel.ts`')
  lines.push('')
  lines.push('```')
  lines.push('U_m       = ASC_m + β_time × perceivedMinutes_m + β_cost × cost_m')
  lines.push('P(m)      = exp(U_m) / Σ exp(U_k)          (over available modes only)')
  lines.push('')
  lines.push('perceivedWalk = clockWalk × (1 + (WALK_COMFORT_PENALTY_MAX − 1) × hostility)')
  lines.push('perceivedBike = clockBike × (1 + (BIKE_STRESS_PENALTY_MAX − 1) × (LTS − 1)/3)')
  lines.push('P(bike)      ×= bikeWillingShare(LTS)      (renormalised across the other modes)')
  lines.push('```')
  lines.push('')
  lines.push('Driving is unavailable to a household with no car; transit is unavailable where no bus')
  lines.push('runs. Mode share is never set by the player and never set directly at all — it falls out')
  lines.push('of distances, comfort, parking price and car ownership.')
  lines.push('')
  lines.push('### Urban heat — `environment.ts`')
  lines.push('')
  lines.push('```')
  lines.push('airTempExcess     = AIR_TEMP_UHI_MAX_F × impervious^1.3')
  lines.push('                  − canopy × 100 × AIR_TEMP_COOLING_PER_CANOPY_POINT_F')
  lines.push('surfaceTempExcess = SURFACE_TEMP_EXCESS_ASPHALT_F × (1 − shaded)')
  lines.push('                  + (SURFACE_TEMP_EXCESS_ASPHALT_F − SHADE_SURFACE_TEMP_REDUCTION_F) × shaded')
  lines.push('```')
  lines.push('')
  lines.push('**Air temperature and surface temperature are different quantities and the model keeps')
  lines.push('them apart.** Surface differences of 40°F between a car park and a shaded pavement are')
  lines.push('routine and well measured. Air temperature differences within a city are far smaller —')
  lines.push('a few degrees — and the two are constantly conflated in popular writing about heat.')
  lines.push('')
  return lines.join('\n') + '\n'
}

