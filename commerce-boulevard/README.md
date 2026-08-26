# Commerce Boulevard

A browser game about a broke American city and one street.

You are the newly hired Public Works Director of **Fairview**, population 120,000. The
budget does not balance, the residents are angry, and the businesses are closing. You
have one corridor — Commerce Blvd, 1.2 miles, six lanes, strip malls, 55% surface
parking — and thirty years.

Nobody will tell you what to do about it.

---

## Status: phases 1 to 4 complete

The build order puts the simulation first, headless and tested, so that the
argument exists before the pixels do.

| Phase | | |
| --- | --- | --- |
| 1 | Simulation core, `MODEL.md`, tests | **done** |
| 2 | Isometric renderer + procedural sprite factory | **done** |
| 3 | Instruments UI + two-currency economy | **done** |
| 4 | Year advance + newspaper generator | **done** |
| 5 | Raycaster (drive) and side-scroll (walk) cameras | not started |
| 6 | Web Audio synthesis | not started |
| 7 | Ledger View reveal + year-30 scoring | not started |
| 8 | Onboarding, tuning, polish | not started |

## Running it

```bash
npm install
npm run dev       # the isometric view, at localhost:5173
npm test          # 259 tests across the model, the renderer, the economy and the paper
npm run model     # regenerate MODEL.md from the constant registry
npm run sim       # play four scripted strategies and print thirty years of each
npm run sweep     # compare strategies across thirteen generated corridors
npm run paper     # read thirty years of the Fairview Ledger at the terminal
```

In the view: **drag** to pan, **wheel** to zoom, **space** to advance a year,
**1–4** for day / dusk / night / overcast, **Q W E T** for the seasons.
Instruments are in the dock at the bottom; the caret at its right collapses it.

Pin a corridor with `?seed=fairview` if you want the same one twice.

## What is in here

```
src/sim/            The simulation. Pure, headless, deterministic, no DOM.
  constants.ts      Every number, with its source, range and confidence.
  sourced.ts        The machinery that makes a constant carry its citation.
  rng.ts            Seeded PRNG. Nothing in sim/ may call Math.random().
  corridor.ts       Fairview at year zero.
  landuse.ts        What each land use is, physically and fiscally.
  traffic.ts        Capacity, speed, induced demand, evaporation.
  environment.ts    Noise, air, heat, traffic stress, hostility.
  travel.ts         Reachability and emergent mode choice.
  safety.ts         Crash frequency and severity.
  economy.ts        Retail viability, housing, land value, redevelopment.
  fiscal.ts         Revenue, liability, debt, and the Ledger.
  instruments.ts    What the player can do, and what it costs.
  glossary.ts       Vocabulary the player earns by causing the thing.
  step.ts           One year of Fairview.
src/paper/          The Fairview Ledger. A character, not a narrator.
  observation.ts    The only thing the paper is allowed to know.
  residents.ts      Six regulars, matched to real households.
  letters.ts        Fifty letters. None of them contains an idea.
  stories.ts        Front-page copy, including a great deal of filler.
  paper.ts          Which stories make the front, and when the desk turns.
src/ui/             The chrome: instruments, the two currencies, the cold open.
  app.ts            Meters, tabs, cards, the commit rail, the year advance.
  opening.ts        The budget, the job, and the ninety-ten offer.
  newspaper.ts      Setting the front page, and screening the photograph.
  why.ts            "Why this number?" - provenance for any figure on screen.
  format.ts         How money and durations are written.
src/render/         The isometric view. No image assets anywhere.
  palette.ts        Thirty-two colours, and the light and season lookup tables.
  bitmap.ts         A rasteriser that writes palette INDICES, not colours.
  iso.ts            Projection, camera, culling.
  sprites/          Ground, roadway, buildings, street furniture, vehicles.
  chunks.ts         Ground baked in blocks, because draw calls are the cost.
  cache.ts          Sprite drawn once; painted once per palette variant.
  scene.ts          SimState in, drawable world out.
  renderer.ts       Painter order, light pools, moving traffic.
  photo.ts          The newsprint dot screen, for the paper's photograph.
MODEL.md            Generated from constants.ts. Do not edit by hand.
tools/              Scripts for playing the model from the command line.
```

## The picture is a function of the model

Nothing in the isometric view is decorative, and a test holds that line. Remove a
lane and a lane of tiles disappears. Build a protected bike lane and a green band
appears in the cross-section. Widen the footway and the concrete covers more of
its tile. Bury the wires and the poles go. Plant trees in year nine and they are
still saplings at year fifteen, because they are.

### How the art is made

There are no image files. Sprites are rasterised in code into buffers of palette
**indices**, not colours, and a light or season change is a thirty-two-entry
lookup swap over pixels that were drawn once. Day to night costs a LUT pass, not
a repaint.

The palette contains no neutral grey at all — shadows are violet, concrete is
warm, asphalt carries a blue cast. A test enforces it, along with three-value
ramps per material, empty corners on every ground tile, and a cap on how much of
a surface may be a single value. Grey rectangles are what placeholders look
like, so the palette cannot produce one.

### Known limits of the view

