/**
 * Data integrity.
 *
 * Every number in the model is a claim about the world. These tests enforce
 * that each one carries a source, sits inside its own stated range, and is
 * documented in MODEL.md - and that MODEL.md has not fallen behind.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { C, CONSTANT_GROUPS, CONSTANT_REGISTRY } from './constants'
import { renderModelDoc } from './model-doc'
import { explain } from './sourced'

const all = Object.values(CONSTANT_REGISTRY)

describe('every constant carries its provenance', () => {
  it('has a source that is either a real URL or an explicit design parameter', () => {
    for (const c of all) {
      const url = c.source.url
      const ok = url === 'internal' || url.startsWith('https://') || url.startsWith('http://')
      expect(ok, `${c.key}: source url must be a real URL or 'internal', got "${url}"`).toBe(true)
    }
  })

  it('has no placeholder citations left behind', () => {
    for (const c of all) {
      expect(c.source.title, c.key).not.toBe('PENDING')
      expect(c.source.url, c.key).not.toBe('PENDING')
      expect(c.source.year, c.key).not.toBe('PENDING')
    }
  })

  it('states a value inside its own honest range', () => {
    for (const c of all) {
      expect(c.value, `${c.key}: ${c.value} outside ${c.low}..${c.high}`).toBeGreaterThanOrEqual(c.low)
      expect(c.value, `${c.key}: ${c.value} outside ${c.low}..${c.high}`).toBeLessThanOrEqual(c.high)
    }
  })

  it('names its units', () => {
    for (const c of all) expect(c.unit.length, c.key).toBeGreaterThan(0)
  })

  it('explains itself in a sentence or two', () => {
    for (const c of all) {
      expect(c.note.length, `${c.key} needs a real note`).toBeGreaterThan(30)
    }
  })

  it('says who disagrees when the literature is contested', () => {
    const contested = all.filter((c) => c.confidence === 'contested')
    expect(contested.length).toBeGreaterThan(5)
    for (const c of contested) {
      // A contested constant must carry a wide range, or say why in the note.
      const spread = (c.high - c.low) / Math.max(1e-9, Math.abs(c.value))
      const explains = /disput|disagree|contest|debat|argu|conflat|critiq|vary|varies|range/i.test(c.note)
      expect(spread > 0.2 || explains, `${c.key}: contested but neither wide-ranged nor explained`).toBe(true)
    }
  })

  it('does not dress up a design parameter as research', () => {
    const design = all.filter((c) => c.source.url === 'internal')
    expect(design.length).toBeGreaterThan(0)
    for (const c of design) {
      expect(c.source.title.toLowerCase()).toContain('design')
    }
  })

  it('exposes every constant to the "Why this number?" panel', () => {
    for (const key of Object.keys(C)) {
      expect(explain(CONSTANT_REGISTRY, key), `${key} must be explainable`).toBeDefined()
    }
  })

  it('puts every constant in exactly one documented group', () => {
    const grouped = CONSTANT_GROUPS.flatMap((g) => g.keys)
    expect(new Set(grouped).size).toBe(grouped.length)
    expect(new Set(grouped)).toEqual(new Set(Object.keys(C)))
  })
})

describe('MODEL.md', () => {
  it('is in sync with the constant registry', () => {
    const onDisk = readFileSync(new URL('../../MODEL.md', import.meta.url), 'utf8')
    expect(onDisk, 'MODEL.md is stale - run `npm run model`').toBe(renderModelDoc())
  })

  it('documents every constant by key', () => {
    const doc = renderModelDoc()
    for (const key of Object.keys(C)) expect(doc, `${key} missing from MODEL.md`).toContain(key)
  })

  it('lists the contested numbers up front', () => {
    const doc = renderModelDoc()
    expect(doc).toContain('Where the literature disagrees')
    expect(doc).toContain('Known verification gaps')
  })

  it('records the verification gap on crash costs honestly', () => {
    const doc = renderModelDoc()
    expect(doc).toContain('VERIFICATION GAP')
  })
})

describe('sanity of the headline numbers', () => {
  it('keeps the lane-mile elasticity inside the published range', () => {
    expect(C.VMT_LANE_MILE_ELASTICITY).toBeGreaterThanOrEqual(0.5)
    expect(C.VMT_LANE_MILE_ELASTICITY).toBeLessThanOrEqual(1.0)
  })

  it('keeps the noise coefficients physically correct', () => {
    // Doubling the number of sources doubles the energy: 10*log10(2).
    expect(C.NOISE_DB_PER_VOLUME_DOUBLING).toBeCloseTo(3.01, 1)
    // Tyre noise power goes roughly as the cube of speed.
    expect(C.NOISE_DB_PER_SPEED_DOUBLING).toBeGreaterThan(C.NOISE_DB_PER_VOLUME_DOUBLING * 2)
  })

  it('keeps air and surface temperature effects an order apart', () => {
    expect(C.SURFACE_TEMP_EXCESS_ASPHALT_F).toBeGreaterThan(C.AIR_TEMP_UHI_MAX_F * 4)
  })

  it('keeps the value-per-acre ladder monotonic', () => {
    expect(C.VALUE_PER_ACRE_SURFACE_PARKING).toBeLessThan(C.VALUE_PER_ACRE_BIG_BOX)
    expect(C.VALUE_PER_ACRE_BIG_BOX).toBeLessThan(C.VALUE_PER_ACRE_MAINSTREET_MIXED)
    expect(C.VALUE_PER_ACRE_MAINSTREET_MIXED).toBeLessThan(C.VALUE_PER_ACRE_MIDRISE_MIXED)
    // And the headline gap the whole argument rests on.
    expect(C.VALUE_PER_ACRE_MIDRISE_MIXED / C.VALUE_PER_ACRE_BIG_BOX).toBeGreaterThan(10)
  })
})
