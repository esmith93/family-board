/**
 * Tests for the Ledger View.
 *
 * The screen exists to show the player a number the game has been keeping and
 * not showing. Two things have to hold for that to mean anything: it has to be
 * locked until they have already hit the wall, and it has to be the SAME
 * arithmetic the end-of-run document uses. A Ledger View that disagreed with
 * the reckoning about the same corridor would be worse than having neither.
 */

import { describe, expect, it } from 'vitest'

import { advanceYear, corridorAccount, isTaxExempt, newGame, type SimState } from '../sim/index'
import { buildLedgerScene, ledgerColumns, ledgerSummary } from './ledger'
import { buildScene } from './scene'
import { valueColumn, PX_PER_DOLLAR_PER_ACRE } from './sprites/ledger'
import { usedIndices } from './bitmap'
import { PALETTE_INDEX } from './palette'

const WIDEN: Record<number, string[]> = { 0: ['capital.state_widening'] }
const CORRIDORS = ['a', 'b', 'c', 'd', 'e', 'win', 'lose', 'reckon', 'fairview-best']

function play(seed: string, plan: Record<number, string[]> = {}, years = 30): SimState {
  let state = newGame(seed)
  for (let i = 0; i < years && !state.ended; i++) state = advanceYear(state, plan[state.year] ?? []).state
  return state
}

/** The year the ledger unlocked, or null. */
function unlockYear(seed: string, plan: Record<number, string[]>): number | null {
  let state = newGame(seed)
  for (let i = 0; i < 30 && !state.ended; i++) {
    state = advanceYear(state, plan[state.year] ?? []).state
    if (state.ledgerUnlocked) return state.year
  }
  return null
}

describe('it is earned, never given', () => {
  it('is locked on the day the job starts', () => {
    for (const seed of CORRIDORS) expect(newGame(seed).ledgerUnlocked).toBe(false)
  })

  it('opens sooner for somebody who took the grant than for somebody who did not', () => {
    // Which is the point of the timing: the fastest route to the wall is the
    // one that felt best for the first eight years.
    const widened = CORRIDORS.map((s) => unlockYear(s, WIDEN) ?? 99)
    const left = CORRIDORS.map((s) => unlockYear(s, {}) ?? 99)
    const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length
    expect(mean(widened)).toBeLessThan(mean(left))
  })

  it('never opens in the first few years, whatever happens', () => {
    for (const seed of CORRIDORS) {
      for (const plan of [{}, WIDEN]) {
        const year = unlockYear(seed, plan)
        if (year !== null) expect(year, `${seed}`).toBeGreaterThanOrEqual(4)
      }
    }
  })
})

describe('it is the same arithmetic as the reckoning', () => {
  it('reports exactly what the end-of-run document reports', () => {
    for (const seed of ['a', 'lose', 'fairview-best']) {
      const state = play(seed, WIDEN)
      expect(JSON.stringify(ledgerSummary(state))).toBe(JSON.stringify(corridorAccount(state)))
    }
  })
})

describe('the columns', () => {
  it('stand on the parcels that front the boulevard, and only those', () => {
    const state = play('a', {}, 14)
    const columns = ledgerColumns(state)
    const front = state.parcels.filter((p) => p.depth === 0)
    expect(columns.length).toBe(front.length)
    for (const column of columns) {
      expect(front.some((p) => p.id === column.parcelId)).toBe(true)
    }
  })

  it('are as tall as the parcel pays', () => {
    const columns = ledgerColumns(play('a', {}, 14))
    const sorted = [...columns].sort((a, b) => b.revenuePerAcre - a.revenuePerAcre)
    expect(sorted[0]!.revenuePx).toBeGreaterThan(sorted[sorted.length - 1]!.revenuePx)
    for (const column of columns) {
      expect(column.revenuePx).toBeCloseTo(column.revenuePerAcre * PX_PER_DOLLAR_PER_ACRE, 6)
    }
  })

  it('give a park no line to fall short of', () => {
    // Put one on the corridor rather than hoping the generator did: a park is
    // not underperforming, it is a park, and drawing it as a parcel that fell
    // short of its bill would be the map making an argument of its own.
    const state = play('a', {}, 14)
    const front = state.parcels.find((p) => p.depth === 0)!
    front.use = 'park'
    const column = ledgerColumns(state).find((c) => c.parcelId === front.id)!
    expect(isTaxExempt('park')).toBe(true)
    expect(column.exempt).toBe(true)
    for (const other of ledgerColumns(state)) {
      expect(other.exempt).toBe(isTaxExempt(other.use))
    }
  })

  it('leaves a gap between neighbours rather than drawing one wall', () => {
    const columns = ledgerColumns(play('a', {}, 14))
      .filter((c) => c.gy < 40)
      .sort((a, b) => a.gx - b.gx)
    let touching = 0
    for (let i = 1; i < columns.length; i++) {
      const previous = columns[i - 1]!
      if (previous.gx + previous.footprintW >= columns[i]!.gx) touching++
    }
    expect(touching).toBe(0)
  })

  it('is deterministic', () => {
    expect(JSON.stringify(ledgerColumns(play('same', {}, 12))))
      .toBe(JSON.stringify(ledgerColumns(play('same', {}, 12))))
  })
})

describe('the drawing', () => {
  it('draws a column that falls short as a solid block inside an empty one', () => {
    const short = valueColumn({ footprintW: 4, footprintD: 3, revenuePx: 40, liabilityPx: 150, exempt: false })
    const inks = usedIndices(short.bmp)
    // The wireframe above the solid part is the shortfall, and it is drawn in
    // the one ink nothing else on the column uses.
    expect(inks).toContain(PALETTE_INDEX.lineWhite)
    expect(inks).toContain(PALETTE_INDEX.stuccoMid)
    expect(short.bmp.height).toBeGreaterThan(150)
  })

  it('gives a column that covers its cost a line inside it rather than above it', () => {
    const pays = valueColumn({ footprintW: 4, footprintD: 3, revenuePx: 190, liabilityPx: 90, exempt: false })
    expect(usedIndices(pays.bmp)).toContain(PALETTE_INDEX.lineWhite)
    // No headroom is needed when nothing overshoots.
    expect(pays.bmp.height).toBeLessThan(190 + (4 + 3) * 16 + 8)
  })

  it('draws an exempt parcel with no line at all', () => {
    const exempt = valueColumn({ footprintW: 4, footprintD: 3, revenuePx: 20, liabilityPx: 400, exempt: true })
    expect(usedIndices(exempt.bmp)).not.toContain(PALETTE_INDEX.lineWhite)
  })

  it('is never a flat rectangle', () => {
    const column = valueColumn({ footprintW: 5, footprintD: 4, revenuePx: 160, liabilityPx: 70, exempt: false })
    const inks = [...usedIndices(column.bmp)].filter((i) => i !== 0)
    expect(inks.length).toBeGreaterThanOrEqual(4)
  })
})

describe('the scene', () => {
  it('swaps the buildings for the accounts, and leaves the street alone', () => {
    const state = play('a', {}, 14)
    const street = buildScene(state)
    const ledger = buildLedgerScene(state)
    expect(street.ledger).toBeUndefined()
    expect(ledger.ledger!.length).toBeGreaterThan(20)
    expect(ledger.tiles.length).toBe(street.tiles.length)
    expect(ledger.lanes.length).toBe(street.lanes.length)
  })
})
