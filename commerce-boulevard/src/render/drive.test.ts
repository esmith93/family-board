/**
 * Tests for the view from the driver's seat.
 *
 * Two things are being defended here. The first is that the picture is a
 * function of the model and not a decoration hung next to it. The second is
 * harder and matters more: the drive has to be GOOD when the road is good.
 * The spec is explicit that the car-centric choice must genuinely work in the
 * early years, and a drive view that quietly punished the player for taking
 * the grant would be the game arguing with itself.
 */

import { describe, expect, it } from 'vitest'

import { advanceYear, newGame, type SimState } from '../sim/index'
import {
  buildDriveWorld, makeDriveFrame, newDrive, platoonSpeedMph, renderDrive, signalIsGreen,
  stepDrive, type DriveState, type DriveWorld,
} from './drive'
import { PALETTE_INDEX } from './palette'

const CORRIDORS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'win', 'lose', 'order', 'reckon', 'fairview-best']
const W = 320
const H = 180

function play(seed: string, years: number, plan: Record<number, string[]> = {}): SimState {
  let state = newGame(seed)
  for (let i = 0; i < years && !state.ended; i++) state = advanceYear(state, plan[state.year] ?? []).state
  return state
}

/** Drive the whole corridor flat out and report the journey. */
function journey(state: SimState): { mph: number; sec: number; stopped: number; end: DriveState } {
  const world = buildDriveWorld(state)
  let drive = newDrive(world)
  while (drive.ended === null && drive.elapsedSec < 1200) {
    drive = stepDrive(world, drive, { throttle: 1, steer: 0 }, 1 / 30)
  }
  const miles = (drive.stationFt - 40) / 5280
  return { mph: miles / (drive.elapsedSec / 3600), sec: drive.elapsedSec, stopped: drive.stoppedSec, end: drive }
}

/** Drive for a while, then take a picture. */
function frameAfter(state: SimState, seconds: number): Uint8Array {
  const world = buildDriveWorld(state)
  let drive = newDrive(world)
  for (let t = 0; t < seconds; t += 1 / 30) {
    drive = stepDrive(world, drive, { throttle: 1, steer: 0 }, 1 / 30)
  }
  const frame = makeDriveFrame(W, H)
  renderDrive(world, drive, frame, seconds * 1000)
  return frame.pixels
}

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length
const WIDEN: Record<number, string[]> = { 0: ['capital.state_widening'] }

describe('the widening genuinely works, which is the whole trap', () => {
  it('drives faster in the early years than the corridor that was left alone', () => {
    for (const year of [4, 6, 8]) {
      const widened = mean(CORRIDORS.map((s) => journey(play(s, year, WIDEN)).mph))
      const left = mean(CORRIDORS.map((s) => journey(play(s, year)).mph))
      expect(widened, `year ${year}: the widening did not pay`).toBeGreaterThan(left)
    }
  })

  it('gives that back by the end, without anybody having done anything', () => {
    // The corridor fills up again. Not because the player was punished for
    // widening it - because more people drove on it, which is what happened.
    //
    // Measured on the speed the traffic allows between the lights rather than
    // on the journey: which of five lights you happen to catch swings a single
    // trip by half a minute, and thirteen corridors is not enough of a sample
    // to see a two mile an hour trend through that.
    const running = (year: number): number =>
      mean(CORRIDORS.map((seed) => platoonSpeedMph(buildDriveWorld(play(seed, year, WIDEN)))))
    const load = (year: number): number =>
      mean(CORRIDORS.map((seed) => buildDriveWorld(play(seed, year, WIDEN)).volumeCapacityRatio))
    expect(running(20)).toBeLessThan(running(4))
    expect(load(20)).toBeGreaterThan(load(4))
  })

  it('is a wider road to look at, not just a faster one', () => {
    const roadInk = (pixels: Uint8Array): number => {
      let n = 0
      for (const ink of pixels) {
        if (ink === PALETTE_INDEX.asphaltMid || ink === PALETTE_INDEX.asphaltDark
          || ink === PALETTE_INDEX.asphaltLight || ink === PALETTE_INDEX.asphaltWorn) n++
      }
      return n / pixels.length
    }
    expect(roadInk(frameAfter(play('a', 4, WIDEN), 6)))
      .toBeGreaterThan(roadInk(frameAfter(play('a', 4), 6)))
  })
})

