/**
 * The isometric view of Commerce Blvd.
 *
 * Phase 2 has no instrument panel yet, so a handful of keys stand in for the
 * ones that most change the picture. The point of this entry is to be able to
 * look at the corridor and judge whether it reads.
 */

import { advanceYear, newGame } from './sim/step'
import { buildScene } from './render/scene'
import { IsometricRenderer } from './render/renderer'
import type { LightName, SeasonName } from './render/palette'
import type { SimState } from './sim/types'

const canvas = document.getElementById('view') as HTMLCanvasElement
const readout = document.getElementById('readout') as HTMLElement
const statsPanel = document.getElementById('stats') as HTMLElement

let state: SimState = newGame('fairview')
const renderer = new IsometricRenderer(canvas)

function fit(): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  renderer.resize(Math.floor(window.innerWidth * dpr), Math.floor(window.innerHeight * dpr))
  canvas.style.width = '100%'
  canvas.style.height = '100%'
}

function refresh(): void {
  const scene = buildScene(state)
  renderer.setScene(scene)
}

function start(): void {
  fit()
  refresh()
  // Open on the middle of the corridor, far enough back to see both sides of
  // it. A strip corridor is 900 feet from back lot to back lot, so this is a
  // long way out - which is itself the first thing worth noticing about it.
  renderer.lookAt(0.5, 0)
  renderer.camera.gy = 38
  renderer.camera.zoom = 0.55
}

const money = (n: number): string =>
  (n < 0 ? '−$' : '$') + Math.abs(Math.round(n / 1000)).toLocaleString() + 'k'

function updateHud(): void {
  const h = state.history[state.history.length - 1]
  if (!h) return
  const surplusClass = h.surplus < 0 ? 'warn' : 'good'
  readout.innerHTML = [
    row('Year', `${h.year} / 30`),
    row('Budget', `<span class="${surplusClass}">${money(h.surplus)}</span>`),
    row('Debt', h.debt > 0 ? `<span class="warn">${money(h.debt)}</span>` : money(0)),
    row('Approval', `${h.approval.toFixed(0)}%`),
    row('Political capital', h.capital.toFixed(0)),
    row('Traffic', `${h.aadt.toLocaleString()} / day`),
    row('Peak speed', `${h.peakSpeedMph.toFixed(1)} mph`),
    row('On foot', `${(h.modeShare.walk * 100).toFixed(1)}%`),
    row('Kerbside noise', `${h.noiseDba.toFixed(0)} dBA`),
    row('Crashes', h.crashes.toFixed(0)),
    row('Canopy', `${(h.canopyFraction * 100).toFixed(0)}%`),
  ].join('')
}

const row = (label: string, value: string): string => `<dt>${label}</dt><dd>${value}</dd>`

function updateStats(): void {
  const s = renderer.stats
  statsPanel.innerHTML = [
    `${s.avgFrameMs.toFixed(1)} ms avg &middot; ${s.frameMs.toFixed(1)} ms`,
    `${s.chunksDrawn} chunks (${s.tilesDrawn} tiles) &middot; ${s.objectsDrawn} objects`,
    `${s.chunksBaked} chunk bakes`,
    `${s.spritesRasterised} sprites drawn once`,
    `${s.canvasesPainted} palette paints`,
    `${renderer.lightName} &middot; ${renderer.seasonName}`,
  ].join('<br>')
}

// --- Input -----------------------------------------------------------------

let dragging = false
let lastX = 0
let lastY = 0

canvas.addEventListener('pointerdown', (event) => {
  dragging = true
  lastX = event.clientX
  lastY = event.clientY
  canvas.classList.add('dragging')
  canvas.setPointerCapture(event.pointerId)
})
canvas.addEventListener('pointerup', (event) => {
  dragging = false
  canvas.classList.remove('dragging')
  canvas.releasePointerCapture(event.pointerId)
})
canvas.addEventListener('pointermove', (event) => {
  if (!dragging) return
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  renderer.panBy((event.clientX - lastX) * dpr, (event.clientY - lastY) * dpr)
  lastX = event.clientX
  lastY = event.clientY
})
canvas.addEventListener('wheel', (event) => {
  event.preventDefault()
  renderer.zoomBy(event.deltaY < 0 ? 1.12 : 1 / 1.12)
}, { passive: false })

const LIGHTS: LightName[] = ['day', 'dusk', 'night', 'overcast']
const SEASONS: Record<string, SeasonName> = { q: 'spring', w: 'summer', e: 'autumn', t: 'winter' }
const SHORTCUTS: Record<string, string> = {
  d: 'capital.road_diet',
  b: 'street.protected_bike_lane',
  p: 'street.plant_trees',
  m: 'land.allow_mixed_use',
  n: 'street.narrow_lanes',
  k: 'street.add_kerb_parking',
}

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase()

  if (key === ' ') {
    event.preventDefault()
    state = advanceYear(state, []).state
    refresh()
    updateHud()
    return
  }
  if (key === 'r') {
    state = newGame(`fairview-${Math.floor(Date.now() / 1000) % 9973}`)
    refresh()
    updateHud()
    return
  }
  if (key >= '1' && key <= '4') {
    renderer.setLight(LIGHTS[Number(key) - 1]!)
    return
  }
  if (SEASONS[key]) {
    renderer.setSeason(SEASONS[key]!)
    refresh()
    return
  }
  if (key === 'w' && state.year <= 2) {
    state = advanceYear(state, ['capital.state_widening']).state
    refresh(); updateHud(); return
  }
  if (SHORTCUTS[key]) {
    state = advanceYear(state, [SHORTCUTS[key]!]).state
    refresh(); updateHud()
  }
})

window.addEventListener('resize', () => { fit() })

// --- Loop ------------------------------------------------------------------

function frame(time: number): void {
  renderer.render(time)
  updateStats()
  requestAnimationFrame(frame)
}

start()
updateHud()
requestAnimationFrame(frame)
