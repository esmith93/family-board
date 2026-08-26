/**
 * The corridor, synthesised.
 *
 * No audio files, for the same reason there are no image files: everything the
 * player hears has to be generated from the model, or it is decoration with a
 * volume slider. What comes out of here is filtered noise and two oscillators,
 * driven by levels the noise model computed.
 *
 * The graph, once, at start-up:
 *
 *   noise buffer -> tyre band-pass  -> tyre gain   -\
 *   noise buffer -> engine low-pass -> engine gain --> bed gain -> brightness -> master
 *   oscillator   -> rumble gain ------------------- /
 *
 * and, per event, a short noise burst through a sweeping filter for a vehicle
 * going past, or a pair of quick sine chirps for a bird. Nothing is allocated
 * per frame except events, and events stop existing when they finish.
 *
 * `apply` is the only thing that runs while the game is running, and all it
 * does is ramp a dozen AudioParams toward a Mix. Which means the sound cannot
 * drift away from the simulation: it is the same numbers, exponentiated.
 */

import { passEnvelope, type Mix } from './mix'

/** How fast a level change follows the model. Long enough not to click. */
const RAMP_SEC = 0.35

/** Segments used to trace a pass-by envelope. Enough to be a curve. */
const PASS_SEGMENTS = 14

/** Deterministic noise, so a recording of the game is the same every time. */
function fillNoise(data: Float32Array, seed: number): void {
  let state = (seed | 0) >>> 0 || 1
  for (let i = 0; i < data.length; i++) {
    state ^= state << 13
    state >>>= 0
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    data[i] = (state / 0x1_0000_0000) * 2 - 1
  }
}

export interface SynthOptions {
  /** Seconds of noise to loop. Longer costs memory and sounds less like a loop. */
  noiseSeconds?: number
  seed?: number
}

/**
 * One live graph. Built once, then only ever re-parameterised.
 *
 * Typed against BaseAudioContext rather than AudioContext so the whole thing
 * can be built against a stub in a test and against an OfflineAudioContext if
 * anybody ever wants to render a bar of it to a file.
 */
export class CorridorSynth {
  private readonly ctx: BaseAudioContext
  private readonly noise: AudioBuffer

  readonly master: GainNode
  private readonly brightness: BiquadFilterNode
  private readonly bed: GainNode
  private readonly tyre: GainNode
  private readonly tyreBand: BiquadFilterNode
  private readonly engine: GainNode
  private readonly engineBand: BiquadFilterNode
  private readonly leaves: GainNode
  private readonly leafBand: BiquadFilterNode

  private readonly rumble: GainNode
  private readonly rumbleOsc: OscillatorNode
  private readonly ownTyre: GainNode
  private readonly ownTyreBand: BiquadFilterNode
  private readonly ownEngine: GainNode
  private readonly ownEngineOsc: OscillatorNode

  private readonly sources: AudioBufferSourceNode[] = []
  private started = false
  private nextPassAt = 0
  private nextBirdAt = 0
  private eventSeed = 0x9e3779b9

