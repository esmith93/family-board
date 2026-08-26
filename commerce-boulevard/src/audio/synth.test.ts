/**
 * Tests for the synthesiser.
 *
 * The graph cannot be heard from here, so what is checked instead is the
 * shape of it and the numbers going into it: everything reaches the output,
 * everything that has to be started is started once, no parameter is ever
 * written a value that would take the whole mix out, and the levels track the
 * mix rather than wandering off on their own.
 *
 * Every one of those is a silent failure in a browser.
 */

import { describe, expect, it } from 'vitest'

import { advanceYear, newGame, type SimState } from '../sim/index'
import { buildWalkWorld } from '../render/walk'
import { buildDriveWorld, newDrive } from '../render/drive'
import { cabinMix, kerbMix, officeMix } from './mix'
import { CorridorSynth } from './synth'
import { StubAudioContext, type StubNode } from './stub-context'

function play(seed: string, years: number, plan: Record<number, string[]> = {}): SimState {
  let state = newGame(seed)
  for (let i = 0; i < years && !state.ended; i++) state = advanceYear(state, plan[state.year] ?? []).state
  return state
}

/** Build a synth on a stub, with the context typed the way synth.ts wants it. */
function makeSynth(): { ctx: StubAudioContext; synth: CorridorSynth } {
  const ctx = new StubAudioContext()
  const synth = new CorridorSynth(
    ctx as unknown as BaseAudioContext,
    ctx.destination as unknown as AudioNode,
  )
  return { ctx, synth }
}

const paramOf = (node: StubNode, name: string): number =>
  node.params.get(name)?.value ?? Number.NaN

describe('the graph', () => {
  it('builds without a browser', () => {
    const { ctx } = makeSynth()
    expect(ctx.countOf('gain')).toBeGreaterThan(4)
    expect(ctx.countOf('biquad')).toBeGreaterThan(3)
    expect(ctx.countOf('oscillator')).toBe(2)
    expect(ctx.countOf('bufferSource')).toBeGreaterThanOrEqual(4)
  })

  it('lands everything at the output, with nothing left dangling', () => {
    const { ctx } = makeSynth()
    const connected = ctx.connectedToOutput()
    for (const node of ctx.nodes) {
      if (node === ctx.destination) continue
      expect(connected.has(node), `${node.kind} goes nowhere`).toBe(true)
    }
  })

  it('starts silent, so nothing barks when the context resumes', () => {
    const { ctx, synth } = makeSynth()
    void synth
    const master = ctx.nodes.find((n) => n.kind === 'gain' && n.outputs.includes(ctx.destination))
    expect(master).toBeDefined()
    expect(paramOf(master!, 'gain')).toBe(0)
  })

  it('starts every source exactly once, however many times it is asked', () => {
    const { ctx, synth } = makeSynth()
    synth.start()
    synth.start()
    synth.start()
    const startable = ctx.nodes.filter((n) => n.kind === 'bufferSource' || n.kind === 'oscillator')
    // The continuous ones. Event sources are created later and are not in this set.
    for (const node of startable) expect(node.startedAt).not.toBeNull()
    expect(ctx.started.length).toBe(startable.length)
  })

  it('loops its noise rather than playing it once and stopping', () => {
    const { ctx, synth } = makeSynth()
    synth.start()
    for (const node of ctx.nodes.filter((n) => n.kind === 'bufferSource')) {
      expect(node.loop).toBe(true)
      expect(node.buffer).not.toBeNull()
    }
  })
})

describe('the numbers going in', () => {
  it('never writes anything that would take the mix out', () => {
    const { ctx, synth } = makeSynth()
    synth.start()
    for (const seed of ['a', 'b', 'lose']) {
      for (const years of [0, 7, 18, 29]) {
        const state = play(seed, years)
        const world = buildDriveWorld(state)
        ctx.currentTime += 1
        synth.apply(officeMix(state))
        ctx.currentTime += 1
        synth.apply(kerbMix(buildWalkWorld(state)))
        ctx.currentTime += 1
        synth.apply(cabinMix(world, newDrive(world)))
      }
    }
    for (const write of ctx.allWrites()) {
      expect(Number.isFinite(write.value), `wrote ${write.value}`).toBe(true)
      // Exponential ramps to zero are illegal in Web Audio and throw at runtime.
      if (write.method === 'exponentialRamp') expect(write.value).not.toBe(0)
    }
  })

  it('keeps every frequency inside what a filter will accept', () => {
    const { ctx, synth } = makeSynth()
    synth.start()
    for (const years of [0, 12, 26]) {
      ctx.currentTime += 1
      synth.apply(kerbMix(buildWalkWorld(play('a', years))))
    }
    for (const node of ctx.nodes.filter((n) => n.kind === 'biquad' || n.kind === 'oscillator')) {
      for (const write of node.params.get('frequency')?.writes ?? []) {
        expect(write.value).toBeGreaterThanOrEqual(20)
        expect(write.value).toBeLessThanOrEqual(18000)
      }
    }
  })

  it('keeps every gain between silence and full scale', () => {
    const { ctx, synth } = makeSynth()
    synth.start()
    ctx.currentTime += 1
    synth.apply(kerbMix(buildWalkWorld(newGame('a'))))
    for (const node of ctx.nodes.filter((n) => n.kind === 'gain')) {
      for (const write of node.params.get('gain')?.writes ?? []) {
        expect(write.value).toBeGreaterThanOrEqual(0)
        expect(write.value).toBeLessThanOrEqual(1)
      }
    }
  })

  it('follows the mix down when the corridor gets quieter', () => {
    const { ctx, synth } = makeSynth()
    synth.start()
    // The bed is the gain node that feeds the one filter that feeds the master:
    // found by its shape rather than by adding a hook to the real code.
    const master = ctx.nodes.find((n) => n.outputs.includes(ctx.destination))!
    const brightness = ctx.nodes.find((n) => n.kind === 'biquad' && n.outputs.includes(master))!
    const bed = ctx.nodes.find((n) => n.kind === 'gain' && n.outputs.length === 1
      && n.outputs[0] === brightness && n !== master)!

    const bedGainOf = (state: SimState): number => {
      ctx.currentTime += 2
      synth.apply(kerbMix(buildWalkWorld(state)))
      return bed.params.get('gain')!.value
    }
    const loud = bedGainOf(newGame('a'))
    const quiet = bedGainOf(play('a', 22, {
      7: ['capital.road_diet'], 9: ['street.add_kerb_parking'],
      12: ['street.lower_target_speed'], 14: ['street.narrow_lanes'],
    }))
    expect(quiet).toBeLessThan(loud)
    expect(quiet).toBeGreaterThan(0)
  })
})

