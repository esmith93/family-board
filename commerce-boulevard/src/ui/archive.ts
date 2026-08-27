/**
 * What survives closing the tab.
 *
 * The simulation is deterministic under a seeded PRNG, so a run does not have
 * to be STORED, it has to be REPRODUCED. A seed and the list of what was
 * committed in each year replays to exactly the state it came from. That makes
 * a save about two hundred bytes rather than half a megabyte, it cannot go
 * stale against a change in the shape of `SimState`, and it means every saved
 * run is a replay rather than a snapshot.
 *
 * The price is that a save is only true against the model that produced it.
 * Move a constant and the same moves land somewhere else, so every record
 * carries a fingerprint of the constant registry and anything that does not
 * match is dropped rather than replayed into a lie.
 *
 * Nothing in here ranks anything. The history is a list of runs in the order
 * they were played, with the numbers each one finished on. There is no best
 * run, no star, and no column that sorts.
 */

import { CONSTANT_REGISTRY } from '../sim/index'

const SAVE_KEY = 'commerce-boulevard.save.v1'
const RUNS_KEY = 'commerce-boulevard.runs.v1'

/** How many finished runs to keep. Enough to see a pattern, not a career. */
const RUNS_KEPT = 12

/** What the player committed, by the year they committed it. */
export type MoveLog = Record<number, string[]>

export interface SaveGame {
  seed: string
  moves: MoveLog
  /** The year the run had reached when it was written. */
  year: number
  model: string
}

/**
 * A run that finished, however it finished.
 *
 * The numbers are the ones the reckoning showed, copied out so the list can be
 * drawn without replaying thirty years of every past run to draw it.
 */
export interface RunRecord {
  seed: string
  moves: MoveLog
  finishedYear: number
  reason: 'fired' | 'insolvent' | 'completed'
  ratio: number
  debt: number
  walkShare: number
  groceryWalkShare: number
  /** Wall clock, used for nothing but keeping them in the order they happened. */
  at: number
  model: string
}

/**
 * A fingerprint of every number the model runs on.
 *
 * FNV-1a over the registry's keys and values, with the same finalising
 * avalanche the simulation's own hash uses, because plain FNV changes almost
 * nothing in the top bits when one constant moves by a hair.
 */
function modelFingerprint(): string {
  let h = 0x811c9dc5
  const keys = Object.keys(CONSTANT_REGISTRY).sort()
  for (const key of keys) {
    const entry = CONSTANT_REGISTRY[key]
    const text = `${key}=${entry ? entry.value : ''}`
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i)
      h = Math.imul(h, 0x01000193)
    }
  }
  h ^= h >>> 16
  h = Math.imul(h, 0x21f0aaad)
  h ^= h >>> 15
  h = Math.imul(h, 0x735a2d97)
  h ^= h >>> 15
  return (h >>> 0).toString(36)
}

let fingerprint: string | null = null
function model(): string {
  fingerprint ??= modelFingerprint()
  return fingerprint
}

/*
 * Every one of these can throw. Private browsing refuses to write, a full
 * quota refuses to write, and a browser told to block site data throws on the
 * accessor itself. A game that cannot save is a game that cannot save; it is
 * not a game that crashes on the way in.
 */
function read(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key)
    return raw === null ? null : JSON.parse(raw)
  } catch {
    return null
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Nothing to be done, and nothing worth saying about it.
  }
}

function remove(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // As above.
  }
}

function isMoveLog(value: unknown): value is MoveLog {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  for (const [year, moves] of Object.entries(value)) {
    if (!Number.isInteger(Number(year))) return false
    if (!Array.isArray(moves) || moves.some((m) => typeof m !== 'string')) return false
  }
  return true
}

/** The run in progress, if there is one this model can still reproduce. */
export function loadSave(): SaveGame | null {
  const value = read(SAVE_KEY) as Partial<SaveGame> | null
  if (!value || typeof value.seed !== 'string' || typeof value.year !== 'number') return null
  if (value.model !== model()) return null
  if (!isMoveLog(value.moves)) return null
  if (value.year < 1) return null
  return { seed: value.seed, moves: value.moves, year: value.year, model: value.model }
}

export function writeSave(seed: string, moves: MoveLog, year: number): void {
  write(SAVE_KEY, { seed, moves, year, model: model() } satisfies SaveGame)
}

export function clearSave(): void {
  remove(SAVE_KEY)
}

/** Finished runs, oldest first. */
export function loadRuns(): RunRecord[] {
  const value = read(RUNS_KEY)
  if (!Array.isArray(value)) return []
  return value.filter((run: unknown): run is RunRecord => {
    if (typeof run !== 'object' || run === null) return false
    const r = run as Partial<RunRecord>
    return typeof r.seed === 'string'
      && typeof r.finishedYear === 'number'
      && typeof r.at === 'number'
      && r.model === model()
      && (r.reason === 'fired' || r.reason === 'insolvent' || r.reason === 'completed')
      && isMoveLog(r.moves)
  })
}

/** Remember a run that has ended. Keeps the last handful, in order. */
export function recordRun(record: Omit<RunRecord, 'model'>): void {
  const runs = loadRuns()
  runs.push({ ...record, model: model() })
  write(RUNS_KEY, runs.slice(-RUNS_KEPT))
}

export function clearRuns(): void {
  remove(RUNS_KEY)
}

/** Exposed for the tests, which have to be able to tell two models apart. */
export const MODEL_FINGERPRINT_KEYS = { SAVE_KEY, RUNS_KEY, RUNS_KEPT }
