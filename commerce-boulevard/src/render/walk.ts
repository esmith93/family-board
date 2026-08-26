/**
 * The view from the pavement.
 *
 * The same street and the same ray caster as the drive view, turned ninety
 * degrees: you stand on the footway facing the carriageway, and walking along
 * the corridor scrolls the world sideways past you. That is a side-scroll with
 * real perspective in it rather than a stack of parallax layers, and it means
 * the tree you drove past at forty is the tree you are standing under.
 *
 * What this view is FOR is the half of the corridor a windscreen cannot show
 * you: how far it is to somewhere you are allowed to cross, how long you stand
 * there once you get there, how much of the frontage is a car park, whether
 * there is any shade, and what six lanes of traffic feels like from four feet
 * away. None of that is narrated. It is just how long things take.
 *
 * No DOM. The renderer writes palette indices into a byte buffer.
 */

import {
  buildPlan, castRay, CELL_FT, GROUND_INK, Ground, inStallBand, Solid,
  type Hit, type Plan,
} from './firstperson'
import { corridorModel, walkToCrossing, type CorridorModel, type Side } from './corridor'
import { P } from './palette'
import {
  C, distanceToNearestLaneFt, effectiveGreenRatio, levelOfTrafficStress, operatingSpeedMph,
  segmentOf, type SimState,
} from '../sim/index'

const MPH_TO_FPS = 5280 / 3600
/**
 * Where the camera stands.
 *
 * Facing across the street at exactly eye height from exactly where the
 * walker's eyes are is geometrically honest and makes a terrible picture: the
 * street tree you are passing is eighteen inches away and fills the frame, and
 * the far side of a ninety-foot road is a band four pixels tall at the
 * horizon. So the camera stands a few feet back off the walker's shoulder and
 * a little above their head, which is the oldest trick in the side-scroller
 * and changes nothing about what is in the shot.
 */
const EYE_HEIGHT_FT = 5.4
const CAMERA_BACK_FT = 0
/**
 * How far round from the corridor axis the camera looks, in radians.
 *
 * Not ninety degrees. Square on to the carriageway the footway you are
 * standing on is not in the shot at all and the frame is a wall of asphalt.
 * Turned to about two thirds of a right angle, the kerb runs away down one
 * side, the traffic crosses in front of you, and the far frontage sits where
 * you would actually be looking at it. Which is also roughly where a person
 * walking somewhere looks: mostly ahead, mostly at the traffic.
 *
 * And the far side stays small, because it is ninety feet away. That is not a
 * defect of the camera.
 */
const TURN = 1.16
/** A person walks at three miles an hour, and this game does not speed that up. */
const WALK_FPS = 4.4
const FOV = 0.92
export const WALK_VIEW_FT = 900

// --- The world on foot -------------------------------------------------------

export interface WalkWorld {
  plan: Plan
  model: CorridorModel
  /** The speed the traffic runs at, which is what you hear and feel. */
  trafficSpeedMph: number
  aadt: number
  /** Seconds of the cycle the boulevard gets, and so how long you wait to cross. */
  greenRatio: number
  cycleSec: number
  /** How unpleasant the kerb is on a scale nobody in the game ever sees. */
  trafficStress: number
  noiseDba: number
  canopy: number
  year: number
  /** Years of deferred resurfacing, which a street can be heard to have. */
  pavementAgeYears: number
  /** Feet from where you stand to the middle of the nearest running lane. */
  nearestLaneFt: number
  /** The vehicles-per-second stream, for gap acceptance. */
  flowPerLaneSec: number
  laneCount: number
  /** True if a raised or planted median gives you somewhere to stand halfway. */
  hasRefuge: boolean
}

export function buildWalkWorld(state: SimState): WalkWorld {
  const model = corridorModel(state)
  const street = state.street
  const speed = operatingSpeedMph(street, state.parcels)
  const lanes = model.bands.filter((b) => b.direction !== 0).length

  // Peak-hour flow, split evenly over the running lanes. Ten per cent of the
  // day's traffic in the peak hour is the usual rule for an arterial.
  const peakHour = state.traffic.aadt * C.PEAK_HOUR_SHARE_OF_AADT
  return {
    plan: buildPlan(model),
    model,
    trafficSpeedMph: speed,
    aadt: state.traffic.aadt,
    greenRatio: effectiveGreenRatio(street),
    cycleSec: street.signalCycleSec,
    trafficStress: levelOfTrafficStress(street, speed),
    noiseDba: state.environment.sidewalkNoiseDba,
    canopy: state.environment.canopyFraction,
    year: state.year,
    pavementAgeYears: street.pavementAgeYears,
    nearestLaneFt: distanceToNearestLaneFt(street),
    flowPerLaneSec: lanes > 0 ? peakHour / lanes / 3600 : 0,
    laneCount: Math.max(1, lanes),
    hasRefuge: street.median === 'raised' || street.median === 'landscaped',
  }
}

