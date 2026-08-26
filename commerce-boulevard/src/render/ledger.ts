/**
 * The Ledger View.
 *
 * The same corridor the player has been looking at for thirty years, with the
 * buildings replaced by what each parcel pays and what it costs. It is the one
 * screen in the game that shows the player a number they were not given, and
 * it is locked until they have already hit the wall - because the point is not
 * to teach the arithmetic, it is to explain a bill that has already arrived.
 *
 * Pure. No canvas in this file.
 */

import {
  corridorAccount, isTaxExempt, parcelLedger,
  type CorridorAccount, type LandUse, type ParcelLedgerRow, type SimState,
} from '../sim/index'
import { layoutFor, type Scene } from './scene'
import { buildScene } from './scene'
import { TILE_FT } from './iso'
import { PX_PER_DOLLAR_PER_ACRE } from './sprites/ledger'

/** Depth of the front row of parcels, in feet. Matches the scene builder. */
const FRONT_ROW_DEPTH_FT = 250
/** How deep a column is drawn. The full parcel would be a slab. */
const COLUMN_DEPTH_TILES = 9

export interface LedgerColumn {
  gx: number
  gy: number
  footprintW: number
  footprintD: number
  revenuePerAcre: number
  liabilityPerAcre: number
  revenuePx: number
  liabilityPx: number
  exempt: boolean
  use: LandUse
  parcelId: string
  acres: number
}

/**
 * What the corridor as a whole pays, and what it costs.
 *
 * The same account the reckoning prints. There is exactly one of these in the
 * codebase, because a Ledger View that disagreed with the end-of-run document
 * about the same corridor would be worse than having neither.
 */
export type LedgerSummary = CorridorAccount

/** Every parcel, as a column standing on the ground it occupies. */
export function ledgerColumns(state: SimState): LedgerColumn[] {
  const layout = layoutFor(state.street)
  const rows = parcelLedger(state, state.year)
  const byId = new Map(rows.map((r) => [r.parcelId, r]))
  const out: LedgerColumn[] = []

  for (const parcel of state.parcels) {
    const row = byId.get(parcel.id)
    if (!row) continue
    // Only the front row: the block behind is not on the corridor, and a
    // picture of it would be a picture of somewhere else.
    if (parcel.depth !== 0) continue

    /*
     * The column stands on the parcel it is measuring, so its volume is the
     * total that parcel produces and its height is the rate per acre. Which is
     * the Urban3 picture, and the reason a car park reads as what it is: an
     * enormous footprint with nothing standing on it.
     *
     * Inset by a tile on each side, because parcels butt up against their
     * neighbours and a row of columns with no gaps between them is a wall.
     */
    const widthFt = (parcel.acres * 43560) / FRONT_ROW_DEPTH_FT
    const tiles = Math.max(2, Math.round(widthFt / TILE_FT))
    const footprintW = Math.max(1, tiles - 2)
    const band = parcel.side === 'north' ? layout.northFront : layout.southFront
    const footprintD = Math.max(1, Math.min(COLUMN_DEPTH_TILES, band[1] - band[0]))
    const gx = Math.max(0, Math.round((parcel.station - widthFt / 2) / TILE_FT) + 1)
    // Stood against the pavement rather than in the middle of the block, so
    // the row of columns runs along the street the way the frontage does.
    const gy = parcel.side === 'north' ? band[1] - footprintD : band[0]

    out.push({
      gx, gy, footprintW, footprintD,
      revenuePerAcre: row.revenuePerAcre,
      liabilityPerAcre: row.liabilityPerAcre,
      revenuePx: row.revenuePerAcre * PX_PER_DOLLAR_PER_ACRE,
      liabilityPx: row.liabilityPerAcre * PX_PER_DOLLAR_PER_ACRE,
      exempt: isTaxExempt(parcel.use),
      use: parcel.use,
      parcelId: parcel.id,
      acres: parcel.acres,
    })
  }
  return out.sort((a, b) => (a.gx + a.gy) - (b.gx + b.gy))
}

/**
 * The corridor's own account.
 *
 * Tax-exempt land is left out of the ratio rather than counted as a failure: a
 * park is not underperforming, it is a park. What is counted is everything
 * that was supposed to pay.
 */
export const ledgerSummary = corridorAccount

/** The corridor with its buildings replaced by its accounts. */
export function buildLedgerScene(state: SimState): Scene {
  return { ...buildScene(state), ledger: ledgerColumns(state) }
}

export type { ParcelLedgerRow }
