/**
 * The view from the driver's seat.
 *
 * A ray caster, because that is the cheapest honest way to put a person at eye
 * height on a street built out of a plan. Everything in the frame comes from
 * the simulation: the number of lanes is the number of lanes, the buildings
 * stand where their parcels put them, the signals are the signals, and how
 * fast the car will go is what the geometry and the traffic allow.
 *
 * The one thing this file must never do is punish the player for driving. A
 * corridor that has just been widened should be a pleasure to drive, because
 * it is, and the game says so by handing the player the wheel and getting out
 * of the way.
 *
 * No DOM: the renderer writes palette indices into a byte buffer and the
 * caller decides what to do with them.
 */

import {
  beginRow, buildPlan, castRay, CELL_FT, GROUND_INK, Ground, inStallBand, makeRowContext, Solid,
  type Hit, type Plan,
} from './firstperson'
import type { CorridorModel } from './corridor'
import { corridorModel } from './corridor'
import { P } from './palette'
import { C, effectiveGreenRatio, operatingSpeedMph, segmentOf, type SimState } from '../sim/index'

const MPH_TO_FPS = 5280 / 3600
const EYE_HEIGHT_FT = 3.9
/** Horizontal field of view. Sixty-six degrees is a windscreen. */
const FOV = 0.66
/** How far the eye is given. Past this the corridor is haze. */
export const VIEW_DISTANCE_FT = 1500

// --- The world the car drives through ---------------------------------------

export interface DriveWorld {
  plan: Plan
  model: CorridorModel
  /** Free-flow speed the geometry invites, mph. */
  designSpeedMph: number
  /**
   * How fast the traffic runs BETWEEN the signals at the peak.
   *
   * Not the model's peak speed, which is a journey speed with the signal delay
   * already folded into it. The drive view stops at the signals itself, so
   * taking that number would charge the player for them twice.
   */
  runningSpeedMph: number
  /** The model's own journey speed, for checking this view against it. */
  peakSpeedMph: number
  volumeCapacityRatio: number
  /** Share of the cycle the boulevard gets. */
  greenRatio: number
  cycleSec: number
  /** Extra seconds held at a red because the queue did not clear. */
  queueSec: number
  /** Seconds into the cycle each junction turns green. */
  offsetsSec: number[]
  /**
   * Each junction's own cycle length.
   *
   * Coordination means a COMMON cycle: that is the mechanism, not a detail.
   * Signals that are not coordinated run on their own clocks and beat against
   * each other, which is why an uncoordinated corridor cannot be learned - the
   * light that was green last Tuesday is red today, and there is nothing you
   * can do about it.
   */
  cyclesSec: number[]
  pavementAgeYears: number
  aadt: number
  year: number
  /** What the model says it is like to stand next to this, in dBA. */
  kerbNoiseDba: number
  /** Vehicles per second in one running lane at the peak. */
  flowPerLaneSec: number
  /** Running lanes in both directions. */
  laneCount: number
}

export function buildDriveWorld(state: SimState): DriveWorld {
  const model = corridorModel(state)
  const street = state.street
  const design = operatingSpeedMph(street, state.parcels)
  const cycleSec = street.signalCycleSec

  /*
   * Where a busy arterial actually costs you time.
   *
   * Not on the link. The Bureau of Public Roads curve has had the same shape
   * since 1964 and it is nearly flat until the road is full: between the
   * lights you do very close to the speed the geometry invites whether the
   * corridor is at half capacity or three quarters. What changes is whether
   * the queue at the light clears in one green. Past about eighty-five per
   * cent it does not, and you sit through a second cycle, and that is the
   * whole of the difference between a corridor that works and one that does
   * not. So: BPR on the link, and a queue at the signals.
   */
  const vc = state.traffic.volumeCapacityRatio
  const running = Math.max(7, design / (1 + 0.15 * Math.pow(Math.max(0, vc), 4)))
  const queueSec = Math.max(0, vc - 0.85) * cycleSec * 1.35

  /*
   * Signal offsets are the whole of what "progression" means, and they are the
   * clearest case in the game of an instrument the player can feel rather than
   * read. Timed for a platoon at the design speed, the lights open ahead of
   * you one after another and the corridor is a pleasure. Timed for anything
   * else, you stop at every one of them. The model already charges for this in
   * green time given to the side streets; here it is simply true.
   */
  /*
   * Signal timings are retimed, drift, and get changed by whoever last
   * complained, so they are keyed to the corridor and to the year rather than
   * fixed once for every game ever played. A player who drives the same street
   * in year four and year eleven should not meet the same five lights in the
   * same five states; over a run the luck averages out to the delay the model
   * charges everybody else.
   */
  const timingSeed = fnv(state.seed) + state.year * 7919
  const runningLanes = model.bands.filter((b) => b.direction !== 0).length
  const coordinated = street.signalPolicy === 'vehicle_progression'
  const cyclesSec = model.junctions.map((_, index) =>
    coordinated ? cycleSec : cycleSec * (0.84 + hash01(index, timingSeed + 733) * 0.34))

  const offsetsSec = model.junctions.map((junction, index) => {
    const own = cyclesSec[index]!
    // A progression is timed for the speed the traffic actually does, which is
    // what an engineer sets it to and not what the sign says. It is never
    // perfect: a real band leaks, and a driver who joins the corridor late
    // spends a cycle catching it.
    if (coordinated) {
      const travel = junction.stationFt / (running * MPH_TO_FPS)
      /*
       * How badly the band leaks.
       *
       * A progression on a corridor of unequal blocks with two-minute cycles
       * is a compromise before anybody has driven it: the spacings do not
       * divide evenly, cars turning in and out disperse the platoon, and the
       * band is set for one direction. You catch most of them. You do not
       * catch all of them, and a view that let you would be selling something.
       */
      const slip = (hash01(index, timingSeed + 977) - 0.5) * own * 0.62
      return (((travel + slip) % own) + own) % own
    }
    return hash01(index, timingSeed + 401) * own
  })

  return {
    plan: buildPlan(model),
    model,
    designSpeedMph: design,
    runningSpeedMph: running,
    peakSpeedMph: state.traffic.peakSpeedMph,
    volumeCapacityRatio: vc,
    greenRatio: effectiveGreenRatio(street),
    cycleSec,
    cyclesSec,
    queueSec,
    offsetsSec,
    pavementAgeYears: street.pavementAgeYears,
    aadt: state.traffic.aadt,
    year: state.year,
    kerbNoiseDba: state.environment.sidewalkNoiseDba,
    // Ten per cent of the day in the peak hour, split over the running lanes,
    // which is the usual rule for an arterial.
    flowPerLaneSec: runningLanes > 0
      ? (state.traffic.aadt * C.PEAK_HOUR_SHARE_OF_AADT) / runningLanes / 3600 : 0,
    laneCount: Math.max(1, runningLanes),
  }
}

