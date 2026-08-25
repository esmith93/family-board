/**
 * Every constant the model uses, with its source and an honest range.
 *
 * This file is the machine-readable half of MODEL.md - in fact MODEL.md is
 * generated from it, so the two cannot drift apart. The in-game "Why this
 * number?" panel reads the same registry, which means a constant physically
 * cannot enter the model without declaring where it came from.
 *
 * Three confidence levels are used, and they mean different things:
 *   settled     - independent sources converge, or the figure is arithmetic
 *   contextual  - broadly accepted, but the figure varies by market or method
 *   contested   - researchers actively disagree about sign, size, or method
 *
 * A source of `url: 'internal'` is a GAME DESIGN PARAMETER, not a measured
 * quantity. Those are labelled as such rather than dressed up with a citation
 * they do not have.
 */

import { defineConstants, mergeRegistries } from './sourced'
import type { Source } from './sourced'

// --- Sources, declared once so citations cannot drift between constants -----

const S = {
  durantonTurner: {
    title: 'Duranton & Turner, "The Fundamental Law of Road Congestion: Evidence from US Cities", American Economic Review 101(6):2616-52',
    url: 'https://www.aeaweb.org/articles?id=10.1257%2Faer.101.6.2616',
    year: '2011',
  },
  milam2017: {
    title: 'Milam, Birnbaum, Ganson, Handy & Walters, "Closing the Induced Vehicle Travel Gap Between Research and Practice", Transportation Research Record 2653',
    url: 'https://journals.sagepub.com/doi/10.3141/2653-02',
    year: '2017',
  },
  goodwin1996: {
    title: 'Goodwin, "Empirical evidence on induced traffic", Transportation 23(1):35-54 - the synthesis underpinning the UK SACTRA report',
    url: 'https://link.springer.com/article/10.1007/BF00166218',
    year: '1996',
  },
  hpmsCapacity: {
    title: 'FHWA, "Simplified Highway Capacity Calculation Method for the Highway Performance Monitoring System" (FHWA-PL-18-003)',
    url: 'https://www.fhwa.dot.gov/policyinformation/pubs/pl18003/hpms_cap.pdf',
    year: '2018',
  },
  ccagLos: {
    title: 'City/County Association of Governments of San Mateo County, Congestion Management Program Appendix B: Traffic Level of Service Calculation Methods',
    url: 'https://ccag.ca.gov/wp-content/uploads/2014/07/cmp_2005_Appendix_B.pdf',
    year: '2005',
  },
  bpr1964: {
    title: 'Bureau of Public Roads, Traffic Assignment Manual (1964), as documented in the AequilibraE volume-delay function reference',
    url: 'https://www.aequilibrae.com/latest/python/traffic_assignment/volume_delay_functions.html',
    year: '1964',
  },
  urban3Wnc: {
    title: 'Strong Towns / Urban3, "Main Street vs. Big Box Stores: A Western North Carolina Analysis"',
    url: 'https://www.strongtowns.org/journal/main-street-vs-big-box-stores-a-western-north-carolina-analysis',
    year: '2022',
  },
  urban3Traverse: {
    title: 'The Ticker (Traverse City), "Whos Footing The Tax Bill?" - Urban3 analysis',
    url: 'https://www.traverseticker.com/news/who-s-footing-the-tax-bill/',
    year: '2019',
  },
  cnuSarasota: {
    title: 'CNU Public Square, "Best bet for tax revenue: mixed-use downtown development" - Katz / Whalen / Minicozzi Sarasota County study',
    url: 'https://www.cnu.org/publicsquare/2010/09/13/best-bet-tax-revenue-mixed-use-downtown-development',
    year: '2010',
  },
  civicwell: {
    title: 'CivicWell / Local Government Commission with Urban3, "Valuing Downtowns: San Joaquin Valley property tax revenue per acre"',
    url: 'https://civicwell.org/civic-resources/valuing-downtowns/',
    year: '2015',
  },
  strongTownsBlono: {
    title: 'Strong Towns BloNo, "Downtown Tax Analysis: Its All About Value Per Acre"',
    url: 'https://strongtownsblono.com/2024/11/10/downtown-tax-analysis-its-all-about-value-per-acre/',
    year: '2024',
  },
  cityObservatoryParking: {
    title: 'City Observatory, "Why parking should pay its way instead of getting a free ride"',
    url: 'https://cityobservatory.org/parking_pay_way/',
    year: '2019',
  },
  strongTownsRetailTax: {
    title: 'Strong Towns, "The Surprising Relationship Between Retail Tax and Property Tax"',
    url: 'https://archive.strongtowns.org/journal/2018/2/1/the-surprising-relationship-between-retail-taxand-property-tax',
    year: '2018',
  },
  urban3Florida: {
    title: 'Urban3 for 1000 Friends of Florida, "Economics of Development in Florida"',
    url: 'https://1000fof.org/wp-content/uploads/2024/11/EconomicDevelopmentFlorida_Report_v2_compressed.pdf',
    year: '2024',
  },
  lincoln50State: {
    title: 'Lincoln Institute of Land Policy & Minnesota Center for Fiscal Excellence, "50-State Property Tax Comparison Study"',
    url: 'https://www.lincolninst.edu/publications/other/50-state-property-tax-comparison-study-2024/',
    year: '2024',
  },
  ponziScheme: {
    title: 'Strong Towns, "The Growth Ponzi Scheme"',
    url: 'https://www.strongtowns.org/journal/2016/6/14/greatest-hits-the-growth-ponzi-scheme',
    year: '2011, republished 2016',
  },
  reasonHighway: {
    title: 'Reason Foundation, 27th Annual Highway Report - maintenance disbursements per mile',
    url: 'https://reason.org/highway-report/27th-annual-highway-report/maintenance-disbursements-ratio/',
    year: '2022 (FY2020 data)',
  },
  fdotCostModel: {
    title: 'Florida DOT, Generic Cost Per Mile Models (Long Range Estimating summary)',
    url: 'https://ftp.fdot.gov/public/file/ze-JhsHT0ku2YmntigTtIQ/Summary.pdf',
    year: 'c. 2016-2024',
  },
  arvadaPavement: {
    title: 'City of Arvada, Colorado, "Understanding the Pavement Program"',
    url: 'https://www.arvadaco.gov/1299/Understanding-the-Pavement-Program',
    year: '2024',
  },
  fhwaThinOverlay: {
    title: 'FHWA, "The Use of Thin Asphalt Overlays for Pavement Preservation" (Tech Brief HIF-19-053)',
    url: 'https://www.fhwa.dot.gov/pavement/asphalt/pubs/hif19053.pdf',
    year: '2019',
  },
  phoenixUnitCost: {
    title: 'City of Phoenix, Water and Wastewater Unit Cost Study (Carollo Engineers)',
    url: 'https://www.phoenix.gov/content/dam/phoenix/pddsite/documents/impact-fees/2025-if-update/Water%20and%20Wastewater%20Unit%20Cost%20Study_08142024_v2.pdf',
    year: '2024',
  },
  awwaBuriedNoLonger: {
    title: 'AWWA "Buried No Longer" service-life tables, via DIPRA facts and figures',
    url: 'https://dipra.org/wp-content/uploads/2025/02/Facts-and-Figures-Buried-No-Longer.pdf',
    year: '2012',
  },
  doeStreetLighting: {
    title: 'US DOE Better Buildings Solution Center, "Cost Savings Analysis of LED Street Lighting Ownership"',
    url: 'https://betterbuildingssolutioncenter.energy.gov/solutions-at-a-glance/cost-savings-analysis-led-street-lighting-ownership',
    year: 'c. 2020-2024',
  },
  laStreetLighting: {
    title: 'City of Los Angeles Bureau of Street Lighting, "Cost of Service and Street Lighting Assessments"',
    url: 'https://lalights.lacity.org/residents/cost_of_svc_and_stlighting_assessments.html',
    year: 'c. 2023',
  },
  wheelingLighting: {
    title: 'Village of Wheeling, Illinois, Municipal Design Manual, Chapter 8 - Street Lighting',
    url: 'https://www.wheelingil.gov/DocumentCenter/View/552/Chapter-8-Street-Lighting-PDF',
    year: 'current municipal standard',
  },
  fhwaSignalHandbook: {
    title: 'FHWA, Traffic Signal Program Handbook (FHWA-HOP-23-041)',
    url: 'https://ops.fhwa.dot.gov/publications/fhwahop23041/fhwahop23041.pdf',
    year: '2023',
  },
  itsDeployment: {
    title: 'USDOT ITS Deployment Evaluation, signal maintenance cost entries',
    url: 'http://www.itskrs.its.dot.gov/its/benecost.nsf/ID/215f723db93d293c8525725f00786fd8',
    year: '2005-2024 entries',
  },
  pbicCosts: {
    title: 'UNC Highway Safety Research Center / PBIC, "Costs for Pedestrian and Bicyclist Infrastructure Improvements"',
    url: 'https://www.pedbikeinfo.org/downloads/Countermeasure%20Costs_Report_Nov2013.pdf',
    year: '2013 dollars, escalated',
  },
  asceReportCard: {
    title: 'ASCE, Report Card for Americas Infrastructure',
    url: 'https://infrastructurereportcard.org/',
    year: '2025',
  },
  nhcci: {
    title: 'FHWA, National Highway Construction Cost Index (NHCCI), 2024 Q3 narrative',
    url: 'https://www.fhwa.dot.gov/policy/otps/nhcci/NHCCI_Narrative_Article_2024_Q3.pdf',
    year: '2025',
  },
  tefft2011: {
    title: 'Tefft, "Impact Speed and a Pedestrians Risk of Severe Injury or Death", AAA Foundation for Traffic Safety',
    url: 'https://aaafoundation.org/impact-speed-pedestrians-risk-severe-injury-death/',
    year: '2011',
  },
  fhwaRoadDiet: {
    title: 'FHWA, "Evaluation of Lane Reduction Road Diet Measures on Crashes" (FHWA-HRT-10-053)',
    url: 'https://www.fhwa.dot.gov/publications/research/safety/10053/',
    year: '2010',
  },
  cmfRoundabout: {
    title: 'FHWA CMF Clearinghouse, "Evaluation of Roundabout Safety" (study 317)',
    url: 'https://cmfclearinghouse.fhwa.dot.gov/study_detail.php?stid=317',
    year: 'clearinghouse entry',
  },
  iihsRoundabout: {
    title: 'Insurance Institute for Highway Safety, "Crash Reductions Following Installation of Roundabouts in the United States", via NYSDOT',
    url: 'https://www.dot.ny.gov/main/roundabouts/files/insurance_report.pdf',
    year: '2000',
  },
  cmfClearinghouse: {
    title: 'FHWA Crash Modification Factor Clearinghouse',
    url: 'https://cmfclearinghouse.fhwa.dot.gov/',
    year: 'ongoing',
  },
  jhuLaneWidth: {
    title: 'Hamidi et al., Johns Hopkins Bloomberg School of Public Health, "A National Investigation on the Impacts of Lane Width on Traffic Safety"',
    url: 'https://narrowlanes.americanhealth.jhu.edu/report/JHU-2023-Narrowing-Travel-Lanes-Report.pdf',
    year: '2023',
  },
  usdotBca: {
    title: 'USDOT, Benefit-Cost Analysis Guidance for Discretionary Grant Programs',
    url: 'https://www.transportation.gov/sites/dot.gov/files/2022-03/Benefit%20Cost%20Analysis%20Guidance%202022%20Update.pdf',
    year: '2022 update',
  },
  fhwaCrashCosts: {
    title: 'FHWA, "Updated Crash Costs for Highway Safety Analysis" (FHWA-SA-25-021)',
    url: 'https://highways.dot.gov/sites/fhwa.dot.gov/files/2025-10/CrashCostFactSheet_508_OCT2025.pdf',
    year: '2025 (2024 dollars)',
  },
  fhwaTnm: {
    title: 'FHWA, Traffic Noise Model Technical Manual - reference energy mean emission levels',
    url: 'https://www.fhwa.dot.gov/environment/noise/traffic_noise_model/old_versions/tnm_version_10/tech_manual/tnm00.cfm',
    year: '1998',
  },
  whoNoise: {
    title: 'WHO Regional Office for Europe, Environmental Noise Guidelines for the European Region',
    url: 'https://iris.who.int/bitstream/handle/10665/279952/9789289053563-eng.pdf',
    year: '2018',
  },
  heiSr17: {
    title: 'Health Effects Institute, Special Report 17: Traffic-Related Air Pollution - A Critical Review',
    url: 'https://www.healtheffects.org/system/files/SR17TrafficReview.pdf',
    year: '2010',
  },
  nearRoadMeta: {
    title: 'Zhou et al., "A meta-analysis of selected near-road air pollutants based on concentration decay rates", Heliyon',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6716115/',
    year: '2019',
  },
  epaNaaqsPm: {
    title: 'US EPA, National Ambient Air Quality Standards for Particulate Matter',
    url: 'https://www.epa.gov/pm-pollution/national-ambient-air-quality-standards-naaqs-pm',
    year: '2024',
  },
  epaHeatIslands: {
    title: 'US EPA, Heat Island Effect',
    url: 'https://www.epa.gov/heatislands',
    year: 'ongoing',
  },
  npjCanopy: {
    title: 'npj Urban Sustainability, "Increasing tree canopy lowers urban air temperature by up to 1.5 C in heat-prone areas"',
    url: 'https://www.nature.com/articles/s42949-025-00277-x',
    year: '2025',
  },
  natureTreesLst: {
    title: 'Schwaab et al., "The role of urban trees in reducing land surface temperatures in European cities", Nature Communications',
    url: 'https://www.nature.com/articles/s41467-021-26768-w',
    year: '2021',
  },
  vtpiTransitElasticities: {
    title: 'Litman, "Transit Price Elasticities and Cross-Elasticities", Victoria Transport Policy Institute',
    url: 'https://www.vtpi.org/tranelas.pdf',
    year: 'ongoing',
  },
  vtpiElasticities: {
    title: 'Litman, "Transportation Elasticities", VTPI Online TDM Encyclopedia',
    url: 'https://www.vtpi.org/tdm/tdm11.htm',
    year: 'ongoing',
  },
  ewingCervero: {
    title: 'Ewing & Cervero, "Travel and the Built Environment: A Meta-Analysis", Journal of the American Planning Association 76(3):265-294',
    url: 'https://www.tandfonline.com/doi/abs/10.1080/01944361003766766',
    year: '2010',
  },
  psrcDensity: {
    title: 'Puget Sound Regional Council, "Transit-Supportive Densities and Land Uses", summarising Pushkarev & Zupan',
    url: 'https://www.psrc.org/sites/default/files/2022-03/tsdluguidancepaper.pdf',
    year: '2022',
  },
  itdpBikelanes: {
    title: 'ITDP, "Atlas: The Power of People Near Protected Bikelanes"',
    url: 'https://itdp.org/2024/06/03/atlas-the-power-of-people-near-protected-bikelanes/',
    year: '2024',
  },
  wgiParking: {
    title: 'WGI, "Parking Structure Cost Outlook for 2024"',
    url: 'https://publications.wginc.com/parking-structure-cost-outlook-for-2024',
    year: '2024',
  },
  vtpiParkingHousing: {
    title: 'Litman, "Parking Requirement Impacts on Housing Affordability", Victoria Transport Policy Institute',
    url: 'https://www.vtpi.org/park-hou.pdf',
    year: 'ongoing',
  },
  cntHT: {
    title: 'Center for Neighborhood Technology, Housing + Transportation Affordability Index',
    url: 'https://htaindex.cnt.org/about/',
    year: 'ongoing',
  },
  design: {
    title: 'Game design parameter - chosen for play, not measured in the field',
    url: 'internal',
    year: '2025',
  },
} satisfies Record<string, Source>

