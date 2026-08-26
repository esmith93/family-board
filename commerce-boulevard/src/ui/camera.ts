/**
 * Getting into the car, and getting out and walking.
 *
 * Both first-person views are mounted here: a full-screen canvas, a frame
 * buffer of palette indices, and the loop that turns one into the other. The
 * renderers themselves have no DOM in them, so everything this file does is
 * plumbing - input, a canvas, and a clock.
 *
 * The read-out is a speedometer and a trip clock. It says how fast you are
 * going, how far you have got and how long it has taken. It does not say
 * whether that is good.
 */

import { makeLut32, paintIndexed } from '../render/bitmap'
import { makePalette, type LightName, type SeasonName } from '../render/palette'
import {
  buildDriveWorld, makeDriveFrame, newDrive, platoonSpeedMph, renderDrive, stepDrive,
  type DriveFrame, type DriveState, type DriveWorld,
} from '../render/drive'
import {
  buildWalkWorld, detourFt, makeWalkFrame, nearestCrossing, newWalk, renderWalk, stepWalk,
  type WalkFrame, type WalkState, type WalkWorld,
} from '../render/walk'
import type { SimState } from '../sim/index'

const MPH_TO_FPS = 5280 / 3600

/** Internal resolution. Scaled up whole, so the pixels stay square. */
const NATIVE_W = 480
const NATIVE_H = 270

type Mode = 'drive' | 'walk'

interface Held {
  up: boolean
  down: boolean
  left: boolean
  right: boolean
}

export class FirstPerson {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D | null
  private readonly image: ImageData | null
  private readonly words: Uint32Array | null

  private mode: Mode = 'drive'
  private running = false
  private lastMs = 0
  private lut: Uint32Array
  private light: LightName = 'day'
  private season: SeasonName = 'summer'

  private driveWorld: DriveWorld | null = null
  private drive: DriveState | null = null
  private driveFrame: DriveFrame = makeDriveFrame(NATIVE_W, NATIVE_H)

  private walkWorld: WalkWorld | null = null
  private walk: WalkState | null = null
  private walkFrame: WalkFrame = makeWalkFrame(NATIVE_W, NATIVE_H)

  private held: Held = { up: false, down: false, left: false, right: false }
  private onClose: (() => void) | null = null

  constructor() {
    this.canvas = document.getElementById('fpview') as HTMLCanvasElement
    this.canvas.width = NATIVE_W
    this.canvas.height = NATIVE_H
    this.ctx = this.canvas.getContext('2d')
    if (this.ctx) {
      this.ctx.imageSmoothingEnabled = false
      this.image = this.ctx.createImageData(NATIVE_W, NATIVE_H)
      this.words = new Uint32Array(this.image.data.buffer)
    } else {
      this.image = null
      this.words = null
    }
    this.lut = makeLut32(makePalette(this.light, this.season).lut)
    this.bind()
  }

  get isOpen(): boolean { return this.running }

  setPalette(light: LightName, season: SeasonName): void {
    if (light === this.light && season === this.season) return
    this.light = light
    this.season = season
    this.lut = makeLut32(makePalette(light, season).lut)
  }

  /** Get in, or step out onto the pavement. */
  open(state: SimState, mode: Mode, onClose: () => void): void {
    this.mode = mode
    this.onClose = onClose
    if (mode === 'drive') {
      this.driveWorld = buildDriveWorld(state)
      this.drive = newDrive(this.driveWorld)
    } else {
      this.walkWorld = buildWalkWorld(state)
      this.walk = newWalk(this.walkWorld)
    }
    document.body.classList.add('firstperson')
    document.getElementById('fp')!.classList.remove('hidden')
    this.renderHud()
    this.running = true
    this.lastMs = performance.now()
    requestAnimationFrame((t) => this.frame(t))
  }

  close(): void {
    if (!this.running) return
    this.running = false
    document.body.classList.remove('firstperson')
    document.getElementById('fp')!.classList.add('hidden')
    const done = this.onClose
    this.onClose = null
    done?.()
  }