// --- Walking -----------------------------------------------------------------

export interface WalkInput {
  /** -1 west, +1 east. */
  along: number
  /** True while the player is trying to get to the other side. */
  cross: boolean
}

export type WalkPhase = 'walking' | 'waiting' | 'crossing'

export interface WalkState {
  stationFt: number
  side: Side
  /** Feet from the north kerb. Only moves while crossing. */
  acrossFt: number
  phase: WalkPhase
  elapsedSec: number
  /** Seconds spent standing at a kerb waiting for a chance to cross. */
  waitedSec: number
  distanceFt: number
  /** How many times the player has got to the other side. */
  crossings: number
  /** Set while a gap is being refused, so the view can hold the player back. */
  blocked: boolean
  /** Bob of the head, in feet, from walking. */
  bobFt: number
  /** Which crossing the player is standing at, if any. */
  atCrossing: number | null
}

/**
 * Where on the footway a person actually walks.
 *
 * Not the middle. On a corridor whose building side is a blank wall behind a
 * car park there is nothing to walk beside, so people walk near the kerb - and
 * near the kerb is where the traffic is.
 */
function kerbWalkLine(model: CorridorModel, side: Side): number {
  const inset = Math.min(2.2, model.sidewalkWidthFt * 0.42)
  return side === 'north' ? -inset : model.roadWidthFt + inset
}

export function newWalk(world: WalkWorld): WalkState {
  return {
    stationFt: 60,
    side: 'south',
    acrossFt: kerbWalkLine(world.model, 'south'),
    phase: 'walking',
    elapsedSec: 0,
    waitedSec: 0,
    distanceFt: 0,
    crossings: 0,
    blocked: false,
    bobFt: 0,
    atCrossing: null,
  }
}

/** The nearest place it is legal to cross, and how far away it is. */
export function nearestCrossing(world: WalkWorld, stationFt: number): { index: number; distFt: number } {
  let best = -1
  let bestDist = Infinity
  for (let i = 0; i < world.model.crossings.length; i++) {
    const dist = Math.abs(world.model.crossings[i]!.stationFt - stationFt)
    if (dist < bestDist) { bestDist = dist; best = i }
  }
  return { index: best, distFt: bestDist }
}

/**
 * The pedestrian phase.
 *
 * A crossing gets what is left of the cycle after the boulevard has taken its
 * share, and the boulevard's share is set by the signal policy. Which is the
 * trade laid bare: the same slider that lets the player sail through five
 * junctions in a car is the one that leaves them standing here.
 */
export function walkIsGreen(world: WalkWorld, index: number, atSec: number): boolean {
  const cycle = world.cycleSec
  const offset = (index * cycle * 0.37) % cycle
  const phase = (((atSec - offset) % cycle) + cycle) % cycle
  // The walk signal runs while the boulevard is stopped, less the clearance
  // interval nobody is allowed to start in.
  const walkStart = cycle * world.greenRatio + 4
  return phase >= walkStart && phase < cycle - 4
}

/**
 * Whether there is a gap big enough to walk into.
 *
 * Not a die roll dressed as physics. Headways in a traffic stream are roughly
 * exponential, so the chance that a gap of at least the time you need is open
 * right now is exp(-flow x that time). You need one in the near half of the
 * road to reach the middle and another in the far half to finish, and without
 * anywhere to stand in between you need both at once - which is why a raised
 * or planted median is not decoration, it is the difference between one
 * unlikely thing and two unlikely things happening together.
 *
 * On six lanes at the peak the answer is about one chance in a million per
 * second, which is the correct answer: nobody crosses this road here. On two
 * lanes carrying half as much it comes out around a minute's wait.
 */
export function gapChancePerSecond(world: WalkWorld): number {
  const halfWidthFt = world.model.roadWidthFt / 2
  // Walking pace, plus the couple of seconds it takes to decide and start.
  const criticalSec = halfWidthFt / 3.5 + 2
  const perDirectionSec = (world.aadt * 0.1) / 2 / 3600
  const half = Math.exp(-perDirectionSec * criticalSec)
  return world.hasRefuge ? half : half * half
}

/** A tiny deterministic hash, so the same gap turns up at the same moment. */
function hash01(a: number, b: number): number {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1)
  h ^= h >>> 15
  h = Math.imul(h, 0x2545f491)
  h ^= h >>> 13
  return (h >>> 0) / 0x1_0000_0000
}

