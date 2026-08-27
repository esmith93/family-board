/**
 * The isometric renderer.
 *
 * Draws the ground plane, then everything standing on it in painter order.
 * Every sprite it draws came out of the cache; the cache rasterised each one
 * once and repaints it only when the light or the season changes.
 */

import {
  makeCamera, project, PX_PER_FLOOR, TILE_FT, TILE_H, TILE_W, toScreen, unproject, visibleRange, type Camera,
} from './iso'
import { makePalette, SKY, type LightName, type PaletteVariant, type SeasonName } from './palette'
import { SpriteCache, type CachedSprite } from './cache'
import { CHUNK, ChunkCache, chunkOrigin } from './chunks'
import {
  asphaltSurface, concreteSurface, dirtSurface, grassSurface, parkingLotTile, plazaSurface, roadTile,
} from './sprites/ground'
import { buildingWithShadow, type Sprite } from './sprites/buildings'
import { valueColumn } from './sprites/ledger'
import {
  benchSprite, busShelterSprite, busSprite, carSprite, cobraLightSprite, hydrantSprite,
  lightPoolSprite, pedestrianLightSprite, personSprite, trafficSignalSprite, treeSprite,
  utilityPoleSprite,
} from './sprites/props'
import type { Scene, SceneProp, TileKind } from './scene'
import { makeBitmap } from './bitmap'

export interface RenderStats {
  /** Ground tiles covered, drawn as a much smaller number of baked chunks. */
  tilesDrawn: number
  chunksDrawn: number
  chunksBaked: number
  objectsDrawn: number
  spritesRasterised: number
  canvasesPainted: number
  frameMs: number
  /** Rolling mean over the last sixty frames, which is what actually matters. */
  avgFrameMs: number
}

type Ctx = CanvasRenderingContext2D

/**
 * How much corridor the opening frame holds, in feet.
 *
 * A fifth of a mile: enough to read the road as a road, take in several
 * frontages and two places it is legal to cross, and still see that the
 * buildings are set a long way back from the kerb. The whole 1.2 miles at
 * once turns every building into a chip of colour.
 */
const OPENING_VIEW_FT = 1100

interface DrawItem {
  depth: number
  gx: number
  gy: number
  key: string
  make: () => Sprite
  /** Extra vertical offset in pixels, for things that hover or bob. */
  lift: number
}

export class IsometricRenderer {
  readonly camera: Camera
  private readonly cache = new SpriteCache()
  private readonly chunks = new ChunkCache()
  private variant: PaletteVariant
  private light: LightName = 'day'
  private season: SeasonName = 'summer'
  private scene: Scene | null = null
  private tileAt = new Map<number, TileKind>()
  private tileSeed = new Map<number, number>()
  private statics: DrawItem[] = []
  /** Positions of anything that casts light after dark. */
  private lamps: { gx: number; gy: number; warm: boolean; radius: number }[] = []
  public stats: RenderStats = {
    tilesDrawn: 0, chunksDrawn: 0, chunksBaked: 0, objectsDrawn: 0, spritesRasterised: 0,
    canvasesPainted: 0, frameMs: 0, avgFrameMs: 0,
  }

  private readonly frameTimes: number[] = []

