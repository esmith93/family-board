/**
 * Deterministic pseudo-random number generation.
 *
 * The whole simulation must be reproducible from a seed: same seed, same
 * thirty years, every time. Nothing in `sim/` may call Math.random().
 */

/** A seeded, stateful random source. */
export interface Rng {
  /** Uniform in [0, 1). */
  next(): number
  /** Uniform in [min, max). */
  range(min: number, max: number): number
  /** Integer in [min, max]. */
  int(min: number, max: number): number
  /** True with probability p. */
  chance(p: number): boolean
  /** Standard normal, mean 0 stddev 1. */
  normal(): number
  /** Uniform pick from a non-empty array. */
  pick<T>(items: readonly T[]): T
  /** Fisher-Yates shuffle, returns a new array. */
  shuffle<T>(items: readonly T[]): T[]
  /** A fresh independent stream, derived from this one's seed and a label. */
  fork(label: string): Rng
}

/** FNV-1a. Turns a string seed into a 32-bit integer. */
export function hashSeed(seed: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/**
 * mulberry32. Small, fast, and good enough for a city sim: passes gjrand's
 * basic suite and has a 2^32 period, which is more years than we simulate.
 */
export function makeRng(seed: string | number): Rng {
  const numericSeed = typeof seed === 'string' ? hashSeed(seed) : seed >>> 0
  let state = numericSeed
  let spareNormal: number | null = null

  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const rng: Rng = {
    next,
    range: (min, max) => min + next() * (max - min),
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
    chance: (p) => next() < p,
    normal() {
      // Marsaglia polar method. Cache the spare so draws stay cheap.
      if (spareNormal !== null) {
        const value = spareNormal
        spareNormal = null
        return value
      }
      let u: number, v: number, s: number
      do {
        u = next() * 2 - 1
        v = next() * 2 - 1
        s = u * u + v * v
      } while (s >= 1 || s === 0)
      const mul = Math.sqrt((-2 * Math.log(s)) / s)
      spareNormal = v * mul
      return u * mul
    },
    pick(items) {
      if (items.length === 0) throw new Error('pick() from empty array')
      return items[Math.floor(next() * items.length)]!
    },
    shuffle(items) {
      const out = items.slice()
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        const a = out[i]!
        const b = out[j]!
        out[i] = b
        out[j] = a
      }
      return out
    },
    fork(label) {
      return makeRng((numericSeed ^ hashSeed(label)) >>> 0)
    },
  }
  return rng
}

/** Snapshot of an Rng's internal state, so a save file can resume mid-run. */
export interface RngSnapshot {
  seed: number
  draws: number
}

/** An Rng that counts its draws, so it can be serialized and restored. */
export function makeCountedRng(seed: string | number, draws = 0): Rng & { snapshot(): RngSnapshot } {
  const numericSeed = typeof seed === 'string' ? hashSeed(seed) : seed >>> 0
  const inner = makeRng(numericSeed)
  let count = 0
  // Replay to the saved position. 2^32 draws would be pathological; a
  // thirty-year run uses a few hundred thousand at most.
  for (let i = 0; i < draws; i++) inner.next()
  count = draws

  const wrapped: Rng & { snapshot(): RngSnapshot } = {
    next: () => {
      count++
      return inner.next()
    },
    range: (min, max) => min + wrapped.next() * (max - min),
    int: (min, max) => Math.floor(min + wrapped.next() * (max - min + 1)),
    chance: (p) => wrapped.next() < p,
    normal: () => {
      // Deliberately not the cached polar method: the cache would not survive
      // serialization. Box-Muller costs two draws every time but restores exactly.
      const u = 1 - wrapped.next()
      const v = wrapped.next()
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
    },
    pick: (items) => {
      if (items.length === 0) throw new Error('pick() from empty array')
      return items[Math.floor(wrapped.next() * items.length)]!
    },
    shuffle: (items) => {
      const out = items.slice()
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(wrapped.next() * (i + 1))
        const a = out[i]!
        const b = out[j]!
        out[i] = b
        out[j] = a
      }
      return out
    },
    fork: (label) => makeRng((numericSeed ^ hashSeed(label)) >>> 0),
    snapshot: () => ({ seed: numericSeed, draws: count }),
  }
  return wrapped
}
