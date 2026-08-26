/**
 * The newspaper photograph.
 *
 * A local weekly in this period is printed on a web press at around 85 lines
 * to the inch in one colour. Everything the photographer shot arrives on the
 * front page as a coarse dot screen in black ink on grey paper: the shadows
 * fill in, the highlights blow out to bare newsprint, and the whole thing is
 * about six per cent as much information as the negative held.
 *
 * That is the point of running the game's own render through this rather than
 * drawing a separate illustration. The picture in the paper IS the corridor as
 * it stands this year, photographed at the place the lead story is about - so
 * the year the boulevard finally has trees on it, the trees are in the photo,
 * and nobody had to write a line of copy saying so.
 */

/** Two inks: the paper it is printed on, and the one colour it is printed in. */
export interface NewsprintInk {
  paper: [number, number, number]
  ink: [number, number, number]
}

/** Warm grey stock and a soft, slightly blue-black rotary ink. */
export const DEFAULT_INK: NewsprintInk = {
  paper: [226, 221, 208],
  ink: [28, 26, 30],
}

export interface HalftoneOptions {
  /** Screen ruling, in pixels per cell. Bigger is coarser and cheaper to print. */
  cell?: number
  /** Screen angle in degrees. Real single-colour work is screened at 45. */
  angle?: number
  /** Tone curve. Above 1 the picture goes muddy, which is what newsprint does. */
  gamma?: number
  /** How much of the picture the press loses at each end. */
  blackPoint?: number
  whitePoint?: number
  /**
   * Set the black and white points from the picture itself rather than from
   * fixed values. This is what a platemaker does with a negative, and it is
   * what makes a photograph of a night street readable at all: the game's own
   * palette is a dark one, and screened flat it prints as a black rectangle.
   */
  autoLevels?: boolean
  ink?: NewsprintInk
}

const LUMA_R = 0.2126
const LUMA_G = 0.7152
const LUMA_B = 0.0722

/**
 * Dot radius for a wanted ink coverage.
 *
 * These are not the same number. A dot of radius r in a cell of side c covers
 * pi*r^2/c^2 of the cell only while it stays inside it; past r = c/2 it spills
 * into its neighbours and they spill back, and the union stops growing as fast
 * as the area does. Getting this wrong by the factor of pi it is wrong by is
 * what turns a photograph into a black rectangle.
 *
 * Rather than derive the union analytically, measure it once: rasterise a cell
 * with its own dot and its eight neighbours at a fine sub-resolution, for a
 * ladder of radii, and invert the result into a lookup.
 */
const RADIUS_STEPS = 64
const SUB = 24
const RADIUS_FOR_COVERAGE = ((): Float32Array => {
  const coverageAt = new Float32Array(RADIUS_STEPS + 1)
  const maxT = Math.SQRT2 / 2
  for (let step = 0; step <= RADIUS_STEPS; step++) {
    const t = (step / RADIUS_STEPS) * maxT
    let covered = 0
    for (let sy = 0; sy < SUB; sy++) {
      for (let sx = 0; sx < SUB; sx++) {
        const x = (sx + 0.5) / SUB - 0.5
        const y = (sy + 0.5) / SUB - 0.5
        let inside = false
        for (let ny = -1; ny <= 1 && !inside; ny++) {
          for (let nx = -1; nx <= 1; nx++) {
            const dx = x - nx
            const dy = y - ny
            if (dx * dx + dy * dy <= t * t) { inside = true; break }
          }
        }
        if (inside) covered++
      }
    }
    coverageAt[step] = covered / (SUB * SUB)
  }
  // Invert: for each wanted coverage, the smallest radius that reaches it.
  const table = new Float32Array(RADIUS_STEPS + 1)
  for (let i = 0; i <= RADIUS_STEPS; i++) {
    const wanted = i / RADIUS_STEPS
    let step = 0
    while (step < RADIUS_STEPS && coverageAt[step + 1]! < wanted) step++
    const lo = coverageAt[step]!
    const hi = coverageAt[step + 1] ?? 1
    const frac = hi > lo ? (wanted - lo) / (hi - lo) : 0
    table[i] = ((step + Math.max(0, Math.min(1, frac))) / RADIUS_STEPS) * maxT
  }
  return table
})()

/** Radius, in cells, that inks `coverage` of the page. */
function dotRadius(coverage: number): number {
  const x = Math.max(0, Math.min(1, coverage)) * RADIUS_STEPS
  const i = Math.min(RADIUS_STEPS - 1, Math.floor(x))
  const t = x - i
  return RADIUS_FOR_COVERAGE[i]! * (1 - t) + RADIUS_FOR_COVERAGE[i + 1]! * t
}

/**
 * Screen an RGBA image into a two-ink halftone.
 *
 * Takes and returns raw bytes rather than `ImageData` so it can be tested
 * without a DOM, the same bargain `applyPalette` makes.
 */
