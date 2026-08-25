/**
 * The rule this file exists to enforce:
 *
 *   "Every sprite is intentionally drawn in code, with at least three palette
 *    values per material for shading. If a sprite looks like a debug
 *    rectangle, it is not done."
 *
 * A test cannot judge whether art is good. It can judge whether a sprite is a
 * flat fill, whether it is a bare rectangle, and whether it reproduces exactly
 * from its seed - which is most of the way to catching a placeholder.
 */
import { describe, expect, it } from 'vitest'
import { bounds, getPx, usedIndices, type Bitmap } from './bitmap'
import { TRANSPARENT } from './palette'
import {
  asphaltSurface, concreteSurface, dirtSurface, grassSurface, parkingLotTile, plazaSurface,
  roadTile, type RoadRole,
} from './sprites/ground'
import { buildingSprite, buildingWithShadow } from './sprites/buildings'
import {
  benchSprite, busShelterSprite, busSprite, carSprite, cobraLightSprite, hydrantSprite,
  lightPoolSprite, pedestrianLightSprite, personSprite, trafficSignalSprite, treeSprite,
  utilityPoleSprite,
} from './sprites/props'
import { LAND_USES, type LandUse } from '../sim/types'
import { profileFor } from '../sim/landuse'

const ROAD_ROLES: RoadRole[] = [
  'lane', 'lane_divider', 'centre_double', 'turn_lane', 'bike_painted', 'bike_protected',
  'bus_lane', 'parking_bay', 'crosswalk', 'median_raised', 'median_planted', 'stop_bar',
]

function catalogue(): [string, Bitmap][] {
  const entries: [string, Bitmap][] = [
    ['asphalt', asphaltSurface(1)],
    ['asphalt worn', asphaltSurface(2, true)],
    ['concrete', concreteSurface(3)],
    ['concrete kerbed', concreteSurface(3, 'south')],
    ['grass', grassSurface(4)],
    ['dirt', dirtSurface(5)],
    ['plaza', plazaSurface(6)],
    ['lot', parkingLotTile(7, false)],
    ['lot faded', parkingLotTile(8, true)],
    ['lot aisle', parkingLotTile(9, false, true)],
  ]
  for (const role of ROAD_ROLES) entries.push([`road:${role}`, roadTile(role, 11)])
  for (const prop of [
    ['cobra', cobraLightSprite()], ['pedlight', pedestrianLightSprite()],
    ['signal', trafficSignalSprite()], ['shelter', busShelterSprite(false)],
    ['shelter upgraded', busShelterSprite(true)], ['hydrant', hydrantSprite()],
    ['bench', benchSprite()], ['pole', utilityPoleSprite()],
    ['person', personSprite(13)], ['car', carSprite(17, true)],
    ['parked car', carSprite(19, false)], ['bus', busSprite(23)],
    ['tree young', treeSprite(0.2, 29, 'summer')], ['tree mature', treeSprite(1, 31, 'summer')],
    ['tree bare', treeSprite(1, 31, 'bare')],
  ] as [string, { bmp: Bitmap }][]) {
    entries.push([prop[0], prop[1].bmp])
  }
  for (const use of LAND_USES) {
    const profile = profileFor(use)
    if (profile.stories <= 0) continue
    entries.push([`building:${use}`, buildingSprite({
      use: use as LandUse, footprintW: 4, footprintD: 3,
      floors: Math.max(1, Math.round(profile.stories)), seed: 41, condition: 0.8,
    }).bmp])
  }
  return entries
}

const ALL = catalogue()

describe('no sprite is a placeholder', () => {
  it('draws every sprite with at least three palette values', () => {
    for (const [name, bmp] of ALL) {
      const used = usedIndices(bmp)
      expect(used.size, `"${name}" uses only ${used.size} value(s) - that is a flat fill`)
        .toBeGreaterThanOrEqual(3)
    }
  })

  it('never leaves a sprite empty', () => {
    for (const [name, bmp] of ALL) {
      const box = bounds(bmp)
      expect(box.w, `"${name}" is empty`).toBeGreaterThan(0)
      expect(box.h, `"${name}" is empty`).toBeGreaterThan(0)
    }
  })

  it('gives ground tiles a diamond silhouette, not a rectangle', () => {
    // A rectangle with ink in all four corners is exactly what a debug tile
    // looks like. A real isometric tile has empty corners.
    for (const [name, bmp] of ALL) {
      if (!name.startsWith('road:') && !['asphalt', 'concrete', 'grass', 'dirt', 'plaza', 'lot'].includes(name)) continue
      const corners = [
        getPx(bmp, 0, 0), getPx(bmp, bmp.width - 1, 0),
        getPx(bmp, 0, bmp.height - 1), getPx(bmp, bmp.width - 1, bmp.height - 1),
      ]
      for (const corner of corners) {
        expect(corner, `"${name}" has ink in a corner, so it is a rectangle`).toBe(TRANSPARENT)
      }
    }
  })

  it('shades every surface rather than filling it', () => {
    // A surface that is 95% one value has a ramp in name only.
    for (const [name, bmp] of ALL) {
      if (!name.startsWith('road:') && !['asphalt', 'concrete', 'grass', 'dirt', 'lot'].includes(name)) continue
      const counts = new Map<number, number>()
      let total = 0
      for (const value of bmp.data) {
        if (value === TRANSPARENT) continue
        counts.set(value, (counts.get(value) ?? 0) + 1)
        total++
      }
      const dominant = Math.max(...counts.values())
      expect(dominant / total, `"${name}" is ${Math.round(dominant / total * 100)}% one value`)
        .toBeLessThan(0.9)
    }
  })
})

