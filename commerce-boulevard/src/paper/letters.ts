/**
 * Letters to the editor.
 *
 * The rule for every line in this file: a resident describes what happened to
 * them. They do not explain it, they do not name it, and they are frequently
 * wrong about the cause. A letter that reads like an argument has failed.
 *
 * The pairs matter more than the individual letters. Marguerite writes in year
 * three that the widening took fifteen minutes off her morning, and in year
 * nineteen that it has put twenty back on, and she never connects them. That
 * is the whole game, in two letters, and neither one contains an idea.
 */

import type { Observation } from './observation'
import type { Circumstance, PaperMemory, Resident, Voice } from './residents'

export interface Letter {
  templateId: string
  resident: Resident
  text: string
  signature: string
}

export interface LetterContext {
  o: Observation
  resident: Resident
  circumstance: Circumstance
  timesWritten: number
  /** Years since this resident last wrote. */
  gap: number
  /** Whether the paper has come round. Its state, not the writer's. */
  turned: boolean
}

interface Template {
  id: string
  voice: Voice | 'any'
  when: (c: LetterContext) => boolean
  weight: (c: LetterContext) => number
  text: (c: LetterContext) => string
}

const T = (t: Template): Template => t

/** The corridor is genuinely pleasant, and it took long enough for anyone to say so. */
const turned = (c: LetterContext): boolean => c.turned

