# MODEL.md

**This file is generated.** It is rendered from `src/sim/constants.ts` by `npm run model`.
Edit the constants, not this document; a test fails if the two disagree.

Every number the simulation uses appears below with its value, its units, an honest
range, and where it came from. The in-game **"Why this number?"** panel reads the same
registry, so a constant cannot enter the model without declaring its source.

- **197** constants in the model
- **100** carry a citation to published work
- **97** are game design parameters, marked as such rather than dressed up with a citation they do not have
- **24** sit on literature where researchers actively disagree

## How to read the confidence column

| Label | Meaning |
| --- | --- |
| Settled | Independent sources converge, or the figure is arithmetic. |
| Varies by context | Broadly accepted, but the figure moves with market, region or method. |
| Contested | Researchers disagree about sign, size, or method. The game says so rather than picking a side quietly. |

## Where the literature disagrees

These are the numbers a hostile expert reader should attack first, and the ones the
game surfaces to the player with the disagreement attached.

- **Elasticity of VMT with respect to lane-miles** — 0.75 dimensionless (range 0.5–1). The fundamental law of road congestion. Duranton & Turner find ~1.0 for interstates and 0.66-0.90 for other major roads; 0.75 is the practitioner value for arterials. Contested on identification strategy, and Anas (2024) disputes the theoretical reading.
- **Years for new capacity to refill** — 5 years (range 3–10). The anchor the adjustment rate is fitted to. This lag is what makes the widening genuinely work first, which is the whole trap.
- **Assessed value per acre: surface parking** — 200,000 dollars per acre (range 25,000–1,500,000). Backed out from roughly $4,000 per acre per year in total property tax. Parking lots are assessed almost entirely as land and are frequently under-assessed; the range is enormous.
- **Assessed value per acre: four- to six-storey mixed use** — 20,000,000 dollars per acre (range 8,000,000–50,000,000). More than thirty times big box on the same utilities and the same lane-miles. The multiple is real; its size depends heavily on the market.
- **Years for suburban development to repay its infrastructure** — 42 years (range 25–80). Against a pipe life of about 75 years and a pavement life of 25. Downtown blocks in the same study pay back in about three.
- **Revenue as a share of infrastructure liability, auto-oriented development** — 0.15 ratio (range 0.1–0.2). The claim the Ledger View exists to let the player check for themselves. Disputed in its strong form; the direction is not.
- **Annual routine maintenance per lane-mile** — 15,000 dollars per lane-mile per year (range 8,000–30,000). Sweeping, patching, striping, snow, signs. Excludes resurfacing and reconstruction. State-reported figures vary by a factor of ten, partly through inconsistent accounting.
- **Mill and overlay cost per lane-mile** — 250,000 dollars per lane-mile (range 150,000–400,000). Urban arterial, including traffic control and driveway tie-ins.
- **Full reconstruction cost per lane-mile** — 450,000 dollars per lane-mile (range 250,000–1,200,000). Full depth, kerb to kerb. The upper end applies where drainage and utilities have to be rebuilt with it, which on an old arterial is usual.
- **Reconstruction cycle** — 25 years (range 20–40). Shorter than most cities budget for. A reconstruction rebuilds the roadway to full depth including the base and the drainage; a resurfacing does not.
- **Water main replacement cost** — 340 dollars per linear foot (range 190–500). Urban street, open cut, including restoring the pavement above it.
- **Sanitary sewer replacement cost** — 300 dollars per linear foot (range 150–550). Deeper than water, but usually smaller diameter, so the costs land close together.
- **Annual energy and maintenance per streetlight** — 250 dollars per pole per year (range 150–500). LED conversion cuts the energy half but not the maintenance half.
- **Capital cost per streetlight** — 3,300 dollars per pole (range 1,450–6,000). Pole, luminaire, foundation and connection. Pedestrian-scale lighting needs more poles for the same street.
- **New signalised intersection** — 275,000 dollars (range 150,000–600,000). Poles, mast arms, controller, detection, and the design that precedes them.
- **Annual signal maintenance** — 4,000 dollars per intersection per year (range 800–12,000). Including retiming, which most cities defer for a decade at a time.
- **Sidewalk construction cost** — 12 dollars per square foot (range 6–20). Concrete including base, in an urban section with utility conflicts.
- **Crash rate change per extra foot of lane width** — 0.1 fractional change per foot (range -0.02–0.15). The Johns Hopkins study found roughly 1.5x the crashes at 12 ft versus 9 ft on 30-35 mph urban streets. Genuinely disputed: older rural highway research found wider lanes safer, and some engineers argue narrow lanes increase side friction.
- **Level associated with a measurable rise in heart disease risk** — 59.3 dBA Lden (range 53–65). A 5% increase in ischaemic heart disease is reported around this level. The dose-response relationship is real and its exact shape is debated.
- **Maximum afternoon AIR temperature excess from local land cover** — 7 degrees F (range 3–12). Intra-city AIR temperature differences are far smaller than surface differences and are routinely conflated with them. Reported land-surface differences of 20-40F correspond to air differences of a few degrees.
- **Maximum air cooling achievable from tree canopy** — 2.7 degrees F (range 0.9–10.4). Up to 1.5 C in heat-prone areas from increased canopy. Reviews report air cooling from 0.5 to 5.8 C depending on canopy density and climate, so the upper end is genuinely uncertain.
- **Air cooling per percentage point of tree canopy** — 0.07 degrees F per percentage point (range 0.02–0.12). Derived by spreading the maximum cooling over a realistic canopy range. Non-linear in reality: canopy below roughly 40% cover does much less per point than canopy above it.
- **Elasticity of housing supply with respect to price** — 1.2 dimensionless (range 0.3–3). The supply-side and supply-sceptic camps disagree sharply about this number and about what it implies locally. The range here is wide on purpose.
- **Elasticity of rent with respect to allowed density** — -0.25 dimensionless (range -0.6–0). Negative because more allowed supply lowers rent, but local studies find effects ranging from strongly negative to none at all.

## Known verification gaps

- **Value of a statistical life** — USDOT updates this annually. VERIFICATION GAP: the current authority for KABCO-level crash costs is the FHWA fact sheet FHWA-SA-25-021, which the build environment could not reach; this figure should be checked against it before release.
- **Comprehensive cost of a serious injury crash** — KABCO "A" severity, as a fraction of the value of a statistical life. Same verification gap as above.
- **Comprehensive cost of a minor injury crash** — KABCO "B" and "C" severities combined. Same verification gap as above.
- **Comprehensive cost of a property-damage-only crash** — The cheapest crashes, and the ones that make up most of the count. Same verification gap as above.

## Corridor geometry

Level design. Not research, and labelled as such.

| Constant | Value | Units | Range | Confidence | Source |
| --- | ---: | --- | ---: | --- | --- |
| `CORRIDOR_LENGTH_FT`<br>Corridor length | 6,336 | feet | 6,336–6,336 | Settled | _Design parameter_ |
| `CORRIDOR_SEGMENTS`<br>Corridor segments | 12 | count | 12–12 | Settled | _Design parameter_ |
| `INITIAL_SURFACE_PARKING_SHARE`<br>Share of corridor land in surface parking at year 0 | 0.55 | fraction | 0.55–0.55 | Settled | _Design parameter_ |
| `CITY_POPULATION`<br>Fairview population | 120,000 | people | 120,000–120,000 | Settled | _Design parameter_ |
| `OPENING_DEFICIT`<br>Opening general fund shortfall | 4,100,000 | dollars per year | 4,100,000–4,100,000 | Settled | _Design parameter_ |
| `SERVICE_AREA_HOUSEHOLDS`<br>Households the corridor serves | 7,200 | households | 7,200–7,200 | Settled | _Design parameter_ |

- **Corridor length** (`CORRIDOR_LENGTH_FT`): The whole game is 1.2 miles of one street: 1.2 x 5,280 = 6,336 ft.
- **Corridor segments** (`CORRIDOR_SEGMENTS`): Twelve blocks of 528 ft, each with parcels on both sides.
- **Share of corridor land in surface parking at year 0** (`INITIAL_SURFACE_PARKING_SHARE`): High, but not unusual for a US commercial strip. The corridor generator fits the mix to hit exactly this.
- **Fairview population** (`CITY_POPULATION`): The city is the tax base that has to pay for the corridor.
- **Opening general fund shortfall** (`OPENING_DEFICIT`): The adopted general fund is short by this much before anything on Commerce Boulevard has been decided.
- **Households the corridor serves** (`SERVICE_AREA_HOUSEHOLDS`): About 18,000 people, or 15% of Fairview, live close enough for the corridor to be their high street.

## Traffic, capacity and induced demand

How much traffic there is, how fast it moves, and how it grows back.