  private bind(): void {
    const set = (event: KeyboardEvent, down: boolean): boolean => {
      switch (event.key) {
        case 'ArrowUp': case 'w': case 'W': this.held.up = down; return true
        case 'ArrowDown': case 's': case 'S': this.held.down = down; return true
        case 'ArrowLeft': case 'a': case 'A': this.held.left = down; return true
        case 'ArrowRight': case 'd': case 'D': this.held.right = down; return true
        default: return false
      }
    }
    window.addEventListener('keydown', (event) => {
      if (!this.running) return
      if (event.key === 'Escape') { this.close(); return }
      if (set(event, true)) event.preventDefault()
    })
    window.addEventListener('keyup', (event) => {
      if (!this.running) return
      if (set(event, false)) event.preventDefault()
    })
    document.getElementById('fpclose')?.addEventListener('click', () => this.close())
  }

  private frame(nowMs: number): void {
    if (!this.running) return
    const dt = Math.min(0.05, (nowMs - this.lastMs) / 1000)
    this.lastMs = nowMs

    if (this.mode === 'drive' && this.driveWorld && this.drive) {
      const throttle = this.held.down ? -1 : this.held.up ? 1 : 0.35
      const steer = (this.held.right ? 1 : 0) - (this.held.left ? 1 : 0)
      this.drive = stepDrive(this.driveWorld, this.drive, { throttle, steer }, dt)
      renderDrive(this.driveWorld, this.drive, this.driveFrame, nowMs)
      this.paint(this.driveFrame.pixels)
    } else if (this.walkWorld && this.walk) {
      const along = (this.held.right ? 1 : 0) - (this.held.left ? 1 : 0)
      this.walk = stepWalk(this.walkWorld, this.walk, { along, cross: this.held.up }, dt)
      renderWalk(this.walkWorld, this.walk, this.walkFrame, nowMs)
      this.paint(this.walkFrame.pixels)
    }

    this.renderHud()
    requestAnimationFrame((t) => this.frame(t))
  }

  private paint(pixels: Uint8Array): void {
    if (!this.ctx || !this.image || !this.words) return
    paintIndexed(pixels, this.lut, this.words)
    this.ctx.putImageData(this.image, 0, 0)
  }

  /**
   * A speedometer and a trip clock, which is what a car has.
   *
   * On foot it is a clock and an odometer, and how long has been spent
   * standing at a kerb. Every one of those is a measurement of something the
   * player did. None of them is an opinion about it.
   */
  private renderHud(): void {
    const hud = document.getElementById('fphud')
    if (!hud) return
    if (this.mode === 'drive' && this.drive && this.driveWorld) {
      const mph = this.drive.speedFps / MPH_TO_FPS
      const miles = (this.drive.stationFt - 40) / 5280
      hud.innerHTML = `
        <div class="dial"><b>${mph.toFixed(0)}</b><span>mph</span></div>
        <div class="dial"><b>${clock(this.drive.elapsedSec)}</b><span>elapsed</span></div>
        <div class="dial"><b>${miles.toFixed(2)}</b><span>miles</span></div>
        <div class="dial"><b>${clock(this.drive.stoppedSec)}</b><span>stopped</span></div>
        ${this.drive.ended === 'closed'
          ? '<div class="note">Road closed ahead. No through traffic.</div>'
          : this.drive.ended === 'arrived' ? '<div class="note">East end of the corridor.</div>' : ''}`
      return
    }
    if (this.walk && this.walkWorld) {
      const miles = this.walk.distanceFt / 5280
      const detour = detourFt(this.walkWorld, this.walk.stationFt)
      hud.innerHTML = `
        <div class="dial"><b>${clock(this.walk.elapsedSec)}</b><span>elapsed</span></div>
        <div class="dial"><b>${miles.toFixed(2)}</b><span>miles</span></div>
        <div class="dial"><b>${clock(this.walk.waitedSec)}</b><span>waiting</span></div>
        <div class="dial"><b>${Math.round(detour)}</b><span>ft to a crossing</span></div>
        ${this.walk.phase === 'waiting'
          ? `<div class="note">${this.walk.atCrossing === null
            ? 'Watching for a gap.' : 'Waiting for the signal.'}</div>`
          : ''}`
    }
  }
}

function clock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

export { nearestCrossing, platoonSpeedMph }