export function stepWalk(
  world: WalkWorld, state: WalkState, input: WalkInput, dtSec: number,
): WalkState {
  const next: WalkState = { ...state }
  const dt = Math.max(0, Math.min(0.1, dtSec))
  next.elapsedSec = state.elapsedSec + dt

  const nearKerb = state.side === 'north' ? 0 : world.model.roadWidthFt
  const farKerb = state.side === 'north' ? world.model.roadWidthFt : 0
  const crossing = nearestCrossing(world, state.stationFt)
  const atMarked = crossing.distFt < 14
  next.atCrossing = atMarked ? crossing.index : null

  if (state.phase === 'crossing') {
    // Once you are out there you keep going, and nothing stops for you.
    const direction = Math.sign(farKerb - state.acrossFt) || 1
    next.acrossFt = state.acrossFt + direction * 3.5 * dt
    if ((direction > 0 && next.acrossFt >= farKerb) || (direction < 0 && next.acrossFt <= farKerb)) {
      next.side = state.side === 'north' ? 'south' : 'north'
      next.acrossFt = kerbWalkLine(world.model, next.side)
      next.phase = 'walking'
      next.crossings = state.crossings + 1
    }
    return next
  }

  if (input.cross) {
    const signalised = atMarked && (world.model.crossings[crossing.index]?.signalised ?? false)
    if (signalised) {
      // Wait for the man. It is a long cycle and this is most of it.
      if (walkIsGreen(world, crossing.index, state.elapsedSec)) {
        next.phase = 'crossing'
        next.acrossFt = nearKerb
        next.blocked = false
      } else {
        next.phase = 'waiting'
        next.waitedSec = state.waitedSec + dt
        next.blocked = true
      }
      return next
    }
    /*
     * No signal. You are looking for a gap, and whether one comes is a
     * question about how much traffic there is and how many lanes of it you
     * have to walk across. A raised or planted median lets you take it in two
     * halves, which roughly squares your odds in your favour.
     */
    const chance = gapChancePerSecond(world)
    const roll = hash01(Math.round(state.stationFt), Math.floor(state.elapsedSec * 2) + world.year * 97)
    if (roll < chance) {
      next.phase = 'crossing'
      next.acrossFt = nearKerb
      next.blocked = false
    } else {
      next.phase = 'waiting'
      next.waitedSec = state.waitedSec + dt
      next.blocked = true
    }
    return next
  }

  next.phase = 'walking'
  next.blocked = false
  if (input.along !== 0) {
    const step = input.along * WALK_FPS * dt
    next.stationFt = Math.max(20, Math.min(world.model.lengthFt - 20, state.stationFt + step))
    next.distanceFt = state.distanceFt + Math.abs(next.stationFt - state.stationFt)
    // A head bobs about an inch and a half at walking pace. Enough to feel.
    next.bobFt = Math.sin(next.distanceFt * 0.75) * 0.12
  } else {
    next.bobFt = state.bobFt * 0.9
  }
  return next
}

/** How far this spot is from anywhere you are allowed to cross. */
export function detourFt(world: WalkWorld, stationFt: number): number {
  return walkToCrossing(world.model, stationFt)
}

// --- Drawing -----------------------------------------------------------------

export interface WalkFrame {
  width: number
  height: number
  pixels: Uint8Array
  depth: Float32Array
  horizon: number
}

export function makeWalkFrame(width: number, height: number): WalkFrame {
  return {
    width, height,
    pixels: new Uint8Array(width * height),
    depth: new Float32Array(width),
    horizon: height / 2,
  }
}

const FOG_STEPS = 4
const GRAIN_BUCKETS = 16
const INK_TABLE = new Uint8Array(FOG_STEPS * 16 * GRAIN_BUCKETS)
const NOISE_MASK = 4095
const NOISE = (() => {
  const out = new Uint8Array(NOISE_MASK + 1)
  for (let i = 0; i <= NOISE_MASK; i++) out[i] = Math.floor(hash01(i, 0x9e37) * GRAIN_BUCKETS)
  return out
})()

const WALL_RAMP: Readonly<Record<Solid, readonly number[]>> = Object.freeze({
  [Solid.Open]: [P.skyLow],
  [Solid.Brick]: [P.brickLight, P.brickMid, P.brickDark, P.skyLow],
  [Solid.Stucco]: [P.stuccoLight, P.stuccoMid, P.stuccoDark, P.skyLow],
  [Solid.Concrete]: [P.concreteLight, P.concreteMid, P.concreteDark, P.skyLow],
  [Solid.Glass]: [P.glassMid, P.glassDark, P.concreteDark, P.skyLow],
  [Solid.Fence]: [P.woodMid, P.woodDark, P.shadow, P.skyLow],
})
const ROOF_RAMP = [P.roofLight, P.roofMid, P.roofDark, P.skyLow] as const

function ramp(list: readonly number[], step: number, darker = 0): number {
  return list[Math.min(list.length - 1, step + darker)]!
}