describe('the drive is the model, not a decoration hung next to it', () => {
  it('journeys at roughly the speed the simulation says the corridor journeys at', () => {
    // The drive is one through trip at the peak and the model is an average
    // over every vehicle, so they should be close without being equal.
    for (const years of [0, 8, 18]) {
      const ratios = CORRIDORS.map((seed) => {
        const state = play(seed, years)
        state.street.signalPolicy = 'balanced'
        const world = buildDriveWorld(state)
        return journey(state).mph / world.peakSpeedMph
      })
      expect(mean(ratios), `year ${years}`).toBeGreaterThan(0.8)
      expect(mean(ratios), `year ${years}`).toBeLessThan(1.25)
    }
  })

  it('makes a coordinated corridor a better drive than an uncoordinated one', () => {
    // Progression is the clearest instrument in the game that the player can
    // feel rather than read, and it must be unmistakable from the seat.
    const speedOn = (policy: SimState['street']['signalPolicy']): number =>
      mean(CORRIDORS.map((seed) => {
        const state = play(seed, 0)
        state.street.signalPolicy = policy
        return journey(state).mph
      }))
    const progression = speedOn('vehicle_progression')
    const balanced = speedOn('balanced')
    const pedestrian = speedOn('pedestrian_priority')
    expect(progression).toBeGreaterThan(balanced * 1.2)
    expect(balanced).toBeGreaterThan(pedestrian)
  })

  it('does not catch every green even when the lights are coordinated', () => {
    // A view that let the player sail through five junctions in a row would be
    // selling something. Real bands leak.
    const stops = CORRIDORS.map((seed) => journey(play(seed, 0)).stopped)
    expect(Math.max(...stops)).toBeGreaterThan(0)
  })

  it('does not stop you at a roundabout, and does slow you through it', () => {
    const state = play('a', 0)
    state.street.signalPolicy = 'balanced'
    const before = journey(state)
    const after = { ...state, street: { ...state.street, roundabouts: [0, 1, 2, 3, 4] } }
    const round = journey(after)
    expect(round.stopped).toBeLessThan(before.stopped)
    expect(round.end.speedFps).toBeGreaterThan(0)
  })

  it('ends the drive at a block the player closed to traffic', () => {
    const state = play('a', 0)
    state.street.plazaSegments = [4]
    const run = journey(state)
    expect(run.end.ended).toBe('closed')
    expect(run.end.stationFt).toBeLessThan(4000)
  })

  it('shakes the car in proportion to how long the resurfacing has been put off', () => {
    const smooth = play('a', 0)
    smooth.street.pavementAgeYears = 1
    const rough = play('a', 0)
    rough.street.pavementAgeYears = 26
    const bounceOf = (state: SimState): number => {
      const world = buildDriveWorld(state)
      let drive = newDrive(world)
      let worst = 0
      for (let t = 0; t < 20; t += 1 / 30) {
        drive = stepDrive(world, drive, { throttle: 1, steer: 0 }, 1 / 30)
        worst = Math.max(worst, Math.abs(drive.bounceFt))
      }
      return worst
    }
    expect(bounceOf(rough)).toBeGreaterThan(bounceOf(smooth) * 3)
  })

  it('holds the car in the lanes running its way', () => {
    const world = buildDriveWorld(play('a', 0))
    let drive = newDrive(world)
    const eastbound = world.model.bands.filter((b) => b.direction === 1)
    const first = eastbound[0]!
    const last = eastbound[eastbound.length - 1]!
    for (let t = 0; t < 30; t += 1 / 30) {
      drive = stepDrive(world, drive, { throttle: 1, steer: t < 15 ? -1 : 1 }, 1 / 30)
      expect(drive.acrossFt).toBeGreaterThanOrEqual(first.fromFt)
      expect(drive.acrossFt).toBeLessThanOrEqual(last.fromFt + last.widthFt)
    }
  })

  it('is deterministic', () => {
    const a = frameAfter(play('same', 6), 9)
    const b = frameAfter(play('same', 6), 9)
    expect(Array.from(a)).toEqual(Array.from(b))
  })

  it('is a different street on a different corridor', () => {
    expect(Array.from(frameAfter(play('one', 6), 9)))
      .not.toEqual(Array.from(frameAfter(play('two', 6), 9)))
  })
})