export const LETTERS: readonly Template[] = [
  // --- The commuter: the arc the whole game is built on --------------------
  T({
    id: 'commuter.quicker',
    voice: 'commuter',
    when: (c) => c.o.speedChange > 0.8,
    weight: () => 10,
    text: () => 'Something has changed on Commerce and my morning is shorter by a good ten minutes. '
      + 'I have no idea who to thank and I am not going to ask in case they take it back.',
  }),
  T({
    id: 'commuter.quicker.again',
    voice: 'commuter',
    when: (c) => c.o.speedChange > 0.4 && c.timesWritten > 0,
    weight: () => 6,
    text: () => 'Second good month in a row on the boulevard. I have started leaving at ten past '
      + 'instead of quarter to. Small things.',
  }),
  T({
    id: 'commuter.slower',
    voice: 'commuter',
    when: (c) => c.o.speedChange < -0.5 && c.o.year >= 8,
    weight: (c) => 9 + (c.timesWritten > 1 ? 4 : 0),
    text: (c) => `It is back to what it was. ${c.timesWritten > 1 ? 'I wrote in a few years ago to say it had got better, and I would like that letter back. ' : ''}`
      + 'There are more lanes than there were and it takes me longer than it did. I would like somebody to explain that to me.',
  }),
  T({
    id: 'commuter.resigned',
    voice: 'commuter',
    when: (c) => c.o.peakSpeedMph < 16 && c.o.year >= 12,
    weight: () => 8,
    text: () => 'I now leave twenty-five minutes before I need to. My daughter says I should move '
      + 'closer to work. My work is four miles away.',
  }),
  T({
    id: 'commuter.turned',
    voice: 'commuter',
    when: turned,
    weight: (c) => (c.timesWritten > 2 ? 12 : 6),
    text: () => 'I left the car at home on Thursday, which I did not decide to do. I simply walked '
      + 'out of the door and kept going, and by the time I noticed I was most of the way there.',
  }),

  // --- The retiree: the long memory ---------------------------------------
  T({
    id: 'retiree.thirty_years',
    voice: 'retiree',
    when: (c) => c.o.year <= 6,
    weight: () => 7,
    text: (c) => `I have lived off Commerce for thirty-one years. In that time it has been widened once, `
      + `resurfaced twice and improved, by my count, never. ${c.o.worksUnderWay.length > 0 ? 'They are at it again outside my window.' : 'I am told there are plans.'}`,
  }),
  T({
    id: 'retiree.noise',
    voice: 'retiree',
    when: (c) => c.o.noiseDba > 72,
    weight: () => 8,
    text: (c) => `I cannot hold a conversation in my own front garden. My wife says I have gone deaf. `
      + `I have not gone deaf. ${c.o.aadt > 40000 ? 'There are simply more of them and they are going faster.' : 'They are simply going faster.'}`,
  }),
  T({
    id: 'retiree.trees_mocking',
    voice: 'retiree',
    when: (c) => c.o.canopy < 0.2 && c.o.events.some((e) => String(e.detail.instrument ?? '').includes('plant_trees')),
    weight: () => 9,
    text: () => 'They have planted sticks along the boulevard and called them trees. I am seventy-four. '
      + 'I would like the council to be honest with me about who these are for.',
  }),
  T({
    id: 'retiree.trees_grown',
    voice: 'retiree',
    when: (c) => c.o.canopy > 0.3 && c.o.year >= 14,
    weight: () => 11,
    text: () => 'The sticks they planted are trees now. I sit under one of them most afternoons and '
      + 'I have not apologised to anybody and I do not intend to.',
  }),
  T({
    id: 'retiree.turned',
    voice: 'retiree',
    when: turned,
    weight: () => 9,
    text: () => 'I walked to the chemist on Tuesday. I want to be clear that I did not set out to '
      + 'make a point. I simply forgot to take the car and did not miss it until I got home.',
  }),

  // --- The merchant --------------------------------------------------------
  T({
    id: 'merchant.works',
    voice: 'merchant',
    when: (c) => c.o.worksUnderWay.length > 0,
    weight: () => 11,
    text: (c) => `${c.o.worksUnderWay.length > 1 ? 'Two sets of cones' : 'Cones'} outside my door since March. `
      + 'I am told this is progress. What I can tell you is that it is a lease I am not certain I will renew.',
  }),
  T({
    id: 'merchant.closing',
    voice: 'merchant',
    when: (c) => c.o.businessesClosed > c.o.businessesOpened,
    weight: (c) => 8 + Math.min(4, c.o.businessesClosed - c.o.businessesOpened),
    text: (c) => `The unit next to mine went dark in ${c.o.year % 2 === 0 ? 'April' : 'September'}, which makes three on this stretch. `
      + 'Forty thousand cars a day go past and not one of them stops.',
  }),
  T({
    id: 'merchant.parking',
    voice: 'merchant',
    when: (c) => c.o.events.some((e) => String(e.detail.instrument ?? '').includes('kerb_parking')),
    weight: () => 9,
    text: () => 'They have been rearranging the kerb again. Every trader on this block will tell you '
      + 'the same thing, which is that nobody asked us and we are the ones who will find out.',
  }),
  T({
    id: 'merchant.good_year',
    voice: 'merchant',
    when: (c) => c.o.vacancyMood === 'filling' && c.o.year >= 10,
    weight: () => 10,
    text: () => 'First June in eleven years I have not sat down in the back and done the sums about '
      + 'closing. I do not know what to attribute it to. Footfall, I suppose.',
  }),
  T({
    id: 'merchant.turned',
    voice: 'merchant',
    when: turned,
    weight: () => 10,
    text: () => 'People stand outside my window now and read the menu before they come in. They never '
      + 'used to stand anywhere on this street. There was nowhere to stand.',
  }),

  // --- The parent ----------------------------------------------------------
  T({
    id: 'parent.crossing',
    voice: 'parent',
    when: (c) => c.circumstance.children > 0 && c.o.streetMood < 0.45,
    weight: () => 10,
    text: () => 'My daughter is eleven and I drive her four blocks to school. Four blocks. I would '
      + 'like somebody at the city to tell me, in plain words, why I have to do that.',
  }),
  T({
    id: 'parent.crash',
    voice: 'parent',
    when: (c) => c.o.fatalityChange > 0.4 || c.o.crashChange > 12,
    weight: () => 13,
    text: (c) => `Another one at the ${c.o.year % 2 === 0 ? 'Linden' : 'Pike Street'} lights. My children are not allowed to cross `
      + 'Commerce on their own and I am beginning to think that is not a rule I made.',
  }),
  T({
    id: 'parent.turned',
    voice: 'parent',
    when: (c) => turned(c) && c.circumstance.children > 0,
    weight: () => 13,
    text: () => 'She walks now. I watch from the corner until she reaches the crossing and then I go '
      + 'back inside, and I would not have believed a word of that three years ago.',
  }),

  // --- The renter ----------------------------------------------------------
  T({
    id: 'renter.rent',
    voice: 'renter',
    when: (c) => c.circumstance.rentBurden > 0.3 || c.o.rentChange > 45,
    weight: () => 9,
    text: () => 'My rent went up again. There is nowhere within walking distance to spend what is '
      + 'left of it, so I suppose that is one way of balancing the books.',
  }),
  T({
    id: 'renter.car',
    voice: 'renter',
    when: (c) => c.circumstance.vehicles >= 1 && c.circumstance.income < 52_000,
    weight: () => 8,
    text: () => 'I earn what I earn and a quarter of it is the car. I do not want the car. I want '
      + 'the things the car is for, and they are all four miles away.',
  }),
  T({
    id: 'renter.turned',
    voice: 'renter',
    when: turned,
    weight: () => 11,
    text: () => 'There is a place on the corner now that does a decent coffee and stays open past '
      + 'six. I am aware this is a small thing to write to a newspaper about. It is not small to me.',
  }),
  T({
    id: 'renter.carless',
    voice: 'renter',
    when: (c) => turned(c) && c.circumstance.vehicles === 0,
    weight: () => 14,
    text: () => 'I sold the car in the spring and I have not replaced it, and the money I am not '
      + 'spending on it is the first money I have ever had.',
  }),

  // --- The taxpayer --------------------------------------------------------
  T({
    id: 'taxpayer.deficit',
    voice: 'taxpayer',
    when: (c) => c.o.cityShortfall > 3_500_000,
    weight: (c) => 8 + (c.o.shortfallChange > 0 ? 3 : 0),
    text: () => 'The city says the budget is short. The city said that last year and the year '
      + 'before. I would like to know which of those years we are still paying for.',
  }),
  T({
    id: 'taxpayer.debt',
    voice: 'taxpayer',
    when: (c) => c.o.debt > 1_000_000,
    weight: () => 10,
    text: (c) => `We are borrowing now. I have read the figure twice and I do not think it is a `
      + `figure a city this size should be looking at.${c.o.worksUnderWay.length > 0 ? ' Meanwhile there are cones on Commerce.' : ''}`,
  }),
  T({
    id: 'taxpayer.tax',
    voice: 'taxpayer',
    when: (c) => c.o.taxChanged > 0,
    weight: () => 9,
    text: () => 'They have been at the rate again. Nobody knocked on my door about it and nobody '
      + 'will knock on it when the bill comes either.',
  }),
  T({
    id: 'taxpayer.turned',
    voice: 'taxpayer',
    when: (c) => turned(c) && c.o.shortfallChange < 0,
    weight: () => 12,
    text: () => 'I have been writing to this paper about the budget for nine years and I am obliged '
      + 'to report that the number moved the right way. I am not saying anybody has been vindicated.',
  }),

  // --- Anyone --------------------------------------------------------------
  T({
    id: 'any.heat',
    voice: 'any',
    when: (c) => c.o.daysOver95 > 30 && c.o.canopy < 0.22,
    weight: () => 7,
    text: (c) => `${c.o.daysOver95} days over ninety-five this year. You could not put your hand on `
      + 'a car door on the boulevard in August. There is not one inch of shade the whole length of it.',
  }),
  T({
    id: 'any.works_done',
    voice: 'any',
    when: (c) => c.o.worksFinished.length > 0,
    weight: () => 8,
    text: (c) => `The work outside is finished at last. ${c.o.worksFinished[0]}, according to the sign, `
      + 'which is more than anybody told the people who live here.',
  }),
  T({
    id: 'any.nothing',
    voice: 'any',
    when: () => true,
    weight: () => 1,
    text: () => 'I read in this paper that the council has a plan for Commerce Boulevard. I have '
      + 'lived here long enough to know what a plan is. I will wait.',
  }),

  // --- The ordinary weeks --------------------------------------------------
  // A letters page is mostly this: small complaints, precisely observed, with
  // no idea in them. The column has to fill every week whether or not the city
  // did anything, and it is these letters, not the arc ones, that make the arc
  // ones land when they come.
  T({
    id: 'commuter.left_turn',
    voice: 'commuter',
    when: (c) => c.o.year >= 2,
    weight: () => 6,
    text: () => 'I counted four changes of the light waiting to turn left out of the pharmacy lot on '
      + 'Saturday. Four. A man behind me got out of his van to look at what was holding us up. '
      + 'Nothing was holding us up. That is simply how long it takes.',
  }),
  T({
    id: 'commuter.detour',
    voice: 'commuter',
    when: (c) => c.o.aadt > 34_000 && c.o.year >= 4,
    weight: () => 7,
    text: () => 'I have stopped using the boulevard between four and six and go up Linden and along '
      + 'Pike instead. So does everybody else I know, which rather defeats the object, and the people '
      + 'on Linden are not pleased with us.',
  }),
  T({
    id: 'commuter.gone_soft',
    voice: 'commuter',
    when: (c) => c.o.peakSpeedMph < 22 && c.o.year >= 8,
    weight: () => 6,
    text: (c) => `A mile and a bit, and it takes me the better part of ${c.o.peakSpeedMph < 15 ? 'twelve' : 'nine'} `
      + 'minutes at the end of the day. I have started leaving the office later so as to miss it, which '
      + 'my wife has noticed and does not accept as an explanation.',
  }),
  T({
    id: 'retiree.bus_stop',
    voice: 'retiree',
    when: (c) => c.o.year >= 3,
    weight: () => 6,
    text: () => 'There is a bus stop outside the tyre place with a pole and a timetable and nothing '
      + 'else. No bench, no roof, and a foot of grass between you and the traffic. I am not asking '
      + 'for much. I am asking for somewhere to sit down.',
  }),
  T({
    id: 'retiree.pharmacy',
    voice: 'retiree',
    when: (c) => c.o.businessesClosed > 0,
    weight: () => 7,
    text: () => 'The chemist has moved out to the highway. It is four minutes in the car and I know '
      + 'that is nothing. I used to see three people I knew on the way there and I do not see anybody '
      + 'on the way there now.',
  }),
  T({
    id: 'merchant.access',
    voice: 'merchant',
    when: (c) => c.o.year >= 2,
    weight: () => 6,
    text: () => 'Half of Fairview is on the wrong side of six lanes from my door. They will not cross '
      + 'and I do not blame them. I have customers who drive from the bank opposite, and the bank is '
      + 'two hundred feet away.',
  }),
  T({
    id: 'merchant.chain_rent',
    voice: 'merchant',
    when: (c) => c.o.businessesOpened > 0 && c.o.year >= 5,
    weight: () => 7,
    text: () => 'My landlord has seen what the new place on the corner is paying and would like the '
      + 'same from me. I have been in this unit nineteen years. I sell hardware. I do not have those '
      + 'kind of margins and he knows it.',
  }),
  T({
    id: 'parent.school_run',
    voice: 'parent',
    when: (c) => c.circumstance.children > 0 && c.o.year >= 2,
    weight: () => 8,
    text: () => 'The school is six tenths of a mile from our house and I drive them, every morning, '
      + 'in a queue of other parents doing the identical thing. I am aware of how this sounds. I '
      + 'would like somebody to tell me what else to do.',
  }),
  T({
    id: 'parent.bikes',
    voice: 'parent',
    when: (c) => c.circumstance.children > 0 && c.o.year >= 4,
    weight: () => 7,
    text: () => 'We bought the boys bicycles at Christmas and they ride them round the cul-de-sac in '
      + 'circles. There is nowhere to go from there. Their grandmother rode to school every day of '
      + 'her life and finds the whole situation baffling.',
  }),
  T({
    id: 'parent.rain',
    voice: 'parent',
    when: (c) => c.circumstance.children > 0 && c.o.year >= 6,
    weight: () => 6,
    text: () => 'My daughter waits for the bus on the boulevard verge in whatever the weather is '
      + 'doing. She has a coat. She should not need the coat to stand still in the town she lives in.',
  }),
  T({
    id: 'renter.repairs',
    voice: 'renter',
    when: (c) => c.circumstance.vehicles > 0 && c.o.year >= 3,
    weight: () => 8,
    text: () => 'The transmission went in March and that was the deposit gone. I need the car to get '
      + 'to work and I need the work to keep the car, and I have stopped trying to explain to people '
      + 'which one of those is the problem.',
  }),
  T({
    id: 'renter.groceries',
    voice: 'renter',
    when: (c) => c.circumstance.vehicles === 0,
    weight: () => 9,
    text: () => 'I do the shopping once a fortnight and carry it a mile and a quarter along a road '
      + 'with no pavement on one side. People slow down to look. Nobody has ever stopped.',
  }),
  T({
    id: 'taxpayer.potholes',
    voice: 'taxpayer',
    when: (c) => c.o.year >= 5,
    weight: () => 7,
    text: (c) => `Delaware Avenue has not been resurfaced in my time on it and there is a hole outside `
      + `number forty you could lose a terrier in. ${c.o.worksUnderWay.length > 0 ? 'Meanwhile there is a fortune going into the boulevard.' : 'I have telephoned twice.'}`,
  }),
  T({
    id: 'taxpayer.priorities',
    voice: 'taxpayer',
    when: (c) => c.o.year >= 4,
    weight: () => 6,
    text: () => 'I would like the city to publish, in plain figures, what it spends on Commerce '
      + 'Boulevard and what it spends on the streets people actually live on. I do not expect it to. '
      + 'I would like it to.',
  }),
  T({
    id: 'any.crossing_time',
    voice: 'any',
    when: (c) => c.o.year >= 2,
    weight: () => 6,
    text: () => 'The crossing signal at Delaware gives you eleven seconds. I timed it. My mother is '
      + 'eighty-one and she does not get eleven seconds\' worth of crossing done, so she waits for '
      + 'the next one halfway across on the paint, with the traffic going by on both sides.',
  }),
  T({
    id: 'any.speeding',
    voice: 'any',
    when: (c) => c.o.peakSpeedMph > 33,
    weight: () => 8,
    text: () => 'They come past my house at what I can only describe as freeway speeds. The sign says '
      + 'thirty-five. Nobody does thirty-five. The police tell me they cannot be everywhere and I '
      + 'accept that, but they could be here once.',
  }),
  T({
    id: 'any.parking_sea',
    voice: 'any',
    when: (c) => c.o.year >= 3,
    weight: () => 5,
    text: () => 'I sat in my car in the shopping centre lot on Sunday eating a sandwich and I '
      + 'counted the empty spaces in front of me and gave up at ninety. All that asphalt, and there '
      + 'is not one bench along the whole boulevard.',
  }),
  T({
    id: 'any.litter',
    voice: 'any',
    when: (c) => c.o.year >= 4,
    weight: () => 4,
    text: () => 'Would somebody see to the verge between the car wash and the lights. It is a fright, '
      + 'and it has been a fright for two summers, and it is the first thing anybody sees coming '
      + 'into Fairview from the east.',
  }),
  T({
    id: 'any.vacant',
    voice: 'any',
    when: (c) => c.o.vacancyMood === 'emptying',
    weight: () => 8,
    text: () => 'Four dark units in a row now on the north side, with the signage still up on two of '
      + 'them. It looks like somewhere that something happened to. I am told the letting market is '
      + 'difficult.',
  }),
  T({
    id: 'any.quiet_year',
    voice: 'any',
    when: (c) => c.o.worksUnderWay.length === 0 && c.o.year >= 6,
    weight: () => 4,
    text: () => 'Another year gone and the boulevard is exactly as it was. I do not say that as a '
      + 'complaint, particularly. I say it as an observation, and I have been making the same one '
      + 'for some time.',
  }),

  // --- Leaving -------------------------------------------------------------
  T({
    id: 'any.leaving',
    voice: 'any',
    when: (c) => c.circumstance.rentBurden > 0.42 && c.o.year >= 6,
    weight: () => 20,
    text: (c) => `This is the last of these you will get from me. Between the rent and ${c.circumstance.vehicles > 0 ? 'the car' : 'getting anywhere at all'} `
      + 'there is nothing left at the end of the month, and my sister has a room in Millvale. '
      + 'I did not want to go.',
  }),
]