function fogStep(distFt: number, steps: number): number {
  const t = Math.min(0.999, distFt / WALK_VIEW_FT)
  return Math.min(steps - 1, Math.floor(t * t * steps * 1.6))
}

function darkerInk(ink: number): number {
  switch (ink) {
    case P.asphaltMid: return P.asphaltDark
    case P.asphaltWorn: return P.asphaltMid
    case P.concreteLight: return P.concreteMid
    case P.concreteMid: return P.concreteDark
    case P.leafMid: return P.leafDark
    default: return ink
  }
}

function isPaint(kind: Ground): boolean {
  return kind === Ground.LaneLine || kind === Ground.CentreLine
    || kind === Ground.Crosswalk || kind === Ground.LotStripe
}

function grainedInk(kind: Ground, bucket: number): number {
  const base = GROUND_INK[kind]!
  const n = (bucket + 0.5) / GRAIN_BUCKETS
  switch (kind) {
    case Ground.Asphalt:
    case Ground.ParkingBay:
      return n > 0.955 ? P.asphaltLight : n < 0.13 ? P.asphaltDark : base
    case Ground.Lot:
      return n > 0.93 ? P.asphaltMid : n < 0.1 ? P.asphaltDark : base
    case Ground.Pavement:
      return n > 0.93 ? P.concreteMid : n < 0.07 ? P.concreteDark : base
    case Ground.Grass:
      return n > 0.62 ? P.leafDark : n < 0.14 ? P.leafLight : base
    case Ground.Plaza:
      return n > 0.93 ? P.concreteLight : base
    default:
      return base
  }
}

function buildInkTable(): void {
  for (let kind = 0; kind < 16; kind++) {
    const paint = isPaint(kind as Ground)
    for (let bucket = 0; bucket < GRAIN_BUCKETS; bucket++) {
      const near = grainedInk(kind as Ground, bucket)
      for (let fog = 0; fog < FOG_STEPS; fog++) {
        let ink = near
        if (!paint) {
          if (fog >= 3) ink = P.skyLow
          else if (fog === 2) ink = bucket < 8 ? P.skyLow : darkerInk(near)
        }
        INK_TABLE[(fog * 16 + kind) * GRAIN_BUCKETS + bucket] = ink
      }
    }
  }
}
buildInkTable()

/**
 * Draw one frame.
 *
 * The camera faces across the street, so a screen ROW is a fixed distance
 * across the carriageway and the cross-section is a row constant - the
 * transpose of the drive view, where a row was a fixed station along it. What
 * varies along a row here is the station, so the crossings, the driveways and
 * the lane dashes are the per-pixel work instead.
 */
export function renderWalk(world: WalkWorld, state: WalkState, frame: WalkFrame, timeMs = 0): void {
  const { width: w, height: h } = frame
  const plan = world.plan
  const proj = (w / 2) / Math.tan((FOV * Math.PI) / 2)
  // Looking slightly down, the way a person walking does.
  const horizon = Math.round(h * 0.42 - state.bobFt * proj * 0.05)
  frame.horizon = horizon

  const eye = EYE_HEIGHT_FT + state.bobFt
  const view = viewOf(state)

  drawSky(frame, horizon)
  drawGround(plan, world, frame, horizon, proj, eye, view)
  drawWalls(plan, frame, horizon, proj, eye, view)
  drawProps(world, state, frame, horizon, proj, eye, view, timeMs)
}

/** Where the camera is and which way it looks, in corridor coordinates. */
export interface View {
  camX: number
  camY: number
  /** Forward unit vector. */
  fx: number
  fy: number
  /** Right unit vector, for the camera plane. */
  rx: number
  ry: number
  /** +1 if the road is to the camera's south, -1 if to its north. */
  facing: number
}

export function viewOf(state: WalkState): View {
  const facing = state.side === 'north' ? 1 : -1
  // Looking the way you are walking, turned toward the road.
  const along = 1
  const fx = along * Math.cos(TURN)
  const fy = facing * Math.sin(TURN)
  return {
    camX: state.stationFt - fx * CAMERA_BACK_FT,
    camY: state.acrossFt - fy * CAMERA_BACK_FT,
    fx, fy, rx: -fy, ry: fx, facing,
  }
}

/**
 * A four by four ordered dither.
 *
 * Three sky colours over four hundred rows is three bands and two hard edges.
 * Thresholding the blend against this matrix turns the edges into a stipple
 * that reads as a gradient, which is what an indexed renderer has instead of
 * more colours - and what every machine that had a palette did about it.
 */
const BAYER = Uint8Array.from([
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
])

/** Blend two palette entries by ordered dither, at 0..1. */
function ditherPair(a: number, b: number, mix: number, x: number, y: number): number {
  const threshold = (BAYER[(y & 3) * 4 + (x & 3)]! + 0.5) / 16
  return mix > threshold ? b : a
}