// --- Driving ----------------------------------------------------------------

export interface DriveInput {
  /** -1 full brake, +1 full throttle. */
  throttle: number
  /** -1 left, +1 right. */
  steer: number
}

export type DriveEnd = 'arrived' | 'closed' | null

export interface DriveState {
  stationFt: number
  /** Feet from the north kerb. */
  acrossFt: number
  speedFps: number
  elapsedSec: number
  /** Seconds spent below walking pace. The other half of a journey time. */
  stoppedSec: number
  /** Vertical bounce from the road surface, in feet. */
  bounceFt: number
  /** Which junction is holding the player, if any. */
  heldAt: number | null
  ended: DriveEnd
  /** How many times somebody pulled out of a driveway in front of the car. */
  conflicts: number
  lastConflictFt: number
}

const ACCEL_FPS2 = 8.4
const BRAKE_FPS2 = 19
const STOP_LINE_FT = 26

export function newDrive(world: DriveWorld): DriveState {
  // Start in the kerbside eastbound GENERAL lane, at the west end, already
  // rolling. A bus lane also runs east; it is not for this car.
  const eastbound = world.model.bands.filter((b) => b.direction === 1 && b.role !== 'bus_lane')
  const lane = eastbound[eastbound.length - 1] ?? world.model.bands[0]!
  return {
    stationFt: 40,
    acrossFt: lane.fromFt + lane.widthFt / 2,
    speedFps: 0.72 * world.runningSpeedMph * MPH_TO_FPS,
    elapsedSec: 0,
    stoppedSec: 0,
    bounceFt: 0,
    heldAt: null,
    ended: null,
    conflicts: 0,
    lastConflictFt: -1e9,
  }
}

/** Whether a junction is showing green to the boulevard at this instant. */
export function signalIsGreen(world: DriveWorld, index: number, atSec: number): boolean {
  const cycle = world.cyclesSec[index] ?? world.cycleSec
  const phase = (((atSec - (world.offsetsSec[index] ?? 0)) % cycle) + cycle) % cycle
  // The queue eats the front of the green: the light is green and you are not
  // moving, because forty cars ahead of you have to go first.
  return phase >= world.queueSec && phase < cycle * world.greenRatio
}

/**
 * The speed the traffic in front will let you do between the lights.
 *
 * At the peak you are in the traffic, not above it, and no amount of throttle
 * changes that. The drive view always puts the player in the peak, because
 * that is the hour every argument about this street is actually about.
 */
export function platoonSpeedMph(world: DriveWorld): number {
  return world.runningSpeedMph
}

/** A string to a number, for keying the year's signal timings to the corridor. */
function fnv(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** A tiny deterministic hash, so the same driveway surprises you every run. */
function hash01(a: number, b: number): number {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1)
  h ^= h >>> 15
  h = Math.imul(h, 0x2545f491)
  h ^= h >>> 13
  return (h >>> 0) / 0x1_0000_0000
}

