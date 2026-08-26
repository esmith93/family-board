/**
 * The front page of the Fairview Ledger.
 *
 * Assembly only: this module decides which of the year's stories are worth the
 * front, in what order, and who gets the letters column. It does not know what
 * any of them mean. Neither does the paper.
 *
 * The Ledger is a weekly with a circulation of nine thousand, one reporter on
 * the city beat, and a habit of running whatever happened most recently at the
 * top. It has never held a story to compare it with one from a decade ago,
 * because there is nobody there to do that. Its memory - `PaperMemory` - exists
 * so that it does not print the same sentence twice, and for no other reason.
 */

import type { Observation } from './observation'
import { STORIES, type Story } from './stories'
import { writeLetter, type Letter } from './letters'
import type { Circumstance, PaperMemory, Resident } from './residents'

/**
 * Where the photographer was sent, and what the desk wrote under the picture.
 * The renderer takes `at` as a position along the corridor, 0 at the west end
 * and 1 at the east.
 */
export interface Photo {
  at: number
  caption: string
}

export interface FrontPage {
  year: number
  masthead: string
  volume: string
  dateline: string
  price: string
  lead: Story
  seconds: Story[]
  briefs: Story[]
  letter: Letter | null
  photo: Photo | null
  /** True on the single issue where the paper first comes round. */
  turned: boolean
}

/**
 * The Ledger's dateline. The simulation counts years from zero and never names
 * one; the paper has to print something, so the front page is dated from a
 * founding the paper is very proud of and a first year of the programme set in
 * the mid-nineties, which is when a state DOT would have been handing out
 * ninety-ten money for a six-lane arterial.
 */
const FIRST_YEAR = 1994
const FOUNDED = 1889

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const ROMAN: [number, string][] = [
  [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
]

/**
 * A tiny self-contained hash. The paper does not reach into the simulation for
 * its random numbers, so the whole module stays free of sim imports and the
 * structural test can say so plainly.
 */
function hash(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  // FNV alone propagates a change in the last character upward through the
  // multiply and almost nowhere else, so the top bits barely move between
  // ':1' and ':2' and the paper comes out on the seventeenth of May for thirty
  // years running. The finalising avalanche is what fixes that.
  h ^= h >>> 16
  h = Math.imul(h, 0x21f0aaad)
  h ^= h >>> 15
  h = Math.imul(h, 0x735a2d97)
  h ^= h >>> 15
  return (h >>> 0) / 0x1_0000_0000
}

function roman(n: number): string {
  let out = ''
  let left = n
  for (const [value, numeral] of ROMAN) {
    while (left >= value) {
      out += numeral
      left -= value
    }
  }
  return out
}

function dateline(seed: string, year: number): string {
  const calendar = FIRST_YEAR + year
  const month = Math.floor(hash(`${seed}:month:${year}`) * 12)
  const day = 1 + Math.floor(hash(`${seed}:day:${year}`) * 28)
  const weekday = DAYS[new Date(Date.UTC(calendar, month, day)).getUTCDay()]!
  return `${weekday}, ${MONTHS[month]} ${day}, ${calendar}`
}

const isFiller = (id: string): boolean => id.startsWith('filler.')

/**
 * A corridor a person would happily stand on, and the number of consecutive
 * years of that it takes before the Ledger will say so in print.
 *
 * The two together are the whole of the turn. There is no year gate: a paper
 * that came round on a fixed date would be a schedule wearing a byline, and
 * the player would feel it. What there is instead is a slow desk. The street
 * has to be good, and then it has to stay good for seven years, and only then
 * does somebody at the Ledger walk it on a Thursday evening and write the
 * piece.
 *
 * Measured over thirteen corridors: a patient plan turns the paper in about
 * eight runs in ten, with a median around the twentieth year and a spread from
 * the sixteenth to the twenty-third. Doing nothing, taking the widening, and
 * planting trees along a six-lane arterial without touching anything else all
 * turn it in none.
 */
const GOOD_ENOUGH_TO_STAND_ON = 0.55
const GOOD_ENOUGH_TO_PRINT = 0.60
const YEARS_BEFORE_THE_DESK_NOTICES = 7

/**
 * Advance the desk's slow opinion of the street and report whether this is the
 * week it changes. Mutates the memory: the count is the paper's, not the city's.
 */
function updateTurn(o: Observation, memory: PaperMemory): { turned: boolean; firstTime: boolean } {
  memory.goodYears = o.streetMood > GOOD_ENOUGH_TO_STAND_ON ? memory.goodYears + 1 : 0
  if (memory.noticedAt === null
    && memory.goodYears >= YEARS_BEFORE_THE_DESK_NOTICES
    && o.streetMood > GOOD_ENOUGH_TO_PRINT) {
    memory.noticedAt = o.year
    return { turned: true, firstTime: true }
  }
  // Once it has come round it stays come round. Papers do not go back either.
  return { turned: memory.noticedAt !== null, firstTime: false }
}

/** How much the desk holds against a story it has already run. */
function stalenessPenalty(id: string, slot: string, lastRun: number | undefined, year: number): number {
  if (lastRun === undefined) return 0
  const since = year - lastRun
  // Filler is filler: nobody minds seeing "Council to meet Tuesday" down the
  // column again. Filler at the top of the page is a different matter, and
  // two of them alternating for a decade reads like a broken clock.
  if (isFiller(id)) return slot === 'lead' ? (since <= 6 ? -14 : -3) : -2
  return since <= 4 ? -30 : -16
}

interface Scored {
  id: string
  slot: 'lead' | 'second' | 'brief'
  score: number
  story: Story
}

/**
 * Build the front. One lead, one or two seconds, a column of briefs, and a
 * letter. A lead that loses is still a story, so it drops to the seconds; a
 * second that loses drops to the briefs. That is how a small paper fills a
 * page, and it is why the reader sees the same subject two years running in
 * different sizes.
 */
export function composeFrontPage(
  o: Observation,
  memory: PaperMemory,
  circumstanceOf: (r: Resident) => Circumstance,
  seed: string,
): FrontPage {
  const turn = updateTurn(o, memory)

  const scored: Scored[] = []
  for (const template of STORIES) {
    if (!template.when(o, turn.turned)) continue
    // Whatever else it does, a paper does not lead twice on the same story.
    const barred = template.id === memory.lastLead
    const jitter = hash(`${seed}:story:${template.id}:${o.year}`) * 5 - 2.5
    const score = template.weight(o) + jitter + stalenessPenalty(template.id, template.slot, memory.usedStories[template.id], o.year)
    scored.push({
      id: template.id,
      slot: barred ? 'second' : template.slot,
      score,
      story: { id: template.id, slot: template.slot, ...template.build(o) },
    })
  }
  scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))

  const taken = new Set<string>()
  const take = (want: 'lead' | 'second' | 'brief', count: number, demote = true): Scored[] => {
    const out: Scored[] = []
    // First pass: stories written for this slot. Second pass: anything bigger
    // that did not make it, cut down to size.
    const passes = demote ? [want, ...biggerThan(want)] : [want]
    for (const slot of passes) {
      for (const candidate of scored) {
        if (out.length >= count) return out
        if (candidate.slot !== slot || taken.has(candidate.id)) continue
        taken.add(candidate.id)
        out.push(candidate)
      }
    }
    return out
  }

  const lead = take('lead', 1, false)[0] ?? fallbackLead(o)
  taken.add(lead.id)
  const seconds = take('second', lead.story.body ? 1 : 2)
  const briefs = take('brief', lead.story.body ? 3 : 4)

  const letter = writeLetter(o, memory, circumstanceOf, turn.turned)

  // The morgue. Written after the page is set, not before.
  memory.lastLead = lead.id
  memory.usedStories[lead.id] = o.year
  for (const s of [...seconds, ...briefs]) memory.usedStories[s.id] = o.year
  if (letter) {
    memory.usedLetters[letter.templateId] = o.year
    const appearances = memory.appearances[letter.resident.id] ?? []
    appearances.push(o.year)
    memory.appearances[letter.resident.id] = appearances
  }

  return {
    year: o.year,
    masthead: 'The Fairview Ledger',
    volume: `Vol. ${roman(FIRST_YEAR + o.year - FOUNDED)}, No. ${1 + Math.floor(hash(`${seed}:issue:${o.year}`) * 52)}`,
    dateline: dateline(seed, o.year),
    price: o.year < 12 ? 'Fifty cents' : o.year < 24 ? 'One dollar' : 'One dollar fifty',
    lead: lead.story,
    seconds: seconds.map((s) => s.story),
    briefs: briefs.map((s) => s.story),
    letter,
    photo: photoFor(lead.story, o),
    turned: turn.firstTime,
  }
}

