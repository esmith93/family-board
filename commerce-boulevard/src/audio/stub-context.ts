/**
 * A recording stand-in for the Web Audio API.
 *
 * The synthesiser is the one part of the game that cannot run headless, which
 * is exactly why it needs a test: a graph that fails to build, or an oscillator
 * nobody started, or a gain that gets set to NaN and takes the whole mix out,
 * are all silent failures in a browser and obvious ones here.
 *
 * This is not an emulator. It does not produce samples. It records what was
 * created, what was connected to what, and every value written to every
 * parameter, so a test can assert about the shape of the graph and the numbers
 * flowing into it. Nothing in `synth.ts` knows it exists.
 */

export interface ParamWrite {
  method: 'value' | 'setValueAtTime' | 'linearRamp' | 'exponentialRamp' | 'setTarget'
  value: number
  time: number
}

export class StubParam {
  readonly writes: ParamWrite[] = []
  private current = 0

  constructor(readonly owner: StubNode, readonly name: string, initial = 0) {
    this.current = initial
  }

  get value(): number { return this.current }
  set value(next: number) {
    this.current = next
    this.writes.push({ method: 'value', value: next, time: 0 })
  }

  setValueAtTime(value: number, time: number): StubParam {
    this.current = value
    this.writes.push({ method: 'setValueAtTime', value, time })
    return this
  }

  linearRampToValueAtTime(value: number, time: number): StubParam {
    this.current = value
    this.writes.push({ method: 'linearRamp', value, time })
    return this
  }

  exponentialRampToValueAtTime(value: number, time: number): StubParam {
    this.current = value
    this.writes.push({ method: 'exponentialRamp', value, time })
    return this
  }

  setTargetAtTime(value: number, time: number, constant: number): StubParam {
    this.current = value
    this.writes.push({ method: 'setTarget', value, time: time + constant })
    return this
  }

  cancelScheduledValues(): StubParam { return this }
}

export class StubNode {
  readonly outputs: StubNode[] = []
  readonly params = new Map<string, StubParam>()
  buffer: unknown = null
  loop = false
  type = ''
  startedAt: number | null = null
  stoppedAt: number | null = null

  constructor(readonly kind: string, readonly context: StubAudioContext) {}

  param(name: string, initial = 0): StubParam {
    const existing = this.params.get(name)
    if (existing) return existing
    const made = new StubParam(this, name, initial)
    this.params.set(name, made)
    return made
  }

  connect(target: StubNode): StubNode {
    this.outputs.push(target)
    return target
  }

  disconnect(): void { this.outputs.length = 0 }

  start(when = 0): void {
    if (this.startedAt !== null) throw new Error(`${this.kind} started twice`)
    this.startedAt = when
    this.context.started.push(this)
  }

  stop(when = 0): void { this.stoppedAt = when }
}

/** A gain node, exposing `gain` the way the real one does. */
function withParams(node: StubNode, names: [string, number][]): StubNode {
  for (const [name, initial] of names) {
    const param = node.param(name, initial)
    Object.defineProperty(node, name, { value: param, enumerable: true })
  }
  return node
}

export class StubAudioContext {
  currentTime = 0
  readonly sampleRate = 48000
  readonly nodes: StubNode[] = []
  readonly started: StubNode[] = []
  readonly destination: StubNode

  constructor() {
    this.destination = this.track(new StubNode('destination', this))
  }

  private track(node: StubNode): StubNode {
    this.nodes.push(node)
    return node
  }

  createGain(): StubNode {
    return this.track(withParams(new StubNode('gain', this), [['gain', 1]]))
  }

  createBiquadFilter(): StubNode {
    return this.track(withParams(new StubNode('biquad', this),
      [['frequency', 350], ['Q', 1], ['gain', 0], ['detune', 0]]))
  }

  createOscillator(): StubNode {
    return this.track(withParams(new StubNode('oscillator', this),
      [['frequency', 440], ['detune', 0]]))
  }

  createBufferSource(): StubNode {
    return this.track(withParams(new StubNode('bufferSource', this),
      [['playbackRate', 1], ['detune', 0]]))
  }

  createBuffer(channels: number, length: number, sampleRate: number): {
    length: number
    sampleRate: number
    numberOfChannels: number
    getChannelData: (channel: number) => Float32Array
  } {
    const data = Array.from({ length: channels }, () => new Float32Array(length))
    return {
      length,
      sampleRate,
      numberOfChannels: channels,
      getChannelData: (channel: number) => data[channel]!,
    }
  }

  /** Every node reachable from a starting point, following connections. */
  reachable(from: StubNode): Set<StubNode> {
    const seen = new Set<StubNode>()
    const walk = (node: StubNode): void => {
      if (seen.has(node)) return
      seen.add(node)
      for (const next of node.outputs) walk(next)
    }
    walk(from)
    return seen
  }

  /** Everything that ends up at the destination. */
  connectedToOutput(): Set<StubNode> {
    const out = new Set<StubNode>()
    for (const node of this.nodes) {
      if (this.reachable(node).has(this.destination)) out.add(node)
    }
    return out
  }

  countOf(kind: string): number {
    return this.nodes.filter((n) => n.kind === kind).length
  }

  /** Every number written to any parameter, for a sanity sweep. */
  allWrites(): ParamWrite[] {
    return this.nodes.flatMap((n) => [...n.params.values()].flatMap((p) => p.writes))
  }
}