The world grid is one traffic lane wide — twelve feet. A change in lane *width*
between ten and twelve feet therefore may not move the drawn kerb line, though
it moves the operating speed and the crash rate in the model. Lane *count*
always moves both. Footway width is carried as coverage on the tile rather than
as extra tiles, so a four-foot pavement draws as the thin ribbon it is.

Shopfronts are drawn on the viewer-facing side of every building regardless of
which way the parcel actually fronts. Buildings across the boulevard would
otherwise show their service yards, and the point of the view is to read the
street.

## Data integrity

Every constant in the model carries its value, units, an honest range, a source and a
confidence level. `MODEL.md` is generated from that registry, so the documentation and
the model cannot disagree — a test fails if the file on disk falls behind.

- **182** simulation constants
- **97** cite published work
- **85** are game design parameters, labelled as such rather than dressed up with a
  citation they do not have
- **24** sit on literature where researchers actively disagree, and say so

The in-game **"Why this number?"** panel reads the same registry: click a figure
and it gives the value, the plausible range, whether researchers agree, a note,
and a link to the source. Where the literature is contested it says so on the
card rather than presenting a disputed figure with a confident face.

## The two currencies

**Money.** The corridor's own ledger, and the city's shortfall above it, which
moves dollar for dollar with it. Capital work can be borrowed for, but borrowing
capacity shrinks as debt grows, so the back half of a bad run is airless: every
instrument is still there and none of them can be paid for.

**Political capital.** Earned by visible wins, spent on unpopular moves. It
accrues faster at high approval, drains below about a fifth, and at zero the
council replaces you. A road diet costs more political capital on a congested
corridor than on a quiet one, because it does.

The tension is that the correct move is usually the politically expensive one,
and some years neither currency stretches far enough. That is not a balance
problem to be fixed. It is the subject.

## The anti-goals

These are enforced by tests, not by good intentions:

- The words *walkable*, *car-centric*, *stroad* and *induced demand* appear nowhere in
  the primary UI. Each unlocks as a glossary card only after the player has personally
  caused the phenomenon.
- No instrument description says what a change is *for*, only what it changes and what
  it costs. A test scans every description for advocacy language and fails on it.
- Car-centric choices genuinely work in years 1–8. The state DOT widening drops
  congestion, opens to a ribbon-cutting, and costs no political capital at all.
- At least two urbanist moves can fail. A protected bike lane on a corridor of car
  parks goes unused; a bus route below the density threshold burns subsidy and carries
  nobody. Both are tested.
- No villains. No praise for the player's values.
- An instrument may cite the constants behind the figures it **shows** — what a
  lane-mile costs, how long a pavement lasts — and never the constants behind
  what it **does**. Putting the roundabout's crash modification factor on its
  card would tell the player what a roundabout is for. A test enforces this.
- The reserved vocabulary is kept out of every string in `src/ui/`, scanned by
  a test that also checks it found text to scan.
- The newspaper is held to all of it, and to more besides. Tests play three whole
  runs under three different plans and read every word the Ledger printed: no
  reserved vocabulary, no villains, no praise, no causal reasoning, and never a
  year other than the one the issue is dated. That last rule is the important
  one. A paper that can write "since the 2003 widening" has a memory, and if the
  paper has a memory the player never has to build one.

## The paper

The Ledger is a weekly with a circulation of nine thousand and one reporter on
the city beat. It reports what happened and it does not go looking for a cause.
It cheers the widening. A few years later it runs the chain restaurant's press
release, which says the traffic counts sold them the site. Years after that it
runs a baffled piece about the public works gap. It never notices that these are
the same story, and there is no code path by which it could: its whole view of
the simulation is one `Observation`, holding a single year of things a person in
Fairview can see or hear, and a test enforces that nothing else in `src/paper/`
reaches past it. Revenue per acre, infrastructure liability and reachability are
all deliberately absent from that type.

Around the twentieth year, on a corridor that earned it, the desk comes round.
That is not on a schedule. The paper keeps its own count of how long the street
has been a decent place to stand - measured from four things a resident can
perceive, how loud it is, how wide it is, whether there is shade and whether
anybody else is out walking - and it prints the piece when that count reaches
seven. Across thirteen corridors a patient plan turns it about eight times in
ten, with a median around year twenty. Doing nothing turns it never. Taking the
widening turns it never. Planting trees along a six-lane arterial and changing
nothing else turns it never either, which is the point.

The photograph is a crop of the live isometric render, taken at the place the
lead story is about and put through a coarse dot screen at forty-five degrees.
The year the boulevard finally has trees on it, the trees are in the photo, and
nobody had to write a line of copy saying so.

## Notes on the model

Two things worth knowing before reading the numbers.

**Air temperature and surface temperature are different quantities.** The brief asked
for an urban heat island effect worth up to ~15°F. That figure is defensible for
*surface* temperature and not for *air* temperature; the model carries both separately,
at roughly 43°F and 4°F respectively at year zero. See `MODEL.md`.

**Reachability is measured in clock time, not comfort.** Commerce Blvd is 1.2 miles
long, so a supermarket on it is physically within a fifteen-minute walk of many nearby
households from day one — and almost none of them walk. The reckoning reports both
numbers, side by side, with no commentary. The gap is the argument.