/** A gradient in three colours, which is all an indexed palette has. */
function drawSky(frame: WalkFrame, horizon: number): void {
  const { width: w, pixels } = frame
  const top = Math.max(1, horizon)
  // Through the horizon row inclusive: the ground starts one row below it, and
  // a row nobody paints is a row of holes.
  for (let y = 0; y <= Math.min(horizon, frame.height - 1); y++) {
    const t = Math.min(0.9999, y / top)
    const f = t * 2
    const seg = f | 0
    const mix = f - seg
    const a = seg === 0 ? P.skyHigh : P.skyMid
    const b = seg === 0 ? P.skyMid : P.skyLow
    const row = y * w
    for (let x = 0; x < w; x++) pixels[row + x] = ditherPair(a, b, mix, x, y)
  }
}

/**
 * The ground, one screen row at a time.
 *
 * The camera looks across the corridor at an angle, so a row is neither one
 * station nor one point of the cross-section and both have to be worked out
 * per pixel. What IS constant down a row is the distance, and with it the
 * atmosphere and the grain table - which is most of the saving the drive view
 * gets from its rows, so this costs about two milliseconds and not ten.
 */
function drawGround(
  plan: Plan, world: WalkWorld, frame: WalkFrame, horizon: number, proj: number, eye: number,
  view: View,
): void {
  const { width: w, height: h, pixels } = frame
  const crossLen = plan.cross.length
  const shade = shadeSpans(world, view)
  const maskLen = plan.crossingMask.length
  const roadWidth = world.model.roadWidthFt

  for (let y = Math.max(0, horizon + 1); y < h; y++) {
    const rowDist = (eye * proj) / (y - horizon)
    if (rowDist > WALK_VIEW_FT) {
      pixels.fill(P.skyLow, y * w, y * w + w)
      continue
    }
    // The row's two ends in world space, then walk between them.
    const halfSpan = (rowDist * (w / 2)) / proj
    const centreX = view.camX + view.fx * rowDist
    const centreY = view.camY + view.fy * rowDist
    let wx = centreX - view.rx * halfSpan
    let wy = centreY - view.ry * halfSpan
    const stepX = (view.rx * halfSpan * 2) / w
    const stepY = (view.ry * halfSpan * 2) / w

    const inkBase = fogStep(rowDist, FOG_STEPS) * 16 * GRAIN_BUCKETS
    const at = y * w

    for (let x = 0; x < w; x++, wx += stepX, wy += stepY) {
      const ci = ((wy - plan.crossFromFt) * 8) | 0
      let kind: Ground
      if (ci >= 0 && ci < crossLen) {
        kind = resolve(plan, plan.cross[ci]! as Ground, plan.crossFlags[ci]!, wx, wy, maskLen)
      } else {
        // Beyond the footway: a car park, and a car park is stall lines.
        kind = Ground.Lot
        if (inStallBand(wy) && onStallLine(wx)) kind = Ground.LotStripe
      }
      const bucket = NOISE[((((wx * 6) | 0) * 31) ^ ((wy * 6) | 0)) & NOISE_MASK]!
      let ink = INK_TABLE[inkBase + kind * GRAIN_BUCKETS + bucket]!
      // Under a tree it is darker, and that is the entire report on shade.
      if (!isPaint(kind) && (wy < 0 || wy > roadWidth) && inShade(shade, wx)) ink = darkerInk(ink)
      pixels[at + x] = ink
    }
  }
}

const STALL_WIDTH_FT = 9
function onStallLine(x: number): boolean {
  const m = ((x % STALL_WIDTH_FT) + STALL_WIDTH_FT) % STALL_WIDTH_FT
  return Math.abs(m - STALL_WIDTH_FT / 2) < 0.22
}

/** Everything about a cross-section sample that still depends on the station. */
function resolve(
  plan: Plan, kind: Ground, flags: number, station: number, across: number, maskLen: number,
): Ground {
  const raw = (station / 2) | 0
  const slot = raw < 0 ? 0 : raw >= maskLen ? maskLen - 1 : raw
  if ((flags & 2) !== 0) {
    // Footway.
    const mask = across < 0 ? plan.cutMaskNorth : plan.cutMaskSouth
    if (mask[slot] === 1) return Ground.Driveway
    if (kind === Ground.Pavement) {
      const m = ((station % 5) + 5) % 5
      if (Math.abs(m - 2.5) < 0.16) return Ground.Joint
    }
    return kind
  }
  if (plan.crossingMask[slot] === 1 && (flags & 8) === 0) {
    return ((across * 0.5) | 0) % 2 === 0 ? Ground.Crosswalk : Ground.Asphalt
  }
  if ((flags & 4) !== 0) {
    return ((station / 24) | 0) % 2 === 0 ? Ground.LaneLine : Ground.Asphalt
  }
  return kind
}