// ---------------------------------------------------------------------------
// Corridor geometry. Level design, not research.
// ---------------------------------------------------------------------------

const geometry = defineConstants({
  CORRIDOR_LENGTH_FT: {
    label: 'Corridor length',
    value: 6336, unit: 'feet', low: 6336, high: 6336,
    source: S.design, confidence: 'settled',
    note: 'The whole game is 1.2 miles of one street: 1.2 x 5,280 = 6,336 ft.',
  },
  CORRIDOR_SEGMENTS: {
    label: 'Corridor segments',
    value: 12, unit: 'count', low: 12, high: 12,
    source: S.design, confidence: 'settled',
    note: 'Twelve blocks of 528 ft, each with parcels on both sides.',
  },
  INITIAL_SURFACE_PARKING_SHARE: {
    label: 'Share of corridor land in surface parking at year 0',
    value: 0.55, unit: 'fraction', low: 0.55, high: 0.55,
    source: S.design, confidence: 'settled',
    note: 'High, but not unusual for a US commercial strip. The corridor generator fits the mix to hit exactly this.',
  },
  CITY_POPULATION: {
    label: 'Fairview population',
    value: 120000, unit: 'people', low: 120000, high: 120000,
    source: S.design, confidence: 'settled',
    note: 'The city is the tax base that has to pay for the corridor.',
  },
  OPENING_DEFICIT: {
    label: 'Opening general fund shortfall',
    value: 4100000, unit: 'dollars per year', low: 4100000, high: 4100000,
    source: S.design, confidence: 'settled',
    note: 'The number on screen in the first ten seconds. Everything else follows from it.',
  },
  SERVICE_AREA_HOUSEHOLDS: {
    label: 'Households the corridor serves',
    value: 7200, unit: 'households', low: 7200, high: 7200,
    source: S.design, confidence: 'settled',
    note: 'About 18,000 people, or 15% of Fairview, live close enough for the corridor to be their high street.',
  },
})

// ---------------------------------------------------------------------------
// Traffic, capacity and induced demand
// ---------------------------------------------------------------------------

const traffic = defineConstants({
  SATURATION_FLOW_RATE: {
    label: 'Base saturation flow rate',
    value: 1900, unit: 'passenger cars per hour of green per lane', low: 1750, high: 2000,
    source: S.hpmsCapacity, confidence: 'settled',
    note: 'The Highway Capacity Manual base value, before adjustment for lane width, grade and turning movements.',
  },
  LANE_CAPACITY_VPHPL_ANCHOR: {
    label: 'Signalised arterial lane capacity (validation anchor)',
    value: 900, unit: 'vehicles per hour per lane', low: 600, high: 1100,
    source: S.hpmsCapacity, confidence: 'settled',
    note: 'Not used directly: the model derives capacity from saturation flow times green ratio, and a test asserts the result lands on this figure.',
  },
  ARTERIAL_GREEN_RATIO_ANCHOR: {
    label: 'Effective green ratio for the arterial through movement',
    value: 0.47, unit: 'fraction of cycle', low: 0.35, high: 0.6,
    source: S.ccagLos, confidence: 'contextual',
    note: 'Typical g/C for the major street at a coordinated arterial signal. The model computes this from cycle length and phasing and is tested against it.',
  },
  PEAK_HOUR_FACTOR_K: {
    label: 'Peak hour share of daily traffic',
    value: 0.092, unit: 'fraction of AADT', low: 0.08, high: 0.11,
    source: S.hpmsCapacity, confidence: 'contextual',
    note: 'The K-factor used to convert AADT to a design-hour volume. Urban arterials run flatter peaks than freeways.',
  },
  DIRECTIONAL_SPLIT_D: {
    label: 'Peak direction share',
    value: 0.55, unit: 'fraction', low: 0.5, high: 0.65,
    source: S.hpmsCapacity, confidence: 'contextual',
    note: 'The D-factor. A commercial strip is less directional than a commuter radial.',
  },
  BPR_ALPHA: {
    label: 'BPR congestion coefficient',
    value: 0.15, unit: 'dimensionless', low: 0.1, high: 0.84,
    source: S.bpr1964, confidence: 'contextual',
    note: 'The classic 0.15/4 pair is ubiquitous and widely criticised as too flat near capacity. Used here only for off-peak smoothing; delay comes mainly from the signal model.',
  },
  BPR_BETA: {
    label: 'BPR congestion exponent',
    value: 4, unit: 'dimensionless', low: 2, high: 8,
    source: S.bpr1964, confidence: 'contextual',
    note: 'Higher beta makes delay explode more sharply as volume approaches capacity.',
  },
  VMT_LANE_MILE_ELASTICITY: {
    label: 'Elasticity of VMT with respect to lane-miles',
    value: 0.75, unit: 'dimensionless', low: 0.5, high: 1.0,
    source: S.durantonTurner, confidence: 'contested',
    note: 'The fundamental law of road congestion. Duranton & Turner find ~1.0 for interstates and 0.66-0.90 for other major roads; 0.75 is the practitioner value for arterials. Contested on identification strategy, and Anas (2024) disputes the theoretical reading.',
  },
  INDUCED_DEMAND_ADJUSTMENT_RATE: {
    label: 'Annual rate at which traffic closes the gap to its new equilibrium',
    value: 0.28, unit: 'fraction of remaining gap per year', low: 0.12, high: 0.45,
    source: S.milam2017, confidence: 'contextual',
    note: 'Derived, not measured: chosen so the corridor refills about 80% of the way in five years and 95% in ten, matching the observed time course.',
  },
  YEARS_TO_REFILL_ANCHOR: {
    label: 'Years for new capacity to refill',
    value: 5, unit: 'years', low: 3, high: 10,
    source: S.milam2017, confidence: 'contested',
    note: 'The anchor the adjustment rate is fitted to. This lag is what makes the widening genuinely work first, which is the whole trap.',
  },
  VMT_TRAVEL_TIME_ELASTICITY: {
    label: 'Short-run elasticity of VMT with respect to travel time',
    value: -0.5, unit: 'dimensionless', low: -0.7, high: -0.27,
    source: S.goodwin1996, confidence: 'contextual',
    note: 'How much driving grows when driving gets quicker, holding lane-miles fixed. The long-run figure is roughly double.',
  },
  REGIONAL_GROWTH_RATE: {
    label: 'Background regional traffic growth',
    value: 0.007, unit: 'fraction per year', low: 0.0, high: 0.02,
    source: S.design, confidence: 'contextual',
    note: 'Growth the Public Works Director does not control, so the corridor is never quite in steady state.',
  },
  INITIAL_AADT: {
    label: 'Commerce Blvd traffic at year 0',
    value: 38000, unit: 'vehicles per day', low: 25000, high: 44000,
    source: S.design, confidence: 'contextual',
    note: 'A six-lane commercial arterial in a city of 120,000 typically carries 25,000-40,000 vehicles a day. Fairview sits at the congested end, because a corridor nobody complains about is not a game.',
  },
  INITIAL_THROUGH_SHARE: {
    label: 'Through trips as a share of corridor traffic at year 0',
    value: 0.55, unit: 'fraction', low: 0.35, high: 0.7,
    source: S.design, confidence: 'contextual',
    note: 'The split that makes the model work: widening pulls through traffic from elsewhere, it does not create local trips.',
  },
  AVERAGE_TRIP_LENGTH_ON_CORRIDOR_MI: {
    label: 'Average distance a vehicle travels on the corridor',
    value: 0.7, unit: 'miles', low: 0.4, high: 1.2,
    source: S.design, confidence: 'contextual',
    note: 'Used to turn AADT into corridor VMT. Most vehicles use part of the corridor, not all of it.',
  },
  VEHICLE_OCCUPANCY: {
    label: 'People per vehicle',
    value: 1.35, unit: 'persons per vehicle', low: 1.1, high: 1.7,
    source: S.design, confidence: 'contextual',
    note: 'Averaged across trip purposes. Commute trips run lower, shopping and social trips higher.',
  },
  VEHICLE_OPERATING_COST_PER_MILE: {
    label: 'Marginal cost of driving a mile, as perceived',
    value: 0.24, unit: 'dollars per mile', low: 0.15, high: 0.35,
    source: S.design, confidence: 'contextual',
    note: 'Fuel, tyres and wear as the driver perceives them at the moment of choosing a mode - not the full ownership cost, which the household pays whether it drives or not.',
  },
})

