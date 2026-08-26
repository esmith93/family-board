/**
 * The instruments panel and the two-currency economy.
 *
 * RULE, enforced by a test: a card states what an instrument changes, what it
 * costs in money, what it costs in political capital, and how long the works
 * take. It never states what the change is FOR, and it never says whether it
 * is a good idea.
 */

import {
  advanceYear, availableInstruments, borrowingHeadroom, C, cardById, cityShortfall,
  committedCapital, INSTRUMENTS, instrumentById, newGame,
  type Instrument, type InstrumentTab, type SimState,
} from '../sim/index'
import { buildScene } from '../render/scene'
import { IsometricRenderer } from '../render/renderer'
import type { LightName, SeasonName } from '../render/palette'
import { duration, escapeHtml, money, percent } from './format'
import { initWhy, showWhy } from './why'
import { hideModal, runOpening, showEnding } from './opening'
import { showFrontPage } from './newspaper'
import { observe } from '../paper/observation'
import { circumstanceOf, newMemory, type PaperMemory } from '../paper/residents'
import { composeFrontPage } from '../paper/paper'

/**
 * The year turning.
 *
 * Four seasons at two seconds each, done entirely by swapping the palette's
 * lookup table - no sprite is redrawn and nothing is re-rasterised, which is
 * the whole reason the renderer works in palette indices. The corridor itself
 * is rebuilt during the autumn-to-winter change, under snow, so a shop that
 * closed or a building that went up arrives without a pop.
 */
const YEAR_SEASONS: { season: SeasonName; light: LightName; caption: string }[] = [
  { season: 'spring', light: 'day', caption: 'Spring' },
  { season: 'summer', light: 'day', caption: 'Summer' },
  { season: 'autumn', light: 'dusk', caption: 'Autumn' },
  { season: 'winter', light: 'overcast', caption: 'Winter' },
]
const SEASON_MS = 2000

/** The plan the simulation tests use, for the ?ff= development shortcut. */
const DEV_PLAN: Record<number, string[]> = {
  0: ['land.reduce_parking_minimums'], 1: ['land.allow_mixed_use'],
  2: ['fiscal.business_improvement_district'], 3: ['street.plant_trees'],
  4: ['land.reduce_setbacks'], 5: ['fiscal.land_value_shift'],
  6: ['land.abolish_parking_minimums'], 7: ['capital.road_diet'], 8: ['capital.repave'],
  9: ['street.add_kerb_parking'], 10: ['fiscal.price_parking'], 11: ['land.raise_height_limit'],
  12: ['street.lower_target_speed'], 13: ['fiscal.land_value_shift'], 14: ['street.narrow_lanes'],
  15: ['street.add_crossings'], 16: ['land.raise_height_limit'], 17: ['street.plant_trees'],
  18: ['capital.bulb_outs'], 19: ['fiscal.land_value_shift'], 20: ['street.landscaped_median'],
  21: ['land.form_based_code'], 22: ['capital.repave'], 23: ['street.plant_trees'],
  24: ['street.widen_sidewalks'], 25: ['capital.plaza_middle'],
}

const TABS: { id: InstrumentTab; label: string }[] = [
  { id: 'street', label: 'Street' },
  { id: 'land', label: 'Land use' },
  { id: 'fiscal', label: 'Fiscal' },
  { id: 'capital', label: 'Capital' },
]

const el = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T

type CardState = 'available' | 'selected' | 'unaffordable' | 'locked' | 'unavailable'

