/**
 * Front page stories for the Fairview Ledger.
 *
 * House style, such as it is: report what happened, quote whoever will talk,
 * and do not go looking for a cause. The Ledger has a circulation of nine
 * thousand and one reporter covering the city, and it has never once put two
 * years side by side.
 *
 * It cheers the widening. Five years later it runs the chain restaurant's
 * press release, which says the traffic counts sold them the site. Thirteen
 * years after that it runs a baffled piece about the public works gap. It does
 * not notice that these are the same story.
 */

import type { Observation } from './observation'

export type Slot = 'lead' | 'second' | 'brief'

export interface Story {
  id: string
  slot: Slot
  headline: string
  subhead?: string
  body?: string
  /** Where along the corridor the photographer was sent, 0..1. */
  photoAt?: number
}

interface Template {
  id: string
  slot: Slot
  /**
   * `turned` is the paper's own state, not the city's: whether the desk has
   * come round on the corridor. It arrives as an argument because a story
   * cannot work it out from one year's numbers, and neither could a reporter.
   */
  when: (o: Observation, turned: boolean) => boolean
  weight: (o: Observation) => number
  build: (o: Observation) => Omit<Story, 'id' | 'slot'>
}

const S = (t: Template): Template => t
const thousands = (n: number): string => Math.round(n).toLocaleString('en-US')
const money = (n: number): string => {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(1)} million`
  return `$${Math.round(abs / 1000)},000`
}

export const STORIES: readonly Template[] = [
  // --- Traffic -------------------------------------------------------------
  S({
    id: 'traffic.faster',
    slot: 'lead',
    when: (o) => o.speedChange > 1.2,
    weight: () => 22,
    build: (o) => ({
      headline: 'Commerce Blvd running freely again',
      subhead: `Peak-hour speeds up to ${o.peakSpeedMph.toFixed(0)} mph, the best figure the city has recorded in years`,
      body: 'Drivers along the corridor reported markedly shorter journeys this year, with the run '
        + 'from Ninth Street to the shopping centre described by one regular commuter as "night and day". '
        + 'A spokesman for the Department of Public Works said the improvement reflected recent investment '
        + 'in the corridor and that the city expected the benefits to continue.',
      photoAt: 0.5,
    }),
  }),
  S({
    id: 'traffic.slower',
    slot: 'lead',
    when: (o) => o.speedChange < -1 && o.year >= 6,
    weight: () => 20,
    build: (o) => ({
      headline: 'Backups return to Commerce Boulevard',
      subhead: `Peak-hour traffic down to ${o.peakSpeedMph.toFixed(0)} mph as counts reach ${thousands(o.aadt)} vehicles a day`,
      body: 'Congestion has returned to the corridor after several quieter years, with queues reported '
        + 'through the evening peak. The city engineer\'s office attributed the change to volumes being '
        + '"up across the board" and said it was monitoring the situation.',
      photoAt: 0.45,
    }),
  }),
  S({
    id: 'traffic.record',
    slot: 'second',
    when: (o) => o.aadt > 44_000,
    weight: () => 12,
    build: (o) => ({
      headline: 'Traffic counts set a record on Commerce',
      subhead: `${thousands(o.aadt)} vehicles a day, the highest since counting began`,
    }),
  }),
  S({
    id: 'traffic.gridlock',
    slot: 'lead',
    when: (o) => o.peakSpeedMph < 13,
    weight: () => 24,
    build: () => ({
      headline: 'Commerce Boulevard at a standstill',
      subhead: 'Drivers report the corridor is "unusable" between four and six',
      body: 'Traffic on the boulevard slowed to walking pace through the evening peak on most days '
        + 'this year. The city has not said what it intends to do about it.',
      photoAt: 0.5,
    }),
  }),

  // --- Construction --------------------------------------------------------
  S({
    id: 'works.begin',
    slot: 'lead',
    when: (o) => o.worksUnderWay.length > 0 && o.year <= 4,
    weight: () => 16,
    build: (o) => ({
      headline: 'Work begins on Commerce Boulevard',
      subhead: `${o.worksUnderWay[0]}. Lane closures expected through the season`,
      body: 'Contractors moved onto the corridor this spring. Businesses along the affected stretch '
        + 'have been advised that access will be maintained throughout.',
      photoAt: 0.35,
    }),
  }),
  S({
    id: 'works.finished',
    slot: 'lead',
    when: (o) => o.worksFinished.length > 0,
    weight: () => 19,
    build: (o) => ({
      headline: 'Ribbon cut on Commerce Boulevard project',
      subhead: o.worksFinished[0] ?? 'The work is finished',
      body: 'Officials gathered on the boulevard on Friday to mark the completion of the scheme. '
        + 'The Public Works Director was photographed with a pair of ceremonial scissors and thanked '
        + 'residents for their patience.',
      photoAt: 0.55,
    }),
  }),
  S({
    id: 'works.cost',
    slot: 'second',
    when: (o) => o.worksUnderWay.length > 0 && o.businessesClosed > 1,
    weight: () => 13,
    build: () => ({
      headline: 'Traders count the cost of the closures',
      subhead: 'Shopkeepers say takings are down while the cones are up',
    }),
  }),

  // --- Money ---------------------------------------------------------------
  S({
    id: 'money.gap',
    slot: 'lead',
    when: (o) => o.shortfallChange > 120_000 && o.year >= 8,
    weight: (o) => 17 + Math.min(6, o.year / 4),
    build: (o) => ({
      headline: 'Public works gap widens again',
      subhead: `Council told the shortfall now stands at ${money(o.cityShortfall)}`,
      body: 'Members expressed frustration at Tuesday\'s meeting, with one describing the figures as '
        + '"impossible to follow". The finance officer said costs had risen across every category and '
        + 'that no single item accounted for the increase. No decision was taken.',
      photoAt: 0.5,
    }),
  }),
  S({
    id: 'money.debt',
    slot: 'second',
    when: (o) => o.debt > 2_000_000,
    weight: () => 15,
    build: (o) => ({
      headline: 'City borrows to cover public works',
      subhead: `Outstanding debt reaches ${money(o.debt)}`,
    }),
  }),
  S({
    id: 'money.better',
    slot: 'lead',
    when: (o) => o.shortfallChange < -150_000 && o.year >= 10,
    weight: () => 16,
    build: (o) => ({
      headline: 'City books look better than they have in years',
      subhead: `The shortfall narrowed to ${money(o.cityShortfall)}, the first improvement in some time`,
      body: 'The finance officer told members the position had improved but cautioned against reading '
        + 'too much into a single year. Several members asked what had changed. No clear answer was given.',
    }),
  }),
  S({
    id: 'money.tax',
    slot: 'second',
    when: (o) => o.taxChanged > 0,
    weight: () => 11,
    build: () => ({
      headline: 'Council adjusts the rate',
      subhead: 'Bills to change from the new financial year',
    }),
  }),

  // --- Business ------------------------------------------------------------
  S({
    id: 'business.chain',
    slot: 'lead',
    when: (o) => o.businessesOpened >= 2 && o.aadt > 38_000 && o.year >= 3 && o.year <= 12,
    weight: () => 18,
    build: () => ({
      headline: 'National chain picks Fairview',
      subhead: 'Company says the traffic counts on Commerce sold them the site',
      body: 'A regional restaurant group has confirmed it will open on Commerce Boulevard next year, '
        + 'taking a pad site at the eastern end of the corridor. A spokeswoman said the location\'s '
        + '"outstanding vehicular exposure" had been decisive. The city welcomed the investment.',
      photoAt: 0.75,
    }),
  }),
  S({
    id: 'business.vacancy',
    slot: 'lead',
    when: (o) => o.vacancyMood === 'emptying' && o.businessesClosed >= 3,
    weight: () => 16,
    build: (o) => ({
      headline: `Another ${o.businessesClosed} units go dark on Commerce`,
      subhead: 'Landlords blame the economy. Traders blame the road',
      body: 'The vacancies bring the number of empty units along the corridor to a level several '
        + 'long-standing traders described as the worst they can remember.',
      photoAt: 0.25,
    }),
  }),
  S({
    id: 'business.grocery',
    slot: 'lead',
    when: (o) => o.events.some((e) => e.id === 'retail_churn') && o.businessesOpened > 0 && o.walkShare > 0.16,
    weight: () => 14,
    build: () => ({
      headline: 'Grocery to open on Commerce',
      subhead: 'First full-line store on the corridor in a decade',
      body: 'The store will take a unit on the central block and expects to employ thirty. '
        + 'The operator said it had looked at the corridor twice before and passed both times. '
        + 'Asked what had changed, a spokesman said the company reviewed sites continuously.',
      photoAt: 0.4,
    }),
  }),
  S({
    id: 'business.filling',
    slot: 'second',
    when: (o) => o.vacancyMood === 'filling',
    weight: () => 10,
    build: (o) => ({
      headline: `${o.businessesOpened} new businesses on the corridor`,
      subhead: 'Chamber of commerce reports the strongest letting season in years',
    }),
  }),

  // --- Housing -------------------------------------------------------------
  S({
    id: 'housing.built',
    slot: 'second',
    when: (o) => o.newHomes >= 2,
    weight: () => 12,
    build: (o) => ({
      headline: `${o.newHomes} sites cleared for homes on Commerce`,
      subhead: 'Developers say the corridor is finally penciling',
    }),
  }),
  S({
    id: 'housing.rent',
    slot: 'second',
    when: (o) => o.rentChange > 55,
    weight: () => 11,
    build: (o) => ({
      headline: 'Rents up again across the corridor',
      subhead: `Median now $${thousands(o.medianRent)} a month, up $${thousands(o.rentChange)}`,
    }),
  }),

  // --- Safety --------------------------------------------------------------
  S({
    id: 'safety.fatal',
    slot: 'lead',
    when: (o) => o.fatalityChange > 0.5,
    weight: () => 26,
    build: () => ({
      headline: 'Pedestrian killed crossing Commerce Boulevard',
      subhead: 'Police say the driver remained at the scene',
      body: 'The collision occurred in the evening. Officers said speed was being investigated as a '
        + 'factor and appealed for witnesses. It is the second such death on the corridor in recent years.',
      photoAt: 0.6,
    }),
  }),
  S({
    id: 'safety.crashes',
    slot: 'second',
    when: (o) => o.crashChange > 10,
    weight: () => 13,
    build: (o) => ({
      headline: 'Crash figures up on Commerce',
      subhead: `${Math.round(o.crashes)} reported collisions on the corridor this year`,
    }),
  }),
  S({
    id: 'safety.better',
    slot: 'second',
    when: (o) => o.crashChange < -12,
    weight: () => 12,
    build: (o) => ({
      headline: 'Fewer collisions reported on Commerce',
      subhead: `Down to ${Math.round(o.crashes)} from ${Math.round(o.crashes - o.crashChange)} last year`,
    }),
  }),

  // --- Weather and trees ---------------------------------------------------
  S({
    id: 'env.heat',
    slot: 'second',
    when: (o) => o.daysOver95 > 32,
    weight: () => 11,
    build: (o) => ({
      headline: `${o.daysOver95} days over ninety-five`,
      subhead: 'Cooling centre at the library open through August',
    }),
  }),
  S({
    id: 'env.trees',
    slot: 'brief',
    when: (o) => o.events.some((e) => String(e.detail.instrument ?? '').includes('plant_trees')),
    weight: () => 9,
    build: () => ({
      headline: 'Trees for the boulevard',
      subhead: 'City says they will be "something to see" in fifteen years',
    }),
  }),

  // --- Buses ---------------------------------------------------------------
  S({
    id: 'transit.more',
    slot: 'brief',
    when: (o) => o.events.some((e) => String(e.detail.instrument ?? '').includes('increase_transit')),
    weight: () => 9,
    build: () => ({
      headline: 'More buses for the Commerce route',
    }),
  }),
  S({
    id: 'transit.empty',
    slot: 'second',
    when: (o) => o.year >= 6 && o.walkShare < 0.12 && o.events.length > 0
      && o.history.some((h) => h.modeShare.transit < 0.02),
    weight: () => 8,
    build: () => ({
      headline: 'Commerce bus carrying "almost nobody"',
      subhead: 'Figures released to the council show single-figure boardings at some stops',
    }),
  }),

  // --- The turn ------------------------------------------------------------
  S({
    id: 'turn.what_happened',
    slot: 'lead',
    when: (o, turned) => turned && o.year >= 18,
    weight: () => 21,
    build: () => ({
      headline: 'What happened to Commerce Boulevard?',
      // The reporter's own count, not the reporter's conclusion. The body
      // below is exactly right - three parties with three explanations and
      // a desk that cannot pick between them - and this line used to reach
      // over it and reason about what the corridor had become.
      subhead: 'This reporter counted more people on the pavement than cars at the lights',
      body: 'This reporter walked the length of the corridor on a Thursday evening and counted more '
        + 'people on the pavement than cars at the lights. Traders put it down to the new units. '
        + 'Residents put it down to the trees. The city, asked what had changed, said a number of '
        + 'schemes had been delivered over the past two decades.',
      photoAt: 0.5,
    }),
  }),
  S({
    id: 'turn.merchants',
    slot: 'lead',
    when: (o, turned) => turned && o.vacancyMood !== 'emptying',
    weight: () => 17,
    build: () => ({
      headline: 'Best year on Commerce since the seventies, traders say',
      subhead: 'Letting agents report no vacant units on the central block for the first time in living memory',
      photoAt: 0.45,
    }),
  }),
  S({
    id: 'turn.counters',
    slot: 'second',
    when: (o, turned) => turned && o.walkChange > 0.01,
    weight: () => 14,
    build: (o) => ({
      headline: 'More people on foot than the counters expected',
      subhead: `${(o.walkShare * 100).toFixed(0)} per cent of trips on the corridor now made walking`,
    }),
  }),

  // --- Filler. A small paper always has some -------------------------------
  S({ id: 'filler.council', slot: 'brief', when: () => true, weight: () => 3,
    build: () => ({ headline: 'Council to meet Tuesday' }) }),
  S({ id: 'filler.library', slot: 'brief', when: () => true, weight: () => 2,
    build: () => ({ headline: 'Library hours to change for the summer' }) }),
  S({ id: 'filler.league', slot: 'brief', when: () => true, weight: () => 2,
    build: () => ({ headline: 'Little League sign-ups Saturday at Veterans Park' }) }),
  S({ id: 'filler.water', slot: 'brief', when: () => true, weight: () => 3,
    build: () => ({ headline: 'Water main work on Delaware from Monday' }) }),
  S({ id: 'filler.fair', slot: 'brief', when: () => true, weight: () => 2,
    build: () => ({ headline: 'County fair returns next month' }) }),

  // A weekly has to lead with something in a year when nothing happened, and
  // it has more than one way of saying nothing happened.
  S({ id: 'filler.quiet', slot: 'lead', when: () => true, weight: () => 4,
    build: (o) => ({
      headline: 'A quiet year on Commerce Boulevard',
      subhead: `Counts steady at ${thousands(o.aadt)} vehicles a day and no schemes reported`,
      body: 'Little changed along the corridor this year. The Department of Public Works confirmed '
        + 'that routine maintenance had been carried out as scheduled.',
      photoAt: 0.5,
    }) }),
  S({ id: 'filler.agenda', slot: 'lead', when: () => true, weight: () => 4,
    build: () => ({
      headline: 'Commerce Boulevard back on the agenda',
      subhead: 'Members hear an update from the Department of Public Works. No decision expected',
      body: 'The corridor returned to the council chamber on Tuesday for the third time in as many '
        + 'years. Members heard a presentation, asked seven questions and thanked the director for '
        + 'his time. The item was carried forward.',
      photoAt: 0.4,
    }) }),
  S({ id: 'filler.paving', slot: 'lead', when: () => true, weight: () => 4,
    build: () => ({
      headline: 'Crews out on the boulevard again',
      subhead: 'City says the patching is routine and the surface has "years left in it"',
      body: 'Motorists reported lane closures on several mornings this month while crews worked on '
        + 'the surface. A spokesman said the work was scheduled and that a fuller programme would be '
        + 'brought forward when funds allowed.',
      photoAt: 0.6,
    }) }),
  S({ id: 'filler.weather', slot: 'lead', when: (o) => o.year >= 3, weight: () => 3,
    build: () => ({
      headline: 'Storm takes the lights out along Commerce',
      subhead: 'Power restored by Thursday. Two signals still on flash',
      body: 'The storm brought down branches across the east of the city and left much of the '
        + 'corridor dark for two nights. The utility said crews had worked through the weekend.',
      photoAt: 0.7,
    }) }),
  S({ id: 'filler.reunion', slot: 'lead', when: (o) => o.year >= 5, weight: () => 3,
    build: () => ({
      headline: 'Fairview High class of \'68 marks its reunion',
      subhead: 'Two hundred back in town for the weekend, most of them with something to say about the traffic',
      body: 'The reunion committee reported the best turnout in a decade. Several returning graduates '
        + 'remarked on how much the city had changed, and several others on how little.',
      photoAt: 0.3,
    }) }),
]