  /** Everything is drawn here at 1:1, then scaled to the screen exactly once. */
  private buffer: HTMLCanvasElement | OffscreenCanvas | null = null
  private bufferCtx: Ctx | null = null

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.camera = makeCamera(canvas.width, canvas.height)
    this.variant = makePalette(this.light, this.season)
  }

  /**
   * Size the world buffer to the viewport divided by the zoom, so sprites are
   * always blitted unscaled. Scaling eight thousand sprites individually costs
   * a resample each; scaling one buffer costs one.
   */
  private ensureBuffer(): Ctx | null {
    const zoom = this.camera.zoom
    const w = Math.max(1, Math.ceil(this.canvas.width / zoom))
    const h = Math.max(1, Math.ceil(this.canvas.height / zoom))
    if (!this.buffer || this.buffer.width !== w || this.buffer.height !== h) {
      if (typeof OffscreenCanvas !== 'undefined') this.buffer = new OffscreenCanvas(w, h)
      else {
        const element = document.createElement('canvas')
        element.width = w
        element.height = h
        this.buffer = element
      }
      this.bufferCtx = this.buffer.getContext('2d') as Ctx | null
      if (this.bufferCtx) this.bufferCtx.imageSmoothingEnabled = false
    }
    return this.bufferCtx
  }

  setLight(light: LightName): void {
    if (light === this.light) return
    this.light = light
    this.variant = makePalette(light, this.season)
  }

  setSeason(season: SeasonName): void {
    if (season === this.season) return
    this.season = season
    this.variant = makePalette(this.light, season)
  }

  get lightName(): LightName { return this.light }
  get seasonName(): SeasonName { return this.season }

  resize(width: number, height: number): void {
    this.canvas.width = width
    this.canvas.height = height
    this.camera.viewWidth = width
    this.camera.viewHeight = height
  }

  setScene(scene: Scene): void {
    this.scene = scene
    // The ground changed, so the baked ground is stale.
    this.chunks.clear()
    this.tileAt.clear()
    this.tileSeed.clear()
    for (const tile of scene.tiles) {
      const key = tile.gy * scene.gridW + tile.gx
      this.tileAt.set(key, tile.kind)
      this.tileSeed.set(key, tile.seed)
    }

    // Everything that does not move, sorted once into painter order.
    const items: DrawItem[] = []

    /*
     * The Ledger View swaps the corridor's buildings for its accounts. Same
     * ground, same road, same painter order - what changes is that every
     * parcel is now as tall as it pays. Nothing else in the renderer knows
     * about it, because it is the same machinery drawing different boxes.
     */
    if (scene.ledger) {
      for (const column of scene.ledger) {
        const key = `L:${Math.round(column.revenuePx)}:${Math.round(column.liabilityPx)}`
          + `:${column.footprintW}x${column.footprintD}:${column.exempt ? 1 : 0}`
        items.push({
          depth: (column.gx + column.footprintW - 1) + (column.gy + column.footprintD - 1),
          gx: column.gx, gy: column.gy, key, lift: 0,
          make: () => valueColumn({
            footprintW: column.footprintW,
            footprintD: column.footprintD,
            revenuePx: column.revenuePx,
            liabilityPx: column.liabilityPx,
            exempt: column.exempt,
          }),
        })
      }
      items.sort((a, b) => a.depth - b.depth || a.gy - b.gy)
      this.statics = items
      this.lamps = []
      return
    }

    for (const b of scene.buildings) {
      const key = `b:${b.use}:${b.footprintW}x${b.footprintD}:${b.floors}:${b.seed & 0xff}:${Math.round(b.condition * 4)}`
      items.push({
        depth: (b.gx + b.footprintW - 1) + (b.gy + b.footprintD - 1),
        gx: b.gx, gy: b.gy, key, lift: 0,
        make: () => buildingWithShadow({
          use: b.use, footprintW: b.footprintW, footprintD: b.footprintD,
          floors: b.floors, seed: b.seed, condition: b.condition,
        }),
      })
    }
    for (const prop of scene.props) {
      items.push({
        depth: prop.gx + prop.gy,
        gx: prop.gx, gy: prop.gy,
        key: propKey(prop, this.season),
        lift: 0,
        make: () => makeProp(prop, this.season),
      })
    }
    items.sort((a, b) => a.depth - b.depth || a.gy - b.gy)
    this.statics = items

    // A cobra head's arm reaches out over the carriageway, so its pool belongs
    // on the road, not on the pavement it is bolted to. A pedestrian pole
    // lights the pavement it stands on.
    const roadCentre = scene.lanes.length > 0
      ? scene.lanes.reduce((sum, lane) => sum + lane.gy, 0) / scene.lanes.length
      : 0
    this.lamps = scene.props
      .filter((p) => p.kind === 'cobra' || p.kind === 'pedlight' || p.kind === 'shelter_upgraded')
      .map((p) => {
        const toward = Math.sign(roadCentre - p.gy)
        return {
          gx: p.gx,
          gy: p.gy + (p.kind === 'cobra' ? toward * 2.2 : 0),
          warm: true,
          radius: p.kind === 'cobra' ? 62 : 28,
        }
      })
  }

  /**
   * Frame the corridor for a window this many CSS pixels wide.
   *
   * The zoom comes from the window's CSS width and not from its device pixels,
   * so the same window frames the same length of street on a retina screen and
   * on a cheap one. A hardcoded zoom did not: the world buffer is the canvas
   * divided by the zoom, so at devicePixelRatio 2 it was twice as wide in world
   * units and showed twice as much corridor at half the size. Two people
   * describing their first look at Commerce Boulevard were describing
   * different amounts of it.
   *
   * The clamp is what keeps the art honest. Below about a third, a tile drawn
   * at sixty-four pixels is being minified more than three to one and the
   * hatching on a car park turns to porridge.
   */
  frameCorridor(cssWidth: number): void {
    if (!this.scene) return
    const wanted = cssWidth / ((OPENING_VIEW_FT / TILE_FT) * (TILE_W / 2))
    this.camera.zoom = Math.max(0.3, Math.min(0.75, wanted))
    this.camera.gx = 0.5 * this.scene.gridW
    // The middle of the carriageway, worked out from where the lanes actually
    // are. A row number that was right when it was typed stops being right the
    // first time somebody removes a lane.
    const lanes = this.scene.lanes
    this.camera.gy = lanes.length > 0
      ? lanes.reduce((total, lane) => total + lane.gy, 0) / lanes.length
      : this.scene.gridH / 2
  }

  /** Centre the camera on a point along the corridor, 0..1. */
  lookAt(along: number, acrossRow: number): void {
    if (!this.scene) return
    this.camera.gx = along * this.scene.gridW
    this.camera.gy = acrossRow
  }

  panBy(dx: number, dy: number): void {
    const grid = unproject(this.camera, this.camera.viewWidth / 2 + dx, this.camera.viewHeight / 2 + dy)
    const centre = unproject(this.camera, this.camera.viewWidth / 2, this.camera.viewHeight / 2)
    this.camera.gx += centre.x - grid.x
    this.camera.gy += centre.y - grid.y
    this.clampCamera()
  }

  /**
   * The floor is lower than the street view needs because the Ledger View has
   * to hold a mile of corridor in one frame: a column at a time says nothing,
   * and the shape of the whole street is the finding.
   */
  zoomBy(factor: number): void {
    this.camera.zoom = Math.max(0.12, Math.min(3, this.camera.zoom * factor))
  }

  private clampCamera(): void {
    if (!this.scene) return
    this.camera.gx = Math.max(-8, Math.min(this.scene.gridW + 8, this.camera.gx))
    this.camera.gy = Math.max(-8, Math.min(this.scene.gridH + 8, this.camera.gy))
  }

  render(timeMs: number): void {
    const started = performance.now()
    const screen = this.canvas.getContext('2d') as Ctx | null
    const ctx = this.ensureBuffer()
    if (!screen || !ctx || !this.scene) return
    const scene = this.scene

    ctx.imageSmoothingEnabled = false
    this.drawSky(ctx)

    // Project into buffer space: same camera, zoom folded into the buffer size.
    const bufferCamera: Camera = {
      gx: this.camera.gx, gy: this.camera.gy, zoom: 1,
      viewWidth: ctx.canvas.width, viewHeight: ctx.canvas.height,
    }
    this.projectionCamera = bufferCamera
    const range = visibleRange(bufferCamera, scene.gridW, scene.gridH)
    let chunksDrawn = 0
    let objectsDrawn = 0

    // --- Ground plane, drawn as baked chunks ---
    const centre = toScreen(bufferCamera.gx, bufferCamera.gy)
    const left = centre.x - ctx.canvas.width / 2
    const top = centre.y - ctx.canvas.height / 2

    // Chunks form a diamond lattice too, so walk them the same way.
    const sumMin = Math.floor(top / (TILE_H / 2)) - 2 * CHUNK
    const sumMax = Math.ceil((top + ctx.canvas.height) / (TILE_H / 2)) + CHUNK
    const diffMin = Math.floor(left / (TILE_W / 2)) - 2 * CHUNK
    const diffMax = Math.ceil((left + ctx.canvas.width) / (TILE_W / 2)) + 2 * CHUNK

    const cxMin = Math.floor((sumMin + diffMin) / 2 / CHUNK)
    const cxMax = Math.ceil((sumMax + diffMax) / 2 / CHUNK)
    const cyMin = Math.floor((sumMin - diffMax) / 2 / CHUNK)
    const cyMax = Math.ceil((sumMax - diffMin) / 2 / CHUNK)

    const chunkLimitX = Math.ceil(scene.gridW / CHUNK)
    const chunkLimitY = Math.ceil(scene.gridH / CHUNK)

    for (let cy = Math.max(0, cyMin); cy <= Math.min(chunkLimitY, cyMax); cy++) {
      for (let cx = Math.max(0, cxMin); cx <= Math.min(chunkLimitX, cxMax); cx++) {
        // Reject off-screen chunks BEFORE baking them. The chunk coordinates
        // come from a bounding box in a diamond lattice, so most candidates in
        // that box are nowhere near the view; baking them first thrashed the
        // cache badly enough to cost a third of a second a frame.
        const origin = chunkOrigin(cx, cy)
        const x = Math.round(origin.x - left)
        const y = Math.round(origin.y - top)
        if (x > ctx.canvas.width || y > ctx.canvas.height ||
          x + CHUNK * TILE_W < 0 || y + CHUNK * TILE_H < 0) continue

        const chunk = this.chunks.get(cx, cy, (gx, gy) => {
          if (gx < 0 || gy < 0 || gx >= scene.gridW || gy >= scene.gridH) return null
          const key = gy * scene.gridW + gx
          const kind = this.tileAt.get(key)
          if (!kind) return null
          const seed = this.tileSeed.get(key) ?? 0
          return this.cache.get(tileKey(kind, seed), () => ({
            bmp: makeTile(kind, seed), anchorX: TILE_W / 2, anchorY: 0,
          })).bitmap
        })
        ctx.drawImage(this.chunks.canvasFor(chunk, this.variant) as CanvasImageSource, x, y)
        chunksDrawn++
      }
    }

    // --- Light, before anything standing in it ---
    if (this.light === 'night' || this.light === 'dusk') {
      const previous = ctx.globalCompositeOperation
      ctx.globalCompositeOperation = 'lighter'
      ctx.globalAlpha = this.light === 'night' ? 0.8 : 0.34
      for (const lamp of this.lamps) {
        if (lamp.gx < range.x0 - 4 || lamp.gx > range.x1 || lamp.gy < range.y0 - 4 || lamp.gy > range.y1) continue
        const entry = this.cache.get(`pool:${lamp.radius}:${lamp.warm ? 1 : 0}`,
          () => lightPoolSprite(lamp.radius, lamp.warm))
        this.paint(ctx, entry, lamp.gx, lamp.gy, -4)
      }
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = previous
    }

    // --- Everything standing on it ---
    for (const item of this.statics) {
      if (item.gx < range.x0 - 4 || item.gx > range.x1 || item.gy < range.y0 - 4 || item.gy > range.y1) continue
      const entry = this.cache.get(item.key, item.make)
      this.paint(ctx, entry, item.gx, item.gy, item.lift)
      objectsDrawn++
    }

    objectsDrawn += this.drawTraffic(ctx, scene, range, timeMs)

    // One scale, at the end, with smoothing off so the pixels stay square.
    screen.imageSmoothingEnabled = false
    screen.drawImage(
      ctx.canvas as CanvasImageSource,
      0, 0, ctx.canvas.width, ctx.canvas.height,
      0, 0, this.canvas.width, this.canvas.height,
    )

    this.stats = {
      tilesDrawn: chunksDrawn * CHUNK * CHUNK,
      chunksDrawn,
      objectsDrawn,
      spritesRasterised: this.cache.rasterised,
      canvasesPainted: this.cache.painted,
      chunksBaked: this.chunks.baked,
      frameMs: performance.now() - started,
      avgFrameMs: this.rollingMean(performance.now() - started),
    }
  }

  private projectionCamera: Camera | null = null

  private drawSky(ctx: Ctx): void {
    const sky = SKY[this.light]
    const gradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height)
    gradient.addColorStop(0, sky.top)
    gradient.addColorStop(1, sky.bottom)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  }

  private paint(ctx: Ctx, entry: CachedSprite, gx: number, gy: number, lift: number): void {
    const camera = this.projectionCamera
    if (!camera) return
    const canvas = this.cache.canvasFor(entry, this.variant)
    const at = project(camera, gx, gy)
    const w = entry.bitmap.width
    const h = entry.bitmap.height
    if (w <= 0 || h <= 0) return
    const x = Math.round(at.x - entry.anchorX)
    const y = Math.round(at.y - entry.anchorY - lift)
    if (x > ctx.canvas.width || y > ctx.canvas.height || x + w < 0 || y + h < 0) return
    ctx.drawImage(canvas as CanvasImageSource, x, y)
  }

  /**
   * Moving traffic. How many vehicles are on screen is a function of AADT, so
   * a corridor that filled back up after a widening visibly has more cars on
   * it than it did before.
   */
  private drawTraffic(
    ctx: Ctx, scene: Scene, range: { x0: number; x1: number; y0: number; y1: number }, timeMs: number,
  ): number {
    if (scene.lanes.length === 0) return 0
    const seconds = timeMs / 1000
    let drawn = 0

    // Headway from the actual flow, not from a guess: peak-hour volume per
    // lane, at the corridor's running speed, gives the gap between vehicles.
    // Which means a corridor that filled back up after a widening is visibly
    // tighter, and a jammed one is visibly nose to tail.
    const lanesPerDirection = Math.max(1, Math.round(scene.lanes.length / 2))
    const perLaneHourly = Math.max(60, (scene.aadt * 0.092 * 0.55) / lanesPerDirection)
    const speedFtPerSec = Math.max(4, scene.peakSpeedMph) * 1.467
    const headwaySeconds = 3600 / perLaneHourly
    const spacing = Math.max(2.2, (headwaySeconds * speedFtPerSec) / 12)
    const speedTilesPerSecond = (speedFtPerSec / 12) * 0.22

    for (let laneIndex = 0; laneIndex < scene.lanes.length; laneIndex++) {
      const lane = scene.lanes[laneIndex]!
      if (lane.gy < range.y0 - 2 || lane.gy > range.y1 + 2) continue
      const direction = lane.forward ? 1 : -1
      const drift = seconds * speedTilesPerSecond * direction + laneIndex * 1.7

      const first = Math.floor((range.x0 - drift) / spacing) - 1
      const last = Math.ceil((range.x1 - drift) / spacing) + 1
      for (let n = first; n <= last; n++) {
        const gx = n * spacing + drift
        if (gx < range.x0 - 2 || gx > range.x1 + 2) continue
        const seed = (n * 2654435761 + laneIndex * 40503) | 0
        const isBus = scene.busesPerHour > 0 && ((n + laneIndex) % 23 === 0)
        const key = isBus ? `bus:${seed & 0x3f}` : `car:${seed & 0xff}:${lane.forward ? 1 : 0}`
        if (this.light === 'night' || this.light === 'dusk') {
          const previous = ctx.globalCompositeOperation
          ctx.globalCompositeOperation = 'lighter'
          ctx.globalAlpha = this.light === 'night' ? 0.5 : 0.2
          const pool = this.cache.get('pool:22:1', () => lightPoolSprite(22, true))
          this.paint(ctx, pool, gx + (lane.forward ? 1.4 : -1.4), lane.gy + 0.5, -2)
          ctx.globalAlpha = 1
          ctx.globalCompositeOperation = previous
        }
        const entry = this.cache.get(key, () => (isBus ? busSprite(seed) : carSprite(seed, lane.forward)))
        this.paint(ctx, entry, gx, lane.gy + 0.5, 0)
        drawn++
      }
    }
    return drawn
  }

  private rollingMean(sample: number): number {
    this.frameTimes.push(sample)
    if (this.frameTimes.length > 60) this.frameTimes.shift()
    let total = 0
    for (const value of this.frameTimes) total += value
    return total / this.frameTimes.length
  }

  get spriteCount(): number { return this.cache.size }
  get chunkCount(): number { return this.chunks.size }
}