// ---------------------------------------------------------------------------
// Land value and revenue per acre. The central fiscal fact of the game.
//
// Where a source reports tax per acre rather than value per acre, the value is
// backed out at the commercial effective rate below. The two published value
// figures (big box, main street, midrise) come straight from Urban3 analyses
// and the derived ones land consistently between them.
// ---------------------------------------------------------------------------

const landValue = defineConstants({
  EFFECTIVE_PROPERTY_TAX_RATE_COMMERCIAL: {
    label: 'Effective property tax rate, commercial, all jurisdictions',
    value: 0.020, unit: 'fraction of market value per year', low: 0.008, high: 0.04,
    source: S.lincoln50State, confidence: 'contextual',
    note: 'Median effective commercial rate across large US cities. Varies more than threefold between states.',
  },
  EFFECTIVE_PROPERTY_TAX_RATE_RESIDENTIAL: {
    label: 'Effective property tax rate, residential, all jurisdictions',
    value: 0.0122, unit: 'fraction of market value per year', low: 0.003, high: 0.032,
    source: S.lincoln50State, confidence: 'contextual',
    note: 'Lower than commercial in most states - a classification difference that quietly subsidises detached housing.',
  },
  CITY_SHARE_OF_PROPERTY_LEVY: {
    label: 'City share of the total property tax levy',
    value: 0.32, unit: 'fraction', low: 0.15, high: 0.6,
    source: S.design, confidence: 'contextual',
    note: 'Schools and the county take most of it. The city carries the road but collects a third of the tax - which is why the corridor ledger is so unforgiving.',
  },
  LOCAL_SALES_TAX_SHARE: {
    label: 'Local share of sales tax',
    value: 0.0125, unit: 'fraction of taxable sales', low: 0.005, high: 0.025,
    source: S.design, confidence: 'contextual',
    note: 'Set so year-zero big-box sales tax per acre lands inside the published range. A test asserts it does.',
  },
  VALUE_PER_ACRE_VACANT: {
    label: 'Assessed value per acre: vacant lot',
    value: 120000, unit: 'dollars per acre', low: 30000, high: 500000,
    source: S.design, confidence: 'contextual',
    note: 'Land only, discounted for holding cost and uncertainty.',
  },
  VALUE_PER_ACRE_SURFACE_PARKING: {
    label: 'Assessed value per acre: surface parking',
    value: 200000, unit: 'dollars per acre', low: 25000, high: 1500000,
    source: S.strongTownsBlono, confidence: 'contested',
    note: 'Backed out from roughly $4,000 per acre per year in total property tax. Parking lots are assessed almost entirely as land and are frequently under-assessed; the range is enormous.',
  },
  VALUE_PER_ACRE_BIG_BOX: {
    label: 'Assessed value per acre: single-storey big box with parking',
    value: 600000, unit: 'dollars per acre', low: 350000, high: 900000,
    source: S.urban3Wnc, confidence: 'contextual',
    note: 'Counting the parking field, which is most of the site. This is the figure the Strong Towns argument turns on.',
  },
  VALUE_PER_ACRE_STRIP_MALL: {
    label: 'Assessed value per acre: strip mall',
    value: 600000, unit: 'dollars per acre', low: 250000, high: 1250000,
    source: S.civicwell, confidence: 'contextual',
    note: 'Backed out from roughly $12,000 per acre per year in total property tax. Slightly denser than big box, and it fails more gracefully.',
  },
  VALUE_PER_ACRE_AUTO_SERVICE: {
    label: 'Assessed value per acre: auto service and drive-through',
    value: 900000, unit: 'dollars per acre', low: 400000, high: 1750000,
    source: S.cnuSarasota, confidence: 'contextual',
    note: 'Backed out from fast-food block figures. Small buildings on small lots beat big box per acre, and lose to anything with a second storey.',
  },
  VALUE_PER_ACRE_SINGLE_FAMILY: {
    label: 'Assessed value per acre: single-family detached',
    value: 740000, unit: 'dollars per acre', low: 250000, high: 1650000,
    source: S.cnuSarasota, confidence: 'contextual',
    note: 'Backed out at the residential rate, at roughly four units per acre in a mid-size market.',
  },
  VALUE_PER_ACRE_GARDEN_APARTMENT: {
    label: 'Assessed value per acre: garden apartments',
    value: 2000000, unit: 'dollars per acre', low: 800000, high: 5000000,
    source: S.design, confidence: 'contextual',
    note: 'Interpolated between the detached and main-street figures at roughly 20 units per acre. Not separately published.',
  },
  VALUE_PER_ACRE_OFFICE_PARK: {
    label: 'Assessed value per acre: suburban office',
    value: 1500000, unit: 'dollars per acre', low: 600000, high: 4000000,
    source: S.design, confidence: 'contextual',
    note: 'Generates no sales tax and empties at six, which matters a great deal to the retail model.',
  },
  VALUE_PER_ACRE_MAINSTREET_MIXED: {
    label: 'Assessed value per acre: two- to three-storey main street',
    value: 5000000, unit: 'dollars per acre', low: 2000000, high: 12000000,
    source: S.urban3Wnc, confidence: 'contextual',
    note: 'Shopfront at the pavement, flats above. The cheapest form that beats the strip decisively - roughly eight times big box per acre.',
  },
  VALUE_PER_ACRE_MIDRISE_MIXED: {
    label: 'Assessed value per acre: four- to six-storey mixed use',
    value: 20000000, unit: 'dollars per acre', low: 8000000, high: 50000000,
    source: S.urban3Traverse, confidence: 'contested',
    note: 'More than thirty times big box on the same utilities and the same lane-miles. The multiple is real; its size depends heavily on the market.',
  },
  PARKING_TAX_YIELD_RETENTION: {
    label: 'Tax yield of a parking lot relative to the building it replaced',
    value: 0.11, unit: 'ratio', low: 0.05, high: 0.17,
    source: S.cityObservatoryParking, confidence: 'contextual',
    note: 'Demolishing a building for parking keeps about a ninth of the tax yield, and all of the infrastructure obligation.',
  },
  SALES_TAX_PER_ACRE_BIG_BOX_ANCHOR: {
    label: 'Local sales tax per acre: big box (validation anchor)',
    value: 47500, unit: 'dollars per acre per year', low: 20000, high: 80000,
    source: S.strongTownsRetailTax, confidence: 'contextual',
    note: 'A test asserts the model reproduces this from floor area, sales per square foot and the local rate.',
  },
  SALES_TAX_PER_ACRE_MIXED_ANCHOR: {
    label: 'Local sales tax per acre: downtown mixed use (validation anchor)',
    value: 88000, unit: 'dollars per acre per year', low: 40000, high: 150000,
    source: S.urban3Florida, confidence: 'contextual',
    note: 'Mixed use beats big box on sales tax per acre too, by roughly 1.85x - a smaller gap than the property tax gap, and one that surprises people.',
  },
  BIG_BOX_SITE_FAR_ANCHOR: {
    label: 'Floor area ratio of a typical big box site',
    value: 0.15, unit: 'built sqft per sqft of site', low: 0.12, high: 0.25,
    source: S.cnuSarasota, confidence: 'contextual',
    note: 'Eighty-five per cent of the site is not building. That is the whole fiscal problem in one number.',
  },
  INFRASTRUCTURE_PAYBACK_YEARS_SUBURBAN: {
    label: 'Years for suburban development to repay its infrastructure',
    value: 42, unit: 'years', low: 25, high: 80,
    source: S.cnuSarasota, confidence: 'contested',
    note: 'Against a pipe life of about 75 years and a pavement life of 25. Downtown blocks in the same study pay back in about three.',
  },
  STRONGTOWNS_REVENUE_LIABILITY_RATIO: {
    label: 'Revenue as a share of infrastructure liability, auto-oriented development',
    value: 0.15, unit: 'ratio', low: 0.1, high: 0.2,
    source: S.ponziScheme, confidence: 'contested',
    note: 'The claim the Ledger View exists to let the player check for themselves. Disputed in its strong form; the direction is not.',
  },
  ASSESSMENT_LAG_YEARS: {
    label: 'Lag between value change and assessed value',
    value: 2, unit: 'years', low: 1, high: 4,
    source: S.design, confidence: 'contextual',
    note: 'Reassessment cycles mean the fiscal reward for good land use arrives late, which is politically fatal.',
  },
})

