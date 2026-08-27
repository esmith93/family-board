/**
 * The first ninety seconds.
 *
 * Cold open on the budget, then the job, then the offer. No tutorial, no
 * objective, and nothing about streets: the player is told the money does not
 * add up and handed one corridor.
 *
 * The grant screen states every term plainly, including the maintenance
 * transfer. The trap is not that anything is hidden. The trap is that it is
 * all true and it is still the obvious thing to do.
 */

import { C, instrumentById, laneMiles, type SimState } from '../sim/index'
import { money } from './format'
import { showWhy } from './why'

const veil = () => document.getElementById('modal') as HTMLElement
const sheet = () => document.getElementById('modalsheet') as HTMLElement

function show(html: string): void {
  sheet().innerHTML = html
  veil().classList.remove('hidden')
}

export function hideModal(): void {
  veil().classList.add('hidden')
}

/** The city's books, as the incoming director finds them. */
const GENERAL_FUND = {
  revenue: [
    ['Property tax', 38_400_000],
    ['Sales tax', 24_100_000],
    ['Fees, fines and licences', 11_700_000],
    ['State and federal aid', 9_200_000],
    ['Everything else', 4_300_000],
  ] as [string, number][],
  expenses: [
    ['Public safety', 41_200_000],
    ['Public works', 18_900_000],
    ['Administration', 9_400_000],
    ['Parks and libraries', 7_800_000],
    ['Debt service', 14_500_000],
  ] as [string, number][],
}

const sum = (rows: [string, number][]): number => rows.reduce((total, [, value]) => total + value, 0)

function budgetScreen(onNext: () => void): void {
  const revenue = sum(GENERAL_FUND.revenue)
  const expenses = sum(GENERAL_FUND.expenses)
  const shortfall = expenses - revenue

  show(`
    <div class="kicker">City of Fairview &middot; General Fund &middot; Adopted Budget</div>
    <h2>The budget does not balance.</h2>
    <dl>
      ${GENERAL_FUND.revenue.map(([label, value]) => `<dt>${label}</dt><dd>${money(value)}</dd>`).join('')}
      <dt class="total">Revenue</dt><dd class="total">${money(revenue)}</dd>
    </dl>
    <dl>
      ${GENERAL_FUND.expenses.map(([label, value]) => `<dt>${label}</dt><dd>${money(value)}</dd>`).join('')}
      <dt class="total">Expenses</dt><dd class="total">${money(expenses)}</dd>
    </dl>
    <div class="shortfall">−${money(shortfall)}</div>
    <p class="fine">Fairview has run a deficit for six consecutive years. Reserves cover two more.</p>
    <div class="actions"><button class="primary" id="ok">Continue</button></div>`)
  document.getElementById('ok')?.addEventListener('click', onNext)
}

function jobScreen(onNext: () => void): void {
  show(`
    <div class="kicker">Office of the City Manager</div>
    <h2>You are the new Public Works Director.</h2>
    <p>The council has given you Commerce Boulevard. One and two-tenths of a mile, six
    lanes, and rather more than half of it under parked cars. Twenty-six thousand people
    live within a mile of it and forty thousand vehicles a day pass along it.</p>
    <p>Nobody is going to tell you what to do with it. You have thirty years, which is
    longer than it sounds and shorter than it needs to be.</p>
    <p class="fine">Two things run out. The money, and the council's patience. Watch both.</p>
    <div class="actions"><button class="primary" id="ok">Take the job</button></div>`)
  document.getElementById('ok')?.addEventListener('click', onNext)
}

function grantScreen(state: SimState, onDecide: (accept: boolean) => void): void {
  const instrument = instrumentById('capital.state_widening')
  if (!instrument) { onDecide(false); return }

  const cityShare = instrument.capitalCost(state)
  const total = cityShare / (1 - C.STATE_GRANT_MATCH_RATIO)
  const stateShare = total - cityShare
  const addedLaneMiles = 2 * (C.CORRIDOR_LENGTH_FT / 5280)
  const beforeLaneMiles = laneMiles(state.street)
  const annual = addedLaneMiles * (
    C.ROAD_ROUTINE_MAINTENANCE_PER_LANE_MILE +
    C.ROAD_RESURFACE_COST_PER_LANE_MILE / C.PAVEMENT_RESURFACE_CYCLE_YEARS +
    C.ROAD_RECONSTRUCT_COST_PER_LANE_MILE / C.PAVEMENT_RECONSTRUCT_CYCLE_YEARS
  )

  show(`
    <div class="kicker">State Department of Transportation &middot; District 4</div>
    <h2>Commerce Boulevard Capacity Improvement</h2>
    <p>The Department is prepared to fund construction of one additional through lane in
    each direction along Commerce Boulevard, under the standard ninety-ten programme.</p>
    <dl>
      <dt>State share of construction</dt><dd>${money(stateShare)}</dd>
      <dt>City share of construction</dt><dd>${money(cityShare)}</dd>
      <dt class="total">Total project</dt><dd class="total">${money(total)}</dd>
    </dl>
    <p>On completion the roadway is transferred to the city, which accepts ownership and
    all subsequent maintenance and reconstruction.</p>
    <dl>
      <dt>Roadway today</dt><dd>${beforeLaneMiles.toFixed(1)} lane-miles</dd>
      <dt>Added by this project</dt><dd>${addedLaneMiles.toFixed(1)} lane-miles</dd>
      <dt>Added annual obligation</dt><dd>${money(annual)} / year, permanent</dd>
    </dl>
    <p class="fine">Construction: one season. No council vote is required to accept a
    state grant, so this costs you nothing politically.
    <button class="why" id="grantwhy" style="border-bottom:1px dotted currentColor">Why these numbers?</button></p>
    <div class="actions">
      <button id="decline">Decline the grant</button>
      <button class="primary" id="accept">Accept the grant</button>
    </div>`)

  document.getElementById('grantwhy')?.addEventListener('click', () => {
    showWhy(
      'The ninety-ten grant',
      'What the offer is built from: the match ratio, what a lane-mile costs to build, and what it costs to keep afterwards.',
      instrument.sourceKeys ?? [],
    )
  })
  document.getElementById('accept')?.addEventListener('click', () => onDecide(true))
  document.getElementById('decline')?.addEventListener('click', () => onDecide(false))
}

/**
 * A run left open in another sitting.
 *
 * This comes before the budget, and only for somebody who has a run to come
 * back to - a first-time player never sees it, so the cold open stays cold.
 * It says what year it is and nothing else. There is no summary of how it was
 * going, because a summary of how it was going is a verdict on how it was
 * going.
 */
export function offerToResume(year: number): Promise<boolean> {
  return new Promise((resolve) => {
    show(`
      <div class="kicker">Commerce Boulevard</div>
      <h2>You were part-way through.</h2>
      <p>A run is open at year ${year} of thirty.</p>
      <div class="actions">
        <button id="fresh">Start a new corridor</button>
        <button class="primary" id="carry">Carry on</button>
      </div>`)
    document.getElementById('carry')?.addEventListener('click', () => { hideModal(); resolve(true) })
    document.getElementById('fresh')?.addEventListener('click', () => resolve(false))
  })
}

/** Run the cold open. Resolves with whether the player took the grant. */
export function runOpening(state: SimState): Promise<boolean> {
  return new Promise((resolve) => {
    budgetScreen(() => jobScreen(() => grantScreen(state, (accept) => {
      hideModal()
      resolve(accept)
    })))
  })
}