describe('events', () => {
  it('schedules vehicles going past on a street with traffic on it', () => {
    const { ctx, synth } = makeSynth()
    synth.start()
    const before = ctx.countOf('bufferSource')
    ctx.currentTime += 1
    synth.apply(kerbMix(buildWalkWorld(newGame('a'))), 6)
    expect(ctx.countOf('bufferSource')).toBeGreaterThan(before)
  })

  it('spaces them unevenly, because arrivals are not a metronome', () => {
    const { ctx, synth } = makeSynth()
    synth.start()
    ctx.currentTime += 1
    synth.apply(kerbMix(buildWalkWorld(newGame('a'))), 40)
    const starts = ctx.nodes
      .filter((n) => n.kind === 'bufferSource' && n.stoppedAt !== null)
      .map((n) => n.startedAt!)
      .sort((a, b) => a - b)
    expect(starts.length).toBeGreaterThan(4)
    const gaps = starts.slice(1).map((s, i) => s - starts[i]!)
    const spread = Math.max(...gaps) / Math.max(1e-6, Math.min(...gaps))
    expect(spread).toBeGreaterThan(1.6)
  })

  it('stops every event source it starts, so nothing accumulates forever', () => {
    const { ctx, synth } = makeSynth()
    synth.start()
    ctx.currentTime += 1
    synth.apply(kerbMix(buildWalkWorld(newGame('a'))), 20)
    for (const node of ctx.nodes.filter((n) => n.kind === 'bufferSource' && n.stoppedAt !== null)) {
      expect(node.stoppedAt!).toBeGreaterThan(node.startedAt!)
    }
  })

  it('puts no birds on a corridor that has none', () => {
    const { ctx, synth } = makeSynth()
    synth.start()
    const before = ctx.countOf('oscillator')
    ctx.currentTime += 1
    synth.apply(kerbMix(buildWalkWorld(newGame('a'))), 30)
    // Two oscillators are the rumble and the engine; a bird would be a third.
    expect(ctx.countOf('oscillator')).toBe(before)
  })

  it('puts birds on one that has earned them', () => {
    const { ctx, synth } = makeSynth()
    synth.start()
    const world = buildWalkWorld(newGame('a'))
    const before = ctx.countOf('oscillator')
    ctx.currentTime += 1
    synth.apply(kerbMix({ ...world, canopy: 0.3, noiseDba: 56 }), 30)
    expect(ctx.countOf('oscillator')).toBeGreaterThan(before)
  })

  it('never schedules an event in the past', () => {
    const { ctx, synth } = makeSynth()
    synth.start()
    ctx.currentTime = 40
    synth.apply(kerbMix(buildWalkWorld(newGame('a'))), 5)
    for (const node of ctx.started) {
      if (node.stoppedAt === null) continue
      expect(node.startedAt!).toBeGreaterThanOrEqual(40)
    }
  })

  it('is deterministic', () => {
    const timings = (): number[] => {
      const { ctx, synth } = makeSynth()
      synth.start()
      ctx.currentTime += 1
      synth.apply(kerbMix(buildWalkWorld(play('same', 10))), 25)
      return ctx.nodes.filter((n) => n.stoppedAt !== null).map((n) => n.startedAt!)
    }
    expect(timings()).toEqual(timings())
  })
})

describe('the master', () => {
  it('is what the mute control moves, and nothing else', () => {
    const { ctx, synth } = makeSynth()
    const master = ctx.nodes.find((n) => n.outputs.includes(ctx.destination))!
    synth.setMaster(0.6)
    expect(master.params.get('gain')!.value).toBeCloseTo(0.6, 6)
    synth.setMaster(0)
    expect(master.params.get('gain')!.value).toBe(0)
  })
})