// ---------------------------------------------------------------------------
// Infrastructure liability. Scales with area served, not value created.
// ---------------------------------------------------------------------------

const liability = defineConstants({
  ROAD_ROUTINE_MAINTENANCE_PER_LANE_MILE: {
    label: 'Annual routine maintenance per lane-mile',
    value: 15000, unit: 'dollars per lane-mile per year', low: 8000, high: 30000,
    source: S.reasonHighway, confidence: 'contested',
    note: 'Sweeping, patching, striping, snow, signs. Excludes resurfacing and reconstruction. State-reported figures vary by a factor of ten, partly through inconsistent accounting.',
  },
  ROAD_RESURFACE_COST_PER_LANE_MILE: {
    label: 'Mill and overlay cost per lane-mile',
    value: 250000, unit: 'dollars per lane-mile', low: 150000, high: 400000,
    source: S.fdotCostModel, confidence: 'contested',
    note: 'Urban arterial, including traffic control and driveway tie-ins.',
  },
  ROAD_RECONSTRUCT_COST_PER_LANE_MILE: {
    label: 'Full reconstruction cost per lane-mile',
    value: 450000, unit: 'dollars per lane-mile', low: 250000, high: 1200000,
    source: S.arvadaPavement, confidence: 'contested',
    note: 'Full depth, kerb to kerb. The upper end applies where drainage and utilities have to be rebuilt with it, which on an old arterial is usual.',
  },
  PAVEMENT_RESURFACE_CYCLE_YEARS: {
    label: 'Resurfacing cycle',
    value: 12, unit: 'years', low: 8, high: 15,
    source: S.fhwaThinOverlay, confidence: 'contextual',
    note: 'Deferring it is cheap for about five years and then very expensive, because the base starts to fail.',
  },
  PAVEMENT_RECONSTRUCT_CYCLE_YEARS: {
    label: 'Reconstruction cycle',
    value: 25, unit: 'years', low: 20, high: 40,
    source: S.arvadaPavement, confidence: 'contested',
    note: 'Shorter than most cities budget for. The obligation the state DOT grant hands the city, and the one nobody funds.',
  },
  WATER_MAIN_REPLACE_COST_PER_FT: {
    label: 'Water main replacement cost',
    value: 340, unit: 'dollars per linear foot', low: 190, high: 500,
    source: S.phoenixUnitCost, confidence: 'contested',
    note: 'Urban street, open cut, including restoring the pavement above it.',
  },
  SEWER_REPLACE_COST_PER_FT: {
    label: 'Sanitary sewer replacement cost',
    value: 300, unit: 'dollars per linear foot', low: 150, high: 550,
    source: S.phoenixUnitCost, confidence: 'contested',
    note: 'Deeper than water, but usually smaller diameter, so the costs land close together.',
  },
  PIPE_SERVICE_LIFE_YEARS: {
    label: 'Buried pipe service life',
    value: 75, unit: 'years', low: 50, high: 125,
    source: S.awwaBuriedNoLonger, confidence: 'contextual',
    note: 'Long enough that no official who authorised it will be in office when it fails. Depends heavily on pipe material and soil.',
  },
  STREETLIGHT_ANNUAL_COST_PER_POLE: {
    label: 'Annual energy and maintenance per streetlight',
    value: 250, unit: 'dollars per pole per year', low: 150, high: 500,
    source: S.laStreetLighting, confidence: 'contested',
    note: 'LED conversion cuts the energy half but not the maintenance half.',
  },
  STREETLIGHT_CAPITAL_COST_PER_POLE: {
    label: 'Capital cost per streetlight',
    value: 3300, unit: 'dollars per pole', low: 1450, high: 6000,
    source: S.doeStreetLighting, confidence: 'contested',
    note: 'Pole, luminaire, foundation and connection. Pedestrian-scale lighting needs more poles for the same street.',
  },
  STREETLIGHT_SPACING_FT: {
    label: 'Streetlight spacing',
    value: 203, unit: 'feet', low: 100, high: 293,
    source: S.wheelingLighting, confidence: 'contextual',
    note: 'About 26 poles to the mile for arterial cobra heads. Pedestrian-scale lighting runs at half the spacing and twice the count.',
  },
  SIGNAL_CAPITAL_COST: {
    label: 'New signalised intersection',
    value: 275000, unit: 'dollars', low: 150000, high: 600000,
    source: S.fhwaSignalHandbook, confidence: 'contested',
    note: 'Poles, mast arms, controller, detection, and the design that precedes them.',
  },
  SIGNAL_ANNUAL_MAINTENANCE: {
    label: 'Annual signal maintenance',
    value: 4000, unit: 'dollars per intersection per year', low: 800, high: 12000,
    source: S.itsDeployment, confidence: 'contested',
    note: 'Including retiming, which most cities defer for a decade at a time.',
  },
  SIDEWALK_COST_PER_SQFT: {
    label: 'Sidewalk construction cost',
    value: 12, unit: 'dollars per square foot', low: 6, high: 20,
    source: S.pbicCosts, confidence: 'contested',
    note: 'Concrete including base, in an urban section with utility conflicts.',
  },
  SIDEWALK_SERVICE_LIFE_YEARS: {
    label: 'Sidewalk service life',
    value: 40, unit: 'years', low: 25, high: 60,
    source: S.design, confidence: 'contextual',
    note: 'Tree roots and utility cuts shorten it well below the design life of the concrete.',
  },
  STREET_TREE_PLANTING_COST: {
    label: 'Cost to plant one street tree',
    value: 900, unit: 'dollars per tree', low: 400, high: 2500,
    source: S.pbicCosts, confidence: 'contextual',
    note: 'Including the pit, soil volume and three years of establishment watering. Skimping on soil volume is why so many street trees die at fifteen years.',
  },
  STREET_TREE_ANNUAL_COST: {
    label: 'Annual street tree maintenance',
    value: 45, unit: 'dollars per tree per year', low: 20, high: 120,
    source: S.design, confidence: 'contextual',
    note: 'Pruning cycle, removals and replacements averaged over the population.',
  },
  STREET_TREE_MATURITY_YEARS: {
    label: 'Years to useful canopy',
    value: 15, unit: 'years', low: 10, high: 25,
    source: S.design, confidence: 'contextual',
    note: 'The longest lag in the game. A tree planted in year 25 does nothing for the player, and that is the honest answer.',
  },
  UTILITY_UNDERGROUNDING_COST_PER_MILE: {
    label: 'Overhead-to-underground conversion',
    value: 4500000, unit: 'dollars per mile', low: 1500000, high: 12000000,
    source: S.design, confidence: 'contextual',
    note: 'Almost never justified on fiscal grounds alone. Included so the player can discover that by spending the money.',
  },
  EMERGENCY_RESPONSE_COST_PER_CRASH: {
    label: 'Municipal emergency response cost per reported crash',
    value: 1400, unit: 'dollars per crash', low: 600, high: 4000,
    source: S.design, confidence: 'contextual',
    note: 'The city budget share only - police, fire and EMS time. The societal cost is two orders of magnitude larger and falls on somebody else.',
  },
  TRANSIT_OPERATING_COST_PER_REVENUE_HOUR: {
    label: 'Gross operating cost per bus revenue hour',
    value: 105, unit: 'dollars per revenue hour', low: 60, high: 200,
    source: S.design, confidence: 'contextual',
    note: 'Before fare recovery. Fares cover a quarter of this at best on a small-city bus system.',
  },
  TRANSIT_FARE: {
    label: 'Bus fare',
    value: 1.75, unit: 'dollars per boarding', low: 0, high: 3,
    source: S.design, confidence: 'contextual',
    note: 'Free fares are an instrument the player can choose; it costs revenue and buys ridership and political capital.',
  },
  MUNICIPAL_BORROWING_RATE: {
    label: 'General obligation borrowing rate',
    value: 0.042, unit: 'fraction per year', low: 0.02, high: 0.07,
    source: S.design, confidence: 'contextual',
    note: 'Rises as the citys fiscal position deteriorates, which is the debt spiral in one line.',
  },
  INFLATION_RATE: {
    label: 'Construction cost escalation',
    value: 0.045, unit: 'fraction per year', low: 0.03, high: 0.12,
    source: S.nhcci, confidence: 'contextual',
    note: 'The NHCCI ran near 6% a year in the early 2020s. 4.5% is used as a thirty-year average, because sustaining 6% for three decades would make every capital instrument unaffordable by year 20.',
  },
  GENERAL_INFLATION_RATE: {
    label: 'General price inflation',
    value: 0.025, unit: 'fraction per year', low: 0.015, high: 0.045,
    source: S.nhcci, confidence: 'contextual',
    note: 'Applied to property values, retail spending, rents and incomes. The gap between this and construction escalation is the squeeze: costs compound faster than the tax base does, every year, for thirty years.',
  },
  INFRA_GAP_PER_CAPITA_ANNUAL: {
    label: 'National infrastructure funding gap per capita',
    value: 1100, unit: 'dollars per person per year', low: 900, high: 1300,
    source: S.asceReportCard, confidence: 'contextual',
    note: 'Derived from the ASCE ten-year investment gap and US population. Fairview is not unusual; it is average.',
  },
  ROADWAY_IMPERVIOUS_ACRES_PER_LANE_MILE: {
    label: 'Impervious area per lane-mile of roadway',
    value: 1.45, unit: 'acres per lane-mile', low: 1.2, high: 1.8,
    source: S.design, confidence: 'settled',
    note: 'A 12-foot lane one mile long is 63,360 sqft, or 1.45 acres. Arithmetic, before shoulders.',
  },
})

// ---------------------------------------------------------------------------
// Safety
// ---------------------------------------------------------------------------