// ---------------------------------------------------------------------------

function tileKey(kind: TileKind, seed: number): string {
  const variant = seed & 0x7
  switch (kind.sort) {
    case 'road': return `t:road:${kind.role}:${variant}`
    case 'lot': return `t:lot:${kind.faded ? 1 : 0}:${kind.aisle ? 'a' : 'b'}:${variant}`
    case 'walk': return `t:walk:${kind.kerb ?? 'n'}:${Math.round(kind.coverage * 8)}:${variant}`
    default: return `t:${kind.sort}:${variant}`
  }
}

function makeTile(kind: TileKind, seed: number) {
  switch (kind.sort) {
    case 'road': return roadTile(kind.role, seed)
    case 'walk': return concreteSurface(seed, kind.kerb, kind.coverage)
    case 'lot': return parkingLotTile(seed, kind.faded, kind.aisle)
    case 'grass': return grassSurface(seed)
    case 'dirt': return dirtSurface(seed)
    case 'plaza': return plazaSurface(seed)
    default: return asphaltSurface(seed)
  }
}

function propKey(prop: SceneProp, season: SeasonName): string {
  if (prop.kind === 'tree') {
    const bucket = Math.round((prop.maturity ?? 1) * 6)
    return `p:tree:${bucket}:${prop.seed & 0x1f}:${season === 'winter' ? 'bare' : 'leaf'}`
  }
  if (prop.kind === 'person') return `p:person:${prop.seed & 0x3f}`
  if (prop.kind === 'parked_car') return `p:parked:${prop.seed & 0xff}`
  return `p:${prop.kind}`
}

function makeProp(prop: SceneProp, season: SeasonName): Sprite {
  switch (prop.kind) {
    case 'tree': return treeSprite(prop.maturity ?? 1, prop.seed, season === 'winter' ? 'bare' : 'summer')
    case 'cobra': return cobraLightSprite()
    case 'pedlight': return pedestrianLightSprite()
    case 'signal': return trafficSignalSprite()
    case 'shelter': return busShelterSprite(false)
    case 'shelter_upgraded': return busShelterSprite(true)
    case 'hydrant': return hydrantSprite()
    case 'bench': return benchSprite()
    case 'pole': return utilityPoleSprite()
    case 'person': return personSprite(prop.seed)
    case 'parked_car': return carSprite(prop.seed, false)
    default: return { bmp: makeBitmap(1, 1), anchorX: 0, anchorY: 0 }
  }
}

export { PX_PER_FLOOR, TILE_H, TILE_W }
