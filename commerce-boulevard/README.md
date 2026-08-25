# Commerce Boulevard

A browser game about a broke American city and one street.

You are the newly hired Public Works Director of **Fairview**, population 120,000. The
budget does not balance, the residents are angry, and the businesses are closing. You
have one corridor — Commerce Blvd, 1.2 miles, six lanes, strip malls, 55% surface
parking — and thirty years.

Nobody will tell you what to do about it.

---

## Status: Phase 1 complete — simulation core only

There is no renderer yet. This is deliberate: the build order puts the simulation
first, headless and tested, so that the argument exists before the pixels do.

| Phase | | |
| --- | --- | --- |
| 1 | Simulation core, `MODEL.md`, tests | **done** |
| 2 | Isometric renderer + procedural sprite factory | **done** |
| 3 | Instruments UI + two-currency economy | not started |
| 4 | Year advance + newspaper generator | not started |
| 5 | Raycaster (drive) and side-scroll (walk) cameras | not started |
| 6 | Web Audio synthesis | not started |
| 7 | Ledger View reveal + year-30 scoring | not started |
| 8 | Onboarding, tuning, polish | not started |

## Running it

```bash
npm install
npm run dev       # the isometric view, at localhost:5173
npm test          # 194 tests across the model and the renderer
npm run model     # regenerate MODEL.md from the constant registry
npm run sim       # play four scripted strategies and print thirty years of each
npm run sweep     # compare strategies across thirteen generated corridors
```

In the view: **drag** to pan, **wheel** to zoom, **space** to advance a year,
**1–4** for day / dusk / night / overcast, **Q W E T** for the seasons, and a
handful of letter keys for the instruments that most change the picture.

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
src/render/         The isometric view. No image assets anywhere.
  palette.ts        Thirty-two colours, and the light and season lookup tables.
  bitmap.ts         A rasteriser that writes palette INDICES, not colours.
  iso.ts            Projection, camera, culling.
  sprites/          Ground, roadway, buildings, street furniture, vehicles.
  chunks.ts         Ground baked in blocks, because draw calls are the cost.
  cache.ts          Sprite drawn once; painted once per palette variant.
  scene.ts          SimState in, drawable world out.
  renderer.ts       Painter order, light pools, moving traffic.
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

The in-game "Why this number?" panel reads the same registry.

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
