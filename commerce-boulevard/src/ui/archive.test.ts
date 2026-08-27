/**
 * A save is a replay, so the test of a save is that replaying it lands on the
 * same corridor. Not a similar one. The same one, down to the dollar.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { advanceYear, newGame, type SimState } from '../sim/index'

/** A localStorage that behaves, and one that refuses, because both exist. */
function stubStorage(): Map<string, string> {
  const store = new Map<string, string>()
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v) },
      removeItem: (k: string) => { store.delete(k) },
    },
  })
  return store
}

async function archive(): Promise<typeof import('./archive')> {
  vi.resetModules()
  return import('./archive')
}

const PLAN: Record<number, string[]> = {
  0: ['capital.state_widening'],
  2: ['land.reduce_parking_minimums'],
  5: ['street.plant_trees'],
  8: ['capital.repave'],
}

/** Run the plan for n years, the way the game does. */
function play(seed: string, years: number, plan: Record<number, string[]>): SimState {
  let state = newGame(seed)
  for (let y = 0; y < years && !state.ended; y++) {
    state = advanceYear(state, plan[state.year] ?? []).state
  }
  return state
}

let store: Map<string, string>

describe('a save is the seed and what was done with it', () => {
  beforeEach(() => { store = stubStorage() })

  it('replays to exactly the corridor it was saved from', async () => {
    const { loadSave, writeSave } = await archive()
    const original = play('archive-a', 12, PLAN)
    writeSave('archive-a', PLAN, original.year)

    const save = loadSave()
    expect(save).not.toBeNull()
    const restored = play(save!.seed, save!.year, save!.moves)

    // Not "close". The same state, field for field.
    expect(JSON.stringify(restored)).toBe(JSON.stringify(original))
  })

  it('is small enough that nobody has to think about it', async () => {
    const { writeSave } = await archive()
    const thirty: Record<number, string[]> = {}
    for (let y = 0; y < 30; y++) thirty[y] = ['capital.repave', 'street.plant_trees']
    writeSave('archive-b', thirty, 30)
    const bytes = [...store.values()].reduce((total, v) => total + v.length, 0)
    expect(bytes).toBeLessThan(4096)
  })

  it('refuses a save made by a different model rather than replaying it wrong', async () => {
    const { writeSave, loadSave, MODEL_FINGERPRINT_KEYS } = await archive()
    writeSave('archive-c', PLAN, 4)
    expect(loadSave()).not.toBeNull()

    const raw = JSON.parse(store.get(MODEL_FINGERPRINT_KEYS.SAVE_KEY)!)
    store.set(MODEL_FINGERPRINT_KEYS.SAVE_KEY, JSON.stringify({ ...raw, model: 'from-another-build' }))
    expect(loadSave()).toBeNull()
  })

  it('drops rubbish instead of trusting it', async () => {
    const { loadSave, loadRuns, MODEL_FINGERPRINT_KEYS } = await archive()
    for (const junk of ['', 'null', '{', '{"seed":5}', '[]', '{"seed":"a","year":"soon"}']) {
      store.set(MODEL_FINGERPRINT_KEYS.SAVE_KEY, junk)
      expect(loadSave()).toBeNull()
    }
    store.set(MODEL_FINGERPRINT_KEYS.RUNS_KEY, '{"not":"an array"}')
    expect(loadRuns()).toEqual([])
  })

  it('survives a browser that will not let it write at all', async () => {
    vi.stubGlobal('window', {
      get localStorage(): never { throw new Error('The user has blocked site data.') },
    })
    const { loadSave, loadRuns, writeSave, recordRun, clearSave } = await archive()
    expect(() => writeSave('nope', PLAN, 3)).not.toThrow()
    expect(() => clearSave()).not.toThrow()
    expect(loadSave()).toBeNull()
    expect(loadRuns()).toEqual([])
    expect(() => recordRun({
      seed: 'nope', moves: PLAN, finishedYear: 30, reason: 'completed',
      ratio: 1, debt: 0, walkShare: 0.1, groceryWalkShare: 0.5, at: 1,
    })).not.toThrow()
  })
})

describe('the run history', () => {
  beforeEach(() => { store = stubStorage() })

  it('keeps runs in the order they were played and never reorders them', async () => {
    const { recordRun, loadRuns } = await archive()
    const base = {
      moves: PLAN, ratio: 1, debt: 0, walkShare: 0.1, groceryWalkShare: 0.5,
    } as const
    recordRun({ ...base, seed: 'one', finishedYear: 14, reason: 'insolvent', at: 3 })
    recordRun({ ...base, seed: 'two', finishedYear: 30, reason: 'completed', at: 1 })
    recordRun({ ...base, seed: 'three', finishedYear: 9, reason: 'fired', at: 2 })
    expect(loadRuns().map((r) => r.seed)).toEqual(['one', 'two', 'three'])
  })

  it('forgets the oldest rather than growing without limit', async () => {
    const { recordRun, loadRuns, MODEL_FINGERPRINT_KEYS } = await archive()
    for (let i = 0; i < MODEL_FINGERPRINT_KEYS.RUNS_KEPT + 5; i++) {
      recordRun({
        seed: `run-${i}`, moves: {}, finishedYear: 30, reason: 'completed',
        ratio: 1, debt: 0, walkShare: 0.1, groceryWalkShare: 0.5, at: i,
      })
    }
    const runs = loadRuns()
    expect(runs).toHaveLength(MODEL_FINGERPRINT_KEYS.RUNS_KEPT)
    expect(runs[0]!.seed).toBe('run-5')
  })

  it('records every ending, including the ones that are not thirty years', async () => {
    const { recordRun, loadRuns } = await archive()
    for (const reason of ['fired', 'insolvent', 'completed'] as const) {
      recordRun({
        seed: reason, moves: {}, finishedYear: 12, reason,
        ratio: 0.8, debt: 1e6, walkShare: 0.08, groceryWalkShare: 0.7, at: 0,
      })
    }
    expect(loadRuns().map((r) => r.reason)).toEqual(['fired', 'insolvent', 'completed'])
  })
})
