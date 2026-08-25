/**
 * "Why this number?"
 *
 * Every figure the game shows can be interrogated: what it is, the range it
 * sits in, who measured it, and whether the literature actually agrees. Where
 * researchers disagree the panel says so rather than presenting a contested
 * figure with a confident face.
 *
 * This costs nothing and it is the difference between a toy and something
 * defensible.
 */

import { CONSTANT_REGISTRY, type SourcedConstant } from '../sim/index'
import { constantValue, escapeHtml } from './format'

const veil = () => document.getElementById('why') as HTMLElement
const sheet = () => document.getElementById('whysheet') as HTMLElement

function renderConstant(constant: SourcedConstant): string {
  const isDesign = constant.source.url === 'internal'
  const tag = constant.confidence === 'contested'
    ? '<span class="tag contested">researchers disagree</span>'
    : isDesign ? '<span class="tag design">design parameter</span>'
      : `<span class="tag">${constant.confidence === 'settled' ? 'settled' : 'varies by context'}</span>`

  const source = isDesign
    ? '<span class="fine">Chosen for play, not measured in the field.</span>'
    : `<a href="${escapeHtml(constant.source.url)}" target="_blank" rel="noreferrer">${escapeHtml(constant.source.title)}</a> <span class="fine">(${escapeHtml(constant.source.year)})</span>`

  return `
    <div class="const">
      <div class="top">
        <span class="lab">${escapeHtml(constant.label)}</span>
        <span class="val">${escapeHtml(constantValue(constant.value, constant.unit))}</span>
      </div>
      <div class="meta">
        plausible range ${escapeHtml(constantValue(constant.low, constant.unit))}
        &ndash; ${escapeHtml(constantValue(constant.high, constant.unit))} &nbsp; ${tag}
      </div>
      <div class="note">${escapeHtml(constant.note)}</div>
      <div class="meta">${source}</div>
    </div>`
}

export function showWhy(title: string, blurb: string, keys: readonly string[]): void {
  const found = keys
    .map((key) => CONSTANT_REGISTRY[key])
    .filter((c): c is SourcedConstant => Boolean(c))

  sheet().innerHTML = `
    <div class="kicker">Why this number?</div>
    <h2>${escapeHtml(title)}</h2>
    <p class="fine">${escapeHtml(blurb)}</p>
    ${found.length > 0 ? found.map(renderConstant).join('') : '<p class="fine">No published figure sits behind this one.</p>'}
    <div class="actions"><button id="whyclose">Close</button></div>`

  veil().classList.remove('hidden')
  const close = document.getElementById('whyclose')
  close?.addEventListener('click', hideWhy)
}

export function hideWhy(): void {
  veil().classList.add('hidden')
}

export function initWhy(): void {
  veil().addEventListener('click', (event) => {
    if (event.target === veil()) hideWhy()
  })
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hideWhy()
  })
}