export function stepDrive(
  world: DriveWorld, state: DriveState, input: DriveInput, dtSec: number,
): DriveState {
  const next: DriveState = { ...state }
  if (state.ended !== null) return next

  const dt = Math.max(0, Math.min(0.1, dtSec))
  const ceilingFps = platoonSpeedMph(world) * MPH_TO_FPS

  // --- What is in front of the car ---
  let target = ceilingFps
  next.heldAt = null

  for (let i = 0; i < world.model.junctions.length; i++) {
    const junction = world.model.junctions[i]!
    const gap = junction.stationFt - state.stationFt
    if (gap < -8 || gap > 420) continue

    if (junction.kind === 'roundabout') {
      // You do not stop at a roundabout. You do not do forty through one either.
      const through = 15 * MPH_TO_FPS
      if (gap < 90) target = Math.min(target, through + Math.max(0, gap - 20) * 0.35)
      continue
    }
    if (signalIsGreen(world, i, state.elapsedSec)) continue
    // Red. Stop at the line, and hold there until it changes.
    const toLine = gap - STOP_LINE_FT
    if (toLine < 1.5) {
      target = 0
      next.heldAt = i
    } else {
      // The speed from which this car can still stop in the distance left.
      target = Math.min(target, Math.sqrt(2 * BRAKE_FPS2 * toLine))
    }
  }

  /*
   * Somebody pulling out of a driveway.
   *
   * A strip corridor is a corridor of driveways, and every one of them is a
   * place where a car crosses your lane at ten miles an hour. Most of the
   * time nothing happens. Occasionally it does, and you lift off, and the
   * three seconds it costs are three seconds nobody has ever put on a
   * spreadsheet. Only the driveways on YOUR side reach your lane.
   */
  const conflictChance = Math.min(0.14, 0.012 + world.aadt / 700_000)
  for (const cut of world.model.curbCuts) {
    if (cut.side !== 'south') continue
    const gap = cut.stationFt - state.stationFt
    if (gap < 0 || gap > 150) continue
    if (cut.stationFt <= state.lastConflictFt) continue
    const chance = hash01(Math.round(cut.stationFt), world.year * 31 + 7)
    if (chance > conflictChance) continue
    // A slow vehicle in the lane, not a wall: you brake, you do not stop.
    target = Math.min(target, Math.max(9 * MPH_TO_FPS, gap * 0.28))
    if (gap < 70) {
      next.conflicts++
      next.lastConflictFt = cut.stationFt
    }
  }

  // --- Throttle and brake ---
  const wants = input.throttle >= 0
    ? state.speedFps + ACCEL_FPS2 * input.throttle * dt
    : state.speedFps + BRAKE_FPS2 * input.throttle * dt
  next.speedFps = Math.max(0, Math.min(wants, target))
  // Traffic and red lights slow you whether or not you lift off.
  if (next.speedFps > target) next.speedFps = Math.max(target, state.speedFps - BRAKE_FPS2 * dt)

  // --- Where that puts the car ---
  next.stationFt = state.stationFt + next.speedFps * dt
  const lanes = world.model.bands.filter((b) => b.direction === 1 && b.role !== 'bus_lane')
  if (lanes.length > 0) {
    const first = lanes[0]!
    const last = lanes[lanes.length - 1]!
    const drift = input.steer * 22 * dt * Math.min(1, next.speedFps / 18 + 0.25)
    next.acrossFt = Math.max(first.fromFt + 2, Math.min(last.fromFt + last.widthFt - 2, state.acrossFt + drift))
  }

  next.elapsedSec = state.elapsedSec + dt
  if (next.speedFps < 4) next.stoppedSec = state.stoppedSec + dt

  /*
   * Ride quality. Deferred resurfacing is invisible on a budget line and
   * unmistakable through a steering wheel, which is the entire argument for
   * putting the player in the car.
   */
  const roughness = Math.min(1, world.pavementAgeYears / 26)
  const wobble = Math.sin(next.stationFt * 0.9) * 0.55 + Math.sin(next.stationFt * 3.7) * 0.3
  next.bounceFt = wobble * roughness * Math.min(1, next.speedFps / 30) * 0.5

  // --- The end of the road ---
  if (world.model.plazaSegments.includes(segmentOf(next.stationFt))) {
    next.ended = 'closed'
    next.speedFps = 0
  } else if (next.stationFt >= world.model.lengthFt - 60) {
    next.stationFt = world.model.lengthFt - 60
    next.ended = 'arrived'
  }
  return next
}

// --- Drawing ----------------------------------------------------------------

/**
 * Material ramps for the walls, near to far.
 *
 * Distance is drawn by stepping down a ramp rather than by blending, because
 * the frame buffer holds palette indices and there is nothing to blend with.
 * It is also what the medium did: fog was a colour you swapped to.
 */
const WALL_RAMP: Readonly<Record<Solid, readonly number[]>> = Object.freeze({
  [Solid.Open]: [P.skyLow],
  [Solid.Brick]: [P.brickLight, P.brickMid, P.brickDark, P.skyLow],
  [Solid.Stucco]: [P.stuccoLight, P.stuccoMid, P.stuccoDark, P.skyLow],
  [Solid.Concrete]: [P.concreteLight, P.concreteMid, P.concreteDark, P.skyLow],
  [Solid.Glass]: [P.glassMid, P.glassDark, P.concreteDark, P.skyLow],
  [Solid.Fence]: [P.woodMid, P.woodDark, P.shadow, P.skyLow],
})