const safety = defineConstants({
  BASE_CRASH_RATE_PER_MVMT: {
    label: 'Base crash rate, urban arterial',
    value: 5.2, unit: 'crashes per million vehicle-miles', low: 3.0, high: 9.0,
    source: S.design, confidence: 'contextual',
    note: 'Total reported crashes, all severities. A calibration parameter of the right order for a multi-lane urban arterial; not taken from a specific published safety performance function.',
  },
  PED_FATALITY_LOGIT_INTERCEPT: {
    label: 'Pedestrian fatality risk curve: intercept',
    value: -5.08, unit: 'log-odds', low: -6.0, high: -4.2,
    source: S.tefft2011, confidence: 'settled',
    note: 'Logistic curve fitted to Tefft: 10% risk of death at 23 mph, 50% at 42 mph, 90% at 58 mph. The fit reproduces all five published points to within a few percentage points.',
  },
  PED_FATALITY_LOGIT_SLOPE: {
    label: 'Pedestrian fatality risk curve: slope per mph',
    value: 0.1255, unit: 'log-odds per mph', low: 0.09, high: 0.16,
    source: S.tefft2011, confidence: 'settled',
    note: 'The steepness between 30 and 45 mph is the point: that is exactly the range US arterials are designed for.',
  },
  PED_FATALITY_50PCT_SPEED_ANCHOR: {
    label: 'Impact speed at which half of struck pedestrians die',
    value: 42, unit: 'miles per hour', low: 38, high: 46,
    source: S.tefft2011, confidence: 'settled',
    note: 'Widely miscited from the older Ashton & Mackay work as much lower. Tefft standardised to a modern US vehicle fleet; a test asserts the model curve passes through this point.',
  },
  CMF_ROAD_DIET: {
    label: 'Crash modification factor: four-to-three lane conversion, total crashes',
    value: 0.71, unit: 'multiplier', low: 0.53, high: 0.81,
    source: S.fhwaRoadDiet, confidence: 'settled',
    note: 'Below 1 means fewer crashes. One of the best-evidenced treatments in the clearinghouse; Minnesota sites showed reductions up to 54%.',
  },
  CMF_ROAD_DIET_INJURY: {
    label: 'Crash modification factor: road diet, fatal and injury crashes',
    value: 0.63, unit: 'multiplier', low: 0.36, high: 0.8,
    source: S.fhwaRoadDiet, confidence: 'settled',
    note: 'The severity effect is larger than the frequency effect, which is the pattern for every treatment that removes speed.',
  },
  CMF_ROUNDABOUT: {
    label: 'Crash modification factor: signal to roundabout, total crashes',
    value: 0.52, unit: 'multiplier', low: 0.3, high: 0.8,
    source: S.cmfRoundabout, confidence: 'settled',
    note: 'Total crashes fall by about half; the change in what kind of crash happens matters more.',
  },
  CMF_ROUNDABOUT_INJURY: {
    label: 'Crash modification factor: roundabout, injury crashes',
    value: 0.24, unit: 'multiplier', low: 0.1, high: 0.48,
    source: S.iihsRoundabout, confidence: 'settled',
    note: 'A 76% reduction in injury crashes and about 90% in fatal and incapacitating ones: roundabouts delete the high-speed right-angle conflict rather than managing it.',
  },
  CMF_RAISED_MEDIAN: {
    label: 'Crash modification factor: raised median',
    value: 0.75, unit: 'multiplier', low: 0.6, high: 0.9,
    source: S.cmfClearinghouse, confidence: 'contextual',
    note: 'Typical of clearinghouse entries for removing left-turn conflicts across opposing traffic. A representative value rather than one specific study.',
  },
  CMF_BULB_OUTS: {
    label: 'Crash modification factor: kerb extensions, pedestrian crashes',
    value: 0.7, unit: 'multiplier', low: 0.5, high: 0.95,
    source: S.cmfClearinghouse, confidence: 'contextual',
    note: 'Shortens the crossing and puts the waiting pedestrian where drivers can see them. Representative clearinghouse value.',
  },
  CMF_DAYLIGHTING: {
    label: 'Crash modification factor: intersection daylighting, pedestrian crashes',
    value: 0.7, unit: 'multiplier', low: 0.45, high: 0.95,
    source: S.cmfClearinghouse, confidence: 'contextual',
    note: 'Clearing parked cars from the approach so the crossing is visible. Representative clearinghouse value.',
  },
  CMF_PROTECTED_BIKE_LANE: {
    label: 'Crash modification factor: protected bike lane, per cyclist',
    value: 0.47, unit: 'multiplier', low: 0.25, high: 0.8,
    source: S.cmfClearinghouse, confidence: 'contextual',
    note: 'Per cyclist, not in total. A facility that attracts riders can raise total bicycle crashes while cutting each riders risk - a distinction the newspaper in this game never makes.',
  },
  CRASH_RATE_LANE_WIDTH_PER_FOOT: {
    label: 'Crash rate change per extra foot of lane width',
    value: 0.10, unit: 'fractional change per foot', low: -0.02, high: 0.15,
    source: S.jhuLaneWidth, confidence: 'contested',
    note: 'The Johns Hopkins study found roughly 1.5x the crashes at 12 ft versus 9 ft on 30-35 mph urban streets. Genuinely disputed: older rural highway research found wider lanes safer, and some engineers argue narrow lanes increase side friction.',
  },
  LANE_WIDTH_EFFECT_MIN_SPEED_MPH: {
    label: 'Speed below which lane width stops mattering',
    value: 26, unit: 'miles per hour', low: 25, high: 30,
    source: S.jhuLaneWidth, confidence: 'contextual',
    note: 'The same study found no significant crash difference by lane width in 20-25 mph zones. The model honours that: below this speed, narrowing lanes buys nothing on safety. The width effect itself is contested; this threshold is one reading of one study.',
  },
  CRASH_SEVERITY_SPEED_EXPONENT: {
    label: 'Severity sensitivity to speed',
    value: 3.0, unit: 'exponent on the speed ratio', low: 2.0, high: 4.5,
    source: S.design, confidence: 'contextual',
    note: 'Kinetic energy scales with the square of speed; observed fatality rates scale faster still. A modelling choice within that range.',
  },
  CRASH_RATE_PER_CURB_CUT: {
    label: 'Crash rate increase per driveway per mile',
    value: 0.008, unit: 'fractional increase per curb cut per mile', low: 0.003, high: 0.02,
    source: S.design, confidence: 'contextual',
    note: 'Every driveway is a place where one car crosses the path of everyone else. Access management research supports the direction; this magnitude is a modelling choice.',
  },
  PED_CRASH_RISK_PER_CROSSING: {
    label: 'Baseline risk of a reported crash per pedestrian crossing',
    value: 2.4e-7, unit: 'crashes per crossing event', low: 5e-8, high: 1e-6,
    source: S.design, confidence: 'contextual',
    note: 'Calibration parameter, set so a 1.2-mile six-lane arterial with year-zero walking produces a handful of pedestrian crashes a year - which is what such corridors produce.',
  },
  BIKE_CRASH_RISK_PER_MILE: {
    label: 'Baseline risk of a reported crash per bicycle-mile',
    value: 4.5e-6, unit: 'crashes per bicycle-mile', low: 1e-6, high: 2e-5,
    source: S.design, confidence: 'contextual',
    note: 'Calibration parameter. Rises steeply with level of traffic stress, which is why the same lane is safe on a slow street and lethal on a fast one.',
  },
  MIDBLOCK_CROSSING_RISK_MULTIPLIER: {
    label: 'Risk multiplier for crossing away from a marked crossing',
    value: 3.0, unit: 'multiplier', low: 1.8, high: 6.0,
    source: S.design, confidence: 'contextual',
    note: 'People do not walk a quarter of a mile to a signal. When crossings are far apart they cross where they are, and the model charges for it.',
  },
  BASE_SEVERITY_FATAL: {
    label: 'Share of crashes that are fatal at a 35 mph reference',
    value: 0.0015, unit: 'fraction', low: 0.0005, high: 0.005,
    source: S.design, confidence: 'contextual',
    note: 'The reference severity split the speed exponent operates on. Calibrated so a bad 1.2-mile arterial kills roughly one person every two years, which is what bad 1.2-mile arterials do.',
  },
  BASE_SEVERITY_SERIOUS: {
    label: 'Share of crashes causing serious injury at a 35 mph reference',
    value: 0.028, unit: 'fraction', low: 0.01, high: 0.08,
    source: S.design, confidence: 'contextual',
    note: 'KABCO "A". Scales with speed alongside the fatal share.',
  },
  BASE_SEVERITY_MINOR: {
    label: 'Share of crashes causing minor injury at a 35 mph reference',
    value: 0.30, unit: 'fraction', low: 0.2, high: 0.45,
    source: S.design, confidence: 'contextual',
    note: 'KABCO "B" and "C". The remainder are property damage only.',
  },
  SEVERITY_REFERENCE_SPEED_MPH: {
    label: 'Speed at which the base severity split applies',
    value: 35, unit: 'miles per hour', low: 35, high: 35,
    source: S.design, confidence: 'settled',
    note: 'Severity scales from here as (speed / 35) raised to the severity exponent.',
  },
  VALUE_OF_STATISTICAL_LIFE: {
    label: 'Value of a statistical life',
    value: 13200000, unit: 'dollars', low: 11000000, high: 16000000,
    source: S.usdotBca, confidence: 'contextual',
    note: 'USDOT updates this annually. VERIFICATION GAP: the current authority for KABCO-level crash costs is the FHWA fact sheet FHWA-SA-25-021, which the build environment could not reach; this figure should be checked against it before release.',
  },
  COST_SERIOUS_INJURY: {
    label: 'Comprehensive cost of a serious injury crash',
    value: 830000, unit: 'dollars', low: 400000, high: 1600000,
    source: S.fhwaCrashCosts, confidence: 'contextual',
    note: 'KABCO "A" severity, as a fraction of the value of a statistical life. Same verification gap as above.',
  },
  COST_MINOR_INJURY: {
    label: 'Comprehensive cost of a minor injury crash',
    value: 105000, unit: 'dollars', low: 40000, high: 250000,
    source: S.fhwaCrashCosts, confidence: 'contextual',
    note: 'KABCO "B" and "C" severities combined. Same verification gap as above.',
  },
  COST_PDO_CRASH: {
    label: 'Comprehensive cost of a property-damage-only crash',
    value: 12000, unit: 'dollars', low: 5000, high: 25000,
    source: S.fhwaCrashCosts, confidence: 'contextual',
    note: 'The cheapest crashes, and the ones that make up most of the count. Same verification gap as above.',
  },
})

// ---------------------------------------------------------------------------
// Noise and air. Speed matters more than volume, and the model must show it.
// ---------------------------------------------------------------------------

