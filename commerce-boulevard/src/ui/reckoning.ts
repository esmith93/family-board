/**
 * The reckoning, on screen.
 *
 * A document, not a score screen. It has no grade on it, no stars, no summary
 * of how the player did, and nothing that says whether a number went the right
 * way. Two columns - what it was, what it is - and the reader does the
 * subtraction, because the subtraction is the point and doing it for them
 * would be the game telling them what to think.
 *
 * The only editorial act in here is the layout: putting the share of
 * households who could reach a grocery on foot in the same row as the share of
 * trips actually made on foot. Both are facts. So is the distance between them.
 */

import { reckon, type Format, type Reckoning, type ReckoningLine, type SimState } from '../sim/index'
import { escapeHtml, money } from './format'
import type { RunRecord } from './archive'

const el = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T

function value(raw: number, format: Format): string {
  if (!Number.isFinite(raw)) return '&mdash;'
  switch (format) {
    case 'money': return money(raw)
    case 'moneyExact': return money(raw, true)
    case 'moneyPerAcre': return `${money(raw)}<span class="unit">/acre</span>`
    case 'percent': return `${(raw * 100).toFixed(raw < 0.1 ? 1 : 0)}<span class="unit">%</span>`
    case 'count': return Math.round(raw).toLocaleString('en-US')
    case 'decimal1': return raw.toFixed(1)
    case 'mph': return `${Math.round(raw)}<span class="unit">mph</span>`
    case 'dba': return `${Math.round(raw)}<span class="unit">dBA</span>`
    case 'ratio': return `${raw.toFixed(2)}<span class="unit">&times;</span>`
    case 'feet': return `${Math.round(raw).toLocaleString('en-US')}<span class="unit">ft</span>`
  }
}

function row(line: ReckoningLine): string {
  return `
    <tr>
      <th>${escapeHtml(line.label)}${line.note ? `<span class="note">${escapeHtml(line.note)}</span>` : ''}</th>
      <td class="then">${value(line.then, line.format)}</td>
      <td class="now">${value(line.now, line.format)}</td>
      <td class="total">${line.total === undefined ? '' : value(line.total, line.format)}</td>
    </tr>`
}

const USE_LABELS: Readonly<Record<string, string>> = Object.freeze({
  vacant: 'Vacant land',
  surface_parking: 'Surface car park',
  auto_service: 'Filling stations and car washes',
  big_box: 'Big-box anchor',
  strip_mall: 'Strip retail',
  single_family: 'Detached houses',
  garden_apartment: 'Walk-up flats',
  office_park: 'Office park',
  mainstreet_mixed: 'Shopfront with flats over',
  midrise_mixed: 'Mid-rise with shops beneath',
  civic: 'Civic',
  park: 'Park',
  plaza: 'Plaza',
})

/**
 * The corridor by land use.
 *
 * Sorted by area, because area is what the city pays to serve and the order it
 * produces is the finding: the biggest things on the corridor are not the ones
 * paying for it.
 */
function accountTable(reckoning: Reckoning): string {
  const rows = reckoning.account.byUse
    .filter((u) => u.acres >= 1)
    .map((u) => `
      <tr>
        <th>${escapeHtml(USE_LABELS[u.use] ?? u.use)}<span class="note">${u.acres.toFixed(0)} acres</span></th>
        <td class="then">${money(u.revenuePerAcre)}<span class="unit">/acre</span></td>
        <td class="now">${money(u.liabilityPerAcre)}<span class="unit">/acre</span></td>
        <td class="total">${u.ratio.toFixed(2)}<span class="unit">&times;</span></td>
      </tr>`).join('')

  return `
    <h3>Every acre, by what is on it</h3>
    <table class="reck">
      <thead><tr><th></th><th>Pays</th><th>Costs</th><th>Ratio</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`
}

/** Show it. Resolves when the player closes it. */
/**
 * Runs you have already played.
 *
 * The one place the game can put two of the player's own thirty years next to
 * each other. It is a list in the order they happened - not a table that sorts,
 * not a best run, not a personal best. Every column is a fact the run finished
 * on, and the sentence anybody draws out of reading down them is theirs.
 */
function previousRuns(runs: RunRecord[]): string {
  const past = runs.slice(0, -1)
  if (past.length === 0) return ''
  const ENDING: Readonly<Record<RunRecord['reason'], string>> = {
    fired: 'Replaced',
    insolvent: 'State oversight',
    completed: 'Ran the thirty',
  }
  const rows = past.map((run, i) => `
    <tr>
      <th>Run ${i + 1}<span class="note">${escapeHtml(run.seed)}</span></th>
      <td class="then">${ENDING[run.reason]}, year ${run.finishedYear}</td>
      <td class="now">${run.ratio.toFixed(2)}<span class="unit">×</span></td>
      <td class="now">${(run.walkShare * 100).toFixed(1)}<span class="unit">%</span></td>
    </tr>`).join('')
  return `
    <h3>Corridors before this one</h3>
    <table class="reck">
      <thead>
        <tr><th></th><th>Ended</th><th>Revenue ÷ liability</th><th>On foot</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`
}

export function showReckoning(state: SimState, runs: RunRecord[], onRestart: () => void): void {
  const reckoning = reckon(state)
  const sheet = el('reckoning')

  const sections = reckoning.sections.map((section) => `
    <h3>${escapeHtml(section.title)}</h3>
    <table class="reck">
      <thead>
        <tr><th></th><th>Year 0</th><th>Year ${reckoning.finalYear}</th><th>All thirty</th></tr>
      </thead>
      <tbody>${section.lines.map(row).join('')}</tbody>
    </table>`).join('')

  const vocabulary = reckoning.vocabulary.length === 0
    ? ''
    : `<h3>What you found out, and when</h3>
       <ol class="vocab">${reckoning.vocabulary.map((v) =>
         `<li><b>Year ${v.year}</b> ${escapeHtml(v.term)}</li>`).join('')}</ol>`

  sheet.innerHTML = `
    <div class="kicker">Year ${reckoning.finalYear} &middot; Commerce Boulevard, Fairview</div>
    <h2>${escapeHtml(reckoning.headline)}</h2>

    <div class="reach">
      <div><b>${(reckoning.reach.couldWalkToGrocery * 100).toFixed(0)}%</b>
        <span>of households were within a fifteen-minute walk of a grocery</span></div>
      <div><b>${(reckoning.reach.walked * 100).toFixed(1)}%</b>
        <span>of trips were made on foot</span></div>
    </div>

    ${sections}
    ${accountTable(reckoning)}
    ${vocabulary}
    ${previousRuns(runs)}

    <div class="actions"><button class="primary" id="reckagain">Start again</button></div>`

  el('reckveil').classList.remove('hidden')
  // The veil is the scroll container, not the sheet inside it.
  el('reckveil').scrollTop = 0
  el('reckagain').addEventListener('click', () => {
    el('reckveil').classList.add('hidden')
    onRestart()
  }, { once: true })
}