describe('the picture', () => {
  it('is never a flat rectangle', () => {
    // The spec's rule, applied to a camera. Every frame has sky, a road
    // surface with grain in it, and paint, and no single colour owns it.
    for (const [name, state] of [
      ['year 0', play('a', 0)],
      ['widened', play('a', 5, WIDEN)],
      ['grown in', play('a', 24, {
        3: ['street.plant_trees'], 7: ['capital.road_diet'], 17: ['street.plant_trees'],
      })],
    ] as [string, SimState][]) {
      const pixels = frameAfter(state, 12)
      const counts = new Map<number, number>()
      for (const ink of pixels) counts.set(ink, (counts.get(ink) ?? 0) + 1)
      expect(counts.size, `${name}: only ${counts.size} colours`).toBeGreaterThanOrEqual(8)
      const biggest = Math.max(...counts.values()) / pixels.length
      expect(biggest, `${name}: one colour owns ${(biggest * 100).toFixed(0)}% of the frame`)
        .toBeLessThan(0.55)
      expect(counts.get(0) ?? 0, `${name}: holes in the frame`).toBe(0)
    }
  })

  it('puts sky above the horizon and street below it', () => {
    const world = buildDriveWorld(play('a', 0))
    let drive = newDrive(world)
    for (let t = 0; t < 9; t += 1 / 30) drive = stepDrive(world, drive, { throttle: 1, steer: 0 }, 1 / 30)
    const frame = makeDriveFrame(W, H)
    renderDrive(world, drive, frame, 9000)

    const sky = new Set<number>([PALETTE_INDEX.skyHigh, PALETTE_INDEX.skyMid, PALETTE_INDEX.skyLow])
    const shareOfSky = (y: number): number => {
      let n = 0
      for (let x = 0; x < W; x++) if (sky.has(frame.pixels[y * W + x]!)) n++
      return n / W
    }
    // Well above the horizon is sky, apart from whatever is standing up in it:
    // a signal on a mast arm reaches a long way above the vanishing point.
    expect(shareOfSky(frame.horizon - 30)).toBeGreaterThan(0.85)
    // The bottom of the frame is the road at your bumper. None of it is sky.
    expect(shareOfSky(H - 1)).toBe(0)
  })

  it('shows the trees the player planted, when they have grown', () => {
    const leaves = new Set<number>([
      PALETTE_INDEX.leafDark, PALETTE_INDEX.leafMid, PALETTE_INDEX.leafLight, PALETTE_INDEX.leafHigh,
    ])
    // Above the horizon only: grass and a planted median are the same greens,
    // and they are on the ground.
    const crowns = (state: SimState): number => {
      const world = buildDriveWorld(state)
      let drive = newDrive(world)
      for (let t = 0; t < 12; t += 1 / 30) drive = stepDrive(world, drive, { throttle: 1, steer: 0 }, 1 / 30)
      const frame = makeDriveFrame(W, H)
      renderDrive(world, drive, frame, 12000)
      let n = 0
      for (let y = 0; y < frame.horizon; y++) {
        for (let x = 0; x < W; x++) if (leaves.has(frame.pixels[y * W + x]!)) n++
      }
      return n / (frame.horizon * W)
    }
    const bare = crowns(play('a', 20))
    const planted = crowns(play('a', 20, { 2: ['street.plant_trees'] }))
    expect(planted).toBeGreaterThan(bare + 0.02)
  })

  it('draws a frame well inside a sixtieth of a second', () => {
    const world = buildDriveWorld(play('a', 18))
    let drive = newDrive(world)
    for (let t = 0; t < 20; t += 1 / 30) drive = stepDrive(world, drive, { throttle: 1, steer: 0 }, 1 / 30)
    const frame = makeDriveFrame(640, 360)

    renderDrive(world, drive, frame, 0)
    const started = performance.now()
    const runs = 30
    for (let i = 0; i < runs; i++) renderDrive(world, drive, frame, i * 33)
    const each = (performance.now() - started) / runs
    expect(each, `${each.toFixed(2)}ms per frame at 640x360`).toBeLessThan(8)
  })
})

describe('the signals', () => {
  it('are green for about the share of the cycle the model gives the boulevard', () => {
    const world: DriveWorld = buildDriveWorld(play('a', 0))
    for (let i = 0; i < world.model.junctions.length; i++) {
      let green = 0
      const samples = 2000
      for (let n = 0; n < samples; n++) {
        if (signalIsGreen(world, i, (n / samples) * world.cyclesSec[i]! * 40)) green++
      }
      expect(Math.abs(green / samples - world.greenRatio)).toBeLessThan(0.06)
    }
  })

  it('runs uncoordinated signals on their own clocks', () => {
    const state = play('a', 0)
    state.street.signalPolicy = 'balanced'
    const world = buildDriveWorld(state)
    expect(new Set(world.cyclesSec.map((c) => c.toFixed(2))).size).toBeGreaterThan(1)
  })

  it('runs a coordinated corridor on one clock, because that is what coordination is', () => {
    const state = play('a', 0)
    state.street.signalPolicy = 'vehicle_progression'
    const world = buildDriveWorld(state)
    expect(new Set(world.cyclesSec.map((c) => c.toFixed(2))).size).toBe(1)
  })

  it('holds you through a second cycle once the corridor is over capacity', () => {
    const easy = buildDriveWorld(play('a', 0))
    const state = play('a', 0)
    state.traffic.volumeCapacityRatio = 1.15
    const jammed = buildDriveWorld(state)
    expect(easy.queueSec).toBe(0)
    expect(jammed.queueSec).toBeGreaterThan(20)
  })
})

describe('the speed the traffic allows', () => {
  it('is the running speed between the lights, not the model journey speed', () => {
    // Taking the model's number would charge the player for the signals twice,
    // once in the number and again at every red.
    const world = buildDriveWorld(play('a', 0))
    expect(platoonSpeedMph(world)).toBeGreaterThan(world.peakSpeedMph)
    expect(platoonSpeedMph(world)).toBeLessThanOrEqual(world.designSpeedMph)
  })

  it('falls when the player narrows the street', () => {
    const before = buildDriveWorld(play('a', 0))
    const after = buildDriveWorld(play('a', 14, {
      7: ['capital.road_diet'], 9: ['street.add_kerb_parking'], 12: ['street.lower_target_speed'],
    }))
    expect(platoonSpeedMph(after)).toBeLessThan(platoonSpeedMph(before))
  })
})