function biggerThan(slot: 'lead' | 'second' | 'brief'): ('lead' | 'second')[] {
  if (slot === 'second') return ['lead']
  if (slot === 'brief') return ['second', 'lead']
  return []
}

/** Never actually reached - `filler.quiet` runs every year - but a paper always goes out. */
function fallbackLead(o: Observation): Scored {
  return {
    id: 'filler.quiet',
    slot: 'lead',
    score: 0,
    story: {
      id: 'filler.quiet',
      slot: 'lead',
      headline: 'A quiet year on Commerce Boulevard',
      subhead: `Counts steady at ${Math.round(o.aadt).toLocaleString('en-US')} vehicles a day`,
      photoAt: 0.5,
    },
  }
}

const PLACES: [number, string][] = [
  [0.2, 'the west end of Commerce Boulevard, near Ninth'],
  [0.4, 'Commerce Boulevard at Delaware Avenue'],
  [0.6, 'the centre block of Commerce Boulevard'],
  [0.8, 'Commerce Boulevard outside the shopping centre'],
  [1.1, 'the east end of Commerce Boulevard, by the interchange ramps'],
]

function placeName(at: number): string {
  for (const [limit, name] of PLACES) if (at < limit) return name
  return 'Commerce Boulevard'
}

/**
 * The caption. A local paper describes the picture and nothing else: where the
 * photographer stood, what time it was, and who is in it. It does not caption
 * the meaning of a photograph because it does not believe photographs have one.
 */
function photoFor(story: Story, o: Observation): Photo | null {
  if (story.photoAt === undefined) return null
  const place = placeName(story.photoAt)
  const subject = story.id.split('.')[0]
  const hour = o.peakSpeedMph < 20 ? 'at the evening peak' : 'on a weekday afternoon'
  const caption =
    subject === 'works' ? `${capitalise(place)}, with the contractor's plant in place.`
    : subject === 'safety' ? `${capitalise(place)}, where the collision occurred.`
    : subject === 'business' ? `${capitalise(place)}. The unit on the right has been vacant since spring.`
    : subject === 'money' ? `${capitalise(place)}. The city's own pavement is due for resurfacing.`
    : subject === 'turn' ? `${capitalise(place)}, ${hour}. Photograph by a staff photographer.`
    : `${capitalise(place)}, ${hour}.`
  return { at: story.photoAt, caption }
}

const capitalise = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1)