const environment = defineConstants({
  NOISE_REFERENCE_DBA: {
    label: 'Reference sound level',
    value: 57.0, unit: 'dBA at 50 ft', low: 52, high: 62,
    source: S.fhwaTnm, confidence: 'contextual',
    note: 'The level from a stream of 1,000 vehicles an hour at 30 mph, 50 ft from the near lane. The anchor the whole noise model hangs from.',
  },
  NOISE_DB_PER_VOLUME_DOUBLING: {
    label: 'Sound level change per doubling of traffic volume',
    value: 3.0, unit: 'dBA', low: 3.0, high: 3.01,
    source: S.fhwaTnm, confidence: 'settled',
    note: 'Double the sources, double the acoustic energy: 10*log10(2) = 3.01 dB. This is arithmetic, not empirics.',
  },
  NOISE_DB_PER_SPEED_DOUBLING: {
    label: 'Sound level change per doubling of speed',
    value: 9.0, unit: 'dBA', low: 7.5, high: 12.0,
    source: S.fhwaTnm, confidence: 'contextual',
    note: 'Tyre-pavement noise power rises roughly as the cube of speed, so about 30*log10(speed). Three times the effect of doubling volume - which is why slowing a road does more than emptying it, and why most people have never noticed.',
  },
  NOISE_DB_PER_DISTANCE_DOUBLING: {
    label: 'Attenuation per doubling of distance',
    value: 3.0, unit: 'dBA', low: 3.0, high: 4.5,
    source: S.fhwaTnm, confidence: 'settled',
    note: 'A line source falls off at 3 dB per doubling over hard ground, faster over soft ground.',
  },
  NOISE_BARRIER_ATTENUATION: {
    label: 'Attenuation from a solid building wall at the back of the pavement',
    value: 8.0, unit: 'dBA', low: 5, high: 15,
    source: S.fhwaTnm, confidence: 'contextual',
    note: 'Buildings at the pavement edge shield what is behind them. One reason a 40-foot setback is not free.',
  },
  NOISE_VEGETATION_ATTENUATION: {
    label: 'Attenuation from a belt of street trees',
    value: 1.0, unit: 'dBA', low: 0, high: 3,
    source: S.fhwaTnm, confidence: 'settled',
    note: 'Vegetation does almost nothing acoustically. It is in the model precisely so the model does not flatter it.',
  },
  NOISE_ANNOYANCE_THRESHOLD: {
    label: 'Road traffic level above which annoyance rises sharply',
    value: 53, unit: 'dBA Lden', low: 50, high: 55,
    source: S.whoNoise, confidence: 'contextual',
    note: 'The WHO strong recommendation for road traffic noise. Above it, roughly 10% of the population is highly annoyed.',
  },
  NOISE_CARDIOVASCULAR_THRESHOLD: {
    label: 'Level associated with a measurable rise in heart disease risk',
    value: 59.3, unit: 'dBA Lden', low: 53, high: 65,
    source: S.whoNoise, confidence: 'contested',
    note: 'A 5% increase in ischaemic heart disease is reported around this level. The dose-response relationship is real and its exact shape is debated.',
  },
  NOISE_IHD_RISK_PER_10DB: {
    label: 'Relative risk of ischaemic heart disease per 10 dB',
    value: 1.08, unit: 'relative risk', low: 1.01, high: 1.15,
    source: S.whoNoise, confidence: 'contextual',
    note: 'From the meta-analysis underpinning the WHO guidelines. Small per person, large across a corridor of 18,000.',
  },
  PM25_EMISSION_G_PER_VMT: {
    label: 'PM2.5 emission factor',
    value: 0.021, unit: 'grams per vehicle-mile', low: 0.008, high: 0.05,
    source: S.design, confidence: 'contextual',
    note: 'Includes brake and tyre wear, which do not fall as the fleet electrifies. A modelling parameter of the right order.',
  },
  NOX_EMISSION_G_PER_VMT: {
    label: 'NOx emission factor',
    value: 0.28, unit: 'grams per vehicle-mile', low: 0.1, high: 0.8,
    source: S.design, confidence: 'contextual',
    note: 'Falls with fleet turnover, rises sharply in stop-and-go operation.',
  },
  NEAR_ROAD_NO2_DECAY_DISTANCE_FT: {
    label: 'Distance over which NO2 decays to background',
    value: 1640, unit: 'feet', low: 650, high: 1640,
    source: S.heiSr17, confidence: 'contextual',
    note: 'Roughly 200-500 metres. About a fifth of NO2 is removed by 300 m and the gradient extends further downwind at night.',
  },
  PM25_NEAR_ROAD_ELEVATION: {
    label: 'PM2.5 elevation at the kerb relative to background',
    value: 0.20, unit: 'fraction above background', low: 0.05, high: 0.35,
    source: S.nearRoadMeta, confidence: 'contextual',
    note: 'Deliberately modest. PM2.5 is far more spatially uniform than ultrafine particles or NO2, and several reviews find no significant near-road gradient at all. The model does not overstate it.',
  },
  PM25_ANNUAL_THRESHOLD: {
    label: 'Annual PM2.5 standard',
    value: 9.0, unit: 'micrograms per cubic metre', low: 5.0, high: 12.0,
    source: S.epaNaaqsPm, confidence: 'settled',
    note: 'The EPA annual primary standard, tightened from 12 in 2024. The WHO guideline is 5.',
  },
  SURFACE_TEMP_EXCESS_ASPHALT_F: {
    label: 'Peak asphalt SURFACE temperature above air temperature',
    value: 48, unit: 'degrees F', low: 30, high: 65,
    source: S.epaHeatIslands, confidence: 'settled',
    note: 'SURFACE, not air. Dark paving can read 50-60F above the air on a sunny afternoon. This is the big number, and it is not an air temperature.',
  },
  SHADE_SURFACE_TEMP_REDUCTION_F: {
    label: 'Surface temperature reduction under shade',
    value: 32, unit: 'degrees F', low: 20, high: 45,
    source: S.epaHeatIslands, confidence: 'settled',
    note: 'Shaded surfaces run 20-45F cooler than the same material in full sun. This is what a person standing on the pavement in August actually feels.',
  },
  AIR_TEMP_UHI_MAX_F: {
    label: 'Maximum afternoon AIR temperature excess from local land cover',
    value: 7.0, unit: 'degrees F', low: 3.0, high: 12.0,
    source: S.natureTreesLst, confidence: 'contested',
    note: 'Intra-city AIR temperature differences are far smaller than surface differences and are routinely conflated with them. Reported land-surface differences of 20-40F correspond to air differences of a few degrees.',
  },
  AIR_TEMP_CANOPY_COOLING_MAX_F: {
    label: 'Maximum air cooling achievable from tree canopy',
    value: 2.7, unit: 'degrees F', low: 0.9, high: 10.4,
    source: S.npjCanopy, confidence: 'contested',
    note: 'Up to 1.5 C in heat-prone areas from increased canopy. Reviews report air cooling from 0.5 to 5.8 C depending on canopy density and climate, so the upper end is genuinely uncertain.',
  },
  AIR_TEMP_COOLING_PER_CANOPY_POINT_F: {
    label: 'Air cooling per percentage point of tree canopy',
    value: 0.07, unit: 'degrees F per percentage point', low: 0.02, high: 0.12,
    source: S.npjCanopy, confidence: 'contested',
    note: 'Derived by spreading the maximum cooling over a realistic canopy range. Non-linear in reality: canopy below roughly 40% cover does much less per point than canopy above it.',
  },
  BASE_DAYS_OVER_95: {
    label: 'Baseline days above 95F',
    value: 18, unit: 'days per year', low: 5, high: 45,
    source: S.design, confidence: 'contextual',
    note: 'For a generic mid-latitude US city, before the local heat island is added.',
  },
  CLIMATE_DAYS_OVER_95_TREND: {
    label: 'Trend in days above 95F',
    value: 0.45, unit: 'additional days per year', low: 0.2, high: 0.9,
    source: S.design, confidence: 'contextual',
    note: 'Background warming over the thirty years of a run, independent of anything the player does. It is in the model so the player cannot take credit for it.',
  },
  DAYS_OVER_95_PER_DEGREE_F: {
    label: 'Additional days above 95F per degree of local warming',
    value: 2.6, unit: 'days per degree F', low: 1.2, high: 4.5,
    source: S.design, confidence: 'contextual',
    note: 'The tail of the temperature distribution moves faster than the mean does.',
  },
  STOP_AND_GO_EMISSION_PENALTY: {
    label: 'Emission penalty in congested flow',
    value: 1.55, unit: 'multiplier at volume-to-capacity 1.0', low: 1.2, high: 2.4,
    source: S.design, confidence: 'contextual',
    note: 'Accelerating away from a queue burns far more fuel per mile than steady running.',
  },
  PM25_REGIONAL_BACKGROUND: {
    label: 'Regional background PM2.5',
    value: 8.0, unit: 'micrograms per cubic metre', low: 4.0, high: 14.0,
    source: S.epaNaaqsPm, confidence: 'contextual',
    note: 'What the whole region breathes before the corridor adds anything. The corridor increment is measured against this.',
  },
  NO2_REGIONAL_BACKGROUND: {
    label: 'Regional background NO2',
    value: 12.0, unit: 'parts per billion', low: 5.0, high: 25.0,
    source: S.heiSr17, confidence: 'contextual',
    note: 'Urban background away from major roads.',
  },
  NO2_NEAR_ROAD_ELEVATION: {
    label: 'NO2 elevation at the kerb relative to background',
    value: 0.55, unit: 'fraction above background', low: 0.2, high: 1.2,
    source: S.heiSr17, confidence: 'contextual',
    note: 'NO2 shows a real near-road gradient, unlike PM2.5: roughly a fifth of it is gone by 300 m and the gradient runs to 500 m.',
  },
  TRUCK_SHARE: {
    label: 'Heavy vehicle share of corridor traffic',
    value: 0.045, unit: 'fraction', low: 0.02, high: 0.09,
    source: S.design, confidence: 'contextual',
    note: 'Small in count, large in noise.',
  },
  TRUCK_NOISE_EQUIVALENCE: {
    label: 'Cars per heavy vehicle, acoustically',
    value: 10, unit: 'passenger car equivalents', low: 5, high: 20,
    source: S.fhwaTnm, confidence: 'contextual',
    note: 'Why a corridor on a lorry route sounds louder than its volume suggests.',
  },
})

// ---------------------------------------------------------------------------
// Mode choice
// ---------------------------------------------------------------------------