describe('sprites are deterministic', () => {
  it('reproduces exactly from the same seed', () => {
    for (const make of [
      () => asphaltSurface(101),
      () => parkingLotTile(103, true),
      () => treeSprite(0.7, 107, 'summer').bmp,
      () => carSprite(109, true).bmp,
      () => buildingSprite({ use: 'mainstreet_mixed', footprintW: 5, footprintD: 3, floors: 3, seed: 113, condition: 0.7 }).bmp,
    ]) {
      expect(Array.from(make().data)).toEqual(Array.from(make().data))
    }
  })

  it('varies with the seed', () => {
    const a = buildingSprite({ use: 'mainstreet_mixed', footprintW: 5, footprintD: 3, floors: 3, seed: 1, condition: 0.8 }).bmp
    const b = buildingSprite({ use: 'mainstreet_mixed', footprintW: 5, footprintD: 3, floors: 3, seed: 2, condition: 0.8 }).bmp
    expect(Array.from(a.data)).not.toEqual(Array.from(b.data))
  })

  it('gives each road role its own appearance', () => {
    const seen = new Map<string, string>()
    for (const role of ROAD_ROLES) {
      const key = Array.from(roadTile(role, 5).data).join(',')
      for (const [other, value] of seen) {
        expect(key, `road roles "${role}" and "${other}" look identical`).not.toBe(value)
      }
      seen.set(role, key)
    }
  })
})

describe('sprites carry the model into the picture', () => {
  it('grows a tree with its maturity', () => {
    const sapling = bounds(treeSprite(0.15, 7, 'summer').bmp)
    const mature = bounds(treeSprite(1, 7, 'summer').bmp)
    expect(mature.h).toBeGreaterThan(sapling.h * 1.5)
    expect(mature.w).toBeGreaterThan(sapling.w)
  })

  it('makes a taller building taller', () => {
    const low = buildingSprite({ use: 'mainstreet_mixed', footprintW: 4, footprintD: 3, floors: 2, seed: 3, condition: 0.9 })
    const high = buildingSprite({ use: 'midrise_mixed', footprintW: 4, footprintD: 3, floors: 6, seed: 3, condition: 0.9 })
    expect(high.bmp.height).toBeGreaterThan(low.bmp.height)
  })

  it('boards up the windows of a derelict building', () => {
    const kept = buildingSprite({ use: 'mainstreet_mixed', footprintW: 5, footprintD: 3, floors: 3, seed: 5, condition: 0.95 }).bmp
    const derelict = buildingSprite({ use: 'mainstreet_mixed', footprintW: 5, footprintD: 3, floors: 3, seed: 5, condition: 0.1 }).bmp
    expect(Array.from(kept.data)).not.toEqual(Array.from(derelict.data))
  })

  it('puts a shadow under a building so it sits on the ground', () => {
    const plain = buildingSprite({ use: 'big_box', footprintW: 6, footprintD: 4, floors: 1, seed: 9, condition: 0.8 })
    const shadowed = buildingWithShadow({ use: 'big_box', footprintW: 6, footprintD: 4, floors: 1, seed: 9, condition: 0.8 })
    expect(usedIndices(shadowed.bmp).size).toBeGreaterThanOrEqual(usedIndices(plain.bmp).size)
    expect(shadowed.bmp.width).toBeGreaterThan(plain.bmp.width)
  })

  it('makes a light pool that fades out rather than stopping', () => {
    const pool = lightPoolSprite(30, true).bmp
    const centre = getPx(pool, Math.floor(pool.width / 2), Math.floor(pool.height / 2))
    expect(centre).not.toBe(TRANSPARENT)
    // The edge is dithered, so it is partly transparent rather than a hard rim.
    let edgeInk = 0
    for (let x = 0; x < pool.width; x++) if (getPx(pool, x, 1) !== TRANSPARENT) edgeInk++
    expect(edgeInk).toBeLessThan(pool.width * 0.5)
  })
})
