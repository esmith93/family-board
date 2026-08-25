/** Projection maths. Everything lands in the wrong place if these are wrong. */
import { describe, expect, it } from 'vitest'
import { depthOf, makeCamera, project, TILE_H, TILE_W, toGrid, toScreen, unproject } from './iso'

describe('isometric projection', () => {
  it('puts the origin at the origin', () => {
    expect(toScreen(0, 0)).toEqual({ x: 0, y: 0 })
  })

  it('sends +x down-right and +y down-left', () => {
    expect(toScreen(1, 0)).toEqual({ x: TILE_W / 2, y: TILE_H / 2 })
    expect(toScreen(0, 1)).toEqual({ x: -TILE_W / 2, y: TILE_H / 2 })
  })

  it('round-trips through the grid', () => {
    for (const [gx, gy] of [[0, 0], [3, 7], [-2, 5], [120, 41]] as [number, number][]) {
      const back = toGrid(toScreen(gx, gy).x, toScreen(gx, gy).y)
      expect(back.x).toBeCloseTo(gx, 6)
      expect(back.y).toBeCloseTo(gy, 6)
    }
  })

  it('round-trips through the camera at any zoom', () => {
    const camera = makeCamera(800, 600)
    for (const zoom of [0.5, 1, 2.4]) {
      camera.zoom = zoom
      camera.gx = 40
      camera.gy = 12
      const at = project(camera, 44, 15)
      const back = unproject(camera, at.x, at.y)
      expect(back.x).toBeCloseTo(44, 5)
      expect(back.y).toBeCloseTo(15, 5)
    }
  })

  it('orders nearer tiles after further ones', () => {
    expect(depthOf(5, 5)).toBeGreaterThan(depthOf(4, 5))
    expect(depthOf(5, 5)).toBeGreaterThan(depthOf(5, 4))
    // Two cells the same distance back sort together, broken by the layer.
    expect(depthOf(3, 7)).toBe(depthOf(7, 3))
    expect(depthOf(3, 7, 1)).toBeGreaterThan(depthOf(7, 3, 0))
  })
})