const modeChoice = defineConstants({
  BIKE_WILLING_SHARE_LTS1: {
    label: 'Share of adults willing to ride in level of traffic stress 1',
    value: 1.0, unit: 'fraction', low: 0.8, high: 1.0,
    source: S.design, confidence: 'contextual',
    note: 'A quiet street a child could ride. Design parameter reflecting the level-of-traffic-stress literature: at LTS 1 willingness is not the binding constraint.',
  },
  BIKE_WILLING_SHARE_LTS2: {
    label: 'Share of adults willing to ride in level of traffic stress 2',
    value: 0.55, unit: 'fraction', low: 0.35, high: 0.75,
    source: S.design, confidence: 'contextual',
    note: 'A protected lane or a slow street. Roughly the "interested but concerned" majority.',
  },
  BIKE_WILLING_SHARE_LTS3: {
    label: 'Share of adults willing to ride in level of traffic stress 3',
    value: 0.15, unit: 'fraction', low: 0.05, high: 0.3,
    source: S.design, confidence: 'contextual',
    note: 'A painted lane on a busy street. Most people decline whatever the distance.',
  },
  BIKE_WILLING_SHARE_LTS4: {
    label: 'Share of adults willing to ride in level of traffic stress 4',
    value: 0.03, unit: 'fraction', low: 0.005, high: 0.08,
    source: S.design, confidence: 'contextual',
    note: 'Sharing a 45 mph arterial lane. This is the number that makes a bike lane on a bad corridor fail, and it is why the failure is honest rather than a scripted punishment.',
  },
  WALK_SPEED_MPH: {
    label: 'Walking speed',
    value: 3.1, unit: 'miles per hour', low: 2.5, high: 3.5,
    source: S.design, confidence: 'settled',
    note: 'Average adult walking speed on level ground.',
  },
  BIKE_SPEED_MPH: {
    label: 'Cycling speed',
    value: 9.5, unit: 'miles per hour', low: 8, high: 13,
    source: S.design, confidence: 'settled',
    note: 'Average utility cycling speed including stops.',
  },
  BUS_SPEED_MPH: {
    label: 'Bus running speed with stops',
    value: 12, unit: 'miles per hour', low: 8, high: 18,
    source: S.design, confidence: 'contextual',
    note: 'Slower than general traffic unless it has its own lane and signal priority.',
  },
  PARKING_SEARCH_MINUTES: {
    label: 'Time to find and leave a parking space',
    value: 2.0, unit: 'minutes', low: 0.5, high: 8.0,
    source: S.design, confidence: 'contextual',
    note: 'Near zero in a half-empty car park, several minutes where kerb parking is free and full. Priced kerb parking is never full, which is the whole argument for pricing it.',
  },
  MODE_UTILITY_TIME_COEFFICIENT: {
    label: 'Utility weight on travel time',
    value: -0.045, unit: 'utils per minute', low: -0.09, high: -0.02,
    source: S.design, confidence: 'contextual',
    note: 'Standard range in US mode choice models.',
  },
  MODE_UTILITY_COST_COEFFICIENT: {
    label: 'Utility weight on out-of-pocket cost',
    value: -0.28, unit: 'utils per dollar', low: -0.5, high: -0.1,
    source: S.design, confidence: 'contextual',
    note: 'Implies a value of time near $10/hour, at the low end of USDOT guidance, as is typical for short local trips.',
  },
  ASC_DRIVE: {
    label: 'Alternative-specific constant: driving',
    value: 1.2, unit: 'utils', low: 0.5, high: 2.5,
    source: S.design, confidence: 'contextual',
    note: 'The baked-in preference for driving that survives after time and cost are accounted for. Deliberately large: the game does not assume Americans secretly want to walk.',
  },
  ASC_WALK: {
    label: 'Alternative-specific constant: walking',
    value: 0.0, unit: 'utils', low: -1, high: 1,
    source: S.design, confidence: 'contextual',
    note: 'The reference mode; everything else is measured against it.',
  },
  ASC_BIKE: {
    label: 'Alternative-specific constant: cycling',
    value: -2.6, unit: 'utils', low: -3.5, high: -1.0,
    source: S.design, confidence: 'contextual',
    note: 'Most Americans will not cycle at any level of service. This constant is why a bike lane alone does not move mode share.',
  },
  ASC_TRANSIT: {
    label: 'Alternative-specific constant: transit',
    value: -1.4, unit: 'utils', low: -3, high: -0.3,
    source: S.design, confidence: 'contextual',
    note: 'Reflects reliability, comfort and stigma, none of which frequency alone fixes.',
  },
  WALK_COMFORT_PENALTY_MAX: {
    label: 'Maximum penalty on perceived walking time from a hostile street',
    value: 1.8, unit: 'multiplier on walk time', low: 1.2, high: 3.0,
    source: S.ewingCervero, confidence: 'contextual',
    note: 'A ten-minute walk beside 45 mph traffic with no shade feels like eighteen, and people choose accordingly. Design effects on walking are real but bounded, consistent with the meta-analysis.',
  },
  BIKE_STRESS_PENALTY_MAX: {
    label: 'Maximum penalty on perceived cycling time from traffic stress',
    value: 3.0, unit: 'multiplier on bike time', low: 1.5, high: 5.0,
    source: S.design, confidence: 'contextual',
    note: 'Level of Traffic Stress. Most people will not ride in LTS 3 or 4 conditions at any distance.',
  },
  TRANSIT_WAIT_WEIGHT: {
    label: 'How much worse waiting feels than riding',
    value: 2.1, unit: 'multiplier on wait time', low: 1.5, high: 3.0,
    source: S.vtpiTransitElasticities, confidence: 'settled',
    note: 'Consistently found near 2 in transit ridership research.',
  },
  TRANSIT_FREQUENCY_ELASTICITY: {
    label: 'Elasticity of transit ridership with respect to service frequency',
    value: 0.5, unit: 'dimensionless', low: 0.3, high: 0.7,
    source: S.vtpiTransitElasticities, confidence: 'settled',
    note: 'The headway elasticity averages 0.5, with larger effects where service is currently infrequent.',
  },
  TRANSIT_FARE_ELASTICITY: {
    label: 'Elasticity of transit ridership with respect to fare',
    value: -0.3, unit: 'dimensionless', low: -0.5, high: -0.15,
    source: S.vtpiTransitElasticities, confidence: 'settled',
    note: 'The Simpson-Curtin rule: a 3% fare rise costs about 1% of riders. Note this is the FARE rule, often misattributed to frequency.',
  },
  PARKING_PRICE_ELASTICITY: {
    label: 'Elasticity of car trips with respect to parking price',
    value: -0.3, unit: 'dimensionless', low: -0.6, high: -0.1,
    source: S.vtpiElasticities, confidence: 'contextual',
    note: 'Parking price moves behaviour more per dollar than fuel price does. Where a charge suppresses car trips, 20-60% of them shift to transit.',
  },
  TRANSIT_DENSITY_THRESHOLD_DU_ACRE: {
    label: 'Density at which local bus service becomes viable',
    value: 7, unit: 'dwelling units per acre', low: 4, high: 12,
    source: S.psrcDensity, confidence: 'contextual',
    note: 'Pushkarev & Zupan: 7 for local bus, 9 for light rail, 12 for rapid transit. Below this a route burns subsidy and carries almost nobody - which is why a transit line at low density fails in this game.',
  },
  MAX_BUILT_ENVIRONMENT_ELASTICITY: {
    label: 'Largest defensible elasticity of travel to any built-environment variable',
    value: 0.39, unit: 'dimensionless', low: 0.3, high: 0.45,
    source: S.ewingCervero, confidence: 'settled',
    note: 'A discipline anchor, not an input. No single design variable in the meta-analysis exceeds this, and a test asserts the model does not either. Density in particular is only weakly associated with travel once accessibility is controlled for.',
  },
  BIKE_RIDERSHIP_PROXIMITY_R2: {
    label: 'Variation in cycling explained by people living near the lane',
    value: 0.88, unit: 'r-squared', low: 0.7, high: 0.95,
    source: S.itdpBikelanes, confidence: 'contextual',
    note: 'The evidential basis for letting bike lanes fail in this game. Infrastructure that does not connect where people live to where they are going is barely used.',
  },
  WALK_TRIP_DISTANCE_DECAY: {
    label: 'Distance decay exponent for walking trips',
    value: 1.9, unit: 'exponent', low: 1.2, high: 3.0,
    source: S.ewingCervero, confidence: 'contextual',
    note: 'Walking collapses beyond about half a mile, which is why land use, not pavement width, decides walk mode share.',
  },
  ACCESSIBILITY_TIME_BUDGET_MIN: {
    label: 'The reachability threshold',
    value: 15, unit: 'minutes', low: 15, high: 15,
    source: S.design, confidence: 'settled',
    note: 'The number the final scoring is built on. Chosen, not measured.',
  },
})

// ---------------------------------------------------------------------------
// Retail and housing
// ---------------------------------------------------------------------------

