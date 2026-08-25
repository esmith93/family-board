/**
 * The simulation must be reproducible. Same seed, same thirty years, every
 * time - otherwise save files, replays and these tests all mean nothing.
 */
import { describe, expect, it } from 'vitest'
import { newGame, advanceYear, simulate } from './step'
import { makeRng, makeCountedRng } from './rng'

/** Simulation sources with comments and strings stripped, so a doc comment
 *  mentioning a forbidden call does not fail the check that forbids it. */
async function simSources(): Promise<[string, string][]> {
  const { readdirSync, readFileSync } = await import('node:fs')
  return readdirSync(new URL('.', import.meta.url))
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map((file) => {
      const raw = readFileSync(new URL(file, import.meta.url), 'utf8')
      const code = raw
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')
        .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
        .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
      return [file, code] as [string, string]
    })
}

const PLAN = (year: number): string[] => {
  if (year === 0) return ['land.reduce_parking_minimums']
  if (year === 3) return ['capital.road_diet']
  if (year === 8) return ['fiscal.land_value_shift']
  return []
}

describe('determinism', () => {
  it('produces identical runs from the same seed', () => {
    const a = simulate('alpha', 30, (s) => PLAN(s.year))
    const b = simulate('alpha', 30, (s) => PLAN(s.year))
    expect(JSON.stringify(a.history)).toBe(JSON.stringify(b.history))
    expect(a.fiscal.debt).toBe(b.fiscal.debt)
    expect(a.parcels.map((p) => p.use)).toEqual(b.parcels.map((p) => p.use))
  })

  it('produces different corridors from different seeds', () => {
    const a = newGame('alpha')
    const b = newGame('bravo')
    expect(a.parcels.map((p) => p.use)).not.toEqual(b.parcels.map((p) => p.use))
  })

  it('never mutates the state it was given', () => {
    const before = newGame('alpha')
    const snapshot = JSON.stringify(before)
    advanceYear(before, ['capital.road_diet'])
    expect(JSON.stringify(before)).toBe(snapshot)
  })

  it('contains no call to Math.random anywhere in the simulation', async () => {
    for (const [file, code] of await simSources()) {
      expect(code, `${file} must not use Math.random`).not.toMatch(/Math\.random\s*\(/)
    }
  })

  it('has no DOM dependency in the simulation modules', async () => {
    for (const [file, code] of await simSources()) {
      expect(code, `${file} must not touch the DOM`)
        .not.toMatch(/\b(document|window|localStorage|HTMLElement|OffscreenCanvas)\b/)
    }
  })
})

describe('seeded rng', () => {
  it('repeats a sequence for a given seed', () => {
    const a = makeRng('x')
    const b = makeRng('x')
    const seqA = Array.from({ length: 200 }, () => a.next())
    const seqB = Array.from({ length: 200 }, () => b.next())
    expect(seqA).toEqual(seqB)
  })

  it('produces roughly uniform draws', () => {
    const rng = makeRng('uniform')
    const buckets = new Array(10).fill(0)
    for (let i = 0; i < 100_000; i++) buckets[Math.floor(rng.next() * 10)]++
    for (const count of buckets) expect(count).toBeGreaterThan(9000)
  })

  it('restores exactly from a snapshot', () => {
    const rng = makeCountedRng('resume')
    for (let i = 0; i < 57; i++) rng.next()
    const snapshot = rng.snapshot()
    const expected = Array.from({ length: 20 }, () => rng.next())

    const restored = makeCountedRng(snapshot.seed, snapshot.draws)
    const actual = Array.from({ length: 20 }, () => restored.next())
    expect(actual).toEqual(expected)
  })

  it('forks independent streams', () => {
    const rng = makeRng('parent')
    const a = rng.fork('a')
    const b = rng.fork('b')
    expect(a.next()).not.toBe(b.next())
  })
})