const ROOF_RAMP = [P.roofLight, P.roofMid, P.roofDark, P.skyLow] as const

/** Which step of a ramp a thing this far away is drawn at. */
function fogStep(distFt: number, steps: number): number {
  const t = Math.min(0.999, distFt / VIEW_DISTANCE_FT)
  return Math.min(steps - 1, Math.floor(t * t * steps * 1.35))
}

function ramp(list: readonly number[], step: number, darker = 0): number {
  return list[Math.min(list.length - 1, step + darker)]!
}

export interface DriveFrame {
  width: number
  height: number
  /** Palette indices, row major. */
  pixels: Uint8Array
  /** Nearest wall distance per column, for anything billboarded on top. */
  depth: Float32Array
  /** Screen row of the horizon this frame. */
  horizon: number
}

export function makeDriveFrame(width: number, height: number): DriveFrame {
  return {
    width, height,
    pixels: new Uint8Array(width * height),
    depth: new Float32Array(width),
    horizon: height / 2,
  }
}

/**
 * Draw one frame.
 *
 * Sky, then the ground, then the walls from back to front, then everything
 * standing on the pavement. There is no depth buffer for the walls because
 * painting them far to near does the same job for nothing, and the one for
 * sprites is a single float per column.
 */
export function renderDrive(
  world: DriveWorld, state: DriveState, frame: DriveFrame, timeMs = 0,
): void {
  const { width: w, height: h } = frame
  const plan = world.plan
  const proj = (w / 2) / Math.tan((FOV * Math.PI) / 2)

  // The bonnet rises and falls with the road surface; so does the horizon.
  const horizon = Math.round(h * 0.52 - (state.bounceFt * proj) / 12)
  frame.horizon = horizon

  const eye = EYE_HEIGHT_FT + state.bounceFt
  const px = state.stationFt
  const py = state.acrossFt

  drawSky(frame, horizon)
  drawGround(plan, frame, horizon, proj, eye, px, py, Math.min(1, world.pavementAgeYears / 24))
  drawWalls(plan, frame, horizon, proj, eye, px, py)
  drawProps(world, state, frame, horizon, proj, eye, timeMs)
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
function drawSky(frame: DriveFrame, horizon: number): void {
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
 * The road surface, one screen row at a time.
 *
 * Each row below the horizon is a fixed distance away, so the whole row can be
 * walked with two adds. What lands in each pixel is whatever the plan says is
 * underfoot there, which means the lane markings, the crossings, the kerbs and
 * the car parks are all the same lookup and none of them is a texture.
 */
function drawGround(
  plan: Plan, frame: DriveFrame, horizon: number, proj: number, eye: number, px: number, py: number,
  ageWear = 0,
): void {
  const { width: w, height: h, pixels } = frame
  const row = ROW
  const crossLen = plan.cross.length
  buildInkTable(ageWear)

  for (let y = Math.max(0, horizon + 1); y < h; y++) {
    const rowDist = (eye * proj) / (y - horizon)
    if (rowDist > VIEW_DISTANCE_FT) {
      pixels.fill(P.skyLow, y * w, y * w + w)
      continue
    }
    // Left and right edges of this row in world space, then interpolate.
    const halfSpan = (rowDist * (w / 2)) / proj
    const worldX = px + rowDist
    const leftY = py - halfSpan
    const stepY = (halfSpan * 2) / w

    beginRow(plan, worldX, leftY, stepY, row)
    const table = row.table
    let index = row.index
    const step = row.step

    // Distance, grain seed and what lies beyond the pavement are all settled
    // for the whole row: a row of a floor in perspective is one station.
    const inkBase = fogStep(rowDist, FOG_STEPS) * 16 * GRAIN_BUCKETS
    const noiseSeed = row.grainX * 31
    const beyondNorth = row.beyondNorth
    const beyondSouth = row.beyondSouth
    const stallLine = row.onStallLine
    const at = y * w
    let across = leftY

    for (let x = 0; x < w; x++, index += step, across += stepY) {
      const i = index | 0
      let kind: Ground
      if (i >= 0 && i < crossLen) {
        kind = table[i]! as Ground
      } else {
        // Beyond the pavement: a car park, a lawn or paving, decided for the
        // whole row, with the stall lines the only thing left to test.
        kind = across < 0 ? beyondNorth : beyondSouth
        if (kind === Ground.Lot && stallLine && inStallBand(across)) kind = Ground.LotStripe
      }
      const bucket = NOISE[(noiseSeed + ((across * 6) | 0)) & NOISE_MASK]!
      pixels[at + x] = INK_TABLE[inkBase + kind * GRAIN_BUCKETS + bucket]!
    }
  }
}

/** Reused across every row of every frame, because it is scratch. */
const ROW = makeRowContext()

/**
 * Surface grain, atmosphere and palette, collapsed into one table.
 *
 * Asphalt is stone in tar and does not photograph as one flat value; nor does
 * concrete, nor the grass strip; and everything loses colour to the air with
 * distance. Done honestly that is a hash, a switch on the material and a fog
 * branch for every pixel of road on the screen, and it measured about four
 * milliseconds a frame.
 *
 * All three depend on nothing but (how far away, what material, which grain
 * bucket), so all three fit in a thousand-byte table built once a frame. The
 * inner loop becomes a single array read, and the picture is identical.
 */
const FOG_STEPS = 4
const GRAIN_BUCKETS = 16
const INK_TABLE = new Uint8Array(FOG_STEPS * 16 * GRAIN_BUCKETS)

/** Noise, quantised to buckets, so the hash is not run per pixel either. */
const NOISE_MASK = 4095
const NOISE = (() => {
  const out = new Uint8Array(NOISE_MASK + 1)
  for (let i = 0; i <= NOISE_MASK; i++) out[i] = Math.floor(hash01(i, 0x9e37) * GRAIN_BUCKETS)
  return out
})()

/** Which materials keep their colour whatever the distance does. */
function isPaint(kind: Ground): boolean {
  return kind === Ground.LaneLine || kind === Ground.CentreLine
    || kind === Ground.Crosswalk || kind === Ground.LotStripe
}

function grainedInk(kind: Ground, bucket: number, wear: number): number {
  const base = GROUND_INK[kind]!
  const n = (bucket + 0.5) / GRAIN_BUCKETS
  switch (kind) {
    case Ground.Asphalt:
    case Ground.ParkingBay:
      if (n > 0.955) return P.asphaltLight
      if (n < 0.11 + wear * 0.2) return P.asphaltDark
      // A ravelled surface goes pale and blotchy long before it fails.
      return wear > 0.55 && n > 0.87 ? P.asphaltWorn : base
    case Ground.Lot:
      return n > 0.93 ? P.asphaltMid : n < 0.1 ? P.asphaltDark : base
    case Ground.Pavement:
      return n > 0.95 ? P.concreteMid : base
    case Ground.Grass:
      return n > 0.62 ? P.leafDark : n < 0.14 ? P.leafLight : base
    case Ground.Plaza:
      return n > 0.93 ? P.concreteLight : base
    default:
      return base
  }
}

function buildInkTable(wear: number): void {
  for (let kind = 0; kind < 16; kind++) {
    const paint = isPaint(kind as Ground)
    for (let bucket = 0; bucket < GRAIN_BUCKETS; bucket++) {
      const near = grainedInk(kind as Ground, bucket, wear)
      for (let fog = 0; fog < FOG_STEPS; fog++) {
        let ink = near
        if (!paint) {
          // Atmosphere. Distance takes colour out of a surface and puts the
          // sky in its place; a road that fades to black at a quarter mile
          // reads as a tunnel. The last step dithers rather than snapping.
          if (fog >= 3) ink = P.skyLow
          else if (fog === 2) ink = bucket < 8 ? P.skyLow : darker(near)
        }
        INK_TABLE[(fog * 16 + kind) * GRAIN_BUCKETS + bucket] = ink
      }
    }
  }
}

/** One step down whatever ramp this ink belongs to. *//** One step down whatever ramp this ink belongs to. */
function darker(ink: number): number {
  switch (ink) {
    case P.asphaltMid: return P.asphaltDark
    case P.asphaltWorn: return P.asphaltMid
    case P.concreteLight: return P.concreteMid
    case P.concreteMid: return P.concreteDark
    case P.leafMid: return P.leafDark
    default: return ink
  }
}

function drawWalls(
  plan: Plan, frame: DriveFrame, horizon: number, proj: number, eye: number, px: number, py: number,
): void {
  const { width: w, height: h, pixels, depth } = frame
  const hits: Hit[] = []
  // The windscreen is flat, so the ray for column x fans out linearly.
  for (let x = 0; x < w; x++) {
    const camera = (2 * x) / w - 1
    const dirX = 1
    const dirY = camera * FOV * 1.02
    const norm = Math.hypot(dirX, dirY)
    depth[x] = VIEW_DISTANCE_FT

    const count = castRay(plan, px, py, dirX / norm, dirY / norm, VIEW_DISTANCE_FT, hits)
    if (count === 0) continue

    // Back to front: the near wall paints over the far one and there is no
    // depth test to run.
    for (let i = count - 1; i >= 0; i--) {
      const hit = hits[i]!
      // Undo the fan, or every wall bows away at the edges of the screen.
      const perp = hit.distFt * (dirX / norm)
      if (perp < 1) continue
      const topY = Math.round(horizon - ((hit.topFt - eye) * proj) / perp)
      const baseY = Math.round(horizon + (eye * proj) / perp)
      if (baseY < 0 || topY > h) continue

      const step = fogStep(perp, 4)
      // A face across the corridor catches the light; one along it does not.
      const shade = hit.lengthwise ? 1 : 0
      const wall = WALL_RAMP[hit.solid]
      const y0 = Math.max(0, topY)
      const y1 = Math.min(h - 1, baseY)
      const span = Math.max(1, baseY - topY)

      for (let y = y0; y <= y1; y++) {
        // Height up the wall in feet, for floor bands and windows.
        const up = ((baseY - y) / span) * hit.topFt
        pixels[y * w + x] = wallInk(hit, wall, step, shade, up, span)
      }
      // A parapet, two or three rows of it, so the top of a building is a
      // thing that was built rather than where the drawing stopped.
      const cap = Math.max(1, Math.round(span * 0.03))
      for (let y = Math.max(0, topY); y < Math.min(h, topY + cap); y++) {
        pixels[y * w + x] = ramp(ROOF_RAMP, step, y === topY ? shade : shade + 1)
      }
      if (i === 0) depth[x] = perp
    }
  }
}

/**
 * What a single pixel of wall is.
 *
 * Storey bands, windows on a grid, and a shopfront at the bottom if the use
 * has one. A blank wall gets none of it, which is what makes a blank wall
 * read as a blank wall rather than as a building drawn cheaply.
 */
function wallInk(
  hit: Hit, wall: readonly number[], step: number, shade: number, upFt: number, spanPx: number,
): number {
  const storey = 11
  const nearEnough = spanPx > 14 && step < 3

  if (nearEnough && upFt < 12 && hit.quality > 0.55) {
    // A shopfront: glass, a mullion every few feet, and a sill at the bottom.
    if (upFt < 1.4) return ramp([P.concreteMid, P.concreteDark, P.shadow], step, shade)
    const mullion = (hit.wallU * CELL_FT) % 4.5 < 0.7
    if (mullion) return ramp([P.woodDark, P.shadow], step)
    return ramp([P.glassMid, P.glassDark, P.shadow], step, shade)
  }

  const intoStorey = upFt % storey
  if (nearEnough && intoStorey < 1.1) return ramp(wall, step, shade + 1)

  if (nearEnough && hit.quality > 0.2 && upFt > storey) {
    const acrossBay = (hit.wallU * CELL_FT) % 6
    if (acrossBay > 1.4 && acrossBay < 4.4 && intoStorey > 3 && intoStorey < 8.4) {
      return ramp([P.glassDark, P.glassDark, P.shadow], step)
    }
  }
  return ramp(wall, step, shade)
}

// --- Things standing on the street ------------------------------------------

interface Billboard {
  stationFt: number
  acrossFt: number
  /** Height of the thing, in feet. */
  heightFt: number
  widthFt: number
  /** Feet above the ground the bottom sits. */
  liftFt: number
  kind: 'tree' | 'signal' | 'pole' | 'car' | 'person' | 'lamp' | 'sign' | 'shelter'
  tint: number
}

function drawProps(
  world: DriveWorld, state: DriveState, frame: DriveFrame,
  horizon: number, proj: number, eye: number, timeMs: number,
): void {
  const model = world.model
  const boards: Billboard[] = []
  const px = state.stationFt

  for (const tree of model.trees) {
    const ahead = tree.stationFt - px
    if (ahead < 4 || ahead > VIEW_DISTANCE_FT) continue
    const acrossFt = tree.side === 'north' ? -model.sidewalkWidthFt * 0.35 : model.roadWidthFt + model.sidewalkWidthFt * 0.35
    boards.push({
      stationFt: tree.stationFt, acrossFt,
      heightFt: 6 + tree.maturity * 32, widthFt: 3 + tree.maturity * 22,
      liftFt: 0, kind: 'tree', tint: tree.maturity,
    })
  }

  for (let i = 0; i < model.junctions.length; i++) {
    const junction = model.junctions[i]!
    const ahead = junction.stationFt - px
    if (ahead < 2 || ahead > VIEW_DISTANCE_FT) continue
    if (junction.kind === 'roundabout') {
      boards.push({
        stationFt: junction.stationFt, acrossFt: model.roadWidthFt / 2,
        heightFt: 3, widthFt: 26, liftFt: 0, kind: 'sign', tint: 0,
      })
      continue
    }
    // Head, mast arm and pole in one billboard: at this scale they are one
    // silhouette, and the silhouette is what tells you a junction is coming.
    boards.push({
      stationFt: junction.stationFt - STOP_LINE_FT,
      acrossFt: model.roadWidthFt * 0.62,
      heightFt: 20, widthFt: 34, liftFt: 0, kind: 'signal',
      tint: signalIsGreen(world, i, state.elapsedSec) ? 1 : 0,
    })
  }

  /*
   * Oncoming traffic.
   *
   * Headway is the speed divided by the flow, which is how a road works: at
   * six hundred vehicles an hour in a lane doing fifty you get one every four
   * hundred feet, and at the same speed with twice the traffic you get one
   * every two hundred. Which means the corridor filling back up after the
   * widening is visible from the windscreen without anybody saying so.
   *
   * And it comes TOWARD you. The first version drifted it east at the
   * player's own speed, so the same three cars sat ahead of the bonnet for
   * the length of the corridor and nothing ever passed.
   */
  const speedFps = world.runningSpeedMph * MPH_TO_FPS
  const headwayFt = Math.max(48, speedFps / Math.max(0.02, world.flowPerLaneSec))
  const seconds = timeMs / 1000
  for (let b = 0; b < model.bands.length; b++) {
    const band = model.bands[b]!
    if (band.direction !== -1) continue
    // Each lane's platoon has its own phase, or the whole road arrives abreast.
    const phase = hash01(b, 5171) * headwayFt
    const drift = ((seconds * speedFps + phase) % headwayFt + headwayFt) % headwayFt
    const first = Math.ceil((px + 20) / headwayFt) * headwayFt
    for (let s = first; s < px + VIEW_DISTANCE_FT * 0.55; s += headwayFt) {
      boards.push({
        stationFt: s - drift, acrossFt: band.fromFt + band.widthFt / 2,
        heightFt: 5.2, widthFt: 6.2, liftFt: 0, kind: 'car',
        tint: Math.abs(Math.round(s / headwayFt) + b) % 4,
      })
    }
  }

  /*
   * The furniture. Three instruments the player can buy live only here: what
   * the lamps are, whether there are still poles and crossarms over the
   * footway, and whether the bus stop is a shelter or a pole with a timetable.
   */
  for (const item of model.furniture) {
    const ahead = item.stationFt - px
    if (ahead < 3 || ahead > VIEW_DISTANCE_FT * 0.7) continue
    const acrossFt = item.side === 'north'
      ? -model.sidewalkWidthFt * 0.25
      : model.roadWidthFt + model.sidewalkWidthFt * 0.25
    boards.push({
      stationFt: item.stationFt, acrossFt,
      heightFt: item.heightFt,
      widthFt: item.kind === 'shelter' ? 12 : item.kind === 'pole' ? 7 : item.fine ? 1.1 : 16,
      liftFt: 0,
      kind: item.kind === 'shelter' ? 'shelter' : item.kind === 'pole' ? 'pole' : 'lamp',
      tint: item.fine ? 1 : 0,
    })
  }

  // Whatever is left at the kerb.
  for (const car of model.parked) {
    const ahead = car.stationFt - px
    if (ahead < 3 || ahead > VIEW_DISTANCE_FT * 0.4) continue
    const bay = model.bands.find((b) => b.role === 'parking_bay')
    if (!bay) break
    const acrossFt = car.side === 'north' ? bay.fromFt + bay.widthFt / 2
      : model.roadWidthFt - bay.widthFt / 2
    boards.push({
      stationFt: car.stationFt, acrossFt, heightFt: 5.1, widthFt: 6.4,
      liftFt: 0, kind: 'car', tint: car.tint,
    })
  }

  // A car waiting to come out of every driveway you pass.
  for (const cut of model.curbCuts) {
    const ahead = cut.stationFt - px
    if (ahead < 6 || ahead > 420) continue
    const acrossFt = cut.side === 'north'
      ? -model.sidewalkWidthFt - 6
      : model.roadWidthFt + model.sidewalkWidthFt + 6
    boards.push({
      stationFt: cut.stationFt, acrossFt, heightFt: 5, widthFt: 12,
      liftFt: 0, kind: 'car', tint: 2,
    })
  }

  boards.sort((a, b) => (b.stationFt - px) - (a.stationFt - px))
  for (const board of boards) paintBillboard(board, state, frame, horizon, proj, eye)
}

/**
 * Draw one upright thing, clipped per column against the nearest wall.
 *
 * A billboard rather than a mesh: at this resolution the difference is a
 * couple of pixels, and the whole point of the palette is that it is cheap.
 */
function paintBillboard(
  board: Billboard, state: DriveState, frame: DriveFrame, horizon: number, proj: number, eye: number,
): void {
  const { width: w, height: h, pixels, depth } = frame
  const dist = board.stationFt - state.stationFt
  if (dist < 2) return
  const offset = board.acrossFt - state.acrossFt
  const centreX = w / 2 + (offset * proj) / dist
  const halfW = ((board.widthFt / 2) * proj) / dist
  const x0 = Math.max(0, Math.round(centreX - halfW))
  const x1 = Math.min(w - 1, Math.round(centreX + halfW))
  if (x1 < x0) return

  const baseY = horizon + ((eye - board.liftFt) * proj) / dist
  const topY = horizon + ((eye - board.liftFt - board.heightFt) * proj) / dist
  const y0 = Math.max(0, Math.round(topY))
  const y1 = Math.min(h - 1, Math.round(baseY))
  if (y1 < y0) return

  const step = fogStep(dist, 4)
  const spanX = Math.max(1, x1 - x0)
  const spanY = Math.max(1, y1 - y0)

  for (let x = x0; x <= x1; x++) {
    if (dist > depth[x]!) continue
    const u = (x - x0) / spanX
    for (let y = y0; y <= y1; y++) {
      const v = (y - y0) / spanY
      const ink = billboardInk(board, u, v, step)
      if (ink !== 0) pixels[y * w + x] = ink
    }
  }
}

function billboardInk(board: Billboard, u: number, v: number, step: number): number {
  switch (board.kind) {
    case 'tree': {
      // Trunk first, so the crown can overlap it. A young tree is mostly
      // trunk and a stick with a tuft on top; an old one is mostly crown.
      const crownBase = 0.42 + 0.24 * (1 - board.tint)
      if (v > crownBase) {
        // A trunk is a foot or two thick whatever the crown has done, so it is
        // measured in feet and then converted, not taken from the crown box.
        const trunkFt = 0.55 + board.tint * 0.75
        const taper = (trunkFt / board.widthFt) * (1 + (v - crownBase) * 0.5)
        if (Math.abs(u - 0.5) < taper) {
          return ramp(u < 0.5 ? [P.woodMid, P.woodDark, P.shadow] : [P.woodDark, P.shadow], step)
        }
        if (v > 0.985) return ramp([P.shadow], 0)
      }
      const dx = (u - 0.5) / 0.5
      const dy = (v - crownBase * 0.52) / (crownBase * 0.62)
      // A lobed edge, so it is a tree and not a lollipop.
      const lobes = 1 + 0.16 * Math.sin(Math.atan2(dy, dx) * 5 + board.tint * 9)
      const r2 = dx * dx + dy * dy
      if (r2 > lobes * lobes) return 0
      // The sun is over the left shoulder, which is where it is in every
      // other view in this game.
      const lit = dx < -0.05 && dy < 0.15
      const deep = r2 > 0.55
      const ink = lit ? [P.leafHigh, P.leafLight, P.leafMid, P.shadow]
        : deep ? [P.leafDark, P.leafDark, P.shadow, P.shadow]
          : [P.leafMid, P.leafDark, P.shadow, P.shadow]
      return ramp(ink, step)
    }
    case 'signal': {
      const on = board.tint > 0.5
      const pole = [P.concreteMid, P.concreteDark, P.shadow]
      // The pole stands at the kerb on the right.
      if (u > 0.93 && u < 0.985) return ramp(pole, step)
      // The arm reaches out over the carriageway.
      if (v < 0.055 && u > 0.28) return ramp(pole, step)
      // The head hangs off it, out over the lanes.
      if (u > 0.3 && u < 0.4 && v > 0.055 && v < 0.42) {
        const lens = (v - 0.055) / 0.365
        if (u < 0.315 || u > 0.385) return ramp([P.shadow], 0)
        if (lens < 0.3) return on ? ramp([P.shadow], 0) : ramp([P.signRed, P.brickDark], step)
        if (lens < 0.64) return ramp([P.shadow], 0)
        return on ? ramp([P.leafHigh, P.leafLight], step) : ramp([P.shadow], 0)
      }
      return 0
    }
    case 'sign':
      return v < 0.5 ? ramp([P.signBlue, P.glassDark, P.shadow], step) : ramp([P.concreteMid, P.concreteDark], step)
    case 'car': {
      if (v < 0.34) {
        if (u < 0.16 || u > 0.84) return 0
        return ramp([P.glassMid, P.glassDark, P.shadow], step)
      }
      if (v > 0.9) return ramp([P.shadow], 0)
      const body = [
        [P.signRed, P.brickDark, P.shadow],
        [P.glassMid, P.glassDark, P.shadow],
        [P.concreteLight, P.concreteMid, P.shadow],
        [P.woodMid, P.woodDark, P.shadow],
      ][Math.floor(board.tint) % 4]!
      // Lamps at the corners, which is what you actually see of a car ahead.
      if (v > 0.55 && v < 0.75 && (u < 0.14 || u > 0.86)) return ramp([P.lineWhite, P.lineYellow], step)
      return ramp(body, step)
    }
    case 'pole': {
      // A timber pole with two crossarms on it. The crossarms are the reason
      // undergrounding costs five million dollars and looks like nothing.
      const wood = [P.woodMid, P.woodDark, P.shadow]
      if (Math.abs(u - 0.5) < 0.09) return ramp(wood, step)
      if (v > 0.08 && v < 0.115) return ramp(wood, step, 1)
      if (v > 0.2 && v < 0.235) return ramp(wood, step, 1)
      return 0
    }
    case 'lamp': {
      const metal = [P.concreteMid, P.concreteDark, P.shadow]
      if (board.tint > 0.5) {
        // Pedestrian scale: a column with a lantern on top of it.
        if (v < 0.1) return ramp([P.glassLit, P.lineWhite], step)
        return ramp(metal, step, 1)
      }
      // A cobra head: a mast at the kerb with an arm out over the carriageway.
      if (u > 0.9) return ramp(metal, step, 1)
      if (v < 0.06 && u > 0.28) return ramp(metal, step)
      if (v > 0.06 && v < 0.11 && u > 0.24 && u < 0.36) return ramp([P.glassLit, P.concreteLight], step)
      return 0
    }
    case 'shelter': {
      // A roof, two uprights and a glass back. Or, unupgraded, less of it.
      if (v < 0.16) return ramp([P.concreteMid, P.concreteDark, P.shadow], step)
      if (board.tint < 0.5 && v > 0.5) return 0
      if (u < 0.08 || u > 0.92) return ramp([P.concreteDark, P.shadow], step)
      return ramp([P.glassMid, P.glassDark, P.shadow], step)
    }
    case 'person':
      return ramp([P.awningOrange, P.brickDark, P.shadow], step)
  }
}