/**
 * Where the trees on this side put their shadows.
 *
 * A crown throws a pool roughly its own width, and that pool is the only thing
 * on this corridor that makes standing still in August bearable. Computed once
 * a frame over the stretch in view.
 */
function shadeSpans(world: WalkWorld, view: View): Float32Array {
  const out: number[] = []
  const side: Side = view.facing === 1 ? 'north' : 'south'
  for (const tree of world.model.trees) {
    if (tree.side !== side) continue
    if (Math.abs(tree.stationFt - view.camX) > WALK_VIEW_FT) continue
    const radius = 2 + tree.maturity * 13
    out.push(tree.stationFt - radius, tree.stationFt + radius)
  }
  return Float32Array.from(out)
}

function inShade(spans: Float32Array, station: number): boolean {
  for (let i = 0; i < spans.length; i += 2) {
    if (station >= spans[i]! && station <= spans[i + 1]!) return true
  }
  return false
}

function drawWalls(
  plan: Plan, frame: WalkFrame, horizon: number, proj: number, eye: number, view: View,
): void {
  const { width: w, height: h, pixels, depth } = frame
  const hits: Hit[] = []

  for (let x = 0; x < w; x++) {
    const camera = (2 * x) / w - 1
    const dirX = view.fx + view.rx * camera * FOV
    const dirY = view.fy + view.ry * camera * FOV
    const norm = Math.hypot(dirX, dirY)
    const ux = dirX / norm
    const uy = dirY / norm
    depth[x] = WALK_VIEW_FT

    const count = castRay(plan, view.camX, view.camY, ux, uy, WALK_VIEW_FT, hits)
    if (count === 0) continue

    // Project onto the forward axis, or the walls bow away at the edges.
    const forward = ux * view.fx + uy * view.fy
    for (let i = count - 1; i >= 0; i--) {
      const hit = hits[i]!
      const perp = hit.distFt * forward
      if (perp < 1) continue
      const topY = Math.round(horizon - ((hit.topFt - eye) * proj) / perp)
      const baseY = Math.round(horizon + (eye * proj) / perp)
      if (baseY < 0 || topY > h) continue

      const step = fogStep(perp, FOG_STEPS)
      const shade = hit.lengthwise ? 0 : 1
      const wall = WALL_RAMP[hit.solid]
      const y0 = Math.max(0, topY)
      const y1 = Math.min(h - 1, baseY)
      const span = Math.max(1, baseY - topY)

      for (let y = y0; y <= y1; y++) {
        const up = ((baseY - y) / span) * hit.topFt
        pixels[y * w + x] = wallInk(hit, wall, step, shade, up, span)
      }
      const cap = Math.max(1, Math.round(span * 0.03))
      for (let y = Math.max(0, topY); y < Math.min(h, topY + cap); y++) {
        pixels[y * w + x] = ramp(ROOF_RAMP, step, y === topY ? shade : shade + 1)
      }
      if (i === 0) depth[x] = perp
    }
  }
}

/**
 * What a pixel of wall is.
 *
 * The same rules as the drive view, but seen from the pavement instead of from
 * two hundred feet away, which means the ground floor is most of what is on
 * the screen. A shopfront at the footway fills the frame with glass, an awning
 * and a doorway. A blank wall two hundred feet back fills it with nothing, and
 * the nothing is the finding.
 */
function wallInk(
  hit: Hit, wall: readonly number[], step: number, shade: number, upFt: number, spanPx: number,
): number {
  const storey = 11
  const near = spanPx > 12 && step < 3

  if (near && upFt < 13 && hit.quality > 0.55) {
    if (upFt < 1.2) return ramp([P.concreteMid, P.concreteDark, P.shadow], step, shade)
    // A door every so often along a proper shopfront, and glass between.
    const alongBay = (hit.wallU * CELL_FT) % 12
    if (upFt < 8 && alongBay > 4.6 && alongBay < 7.4) {
      return upFt < 7.4 ? ramp([P.woodMid, P.woodDark, P.shadow], step) : ramp([P.glassDark], step)
    }
    if (upFt > 9.4) return ramp([P.awningOrange, P.brickDark, P.shadow], step, shade)
    const mullion = (hit.wallU * CELL_FT) % 4.5 < 0.62
    if (mullion) return ramp([P.woodDark, P.shadow], step)
    return ramp([P.glassMid, P.glassDark, P.shadow], step, shade)
  }

  const intoStorey = upFt % storey
  if (near && intoStorey < 1.1) return ramp(wall, step, shade + 1)

  if (near && hit.quality > 0.2 && upFt > storey) {
    const acrossBay = (hit.wallU * CELL_FT) % 6
    if (acrossBay > 1.4 && acrossBay < 4.4 && intoStorey > 3 && intoStorey < 8.4) {
      return ramp([P.glassDark, P.glassDark, P.shadow], step)
    }
  }
  return ramp(wall, step, shade)
}