  constructor(ctx: BaseAudioContext, destination: AudioNode, options: SynthOptions = {}) {
    this.ctx = ctx
    const seconds = options.noiseSeconds ?? 3
    this.noise = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * seconds)), ctx.sampleRate)
    fillNoise(this.noise.getChannelData(0), options.seed ?? 0x5eed)

    this.master = ctx.createGain()
    this.master.gain.value = 0
    this.master.connect(destination)

    // One filter across everything continuous: a closed window, or distance.
    this.brightness = ctx.createBiquadFilter()
    this.brightness.type = 'lowpass'
    this.brightness.frequency.value = 9000
    this.brightness.connect(this.master)

    this.bed = ctx.createGain()
    this.bed.gain.value = 0
    this.bed.connect(this.brightness)

    // Tyres: a broad band around a kilohertz, which is where they live.
    this.tyreBand = ctx.createBiquadFilter()
    this.tyreBand.type = 'bandpass'
    this.tyreBand.frequency.value = 1000
    this.tyreBand.Q.value = 0.6
    this.tyre = ctx.createGain()
    this.tyre.gain.value = 0
    this.tyreBand.connect(this.tyre)
    this.tyre.connect(this.bed)
    this.sources.push(this.loop(this.tyreBand))

    // Engines: everything under a couple of hundred hertz.
    this.engineBand = ctx.createBiquadFilter()
    this.engineBand.type = 'lowpass'
    this.engineBand.frequency.value = 200
    this.engineBand.Q.value = 0.9
    this.engine = ctx.createGain()
    this.engine.gain.value = 0
    this.engineBand.connect(this.engine)
    this.engine.connect(this.bed)
    this.sources.push(this.loop(this.engineBand))

    // Leaves, which are a high hiss and nothing else.
    this.leafBand = ctx.createBiquadFilter()
    this.leafBand.type = 'highpass'
    this.leafBand.frequency.value = 2600
    this.leaves = ctx.createGain()
    this.leaves.gain.value = 0
    this.leafBand.connect(this.leaves)
    this.leaves.connect(this.brightness)
    this.sources.push(this.loop(this.leafBand))

    // The surface through the seat: a low sine, because that is what it is.
    this.rumbleOsc = ctx.createOscillator()
    this.rumbleOsc.type = 'triangle'
    this.rumbleOsc.frequency.value = 45
    this.rumble = ctx.createGain()
    this.rumble.gain.value = 0
    this.rumbleOsc.connect(this.rumble)
    this.rumble.connect(this.master)

    // Your own car, which is not attenuated by your own windows.
    this.ownTyreBand = ctx.createBiquadFilter()
    this.ownTyreBand.type = 'bandpass'
    this.ownTyreBand.frequency.value = 700
    this.ownTyreBand.Q.value = 0.5
    this.ownTyre = ctx.createGain()
    this.ownTyre.gain.value = 0
    this.ownTyreBand.connect(this.ownTyre)
    this.ownTyre.connect(this.master)
    this.sources.push(this.loop(this.ownTyreBand))

    this.ownEngineOsc = ctx.createOscillator()
    this.ownEngineOsc.type = 'sawtooth'
    this.ownEngineOsc.frequency.value = 70
    this.ownEngine = ctx.createGain()
    this.ownEngine.gain.value = 0
    this.ownEngineOsc.connect(this.ownEngine)
    this.ownEngine.connect(this.master)
  }

  private loop(into: AudioNode): AudioBufferSourceNode {
    const source = this.ctx.createBufferSource()
    source.buffer = this.noise
    source.loop = true
    source.connect(into)
    return source
  }

  /** Start the continuous half. Everything is at zero gain until `apply`. */
  start(): void {
    if (this.started) return
    this.started = true
    const now = this.ctx.currentTime
    for (const source of this.sources) source.start(now)
    this.rumbleOsc.start(now)
    this.ownEngineOsc.start(now)
    this.nextPassAt = now
    this.nextBirdAt = now
  }

  /** Overall level, for the mute control and for fading between views. */
  setMaster(gain: number, seconds = 0.25): void {
    ramp(this.master.gain, gain, this.ctx.currentTime, seconds)
  }

  /**
   * Point the graph at a mix.
   *
   * Called a few times a second rather than every frame: these are levels, and
   * levels do not change at sixty hertz. `lookaheadSec` is how far ahead the
   * event schedulers are allowed to place things, so a pass that should happen
   * between two calls still happens.
   */
  apply(mix: Mix, lookaheadSec = 0.5): void {
    const now = this.ctx.currentTime
    const at = (param: AudioParam, value: number): void => ramp(param, value, now, RAMP_SEC)

    at(this.bed.gain, clampGain(mix.bed.gain))
    at(this.tyre.gain, clampGain(mix.bed.tyreGain / Math.max(1e-4, mix.bed.gain)))
    at(this.engine.gain, clampGain(mix.bed.engineGain / Math.max(1e-4, mix.bed.gain)))
    at(this.tyreBand.frequency, clampHz(mix.bed.tyreHz))
    at(this.engineBand.frequency, clampHz(mix.bed.engineHz * 2.6))
    at(this.brightness.frequency, clampHz(mix.bed.brightnessHz))
    at(this.leaves.gain, clampGain(mix.leafGain))

    at(this.rumble.gain, clampGain(mix.rumbleGain))
    if (mix.rumbleHz > 0) at(this.rumbleOsc.frequency, clampHz(mix.rumbleHz))
    at(this.ownTyre.gain, clampGain(mix.ownTyreGain))
    at(this.ownTyreBand.frequency, clampHz(mix.bed.tyreHz * 0.7))
    at(this.ownEngine.gain, clampGain(mix.ownEngineGain * 0.5))
    if (mix.ownEngineHz > 0) at(this.ownEngineOsc.frequency, clampHz(mix.ownEngineHz))

    if (!this.started) return
    this.scheduleEvents(mix, now, now + lookaheadSec)
  }

  /**
   * Put the countable things on the clock.
   *
   * Passes and birds are scheduled ahead rather than fired on the frame that
   * noticed them, because a vehicle going past at an interval decided by a
   * frame rate sounds like a frame rate.
   */
  private scheduleEvents(mix: Mix, now: number, until: number): void {
    if (this.nextPassAt < now) this.nextPassAt = now
    if (this.nextBirdAt < now) this.nextBirdAt = now

    if (mix.passes.perSecond > 0 && mix.passes.gain > 0) {
      const mean = 1 / mix.passes.perSecond
      while (this.nextPassAt < until) {
        this.vehiclePass(this.nextPassAt, mix)
        // Exponential gaps, because arrivals are Poisson and evenly spaced
        // vehicles sound like a metronome.
        this.nextPassAt += mean * (0.35 + 1.3 * this.random())
      }
    } else {
      this.nextPassAt = until
    }

    if (mix.birdsPerMin > 0) {
      const mean = 60 / mix.birdsPerMin
      while (this.nextBirdAt < until) {
        this.bird(this.nextBirdAt)
        this.nextBirdAt += mean * (0.4 + 1.2 * this.random())
      }
    } else {
      this.nextBirdAt = until
    }
  }

  /**
   * One vehicle going past.
   *
   * A burst of noise whose filter sweeps down as it passes, which is most of
   * what a Doppler shift sounds like when the source is broadband. Its length
   * is how long it takes to go by, so a fast one is a snap and a slow one is a
   * swell.
   */
  private vehiclePass(when: number, mix: Mix): void {
    const duration = mix.passes.durationSec
    const source = this.ctx.createBufferSource()
    source.buffer = this.noise
    source.loop = true
    const band = this.ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.Q.value = 0.8
    const gain = this.ctx.createGain()
    source.connect(band)
    band.connect(gain)
    gain.connect(this.master)

    const top = Math.max(0.0002, mix.passes.gain)
    const centre = clampHz(mix.bed.tyreHz * 1.25)

    /*
     * The envelope is drawn from the distance law rather than sketched, in
     * enough segments to follow it: a broad hump with long shoulders, which is
     * what a vehicle going past sounds like and what the mix sized the peak
     * against. Two exponential ramps - the obvious thing - carry a twentieth
     * of the energy and sound like a whip.
     */
    gain.gain.setValueAtTime(top * passEnvelope(0), when)
    band.frequency.setValueAtTime(centre * 1.16, when)
    for (let i = 1; i <= PASS_SEGMENTS; i++) {
      const t = i / PASS_SEGMENTS
      const at = when + duration * t
      gain.gain.linearRampToValueAtTime(Math.max(0.0001, top * passEnvelope(t)), at)
      // Approaching, the spectrum is compressed upward; going away, downward.
      band.frequency.linearRampToValueAtTime(centre * (1.16 - 0.44 * t), at)
    }
    gain.gain.linearRampToValueAtTime(0.0001, when + duration + 0.03)

    source.start(when)
    source.stop(when + duration + 0.08)
  }

  /** Two or three notes, which is a bird from across a street. */
  private bird(when: number): void {
    const base = 2100 + this.random() * 1800
    const notes = 2 + Math.floor(this.random() * 2)
    for (let i = 0; i < notes; i++) {
      const osc = this.ctx.createOscillator()
      osc.type = 'sine'
      const gain = this.ctx.createGain()
      osc.connect(gain)
      gain.connect(this.master)
      const at = when + i * 0.11
      const hz = base * (0.85 + this.random() * 0.4)
      osc.frequency.setValueAtTime(hz, at)
      osc.frequency.exponentialRampToValueAtTime(hz * (1.12 + this.random() * 0.3), at + 0.06)
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(0.035, at + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.085)
      osc.start(at)
      osc.stop(at + 0.13)
    }
  }

  /** Deterministic, so two runs of the same corridor sound the same. */
  private random(): number {
    let h = this.eventSeed
    h ^= h << 13
    h >>>= 0
    h ^= h >>> 17
    h ^= h << 5
    h >>>= 0
    this.eventSeed = h
    return h / 0x1_0000_0000
  }
}

function clampGain(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
}

function clampHz(value: number): number {
  return Number.isFinite(value) ? Math.max(20, Math.min(18000, value)) : 20
}

/**
 * Move a parameter without clicking.
 *
 * `setTargetAtTime` rather than a linear ramp: levels in a room settle
 * exponentially, and a linear ramp between two loudnesses does not sound like
 * one thing becoming another.
 */
function ramp(param: AudioParam, value: number, now: number, seconds: number): void {
  param.setTargetAtTime(value, now, Math.max(0.01, seconds / 3))
}
