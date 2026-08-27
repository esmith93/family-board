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
import { hideModal, offerToResume, runOpening } from './opening'
import { showFrontPage } from './newspaper'
import { FirstPerson } from './camera'
import { Sound } from '../audio/sound'
import { showReckoning } from './reckoning'
import { clearSave, loadRuns, loadSave, recordRun, writeSave, type MoveLog, type SaveGame } from './archive'
import { buildLedgerScene, ledgerSummary } from '../render/ledger'
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

/*
 * How long a season holds.
 *
 * The brief asked for a year in about eight seconds, and for a first run of
 * eight to twelve minutes. Those two do not both fit: four beats of two
 * seconds, thirty times over, is four minutes of watching before a single
 * decision has been read. So the year keeps its four beats and they get
 * shorter as the run goes on, because the information in them drops. The
 * first years are the ones where the player is still learning to read the
 * picture; by the twelfth they are watching a clock. The whole run of
 * seasons now costs about two minutes instead of four, and nothing about
 * what the player can SEE has been taken away.
 */
const SEASON_MS_FIRST = 2000
const SEASON_MS_FLOOR = 900
const SEASON_SETTLES_BY_YEAR = 12
function seasonMs(year: number): number {
  const t = Math.max(0, Math.min(1, (year - 2) / (SEASON_SETTLES_BY_YEAR - 2)))
  return Math.round(SEASON_MS_FIRST + (SEASON_MS_FLOOR - SEASON_MS_FIRST) * t)
}

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
  private skipResolve: (() => void) | null = null
  /** True only while the seasons are turning, which is the skippable part. */
  private watchingSeasons = false
  private memory: PaperMemory
  private sceneId = 0
  private ledgerOpen = false
  /**
   * What was committed, by the year it was committed. This IS the save: the
   * simulation is deterministic, so the seed and this replay the run exactly.
   */
  private moves: MoveLog = {}
  /** What last year would not start, and why. Cleared when it is read. */
  private rejected: { instrumentId: string; reason: string }[] = []
  private readonly sound = new Sound()
  private readonly firstPerson = new FirstPerson(this.sound)

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.state = newGame(seedForToday())
    this.memory = newMemory(this.state)
    this.renderer = new IsometricRenderer(canvas)
    initWhy()
    this.bindInput()
    this.fit()
    this.refreshScene()
    this.renderer.frameCorridor(window.innerWidth)
    this.renderAll()
    const query = new URLSearchParams(window.location.search)
    const skipTo = Number(query.get('ff') ?? 0)
    if (import.meta.env.DEV && skipTo > 0) this.fastForward(skipTo, query.get('plan'))
    else void this.open()
    requestAnimationFrame((t) => this.frame(t))
  }

  // --- Lifecycle -----------------------------------------------------------

  private async open(): Promise<void> {
    document.body.classList.add('intro')

    // Somebody who left a run open gets it back before anything else happens.
    // A first-time player has no save, sees none of this, and walks straight
    // into the budget.
    const save = loadSave()
    if (save && await offerToResume(save.year)) {
      document.body.classList.remove('intro')
      this.resume(save)
      return
    }
    clearSave()

    const accepted = await runOpening(this.state)
    document.body.classList.remove('intro')
    this.started = true
    if (accepted) this.selected.add('capital.state_widening')
    this.renderAll()
  }

  /**
   * Play a saved run back into being.
   *
   * There is no stored state to load: the seed and the moves are the save, and
   * running them is what restores the corridor. Thirty years takes about a
   * second, which is the dividend of having built the simulation pure.
   */
  private resume(save: SaveGame): void {
    this.state = newGame(save.seed)
    this.memory = newMemory(this.state)
    this.moves = { ...save.moves }
    this.replay((year) => save.moves[year] ?? [], save.year)
    this.started = true
    this.refreshScene()
    this.renderer.frameCorridor(window.innerWidth)
    this.renderAll()
    if (this.state.ended) this.finish()
  }

  /**
   * Run years without animating them.
   *
   * The paper is composed for each one even though nobody reads it, because
   * its memory - who has written in, what it has already printed, whether the
   * desk has come round - is part of the state being restored. Skip it and a
   * resumed run gets letters it has already run.
   */
  private replay(movesFor: (year: number) => string[], years: number): void {
    for (let y = 0; y < years && !this.state.ended; y++) {
      const before = cityShortfall(this.state)
      this.state = advanceYear(this.state, movesFor(this.state.year)).state
      const frozen = this.state
      composeFrontPage(
        observe(this.state, cityShortfall(this.state), before),
        this.memory, (r) => circumstanceOf(r, frozen), this.state.seed,
      )
    }
  }

  /**
   * Play forward silently, for looking at a late corridor without sitting
   * through thirty years of it. Development only - the query string does
   * nothing in a built game.
   */
  private fastForward(years: number, plan: string | null = null): void {
    this.started = true
    const script = plan === 'nothing' ? {}
      : plan === 'widen' ? { 0: ['capital.state_widening'] } as Record<number, string[]>
        : DEV_PLAN
    this.replay((year) => script[year] ?? [], years)
    this.refreshScene()
    this.renderAll()
    // A run that ended during the skip still ended, and still has a reckoning.
    if (this.state.ended) this.finish()
  }

  private restart(): void {
    clearSave()
    this.moves = {}
    this.state = newGame(seedForToday())
    this.ledgerOpen = false
    document.body.classList.remove('ledger')
    this.memory = newMemory(this.state)
    this.selected.clear()
    this.started = false
    this.refreshScene()
    this.renderAll()
    void this.open()
  }

  /**
   * One year.
   *
   * The year is not over when the snow clears, it is over when the player has
   * put the paper down. Holding the lock until then is what stops a space bar
   * held down from turning four years into sixteen behind a newspaper nobody
   * saw - the newspaper closes on space too, and both listeners were firing.
   */
  private async advance(): Promise<void> {
    if (this.state.ended || this.advancing) return
    this.advancing = true
    this.watchingSeasons = true
    this.skipped = false
    document.body.classList.add('advancing')

    const chosen = [...this.selected]
    const shortfallBefore = cityShortfall(this.state)
    this.rejected = []

    const beat = seasonMs(this.state.year)

    // Spring, summer, autumn. The city is still last year's city.
    for (const step of YEAR_SEASONS.slice(0, 3)) {
      this.renderer.setSeason(step.season)
      this.renderer.setLight(step.light)
      this.showSeason(step.caption)
      await this.wait(beat)
    }

    // The year actually happens between autumn and winter.
    const committedIn = this.state.year
    const result = advanceYear(this.state, chosen)
    this.state = result.state
    // What was PASSED to the year, not what the year accepted: replaying the
    // same list gets the same rejections for the same reasons.
    this.moves[committedIn] = chosen
    writeSave(this.state.seed, this.moves, this.state.year)
    /*
     * Say what did not happen.
     *
     * `YearResult.rejected` was populated by the simulation and read by
     * nothing. A player following the game's own reference line loses better
     * than a third of their decisions to political capital, and every one of
     * them used to vanish between pressing Advance and the newspaper arriving,
     * with no message of any kind. A plan that quietly does not happen is
     * indistinguishable from a plan that does not work.
     */
    this.rejected = result.rejected
    this.selected.clear()
    this.refreshScene()
    this.renderAll()

    const winter = YEAR_SEASONS[3]!
    this.renderer.setSeason(winter.season)
    this.renderer.setLight(winter.light)
    this.showSeason(winter.caption)
    await this.wait(beat)

    this.showSeason(null)
    this.sound.atDesk(this.state)
    this.renderer.setSeason('summer')
    this.renderer.setLight('day')
    document.body.classList.remove('advancing')
    this.watchingSeasons = false

    try {
      await this.readThePaper(shortfallBefore)

      // Vocabulary the player has just earned by causing the thing it names.
      const unlocked = this.state.events.filter((e) => e.id === 'glossary_unlocked')
      if (unlocked.length > 0) await this.showGlossary(String(unlocked[0]!.detail.card))
    } finally {
      this.advancing = false
    }

    if (this.state.ended) this.finish()
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
    this.sound.hush(true)
    await showFrontPage(page, {
      scene: buildScene(this.state),
      sceneId: this.sceneId,
      season: 'summer',
      light: 'day',
    })
    this.sound.atDesk(this.state)
    this.sound.hush(false)
  }

  private showSeason(caption: string | null): void {
    const banner = el('season')
    banner.classList.toggle('on', caption !== null)
    if (caption) banner.querySelector('span')!.textContent = caption
  }

  /**
   * The player would rather not watch the rest of this year.
   *
   * Reachable from the button, the space bar and escape, because a player who
   * wants to move on presses the thing they already pressed to get here.
   */
  private skipTheYear(): void {
    if (!this.watchingSeasons) return
    this.skipped = true
    const resolve = this.skipResolve
    this.skipResolve = null
    resolve?.()
  }

  /** Wait, unless the player has said they would rather not. */
  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      if (this.skipped) { resolve(); return }
      const timer = window.setTimeout(() => { this.skipResolve = null; resolve() }, ms)
      this.skipResolve = (): void => { window.clearTimeout(timer); resolve() }
    })
  }

  /** Thirty years, or the day the council ran out of patience. */
  private finish(): void {
    this.sound.hush(true)
    const summary = ledgerSummary(this.state)
    const last = this.state.history[this.state.history.length - 1]
    recordRun({
      seed: this.state.seed,
      moves: this.moves,
      finishedYear: this.state.ended?.year ?? this.state.year,
      reason: this.state.ended?.reason ?? 'completed',
      ratio: summary.ratio,
      debt: this.state.fiscal.debt,
      walkShare: last?.modeShare.walk ?? 0,
      groceryWalkShare: last?.groceryWalkShare ?? 0,
      at: Date.now(),
    })
    // The run is over, so there is nothing left to come back to.
    clearSave()
    showReckoning(this.state, loadRuns(), () => {
      this.sound.hush(false)
      this.restart()
    })
  }

  private showGlossary(id: string): Promise<void> {
    const card = cardById(id)
    if (!card) return Promise.resolve()
    const sheet = el('modalsheet')
    sheet.innerHTML = `
      <div class="kicker">Something you have now seen for yourself</div>
      <h2>${escapeHtml(card.term)}</h2>
      <p>${escapeHtml(card.body)}</p>
      <div class="actions"><button class="primary" id="gok">Noted</button></div>`
    el('modal').classList.remove('hidden')
    return new Promise((resolve) => {
      el('gok').addEventListener('click', () => { hideModal(); resolve() }, { once: true })
    })
  }

  // --- Rendering the world -------------------------------------------------

  private refreshScene(): void {
    this.renderer.setScene(this.ledgerOpen ? buildLedgerScene(this.state) : buildScene(this.state))
    this.sceneId++
  }

  /**
   * The Ledger View.
   *
   * Locked until the player has already hit the wall, because the point of it
   * is not to teach the arithmetic in advance - it is to explain a bill that
   * has already arrived. `maybeUnlockLedger` in the simulation decides when.
   */
  private toggleLedger(): void {
    if (!this.state.ledgerUnlocked || !this.started || this.advancing) return
    this.ledgerOpen = !this.ledgerOpen
    document.body.classList.toggle('ledger', this.ledgerOpen)
    if (!this.ledgerOpen) {
      this.renderer.camera.zoom = 0.55
      this.renderer.lookAt(0.5, 38)
      this.renderer.camera.gy = 38
    }
    if (this.ledgerOpen) {
      // Stand back. A column at a time says nothing; the shape of the whole
      // mile is the finding.
      this.renderer.camera.zoom = 0.17
      this.renderer.lookAt(0.5, 38)
      this.renderer.camera.gy = 38
    }
    this.refreshScene()
    this.renderLedgerBar()
    this.renderLedgerButton()
  }

  private renderLedgerBar(): void {
    if (!this.ledgerOpen) return
    const account = ledgerSummary(this.state)
    el('ledgerbar').innerHTML = `
      <h4>Commerce Boulevard, year ${this.state.year}</h4>
      <div class="big">${money(account.revenuePerAcre)} <span>per acre, a year</span></div>
      <dl>
        <dt>What it costs to serve an acre</dt><dd>${money(account.liabilityPerAcre)}</dd>
        <dt>Revenue divided by cost</dt><dd>${account.ratio.toFixed(2)}&times;</dd>
        <dt>Parcels covering their own cost</dt>
        <dd>${account.payingParcels} of ${account.taxableParcels}</dd>
        <dt>Land under surface parking</dt><dd>${percent(account.parkingShare, 0)}</dd>
      </dl>
      <div class="key">
        Each block is what that parcel pays the city per acre.
        The <b>white line</b> is what the city spends per acre to serve it.
        A parcel with nothing above its line is not drawn short of anything;
        parks and schools carry no line, since they were never on the roll.
      </div>`
  }

  private fit(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    this.renderer.resize(Math.floor(window.innerWidth * dpr), Math.floor(window.innerHeight * dpr))
    this.canvas.style.width = '100%'
    this.canvas.style.height = '100%'
  }

  private frame(time: number): void {
    // The first-person views run their own loop and own the screen while they
    // are up; drawing the corridor from above behind them is work nobody sees.
    if (!this.firstPerson.isOpen) this.renderer.render(time)
    requestAnimationFrame((t) => this.frame(t))
  }

  /**
   * Get out of the office.
   *
   * The corridor as it stands in whatever year it currently is, from the seat
   * of a car or from the pavement. Nothing is explained; the player drives or
   * walks and draws their own conclusions, which is the only way the ones that
   * matter ever get drawn.
   */
  private getOut(mode: 'drive' | 'walk'): void {
    if (!this.started || this.advancing || this.state.ended) return
    this.firstPerson.setPalette(this.renderer.lightName, this.renderer.seasonName)
    el('fpkeys').innerHTML = mode === 'drive'
      ? '<b>up</b> accelerate &nbsp; <b>down</b> brake &nbsp; <b>left / right</b> change lane'
        + '<br><b>esc</b> back to the office'
      : '<b>left / right</b> walk &nbsp; <b>up</b> cross'
        + '<br><b>esc</b> back to the office'
    this.firstPerson.open(this.state, mode, () => {
      this.sound.atDesk(this.state)
      this.renderAll()
    })
  }

  // --- Rendering the chrome ------------------------------------------------

  private renderAll(): void {
    this.renderMeters()
    this.renderTabs()
    this.renderCards()
    this.renderCommit()
    this.renderWorks()
    this.renderLedgerButton()
    this.renderLedgerBar()
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
    /*
     * One ink colour, and the magnitude in the bar.
     *
     * Standing used to go green above 65 and red below 30. It is the only
     * green-for-good left in the chrome that is not about solvency, and the
     * one the brief sanctions is solvency. Standing with drivers is a
     * resource, not a verdict, and the game does not get to shade it.
     */
    el('sidenote').innerHTML = `
      <div class="label">Standing with</div>
      ${rows.map(([label, value]) => `
        <div class="faction">
          <span>${label}</span><b>${Math.round(value)}</b>
          <i style="width:${Math.round(value)}%"></i>
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
          data-id="${instrument.id}" ${state === 'locked' || state === 'unavailable' || state === 'unaffordable' ? 'disabled' : ''}>
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

    // What last year would not start. Stated plainly, once, and then dropped.
    const refused = this.rejected.length === 0 ? '' : `
      <div class="refused">${this.rejected.map((r) => {
        const label = instrumentById(r.instrumentId)?.label ?? r.instrumentId
        return `<div>${escapeHtml(label)} &mdash; ${escapeHtml(r.reason)}</div>`
      }).join('')}</div>`

    el('commitlist').innerHTML = refused + (chosen.length === 0
      ? '<div class="none">Nothing. A year will pass anyway.</div>'
      : chosen.map((i) => `<div class="row"><span>${escapeHtml(i.label)}</span>
          <button data-drop="${i.id}" title="remove">&times;</button></div>`).join(''))

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
    // A button that greys out without saying why reads as a broken button.
    button.title = overMoney ? 'The plan is beyond this year\'s borrowing capacity.'
      : overPc ? 'The plan costs more political capital than you have.'
        : ''
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

  /**
   * The Ledger button appears the year the simulation unlocks it, which is
   * the year the player has already hit the wall. Nothing announces it as a
   * reward; it is simply there, the way a file you were not shown is there.
   */
  private renderLedgerButton(): void {
    const button = el<HTMLButtonElement>('goledger')
    button.hidden = !this.state.ledgerUnlocked
    button.textContent = this.ledgerOpen ? 'Back to the street' : 'Ledger'
  }

  private renderHint(): void {
    const s = this.state
    /*
     * The readout keeps running once the Ledger opens.
     *
     * It used to be replaced, permanently, by "The ledger is open to you now."
     * - which is a ceremony, in a game whose whole register is a municipal
     *   document, and it contradicted the comment on renderLedgerButton eight
     *   lines away saying nothing announces the view as a reward. The button
     *   appearing is the whole announcement. And it cost the player the live
     *   figures for the remaining twenty years of the run.
     */
    const hint = s.year === 0
      ? 'Pick as much or as little as you like, then advance the year.'
      : `${percent(s.modeShare.walk, 1)} of trips on foot &middot; ${Math.round(s.traffic.peakSpeedMph)} mph at the peak &middot; ${Math.round(s.environment.sidewalkNoiseDba)} dBA at the kerb`
    el('hint').innerHTML = `<b>drag</b> pan &middot; <b>wheel</b> zoom &middot; <b>1&ndash;4</b> light &middot; `
      + `<b>Q W E T</b> season &middot; <b>V</b> drive &middot; <b>B</b> walk &middot; `
      + `<b>M</b> sound ${this.sound.isOn ? 'on' : 'off'}`
      + `${this.state.ledgerUnlocked ? ' &middot; <b>L</b> ledger' : ''} &nbsp;&nbsp; ${hint}`
  }

  // --- Input ---------------------------------------------------------------

  private bindInput(): void {
    // A browser will not make a sound until somebody has clicked something.
    // Any gesture counts, so every gesture is one.
    const wake = (): void => {
      this.sound.unlock()
      if (!this.firstPerson.isOpen) this.sound.atDesk(this.state)
    }
    window.addEventListener('pointerdown', wake, { passive: true })
    window.addEventListener('keydown', wake, { passive: true })

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

    el('advance').addEventListener('click', (event) => {
      // Otherwise the button keeps focus and the next space press activates it
      // again rather than skipping the year it just started.
      ;(event.currentTarget as HTMLElement).blur()
      void this.advance()
    })
    el('skip').addEventListener('click', () => this.skipTheYear())
    window.addEventListener('resize', () => this.fit())

    const LIGHTS: LightName[] = ['day', 'dusk', 'night', 'overcast']
    const SEASONS: Record<string, SeasonName> = { q: 'spring', w: 'summer', e: 'autumn', t: 'winter' }
    /*
     * Something is over the corridor and owns the keyboard.
     *
     * Without this every hotkey stayed live behind every dialogue: V while the
     * newspaper was up opened the driving camera underneath it, so the player
     * put the paper down onto a windscreen they never asked for. The paper,
     * the glossary card, the provenance panel and the reckoning each dismiss
     * themselves on their own keys and the game must keep its hands off.
     */
    const modalIsUp = (): boolean =>
      ['paper', 'modal', 'why', 'reckveil', 'fp'].some((id) => {
        const node = document.getElementById(id)
        return !!node && !node.classList.contains('hidden')
          && getComputedStyle(node).display !== 'none'
      })

    window.addEventListener('keydown', (event) => {
      if (!this.started) return
      if (modalIsUp()) return
      /*
       * A card is a <button>, and space is how a keyboard user presses a
       * button. Swallowing it globally meant a keyboard player could never
       * select an instrument: the space that should have added the roundabout
       * to the plan burned the year instead. While the focus is in the dock,
       * the keys belong to the dock.
       */
      const focus = document.activeElement
      if (focus instanceof HTMLElement && focus.closest('#cards, #tabs, #commitlist')) return
      const key = event.key.toLowerCase()
      if (key === ' ') {
        event.preventDefault()
        // While the seasons turn, space skips them. While the paper is up it
        // belongs to the paper, which closes on it. Otherwise it starts a year.
        if (this.watchingSeasons) this.skipTheYear()
        else if (!this.advancing) void this.advance()
        return
      }
      if (key === 'escape' && this.watchingSeasons) { this.skipTheYear(); return }
      if (key >= '1' && key <= '4') { this.renderer.setLight(LIGHTS[Number(key) - 1]!); return }
      if (key === 'v') { this.getOut('drive'); return }
      if (key === 'b') { this.getOut('walk'); return }
      if (key === 'm') { this.sound.toggle(); this.renderHint(); return }
      if (key === 'l') { this.toggleLedger(); return }
      if (SEASONS[key]) { this.renderer.setSeason(SEASONS[key]!); this.refreshScene() }
    })
    el('goledger').addEventListener('click', () => this.toggleLedger())
    el('godrive').addEventListener('click', () => this.getOut('drive'))
    el('gowalk').addEventListener('click', () => this.getOut('walk'))
  }
}

function seedForToday(): string {
  // A seed can be pinned from the query string, which is how the screenshot
  // harness gets the same corridor every time.
  const pinned = new URLSearchParams(window.location.search).get('seed')
  return pinned ?? `fairview-${Math.floor(Math.random() * 100000)}`
}