const property = defineConstants({
  RETAIL_SALES_PER_SQFT_STRIP: {
    label: 'Annual sales per square foot: strip retail',
    value: 280, unit: 'dollars per square foot per year', low: 150, high: 450,
    source: S.design, confidence: 'contextual',
    note: 'Across all tenants including the weak ones. Class B in-line retail is commonly quoted at $250-400.',
  },
  RETAIL_SALES_PER_SQFT_MAINSTREET: {
    label: 'Annual sales per square foot: main street retail',
    value: 360, unit: 'dollars per square foot per year', low: 200, high: 700,
    source: S.design, confidence: 'contextual',
    note: 'Smaller units and more visitors per hour, so more sales from less floor area.',
  },
  RETAIL_SALES_PER_SQFT_BIG_BOX: {
    label: 'Annual sales per square foot: big box',
    value: 420, unit: 'dollars per square foot per year', low: 180, high: 600,
    source: S.design, confidence: 'contextual',
    note: 'Strong per square foot of building, weak per acre of site, because 85% of the site is not building. Calibrated so sales tax per acre reproduces the published figure.',
  },
  RETAIL_RENT_PER_SQFT_STRIP: {
    label: 'Annual rent per square foot: strip retail',
    value: 19, unit: 'dollars per square foot per year', low: 18, high: 35,
    source: S.design, confidence: 'contextual',
    note: 'Triple net, mid-size market. Fairview sits at the bottom of the national range, because Fairview is struggling.',
  },
  RETAIL_RENT_PER_SQFT_MAINSTREET: {
    label: 'Annual rent per square foot: main street retail',
    value: 27, unit: 'dollars per square foot per year', low: 14, high: 60,
    source: S.design, confidence: 'contextual',
    note: 'Higher rent, and shops still do better, because the footfall is worth more than the rent costs.',
  },
  RETAIL_OCCUPANCY_COST_FAILURE_RATIO: {
    label: 'Occupancy cost ratio at which a shop fails',
    value: 0.15, unit: 'rent as a fraction of sales', low: 0.10, high: 0.20,
    source: S.design, confidence: 'contextual',
    note: 'Above roughly 15% of sales, rent is consuming enough that viability is in question. Apparel runs near 12%, drug stores near 7%.',
  },
  RETAIL_FOOTFALL_SALES_ELASTICITY: {
    label: 'Elasticity of retail sales with respect to passing footfall',
    value: 0.25, unit: 'dimensionless', low: 0.1, high: 0.45,
    source: S.design, confidence: 'contextual',
    note: 'Real but modest, and it only matters once there is somewhere to walk from. Held below the meta-analysis ceiling deliberately.',
  },
  GROCERY_TRADE_AREA_POPULATION: {
    label: 'Population needed to support a full grocery',
    value: 9000, unit: 'people', low: 5000, high: 20000,
    source: S.design, confidence: 'contextual',
    note: 'The threshold that decides whether the reachability score can ever improve. Below it, no amount of pavement produces a shop to walk to.',
  },
  BUSINESS_TURNOVER_RATE_STRIP: {
    label: 'Annual tenant turnover: strip retail',
    value: 0.14, unit: 'fraction per year', low: 0.08, high: 0.25,
    source: S.design, confidence: 'contextual',
    note: 'Turnover is not failure. Sustained vacancy is.',
  },
  STRUCTURED_PARKING_COST_PER_STALL: {
    label: 'Structured parking construction cost per stall',
    value: 29900, unit: 'dollars per stall', low: 24000, high: 48000,
    source: S.wgiParking, confidence: 'settled',
    note: 'National median for above-grade structured parking. Below grade runs $48,000-$115,000 and rises 30-60% for each level down.',
  },
  SURFACE_PARKING_COST_PER_STALL: {
    label: 'Surface parking construction cost per stall',
    value: 6000, unit: 'dollars per stall', low: 4500, high: 9500,
    source: S.wgiParking, confidence: 'contextual',
    note: 'Paving, drainage, striping and lighting, excluding the land - which is the expensive part, and the part nobody counts.',
  },
  PARKING_STALL_AREA_SQFT: {
    label: 'Land consumed per surface parking stall',
    value: 330, unit: 'square feet per stall', low: 300, high: 400,
    source: S.design, confidence: 'settled',
    note: 'Stall plus its share of aisle. About 130 stalls to the acre.',
  },
  PARKING_MINIMUM_COST_PER_UNIT: {
    label: 'Monthly rent needed to carry each required parking stall',
    value: 150, unit: 'dollars per month per stall', low: 60, high: 250,
    source: S.vtpiParkingHousing, confidence: 'contextual',
    note: 'Bundled into every unit whether the household owns a car or not. One required space costs a lowest-quintile household about 6% of its budget; two cost 12%.',
  },
  HOUSING_SUPPLY_ELASTICITY: {
    label: 'Elasticity of housing supply with respect to price',
    value: 1.2, unit: 'dimensionless', low: 0.3, high: 3.0,
    source: S.design, confidence: 'contested',
    note: 'The supply-side and supply-sceptic camps disagree sharply about this number and about what it implies locally. The range here is wide on purpose.',
  },
  RENT_DENSITY_ELASTICITY: {
    label: 'Elasticity of rent with respect to allowed density',
    value: -0.25, unit: 'dimensionless', low: -0.6, high: 0.0,
    source: S.design, confidence: 'contested',
    note: 'Negative because more allowed supply lowers rent, but local studies find effects ranging from strongly negative to none at all.',
  },
  CITY_MEDIAN_RENT: {
    label: 'Median rent in Fairview, away from the corridor',
    value: 1150, unit: 'dollars per month', low: 800, high: 2200,
    source: S.design, confidence: 'contextual',
    note: 'The anchor corridor rents are measured against. The corridor is a small part of a housing market it does not control.',
  },
  MAX_ANNUAL_RENT_CHANGE: {
    label: 'Fastest rents move in a year',
    value: 0.05, unit: 'fraction', low: 0.02, high: 0.12,
    source: S.design, confidence: 'contextual',
    note: 'Leases, notice periods and stickiness. Without this cap the model produces rent moves no real market makes.',
  },
  MEDIAN_HOUSEHOLD_INCOME: {
    label: 'Median household income, Fairview',
    value: 63000, unit: 'dollars per year', low: 45000, high: 85000,
    source: S.design, confidence: 'contextual',
    note: 'The denominator for the transport cost burden the game scores at year 30.',
  },
  CAR_OWNERSHIP_ANNUAL_COST: {
    label: 'Annual cost of owning one car',
    value: 8800, unit: 'dollars per year', low: 6000, high: 13000,
    source: S.design, confidence: 'contextual',
    note: 'Depreciation, insurance, fuel, maintenance and finance. Shedding one car is the largest single saving available to a household on this corridor.',
  },
  TRANSPORT_COST_SHARE_AUTO_DEPENDENT: {
    label: 'Transport cost share of income: auto-dependent neighbourhood',
    value: 0.25, unit: 'fraction of household income', low: 0.18, high: 0.32,
    source: S.cntHT, confidence: 'contextual',
    note: 'Household transport costs run from about $8,500 to $25,000 a year across a region. Never shown in the UI until year 30.',
  },
  TRANSPORT_COST_SHARE_WALKABLE: {
    label: 'Transport cost share of income: location-efficient neighbourhood',
    value: 0.15, unit: 'fraction of household income', low: 0.09, high: 0.19,
    source: S.cntHT, confidence: 'contextual',
    note: 'CNT treats 15% as the attainable transport benchmark. The gap between this and the figure above is roughly a car payment, every month, for every household.',
  },
  HT_AFFORDABILITY_BENCHMARK: {
    label: 'Combined housing and transport affordability benchmark',
    value: 0.45, unit: 'fraction of household income', low: 0.45, high: 0.45,
    source: S.cntHT, confidence: 'settled',
    note: 'Housing alone is judged at 30%. Adding transport at 15% gives 45% - by which measure only about a quarter of US neighbourhoods are affordable.',
  },
})

// ---------------------------------------------------------------------------
// Politics. Game design, tuned by play, not measured in the field.
// ---------------------------------------------------------------------------

const politics = defineConstants({
  STARTING_POLITICAL_CAPITAL: {
    label: 'Political capital at hiring',
    value: 60, unit: 'points', low: 60, high: 60,
    source: S.design, confidence: 'settled',
    note: 'Enough to make one unpopular move in the first three years, and not two.',
  },
  PC_ANNUAL_REGENERATION_BASE: {
    label: 'Political capital earned per year at neutral approval',
    value: 7, unit: 'points per year', low: 7, high: 7,
    source: S.design, confidence: 'settled',
    note: 'Scaled by approval, so a popular director accumulates capital faster and can spend it on things nobody wants.',
  },
  PC_SURPLUS_SENSITIVITY: {
    label: 'Approval points per million dollars of surplus swing',
    value: 0.9, unit: 'approval points per million dollars', low: 0.9, high: 0.9,
    source: S.design, confidence: 'settled',
    note: 'Voters notice the budget eventually, and blame whoever is in the chair.',
  },
  APPROVAL_CONGESTION_SENSITIVITY: {
    label: 'Approval lost per 10% rise in peak travel time',
    value: 6.0, unit: 'approval points', low: 6.0, high: 6.0,
    source: S.design, confidence: 'settled',
    note: 'Congestion is the most legible thing a resident experiences, so it moves approval hardest and soonest. Tuned high on purpose: this is why the widening is so tempting, and if it were not tempting the game would be a lecture.',
  },
  PC_RIBBON_CUTTING: {
    label: 'Political capital from opening a completed capital project',
    value: 4, unit: 'points', low: 4, high: 4,
    source: S.design, confidence: 'settled',
    note: 'Standing in front of something finished buys the room for the next unpopular thing. Spending capital to build something that works is how a director refills it.',
  },
  APPROVAL_RIBBON_CUTTING: {
    label: 'Approval from opening a completed capital project',
    value: 6, unit: 'approval points', low: 6, high: 6,
    source: S.design, confidence: 'settled',
    note: 'Finishing something visible is worth more politically than the thing itself usually deserves. Mayors know this; the model does too.',
  },
  APPROVAL_FATALITY_SENSITIVITY: {
    label: 'Approval lost per additional death on the corridor',
    value: 1.8, unit: 'approval points per death', low: 1.8, high: 1.8,
    source: S.design, confidence: 'settled',
    note: 'Deliberately small. Residents do not attribute traffic deaths to the Public Works Director, which is most of why nothing changes.',
  },
  STATE_GRANT_MATCH_RATIO: {
    label: 'State DOT widening grant match',
    value: 0.9, unit: 'fraction funded by the state', low: 0.9, high: 0.9,
    source: S.design, confidence: 'settled',
    note: 'The city pays 10% of construction and 100% of maintenance, for ever. The honest core of American municipal finance, and the opening trap of the game.',
  },
  RUN_LENGTH_YEARS: {
    label: 'Length of a run',
    value: 30, unit: 'years', low: 30, high: 30,
    source: S.design, confidence: 'settled',
    note: 'Long enough for one pavement cycle and one generation of children.',
  },
})

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const CONSTANT_REGISTRY = mergeRegistries(
  geometry.registry,
  traffic.registry,
  landValue.registry,
  liability.registry,
  safety.registry,
  environment.registry,
  modeChoice.registry,
  property.registry,
  politics.registry,
)

/** The plain numbers, for arithmetic. Provenance lives in CONSTANT_REGISTRY. */
export const C = {
  ...geometry.values,
  ...traffic.values,
  ...landValue.values,
  ...liability.values,
  ...safety.values,
  ...environment.values,
  ...modeChoice.values,
  ...property.values,
  ...politics.values,
}

export type ConstantKey = keyof typeof C

/** Grouped for MODEL.md and the "Why this number?" panel's table of contents. */
export const CONSTANT_GROUPS: readonly { title: string; blurb: string; keys: string[] }[] = [
  { title: 'Corridor geometry', blurb: 'Level design. Not research, and labelled as such.', keys: Object.keys(geometry.values) },
  { title: 'Traffic, capacity and induced demand', blurb: 'How much traffic there is, how fast it moves, and how it grows back.', keys: Object.keys(traffic.values) },
  { title: 'Land value and revenue per acre', blurb: 'The central fiscal fact: what a given acre pays the city each year.', keys: Object.keys(landValue.values) },
  { title: 'Infrastructure liability', blurb: 'What that acre costs the city each year. Liability follows area, revenue follows value.', keys: Object.keys(liability.values) },
  { title: 'Safety', blurb: 'Crash frequency, crash severity, and who gets hurt.', keys: Object.keys(safety.values) },
  { title: 'Noise, air and heat', blurb: 'What the corridor does to the people standing next to it.', keys: Object.keys(environment.values) },
  { title: 'Mode choice', blurb: 'How people decide to travel. Never set directly by the player.', keys: Object.keys(modeChoice.values) },
  { title: 'Retail and housing', blurb: 'Whether shops survive and what it costs to live here.', keys: Object.keys(property.values) },
  { title: 'Politics', blurb: 'Game design parameters, tuned by play.', keys: Object.keys(politics.values) },
]