export class Game {
  private state: SimState
  private readonly renderer: IsometricRenderer
  private selected = new Set<string>()
  private tab: InstrumentTab = 'capital'
  private started = false
  private advancing = false
  private skipped = false
  private memory: PaperMemory
  private sceneId = 0

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.state = newGame(seedForToday())
    this.memory = newMemory(this.state)
    this.renderer = new IsometricRenderer(canvas)
    initWhy()
    this.bindInput()
    this.fit()
    this.refreshScene()
    this.renderer.camera.gy = 38
    this.renderer.camera.zoom = 0.55
    this.renderer.lookAt(0.5, 0)
    this.renderer.camera.gy = 38
    this.renderAll()
    const skipTo = Number(new URLSearchParams(window.location.search).get('ff') ?? 0)
    if (import.meta.env.DEV && skipTo > 0) this.fastForward(skipTo)
    else void this.open()
    requestAnimationFrame((t) => this.frame(t))
  }

  // --- Lifecycle -----------------------------------------------------------

  private async open(): Promise<void> {
    document.body.classList.add('intro')
    const accepted = await runOpening(this.state)
    document.body.classList.remove('intro')
    this.started = true
    if (accepted) this.selected.add('capital.state_widening')
    this.renderAll()
  }

  /**
   * Play forward silently, for looking at a late corridor without sitting
   * through thirty years of it. Development only - the query string does
   * nothing in a built game.
   */
  private fastForward(years: number): void {
    this.started = true
    for (let y = 0; y < years && !this.state.ended; y++) {
      const before = cityShortfall(this.state)
      this.state = advanceYear(this.state, DEV_PLAN[this.state.year] ?? []).state
      // Run the paper too, so its memory - who has written in, what it has
      // already printed, whether it has come round - is where it should be.
      const frozen = this.state
      composeFrontPage(
        observe(this.state, cityShortfall(this.state), before),
        this.memory, (r) => circumstanceOf(r, frozen), this.state.seed,
      )
    }
    this.refreshScene()
    this.renderAll()
  }

  private restart(): void {
    this.state = newGame(seedForToday())
    this.memory = newMemory(this.state)
    this.selected.clear()
    this.started = false
    this.refreshScene()
    this.renderAll()
    void this.open()
  }

  private async advance(): Promise<void> {
    if (this.state.ended || this.advancing) return
    this.advancing = true
    this.skipped = false
    document.body.classList.add('advancing')

    const chosen = [...this.selected]
    const shortfallBefore = cityShortfall(this.state)

    // Spring, summer, autumn. The city is still last year's city.
    for (const step of YEAR_SEASONS.slice(0, 3)) {
      this.renderer.setSeason(step.season)
      this.renderer.setLight(step.light)
      this.showSeason(step.caption)
      await this.wait(SEASON_MS)
    }

    // The year actually happens between autumn and winter.
    const result = advanceYear(this.state, chosen)
    this.state = result.state
    this.selected.clear()
    this.refreshScene()
    this.renderAll()

    const winter = YEAR_SEASONS[3]!
    this.renderer.setSeason(winter.season)
    this.renderer.setLight(winter.light)
    this.showSeason(winter.caption)
    await this.wait(SEASON_MS)

    this.showSeason(null)
    this.renderer.setSeason('summer')
    this.renderer.setLight('day')
    document.body.classList.remove('advancing')
    this.advancing = false

    await this.readThePaper(shortfallBefore)

    // Vocabulary the player has just earned by causing the thing it names.
    const unlocked = this.state.events.filter((e) => e.id === 'glossary_unlocked')
    if (unlocked.length > 0) {
      this.showGlossary(String(unlocked[0]!.detail.card))
      return
    }
    if (this.state.ended) showEnding(this.state, () => this.restart())
  }

  /**
   * The paper arrives. It is composed from an observation of the year that has
   * just passed and nothing else - the game does not tell it what to say, and
   * this method could not tell it either if it wanted to.
   */
  private async readThePaper(shortfallBefore: number): Promise<void> {
    const observation = observe(this.state, cityShortfall(this.state), shortfallBefore)
    const frozen = this.state
    const page = composeFrontPage(
      observation, this.memory, (r) => circumstanceOf(r, frozen), this.state.seed,
    )
    await showFrontPage(page, {
      scene: buildScene(this.state),
      sceneId: this.sceneId,
      season: 'summer',
      light: 'day',
    })
  }

  private showSeason(caption: string | null): void {
    const banner = el('season')
    banner.classList.toggle('on', caption !== null)
    if (caption) banner.querySelector('span')!.textContent = caption
  }

  /** Wait, unless the player has said they would rather not. */
  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      if (this.skipped) { resolve(); return }
      const timer = window.setTimeout(resolve, ms)
      const skip = (): void => { this.skipped = true; window.clearTimeout(timer); resolve() }
      el('skip').addEventListener('click', skip, { once: true })
      window.setTimeout(() => el('skip').removeEventListener('click', skip), ms)
    })
  }

  private showGlossary(id: string): void {
    const card = cardById(id)
    if (!card) return
    const sheet = el('modalsheet')
    sheet.innerHTML = `
      <div class="kicker">Something you have now seen for yourself</div>
      <h2>${escapeHtml(card.term)}</h2>
      <p>${escapeHtml(card.body)}</p>
      <div class="actions"><button class="primary" id="gok">Noted</button></div>`
    el('modal').classList.remove('hidden')
    el('gok').addEventListener('click', () => {
      hideModal()
      if (this.state.ended) showEnding(this.state, () => this.restart())
    })
  }

  // --- Rendering the world -------------------------------------------------

  private refreshScene(): void {
    this.renderer.setScene(buildScene(this.state))
    this.sceneId++
  }

  private fit(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    this.renderer.resize(Math.floor(window.innerWidth * dpr), Math.floor(window.innerHeight * dpr))
    this.canvas.style.width = '100%'
    this.canvas.style.height = '100%'
  }

  private frame(time: number): void {
    this.renderer.render(time)
    requestAnimationFrame((t) => this.frame(t))
  }

  // --- Rendering the chrome ------------------------------------------------

  private renderAll(): void {
    this.renderMeters()
    this.renderTabs()
    this.renderCards()
    this.renderCommit()
    this.renderWorks()
    this.renderHint()
  }

  private renderMeters(): void {
    const s = this.state
    const shortfall = cityShortfall(s)
    const capitalShare = s.politics.capital / 100
    const approvalShare = s.politics.approval / 100

    el('meters').innerHTML = `
      <div class="meter">
        <div class="label">Year</div>
        <div class="value">${s.year}<span class="sub"> / ${C.RUN_LENGTH_YEARS}</span></div>
      </div>
      <div class="meter clickable ${shortfall > 0 ? 'is-bad' : 'is-good'}" data-why="city">
        <div class="label">City shortfall</div>
        <div class="value">${shortfall > 0 ? '−' : '+'}${money(Math.abs(shortfall))}</div>
        <div class="sub">general fund, this year</div>
      </div>
      <div class="meter ${s.fiscal.surplus < 0 ? 'is-bad' : ''}">
        <div class="label">Corridor</div>
        <div class="value">${s.fiscal.surplus >= 0 ? '+' : '−'}${money(Math.abs(s.fiscal.surplus))}</div>
        <div class="sub">${s.fiscal.debt > 0 ? `${money(s.fiscal.debt)} owed` : 'no debt'}</div>
      </div>
      <div class="meter clickable ${s.politics.capital < 20 ? 'is-bad' : ''}" data-why="pc">
        <div class="label">Political capital</div>
        <div class="value">${Math.round(s.politics.capital)}</div>
        <div class="bar ${capitalShare < 0.2 ? 'is-low' : ''}"><i style="width:${Math.min(100, capitalShare * 100)}%"></i></div>
      </div>
      <div class="meter">
        <div class="label">Approval</div>
        <div class="value">${Math.round(s.politics.approval)}<span class="sub">%</span></div>
        <div class="bar ${approvalShare < 0.25 ? 'is-low' : ''}"><i style="width:${approvalShare * 100}%"></i></div>
      </div>`

    el('meters').querySelectorAll<HTMLElement>('[data-why]').forEach((node) => {
      node.addEventListener('click', () => {
        if (node.dataset.why === 'city') {
          showWhy('The city shortfall',
            'Fairview opens $4.1M short. Commerce Blvd is one corridor among many, so the shortfall moves dollar for dollar with the corridor ledger you control.',
            ['OPENING_DEFICIT', 'CITY_POPULATION', 'INFRA_GAP_PER_CAPITA_ANNUAL'])
        } else {
          showWhy('Political capital',
            'What the council will let you spend before it stops returning your calls. It accrues faster when approval is high, drains when approval is low, and at zero you are replaced.',
            ['STARTING_POLITICAL_CAPITAL', 'PC_ANNUAL_REGENERATION_BASE', 'PC_RIBBON_CUTTING'])
        }
      })
    })

    const f = this.state.politics.factions
    const rows: [string, number][] = [
      ['Drivers', f.drivers], ['Merchants', f.merchants], ['Homeowners', f.homeowners],
      ['Renters', f.renters], ['Taxpayers', f.taxpayers],
    ]
    el('sidenote').innerHTML = `
      <div class="label" style="font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:var(--faint);margin-bottom:5px">Standing with</div>
      ${rows.map(([label, value]) => `
        <div style="display:flex;justify-content:space-between;gap:10px">
          <span>${label}</span><b style="color:${value < 30 ? 'var(--warn)' : value > 65 ? 'var(--good)' : 'var(--ink)'}">${Math.round(value)}</b>
        </div>`).join('')}`
  }

  private renderTabs(): void {
    const container = el('tabs')
    container.innerHTML = TABS.map((tab) => {
      const count = availableInstruments(this.state).filter((i) => i.tab === tab.id).length
      return `<button role="tab" aria-selected="${tab.id === this.tab}" data-tab="${tab.id}">
        ${tab.label}<span class="count">${count}</span></button>`
    }).join('') + '<button id="fold" title="collapse">&#9662;</button>'
    container.querySelectorAll<HTMLElement>('[data-tab]').forEach((node) => {
      node.addEventListener('click', () => {
        this.tab = node.dataset.tab as InstrumentTab
        this.renderTabs()
        this.renderCards()
        // Otherwise the browser keeps the previous tab's scroll position and
        // the first card is half off the left edge.
        el('cards').scrollLeft = 0
      })
    })
    document.getElementById('fold')?.addEventListener('click', () => {
      el('dock').classList.toggle('collapsed')
      document.body.classList.toggle('folded')
    })
  }

  private cardState(instrument: Instrument): CardState {
    if (this.selected.has(instrument.id)) return 'selected'
    if (!instrument.unlockedBy(this.state)) return 'locked'
    if (!instrument.applicable(this.state)) return 'unavailable'
    if (instrument.pcCost(this.state) > this.state.politics.capital) return 'unaffordable'
    if (instrument.capitalCost(this.state) > this.remainingHeadroom()) return 'unaffordable'
    return 'available'
  }

  private remainingHeadroom(): number {
    const committed = [...this.selected]
      .map((id) => instrumentById(id))
      .reduce((total, i) => total + (i ? i.capitalCost(this.state) : 0), 0)
    return borrowingHeadroom(this.state) - committedCapital(this.state) - committed
  }

  private renderCards(): void {
    const container = el('cards')
    // Rebuilding the row loses the scroll position, and focusing a card makes
    // the browser scroll it into view - between them the first card ends up
    // half off the left edge. Hold the position across the re-render.
    const scroll = container.scrollLeft
    const list = INSTRUMENTS.filter((i) => i.tab === this.tab)
      .filter((i) => i.unlockedBy(this.state) || Boolean(i.unlockHint))

    container.innerHTML = list.map((instrument) => {
      const state = this.cardState(instrument)
      const cost = instrument.capitalCost(this.state)
      const annual = instrument.annualCost(this.state)
      const pc = instrument.pcCost(this.state)
      const short = state === 'unaffordable'
      const pcShort = pc > this.state.politics.capital

      const costs = state === 'locked' ? '' : `
        <div class="costs">
          <span class="m ${short && !pcShort ? 'short' : ''}">${cost > 0 ? money(cost) : 'no capital'}</span>
          <span class="pc ${pcShort ? 'short' : ''}">${pc > 0 ? `${pc} PC` : '0 PC'}</span>
          <span class="yr">${duration(instrument.constructionYears)}</span>
        </div>
        ${annual > 0 ? `<div class="costs"><span class="yr">then ${money(annual)} every year</span></div>` : ''}`

      return `<button class="card ${state === 'selected' ? 'selected' : ''} ${state === 'locked' ? 'locked' : ''} ${state === 'unaffordable' || state === 'unavailable' ? 'unaffordable' : ''}"
          data-id="${instrument.id}" ${state === 'locked' || state === 'unavailable' ? 'disabled' : ''}>
        <div class="name">${escapeHtml(instrument.label)}</div>
        <div class="desc">${escapeHtml(instrument.description)}</div>
        ${costs}
        ${state === 'locked' ? `<div class="lock">${escapeHtml(instrument.unlockHint ?? 'Not yet available.')}</div>` : ''}
        <div class="foot">
          ${instrument.sourceKeys?.length && state !== 'locked'
            ? `<span class="why" data-why="${instrument.id}">why these numbers?</span>` : '<span></span>'}
          ${state === 'available' || state === 'selected'
            ? `<span class="add">${state === 'selected' ? 'remove' : 'add'}</span>` : '<span></span>'}
        </div>
      </button>`
    }).join('')

    container.querySelectorAll<HTMLElement>('.card').forEach((node) => {
      node.addEventListener('click', (event) => {
        const why = (event.target as HTMLElement).closest<HTMLElement>('[data-why]')
        if (why) {
          event.stopPropagation()
          const instrument = instrumentById(why.dataset.why!)
          if (instrument) {
            showWhy(instrument.label,
              'The figures on this card, and where they come from.',
              instrument.sourceKeys ?? [])
          }
          return
        }
        const id = node.dataset.id!
        if (this.selected.has(id)) this.selected.delete(id)
        else this.selected.add(id)
        node.blur()
        this.renderCards()
        this.renderCommit()
        this.renderMeters()
      })
    })
    container.scrollLeft = scroll
  }

  private renderCommit(): void {
    const chosen = [...this.selected].map((id) => instrumentById(id)).filter(Boolean) as Instrument[]
    const capital = chosen.reduce((total, i) => total + i.capitalCost(this.state), 0)
    const annual = chosen.reduce((total, i) => total + i.annualCost(this.state), 0)
    const pc = chosen.reduce((total, i) => total + i.pcCost(this.state), 0)
    const headroom = borrowingHeadroom(this.state) - committedCapital(this.state)

    el('commitlist').innerHTML = chosen.length === 0
      ? '<div class="none">Nothing. A year will pass anyway.</div>'
      : chosen.map((i) => `<div class="row"><span>${escapeHtml(i.label)}</span>
          <button data-drop="${i.id}" title="remove">&times;</button></div>`).join('')

    el('commitlist').querySelectorAll<HTMLElement>('[data-drop]').forEach((node) => {
      node.addEventListener('click', () => {
        this.selected.delete(node.dataset.drop!)
        this.renderCards(); this.renderCommit(); this.renderMeters()
      })
    })

    const overMoney = capital > headroom
    const overPc = pc > this.state.politics.capital
    el('totals').innerHTML = `
      <div class="t ${overMoney ? 'over' : ''}"><span>Capital</span><span>${money(capital)}</span></div>
      <div class="t"><span>of capacity</span><span>${money(Math.max(0, headroom))}</span></div>
      ${annual > 0 ? `<div class="t"><span>New annual cost</span><span>${money(annual)}</span></div>` : ''}
      <div class="t ${overPc ? 'over' : ''}"><span>Political capital</span><span>${pc} of ${Math.round(this.state.politics.capital)}</span></div>`

    const button = el<HTMLButtonElement>('advance')
    button.disabled = Boolean(this.state.ended) || overMoney || overPc
    button.textContent = this.state.ended
      ? 'The run has ended'
      : `Advance to year ${this.state.year + 1}`
  }

  private renderWorks(): void {
    const works = el('works')
    const projects = this.state.activeProjects
    const obligations = this.state.obligations
    if (projects.length === 0 && obligations.length === 0) {
      works.classList.add('hidden')
      return
    }
    works.classList.remove('hidden')
    works.innerHTML = `
      <h3>Under way</h3>
      ${projects.length === 0 ? '<div class="none">No works in progress.</div>' : projects.map((p) => `
        <div class="item"><div class="n">${escapeHtml(p.label)}</div>
        <div class="y">${p.yearsRemaining} more ${p.yearsRemaining === 1 ? 'season' : 'seasons'}</div></div>`).join('')}
      ${obligations.length > 0 ? `<h3 style="margin-top:10px">Committed for ever</h3>
        ${obligations.map((o) => `<div class="item"><div class="n">${escapeHtml(o.label)}</div>
          <div class="y">${money(o.annualCost)} / year</div></div>`).join('')}` : ''}`
  }

  private renderHint(): void {
    const s = this.state
    const hint = s.ledgerUnlocked
      ? 'The ledger is open to you now.'
      : s.year === 0 ? 'Pick as much or as little as you like, then advance the year.'
        : `${percent(s.modeShare.walk, 1)} of trips on foot &middot; ${Math.round(s.traffic.peakSpeedMph)} mph at the peak &middot; ${Math.round(s.environment.sidewalkNoiseDba)} dBA at the kerb`
    el('hint').innerHTML = `<b>drag</b> pan &middot; <b>wheel</b> zoom &middot; <b>1&ndash;4</b> light &middot; <b>Q W E T</b> season &nbsp;&nbsp; ${hint}`
  }

  // --- Input ---------------------------------------------------------------

  private bindInput(): void {
    let dragging = false
    let lastX = 0
    let lastY = 0
    const dpr = (): number => Math.min(2, window.devicePixelRatio || 1)

    this.canvas.addEventListener('pointerdown', (event) => {
      dragging = true; lastX = event.clientX; lastY = event.clientY
      this.canvas.classList.add('dragging')
      this.canvas.setPointerCapture(event.pointerId)
    })
    this.canvas.addEventListener('pointerup', (event) => {
      dragging = false
      this.canvas.classList.remove('dragging')
      this.canvas.releasePointerCapture(event.pointerId)
    })
    this.canvas.addEventListener('pointermove', (event) => {
      if (!dragging) return
      this.renderer.panBy((event.clientX - lastX) * dpr(), (event.clientY - lastY) * dpr())
      lastX = event.clientX; lastY = event.clientY
    })
    this.canvas.addEventListener('wheel', (event) => {
      event.preventDefault()
      this.renderer.zoomBy(event.deltaY < 0 ? 1.12 : 1 / 1.12)
    }, { passive: false })

    el('advance').addEventListener('click', () => void this.advance())
    window.addEventListener('resize', () => this.fit())

    const LIGHTS: LightName[] = ['day', 'dusk', 'night', 'overcast']
    const SEASONS: Record<string, SeasonName> = { q: 'spring', w: 'summer', e: 'autumn', t: 'winter' }
    window.addEventListener('keydown', (event) => {
      if (!this.started) return
      const key = event.key.toLowerCase()
      if (key === ' ') { event.preventDefault(); void this.advance(); return }
      if (key >= '1' && key <= '4') { this.renderer.setLight(LIGHTS[Number(key) - 1]!); return }
      if (SEASONS[key]) { this.renderer.setSeason(SEASONS[key]!); this.refreshScene() }
    })
  }
}

function seedForToday(): string {
  // A seed can be pinned from the query string, which is how the screenshot
  // harness gets the same corridor every time.
  const pinned = new URLSearchParams(window.location.search).get('seed')
  return pinned ?? `fairview-${Math.floor(Math.random() * 100000)}`
}