// --- Things you walk past ----------------------------------------------------

interface Board {
  stationFt: number
  acrossFt: number
  heightFt: number
  widthFt: number
  liftFt: number
  kind: 'tree' | 'pole' | 'car' | 'signal' | 'bench' | 'shelter' | 'hydrant' | 'person'
  tint: number
}

function drawProps(
  world: WalkWorld, state: WalkState, frame: WalkFrame,
  horizon: number, proj: number, eye: number, view: View, timeMs: number,
): void {
  const model = world.model
  const boards: Board[] = []
  const px = view.camX

  for (const tree of model.trees) {
    if (Math.abs(tree.stationFt - px) > WALK_VIEW_FT * 0.6) continue
    const acrossFt = tree.side === 'north'
      ? -model.sidewalkWidthFt * 0.25
      : model.roadWidthFt + model.sidewalkWidthFt * 0.25
    boards.push({
      stationFt: tree.stationFt, acrossFt,
      heightFt: 6 + tree.maturity * 32, widthFt: 3 + tree.maturity * 22,
      liftFt: 0, kind: 'tree', tint: tree.maturity,
    })
  }

  /*
   * The traffic. This is most of what standing here is: how much of it there
   * is, how fast it goes and how close it comes. All three are read off the
   * model rather than chosen. A vehicle every few seconds in six lanes is a
   * wall of moving metal four feet from your elbow; the same road with two
   * lanes and a third of the volume is a street.
   */
  const speedFps = world.trafficSpeedMph * MPH_TO_FPS
  const headwayFt = Math.max(38, speedFps / Math.max(0.02, world.flowPerLaneSec))
  for (let b = 0; b < model.bands.length; b++) {
    const band = model.bands[b]!
    if (band.direction === 0) continue
    // Each lane's platoon has its own phase, or every vehicle on the road
    // arrives abreast and six lanes look like two.
    const phase = hash01(b, 5171) * headwayFt
    const drift = (((timeMs / 1000) * speedFps * band.direction + phase) % headwayFt + headwayFt) % headwayFt
    const first = Math.floor((px - WALK_VIEW_FT * 0.5) / headwayFt) * headwayFt
    for (let s = first; s < px + WALK_VIEW_FT * 0.5; s += headwayFt) {
      boards.push({
        stationFt: s + drift, acrossFt: band.fromFt + band.widthFt / 2,
        heightFt: 5.2, widthFt: 15.5, liftFt: 0, kind: 'car',
        tint: Math.abs(Math.round(s / headwayFt)) % 4,
      })
    }
  }

  // Poles and lamps, on the side the player is on, skipping the driveways.
  const side: Side = view.facing === 1 ? 'north' : 'south'
  const kerbSide = side === 'north' ? -model.sidewalkWidthFt * 0.2 : model.roadWidthFt + model.sidewalkWidthFt * 0.2
  const lampEvery = 140
  for (let s = Math.floor((px - 200) / lampEvery) * lampEvery; s < px + WALK_VIEW_FT * 0.6; s += lampEvery) {
    if (s < 0) continue
    boards.push({
      stationFt: s, acrossFt: kerbSide, heightFt: 26, widthFt: 0.9,
      liftFt: 0, kind: 'pole', tint: 0,
    })
  }

  for (const junction of model.junctions) {
    if (Math.abs(junction.stationFt - px) > WALK_VIEW_FT * 0.6) continue
    if (junction.kind !== 'signal') continue
    boards.push({
      stationFt: junction.stationFt, acrossFt: kerbSide, heightFt: 10.5, widthFt: 1.3,
      liftFt: 0, kind: 'signal',
      tint: walkIsGreen(world, junction.index, state.elapsedSec) ? 1 : 0,
    })
  }

  const depthOf = (b: Board): number =>
    (b.stationFt - view.camX) * view.fx + (b.acrossFt - view.camY) * view.fy
  boards.sort((a, b) => depthOf(b) - depthOf(a))
  for (const board of boards) paintBoard(board, frame, horizon, proj, eye, view)
}