export function halftone(
  rgba: Uint8ClampedArray, width: number, height: number, options: HalftoneOptions = {},
): Uint8ClampedArray {
  const cell = Math.max(2, options.cell ?? 3)
  const gamma = options.gamma ?? 1.35
  const { paper, ink } = options.ink ?? DEFAULT_INK

  const radians = ((options.angle ?? 45) * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)

  // Average the source down onto the screen lattice first. Sampling one pixel
  // per cell would alias the road markings into a moire and lose the trees.
  const tone = new Float32Array(Math.ceil(width / cell) * Math.ceil(height / cell))
  const counts = new Float32Array(tone.length)
  const cellsAcross = Math.ceil(width / cell)
  const cellsDown = Math.ceil(height / cell)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const alpha = rgba[i + 3]! / 255
      const luma = (LUMA_R * rgba[i]! + LUMA_G * rgba[i + 1]! + LUMA_B * rgba[i + 2]!) / 255
      // Anything transparent is bare paper, not black.
      const value = luma * alpha + (1 - alpha)
      const cx = Math.min(cellsAcross - 1, (x / cell) | 0)
      const cy = Math.min(cellsDown - 1, (y / cell) | 0)
      const c = cy * cellsAcross + cx
      tone[c]! += value
      counts[c]! += 1
    }
  }
  for (let i = 0; i < tone.length; i++) {
    tone[i] = counts[i]! > 0 ? tone[i]! / counts[i]! : 1
  }

  let black = options.blackPoint ?? 0.06
  let white = options.whitePoint ?? 0.92
  // Exposure, as a gamma applied after the levels. 1 leaves the picture alone.
  let exposure = 1
  if (options.autoLevels) {
    const sorted = Float32Array.from(tone).sort()
    const at = (q: number): number =>
      sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * q)))] ?? 0
    const low = at(0.02)
    const high = at(0.98)
    if (high - low > 0.02) {
      black = low
      white = high
      // Stretching the range is not enough on its own. A corridor that is four
      // fifths asphalt has a histogram piled up in one narrow band with a few
      // bright kerbs above it, and stretching only moves the pile - it comes
      // out as a black rectangle with white streaks in it. So expose for the
      // mid-tone, the way a photographer does: find the median and bend the
      // curve until the median prints as a half-tone dot.
      const median = Math.max(0.001, Math.min(0.999, (at(0.5) - low) / (high - low)))
      exposure = Math.max(0.35, Math.min(3, Math.log(0.5) / Math.log(median)))
    }
  }

  const out = new Uint8ClampedArray(width * height * 4)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Rotate into screen space, find the cell centre, and ask how far this
      // pixel is from it. Inside the dot: ink. Outside: paper.
      const rx = x * cos + y * sin
      const ry = -x * sin + y * cos
      const gx = Math.floor(rx / cell)
      const gy = Math.floor(ry / cell)
      const centreX = (gx + 0.5) * cell
      const centreY = (gy + 0.5) * cell

      // Sample the tone at the unrotated position of that dot's centre.
      const sx = centreX * cos - centreY * sin
      const sy = centreX * sin + centreY * cos
      const cx = Math.min(cellsAcross - 1, Math.max(0, (sx / cell) | 0))
      const cy = Math.min(cellsDown - 1, Math.max(0, (sy / cell) | 0))

      let value = tone[cy * cellsAcross + cx]!
      value = (value - black) / Math.max(0.001, white - black)
      value = Math.max(0, Math.min(1, value))
      if (exposure !== 1) value = Math.pow(value, exposure)
      const coverage = Math.pow(1 - value, gamma)

      const radius = dotRadius(coverage) * cell
      const dx = rx - centreX
      const dy = ry - centreY
      const inked = dx * dx + dy * dy <= radius * radius

      const i = (y * width + x) * 4
      const colour = inked ? ink : paper
      out[i] = colour[0]
      out[i + 1] = colour[1]
      out[i + 2] = colour[2]
      out[i + 3] = 255
    }
  }
  return out
}

/**
 * How dark the screened image came out, 0 for bare paper and 1 for solid ink.
 * A press operator would call this the coverage; it is here so a test can say
 * that a photograph of a street is neither blank nor a black rectangle.
 */
export function inkCoverage(rgba: Uint8ClampedArray, options: HalftoneOptions = {}): number {
  const ink = (options.ink ?? DEFAULT_INK).ink
  let inked = 0
  const pixels = rgba.length / 4
  for (let i = 0; i < rgba.length; i += 4) {
    if (Math.abs(rgba[i]! - ink[0]) < 8 && Math.abs(rgba[i + 1]! - ink[1]) < 8) inked++
  }
  return inked / pixels
}