/** Pick a writer and a letter. Deterministic given the year and the memory. */
export function writeLetter(
  o: Observation, memory: PaperMemory, circumstanceOf: (r: Resident) => Circumstance,
  hasTurned: boolean,
): Letter | null {
  const available = memory.cast.filter((r) => memory.departed[r.id] === undefined)
  if (available.length === 0) return null

  const scored: { letter: Letter; score: number; leaving: boolean }[] = []

  for (const resident of available) {
    const appearances = memory.appearances[resident.id] ?? []
    const context: LetterContext = {
      o,
      resident,
      circumstance: circumstanceOf(resident),
      timesWritten: appearances.length,
      gap: appearances.length > 0 ? o.year - appearances[appearances.length - 1]! : 99,
      turned: hasTurned,
    }

    for (const template of LETTERS) {
      if (template.voice !== 'any' && template.voice !== resident.voice) continue
      // A weekly with nine thousand readers does not reprint a letter. If the
      // column has nothing new this week it runs no column, which is also what
      // a weekly with nine thousand readers does.
      if (memory.usedLetters[template.id] !== undefined) continue
      if (!template.when(context)) continue

      let score = template.weight(context)
      // The letters page likes a familiar name, but not the same one twice running.
      if (context.gap <= 1) score -= 12
      else if (context.gap <= 2) score -= 4
      if (context.timesWritten >= 2) score += 3

      scored.push({
        letter: {
          templateId: template.id,
          resident,
          text: template.text(context),
          signature: `${resident.name}, ${resident.street}`,
        },
        score,
        leaving: template.id === 'any.leaving',
      })
    }
  }

  if (scored.length === 0) return null
  scored.sort((a, b) => b.score - a.score || a.letter.templateId.localeCompare(b.letter.templateId))
  const chosen = scored[0]!
  if (chosen.leaving) memory.departed[chosen.letter.resident.id] = o.year
  return chosen.letter
}
