/**
 * Every number in this simulation is a claim about the real world, and every
 * claim carries its source.
 *
 * `defineConstants` keeps the citation attached to the value at the type
 * level, so `C.SOMETHING` is a plain number for arithmetic while
 * `CONSTANT_REGISTRY.SOMETHING` still knows where the number came from. The
 * in-game "Why this number?" panel reads the registry directly, which means a
 * constant physically cannot exist in the model without a source.
 */

export interface Source {
  title: string
  url: string
  year: string
}

/** How much the literature actually agrees. */
export type Confidence =
  /** Multiple independent studies converge; the number is well established. */
  | 'settled'
  /** Broadly accepted, but the exact figure varies by context or market. */
  | 'contextual'
  /** Researchers actively disagree about sign, size, or method. */
  | 'contested'

export interface ConstantSpec {
  /** Human-readable name for the panel. */
  label: string
  /** The value the model actually uses. */
  value: number
  /** Units, spelled out. The single most common source of modelling bugs. */
  unit: string
  /** Honest low end of the plausible range. */
  low: number
  /** Honest high end of the plausible range. */
  high: number
  source: Source
  confidence: Confidence
  /** One or two sentences. If contested, say who disagrees and why. */
  note: string
}

export interface SourcedConstant extends ConstantSpec {
  key: string
}

export type ConstantRegistry = Readonly<Record<string, SourcedConstant>>

export interface DefinedConstants<T extends Record<string, ConstantSpec>> {
  registry: Readonly<{ [K in keyof T]: SourcedConstant }>
  values: Readonly<{ [K in keyof T]: number }>
}

export function defineConstants<T extends Record<string, ConstantSpec>>(specs: T): DefinedConstants<T> {
  const registry = {} as { [K in keyof T]: SourcedConstant }
  const values = {} as { [K in keyof T]: number }
  for (const key of Object.keys(specs) as (keyof T & string)[]) {
    const spec = specs[key]!
    if (spec.low > spec.value || spec.high < spec.value) {
      throw new Error(`Constant ${key}: value ${spec.value} is outside its stated range ${spec.low}..${spec.high}`)
    }
    registry[key] = { key, ...spec }
    values[key] = spec.value
  }
  return { registry: Object.freeze(registry), values: Object.freeze(values) }
}

/** Merge several registries into the flat lookup the UI panel queries. */
export function mergeRegistries(...registries: ConstantRegistry[]): ConstantRegistry {
  const merged: Record<string, SourcedConstant> = {}
  for (const registry of registries) {
    for (const [key, constant] of Object.entries(registry)) {
      if (merged[key]) throw new Error(`Duplicate constant key: ${key}`)
      merged[key] = constant
    }
  }
  return Object.freeze(merged)
}

/** Look up a constant's provenance for the "Why this number?" panel. */
export function explain(registry: ConstantRegistry, key: string): SourcedConstant | undefined {
  return registry[key]
}