function paintBoard(
  board: Board, frame: WalkFrame, horizon: number, proj: number, eye: number, view: View,
): void {
  const { width: w, height: h, pixels, depth } = frame
  const dx = board.stationFt - view.camX
  const dy = board.acrossFt - view.camY
  const dist = dx * view.fx + dy * view.fy
  if (dist < 1.5 || dist > WALK_VIEW_FT) return
  const side = dx * view.rx + dy * view.ry

  const centreX = w / 2 + (side * proj) / dist
  const halfW = ((board.widthFt / 2) * proj) / dist
  const x0 = Math.max(0, Math.round(centreX - halfW))
  const x1 = Math.min(w - 1, Math.round(centreX + halfW))
  if (x1 < x0) return

  const baseY = horizon + ((eye - board.liftFt) * proj) / dist
  const topY = horizon + ((eye - board.liftFt - board.heightFt) * proj) / dist
  const y0 = Math.max(0, Math.round(topY))
  const y1 = Math.min(h - 1, Math.round(baseY))
  if (y1 < y0) return

  const step = fogStep(dist, FOG_STEPS)
  const spanX = Math.max(1, x1 - x0)
  const spanY = Math.max(1, y1 - y0)

  for (let x = x0; x <= x1; x++) {
    if (dist > depth[x]!) continue
    const u = (x - x0) / spanX
    for (let y = y0; y <= y1; y++) {
      const ink = boardInk(board, u, (y - y0) / spanY, step)
      if (ink !== 0) pixels[y * w + x] = ink
    }
  }
}

function boardInk(board: Board, u: number, v: number, step: number): number {
  switch (board.kind) {
    case 'tree': {
      const crownBase = 0.42 + 0.24 * (1 - board.tint)
      if (v > crownBase) {
        const trunkFt = 0.55 + board.tint * 0.75
        const taper = (trunkFt / board.widthFt) * (1 + (v - crownBase) * 0.5)
        if (Math.abs(u - 0.5) < taper) {
          return ramp(u < 0.5 ? [P.woodMid, P.woodDark, P.shadow] : [P.woodDark, P.shadow], step)
        }
        if (v > 0.985) return ramp([P.shadow], 0)
      }
      const dx = (u - 0.5) / 0.5
      const dy = (v - crownBase * 0.52) / (crownBase * 0.62)
      const lobes = 1 + 0.16 * Math.sin(Math.atan2(dy, dx) * 5 + board.tint * 9)
      const r2 = dx * dx + dy * dy
      if (r2 > lobes * lobes) return 0
      const lit = dx < -0.05 && dy < 0.15
      const deep = r2 > 0.55
      return ramp(lit ? [P.leafHigh, P.leafLight, P.leafMid, P.shadow]
        : deep ? [P.leafDark, P.leafDark, P.shadow, P.shadow]
          : [P.leafMid, P.leafDark, P.shadow, P.shadow], step)
    }
    case 'car': {
      // Side on, at four feet. This is the thing you are standing next to.
      if (v > 0.93) return ramp([P.shadow], 0)
      const wheel = (u > 0.15 && u < 0.29) || (u > 0.71 && u < 0.85)
      if (v > 0.72) return wheel ? ramp([P.shadow], 0) : ramp([P.asphaltDark, P.shadow], step)
      if (v < 0.34) {
        if (u < 0.24 || u > 0.78) return 0
        return ramp([P.glassMid, P.glassDark, P.shadow], step)
      }
      const body = [
        [P.signRed, P.brickDark, P.shadow],
        [P.glassMid, P.glassDark, P.shadow],
        [P.concreteLight, P.concreteMid, P.shadow],
        [P.woodMid, P.woodDark, P.shadow],
      ][Math.floor(board.tint) % 4]!
      return ramp(body, step)
    }
    case 'signal': {
      // The pole and the box on it, seen from the footway you are standing on.
      if (v > 0.22) return ramp([P.concreteMid, P.concreteDark, P.shadow], step)
      const on = board.tint > 0.5
      return on ? ramp([P.lineWhite, P.concreteLight], step) : ramp([P.awningOrange, P.signRed], step)
    }
    case 'pole': {
      // A lamp standard: a column with a head that reaches out over the kerb.
      if (v < 0.08) return ramp([P.concreteMid, P.concreteDark, P.shadow], step)
      return ramp([P.concreteMid, P.concreteDark, P.shadow], step, 1)
    }
    case 'bench':
      return ramp([P.woodMid, P.woodDark, P.shadow], step)
    case 'shelter':
      return v < 0.2 ? ramp([P.concreteMid, P.concreteDark], step) : ramp([P.glassMid, P.glassDark], step)
    case 'hydrant':
      return ramp([P.signRed, P.brickDark], step)
    case 'person': {
      // Head, shoulders, coat, legs. Enough that somebody is standing there.
      if (v > 0.94) return ramp([P.shadow], 0)
      if (v < 0.16) {
        return Math.abs(u - 0.5) < 0.34 ? ramp([P.woodMid, P.woodDark], step) : 0
      }
      if (v < 0.6) return ramp(board.tint > 0.5
        ? [P.signRed, P.brickDark, P.shadow]
        : [P.awningOrange, P.brickDark, P.shadow], step)
      if (Math.abs(u - 0.5) < 0.12) return 0
      return ramp([P.glassDark, P.shadow], step)
    }
  }
}

export { segmentOf, C }
