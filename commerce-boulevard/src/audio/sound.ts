/**
 * The one thing in the game that owns an AudioContext.
 *
 * Browsers will not start audio until somebody has clicked something, which is
 * the right rule and means the context cannot be created up front. So this
 * holds a context that may not exist yet, remembers what should be sounding,
 * and starts making it the moment the player does anything at all.
 *
 * It also owns the preference. Sound is on by default and one key turns it
 * off, because a game about noise that will not shut up is a poor joke.
 */

import { CorridorSynth } from './synth'
import { cabinMix, kerbMix, officeMix, type Mix, type Vantage } from './mix'
import type { SimState } from '../sim/index'
import type { DriveState, DriveWorld } from '../render/drive'
import type { WalkState, WalkWorld } from '../render/walk'

const STORAGE_KEY = 'commerce-blvd-sound'

/** How often the mix is pushed at the graph. Levels are not a frame rate. */
const UPDATE_MS = 220

/** Master level per vantage. The office is background; the street is not. */
const VANTAGE_GAIN: Readonly<Record<Vantage, number>> = Object.freeze({
  office: 0.42,
  kerb: 0.95,
  cabin: 0.95,
})

type ContextClass = { new (): AudioContext }

export class Sound {
  private ctx: AudioContext | null = null
  private synth: CorridorSynth | null = null
  private timer: number | null = null
  private next: Mix | null = null
  private enabled: boolean
  private failed = false

  constructor() {
    this.enabled = readPreference()
  }

  get isOn(): boolean { return this.enabled && !this.failed }
  /** True once a browser has actually let us make a noise. */
  get isRunning(): boolean { return this.ctx !== null && this.ctx.state === 'running' }

  /**
   * Called from any click or key. Cheap and idempotent after the first time.
   *
   * The context is created here rather than in the constructor because a
   * context created before a gesture starts suspended and stays that way, and
   * a game that needs its own settings menu to make a sound has already lost.
   */
  unlock(): void {
    if (!this.enabled || this.failed) return
    if (!this.ctx) {
      const Ctor = (window.AudioContext
        ?? (window as unknown as { webkitAudioContext?: ContextClass }).webkitAudioContext) as
        ContextClass | undefined
      if (!Ctor) { this.failed = true; return }
      try {
        this.ctx = new Ctor()
        this.synth = new CorridorSynth(this.ctx, this.ctx.destination)
        this.synth.start()
      } catch {
        // No audio available. The game is not about the audio.
        this.failed = true
        this.ctx = null
        this.synth = null
        return
      }
    }
    void this.ctx.resume().catch(() => { this.failed = true })
    if (this.timer === null) {
      this.timer = window.setInterval(() => this.push(), UPDATE_MS)
      this.push()
    }
  }

  /** What should be sounding. Called whenever the state or the view changes. */
  set(mix: Mix): void {
    this.next = mix
    if (this.isRunning) this.push()
  }

  atDesk(state: SimState): void { this.set(officeMix(state)) }
  atKerb(world: WalkWorld, walk: WalkState): void { this.set(kerbMix(world, walk)) }
  inCar(world: DriveWorld, drive: DriveState): void { this.set(cabinMix(world, drive)) }

  toggle(): boolean {
    this.enabled = !this.enabled
    writePreference(this.enabled)
    if (!this.enabled) this.synth?.setMaster(0, 0.25)
    else { this.unlock(); this.push() }
    return this.enabled
  }

  /** Fade out without tearing the graph down, for the newspaper and the endings. */
  hush(on: boolean): void {
    if (!this.synth) return
    this.synth.setMaster(on ? 0 : this.targetGain(), 0.4)
  }

  private targetGain(): number {
    if (!this.enabled) return 0
    return VANTAGE_GAIN[this.next?.vantage ?? 'office']
  }

  private push(): void {
    if (!this.synth || !this.next || !this.enabled) return
    this.synth.setMaster(this.targetGain(), 0.4)
    this.synth.apply(this.next, (UPDATE_MS / 1000) * 1.6)
  }
}

function readPreference(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== 'off'
  } catch {
    return true
  }
}

function writePreference(on: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off')
  } catch {
    // A browser that will not remember it will simply ask again next time.
  }
}