| Constant | Value | Units | Range | Confidence | Source |
| --- | ---: | --- | ---: | --- | --- |
| `SATURATION_FLOW_RATE`<br>Base saturation flow rate | 1,900 | passenger cars per hour of green per lane | 1,750–2,000 | Settled | [FHWA, "Simplified Highway Capacity Calculation Method for the Highway Performance Monitoring System" (FHWA-PL-18-003)](https://www.fhwa.dot.gov/policyinformation/pubs/pl18003/hpms_cap.pdf) (2018) |
| `LANE_CAPACITY_VPHPL_ANCHOR`<br>Signalised arterial lane capacity (validation anchor) | 900 | vehicles per hour per lane | 600–1,100 | Settled | [FHWA, "Simplified Highway Capacity Calculation Method for the Highway Performance Monitoring System" (FHWA-PL-18-003)](https://www.fhwa.dot.gov/policyinformation/pubs/pl18003/hpms_cap.pdf) (2018) |
| `ARTERIAL_GREEN_RATIO_ANCHOR`<br>Effective green ratio for the arterial through movement | 0.47 | fraction of cycle | 0.35–0.6 | Varies by context | [City/County Association of Governments of San Mateo County, Congestion Management Program Appendix B: Traffic Level of Service Calculation Methods](https://ccag.ca.gov/wp-content/uploads/2014/07/cmp_2005_Appendix_B.pdf) (2005) |
| `PEAK_HOUR_FACTOR_K`<br>Peak hour share of daily traffic | 0.092 | fraction of AADT | 0.08–0.11 | Varies by context | [FHWA, "Simplified Highway Capacity Calculation Method for the Highway Performance Monitoring System" (FHWA-PL-18-003)](https://www.fhwa.dot.gov/policyinformation/pubs/pl18003/hpms_cap.pdf) (2018) |
| `DIRECTIONAL_SPLIT_D`<br>Peak direction share | 0.55 | fraction | 0.5–0.65 | Varies by context | [FHWA, "Simplified Highway Capacity Calculation Method for the Highway Performance Monitoring System" (FHWA-PL-18-003)](https://www.fhwa.dot.gov/policyinformation/pubs/pl18003/hpms_cap.pdf) (2018) |
| `BPR_ALPHA`<br>BPR congestion coefficient | 0.15 | dimensionless | 0.1–0.84 | Varies by context | [Bureau of Public Roads, Traffic Assignment Manual (1964), as documented in the AequilibraE volume-delay function reference](https://www.aequilibrae.com/latest/python/traffic_assignment/volume_delay_functions.html) (1964) |
| `BPR_BETA`<br>BPR congestion exponent | 4 | dimensionless | 2–8 | Varies by context | [Bureau of Public Roads, Traffic Assignment Manual (1964), as documented in the AequilibraE volume-delay function reference](https://www.aequilibrae.com/latest/python/traffic_assignment/volume_delay_functions.html) (1964) |
| `VMT_LANE_MILE_ELASTICITY`<br>Elasticity of VMT with respect to lane-miles | 0.75 | dimensionless | 0.5–1 | Contested | [Duranton & Turner, "The Fundamental Law of Road Congestion: Evidence from US Cities", American Economic Review 101(6):2616-52](https://www.aeaweb.org/articles?id=10.1257%2Faer.101.6.2616) (2011) |
| `INDUCED_DEMAND_ADJUSTMENT_RATE`<br>Annual rate at which traffic closes the gap to its new equilibrium | 0.28 | fraction of remaining gap per year | 0.12–0.45 | Varies by context | [Milam, Birnbaum, Ganson, Handy & Walters, "Closing the Induced Vehicle Travel Gap Between Research and Practice", Transportation Research Record 2653](https://journals.sagepub.com/doi/10.3141/2653-02) (2017) |
| `YEARS_TO_REFILL_ANCHOR`<br>Years for new capacity to refill | 5 | years | 3–10 | Contested | [Milam, Birnbaum, Ganson, Handy & Walters, "Closing the Induced Vehicle Travel Gap Between Research and Practice", Transportation Research Record 2653](https://journals.sagepub.com/doi/10.3141/2653-02) (2017) |
| `VMT_TRAVEL_TIME_ELASTICITY`<br>Short-run elasticity of VMT with respect to travel time | -0.5 | dimensionless | -0.7–-0.27 | Varies by context | [Goodwin, "Empirical evidence on induced traffic", Transportation 23(1):35-54 - the synthesis underpinning the UK SACTRA report](https://link.springer.com/article/10.1007/BF00166218) (1996) |
| `REGIONAL_GROWTH_RATE`<br>Background regional traffic growth | 0.007 | fraction per year | 0–0.02 | Varies by context | _Design parameter_ |
| `INITIAL_AADT`<br>Commerce Blvd traffic at year 0 | 38,000 | vehicles per day | 25,000–44,000 | Varies by context | _Design parameter_ |
| `INITIAL_THROUGH_SHARE`<br>Through trips as a share of corridor traffic at year 0 | 0.55 | fraction | 0.35–0.7 | Varies by context | _Design parameter_ |
| `AVERAGE_TRIP_LENGTH_ON_CORRIDOR_MI`<br>Average distance a vehicle travels on the corridor | 0.7 | miles | 0.4–1.2 | Varies by context | _Design parameter_ |
| `VEHICLE_OCCUPANCY`<br>People per vehicle | 1.35 | persons per vehicle | 1.1–1.7 | Varies by context | _Design parameter_ |
| `VEHICLE_OPERATING_COST_PER_MILE`<br>Marginal cost of driving a mile, as perceived | 0.24 | dollars per mile | 0.15–0.35 | Varies by context | _Design parameter_ |

- **Base saturation flow rate** (`SATURATION_FLOW_RATE`): The Highway Capacity Manual base value, before adjustment for lane width, grade and turning movements.
- **Signalised arterial lane capacity (validation anchor)** (`LANE_CAPACITY_VPHPL_ANCHOR`): Not used directly: the model derives capacity from saturation flow times green ratio, and a test asserts the result lands on this figure.
- **Effective green ratio for the arterial through movement** (`ARTERIAL_GREEN_RATIO_ANCHOR`): Typical g/C for the major street at a coordinated arterial signal. The model computes this from cycle length and phasing and is tested against it.
- **Peak hour share of daily traffic** (`PEAK_HOUR_FACTOR_K`): The K-factor used to convert AADT to a design-hour volume. Urban arterials run flatter peaks than freeways.
- **Peak direction share** (`DIRECTIONAL_SPLIT_D`): The D-factor. A commercial strip is less directional than a commuter radial.
- **BPR congestion coefficient** (`BPR_ALPHA`): The classic 0.15/4 pair is ubiquitous and widely criticised as too flat near capacity. Used here only for off-peak smoothing; delay comes mainly from the signal model.
- **BPR congestion exponent** (`BPR_BETA`): Higher beta makes delay explode more sharply as volume approaches capacity.
- **Elasticity of VMT with respect to lane-miles** (`VMT_LANE_MILE_ELASTICITY`): The fundamental law of road congestion. Duranton & Turner find ~1.0 for interstates and 0.66-0.90 for other major roads; 0.75 is the practitioner value for arterials. Contested on identification strategy, and Anas (2024) disputes the theoretical reading.
- **Annual rate at which traffic closes the gap to its new equilibrium** (`INDUCED_DEMAND_ADJUSTMENT_RATE`): Derived, not measured: chosen so the corridor refills about 80% of the way in five years and 95% in ten, matching the observed time course.
- **Years for new capacity to refill** (`YEARS_TO_REFILL_ANCHOR`): The anchor the adjustment rate is fitted to. This lag is what makes the widening genuinely work first, which is the whole trap.
- **Short-run elasticity of VMT with respect to travel time** (`VMT_TRAVEL_TIME_ELASTICITY`): How much driving grows when driving gets quicker, holding lane-miles fixed. The long-run figure is roughly double.
- **Background regional traffic growth** (`REGIONAL_GROWTH_RATE`): Growth the Public Works Director does not control, so the corridor is never quite in steady state.
- **Commerce Blvd traffic at year 0** (`INITIAL_AADT`): A six-lane commercial arterial in a city of 120,000 typically carries 25,000-40,000 vehicles a day. Fairview sits at the congested end, because a corridor nobody complains about is not a game.
- **Through trips as a share of corridor traffic at year 0** (`INITIAL_THROUGH_SHARE`): The split that makes the model work: widening pulls through traffic from elsewhere, it does not create local trips.
- **Average distance a vehicle travels on the corridor** (`AVERAGE_TRIP_LENGTH_ON_CORRIDOR_MI`): Used to turn AADT into corridor VMT. Most vehicles use part of the corridor, not all of it.
- **People per vehicle** (`VEHICLE_OCCUPANCY`): Averaged across trip purposes. Commute trips run lower, shopping and social trips higher.
- **Marginal cost of driving a mile, as perceived** (`VEHICLE_OPERATING_COST_PER_MILE`): Fuel, tyres and wear as the driver perceives them at the moment of choosing a mode - not the full ownership cost, which the household pays whether it drives or not.

## Land value and revenue per acre

The central fiscal fact: what a given acre pays the city each year.

| Constant | Value | Units | Range | Confidence | Source |
| --- | ---: | --- | ---: | --- | --- |
| `EFFECTIVE_PROPERTY_TAX_RATE_COMMERCIAL`<br>Effective property tax rate, commercial, all jurisdictions | 0.02 | fraction of market value per year | 0.008–0.04 | Varies by context | [Lincoln Institute of Land Policy & Minnesota Center for Fiscal Excellence, "50-State Property Tax Comparison Study"](https://www.lincolninst.edu/publications/other/50-state-property-tax-comparison-study-2024/) (2024) |
| `EFFECTIVE_PROPERTY_TAX_RATE_RESIDENTIAL`<br>Effective property tax rate, residential, all jurisdictions | 0.0122 | fraction of market value per year | 0.003–0.032 | Varies by context | [Lincoln Institute of Land Policy & Minnesota Center for Fiscal Excellence, "50-State Property Tax Comparison Study"](https://www.lincolninst.edu/publications/other/50-state-property-tax-comparison-study-2024/) (2024) |
| `CITY_SHARE_OF_PROPERTY_LEVY`<br>City share of the total property tax levy | 0.32 | fraction | 0.15–0.6 | Varies by context | _Design parameter_ |
| `LOCAL_SALES_TAX_SHARE`<br>Local share of sales tax | 0.0125 | fraction of taxable sales | 0.005–0.025 | Varies by context | _Design parameter_ |
| `VALUE_PER_ACRE_VACANT`<br>Assessed value per acre: vacant lot | 120,000 | dollars per acre | 30,000–500,000 | Varies by context | _Design parameter_ |
| `VALUE_PER_ACRE_SURFACE_PARKING`<br>Assessed value per acre: surface parking | 200,000 | dollars per acre | 25,000–1,500,000 | Contested | [Strong Towns BloNo, "Downtown Tax Analysis: Its All About Value Per Acre"](https://strongtownsblono.com/2024/11/10/downtown-tax-analysis-its-all-about-value-per-acre/) (2024) |
| `VALUE_PER_ACRE_BIG_BOX`<br>Assessed value per acre: single-storey big box with parking | 600,000 | dollars per acre | 350,000–900,000 | Varies by context | [Strong Towns / Urban3, "Main Street vs. Big Box Stores: A Western North Carolina Analysis"](https://www.strongtowns.org/journal/main-street-vs-big-box-stores-a-western-north-carolina-analysis) (2022) |
| `VALUE_PER_ACRE_STRIP_MALL`<br>Assessed value per acre: strip mall | 600,000 | dollars per acre | 250,000–1,250,000 | Varies by context | [CivicWell / Local Government Commission with Urban3, "Valuing Downtowns: San Joaquin Valley property tax revenue per acre"](https://civicwell.org/civic-resources/valuing-downtowns/) (2015) |
| `VALUE_PER_ACRE_AUTO_SERVICE`<br>Assessed value per acre: auto service and drive-through | 900,000 | dollars per acre | 400,000–1,750,000 | Varies by context | [CNU Public Square, "Best bet for tax revenue: mixed-use downtown development" - Katz / Whalen / Minicozzi Sarasota County study](https://www.cnu.org/publicsquare/2010/09/13/best-bet-tax-revenue-mixed-use-downtown-development) (2010) |
| `VALUE_PER_ACRE_SINGLE_FAMILY`<br>Assessed value per acre: single-family detached | 740,000 | dollars per acre | 250,000–1,650,000 | Varies by context | [CNU Public Square, "Best bet for tax revenue: mixed-use downtown development" - Katz / Whalen / Minicozzi Sarasota County study](https://www.cnu.org/publicsquare/2010/09/13/best-bet-tax-revenue-mixed-use-downtown-development) (2010) |
| `VALUE_PER_ACRE_GARDEN_APARTMENT`<br>Assessed value per acre: garden apartments | 2,000,000 | dollars per acre | 800,000–5,000,000 | Varies by context | _Design parameter_ |
| `VALUE_PER_ACRE_OFFICE_PARK`<br>Assessed value per acre: suburban office | 1,500,000 | dollars per acre | 600,000–4,000,000 | Varies by context | _Design parameter_ |
| `VALUE_PER_ACRE_MAINSTREET_MIXED`<br>Assessed value per acre: two- to three-storey main street | 5,000,000 | dollars per acre | 2,000,000–12,000,000 | Varies by context | [Strong Towns / Urban3, "Main Street vs. Big Box Stores: A Western North Carolina Analysis"](https://www.strongtowns.org/journal/main-street-vs-big-box-stores-a-western-north-carolina-analysis) (2022) |
| `VALUE_PER_ACRE_MIDRISE_MIXED`<br>Assessed value per acre: four- to six-storey mixed use | 20,000,000 | dollars per acre | 8,000,000–50,000,000 | Contested | [The Ticker (Traverse City), "Whos Footing The Tax Bill?" - Urban3 analysis](https://www.traverseticker.com/news/who-s-footing-the-tax-bill/) (2019) |
| `PARKING_TAX_YIELD_RETENTION`<br>Tax yield of a parking lot relative to the building it replaced | 0.11 | ratio | 0.05–0.17 | Varies by context | [City Observatory, "Why parking should pay its way instead of getting a free ride"](https://cityobservatory.org/parking_pay_way/) (2019) |
| `SALES_TAX_PER_ACRE_BIG_BOX_ANCHOR`<br>Local sales tax per acre: big box (validation anchor) | 47,500 | dollars per acre per year | 20,000–80,000 | Varies by context | [Strong Towns, "The Surprising Relationship Between Retail Tax and Property Tax"](https://archive.strongtowns.org/journal/2018/2/1/the-surprising-relationship-between-retail-taxand-property-tax) (2018) |
| `SALES_TAX_PER_ACRE_MIXED_ANCHOR`<br>Local sales tax per acre: downtown mixed use (validation anchor) | 88,000 | dollars per acre per year | 40,000–150,000 | Varies by context | [Urban3 for 1000 Friends of Florida, "Economics of Development in Florida"](https://1000fof.org/wp-content/uploads/2024/11/EconomicDevelopmentFlorida_Report_v2_compressed.pdf) (2024) |
| `BIG_BOX_SITE_FAR_ANCHOR`<br>Floor area ratio of a typical big box site | 0.15 | built sqft per sqft of site | 0.12–0.25 | Varies by context | [CNU Public Square, "Best bet for tax revenue: mixed-use downtown development" - Katz / Whalen / Minicozzi Sarasota County study](https://www.cnu.org/publicsquare/2010/09/13/best-bet-tax-revenue-mixed-use-downtown-development) (2010) |
| `INFRASTRUCTURE_PAYBACK_YEARS_SUBURBAN`<br>Years for suburban development to repay its infrastructure | 42 | years | 25–80 | Contested | [CNU Public Square, "Best bet for tax revenue: mixed-use downtown development" - Katz / Whalen / Minicozzi Sarasota County study](https://www.cnu.org/publicsquare/2010/09/13/best-bet-tax-revenue-mixed-use-downtown-development) (2010) |
| `STRONGTOWNS_REVENUE_LIABILITY_RATIO`<br>Revenue as a share of infrastructure liability, auto-oriented development | 0.15 | ratio | 0.1–0.2 | Contested | [Strong Towns, "The Growth Ponzi Scheme"](https://www.strongtowns.org/journal/2016/6/14/greatest-hits-the-growth-ponzi-scheme) (2011, republished 2016) |
| `ASSESSMENT_LAG_YEARS`<br>Lag between value change and assessed value | 2 | years | 1–4 | Varies by context | _Design parameter_ |

- **Effective property tax rate, commercial, all jurisdictions** (`EFFECTIVE_PROPERTY_TAX_RATE_COMMERCIAL`): Median effective commercial rate across large US cities. Varies more than threefold between states.
- **Effective property tax rate, residential, all jurisdictions** (`EFFECTIVE_PROPERTY_TAX_RATE_RESIDENTIAL`): Lower than the commercial rate in most states. The gap is a classification difference, not a difference in assessed value.
- **City share of the total property tax levy** (`CITY_SHARE_OF_PROPERTY_LEVY`): Schools and the county take most of it. The city maintains the roadway and collects about a third of the levy raised on the land beside it.
- **Local share of sales tax** (`LOCAL_SALES_TAX_SHARE`): Set so year-zero big-box sales tax per acre lands inside the published range. A test asserts it does.
- **Assessed value per acre: vacant lot** (`VALUE_PER_ACRE_VACANT`): Land only, discounted for holding cost and uncertainty.
- **Assessed value per acre: surface parking** (`VALUE_PER_ACRE_SURFACE_PARKING`): Backed out from roughly $4,000 per acre per year in total property tax. Parking lots are assessed almost entirely as land and are frequently under-assessed; the range is enormous.
- **Assessed value per acre: single-storey big box with parking** (`VALUE_PER_ACRE_BIG_BOX`): Counting the parking field, which is most of the site. This is the figure the Strong Towns argument turns on.
- **Assessed value per acre: strip mall** (`VALUE_PER_ACRE_STRIP_MALL`): Backed out from roughly $12,000 per acre per year in total property tax. Slightly denser than big box, and it fails more gracefully.
- **Assessed value per acre: auto service and drive-through** (`VALUE_PER_ACRE_AUTO_SERVICE`): Backed out from fast-food block figures. Small buildings on small lots beat big box per acre, and lose to anything with a second storey.
- **Assessed value per acre: single-family detached** (`VALUE_PER_ACRE_SINGLE_FAMILY`): Backed out at the residential rate, at roughly four units per acre in a mid-size market.
- **Assessed value per acre: garden apartments** (`VALUE_PER_ACRE_GARDEN_APARTMENT`): Interpolated between the detached and main-street figures at roughly 20 units per acre. Not separately published.
- **Assessed value per acre: suburban office** (`VALUE_PER_ACRE_OFFICE_PARK`): Generates no sales tax and empties at six, which matters a great deal to the retail model.
- **Assessed value per acre: two- to three-storey main street** (`VALUE_PER_ACRE_MAINSTREET_MIXED`): Shopfront at the pavement, flats above. The cheapest form that beats the strip decisively - roughly eight times big box per acre.
- **Assessed value per acre: four- to six-storey mixed use** (`VALUE_PER_ACRE_MIDRISE_MIXED`): More than thirty times big box on the same utilities and the same lane-miles. The multiple is real; its size depends heavily on the market.
- **Tax yield of a parking lot relative to the building it replaced** (`PARKING_TAX_YIELD_RETENTION`): Demolishing a building for parking keeps about a ninth of the tax yield, and all of the infrastructure obligation.
- **Local sales tax per acre: big box (validation anchor)** (`SALES_TAX_PER_ACRE_BIG_BOX_ANCHOR`): A test asserts the model reproduces this from floor area, sales per square foot and the local rate.
- **Local sales tax per acre: downtown mixed use (validation anchor)** (`SALES_TAX_PER_ACRE_MIXED_ANCHOR`): Mixed use beats big box on sales tax per acre too, by roughly 1.85x - a smaller gap than the property tax gap, and one that surprises people.
- **Floor area ratio of a typical big box site** (`BIG_BOX_SITE_FAR_ANCHOR`): Eighty-five per cent of the site is not building. That is the whole fiscal problem in one number.
- **Years for suburban development to repay its infrastructure** (`INFRASTRUCTURE_PAYBACK_YEARS_SUBURBAN`): Against a pipe life of about 75 years and a pavement life of 25. Downtown blocks in the same study pay back in about three.
- **Revenue as a share of infrastructure liability, auto-oriented development** (`STRONGTOWNS_REVENUE_LIABILITY_RATIO`): The claim the Ledger View exists to let the player check for themselves. Disputed in its strong form; the direction is not.
- **Lag between value change and assessed value** (`ASSESSMENT_LAG_YEARS`): Reassessment cycles mean the fiscal reward for good land use arrives late, which is politically fatal.

## Infrastructure liability

What that acre costs the city each year. Liability follows area, revenue follows value.

| Constant | Value | Units | Range | Confidence | Source |
| --- | ---: | --- | ---: | --- | --- |
| `ROAD_ROUTINE_MAINTENANCE_PER_LANE_MILE`<br>Annual routine maintenance per lane-mile | 15,000 | dollars per lane-mile per year | 8,000–30,000 | Contested | [Reason Foundation, 27th Annual Highway Report - maintenance disbursements per mile](https://reason.org/highway-report/27th-annual-highway-report/maintenance-disbursements-ratio/) (2022 (FY2020 data)) |
| `ROAD_RESURFACE_COST_PER_LANE_MILE`<br>Mill and overlay cost per lane-mile | 250,000 | dollars per lane-mile | 150,000–400,000 | Contested | [Florida DOT, Generic Cost Per Mile Models (Long Range Estimating summary)](https://ftp.fdot.gov/public/file/ze-JhsHT0ku2YmntigTtIQ/Summary.pdf) (c. 2016-2024) |
| `ROAD_RECONSTRUCT_COST_PER_LANE_MILE`<br>Full reconstruction cost per lane-mile | 450,000 | dollars per lane-mile | 250,000–1,200,000 | Contested | [City of Arvada, Colorado, "Understanding the Pavement Program"](https://www.arvadaco.gov/1299/Understanding-the-Pavement-Program) (2024) |
| `PAVEMENT_RESURFACE_CYCLE_YEARS`<br>Resurfacing cycle | 12 | years | 8–15 | Varies by context | [FHWA, "The Use of Thin Asphalt Overlays for Pavement Preservation" (Tech Brief HIF-19-053)](https://www.fhwa.dot.gov/pavement/asphalt/pubs/hif19053.pdf) (2019) |
| `EMERGENCY_RECONSTRUCTION_PREMIUM`<br>Cost multiplier on a reconstruction the city did not plan | 1.45 | multiple of the planned cost | 1.2–1.9 | Varies by context | _Design parameter_ |
| `PAVEMENT_RECONSTRUCT_CYCLE_YEARS`<br>Reconstruction cycle | 25 | years | 20–40 | Contested | [City of Arvada, Colorado, "Understanding the Pavement Program"](https://www.arvadaco.gov/1299/Understanding-the-Pavement-Program) (2024) |
| `WATER_MAIN_REPLACE_COST_PER_FT`<br>Water main replacement cost | 340 | dollars per linear foot | 190–500 | Contested | [City of Phoenix, Water and Wastewater Unit Cost Study (Carollo Engineers)](https://www.phoenix.gov/content/dam/phoenix/pddsite/documents/impact-fees/2025-if-update/Water%20and%20Wastewater%20Unit%20Cost%20Study_08142024_v2.pdf) (2024) |
| `SEWER_REPLACE_COST_PER_FT`<br>Sanitary sewer replacement cost | 300 | dollars per linear foot | 150–550 | Contested | [City of Phoenix, Water and Wastewater Unit Cost Study (Carollo Engineers)](https://www.phoenix.gov/content/dam/phoenix/pddsite/documents/impact-fees/2025-if-update/Water%20and%20Wastewater%20Unit%20Cost%20Study_08142024_v2.pdf) (2024) |
| `PIPE_SERVICE_LIFE_YEARS`<br>Buried pipe service life | 75 | years | 50–125 | Varies by context | [AWWA "Buried No Longer" service-life tables, via DIPRA facts and figures](https://dipra.org/wp-content/uploads/2025/02/Facts-and-Figures-Buried-No-Longer.pdf) (2012) |
| `STREETLIGHT_ANNUAL_COST_PER_POLE`<br>Annual energy and maintenance per streetlight | 250 | dollars per pole per year | 150–500 | Contested | [City of Los Angeles Bureau of Street Lighting, "Cost of Service and Street Lighting Assessments"](https://lalights.lacity.org/residents/cost_of_svc_and_stlighting_assessments.html) (c. 2023) |
| `STREETLIGHT_CAPITAL_COST_PER_POLE`<br>Capital cost per streetlight | 3,300 | dollars per pole | 1,450–6,000 | Contested | [US DOE Better Buildings Solution Center, "Cost Savings Analysis of LED Street Lighting Ownership"](https://betterbuildingssolutioncenter.energy.gov/solutions-at-a-glance/cost-savings-analysis-led-street-lighting-ownership) (c. 2020-2024) |
| `STREETLIGHT_SPACING_FT`<br>Streetlight spacing | 203 | feet | 100–293 | Varies by context | [Village of Wheeling, Illinois, Municipal Design Manual, Chapter 8 - Street Lighting](https://www.wheelingil.gov/DocumentCenter/View/552/Chapter-8-Street-Lighting-PDF) (current municipal standard) |
| `SIGNAL_CAPITAL_COST`<br>New signalised intersection | 275,000 | dollars | 150,000–600,000 | Contested | [FHWA, Traffic Signal Program Handbook (FHWA-HOP-23-041)](https://ops.fhwa.dot.gov/publications/fhwahop23041/fhwahop23041.pdf) (2023) |
| `SIGNAL_ANNUAL_MAINTENANCE`<br>Annual signal maintenance | 4,000 | dollars per intersection per year | 800–12,000 | Contested | [USDOT ITS Deployment Evaluation, signal maintenance cost entries](http://www.itskrs.its.dot.gov/its/benecost.nsf/ID/215f723db93d293c8525725f00786fd8) (2005-2024 entries) |
| `SIDEWALK_COST_PER_SQFT`<br>Sidewalk construction cost | 12 | dollars per square foot | 6–20 | Contested | [UNC Highway Safety Research Center / PBIC, "Costs for Pedestrian and Bicyclist Infrastructure Improvements"](https://www.pedbikeinfo.org/downloads/Countermeasure%20Costs_Report_Nov2013.pdf) (2013 dollars, escalated) |
| `SIDEWALK_SERVICE_LIFE_YEARS`<br>Sidewalk service life | 40 | years | 25–60 | Varies by context | _Design parameter_ |
| `STREET_TREE_PLANTING_COST`<br>Cost to plant one street tree | 900 | dollars per tree | 400–2,500 | Varies by context | [UNC Highway Safety Research Center / PBIC, "Costs for Pedestrian and Bicyclist Infrastructure Improvements"](https://www.pedbikeinfo.org/downloads/Countermeasure%20Costs_Report_Nov2013.pdf) (2013 dollars, escalated) |
| `STREET_TREE_ANNUAL_COST`<br>Annual street tree maintenance | 45 | dollars per tree per year | 20–120 | Varies by context | _Design parameter_ |
| `STREET_TREE_MATURITY_YEARS`<br>Years to useful canopy | 15 | years | 10–25 | Varies by context | _Design parameter_ |
| `UTILITY_UNDERGROUNDING_COST_PER_MILE`<br>Overhead-to-underground conversion | 4,500,000 | dollars per mile | 1,500,000–12,000,000 | Varies by context | _Design parameter_ |
| `EMERGENCY_RESPONSE_COST_PER_CRASH`<br>Municipal emergency response cost per reported crash | 1,400 | dollars per crash | 600–4,000 | Varies by context | _Design parameter_ |
| `TRANSIT_OPERATING_COST_PER_REVENUE_HOUR`<br>Gross operating cost per bus revenue hour | 105 | dollars per revenue hour | 60–200 | Varies by context | _Design parameter_ |
| `TRANSIT_FARE`<br>Bus fare | 1.75 | dollars per boarding | 0–3 | Varies by context | _Design parameter_ |
| `MUNICIPAL_BORROWING_RATE`<br>General obligation borrowing rate | 0.042 | fraction per year | 0.02–0.07 | Varies by context | _Design parameter_ |
| `INFLATION_RATE`<br>Construction cost escalation | 0.045 | fraction per year | 0.03–0.12 | Varies by context | [FHWA, National Highway Construction Cost Index (NHCCI), 2024 Q3 narrative](https://www.fhwa.dot.gov/policy/otps/nhcci/NHCCI_Narrative_Article_2024_Q3.pdf) (2025) |
| `GENERAL_INFLATION_RATE`<br>General price inflation | 0.025 | fraction per year | 0.015–0.045 | Varies by context | [FHWA, National Highway Construction Cost Index (NHCCI), 2024 Q3 narrative](https://www.fhwa.dot.gov/policy/otps/nhcci/NHCCI_Narrative_Article_2024_Q3.pdf) (2025) |
| `INFRA_GAP_PER_CAPITA_ANNUAL`<br>National infrastructure funding gap per capita | 1,100 | dollars per person per year | 900–1,300 | Varies by context | [ASCE, Report Card for Americas Infrastructure](https://infrastructurereportcard.org/) (2025) |
| `ROADWAY_IMPERVIOUS_ACRES_PER_LANE_MILE`<br>Impervious area per lane-mile of roadway | 1.45 | acres per lane-mile | 1.2–1.8 | Settled | _Design parameter_ |

- **Annual routine maintenance per lane-mile** (`ROAD_ROUTINE_MAINTENANCE_PER_LANE_MILE`): Sweeping, patching, striping, snow, signs. Excludes resurfacing and reconstruction. State-reported figures vary by a factor of ten, partly through inconsistent accounting.
- **Mill and overlay cost per lane-mile** (`ROAD_RESURFACE_COST_PER_LANE_MILE`): Urban arterial, including traffic control and driveway tie-ins.
- **Full reconstruction cost per lane-mile** (`ROAD_RECONSTRUCT_COST_PER_LANE_MILE`): Full depth, kerb to kerb. The upper end applies where drainage and utilities have to be rebuilt with it, which on an old arterial is usual.
- **Resurfacing cycle** (`PAVEMENT_RESURFACE_CYCLE_YEARS`): Deferring it is cheap for about five years and then very expensive, because the base starts to fail.
- **Cost multiplier on a reconstruction the city did not plan** (`EMERGENCY_RECONSTRUCTION_PREMIUM`): Emergency mobilisation, a shorter tender list and work sequenced around a failed base rather than a programme. Without a premium, letting the road fail was measurably cheaper than resurfacing it on time, which is the opposite of the thing being modelled.
- **Reconstruction cycle** (`PAVEMENT_RECONSTRUCT_CYCLE_YEARS`): Shorter than most cities budget for. A reconstruction rebuilds the roadway to full depth including the base and the drainage; a resurfacing does not.
- **Water main replacement cost** (`WATER_MAIN_REPLACE_COST_PER_FT`): Urban street, open cut, including restoring the pavement above it.
- **Sanitary sewer replacement cost** (`SEWER_REPLACE_COST_PER_FT`): Deeper than water, but usually smaller diameter, so the costs land close together.
- **Buried pipe service life** (`PIPE_SERVICE_LIFE_YEARS`): Long enough that no official who authorised it will be in office when it fails. Depends heavily on pipe material and soil.
- **Annual energy and maintenance per streetlight** (`STREETLIGHT_ANNUAL_COST_PER_POLE`): LED conversion cuts the energy half but not the maintenance half.
- **Capital cost per streetlight** (`STREETLIGHT_CAPITAL_COST_PER_POLE`): Pole, luminaire, foundation and connection. Pedestrian-scale lighting needs more poles for the same street.
- **Streetlight spacing** (`STREETLIGHT_SPACING_FT`): About 26 poles to the mile for arterial cobra heads. Pedestrian-scale lighting runs at half the spacing and twice the count.
- **New signalised intersection** (`SIGNAL_CAPITAL_COST`): Poles, mast arms, controller, detection, and the design that precedes them.
- **Annual signal maintenance** (`SIGNAL_ANNUAL_MAINTENANCE`): Including retiming, which most cities defer for a decade at a time.
- **Sidewalk construction cost** (`SIDEWALK_COST_PER_SQFT`): Concrete including base, in an urban section with utility conflicts.
- **Sidewalk service life** (`SIDEWALK_SERVICE_LIFE_YEARS`): Tree roots and utility cuts shorten it well below the design life of the concrete.
- **Cost to plant one street tree** (`STREET_TREE_PLANTING_COST`): Including the pit, soil volume and three years of establishment watering. Skimping on soil volume is why so many street trees die at fifteen years.
- **Annual street tree maintenance** (`STREET_TREE_ANNUAL_COST`): Pruning cycle, removals and replacements averaged over the population.
- **Years to useful canopy** (`STREET_TREE_MATURITY_YEARS`): Fifteen years from a whip to a canopy worth standing under, and longer in a four-foot pit with compacted subsoil under it.
- **Overhead-to-underground conversion** (`UTILITY_UNDERGROUNDING_COST_PER_MILE`): Trenching, conduit, vaults, and reconnecting every service on the block. Among the most expensive things a city can do to a mile of street.
- **Municipal emergency response cost per reported crash** (`EMERGENCY_RESPONSE_COST_PER_CRASH`): The city budget share only - police, fire and EMS time. The societal cost is two orders of magnitude larger and falls on somebody else.
- **Gross operating cost per bus revenue hour** (`TRANSIT_OPERATING_COST_PER_REVENUE_HOUR`): Before fare recovery. Fares cover a quarter of this at best on a small-city bus system.
- **Bus fare** (`TRANSIT_FARE`): A typical single-ride cash fare on a small-city bus system. Fares recover a quarter of operating cost at best.
- **General obligation borrowing rate** (`MUNICIPAL_BORROWING_RATE`): Rises as the citys fiscal position deteriorates, which is the debt spiral in one line.
- **Construction cost escalation** (`INFLATION_RATE`): The NHCCI ran near 6% a year in the early 2020s. 4.5% is used as a thirty-year average, because sustaining 6% for three decades would make every capital instrument unaffordable by year 20.
- **General price inflation** (`GENERAL_INFLATION_RATE`): Applied to property values, retail spending, rents and incomes. The gap between this and construction escalation is the squeeze: costs compound faster than the tax base does, every year, for thirty years.
- **National infrastructure funding gap per capita** (`INFRA_GAP_PER_CAPITA_ANNUAL`): Derived from the ASCE ten-year investment gap divided by the US population. A per-capita figure, so a city of 120,000 carries about $132M of it.
- **Impervious area per lane-mile of roadway** (`ROADWAY_IMPERVIOUS_ACRES_PER_LANE_MILE`): A 12-foot lane one mile long is 63,360 sqft, or 1.45 acres. Arithmetic, before shoulders.

## Safety

Crash frequency, crash severity, and who gets hurt.

| Constant | Value | Units | Range | Confidence | Source |
| --- | ---: | --- | ---: | --- | --- |
| `BASE_CRASH_RATE_PER_MVMT`<br>Base crash rate, urban arterial | 5.2 | crashes per million vehicle-miles | 3–9 | Varies by context | _Design parameter_ |
| `PED_FATALITY_LOGIT_INTERCEPT`<br>Pedestrian fatality risk curve: intercept | -5.08 | log-odds | -6–-4.2 | Settled | [Tefft, "Impact Speed and a Pedestrians Risk of Severe Injury or Death", AAA Foundation for Traffic Safety](https://aaafoundation.org/impact-speed-pedestrians-risk-severe-injury-death/) (2011) |
| `PED_FATALITY_LOGIT_SLOPE`<br>Pedestrian fatality risk curve: slope per mph | 0.1255 | log-odds per mph | 0.09–0.16 | Settled | [Tefft, "Impact Speed and a Pedestrians Risk of Severe Injury or Death", AAA Foundation for Traffic Safety](https://aaafoundation.org/impact-speed-pedestrians-risk-severe-injury-death/) (2011) |
| `PED_FATALITY_50PCT_SPEED_ANCHOR`<br>Impact speed at which half of struck pedestrians die | 42 | miles per hour | 38–46 | Settled | [Tefft, "Impact Speed and a Pedestrians Risk of Severe Injury or Death", AAA Foundation for Traffic Safety](https://aaafoundation.org/impact-speed-pedestrians-risk-severe-injury-death/) (2011) |
| `CMF_ROAD_DIET`<br>Crash modification factor: four-to-three lane conversion, total crashes | 0.71 | multiplier | 0.53–0.81 | Settled | [FHWA, "Evaluation of Lane Reduction Road Diet Measures on Crashes" (FHWA-HRT-10-053)](https://www.fhwa.dot.gov/publications/research/safety/10053/) (2010) |
| `CMF_ROAD_DIET_INJURY`<br>Crash modification factor: road diet, fatal and injury crashes | 0.63 | multiplier | 0.36–0.8 | Settled | [FHWA, "Evaluation of Lane Reduction Road Diet Measures on Crashes" (FHWA-HRT-10-053)](https://www.fhwa.dot.gov/publications/research/safety/10053/) (2010) |
| `CMF_ROUNDABOUT`<br>Crash modification factor: signal to roundabout, total crashes | 0.52 | multiplier | 0.3–0.8 | Settled | [FHWA CMF Clearinghouse, "Evaluation of Roundabout Safety" (study 317)](https://cmfclearinghouse.fhwa.dot.gov/study_detail.php?stid=317) (clearinghouse entry) |
| `CMF_ROUNDABOUT_INJURY`<br>Crash modification factor: roundabout, injury crashes | 0.24 | multiplier | 0.1–0.48 | Settled | [Insurance Institute for Highway Safety, "Crash Reductions Following Installation of Roundabouts in the United States", via NYSDOT](https://www.dot.ny.gov/main/roundabouts/files/insurance_report.pdf) (2000) |
| `CMF_RAISED_MEDIAN`<br>Crash modification factor: raised median | 0.75 | multiplier | 0.6–0.9 | Varies by context | [FHWA Crash Modification Factor Clearinghouse](https://cmfclearinghouse.fhwa.dot.gov/) (ongoing) |
| `CMF_BULB_OUTS`<br>Crash modification factor: kerb extensions, pedestrian crashes | 0.7 | multiplier | 0.5–0.95 | Varies by context | [FHWA Crash Modification Factor Clearinghouse](https://cmfclearinghouse.fhwa.dot.gov/) (ongoing) |
| `CMF_DAYLIGHTING`<br>Crash modification factor: intersection daylighting, pedestrian crashes | 0.7 | multiplier | 0.45–0.95 | Varies by context | [FHWA Crash Modification Factor Clearinghouse](https://cmfclearinghouse.fhwa.dot.gov/) (ongoing) |
| `CMF_PROTECTED_BIKE_LANE`<br>Crash modification factor: protected bike lane, per cyclist | 0.47 | multiplier | 0.25–0.8 | Varies by context | [FHWA Crash Modification Factor Clearinghouse](https://cmfclearinghouse.fhwa.dot.gov/) (ongoing) |
| `CRASH_RATE_LANE_WIDTH_PER_FOOT`<br>Crash rate change per extra foot of lane width | 0.1 | fractional change per foot | -0.02–0.15 | Contested | [Hamidi et al., Johns Hopkins Bloomberg School of Public Health, "A National Investigation on the Impacts of Lane Width on Traffic Safety"](https://narrowlanes.americanhealth.jhu.edu/report/JHU-2023-Narrowing-Travel-Lanes-Report.pdf) (2023) |
| `LANE_WIDTH_EFFECT_MIN_SPEED_MPH`<br>Speed below which lane width stops mattering | 26 | miles per hour | 25–30 | Varies by context | [Hamidi et al., Johns Hopkins Bloomberg School of Public Health, "A National Investigation on the Impacts of Lane Width on Traffic Safety"](https://narrowlanes.americanhealth.jhu.edu/report/JHU-2023-Narrowing-Travel-Lanes-Report.pdf) (2023) |
| `CRASH_SEVERITY_SPEED_EXPONENT`<br>Severity sensitivity to speed | 3 | exponent on the speed ratio | 2–4.5 | Varies by context | _Design parameter_ |
| `CRASH_RATE_PER_CURB_CUT`<br>Crash rate increase per driveway per mile | 0.008 | fractional increase per curb cut per mile | 0.003–0.02 | Varies by context | _Design parameter_ |
| `PED_CRASH_RISK_PER_CROSSING`<br>Baseline risk of a reported crash per pedestrian crossing | 2.40e-7 | crashes per crossing event | 5.00e-8–1.00e-6 | Varies by context | _Design parameter_ |
| `BIKE_CRASH_RISK_PER_MILE`<br>Baseline risk of a reported crash per bicycle-mile | 4.50e-6 | crashes per bicycle-mile | 1.00e-6–2.00e-5 | Varies by context | _Design parameter_ |
| `MIDBLOCK_CROSSING_RISK_MULTIPLIER`<br>Risk multiplier for crossing away from a marked crossing | 3 | multiplier | 1.8–6 | Varies by context | _Design parameter_ |
| `BASE_SEVERITY_FATAL`<br>Share of crashes that are fatal at a 35 mph reference | 0.0015 | fraction | 5.00e-4–0.005 | Varies by context | _Design parameter_ |
| `BASE_SEVERITY_SERIOUS`<br>Share of crashes causing serious injury at a 35 mph reference | 0.028 | fraction | 0.01–0.08 | Varies by context | _Design parameter_ |
| `BASE_SEVERITY_MINOR`<br>Share of crashes causing minor injury at a 35 mph reference | 0.3 | fraction | 0.2–0.45 | Varies by context | _Design parameter_ |
| `SEVERITY_REFERENCE_SPEED_MPH`<br>Speed at which the base severity split applies | 35 | miles per hour | 35–35 | Settled | _Design parameter_ |
| `VALUE_OF_STATISTICAL_LIFE`<br>Value of a statistical life | 13,200,000 | dollars | 11,000,000–16,000,000 | Varies by context | [USDOT, Benefit-Cost Analysis Guidance for Discretionary Grant Programs](https://www.transportation.gov/sites/dot.gov/files/2022-03/Benefit%20Cost%20Analysis%20Guidance%202022%20Update.pdf) (2022 update) |
| `COST_SERIOUS_INJURY`<br>Comprehensive cost of a serious injury crash | 830,000 | dollars | 400,000–1,600,000 | Varies by context | [FHWA, "Updated Crash Costs for Highway Safety Analysis" (FHWA-SA-25-021)](https://highways.dot.gov/sites/fhwa.dot.gov/files/2025-10/CrashCostFactSheet_508_OCT2025.pdf) (2025 (2024 dollars)) |
| `COST_MINOR_INJURY`<br>Comprehensive cost of a minor injury crash | 105,000 | dollars | 40,000–250,000 | Varies by context | [FHWA, "Updated Crash Costs for Highway Safety Analysis" (FHWA-SA-25-021)](https://highways.dot.gov/sites/fhwa.dot.gov/files/2025-10/CrashCostFactSheet_508_OCT2025.pdf) (2025 (2024 dollars)) |
| `COST_PDO_CRASH`<br>Comprehensive cost of a property-damage-only crash | 12,000 | dollars | 5,000–25,000 | Varies by context | [FHWA, "Updated Crash Costs for Highway Safety Analysis" (FHWA-SA-25-021)](https://highways.dot.gov/sites/fhwa.dot.gov/files/2025-10/CrashCostFactSheet_508_OCT2025.pdf) (2025 (2024 dollars)) |

- **Base crash rate, urban arterial** (`BASE_CRASH_RATE_PER_MVMT`): Total reported crashes, all severities. A calibration parameter of the right order for a multi-lane urban arterial; not taken from a specific published safety performance function.
- **Pedestrian fatality risk curve: intercept** (`PED_FATALITY_LOGIT_INTERCEPT`): Logistic curve fitted to Tefft: 10% risk of death at 23 mph, 50% at 42 mph, 90% at 58 mph. The fit reproduces all five published points to within a few percentage points.
- **Pedestrian fatality risk curve: slope per mph** (`PED_FATALITY_LOGIT_SLOPE`): The steepness between 30 and 45 mph is the point: that is exactly the range US arterials are designed for.
- **Impact speed at which half of struck pedestrians die** (`PED_FATALITY_50PCT_SPEED_ANCHOR`): Widely miscited from the older Ashton & Mackay work as much lower. Tefft standardised to a modern US vehicle fleet; a test asserts the model curve passes through this point.
- **Crash modification factor: four-to-three lane conversion, total crashes** (`CMF_ROAD_DIET`): Below 1 means fewer crashes. One of the best-evidenced treatments in the clearinghouse; Minnesota sites showed reductions up to 54%.
- **Crash modification factor: road diet, fatal and injury crashes** (`CMF_ROAD_DIET_INJURY`): The severity effect is larger than the frequency effect, which is the pattern for every treatment that removes speed.
- **Crash modification factor: signal to roundabout, total crashes** (`CMF_ROUNDABOUT`): Total crashes fall by about half; the change in what kind of crash happens matters more.
- **Crash modification factor: roundabout, injury crashes** (`CMF_ROUNDABOUT_INJURY`): A 76% reduction in injury crashes and about 90% in fatal and incapacitating ones: roundabouts delete the high-speed right-angle conflict rather than managing it.
- **Crash modification factor: raised median** (`CMF_RAISED_MEDIAN`): Typical of clearinghouse entries for removing left-turn conflicts across opposing traffic. A representative value rather than one specific study.
- **Crash modification factor: kerb extensions, pedestrian crashes** (`CMF_BULB_OUTS`): Shortens the crossing and puts the waiting pedestrian where drivers can see them. Representative clearinghouse value.
- **Crash modification factor: intersection daylighting, pedestrian crashes** (`CMF_DAYLIGHTING`): Clearing parked cars from the approach so the crossing is visible. Representative clearinghouse value.
- **Crash modification factor: protected bike lane, per cyclist** (`CMF_PROTECTED_BIKE_LANE`): Per cyclist, not in total. A facility that attracts riders can raise total bicycle crashes while cutting each riders risk - a distinction the newspaper in this game never makes.
- **Crash rate change per extra foot of lane width** (`CRASH_RATE_LANE_WIDTH_PER_FOOT`): The Johns Hopkins study found roughly 1.5x the crashes at 12 ft versus 9 ft on 30-35 mph urban streets. Genuinely disputed: older rural highway research found wider lanes safer, and some engineers argue narrow lanes increase side friction.
- **Speed below which lane width stops mattering** (`LANE_WIDTH_EFFECT_MIN_SPEED_MPH`): The same study found no significant crash difference by lane width in 20-25 mph zones. The model honours that: below this speed, narrowing lanes buys nothing on safety. The width effect itself is contested; this threshold is one reading of one study.
- **Severity sensitivity to speed** (`CRASH_SEVERITY_SPEED_EXPONENT`): Kinetic energy scales with the square of speed; observed fatality rates scale faster still. A modelling choice within that range.
- **Crash rate increase per driveway per mile** (`CRASH_RATE_PER_CURB_CUT`): Every driveway is a place where one car crosses the path of everyone else. Access management research supports the direction; this magnitude is a modelling choice.
- **Baseline risk of a reported crash per pedestrian crossing** (`PED_CRASH_RISK_PER_CROSSING`): Calibration parameter, set so a 1.2-mile six-lane arterial with year-zero walking produces a handful of pedestrian crashes a year - which is what such corridors produce.
- **Baseline risk of a reported crash per bicycle-mile** (`BIKE_CRASH_RISK_PER_MILE`): Calibration parameter. Rises steeply with level of traffic stress, which is why the same lane is safe on a slow street and lethal on a fast one.
- **Risk multiplier for crossing away from a marked crossing** (`MIDBLOCK_CROSSING_RISK_MULTIPLIER`): People do not walk a quarter of a mile to a signal. When crossings are far apart they cross where they are, and the model charges for it.
- **Share of crashes that are fatal at a 35 mph reference** (`BASE_SEVERITY_FATAL`): The reference severity split the speed exponent operates on. Calibrated so a bad 1.2-mile arterial kills roughly one person every two years, which is what bad 1.2-mile arterials do.
- **Share of crashes causing serious injury at a 35 mph reference** (`BASE_SEVERITY_SERIOUS`): KABCO "A". Scales with speed alongside the fatal share.
- **Share of crashes causing minor injury at a 35 mph reference** (`BASE_SEVERITY_MINOR`): KABCO "B" and "C". The remainder are property damage only.
- **Speed at which the base severity split applies** (`SEVERITY_REFERENCE_SPEED_MPH`): Severity scales from here as (speed / 35) raised to the severity exponent.
- **Value of a statistical life** (`VALUE_OF_STATISTICAL_LIFE`): USDOT updates this annually. VERIFICATION GAP: the current authority for KABCO-level crash costs is the FHWA fact sheet FHWA-SA-25-021, which the build environment could not reach; this figure should be checked against it before release.
- **Comprehensive cost of a serious injury crash** (`COST_SERIOUS_INJURY`): KABCO "A" severity, as a fraction of the value of a statistical life. Same verification gap as above.
- **Comprehensive cost of a minor injury crash** (`COST_MINOR_INJURY`): KABCO "B" and "C" severities combined. Same verification gap as above.
- **Comprehensive cost of a property-damage-only crash** (`COST_PDO_CRASH`): The cheapest crashes, and the ones that make up most of the count. Same verification gap as above.

## Noise, air and heat

What the corridor does to the people standing next to it.

| Constant | Value | Units | Range | Confidence | Source |
| --- | ---: | --- | ---: | --- | --- |
| `NOISE_REFERENCE_DBA`<br>Reference sound level | 57 | dBA at 50 ft | 52–62 | Varies by context | [FHWA, Traffic Noise Model Technical Manual - reference energy mean emission levels](https://www.fhwa.dot.gov/environment/noise/traffic_noise_model/old_versions/tnm_version_10/tech_manual/tnm00.cfm) (1998) |
| `NOISE_DB_PER_VOLUME_DOUBLING`<br>Sound level change per doubling of traffic volume | 3 | dBA | 3–3.01 | Settled | [FHWA, Traffic Noise Model Technical Manual - reference energy mean emission levels](https://www.fhwa.dot.gov/environment/noise/traffic_noise_model/old_versions/tnm_version_10/tech_manual/tnm00.cfm) (1998) |
| `NOISE_DB_PER_SPEED_DOUBLING`<br>Sound level change per doubling of speed | 9 | dBA | 7.5–12 | Varies by context | [FHWA, Traffic Noise Model Technical Manual - reference energy mean emission levels](https://www.fhwa.dot.gov/environment/noise/traffic_noise_model/old_versions/tnm_version_10/tech_manual/tnm00.cfm) (1998) |
| `NOISE_DB_PER_DISTANCE_DOUBLING`<br>Attenuation per doubling of distance | 3 | dBA | 3–4.5 | Settled | [FHWA, Traffic Noise Model Technical Manual - reference energy mean emission levels](https://www.fhwa.dot.gov/environment/noise/traffic_noise_model/old_versions/tnm_version_10/tech_manual/tnm00.cfm) (1998) |
| `NOISE_BARRIER_ATTENUATION`<br>Attenuation from a solid building wall at the back of the pavement | 8 | dBA | 5–15 | Varies by context | [FHWA, Traffic Noise Model Technical Manual - reference energy mean emission levels](https://www.fhwa.dot.gov/environment/noise/traffic_noise_model/old_versions/tnm_version_10/tech_manual/tnm00.cfm) (1998) |
| `NOISE_VEGETATION_ATTENUATION`<br>Attenuation from a belt of street trees | 1 | dBA | 0–3 | Settled | [FHWA, Traffic Noise Model Technical Manual - reference energy mean emission levels](https://www.fhwa.dot.gov/environment/noise/traffic_noise_model/old_versions/tnm_version_10/tech_manual/tnm00.cfm) (1998) |
| `NOISE_ANNOYANCE_THRESHOLD`<br>Road traffic level above which annoyance rises sharply | 53 | dBA Lden | 50–55 | Varies by context | [WHO Regional Office for Europe, Environmental Noise Guidelines for the European Region](https://iris.who.int/bitstream/handle/10665/279952/9789289053563-eng.pdf) (2018) |
| `NOISE_CARDIOVASCULAR_THRESHOLD`<br>Level associated with a measurable rise in heart disease risk | 59.3 | dBA Lden | 53–65 | Contested | [WHO Regional Office for Europe, Environmental Noise Guidelines for the European Region](https://iris.who.int/bitstream/handle/10665/279952/9789289053563-eng.pdf) (2018) |
| `NOISE_IHD_RISK_PER_10DB`<br>Relative risk of ischaemic heart disease per 10 dB | 1.08 | relative risk | 1.01–1.15 | Varies by context | [WHO Regional Office for Europe, Environmental Noise Guidelines for the European Region](https://iris.who.int/bitstream/handle/10665/279952/9789289053563-eng.pdf) (2018) |
| `PM25_EMISSION_G_PER_VMT`<br>PM2.5 emission factor | 0.021 | grams per vehicle-mile | 0.008–0.05 | Varies by context | _Design parameter_ |
| `NOX_EMISSION_G_PER_VMT`<br>NOx emission factor | 0.28 | grams per vehicle-mile | 0.1–0.8 | Varies by context | _Design parameter_ |
| `NEAR_ROAD_NO2_DECAY_DISTANCE_FT`<br>Distance over which NO2 decays to background | 1,640 | feet | 650–1,640 | Varies by context | [Health Effects Institute, Special Report 17: Traffic-Related Air Pollution - A Critical Review](https://www.healtheffects.org/system/files/SR17TrafficReview.pdf) (2010) |
| `PM25_NEAR_ROAD_ELEVATION`<br>PM2.5 elevation at the kerb relative to background | 0.2 | fraction above background | 0.05–0.35 | Varies by context | [Zhou et al., "A meta-analysis of selected near-road air pollutants based on concentration decay rates", Heliyon](https://pmc.ncbi.nlm.nih.gov/articles/PMC6716115/) (2019) |
| `PM25_ANNUAL_THRESHOLD`<br>Annual PM2.5 standard | 9 | micrograms per cubic metre | 5–12 | Settled | [US EPA, National Ambient Air Quality Standards for Particulate Matter](https://www.epa.gov/pm-pollution/national-ambient-air-quality-standards-naaqs-pm) (2024) |
| `SURFACE_TEMP_EXCESS_ASPHALT_F`<br>Peak asphalt SURFACE temperature above air temperature | 48 | degrees F | 30–65 | Settled | [US EPA, Heat Island Effect](https://www.epa.gov/heatislands) (ongoing) |
| `SHADE_SURFACE_TEMP_REDUCTION_F`<br>Surface temperature reduction under shade | 32 | degrees F | 20–45 | Settled | [US EPA, Heat Island Effect](https://www.epa.gov/heatislands) (ongoing) |
| `AIR_TEMP_UHI_MAX_F`<br>Maximum afternoon AIR temperature excess from local land cover | 7 | degrees F | 3–12 | Contested | [Schwaab et al., "The role of urban trees in reducing land surface temperatures in European cities", Nature Communications](https://www.nature.com/articles/s41467-021-26768-w) (2021) |
| `AIR_TEMP_CANOPY_COOLING_MAX_F`<br>Maximum air cooling achievable from tree canopy | 2.7 | degrees F | 0.9–10.4 | Contested | [npj Urban Sustainability, "Increasing tree canopy lowers urban air temperature by up to 1.5 C in heat-prone areas"](https://www.nature.com/articles/s42949-025-00277-x) (2025) |
| `AIR_TEMP_COOLING_PER_CANOPY_POINT_F`<br>Air cooling per percentage point of tree canopy | 0.07 | degrees F per percentage point | 0.02–0.12 | Contested | [npj Urban Sustainability, "Increasing tree canopy lowers urban air temperature by up to 1.5 C in heat-prone areas"](https://www.nature.com/articles/s42949-025-00277-x) (2025) |
| `BASE_DAYS_OVER_95`<br>Baseline days above 95F | 18 | days per year | 5–45 | Varies by context | _Design parameter_ |
| `CLIMATE_DAYS_OVER_95_TREND`<br>Trend in days above 95F | 0.45 | additional days per year | 0.2–0.9 | Varies by context | _Design parameter_ |
| `DAYS_OVER_95_PER_DEGREE_F`<br>Additional days above 95F per degree of local warming | 2.6 | days per degree F | 1.2–4.5 | Varies by context | _Design parameter_ |
| `STOP_AND_GO_EMISSION_PENALTY`<br>Emission penalty in congested flow | 1.55 | multiplier at volume-to-capacity 1.0 | 1.2–2.4 | Varies by context | _Design parameter_ |
| `PM25_REGIONAL_BACKGROUND`<br>Regional background PM2.5 | 8 | micrograms per cubic metre | 4–14 | Varies by context | [US EPA, National Ambient Air Quality Standards for Particulate Matter](https://www.epa.gov/pm-pollution/national-ambient-air-quality-standards-naaqs-pm) (2024) |
| `NO2_REGIONAL_BACKGROUND`<br>Regional background NO2 | 12 | parts per billion | 5–25 | Varies by context | [Health Effects Institute, Special Report 17: Traffic-Related Air Pollution - A Critical Review](https://www.healtheffects.org/system/files/SR17TrafficReview.pdf) (2010) |
| `NO2_NEAR_ROAD_ELEVATION`<br>NO2 elevation at the kerb relative to background | 0.55 | fraction above background | 0.2–1.2 | Varies by context | [Health Effects Institute, Special Report 17: Traffic-Related Air Pollution - A Critical Review](https://www.healtheffects.org/system/files/SR17TrafficReview.pdf) (2010) |
| `TRUCK_SHARE`<br>Heavy vehicle share of corridor traffic | 0.045 | fraction | 0.02–0.09 | Varies by context | _Design parameter_ |
| `TRUCK_NOISE_EQUIVALENCE`<br>Cars per heavy vehicle, acoustically | 10 | passenger car equivalents | 5–20 | Varies by context | [FHWA, Traffic Noise Model Technical Manual - reference energy mean emission levels](https://www.fhwa.dot.gov/environment/noise/traffic_noise_model/old_versions/tnm_version_10/tech_manual/tnm00.cfm) (1998) |

- **Reference sound level** (`NOISE_REFERENCE_DBA`): The level from a stream of 1,000 vehicles an hour at 30 mph, 50 ft from the near lane. The anchor the whole noise model hangs from.
- **Sound level change per doubling of traffic volume** (`NOISE_DB_PER_VOLUME_DOUBLING`): Double the sources, double the acoustic energy: 10*log10(2) = 3.01 dB. This is arithmetic, not empirics.
- **Sound level change per doubling of speed** (`NOISE_DB_PER_SPEED_DOUBLING`): Tyre-pavement noise power rises roughly as the cube of speed, so about 30*log10(speed). Three times the effect of doubling volume - which is why slowing a road does more than emptying it, and why most people have never noticed.
- **Attenuation per doubling of distance** (`NOISE_DB_PER_DISTANCE_DOUBLING`): A line source falls off at 3 dB per doubling over hard ground, faster over soft ground.
- **Attenuation from a solid building wall at the back of the pavement** (`NOISE_BARRIER_ATTENUATION`): Buildings at the pavement edge shield what is behind them. One reason a 40-foot setback is not free.
- **Attenuation from a belt of street trees** (`NOISE_VEGETATION_ATTENUATION`): Vegetation does almost nothing acoustically. It is in the model precisely so the model does not flatter it.
- **Road traffic level above which annoyance rises sharply** (`NOISE_ANNOYANCE_THRESHOLD`): The WHO strong recommendation for road traffic noise. Above it, roughly 10% of the population is highly annoyed.
- **Level associated with a measurable rise in heart disease risk** (`NOISE_CARDIOVASCULAR_THRESHOLD`): A 5% increase in ischaemic heart disease is reported around this level. The dose-response relationship is real and its exact shape is debated.
- **Relative risk of ischaemic heart disease per 10 dB** (`NOISE_IHD_RISK_PER_10DB`): From the meta-analysis underpinning the WHO guidelines. Small per person, large across a corridor of 18,000.
- **PM2.5 emission factor** (`PM25_EMISSION_G_PER_VMT`): Includes brake and tyre wear, which do not fall as the fleet electrifies. A modelling parameter of the right order.
- **NOx emission factor** (`NOX_EMISSION_G_PER_VMT`): Falls with fleet turnover, rises sharply in stop-and-go operation.
- **Distance over which NO2 decays to background** (`NEAR_ROAD_NO2_DECAY_DISTANCE_FT`): Roughly 200-500 metres. About a fifth of NO2 is removed by 300 m and the gradient extends further downwind at night.
- **PM2.5 elevation at the kerb relative to background** (`PM25_NEAR_ROAD_ELEVATION`): Deliberately modest. PM2.5 is far more spatially uniform than ultrafine particles or NO2, and several reviews find no significant near-road gradient at all. The model does not overstate it.
- **Annual PM2.5 standard** (`PM25_ANNUAL_THRESHOLD`): The EPA annual primary standard, tightened from 12 in 2024. The WHO guideline is 5.
- **Peak asphalt SURFACE temperature above air temperature** (`SURFACE_TEMP_EXCESS_ASPHALT_F`): SURFACE, not air. Dark paving can read 50-60F above the air on a sunny afternoon. This is the big number, and it is not an air temperature.
- **Surface temperature reduction under shade** (`SHADE_SURFACE_TEMP_REDUCTION_F`): Shaded surfaces run 20-45F cooler than the same material in full sun. This is what a person standing on the pavement in August actually feels.
- **Maximum afternoon AIR temperature excess from local land cover** (`AIR_TEMP_UHI_MAX_F`): Intra-city AIR temperature differences are far smaller than surface differences and are routinely conflated with them. Reported land-surface differences of 20-40F correspond to air differences of a few degrees.
- **Maximum air cooling achievable from tree canopy** (`AIR_TEMP_CANOPY_COOLING_MAX_F`): Up to 1.5 C in heat-prone areas from increased canopy. Reviews report air cooling from 0.5 to 5.8 C depending on canopy density and climate, so the upper end is genuinely uncertain.
- **Air cooling per percentage point of tree canopy** (`AIR_TEMP_COOLING_PER_CANOPY_POINT_F`): Derived by spreading the maximum cooling over a realistic canopy range. Non-linear in reality: canopy below roughly 40% cover does much less per point than canopy above it.
- **Baseline days above 95F** (`BASE_DAYS_OVER_95`): For a generic mid-latitude US city, before the local heat island is added.
- **Trend in days above 95F** (`CLIMATE_DAYS_OVER_95_TREND`): Background warming over the thirty years of a run, independent of anything the player does. It is in the model so the player cannot take credit for it.
- **Additional days above 95F per degree of local warming** (`DAYS_OVER_95_PER_DEGREE_F`): The tail of the temperature distribution moves faster than the mean does.
- **Emission penalty in congested flow** (`STOP_AND_GO_EMISSION_PENALTY`): Accelerating away from a queue burns far more fuel per mile than steady running.
- **Regional background PM2.5** (`PM25_REGIONAL_BACKGROUND`): What the whole region breathes before the corridor adds anything. The corridor increment is measured against this.
- **Regional background NO2** (`NO2_REGIONAL_BACKGROUND`): Urban background away from major roads.
- **NO2 elevation at the kerb relative to background** (`NO2_NEAR_ROAD_ELEVATION`): NO2 shows a real near-road gradient, unlike PM2.5: roughly a fifth of it is gone by 300 m and the gradient runs to 500 m.
- **Heavy vehicle share of corridor traffic** (`TRUCK_SHARE`): Small in count, large in noise.
- **Cars per heavy vehicle, acoustically** (`TRUCK_NOISE_EQUIVALENCE`): Why a corridor on a lorry route sounds louder than its volume suggests.

## What the corridor sounds like

The noise model says how loud. These say what the loudness is made of.

| Constant | Value | Units | Range | Confidence | Source |
| --- | ---: | --- | ---: | --- | --- |
| `PEAK_HOUR_SHARE_OF_AADT`<br>Share of a day's traffic that arrives in the peak hour | 0.095 | fraction | 0.08–0.11 | Varies by context | [FHWA, "Simplified Highway Capacity Calculation Method for the Highway Performance Monitoring System" (FHWA-PL-18-003)](https://www.fhwa.dot.gov/policyinformation/pubs/pl18003/hpms_cap.pdf) (2018) |
| `AUDIO_FULL_SCALE_DBA`<br>Sound level that maps to digital full scale | 88 | dBA | 84–94 | Settled | _Design parameter_ |
| `TYRE_NOISE_PEAK_HZ`<br>Centre frequency of tyre-pavement noise | 1,000 | Hz | 800–1,250 | Settled | [Sandberg & Ejsmont, "The multi-coincidence peak around 1000 Hz in tyre/road noise spectra", EuroNoise](https://informex.info/Multi-coincidence_peak_-_EuroNoise_ppr.pdf) (2003) |
| `TYRE_PEAK_HZ_PER_SPEED_DOUBLING`<br>Shift in the tyre noise peak per doubling of speed | 1.19 | ratio | 1–1.4 | Varies by context | _Design parameter_ |
| `ENGINE_FIRING_HZ_AT_CRUISE`<br>Engine firing frequency at cruise | 70 | Hz | 45–110 | Settled | _Design parameter_ |
| `WORN_SURFACE_NOISE_PENALTY_DBA`<br>Extra noise from a ravelled surface | 2.5 | dBA | 1–5 | Varies by context | [FHWA, Traffic Noise Model Technical Manual - reference energy mean emission levels](https://www.fhwa.dot.gov/environment/noise/traffic_noise_model/old_versions/tnm_version_10/tech_manual/tnm00.cfm) (1998) |
| `CAR_CABIN_ATTENUATION_DBA`<br>Reduction of outside noise inside a closed car | 24 | dBA | 18–30 | Varies by context | _Design parameter_ |
| `LEAF_RUSTLE_DBA`<br>Wind in a full canopy, at the kerb | 42 | dBA | 30–50 | Varies by context | _Design parameter_ |
| `BIRD_CALLS_PER_MIN_AT_FULL_CANOPY`<br>Bird calls a minute under a full canopy on a quiet street | 14 | calls per minute | 4–40 | Varies by context | _Design parameter_ |
| `PASS_ENVELOPE_ENERGY_FACTOR`<br>Energy in one pass-by envelope, as a share of peak squared times duration | 0.52 | fraction | 0.45–0.58 | Settled | _Design parameter_ |
| `BIRD_SILENCE_DBA`<br>Level at which birdsong stops being part of the street | 72 | dBA | 65–78 | Varies by context | _Design parameter_ |

- **Share of a day's traffic that arrives in the peak hour** (`PEAK_HOUR_SHARE_OF_AADT`): The K-factor. Urban arterials run eight to ten per cent; rural roads run higher because their days are peakier. It converts the one number everybody quotes about a road into the one that decides whether you can cross it.
- **Sound level that maps to digital full scale** (`AUDIO_FULL_SCALE_DBA`): The anchor that makes the mix a real decibel scale instead of a slider. Every level in the game is 10^((dBA-88)/20), so a corridor the model says is 16 dB quieter is a quarter as loud, and the player hears the model rather than a designer.
- **Centre frequency of tyre-pavement noise** (`TYRE_NOISE_PEAK_HZ`): Tyre/road noise spectra peak around 1 kHz for passenger cars, from the coincidence of tread pitch, pipe and Helmholtz resonance, the horn effect and the road texture spectrum. Heavy vehicles sit lower, 500 to 1000 Hz.
- **Shift in the tyre noise peak per doubling of speed** (`TYRE_PEAK_HZ_PER_SPEED_DOUBLING`): The peak itself is set by resonances and moves little with speed; what changes is the balance of the spectrum above and below it. Modelled here as a modest upward shift because that is what the ear reports - a road brightens as it speeds up.
- **Engine firing frequency at cruise** (`ENGINE_FIRING_HZ_AT_CRUISE`): Arithmetic, not a measurement: a four-cylinder four-stroke at about 2,100 rpm fires 4,200 times a minute, which is 70 Hz. The low half of what a stream of traffic sounds like.
- **Extra noise from a ravelled surface** (`WORN_SURFACE_NOISE_PENALTY_DBA`): Surface texture is worth a few decibels either way: a fresh quiet surface takes some off, a ravelled one puts it back. The same deferred resurfacing that shakes the car also makes the street louder.
- **Reduction of outside noise inside a closed car** (`CAR_CABIN_ATTENUATION_DBA`): A game design parameter, chosen at the middle of the range usually quoted for a passenger car with the windows up. It is the whole reason the corridor sounds like one thing from the seat and another from the pavement, so it is stated rather than assumed.
- **Wind in a full canopy, at the kerb** (`LEAF_RUSTLE_DBA`): Quiet. Thirty-six decibels below the corridor at year zero, which is a two-hundred-and-fiftieth of the amplitude and correctly inaudible; on a street that has been calmed to the low sixties it is there. Rustling leaves are the textbook example of a level nobody can hear next to a road, and putting it in as a level rather than as a mix fader is what keeps it that way.
- **Bird calls a minute under a full canopy on a quiet street** (`BIRD_CALLS_PER_MIN_AT_FULL_CANOPY`): A design parameter for how alive a street sounds. The relationship behind it is not: bird abundance falls with traffic noise, so the calls are suppressed by the level as well as raised by the canopy.
- **Energy in one pass-by envelope, as a share of peak squared times duration** (`PASS_ENVELOPE_ENERGY_FACTOR`): Measured by rendering the envelope the synthesiser actually draws and integrating it, not estimated. It is what lets a pass be sized so the events and the continuous bed together come to exactly the equivalent level the noise model computed.
- **Level at which birdsong stops being part of the street** (`BIRD_SILENCE_DBA`): Partly masking and partly that birds are not there. Set so the corridor at year zero has none and a calmed one has some.

## Mode choice

How people decide to travel. Never set directly by the player.

| Constant | Value | Units | Range | Confidence | Source |
| --- | ---: | --- | ---: | --- | --- |
| `BIKE_WILLING_SHARE_LTS1`<br>Share of adults willing to ride in level of traffic stress 1 | 1 | fraction | 0.8–1 | Varies by context | _Design parameter_ |
| `BIKE_WILLING_SHARE_LTS2`<br>Share of adults willing to ride in level of traffic stress 2 | 0.55 | fraction | 0.35–0.75 | Varies by context | _Design parameter_ |
| `BIKE_WILLING_SHARE_LTS3`<br>Share of adults willing to ride in level of traffic stress 3 | 0.15 | fraction | 0.05–0.3 | Varies by context | _Design parameter_ |
| `BIKE_WILLING_SHARE_LTS4`<br>Share of adults willing to ride in level of traffic stress 4 | 0.03 | fraction | 0.005–0.08 | Varies by context | _Design parameter_ |
| `WALK_SPEED_MPH`<br>Walking speed | 3.1 | miles per hour | 2.5–3.5 | Settled | _Design parameter_ |
| `BIKE_SPEED_MPH`<br>Cycling speed | 9.5 | miles per hour | 8–13 | Settled | _Design parameter_ |
| `BUS_SPEED_MPH`<br>Bus running speed with stops | 12 | miles per hour | 8–18 | Varies by context | _Design parameter_ |
| `PARKING_SEARCH_MINUTES`<br>Time to find and leave a parking space | 2 | minutes | 0.5–8 | Varies by context | _Design parameter_ |
| `MODE_UTILITY_TIME_COEFFICIENT`<br>Utility weight on travel time | -0.045 | utils per minute | -0.09–-0.02 | Varies by context | _Design parameter_ |
| `MODE_UTILITY_COST_COEFFICIENT`<br>Utility weight on out-of-pocket cost | -0.28 | utils per dollar | -0.5–-0.1 | Varies by context | _Design parameter_ |
| `ASC_DRIVE`<br>Alternative-specific constant: driving | 1.2 | utils | 0.5–2.5 | Varies by context | _Design parameter_ |
| `ASC_WALK`<br>Alternative-specific constant: walking | 0 | utils | -1–1 | Varies by context | _Design parameter_ |
| `ASC_BIKE`<br>Alternative-specific constant: cycling | -2.6 | utils | -3.5–-1 | Varies by context | _Design parameter_ |
| `ASC_TRANSIT`<br>Alternative-specific constant: transit | -1.4 | utils | -3–-0.3 | Varies by context | _Design parameter_ |
| `WALK_COMFORT_PENALTY_MAX`<br>Maximum penalty on perceived walking time from a hostile street | 1.8 | multiplier on walk time | 1.2–3 | Varies by context | [Ewing & Cervero, "Travel and the Built Environment: A Meta-Analysis", Journal of the American Planning Association 76(3):265-294](https://www.tandfonline.com/doi/abs/10.1080/01944361003766766) (2010) |
| `BIKE_STRESS_PENALTY_MAX`<br>Maximum penalty on perceived cycling time from traffic stress | 3 | multiplier on bike time | 1.5–5 | Varies by context | _Design parameter_ |
| `TRANSIT_WAIT_WEIGHT`<br>How much worse waiting feels than riding | 2.1 | multiplier on wait time | 1.5–3 | Settled | [Litman, "Transit Price Elasticities and Cross-Elasticities", Victoria Transport Policy Institute](https://www.vtpi.org/tranelas.pdf) (ongoing) |
| `TRANSIT_FREQUENCY_ELASTICITY`<br>Elasticity of transit ridership with respect to service frequency | 0.5 | dimensionless | 0.3–0.7 | Settled | [Litman, "Transit Price Elasticities and Cross-Elasticities", Victoria Transport Policy Institute](https://www.vtpi.org/tranelas.pdf) (ongoing) |
| `TRANSIT_FARE_ELASTICITY`<br>Elasticity of transit ridership with respect to fare | -0.3 | dimensionless | -0.5–-0.15 | Settled | [Litman, "Transit Price Elasticities and Cross-Elasticities", Victoria Transport Policy Institute](https://www.vtpi.org/tranelas.pdf) (ongoing) |
| `PARKING_PRICE_ELASTICITY`<br>Elasticity of car trips with respect to parking price | -0.3 | dimensionless | -0.6–-0.1 | Varies by context | [Litman, "Transportation Elasticities", VTPI Online TDM Encyclopedia](https://www.vtpi.org/tdm/tdm11.htm) (ongoing) |
| `TRANSIT_DENSITY_THRESHOLD_DU_ACRE`<br>Density at which local bus service becomes viable | 7 | dwelling units per acre | 4–12 | Varies by context | [Puget Sound Regional Council, "Transit-Supportive Densities and Land Uses", summarising Pushkarev & Zupan](https://www.psrc.org/sites/default/files/2022-03/tsdluguidancepaper.pdf) (2022) |
| `MAX_BUILT_ENVIRONMENT_ELASTICITY`<br>Largest defensible elasticity of travel to any built-environment variable | 0.39 | dimensionless | 0.3–0.45 | Settled | [Ewing & Cervero, "Travel and the Built Environment: A Meta-Analysis", Journal of the American Planning Association 76(3):265-294](https://www.tandfonline.com/doi/abs/10.1080/01944361003766766) (2010) |
| `BIKE_RIDERSHIP_PROXIMITY_R2`<br>Variation in cycling explained by people living near the lane | 0.88 | r-squared | 0.7–0.95 | Varies by context | [ITDP, "Atlas: The Power of People Near Protected Bikelanes"](https://itdp.org/2024/06/03/atlas-the-power-of-people-near-protected-bikelanes/) (2024) |
| `WALK_TRIP_DISTANCE_DECAY`<br>Distance decay exponent for walking trips | 1.9 | exponent | 1.2–3 | Varies by context | [Ewing & Cervero, "Travel and the Built Environment: A Meta-Analysis", Journal of the American Planning Association 76(3):265-294](https://www.tandfonline.com/doi/abs/10.1080/01944361003766766) (2010) |
| `ACCESSIBILITY_TIME_BUDGET_MIN`<br>The reachability threshold | 15 | minutes | 15–15 | Settled | _Design parameter_ |

- **Share of adults willing to ride in level of traffic stress 1** (`BIKE_WILLING_SHARE_LTS1`): A quiet street a child could ride. Design parameter reflecting the level-of-traffic-stress literature: at LTS 1 willingness is not the binding constraint.
- **Share of adults willing to ride in level of traffic stress 2** (`BIKE_WILLING_SHARE_LTS2`): A protected lane or a slow street. Roughly the "interested but concerned" majority.
- **Share of adults willing to ride in level of traffic stress 3** (`BIKE_WILLING_SHARE_LTS3`): A painted lane on a busy street. Most people decline whatever the distance.
- **Share of adults willing to ride in level of traffic stress 4** (`BIKE_WILLING_SHARE_LTS4`): Sharing a 45 mph arterial lane. This is the number that makes a bike lane on a bad corridor fail, and it is why the failure is honest rather than a scripted punishment.
- **Walking speed** (`WALK_SPEED_MPH`): Average adult walking speed on level ground.
- **Cycling speed** (`BIKE_SPEED_MPH`): Average utility cycling speed including stops.
- **Bus running speed with stops** (`BUS_SPEED_MPH`): Slower than general traffic unless it has its own lane and signal priority.
- **Time to find and leave a parking space** (`PARKING_SEARCH_MINUTES`): Near zero in a half-empty car park, several minutes where kerb parking is free and full. Priced kerb parking is never full, which is the whole argument for pricing it.
- **Utility weight on travel time** (`MODE_UTILITY_TIME_COEFFICIENT`): Standard range in US mode choice models.
- **Utility weight on out-of-pocket cost** (`MODE_UTILITY_COST_COEFFICIENT`): Implies a value of time near $10/hour, at the low end of USDOT guidance, as is typical for short local trips.
- **Alternative-specific constant: driving** (`ASC_DRIVE`): The baked-in preference for driving that survives after time and cost are accounted for. Deliberately large: the game does not assume Americans secretly want to walk.
- **Alternative-specific constant: walking** (`ASC_WALK`): The reference mode; everything else is measured against it.
- **Alternative-specific constant: cycling** (`ASC_BIKE`): Most Americans will not cycle at any level of service. This constant is why a bike lane alone does not move mode share.
- **Alternative-specific constant: transit** (`ASC_TRANSIT`): Reflects reliability, comfort and stigma, none of which frequency alone fixes.
- **Maximum penalty on perceived walking time from a hostile street** (`WALK_COMFORT_PENALTY_MAX`): A ten-minute walk beside 45 mph traffic with no shade feels like eighteen, and people choose accordingly. Design effects on walking are real but bounded, consistent with the meta-analysis.
- **Maximum penalty on perceived cycling time from traffic stress** (`BIKE_STRESS_PENALTY_MAX`): Level of Traffic Stress. Most people will not ride in LTS 3 or 4 conditions at any distance.
- **How much worse waiting feels than riding** (`TRANSIT_WAIT_WEIGHT`): Consistently found near 2 in transit ridership research.
- **Elasticity of transit ridership with respect to service frequency** (`TRANSIT_FREQUENCY_ELASTICITY`): The headway elasticity averages 0.5, with larger effects where service is currently infrequent.
- **Elasticity of transit ridership with respect to fare** (`TRANSIT_FARE_ELASTICITY`): The Simpson-Curtin rule: a 3% fare rise costs about 1% of riders. Note this is the FARE rule, often misattributed to frequency.
- **Elasticity of car trips with respect to parking price** (`PARKING_PRICE_ELASTICITY`): Parking price moves behaviour more per dollar than fuel price does. Where a charge suppresses car trips, 20-60% of them shift to transit.
- **Density at which local bus service becomes viable** (`TRANSIT_DENSITY_THRESHOLD_DU_ACRE`): Pushkarev & Zupan: 7 for local bus, 9 for light rail, 12 for rapid transit. Below this a route burns subsidy and carries almost nobody - which is why a transit line at low density fails in this game.
- **Largest defensible elasticity of travel to any built-environment variable** (`MAX_BUILT_ENVIRONMENT_ELASTICITY`): A discipline anchor, not an input. No single design variable in the meta-analysis exceeds this, and a test asserts the model does not either. Density in particular is only weakly associated with travel once accessibility is controlled for.
- **Variation in cycling explained by people living near the lane** (`BIKE_RIDERSHIP_PROXIMITY_R2`): The evidential basis for letting bike lanes fail in this game. Infrastructure that does not connect where people live to where they are going is barely used.
- **Distance decay exponent for walking trips** (`WALK_TRIP_DISTANCE_DECAY`): Walking collapses beyond about half a mile, which is why land use, not pavement width, decides walk mode share.
- **The reachability threshold** (`ACCESSIBILITY_TIME_BUDGET_MIN`): The number the final scoring is built on. Chosen, not measured.

## Retail and housing

Whether shops survive and what it costs to live here.

| Constant | Value | Units | Range | Confidence | Source |
| --- | ---: | --- | ---: | --- | --- |
| `RETAIL_SALES_PER_SQFT_STRIP`<br>Annual sales per square foot: strip retail | 280 | dollars per square foot per year | 150–450 | Varies by context | _Design parameter_ |
| `RETAIL_SALES_PER_SQFT_MAINSTREET`<br>Annual sales per square foot: main street retail | 360 | dollars per square foot per year | 200–700 | Varies by context | _Design parameter_ |
| `RETAIL_SALES_PER_SQFT_BIG_BOX`<br>Annual sales per square foot: big box | 420 | dollars per square foot per year | 180–600 | Varies by context | _Design parameter_ |
| `RETAIL_RENT_PER_SQFT_STRIP`<br>Annual rent per square foot: strip retail | 19 | dollars per square foot per year | 18–35 | Varies by context | _Design parameter_ |
| `RETAIL_RENT_PER_SQFT_MAINSTREET`<br>Annual rent per square foot: main street retail | 27 | dollars per square foot per year | 14–60 | Varies by context | _Design parameter_ |
| `RETAIL_OCCUPANCY_COST_FAILURE_RATIO`<br>Occupancy cost ratio at which a shop fails | 0.15 | rent as a fraction of sales | 0.1–0.2 | Varies by context | _Design parameter_ |
| `RETAIL_FOOTFALL_SALES_ELASTICITY`<br>Elasticity of retail sales with respect to passing footfall | 0.25 | dimensionless | 0.1–0.45 | Varies by context | _Design parameter_ |
| `GROCERY_TRADE_AREA_POPULATION`<br>Population needed to support a full grocery | 9,000 | people | 5,000–20,000 | Varies by context | _Design parameter_ |
| `BUSINESS_TURNOVER_RATE_STRIP`<br>Annual tenant turnover: strip retail | 0.14 | fraction per year | 0.08–0.25 | Varies by context | _Design parameter_ |
| `STRUCTURED_PARKING_COST_PER_STALL`<br>Structured parking construction cost per stall | 29,900 | dollars per stall | 24,000–48,000 | Settled | [WGI, "Parking Structure Cost Outlook for 2024"](https://publications.wginc.com/parking-structure-cost-outlook-for-2024) (2024) |
| `SURFACE_PARKING_COST_PER_STALL`<br>Surface parking construction cost per stall | 6,000 | dollars per stall | 4,500–9,500 | Varies by context | [WGI, "Parking Structure Cost Outlook for 2024"](https://publications.wginc.com/parking-structure-cost-outlook-for-2024) (2024) |
| `PARKING_STALL_AREA_SQFT`<br>Land consumed per surface parking stall | 330 | square feet per stall | 300–400 | Settled | _Design parameter_ |
| `PARKING_MINIMUM_COST_PER_UNIT`<br>Monthly rent needed to carry each required parking stall | 150 | dollars per month per stall | 60–250 | Varies by context | [Litman, "Parking Requirement Impacts on Housing Affordability", Victoria Transport Policy Institute](https://www.vtpi.org/park-hou.pdf) (ongoing) |
| `HOUSING_SUPPLY_ELASTICITY`<br>Elasticity of housing supply with respect to price | 1.2 | dimensionless | 0.3–3 | Contested | _Design parameter_ |
| `RENT_DENSITY_ELASTICITY`<br>Elasticity of rent with respect to allowed density | -0.25 | dimensionless | -0.6–0 | Contested | _Design parameter_ |
| `CITY_MEDIAN_RENT`<br>Median rent in Fairview, away from the corridor | 1,150 | dollars per month | 800–2,200 | Varies by context | _Design parameter_ |
| `MAX_ANNUAL_RENT_CHANGE`<br>Fastest rents move in a year | 0.05 | fraction | 0.02–0.12 | Varies by context | _Design parameter_ |
| `MEDIAN_HOUSEHOLD_INCOME`<br>Median household income, Fairview | 63,000 | dollars per year | 45,000–85,000 | Varies by context | _Design parameter_ |
| `CAR_OWNERSHIP_ANNUAL_COST`<br>Annual cost of owning one car | 8,800 | dollars per year | 6,000–13,000 | Varies by context | _Design parameter_ |
| `TRANSPORT_COST_SHARE_AUTO_DEPENDENT`<br>Transport cost share of income: auto-dependent neighbourhood | 0.25 | fraction of household income | 0.18–0.32 | Varies by context | [Center for Neighborhood Technology, Housing + Transportation Affordability Index](https://htaindex.cnt.org/about/) (ongoing) |
| `TRANSPORT_COST_SHARE_WALKABLE`<br>Transport cost share of income: location-efficient neighbourhood | 0.15 | fraction of household income | 0.09–0.19 | Varies by context | [Center for Neighborhood Technology, Housing + Transportation Affordability Index](https://htaindex.cnt.org/about/) (ongoing) |
| `HT_AFFORDABILITY_BENCHMARK`<br>Combined housing and transport affordability benchmark | 0.45 | fraction of household income | 0.45–0.45 | Settled | [Center for Neighborhood Technology, Housing + Transportation Affordability Index](https://htaindex.cnt.org/about/) (ongoing) |

- **Annual sales per square foot: strip retail** (`RETAIL_SALES_PER_SQFT_STRIP`): Across all tenants including the weak ones. Class B in-line retail is commonly quoted at $250-400.
- **Annual sales per square foot: main street retail** (`RETAIL_SALES_PER_SQFT_MAINSTREET`): Smaller units and more visitors per hour, so more sales from less floor area.
- **Annual sales per square foot: big box** (`RETAIL_SALES_PER_SQFT_BIG_BOX`): Strong per square foot of building, weak per acre of site, because 85% of the site is not building. Calibrated so sales tax per acre reproduces the published figure.
- **Annual rent per square foot: strip retail** (`RETAIL_RENT_PER_SQFT_STRIP`): Triple net, mid-size market. Fairview sits at the bottom of the national range, because Fairview is struggling.
- **Annual rent per square foot: main street retail** (`RETAIL_RENT_PER_SQFT_MAINSTREET`): Higher rent, and shops still do better, because the footfall is worth more than the rent costs.
- **Occupancy cost ratio at which a shop fails** (`RETAIL_OCCUPANCY_COST_FAILURE_RATIO`): Above roughly 15% of sales, rent is consuming enough that viability is in question. Apparel runs near 12%, drug stores near 7%.
- **Elasticity of retail sales with respect to passing footfall** (`RETAIL_FOOTFALL_SALES_ELASTICITY`): Real but modest, and it only matters once there is somewhere to walk from. Held below the meta-analysis ceiling deliberately.
- **Population needed to support a full grocery** (`GROCERY_TRADE_AREA_POPULATION`): The threshold that decides whether the reachability score can ever improve. Below it, no amount of pavement produces a shop to walk to.
- **Annual tenant turnover: strip retail** (`BUSINESS_TURNOVER_RATE_STRIP`): Turnover is not failure. Sustained vacancy is.
- **Structured parking construction cost per stall** (`STRUCTURED_PARKING_COST_PER_STALL`): National median for above-grade structured parking. Below grade runs $48,000-$115,000 and rises 30-60% for each level down.
- **Surface parking construction cost per stall** (`SURFACE_PARKING_COST_PER_STALL`): Paving, drainage, striping and lighting, excluding the land - which is the expensive part, and the part nobody counts.
- **Land consumed per surface parking stall** (`PARKING_STALL_AREA_SQFT`): Stall plus its share of aisle. About 130 stalls to the acre.
- **Monthly rent needed to carry each required parking stall** (`PARKING_MINIMUM_COST_PER_UNIT`): Bundled into the rent of every unit whether the household owns a car or not. Structured parking runs several times this.
- **Elasticity of housing supply with respect to price** (`HOUSING_SUPPLY_ELASTICITY`): The supply-side and supply-sceptic camps disagree sharply about this number and about what it implies locally. The range here is wide on purpose.
- **Elasticity of rent with respect to allowed density** (`RENT_DENSITY_ELASTICITY`): Negative because more allowed supply lowers rent, but local studies find effects ranging from strongly negative to none at all.
- **Median rent in Fairview, away from the corridor** (`CITY_MEDIAN_RENT`): The anchor corridor rents are measured against. The corridor is a small part of a housing market it does not control.
- **Fastest rents move in a year** (`MAX_ANNUAL_RENT_CHANGE`): Leases, notice periods and stickiness. Without this cap the model produces rent moves no real market makes.
- **Median household income, Fairview** (`MEDIAN_HOUSEHOLD_INCOME`): The denominator for the transport cost burden the game scores at year 30.
- **Annual cost of owning one car** (`CAR_OWNERSHIP_ANNUAL_COST`): Depreciation, insurance, fuel, maintenance and finance. Shedding one car is the largest single saving available to a household on this corridor.
- **Transport cost share of income: auto-dependent neighbourhood** (`TRANSPORT_COST_SHARE_AUTO_DEPENDENT`): Household transport costs run from about $8,500 to $25,000 a year across a region. Never shown in the UI until year 30.
- **Transport cost share of income: location-efficient neighbourhood** (`TRANSPORT_COST_SHARE_WALKABLE`): CNT treats 15% as the attainable transport benchmark. The gap between this and the figure above is roughly a car payment, every month, for every household.
- **Combined housing and transport affordability benchmark** (`HT_AFFORDABILITY_BENCHMARK`): Housing alone is judged at 30%. Adding transport at 15% gives 45% - by which measure only about a quarter of US neighbourhoods are affordable.

## Politics

Game design parameters, tuned by play.

| Constant | Value | Units | Range | Confidence | Source |
| --- | ---: | --- | ---: | --- | --- |
| `STARTING_POLITICAL_CAPITAL`<br>Political capital at hiring | 60 | points | 60–60 | Settled | _Design parameter_ |
| `PC_ANNUAL_REGENERATION_BASE`<br>Political capital earned per year at neutral approval | 7 | points per year | 7–7 | Settled | _Design parameter_ |
| `PC_REGENERATION_FLOOR_APPROVAL`<br>Approval below which political capital drains rather than accrues | 15 | approval points | 15–15 | Settled | _Design parameter_ |
| `PC_REGENERATION_PIVOT_SPAN`<br>Approval points above the floor that earn the full annual rate | 25 | approval points | 25–25 | Settled | _Design parameter_ |
| `APPROVAL_CONGESTION_ANNUAL_CAP`<br>Most approval the traffic can cost in any one year | 15 | approval points per year | 15–15 | Settled | _Design parameter_ |
| `PC_SURPLUS_SENSITIVITY`<br>Approval points per million dollars of surplus swing | 0.9 | approval points per million dollars | 0.9–0.9 | Settled | _Design parameter_ |
| `APPROVAL_CONGESTION_SENSITIVITY`<br>Approval lost per 10% rise in peak travel time | 6 | approval points | 6–6 | Settled | _Design parameter_ |
| `PC_RIBBON_CUTTING`<br>Political capital from opening a completed capital project | 4 | points | 4–4 | Settled | _Design parameter_ |
| `APPROVAL_RIBBON_CUTTING`<br>Approval from opening a completed capital project | 6 | approval points | 6–6 | Settled | _Design parameter_ |
| `APPROVAL_FATALITY_SENSITIVITY`<br>Approval lost per additional death on the corridor | 1.8 | approval points per death | 1.8–1.8 | Settled | _Design parameter_ |
| `STATE_GRANT_MATCH_RATIO`<br>State DOT widening grant match | 0.9 | fraction funded by the state | 0.9–0.9 | Settled | _Design parameter_ |
| `RUN_LENGTH_YEARS`<br>Length of a run | 30 | years | 30–30 | Settled | _Design parameter_ |

- **Political capital at hiring** (`STARTING_POLITICAL_CAPITAL`): Enough to make one unpopular move in the first three years, and not two.
- **Political capital earned per year at neutral approval** (`PC_ANNUAL_REGENERATION_BASE`): Scaled by approval, so a popular director accumulates capital faster and can spend it on things nobody wants.
- **Approval below which political capital drains rather than accrues** (`PC_REGENERATION_FLOOR_APPROVAL`): The point where the council stops returning calls. Below it the balance falls every year and a director who never recovers is replaced.
- **Approval points above the floor that earn the full annual rate** (`PC_REGENERATION_PIVOT_SPAN`): Measured against the reference plan: at a floor of 20 and a span of 30 the plan cost 323 points and a director could bank about 177 of them, so better than a third of it was refused for want of capital.
- **Most approval the traffic can cost in any one year** (`APPROVAL_CONGESTION_ANNUAL_CAP`): Opinion moves at a bounded speed. Without a cap the year a through lane came out was worth 130 approval points on its own, because the delay curve is hyperbolic near capacity and the model resolved a whole year at the worst point of it.
- **Approval points per million dollars of surplus swing** (`PC_SURPLUS_SENSITIVITY`): Voters notice the budget eventually, and blame whoever is in the chair.
- **Approval lost per 10% rise in peak travel time** (`APPROVAL_CONGESTION_SENSITIVITY`): Congestion is the most legible thing a resident experiences, so it moves approval hardest and soonest. Tuned high on purpose: this is why the widening is so tempting, and if it were not tempting the game would be a lecture.
- **Political capital from opening a completed capital project** (`PC_RIBBON_CUTTING`): Awarded when a capital project opens, not when it is committed to.
- **Approval from opening a completed capital project** (`APPROVAL_RIBBON_CUTTING`): Finishing something visible is worth more politically than the thing itself usually deserves. Mayors know this; the model does too.
- **Approval lost per additional death on the corridor** (`APPROVAL_FATALITY_SENSITIVITY`): Deliberately small. Residents do not attribute traffic deaths to the Public Works Director, which is most of why nothing changes.
- **State DOT widening grant match** (`STATE_GRANT_MATCH_RATIO`): The state funds ninety per cent of construction. On completion the roadway transfers to the city, which then carries all maintenance and reconstruction.
- **Length of a run** (`RUN_LENGTH_YEARS`): Long enough for one pavement cycle and one generation of children.

## Land use profiles

These are the physical and fiscal characteristics of each land use class. They are
design parameters calibrated so that the resulting revenue and sales tax per acre
reproduce the published figures cited above — a test asserts that they do.

`Local street ft/acre` is where the sprawl arithmetic lives: four houses to the acre
need roughly 190 feet of public street to reach them, sixty flats to the acre need
about 25, and the city maintains every foot of it either way.

`Entrance setback` is the walk from the pavement to the front door. A shopfront at
the back of the footway is 5 feet; a supermarket behind its car park is 280. Two
groceries the same distance apart on a map are not the same distance apart on foot.

| Land use | $/acre | FAR | Storeys | Impervious | Surface parking | Dwellings/acre | Jobs/1000sqft | Retail share | Frontage quality | Entrance setback ft | Local street ft/acre |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| vacant | 120,000 | 0 | 0 | 0.1 | 0 | 0 | 0 | 0 | 0.1 | 0 | 40 |
| surface_parking | 200,000 | 0 | 0 | 0.95 | 1 | 0 | 0 | 0 | 0 | 0 | 55 |
| auto_service | 900,000 | 0.12 | 1 | 0.93 | 0.55 | 0 | 2.2 | 0.7 | 0.05 | 90 | 60 |
| big_box | 600,000 | 0.18 | 1 | 0.94 | 0.62 | 0 | 1.1 | 1 | 0.02 | 280 | 55 |
| strip_mall | 600,000 | 0.25 | 1 | 0.92 | 0.58 | 0 | 1.8 | 0.95 | 0.08 | 190 | 60 |
| single_family | 740,000 | 0.28 | 1.5 | 0.45 | 0.1 | 4.2 | 0 | 0 | 0.35 | 35 | 190 |
| garden_apartment | 2,000,000 | 0.7 | 2.5 | 0.65 | 0.32 | 20 | 0 | 0 | 0.3 | 65 | 90 |
| office_park | 1,500,000 | 0.45 | 2 | 0.85 | 0.5 | 0 | 3.6 | 0.03 | 0.12 | 160 | 70 |
| mainstreet_mixed | 5,000,000 | 1.6 | 2.5 | 0.8 | 0.12 | 26 | 2.4 | 0.36 | 0.86 | 5 | 45 |
| midrise_mixed | 20,000,000 | 3.4 | 5 | 0.82 | 0.04 | 62 | 2.6 | 0.2 | 0.9 | 5 | 25 |
| civic | 0 | 0.5 | 2 | 0.6 | 0.28 | 0 | 2 | 0 | 0.55 | 85 | 50 |
| park | 0 | 0 | 0 | 0.12 | 0.05 | 0 | 0 | 0 | 0.7 | 25 | 30 |
| plaza | 0 | 0 | 0 | 0.55 | 0 | 0 | 0 | 0 | 0.8 | 0 | 20 |

## Functional forms

The equations these constants combine into. Each lives in the module named.

### Induced demand — `traffic.ts`

Corridor traffic splits into LOCAL trips, generated by the land use and filtered
through mode share, and THROUGH trips, attracted by capacity:

```
latentThrough = baseThrough
              × regionalIndex
              × (laneMiles / laneMiles₀) ^ VMT_LANE_MILE_ELASTICITY
              × (speed₀ / speed_{t-1}) ^ VMT_TRAVEL_TIME_ELASTICITY

through_t = through_{t-1} + (latentThrough − through_{t-1}) × INDUCED_DEMAND_ADJUSTMENT_RATE
```

The second term runs in both directions. Adding capacity pulls traffic in over five
to ten years; taking capacity away lets it evaporate over the same period. The lag is
the whole point: new capacity genuinely works before it refills.

### Capacity and speed — `traffic.ts`

```
greenRatio     = (cycle − 4 × phases) / cycle × arterialGreenShare
capacity       = SATURATION_FLOW_RATE × greenRatio × widthFactor × lanes
peakVolume     = AADT × PEAK_HOUR_FACTOR_K × DIRECTIONAL_SPLIT_D
signalDelay    = 0.5 × cycle × (1 − g)² / (1 − min(1,x)·g)  +  700 × max(0, x − 0.85)²
speed          = length / (length/freeFlow + signals × signalDelay)
```

`freeFlow` is the speed drivers actually choose, not the posted speed: wide lanes and
many of them read as permission, and kerbside friction reads as a reason to slow down.
A city can post 25 on a road built for 50 and get 45.

### Traffic noise — `environment.ts`

```
Leq = NOISE_REFERENCE_DBA
    + NOISE_DB_PER_VOLUME_DOUBLING   × log₂(volume / 1000)
    + NOISE_DB_PER_SPEED_DOUBLING    × log₂(speed / 30)
    − NOISE_DB_PER_DISTANCE_DOUBLING × log₂(distance / 50)
```

Halving traffic volume saves 3 dB. Halving speed saves 9 dB. That asymmetry is the
single most useful fact in this document and almost nobody knows it.

### Pedestrian fatality risk — `safety.ts`

```
P(death | struck at v) = 1 / (1 + exp(−(PED_FATALITY_LOGIT_INTERCEPT + PED_FATALITY_LOGIT_SLOPE × v)))
```

Fitted to the published curve: 10% at 23 mph, 25% at 32, 50% at 42, 75% at 50, 90% at 58.

### Revenue and liability per acre — `fiscal.ts`

```
revenue_parcel   = rate(class) × cityShare × multiplier
                 × (landValue × landWeight + improvementValue × improvementWeight)
                 + sales × LOCAL_SALES_TAX_SHARE

liability_parcel = arterialLiability × (frontageFeet / totalFrontageFeet)
                 + acres × localStreetFeetPerAcre × costPerFootYear
```

Revenue follows the value created on a parcel. Liability follows the frontage and area
that has to be served. Those two quantities are unrelated, and the gap between them is
the game.

### Reachability — `travel.ts`

For each representative household, the model records which modes reach each kind of
destination within fifteen minutes of CLOCK time - the literal, defensible definition
used in the accessibility literature, unweighted by how unpleasant the trip is.

This produces an uncomfortable year-zero reading, and it is left uncomfortable on
purpose. Commerce Blvd is 1.2 miles long, so a supermarket on it is physically within
a fifteen-minute walk of a good share of nearby households from day one. Almost none
of them walk. The reckoning reports both numbers next to each other and says nothing
further: the gap between what is reachable and what is done is the argument, and it
is stronger than a claim that nothing was reachable would have been.

### Mode choice — `travel.ts`

```
U_m       = ASC_m + β_time × perceivedMinutes_m + β_cost × cost_m
P(m)      = exp(U_m) / Σ exp(U_k)          (over available modes only)

perceivedWalk = clockWalk × (1 + (WALK_COMFORT_PENALTY_MAX − 1) × hostility)
perceivedBike = clockBike × (1 + (BIKE_STRESS_PENALTY_MAX − 1) × (LTS − 1)/3)
P(bike)      ×= bikeWillingShare(LTS)      (renormalised across the other modes)
```

Driving is unavailable to a household with no car; transit is unavailable where no bus
runs. Mode share is never set by the player and never set directly at all — it falls out
of distances, comfort, parking price and car ownership.

### Urban heat — `environment.ts`

```
airTempExcess     = AIR_TEMP_UHI_MAX_F × impervious^1.3
                  − canopy × 100 × AIR_TEMP_COOLING_PER_CANOPY_POINT_F
surfaceTempExcess = SURFACE_TEMP_EXCESS_ASPHALT_F × (1 − shaded)
                  + (SURFACE_TEMP_EXCESS_ASPHALT_F − SHADE_SURFACE_TEMP_REDUCTION_F) × shaded
```

**Air temperature and surface temperature are different quantities and the model keeps
them apart.** Surface differences of 40°F between a car park and a shaded pavement are
routine and well measured. Air temperature differences within a city are far smaller —
a few degrees — and the two are constantly conflated in popular writing about heat.

